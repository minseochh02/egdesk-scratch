import Database from 'better-sqlite3';
import { DynamicSchemaManager, ColumnMapping, createSchemaManager } from './dynamic-schema-manager';

// ============================================================================
// Types
// ============================================================================

export type SyncMode = 'realtime' | 'periodic' | 'manual';

export interface SheetChange {
  id: string;
  timestamp: string;
  sheet: string;
  row: number;
  col: number;
  oldValue: any;
  newValue: any;
  source?: string;  // 'edit', 'function', 'batch'
}

export interface SyncResult {
  applied: number;
  conflicts: number;
  newColumns: number;
  renamedColumns: number;
  errors: string[];
}

export interface SheetSyncControllerConfig {
  db: Database.Database;
  spreadsheetId: string;
  tunnelUrl: string;
  schemaManager?: DynamicSchemaManager;
  geminiApiKey?: string;
  onSyncComplete?: (result: SyncResult) => void;
  onRealtimeChange?: (change: SheetChange) => void;
}

export interface ColumnHeader {
  index: number;
  header: string;
}

// ============================================================================
// Sheet Sync Controller
// ============================================================================

export class SheetSyncController {
  private db: Database.Database;
  private spreadsheetId: string;
  private tunnelUrl: string;
  private schemaManager: DynamicSchemaManager;
  private mode: SyncMode = 'manual';
  private intervalId?: NodeJS.Timeout;
  private headerCache: Map<string, Map<number, string>> = new Map();
  private onSyncComplete?: (result: SyncResult) => void;
  private onRealtimeChange?: (change: SheetChange) => void;

