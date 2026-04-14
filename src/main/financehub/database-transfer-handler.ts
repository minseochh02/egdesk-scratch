// ============================================
// FinanceHub Database Transfer Handler
// ============================================
// Handles export, import, validation, and backup operations
// for the entire FinanceHub database

import { app, dialog } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';

// ============================================
// Types
// ============================================

export interface ExportMetadata {
  version: string;
  schemaVersion: string;
  exportedAt: string;
  exportedBy: string;
  includesCredentials: boolean;
  tableCount: number;
  totalRecords: number;
}

export interface ExportData {
  meta: ExportMetadata;
  tables: Record<string, any[]>;
  checksums: Record<string, string>;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  size?: number;
  recordCount?: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: ExportData;
  meta?: ExportMetadata;
}

export interface ImportResult {
  success: boolean;
  recordsImported?: number;
  tablesImported?: string[];
  error?: string;
}

export interface BackupInfo {
  id: string;
  filePath: string;
  createdAt: string;
  size: number;
  recordCount?: number;
}

// ============================================
// Constants
// ============================================

const EXPORT_VERSION = '1.0.0';
const SCHEMA_VERSION = '019';

// All FinanceHub tables in dependency order (for imports)
const ALL_TABLES = [
  'banks',
  'accounts',
  'promissory_notes',
  'bank_transactions',
  'card_transactions',
  'transactions',
  'sync_operations',
  'hometax_connections',
  'tax_invoices',
  'cash_receipts',
  'hometax_sync_operations',
  'financehub_scheduler_executions',
  'saved_credentials',
];

// Tables to exclude by default (credentials)
const SENSITIVE_TABLES = ['saved_credentials'];

/** Import merges by INSERT OR IGNORE on accounts can skip rows (UNIQUE bank_id+account_number) while child rows still reference exported account ids — remap those to the local account id. */
const TABLES_WITH_ACCOUNT_FK = new Set([
  'bank_transactions',
  'card_transactions',
  'transactions',
  'sync_operations',
  'promissory_notes',
]);

// ============================================
// Helper Functions
// ============================================

/**
 * Get the FinanceHub database path
 */
function getFinanceHubDbPath(): string {
  return path.join(app.getPath('userData'), 'database', 'financehub.db');
}

/**
 * Get the backup directory path
 */
