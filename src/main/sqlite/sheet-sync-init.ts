import Database from 'better-sqlite3';
import path from 'path';

export interface DatabaseConfig {
  dbPath?: string;
  verbose?: boolean;
}

export function createSyncDatabase(config: DatabaseConfig = {}): Database.Database {
  const dbPath = config.dbPath || path.join(process.cwd(), 'egdesk.db');
  
  const db = new Database(dbPath, {
    verbose: config.verbose ? console.log : undefined
  });

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create all meta tables
  initializeMetaTables(db);
  initializeLocalChangelog(db);

  console.log(`[DB] Initialized sync database at: ${dbPath}`);
  
  return db;
}

function initializeMetaTables(db: Database.Database): void {
  db.exec(`
    -- =========================================================================
    -- SCHEMA REGISTRY
    -- Stores the mapping between Google Sheet columns and SQLite columns
    -- Tracks by POSITION (column_index) to detect renames
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS _schema_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      
      -- Track by POSITION, not just name
      column_index INTEGER NOT NULL,           -- 1-based column position (A=1, B=2, etc.)
      sheet_column TEXT NOT NULL,              -- Current header text in sheet
      sheet_column_history TEXT DEFAULT '[]',  -- JSON array of previous header names
      
      db_column TEXT NOT NULL,                 -- SQLite column name
      data_type TEXT DEFAULT 'TEXT',           -- TEXT, INTEGER, REAL, BOOLEAN, DATETIME
      nullable INTEGER DEFAULT 1,
      ai_inferred INTEGER DEFAULT 0,           -- 1 if AI determined the schema
      sample_values TEXT,                      -- JSON array of sample values for reference
      
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      
      UNIQUE(sheet_name, column_index)         -- Position is the true identifier
    );

    -- Index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_schema_registry_sheet 
      ON _schema_registry(sheet_name);
    CREATE INDEX IF NOT EXISTS idx_schema_registry_table 
      ON _schema_registry(table_name);

    -- =========================================================================
    -- SHEET TABLES REGISTRY
    -- Tracks which Google Sheets are synced to which SQLite tables
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS _sheet_tables (
      sheet_name TEXT PRIMARY KEY,
      table_name TEXT NOT NULL UNIQUE,
      spreadsheet_id TEXT,                     -- Google Spreadsheet ID
      last_synced TEXT,                        -- ISO timestamp of last sync
      row_id_column TEXT DEFAULT '_row_id',    -- Column used as primary key
      header_row INTEGER DEFAULT 1,            -- Which row contains headers
      sync_mode TEXT DEFAULT 'manual',         -- 'manual', 'periodic', 'realtime'
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- SYNC STATUS TABLE
    -- Tracks overall sync state and configuration
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS _sync_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),   -- Singleton row
      tunnel_url TEXT,
      last_pull TEXT,
      last_push TEXT,
      total_pulls INTEGER DEFAULT 0,
      total_pushes INTEGER DEFAULT 0,
      total_conflicts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Initialize singleton row
    INSERT OR IGNORE INTO _sync_status (id) VALUES (1);
  `);

  console.log('[DB] Meta tables initialized');
}

function initializeLocalChangelog(db: Database.Database): void {
  db.exec(`
    -- =========================================================================
    -- LOCAL CHANGELOG
    -- Tracks changes made locally in SQLite that need to sync to Google Sheet
    -- Used for bidirectional sync (SQLite → Sheet)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS _local_changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      pushed_to_sheet INTEGER DEFAULT 0,       -- 1 when successfully pushed
      push_attempts INTEGER DEFAULT 0,         -- Track failed attempts
      last_push_error TEXT                     -- Store error message if push failed
    );

    -- Index for finding unpushed changes
    CREATE INDEX IF NOT EXISTS idx_local_changelog_unpushed 
      ON _local_changelog(pushed_to_sheet, changed_at);
    CREATE INDEX IF NOT EXISTS idx_local_changelog_table 
      ON _local_changelog(table_name);

    -- =========================================================================
    -- REMOTE CHANGELOG
    -- Tracks changes pulled from Google Sheet (for debugging/audit)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS _remote_changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id TEXT UNIQUE,                   -- UUID from Google Apps Script
      sheet_name TEXT NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      old_value TEXT,
      new_value TEXT,
      source TEXT DEFAULT 'edit',              -- 'edit', 'function', 'batch'
      timestamp TEXT NOT NULL,                 -- When change occurred in sheet
      applied_at TEXT DEFAULT (datetime('now')),
      was_conflict INTEGER DEFAULT 0           -- 1 if this was a conflict (SQLite won)
    );

    CREATE INDEX IF NOT EXISTS idx_remote_changelog_sheet 
      ON _remote_changelog(sheet_name, timestamp);
  `);

  console.log('[DB] Changelog tables initialized');
}

/**
 * Create UPDATE triggers for a table to track local changes
 * Call this after creating a synced table or adding new columns
 */