  constructor(config: SheetSyncControllerConfig) {
    this.db = config.db;
    this.spreadsheetId = config.spreadsheetId;
    this.tunnelUrl = config.tunnelUrl;
    this.onSyncComplete = config.onSyncComplete;
    this.onRealtimeChange = config.onRealtimeChange;

    // Use provided schema manager or create one
    this.schemaManager = config.schemaManager || createSchemaManager(this.db, {
      geminiApiKey: config.geminiApiKey
    });

    this.initSyncTables();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private initSyncTables(): void {
    this.db.exec(`
      -- Track remote changes for audit/debugging
      CREATE TABLE IF NOT EXISTS _remote_changelog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        change_id TEXT UNIQUE,
        sheet_name TEXT NOT NULL,
        row INTEGER NOT NULL,
        col INTEGER NOT NULL,
        old_value TEXT,
        new_value TEXT,
        source TEXT DEFAULT 'edit',
        timestamp TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        was_conflict INTEGER DEFAULT 0
      );

      -- Sync status tracking
      CREATE TABLE IF NOT EXISTS _sync_status (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        tunnel_url TEXT,
        spreadsheet_id TEXT,
        sync_mode TEXT DEFAULT 'manual',
        last_pull TEXT,
        last_push TEXT,
        total_pulls INTEGER DEFAULT 0,
        total_pushes INTEGER DEFAULT 0,
        total_conflicts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO _sync_status (id, tunnel_url, spreadsheet_id) 
      VALUES (1, NULL, NULL);
    `);

    // Update sync status with current config
    this.db.prepare(`
      UPDATE _sync_status 
      SET tunnel_url = ?, spreadsheet_id = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(this.tunnelUrl, this.spreadsheetId);
  }

  // ==========================================================================
  // Mode Management
  // ==========================================================================

  /**
   * Set sync mode and configure accordingly
   */
  async setMode(mode: SyncMode, intervalMs: number = 60_000): Promise<void> {
    // Clear existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.mode = mode;

    // Update Apps Script configuration via tunnel
    try {
      await this.callAppsScript('setSyncMode', [mode]);
      await this.callAppsScript('setTunnelUrl', [this.tunnelUrl]);
    } catch (error) {
      console.warn('[Sync] Failed to configure Apps Script:', error);
    }

    // Set up periodic sync if needed
    if (mode === 'periodic') {
      this.intervalId = setInterval(() => {
        this.sync().catch(err => console.error('[Sync] Periodic sync failed:', err));
      }, intervalMs);
    }

    // Update status in DB
    this.db.prepare(`
      UPDATE _sync_status 
      SET sync_mode = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(mode);

    console.log(`[Sync] Mode set to: ${mode}${mode === 'periodic' ? ` (every ${intervalMs}ms)` : ''}`);
  }

  /**
   * Get current sync mode
   */
  getMode(): SyncMode {
    return this.mode;
  }

  /**
   * Stop periodic sync
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[Sync] Stopped');
  }

  // ==========================================================================
  // Main Sync Methods
  // ==========================================================================

  /**
   * Single unified sync method — works for all modes
   */
  async sync(): Promise<SyncResult> {
    console.log(`[Sync] Starting sync (mode: ${this.mode})`);
    
    const changes = await this.pullChanges();
    
    if (changes.length === 0) {
      console.log('[Sync] No changes to process');
      return { applied: 0, conflicts: 0, newColumns: 0, renamedColumns: 0, errors: [] };
    }

    console.log(`[Sync] Processing ${changes.length} changes`);
    const result = await this.applyChanges(changes);
    
    // Mark changes as synced in Apps Script
    const syncedIds = changes.map(c => c.id);
    try {
      await this.callAppsScript('markSynced', [syncedIds]);
    } catch (error) {
      console.warn('[Sync] Failed to mark changes as synced:', error);
    }

    // Update sync status
    this.db.prepare(`
      UPDATE _sync_status 
      SET last_pull = datetime('now'),
          total_pulls = total_pulls + 1,
          total_conflicts = total_conflicts + ?,
          updated_at = datetime('now')
      WHERE id = 1
    `).run(result.conflicts);
    
    console.log(`[Sync] Complete:`, result);
    
    // Callback
    this.onSyncComplete?.(result);
    
    return result;
  }

  /**
   * Apply changes from sheet to SQLite
   */
  async applyChanges(changes: SheetChange[]): Promise<SyncResult> {
    let applied = 0;
    let conflicts = 0;
    let newColumns = 0;
    let renamedColumns = 0;
    const errors: string[] = [];

    // Group changes by sheet for header fetching efficiency
    const changesBySheet = new Map<string, SheetChange[]>();
    for (const change of changes) {
      if (!changesBySheet.has(change.sheet)) {
        changesBySheet.set(change.sheet, []);
      }
      changesBySheet.get(change.sheet)!.push(change);
    }

    // Process each sheet's changes
    for (const [sheetName, sheetChanges] of changesBySheet) {
      try {
        // Fetch headers for this sheet
        await this.refreshHeaderCache(sheetName);
        
        for (const change of sheetChanges) {
          try {
            const result = await this.applySingleChange(sheetName, change);
            
            if (result.applied) applied++;
            if (result.conflict) conflicts++;
            if (result.newColumn) newColumns++;
            if (result.renamedColumn) renamedColumns++;
            
          } catch (error: any) {
            const msg = `Error applying change ${change.id}: ${error.message}`;
            console.error(`[Sync] ${msg}`);
            errors.push(msg);
          }
        }
      } catch (error: any) {
        const msg = `Error processing sheet ${sheetName}: ${error.message}`;
        console.error(`[Sync] ${msg}`);
        errors.push(msg);
      }
    }

    return { applied, conflicts, newColumns, renamedColumns, errors };
  }

  /**
   * Apply a single change to SQLite
   */
  private async applySingleChange(
    sheetName: string, 
    change: SheetChange
  ): Promise<{
    applied: boolean;
    conflict: boolean;
    newColumn: boolean;
    renamedColumn: boolean;
  }> {
    let applied = false;
    let conflict = false;
    let newColumn = false;
    let renamedColumn = false;

    // Get column header
    const columnHeader = this.getColumnHeader(sheetName, change.col);
    if (!columnHeader) {
      console.warn(`[Sync] No header for ${sheetName}:${change.col}, skipping`);
      return { applied, conflict, newColumn, renamedColumn };
    }

    // Check if this is a header row change (row 1 by default)
    const headerRow = this.getHeaderRow(sheetName);
    if (change.row === headerRow) {
      // This is a header rename, not a data change
      // The schema manager will handle this on next data sync
      console.log(`[Sync] Header change detected: "${change.oldValue}" → "${change.newValue}"`);
      // Update our header cache
      this.headerCache.get(sheetName)?.set(change.col, change.newValue);
      return { applied: true, conflict, newColumn, renamedColumn };
    }

    // Resolve column (may trigger AI for new/renamed)
    const resolution = await this.schemaManager.resolveColumn(
      sheetName,
      change.col,
      columnHeader,
      change.newValue
    );

    if (resolution.action === 'created') newColumn = true;
    if (resolution.action === 'renamed') renamedColumn = true;

    const tableName = this.schemaManager.getTableName(sheetName);
    if (!tableName) {
      console.warn(`[Sync] No table for sheet: ${sheetName}`);
      return { applied, conflict, newColumn, renamedColumn };
    }

    // Ensure row exists
    this.ensureRow(tableName, change.row);

    // Check for conflicts (SQLite newer = SQLite wins)
    const sqliteModified = this.getRowModifiedTime(tableName, change.row);
    if (sqliteModified && new Date(sqliteModified) > new Date(change.timestamp)) {
      conflict = true;
      console.log(`[Sync] Conflict at ${sheetName}:${change.row}:${change.col} — SQLite wins`);
      
      // Log the conflict
      this.logRemoteChange(change, true);
      
      return { applied, conflict, newColumn, renamedColumn };
    }

    // Apply the change
    const typedValue = this.castValue(change.newValue, resolution.mapping.dataType);
    
    this.db.prepare(`
      UPDATE "${tableName}" 
      SET "${resolution.mapping.dbColumn}" = ?, 
          _modified_at = datetime('now'),
          _synced_at = datetime('now')
      WHERE _row_id = ?
    `).run(typedValue, change.row);

    applied = true;

    // Log the change
    this.logRemoteChange(change, false);

    return { applied, conflict, newColumn, renamedColumn };
  }

  /**
   * Receive changes pushed in realtime mode (called by your HTTP server)
   */
  async receiveRealtimeChanges(changes: SheetChange[]): Promise<SyncResult> {
    if (this.mode !== 'realtime') {
      console.warn('[Sync] Received realtime changes but not in realtime mode');
    }

    // Notify callback for each change
    for (const change of changes) {
      this.onRealtimeChange?.(change);
    }

    return this.applyChanges(changes);
  }

  // ==========================================================================
  // Header Management
  // ==========================================================================

  /**
   * Refresh header cache for a sheet
   */
  private async refreshHeaderCache(sheetName: string): Promise<void> {
    try {
      const headers = await this.callAppsScript('getColumnHeaders', [sheetName]) as ColumnHeader[];
      const headerMap = new Map<number, string>();
      
      for (const h of headers || []) {
        headerMap.set(h.index, h.header);
      }
      
      this.headerCache.set(sheetName, headerMap);
      console.log(`[Sync] Cached ${headerMap.size} headers for sheet: ${sheetName}`);
    } catch (error) {
      console.error(`[Sync] Failed to fetch headers for ${sheetName}:`, error);
    }
  }

  /**
   * Get column header from cache
   */
  private getColumnHeader(sheetName: string, colIndex: number): string | null {
    return this.headerCache.get(sheetName)?.get(colIndex) || null;
  }

  /**
   * Get header row for a sheet (defaults to 1)
   */
  private getHeaderRow(sheetName: string): number {
    const row = this.db.prepare(`
      SELECT header_row FROM _sheet_tables WHERE sheet_name = ?
    `).get(sheetName) as any;
    return row?.header_row || 1;
  }

  // ==========================================================================
  // Row Management
  // ==========================================================================

  /**
   * Ensure a row exists in the table
   */
  private ensureRow(tableName: string, rowId: number): void {
    const exists = this.db.prepare(
      `SELECT 1 FROM "${tableName}" WHERE _row_id = ?`
    ).get(rowId);
    
    if (!exists) {
      this.db.prepare(
        `INSERT INTO "${tableName}" (_row_id) VALUES (?)`
      ).run(rowId);
    }
  }

  /**
   * Get the last modified time for a row
   */
  private getRowModifiedTime(tableName: string, rowId: number): string | null {
    const row = this.db.prepare(
      `SELECT _modified_at FROM "${tableName}" WHERE _row_id = ?`
    ).get(rowId) as any;
    return row?._modified_at || null;
  }

  // ==========================================================================
  // Change Logging
  // ==========================================================================

  /**
   * Log a remote change for audit purposes
   */
  private logRemoteChange(change: SheetChange, wasConflict: boolean): void {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO _remote_changelog 
        (change_id, sheet_name, row, col, old_value, new_value, source, timestamp, was_conflict)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        change.id,
        change.sheet,
        change.row,
        change.col,
        change.oldValue != null ? String(change.oldValue) : null,
        change.newValue != null ? String(change.newValue) : null,
        change.source || 'edit',
        change.timestamp,
        wasConflict ? 1 : 0
      );
    } catch (error) {
      // Ignore duplicate change_id errors
    }
  }