function getBackupDir(): string {
  const backupDir = path.join(app.getPath('userData'), 'database', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Calculate SHA-256 checksum for data
 */
function calculateChecksum(data: any): string {
  const jsonStr = JSON.stringify(data);
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Get the FinanceHub database connection
 */
function getFinanceHubDatabase(): Database.Database {
  const dbPath = getFinanceHubDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('FinanceHub database not found');
  }
  return new Database(dbPath, { readonly: false });
}

/**
 * Check if a table exists in the database
 */
function tableExists(db: Database.Database, tableName: string): boolean {
  const result = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName);
  return !!result;
}

/**
 * Insert exported account rows, building exportId -> local accounts.id map.
 * When the DB already has the same bank_id + account_number, map to that row's id
 * so transaction rows (which reference export ids) satisfy FOREIGN KEY.
 */
function importAccountsWithRemap(db: Database.Database, exportedAccountRows: any[]): {
  map: Map<string, string>;
  inserted: number;
} {
  const map = new Map<string, string>();
  if (!exportedAccountRows?.length) {
    return { map, inserted: 0 };
  }

  const columns = Object.keys(exportedAccountRows[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const insert = db.prepare(
    `INSERT INTO accounts (${columns.join(', ')}) VALUES (${placeholders})`
  );
  const findByKey = db.prepare(
    `SELECT id FROM accounts WHERE bank_id = ? AND account_number = ?`
  );

  let inserted = 0;
  let merged = 0;

  for (const row of exportedAccountRows) {
    const existing = findByKey.get(row.bank_id, row.account_number) as { id: string } | undefined;
    if (existing) {
      map.set(row.id, existing.id);
      merged++;
      continue;
    }
    try {
      const values = columns.map((c) => row[c]);
      insert.run(...values);
      map.set(row.id, row.id);
      inserted++;
    } catch (e: any) {
      const again = findByKey.get(row.bank_id, row.account_number) as { id: string } | undefined;
      if (again) {
        map.set(row.id, again.id);
        merged++;
        continue;
      }
      throw e;
    }
  }

  console.log(
    `[DatabaseTransfer] accounts: inserted ${inserted}, merged to existing ${merged} (id remap size ${map.size})`
  );
  return { map, inserted };
}

function remapAccountIdInRow(
  tableName: string,
  row: Record<string, any>,
  accountIdMap: Map<string, string>
): Record<string, any> {
  if (!TABLES_WITH_ACCOUNT_FK.has(tableName) || accountIdMap.size === 0) {
    return row;
  }
  const aid = row.account_id;
  if (typeof aid !== 'string') {
    return row;
  }
  const mapped = accountIdMap.get(aid);
  if (mapped === undefined || mapped === aid) {
    return row;
  }
  return { ...row, account_id: mapped };
}

/**
 * Get current schema version from database
 */
function getCurrentSchemaVersion(db: Database.Database): string {
  // For now, return static version. In future, this could be stored in a metadata table
  return SCHEMA_VERSION;
}

// ============================================
// Export Functions
// ============================================

/**
 * Export the entire FinanceHub database to a compressed JSON file
 * @param includeCredentials - Whether to include saved_credentials table
 * @returns Export result with file path and metadata
 */
export async function exportDatabase(
  includeCredentials: boolean = false
): Promise<ExportResult> {
  try {
    console.log('[DatabaseTransfer] Starting export...');
    console.log(`[DatabaseTransfer] Include credentials: ${includeCredentials}`);

    const db = getFinanceHubDatabase();

    // Build export data
    const exportData: ExportData = {
      meta: {
        version: EXPORT_VERSION,
        schemaVersion: getCurrentSchemaVersion(db),
        exportedAt: new Date().toISOString(),
        exportedBy: `EGDesk ${app.getVersion()}`,
        includesCredentials: includeCredentials,
        tableCount: 0,
        totalRecords: 0,
      },
      tables: {},
      checksums: {},
    };

    // Determine which tables to export
    const tablesToExport = includeCredentials
      ? ALL_TABLES
      : ALL_TABLES.filter((t) => !SENSITIVE_TABLES.includes(t));

    console.log(`[DatabaseTransfer] Exporting ${tablesToExport.length} tables...`);

    // Export each table
    for (const tableName of tablesToExport) {
      if (!tableExists(db, tableName)) {
        console.warn(`[DatabaseTransfer] Table ${tableName} does not exist, skipping...`);
        continue;
      }

      let rows = db.prepare(`SELECT * FROM ${tableName}`).all();

      // Special handling for saved_credentials: decrypt for export
      if (tableName === 'saved_credentials' && includeCredentials && rows.length > 0) {
        console.log('[DatabaseTransfer] Decrypting credentials for export...');
        const { FinanceHubDbManager } = await import('../sqlite/financehub');
        const manager = new FinanceHubDbManager(db);

        // Decrypt each credential
        const decryptedRows = rows.map((row: any) => {
          try {
            const credentials = manager.getCredentials(row.bank_id);
            if (credentials) {
              return {
                id: row.id,
                bank_id: row.bank_id,
                user_id: credentials.userId, // Store decrypted
                password: credentials.password, // Store decrypted
                metadata: credentials.metadata ? JSON.stringify(credentials.metadata) : null,
                created_at: row.created_at,
                updated_at: row.updated_at,
              };
            }
          } catch (error) {
            console.warn(`[DatabaseTransfer] Failed to decrypt credentials for ${row.bank_id}`);
          }
          return null;
        }).filter(Boolean);

        rows = decryptedRows;
        console.log(`[DatabaseTransfer] Decrypted ${rows.length} credential entries`);
      }

      exportData.tables[tableName] = rows;
      exportData.checksums[tableName] = calculateChecksum(rows);

      console.log(`[DatabaseTransfer] Exported ${tableName}: ${rows.length} rows`);
    }

    // Update metadata
    exportData.meta.tableCount = Object.keys(exportData.tables).length;
    exportData.meta.totalRecords = Object.values(exportData.tables).reduce(
      (sum, rows: any[]) => sum + rows.length,
      0
    );

    // Close database
    db.close();

    // Serialize to JSON
    const json = JSON.stringify(exportData, null, 2);

    // Compress with gzip
    const compressed = zlib.gzipSync(json);

    // Show save dialog
    const defaultName = `financehub-export-${new Date().toISOString().split('T')[0]}.egdesk-financehub`;
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'FinanceHub 데이터베이스 내보내기',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [
        { name: 'EGDesk FinanceHub Export', extensions: ['egdesk-financehub'] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'User canceled export' };
    }

    // Write compressed file
    fs.writeFileSync(filePath, compressed);

    console.log(`[DatabaseTransfer] Export complete: ${filePath}`);
    console.log(`[DatabaseTransfer] Size: ${compressed.length} bytes`);
    console.log(`[DatabaseTransfer] Records: ${exportData.meta.totalRecords}`);

    return {
      success: true,
      filePath,
      size: compressed.length,
      recordCount: exportData.meta.totalRecords,
    };
  } catch (error: any) {
    console.error('[DatabaseTransfer] Export failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate an import file before importing
 * @param filePath - Path to the .egdesk-financehub file
 * @returns Validation result with parsed data if valid
 */
export async function validateImportFile(
  filePath: string
): Promise<ValidationResult> {
  try {
    console.log(`[DatabaseTransfer] Validating file: ${filePath}`);

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    // Check file extension
    if (!filePath.endsWith('.egdesk-financehub')) {
      return { valid: false, error: 'Invalid file extension. Expected .egdesk-financehub' };
    }

    // Read and decompress file
    const compressed = fs.readFileSync(filePath);
    let decompressed: Buffer;
    try {
      decompressed = zlib.gunzipSync(compressed);
    } catch (error) {
      return { valid: false, error: 'Failed to decompress file. File may be corrupted.' };
    }

    // Parse JSON
    let exportData: ExportData;
    try {
      exportData = JSON.parse(decompressed.toString('utf8'));
    } catch (error) {
      return { valid: false, error: 'Failed to parse JSON. File may be corrupted.' };
    }

    // Validate structure
    if (!exportData.meta || !exportData.tables || !exportData.checksums) {
      return { valid: false, error: 'Invalid file structure. Missing required fields.' };
    }

    // Validate checksums
    for (const [tableName, rows] of Object.entries(exportData.tables)) {
      const expectedChecksum = exportData.checksums[tableName];
      const actualChecksum = calculateChecksum(rows);

      if (expectedChecksum !== actualChecksum) {
        return {
          valid: false,
          error: `Checksum mismatch for table ${tableName}. File may be corrupted.`,
        };
      }
    }

    // Check schema version compatibility (for now, just warn if different)
    const db = getFinanceHubDatabase();
    const currentSchemaVersion = getCurrentSchemaVersion(db);
    db.close();

    if (exportData.meta.schemaVersion !== currentSchemaVersion) {
      console.warn(
        `[DatabaseTransfer] Schema version mismatch: current=${currentSchemaVersion}, import=${exportData.meta.schemaVersion}`
      );
      // Allow import anyway - INSERT OR IGNORE will handle compatibility
    }

    console.log(`[DatabaseTransfer] Validation passed`);
    console.log(`[DatabaseTransfer] Tables: ${exportData.meta.tableCount}`);
    console.log(`[DatabaseTransfer] Records: ${exportData.meta.totalRecords}`);

    return {
      valid: true,
      data: exportData,
      meta: exportData.meta,
    };
  } catch (error: any) {
    console.error('[DatabaseTransfer] Validation failed:', error);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Show file picker for import file selection
 */
export async function selectImportFile(): Promise<{ filePath?: string; canceled: boolean }> {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'FinanceHub 데이터베이스 가져오기',
    defaultPath: app.getPath('documents'),
    filters: [
      { name: 'EGDesk FinanceHub Export', extensions: ['egdesk-financehub'] },
    ],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  return { filePath: filePaths[0], canceled: false };
}

// ============================================
// Import Functions
// ============================================

/**
 * Import database from export file with merge strategy
 * @param filePath - Path to the .egdesk-financehub file
 * @returns Import result with statistics
 */
export async function importDatabase(filePath: string): Promise<ImportResult> {
  try {
    console.log(`[DatabaseTransfer] Starting import from: ${filePath}`);

    // 1. Validate file first
    const validation = await validateImportFile(filePath);
    if (!validation.valid || !validation.data) {
      return { success: false, error: validation.error };
    }

    const importData = validation.data;

    // 2. Create automatic backup before import
    console.log('[DatabaseTransfer] Creating backup before import...');
    const backupResult = await createBackup();
    if (!backupResult.success) {
      console.warn('[DatabaseTransfer] Backup failed, but continuing with import...');
    }

    // 3. Open database and begin transaction
    const db = getFinanceHubDatabase();
    db.pragma('foreign_keys = ON');

    // Import tables in dependency order (excluding saved_credentials for now)
    const importOrder = [
      'banks',
      'accounts',
      'promissory_notes',
      'bank_transactions',
      'card_transactions',
      'transactions',
      'sync_operations',
      'hometax_connections',
      'tax_invoices',
      'cash_receipts',
      'hometax_sync_operations',
      'financehub_scheduler_executions',
    ];

    let totalImported = 0;
    const tablesImported: string[] = [];

    let accountIdMap = new Map<string, string>();

    const transaction = db.transaction(() => {
      for (const tableName of importOrder) {
        if (!importData.tables[tableName]) {
          console.log(`[DatabaseTransfer] Skipping ${tableName} (not in import file)`);
          continue;
        }

        if (!tableExists(db, tableName)) {
          console.warn(`[DatabaseTransfer] Table ${tableName} does not exist in database, skipping...`);
          continue;
        }

        const rows = importData.tables[tableName];
        if (rows.length === 0) {
          console.log(`[DatabaseTransfer] Skipping ${tableName} (empty)`);
          continue;
        }

        console.log(`[DatabaseTransfer] Importing ${tableName}: ${rows.length} rows...`);

        if (tableName === 'accounts') {
          const { map, inserted } = importAccountsWithRemap(db, rows);
          accountIdMap = map;
          totalImported += inserted;
          tablesImported.push(tableName);
          continue;
        }

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');

        const stmt = db.prepare(
          `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
        );

        let imported = 0;
        for (const row of rows) {
          const remapped = remapAccountIdInRow(tableName, row, accountIdMap);
          const values = columns.map((col) => remapped[col]);
          const result = stmt.run(...values);
          if (result.changes > 0) {
            imported++;
          }
        }

        console.log(`[DatabaseTransfer] Imported ${imported}/${rows.length} rows into ${tableName}`);
        totalImported += imported;
        tablesImported.push(tableName);
      }
    });

    // Execute transaction
    try {
      transaction();

      // Handle saved_credentials separately (re-encrypt with target machine's key)
      if (importData.tables['saved_credentials'] && importData.tables['saved_credentials'].length > 0) {
        console.log('[DatabaseTransfer] Re-encrypting credentials for target machine...');
        const { FinanceHubDbManager } = await import('../sqlite/financehub');
        const manager = new FinanceHubDbManager(db);

        const credentialRows = importData.tables['saved_credentials'];
        let credentialsImported = 0;

        for (const row of credentialRows) {
          try {
            // The row contains decrypted user_id and password
            const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

            // Use the manager's saveCredentials method which will encrypt with this machine's key
            manager.saveCredentials(row.bank_id, row.user_id, row.password, metadata);
            credentialsImported++;
            console.log(`[DatabaseTransfer] Re-encrypted credentials for ${row.bank_id}`);
          } catch (error) {
            console.error(`[DatabaseTransfer] Failed to re-encrypt credentials for ${row.bank_id}:`, error);
          }
        }

        console.log(`[DatabaseTransfer] Imported ${credentialsImported}/${credentialRows.length} credential entries`);
        totalImported += credentialsImported;
        tablesImported.push('saved_credentials');
      }

      db.close();

      console.log(`[DatabaseTransfer] Import complete: ${totalImported} records`);

      return {
        success: true,
        recordsImported: totalImported,
        tablesImported,
      };
    } catch (error: any) {
      db.close();
      throw error;
    }
  } catch (error: any) {
    console.error('[DatabaseTransfer] Import failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// Backup Functions
// ============================================

/**
 * Create a backup of the FinanceHub database
 * @returns Backup info with file path
 */
export async function createBackup(): Promise<{ success: boolean; backup?: BackupInfo; error?: string }> {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `financehub-backup-${timestamp}.db`;
    const backupPath = path.join(getBackupDir(), backupFileName);

    const sourceDbPath = getFinanceHubDbPath();

    console.log(`[DatabaseTransfer] Creating backup: ${backupPath}`);

    // Copy database file
    fs.copyFileSync(sourceDbPath, backupPath);

    const stats = fs.statSync(backupPath);

    // Get record count
    const db = new Database(backupPath, { readonly: true });
    let totalRecords = 0;
    for (const tableName of ALL_TABLES) {
      if (tableExists(db, tableName)) {
        const result: any = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
        totalRecords += result.count || 0;
      }
    }
    db.close();

    const backupInfo: BackupInfo = {
      id: timestamp,
      filePath: backupPath,
      createdAt: new Date().toISOString(),
      size: stats.size,
      recordCount: totalRecords,
    };

    console.log(`[DatabaseTransfer] Backup created: ${backupPath}`);

    // Auto-cleanup old backups
    await cleanupOldBackups();

    return { success: true, backup: backupInfo };
  } catch (error: any) {
    console.error('[DatabaseTransfer] Backup failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<{ success: boolean; backups?: BackupInfo[]; error?: string }> {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir);

    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.startsWith('financehub-backup-') && file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);

        // Extract timestamp from filename
        const timestampMatch = file.match(/financehub-backup-(.+)\.db/);
        const timestamp = timestampMatch ? timestampMatch[1] : file;

        backups.push({
          id: timestamp,
          filePath,
          createdAt: stats.birthtime.toISOString(),
          size: stats.size,
        });
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, backups };
  } catch (error: any) {
    console.error('[DatabaseTransfer] List backups failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restore database from a backup
 * @param backupId - The backup ID (timestamp)
 */
export async function restoreBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backupPath = path.join(getBackupDir(), `financehub-backup-${backupId}.db`);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' };
    }

    console.log(`[DatabaseTransfer] Restoring from backup: ${backupPath}`);

    // Create a backup of current database before restoring
    const currentBackupResult = await createBackup();
    if (!currentBackupResult.success) {
      console.warn('[DatabaseTransfer] Failed to backup current database before restore');
    }

    const targetDbPath = getFinanceHubDbPath();

    // Close any open connections to the database
    // (In production, you might need to use SQLiteManager to properly close connections)

    // Copy backup file to database location
    fs.copyFileSync(backupPath, targetDbPath);

    console.log(`[DatabaseTransfer] Restore complete from: ${backupPath}`);

    return { success: true };
  } catch (error: any) {
    console.error('[DatabaseTransfer] Restore failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a backup file
 * @param backupId - The backup ID (timestamp)
 */
export async function deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backupPath = path.join(getBackupDir(), `financehub-backup-${backupId}.db`);

    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' };
    }

    fs.unlinkSync(backupPath);

    console.log(`[DatabaseTransfer] Deleted backup: ${backupPath}`);

    return { success: true };
  } catch (error: any) {
    console.error('[DatabaseTransfer] Delete backup failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cleanup old backups (keep only last 5)
 */
export async function cleanupOldBackups(): Promise<void> {
  try {
    const result = await listBackups();
    if (!result.success || !result.backups) {
      return;
    }

    const backups = result.backups;
    const KEEP_COUNT = 5;

    if (backups.length > KEEP_COUNT) {
      const toDelete = backups.slice(KEEP_COUNT);
      console.log(`[DatabaseTransfer] Cleaning up ${toDelete.length} old backups...`);

      for (const backup of toDelete) {
        await deleteBackup(backup.id);
      }
    }
  } catch (error) {
    console.error('[DatabaseTransfer] Cleanup failed:', error);
  }
}
