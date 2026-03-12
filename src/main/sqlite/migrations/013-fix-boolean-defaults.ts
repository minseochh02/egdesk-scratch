// ============================================
// Migration 013: Fix BOOLEAN DEFAULT values in sync_configurations
// ============================================
// Changes BOOLEAN DEFAULT true to BOOLEAN DEFAULT 1 for proper SQLite integer defaults

import Database from 'better-sqlite3';

export function migrate013FixBooleanDefaults(db: Database.Database): void {
  console.log('🔄 Migration 013: Fixing BOOLEAN DEFAULT values in sync_configurations...');

  // Check if sync_configurations table exists
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sync_configurations'`).all();

  if (tables.length === 0) {
    console.log('  ℹ️ sync_configurations table does not exist - skipping migration');
    return;
  }

  // Check current schema
  const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='sync_configurations'`).get() as any;

  if (!tableInfo || !tableInfo.sql) {
    console.log('  ℹ️ Could not read sync_configurations schema - skipping migration');
    return;
  }

  // Check if already migrated (look for BOOLEAN DEFAULT 1)
  if (tableInfo.sql.includes('BOOLEAN DEFAULT 1')) {
    console.log('  ✅ sync_configurations already has correct BOOLEAN defaults - skipping');
    return;
  }

  console.log('  🔧 Migrating sync_configurations table to fix BOOLEAN defaults...');

  // Clean up any leftover temporary table from previous failed migration
  try {
    db.exec(`DROP TABLE IF EXISTS sync_configurations_new`);
  } catch (cleanupError) {
    // Ignore cleanup errors
  }

  // Retry logic to handle database locks
  const maxRetries = 3;
  let retryCount = 0;
  let migrationSuccess = false;

  while (retryCount < maxRetries && !migrationSuccess) {
    try {
      // SQLite doesn't support ALTER TABLE for changing defaults
      // We need to recreate the table with the corrected schema

      // Create new table with corrected BOOLEAN defaults
      db.exec(`
        CREATE TABLE sync_configurations_new (
          id TEXT PRIMARY KEY,
          script_folder_path TEXT UNIQUE NOT NULL,
          script_name TEXT NOT NULL,
          folder_name TEXT NOT NULL,
          target_table_id TEXT NOT NULL,
          header_row INTEGER DEFAULT 1,
          skip_bottom_rows INTEGER DEFAULT 0,
          sheet_index INTEGER DEFAULT 0,
          column_mappings TEXT NOT NULL,
          applied_splits TEXT,
          file_action TEXT DEFAULT 'archive' CHECK(file_action IN ('keep', 'archive', 'delete')),
          enabled BOOLEAN DEFAULT 1,
          auto_sync_enabled BOOLEAN DEFAULT 1,
          unique_key_columns TEXT,
          duplicate_action TEXT DEFAULT 'skip' CHECK(duplicate_action IN ('skip', 'update', 'allow', 'replace-date-range')),
          last_sync_at TEXT,
          last_sync_status TEXT,
          last_sync_rows_imported INTEGER DEFAULT 0,
          last_sync_rows_skipped INTEGER DEFAULT 0,
          last_sync_duplicates INTEGER DEFAULT 0,
          last_sync_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (target_table_id) REFERENCES user_tables(id) ON DELETE CASCADE
        )
      `);

      // Check if old table has applied_splits column
      const oldTableInfo = db.prepare(`PRAGMA table_info(sync_configurations)`).all() as any[];
      const hasAppliedSplits = oldTableInfo.some((col: any) => col.name === 'applied_splits');

      // Copy data from old table
      if (hasAppliedSplits) {
        // Old table has applied_splits, copy all columns with COALESCE for file_action
        db.exec(`
          INSERT INTO sync_configurations_new
          SELECT
            id, script_folder_path, script_name, folder_name, target_table_id,
            header_row, skip_bottom_rows, sheet_index, column_mappings, applied_splits,
            COALESCE(file_action, 'archive'), enabled, auto_sync_enabled, unique_key_columns, duplicate_action,
            last_sync_at, last_sync_status, last_sync_rows_imported, last_sync_rows_skipped,
            last_sync_duplicates, last_sync_error, created_at, updated_at
          FROM sync_configurations
        `);
      } else {
        // Old table doesn't have applied_splits, insert NULL for it and default file_action
        db.exec(`
          INSERT INTO sync_configurations_new (
            id, script_folder_path, script_name, folder_name, target_table_id,
            header_row, skip_bottom_rows, sheet_index, column_mappings, applied_splits,
            file_action, enabled, auto_sync_enabled, unique_key_columns, duplicate_action,
            last_sync_at, last_sync_status, last_sync_rows_imported, last_sync_rows_skipped,
            last_sync_duplicates, last_sync_error, created_at, updated_at
          )
          SELECT
            id, script_folder_path, script_name, folder_name, target_table_id,
            header_row, skip_bottom_rows, sheet_index, column_mappings, NULL,
            COALESCE(file_action, 'archive'), enabled, auto_sync_enabled, unique_key_columns, duplicate_action,
            last_sync_at, last_sync_status, last_sync_rows_imported, last_sync_rows_skipped,
            last_sync_duplicates, last_sync_error, created_at, updated_at
          FROM sync_configurations
        `);
      }

      // Drop old table
      db.exec(`DROP TABLE sync_configurations`);

      // Rename new table
      db.exec(`ALTER TABLE sync_configurations_new RENAME TO sync_configurations`);

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_configs_script_folder ON sync_configurations(script_folder_path)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_configs_table_id ON sync_configurations(target_table_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_configs_enabled ON sync_configurations(enabled)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_configs_auto_sync ON sync_configurations(auto_sync_enabled)`);

      // Recreate trigger
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_sync_configs_timestamp
        AFTER UPDATE ON sync_configurations
        BEGIN
          UPDATE sync_configurations SET updated_at = datetime('now') WHERE id = NEW.id;
        END
      `);

      migrationSuccess = true;
      console.log('  ✅ Migration 013 complete - BOOLEAN defaults now use integer values');
    } catch (error: any) {
      retryCount++;
      if (error.message.includes('database is locked')) {
        console.log(`  ⏳ Database locked, retrying (${retryCount}/${maxRetries})...`);
        // Synchronous sleep for 200ms before retrying
        const startTime = Date.now();
        while (Date.now() - startTime < 200) {
          // Busy wait
        }
      } else {
        // Different error, throw it
        throw error;
      }
    }
  }

  if (!migrationSuccess) {
    throw new Error('Migration 013 failed after maximum retries - database is locked');
  }
}