  // ==========================================================================
  // Apps Script Communication
  // ==========================================================================

  /**
   * Pull unsynced changes from Apps Script
   */
  private async pullChanges(): Promise<SheetChange[]> {
    try {
      const result = await this.callAppsScript('getUnsynced', []);
      return result || [];
    } catch (error) {
      console.error('[Sync] Failed to pull changes:', error);
      return [];
    }
  }

  /**
   * Call an Apps Script function via the tunnel
   */
  private async callAppsScript(fn: string, args: any[]): Promise<any> {
    const response = await fetch(`${this.tunnelUrl}/apps-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        function: fn, 
        parameters: args, 
        spreadsheetId: this.spreadsheetId 
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apps Script call failed: ${response.status} - ${error}`);
    }
    
    return response.json();
  }

  // ==========================================================================
  // Value Casting
  // ==========================================================================

  /**
   * Cast a value to the appropriate SQLite type
   */
  private castValue(value: any, dataType: string): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    switch (dataType) {
      case 'INTEGER':
        const intVal = parseInt(String(value), 10);
        return isNaN(intVal) ? null : intVal;
      
      case 'REAL':
        const floatVal = parseFloat(String(value));
        return isNaN(floatVal) ? null : floatVal;
      
      case 'BOOLEAN':
        if (typeof value === 'boolean') return value ? 1 : 0;
        return /^(true|yes|1)$/i.test(String(value)) ? 1 : 0;
      
      case 'DATETIME':
        try {
          return new Date(value).toISOString();
        } catch {
          return String(value);
        }
      
      default:
        return String(value);
    }
  }

  // ==========================================================================
  // Status & Getters
  // ==========================================================================

  /**
   * Get sync status
   */
  getSyncStatus(): {
    mode: SyncMode;
    tunnelUrl: string;
    spreadsheetId: string;
    lastPull: string | null;
    totalPulls: number;
    totalConflicts: number;
  } {
    const row = this.db.prepare('SELECT * FROM _sync_status WHERE id = 1').get() as any;
    return {
      mode: this.mode,
      tunnelUrl: this.tunnelUrl,
      spreadsheetId: this.spreadsheetId,
      lastPull: row?.last_pull || null,
      totalPulls: row?.total_pulls || 0,
      totalConflicts: row?.total_conflicts || 0
    };
  }

  /**
   * Get the schema manager instance
   */
  getSchemaManager(): DynamicSchemaManager {
    return this.schemaManager;
  }

  /**
   * Get recent remote changes (for debugging)
   */
  getRecentChanges(limit: number = 50): Array<{
    change_id: string;
    sheet_name: string;
    row: number;
    col: number;
    old_value: string | null;
    new_value: string | null;
    timestamp: string;
    was_conflict: boolean;
  }> {
    return this.db.prepare(`
      SELECT change_id, sheet_name, row, col, old_value, new_value, 
             timestamp, was_conflict
      FROM _remote_changelog 
      ORDER BY applied_at DESC 
      LIMIT ?
    `).all(limit) as any[];
  }
}