export function createChangeTrackerTriggers(
  db: Database.Database, 
  tableName: string,
  excludeColumns: string[] = ['_row_id', '_synced_at', '_modified_at']
): void {
  // Get all columns for the table
  const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
    name: string;
    type: string;
  }>;

  for (const col of columns) {
    // Skip internal columns
    if (excludeColumns.includes(col.name) || col.name.startsWith('_')) {
      continue;
    }

    const triggerName = `track_${tableName}_${col.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Drop existing trigger if any
    db.exec(`DROP TRIGGER IF EXISTS "${triggerName}"`);
    
    // Create UPDATE trigger
    db.exec(`
      CREATE TRIGGER "${triggerName}"
      AFTER UPDATE OF "${col.name}" ON "${tableName}"
      WHEN OLD."${col.name}" IS NOT NEW."${col.name}"
      BEGIN
        INSERT INTO _local_changelog (table_name, row_id, column_name, old_value, new_value)
        VALUES (
          '${tableName}',
          NEW._row_id,
          '${col.name}',
          CAST(OLD."${col.name}" AS TEXT),
          CAST(NEW."${col.name}" AS TEXT)
        );
        
        UPDATE "${tableName}" 
        SET _modified_at = datetime('now') 
        WHERE _row_id = NEW._row_id;
      END
    `);
  }

  console.log(`[DB] Created change tracker triggers for table: ${tableName}`);
}

/**
 * Create a synced data table with standard metadata columns
 */
export function createSyncedTable(
  db: Database.Database,
  tableName: string,
  sheetName: string,
  spreadsheetId?: string
): void {
  // Create the data table with metadata columns
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      _row_id INTEGER PRIMARY KEY,             -- Maps to sheet row number
      _synced_at TEXT DEFAULT (datetime('now')),
      _modified_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Register in sheet_tables
  db.prepare(`
    INSERT OR REPLACE INTO _sheet_tables 
    (sheet_name, table_name, spreadsheet_id, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(sheetName, tableName, spreadsheetId);

  console.log(`[DB] Created synced table: ${tableName} (sheet: ${sheetName})`);
}

/**
 * Add a column to a synced table
 */
export function addColumnToSyncedTable(
  db: Database.Database,
  tableName: string,
  sheetName: string,
  columnIndex: number,
  sheetColumn: string,
  dbColumn: string,
  dataType: 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATETIME' = 'TEXT',
  aiInferred: boolean = false
): void {
  const sqlType = dataType === 'BOOLEAN' ? 'INTEGER' : 
                  dataType === 'DATETIME' ? 'TEXT' : dataType;

  // Add column to table
  try {
    db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${dbColumn}" ${sqlType}`);
    console.log(`[DB] Added column: ${tableName}.${dbColumn} (${sqlType})`);
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) {
      throw error;
    }
  }

  // Register in schema registry
  db.prepare(`
    INSERT OR REPLACE INTO _schema_registry 
    (sheet_name, table_name, column_index, sheet_column, db_column, data_type, ai_inferred, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(sheetName, tableName, columnIndex, sheetColumn, dbColumn, dataType, aiInferred ? 1 : 0);

  // Create change tracker trigger for this column
  createChangeTrackerTriggers(db, tableName, ['_row_id', '_synced_at', '_modified_at']);
}

/**
 * Get unpushed local changes
 */
export function getUnpushedChanges(db: Database.Database, limit: number = 100): Array<{
  id: number;
  table_name: string;
  row_id: number;
  column_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}> {
  return db.prepare(`
    SELECT id, table_name, row_id, column_name, old_value, new_value, changed_at
    FROM _local_changelog 
    WHERE pushed_to_sheet = 0 
    ORDER BY changed_at ASC
    LIMIT ?
  `).all(limit) as any[];
}

/**
 * Mark local changes as pushed
 */
export function markChangesPushed(db: Database.Database, ids: number[]): void {
  if (ids.length === 0) return;
  
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`
    UPDATE _local_changelog 
    SET pushed_to_sheet = 1 
    WHERE id IN (${placeholders})
  `).run(...ids);
}

/**
 * Update sync status
 */
export function updateSyncStatus(
  db: Database.Database, 
  type: 'pull' | 'push',
  conflictCount: number = 0
): void {
  const column = type === 'pull' ? 'last_pull' : 'last_push';
  const countColumn = type === 'pull' ? 'total_pulls' : 'total_pushes';
  
  db.prepare(`
    UPDATE _sync_status 
    SET ${column} = datetime('now'),
        ${countColumn} = ${countColumn} + 1,
        total_conflicts = total_conflicts + ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).run(conflictCount);
}

/**
 * Get sync status
 */
export function getSyncStatus(db: Database.Database): {
  tunnel_url: string | null;
  last_pull: string | null;
  last_push: string | null;
  total_pulls: number;
  total_pushes: number;
  total_conflicts: number;
} {
  return db.prepare('SELECT * FROM _sync_status WHERE id = 1').get() as any;
}

/**
 * Set tunnel URL
 */
export function setTunnelUrl(db: Database.Database, url: string): void {
  db.prepare(`
    UPDATE _sync_status 
    SET tunnel_url = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(url);
}

/**
 * Cleanup old synced changelog entries
 */
export function cleanupChangelogs(db: Database.Database, daysToKeep: number = 7): {
  localDeleted: number;
  remoteDeleted: number;
} {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
  
  const localResult = db.prepare(`
    DELETE FROM _local_changelog 
    WHERE pushed_to_sheet = 1 AND changed_at < ?
  `).run(cutoff);

  const remoteResult = db.prepare(`
    DELETE FROM _remote_changelog 
    WHERE applied_at < ?
  `).run(cutoff);

  return {
    localDeleted: localResult.changes,
    remoteDeleted: remoteResult.changes
  };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const dbPath = args[0] || 'egdesk.db';
  
  console.log('Creating sync database...');
  const db = createSyncDatabase({ dbPath, verbose: args.includes('--verbose') });
  
  console.log('\nDatabase schema created successfully!');
  console.log(`Database path: ${dbPath}`);
  
  // Show tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;
  
  console.log('\nCreated tables:');
  for (const table of tables) {
    console.log(`  - ${table.name}`);
  }
  
  db.close();
}