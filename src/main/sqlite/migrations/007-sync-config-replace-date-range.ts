// ============================================
// Migration 007: Add 'replace-date-range' to sync_configurations duplicate_action CHECK constraint
// ============================================
// Updates the CHECK constraint to include the new 'replace-date-range' duplicate action option

import Database from 'better-sqlite3';

export function migrate007SyncConfigReplaceDateRange(db: Database.Database): void {
  console.log('🔄 Migration 007: Adding replace-date-range to sync_configurations duplicate_action...');

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

  // Check if already migrated
  if (tableInfo.sql.includes("'replace-date-range'")) {
    console.log('  ✅ sync_configurations already has replace-date-range in CHECK constraint - skipping');
    return;
  }

  console.log('  🔧 Migrating sync_configurations table schema...');

  // SQLite doesn't support ALTER TABLE for CHECK constraints
  // We need to recreate the table with the new schema
  db.exec(`
    BEGIN TRANSACTION;

    -- Create new table with updated constraint
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
    );

    -- Copy data from old table
    INSERT INTO sync_configurations_new SELECT * FROM sync_configurations;

    -- Drop old table
    DROP TABLE sync_configurations;

    -- Rename new table
    ALTER TABLE sync_configurations_new RENAME TO sync_configurations;

    -- Recreate indexes
    CREATE INDEX IF NOT EXISTS idx_sync_configs_script_folder ON sync_configurations(script_folder_path);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_table_id ON sync_configurations(target_table_id);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_enabled ON sync_configurations(enabled);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_auto_sync ON sync_configurations(auto_sync_enabled);

    -- Recreate trigger
    CREATE TRIGGER IF NOT EXISTS update_sync_configs_timestamp
    AFTER UPDATE ON sync_configurations
    BEGIN
      UPDATE sync_configurations SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    COMMIT;
  `);

  console.log('  ✅ Migration 007 complete - sync_configurations now supports replace-date-range');
}
