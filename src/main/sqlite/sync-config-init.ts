import Database from 'better-sqlite3';

/**
 * Initialize Sync Configurations Database Schema
 *
 * Stores automation sync settings for browser download folders → SQL tables
 */
export function initializeSyncConfigurationSchema(db: Database.Database): void {
  // Create sync_configurations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_configurations (
      id TEXT PRIMARY KEY,
      script_folder_path TEXT UNIQUE NOT NULL,
      script_name TEXT NOT NULL,
      folder_name TEXT NOT NULL,
      
      -- Target SQL table
      target_table_id TEXT NOT NULL,
      
      -- Parsing configuration
      header_row INTEGER DEFAULT 1,
      skip_bottom_rows INTEGER DEFAULT 0,
      sheet_index INTEGER DEFAULT 0,
      
      -- Column mappings (JSON)
      column_mappings TEXT NOT NULL,
      
      -- File handling
      file_action TEXT DEFAULT 'archive' CHECK(file_action IN ('keep', 'archive', 'delete')),
      
      -- Auto-sync settings
      enabled BOOLEAN DEFAULT true,
      auto_sync_enabled BOOLEAN DEFAULT false,
      
      -- Duplicate detection
      unique_key_columns TEXT,
      duplicate_action TEXT DEFAULT 'skip' CHECK(duplicate_action IN ('skip', 'update', 'allow')),
      
      -- Status tracking
      last_sync_at TEXT,
      last_sync_status TEXT,
      last_sync_rows_imported INTEGER DEFAULT 0,
      last_sync_rows_skipped INTEGER DEFAULT 0,
      last_sync_duplicates INTEGER DEFAULT 0,
      last_sync_error TEXT,
      
      -- Metadata
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      
      FOREIGN KEY (target_table_id) REFERENCES user_tables(id) ON DELETE CASCADE
    )
  `);

  // Create sync_activity_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_activity_log (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'partial')),
      rows_imported INTEGER DEFAULT 0,
      rows_skipped INTEGER DEFAULT 0,
      duplicates_skipped INTEGER DEFAULT 0,
      error_message TEXT,
      
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      
      FOREIGN KEY (config_id) REFERENCES sync_configurations(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sync_configs_script_folder ON sync_configurations(script_folder_path);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_table_id ON sync_configurations(target_table_id);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_enabled ON sync_configurations(enabled);
    CREATE INDEX IF NOT EXISTS idx_sync_configs_auto_sync ON sync_configurations(auto_sync_enabled);
    CREATE INDEX IF NOT EXISTS idx_sync_activity_config_id ON sync_activity_log(config_id);
    CREATE INDEX IF NOT EXISTS idx_sync_activity_status ON sync_activity_log(status);
    CREATE INDEX IF NOT EXISTS idx_sync_activity_started_at ON sync_activity_log(started_at);
  `);

  // Create trigger for updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_sync_configs_timestamp
    AFTER UPDATE ON sync_configurations
    BEGIN
      UPDATE sync_configurations SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Migration: Add duplicate detection columns if they don't exist
  // Check if columns exist before adding (for existing databases)
  const syncConfigTableInfo = db.prepare("PRAGMA table_info(sync_configurations)").all() as Array<{ name: string }>;
  const syncConfigColumnNames = syncConfigTableInfo.map(col => col.name);

  if (!syncConfigColumnNames.includes('unique_key_columns')) {
    db.exec(`ALTER TABLE sync_configurations ADD COLUMN unique_key_columns TEXT`);
    console.log('✅ Added unique_key_columns column to sync_configurations');
  }

  if (!syncConfigColumnNames.includes('duplicate_action')) {
    db.exec(`ALTER TABLE sync_configurations ADD COLUMN duplicate_action TEXT DEFAULT 'skip' CHECK(duplicate_action IN ('skip', 'update', 'allow'))`);
    console.log('✅ Added duplicate_action column to sync_configurations');
  }

  if (!syncConfigColumnNames.includes('last_sync_duplicates')) {
    db.exec(`ALTER TABLE sync_configurations ADD COLUMN last_sync_duplicates INTEGER DEFAULT 0`);
    console.log('✅ Added last_sync_duplicates column to sync_configurations');
  }

  // Check sync_activity_log table
  const activityLogTableInfo = db.prepare("PRAGMA table_info(sync_activity_log)").all() as Array<{ name: string }>;
  const activityLogColumnNames = activityLogTableInfo.map(col => col.name);

  if (!activityLogColumnNames.includes('duplicates_skipped')) {
    db.exec(`ALTER TABLE sync_activity_log ADD COLUMN duplicates_skipped INTEGER DEFAULT 0`);
    console.log('✅ Added duplicates_skipped column to sync_activity_log');
  }

  console.log('✅ Sync Configurations database schema initialized');
}