// ============================================================================
// Local Change Tracker (for bidirectional sync)
// ============================================================================

export class LocalChangeTracker {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initChangelogTable();
  }

  private initChangelogTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _local_changelog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_id INTEGER NOT NULL,
        column_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT DEFAULT (datetime('now')),
        pushed_to_sheet INTEGER DEFAULT 0,
        push_attempts INTEGER DEFAULT 0,
        last_push_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_local_changelog_unpushed 
        ON _local_changelog(pushed_to_sheet, changed_at);
    `);
  }

  /**
   * Create UPDATE triggers for a table/column
   */
  createUpdateTrigger(tableName: string, columnName: string): void {
    const triggerName = `track_${tableName}_${columnName}`.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Drop existing trigger if any
    this.db.exec(`DROP TRIGGER IF EXISTS "${triggerName}"`);
    
    // Create UPDATE trigger
    this.db.exec(`
      CREATE TRIGGER "${triggerName}"
      AFTER UPDATE OF "${columnName}" ON "${tableName}"
      WHEN OLD."${columnName}" IS NOT NEW."${columnName}"
      BEGIN
        INSERT INTO _local_changelog (table_name, row_id, column_name, old_value, new_value)
        VALUES (
          '${tableName}',
          NEW._row_id,
          '${columnName}',
          CAST(OLD."${columnName}" AS TEXT),
          CAST(NEW."${columnName}" AS TEXT)
        );
      END
    `);
  }

  /**
   * Create triggers for all data columns in a table
   */
  createTriggersForTable(tableName: string): void {
    const columns = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
    
    for (const col of columns) {
      // Skip internal columns
      if (col.name.startsWith('_')) continue;
      this.createUpdateTrigger(tableName, col.name);
    }
    
    console.log(`[Tracker] Created triggers for table: ${tableName}`);
  }

  /**
   * Get unpushed local changes
   */
  getUnpushedChanges(limit: number = 100): Array<{
    id: number;
    table_name: string;
    row_id: number;
    column_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
  }> {
    return this.db.prepare(`
      SELECT id, table_name, row_id, column_name, old_value, new_value, changed_at
      FROM _local_changelog 
      WHERE pushed_to_sheet = 0 
      ORDER BY changed_at ASC
      LIMIT ?
    `).all(limit) as any[];
  }

  /**
   * Mark changes as pushed
   */
  markAsPushed(ids: number[]): void {
    if (ids.length === 0) return;
    
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE _local_changelog 
      SET pushed_to_sheet = 1 
      WHERE id IN (${placeholders})
    `).run(...ids);
  }

  /**
   * Record a push error
   */
  recordPushError(id: number, error: string): void {
    this.db.prepare(`
      UPDATE _local_changelog 
      SET push_attempts = push_attempts + 1,
          last_push_error = ?
      WHERE id = ?
    `).run(error, id);
  }
}

// ============================================================================
// Sheet Pusher (SQLite → Sheet)
// ============================================================================

export class SheetPusher {
  private db: Database.Database;
  private schemaManager: DynamicSchemaManager;
  private changeTracker: LocalChangeTracker;
  private tunnelUrl: string;
  private spreadsheetId: string;

  constructor(
    db: Database.Database,
    schemaManager: DynamicSchemaManager,
    tunnelUrl: string,
    spreadsheetId: string
  ) {
    this.db = db;
    this.schemaManager = schemaManager;
    this.changeTracker = new LocalChangeTracker(db);
    this.tunnelUrl = tunnelUrl;
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * Push local SQLite changes to Google Sheet
   */
  async pushToSheet(): Promise<{ pushed: number; failed: number }> {
    const changes = this.changeTracker.getUnpushedChanges();
    
    if (changes.length === 0) {
      return { pushed: 0, failed: 0 };
    }

    console.log(`[Push] Pushing ${changes.length} local changes to sheet`);

    let pushed = 0;
    let failed = 0;
    const pushedIds: number[] = [];

    // Group by table for efficiency
    const changesByTable = new Map<string, typeof changes>();
    for (const change of changes) {
      if (!changesByTable.has(change.table_name)) {
        changesByTable.set(change.table_name, []);
      }
      changesByTable.get(change.table_name)!.push(change);
    }

    for (const [tableName, tableChanges] of changesByTable) {
      // Get sheet name from registry
      const sheetName = this.getSheetNameForTable(tableName);
      if (!sheetName) {
        console.warn(`[Push] No sheet mapping for table: ${tableName}`);
        failed += tableChanges.length;
        continue;
      }

      // Convert to sheet updates
      const updates: Array<{ sheet: string; row: number; col: number; value: any }> = [];
      
      for (const change of tableChanges) {
        const colIndex = this.getColumnIndexForDbColumn(sheetName, change.column_name);
        if (colIndex) {
          updates.push({
            sheet: sheetName,
            row: change.row_id,
            col: colIndex,
            value: change.new_value
          });
        }
      }

      // Batch update via Apps Script
      if (updates.length > 0) {
        try {
          await this.callAppsScript('batchUpdateCells', [updates]);
          pushed += updates.length;
          pushedIds.push(...tableChanges.map(c => c.id));
        } catch (error: any) {
          console.error(`[Push] Failed to push to ${sheetName}:`, error);
          for (const change of tableChanges) {
            this.changeTracker.recordPushError(change.id, error.message);
          }
          failed += tableChanges.length;
        }
      }
    }

    // Mark as pushed
    if (pushedIds.length > 0) {
      this.changeTracker.markAsPushed(pushedIds);
    }

    // Update sync status
    this.db.prepare(`
      UPDATE _sync_status 
      SET last_push = datetime('now'),
          total_pushes = total_pushes + 1,
          updated_at = datetime('now')
      WHERE id = 1
    `).run();

    console.log(`[Push] Complete: ${pushed} pushed, ${failed} failed`);
    return { pushed, failed };
  }

  /**
   * Get the change tracker instance
   */
  getChangeTracker(): LocalChangeTracker {
    return this.changeTracker;
  }

  private getSheetNameForTable(tableName: string): string | null {
    const row = this.db.prepare(
      'SELECT sheet_name FROM _sheet_tables WHERE table_name = ?'
    ).get(tableName) as any;
    return row?.sheet_name || null;
  }

  private getColumnIndexForDbColumn(sheetName: string, dbColumn: string): number | null {
    const row = this.db.prepare(
      'SELECT column_index FROM _schema_registry WHERE sheet_name = ? AND db_column = ?'
    ).get(sheetName, dbColumn) as any;
    return row?.column_index || null;
  }

  private async callAppsScript(fn: string, args: any[]): Promise<any> {
    const response = await fetch(`${this.tunnelUrl}/apps-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        function: fn, 
        parameters: args, 
        spreadsheetId: this.spreadsheetId 
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apps Script call failed: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
}

// ============================================================================
// Bidirectional Sync Controller
// ============================================================================

export class BidirectionalSyncController {
  private pullController: SheetSyncController;
  private pusher: SheetPusher;
  private mode: SyncMode = 'manual';
  private intervalId?: NodeJS.Timeout;

  constructor(config: SheetSyncControllerConfig) {
    this.pullController = new SheetSyncController(config);
    
    this.pusher = new SheetPusher(
      config.db,
      this.pullController.getSchemaManager(),
      config.tunnelUrl,
      config.spreadsheetId
    );
  }

  /**
   * Set sync mode for both directions
   */
  async setMode(mode: SyncMode, intervalMs: number = 60_000): Promise<void> {
    this.mode = mode;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    await this.pullController.setMode(mode, intervalMs);
    
    if (mode === 'periodic') {
      // Bidirectional sync on interval
      this.intervalId = setInterval(() => {
        this.syncBidirectional().catch(err => 
          console.error('[BiSync] Periodic sync failed:', err)
        );
      }, intervalMs);
    }
  }

  /**
   * Full bidirectional sync
   */
  async syncBidirectional(): Promise<{
    pulled: SyncResult;
    pushed: { pushed: number; failed: number };
  }> {
    console.log('[BiSync] Starting bidirectional sync');
    
    // Push local changes first (SQLite is source of truth)
    const pushed = await this.pusher.pushToSheet();
    
    // Then pull any sheet changes
    const pulled = await this.pullController.sync();
    
    console.log('[BiSync] Complete:', { pulled, pushed });
    
    return { pulled, pushed };
  }

  /**
   * Pull only (sheet → SQLite)
   */
  async pull(): Promise<SyncResult> {
    return this.pullController.sync();
  }

  /**
   * Push only (SQLite → sheet)  
   */
  async push(): Promise<{ pushed: number; failed: number }> {
    return this.pusher.pushToSheet();
  }

  /**
   * Receive realtime changes
   */
  async receiveRealtimeChanges(changes: SheetChange[]): Promise<SyncResult> {
    return this.pullController.receiveRealtimeChanges(changes);
  }

  /**
   * Get the pull controller
   */
  getPullController(): SheetSyncController {
    return this.pullController;
  }

  /**
   * Get the pusher
   */
  getPusher(): SheetPusher {
    return this.pusher;
  }

  /**
   * Stop all sync operations
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.pullController.stop();
  }

  /**
   * Set up change tracking triggers for a table
   */
  setupChangeTracking(tableName: string): void {
    this.pusher.getChangeTracker().createTriggersForTable(tableName);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createSyncController(config: SheetSyncControllerConfig): SheetSyncController {
  return new SheetSyncController(config);
}

export function createBidirectionalSync(config: SheetSyncControllerConfig): BidirectionalSyncController {
  return new BidirectionalSyncController(config);
}