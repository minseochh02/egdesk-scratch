import Database from 'better-sqlite3';

/**
 * Initialize User Data Database Schema
 *
 * Creates metadata tables for tracking user-created tables and import operations
 */
export function initializeUserDataDatabaseSchema(db: Database.Database): void {
  // Create user_tables metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tables (
      id TEXT PRIMARY KEY,
      table_name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      created_from_file TEXT,
      row_count INTEGER DEFAULT 0,
      column_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      schema_json TEXT NOT NULL
    )
  `);

  // Create import_operations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_operations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      rows_imported INTEGER DEFAULT 0,
      rows_skipped INTEGER DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (table_id) REFERENCES user_tables(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_tables_table_name ON user_tables(table_name);
    CREATE INDEX IF NOT EXISTS idx_user_tables_created_at ON user_tables(created_at);
    CREATE INDEX IF NOT EXISTS idx_import_operations_table_id ON import_operations(table_id);
    CREATE INDEX IF NOT EXISTS idx_import_operations_status ON import_operations(status);
    CREATE INDEX IF NOT EXISTS idx_import_operations_started_at ON import_operations(started_at);
  `);

  // Create trigger for updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_user_tables_timestamp
    AFTER UPDATE ON user_tables
    BEGIN
      UPDATE user_tables SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Add duplicate detection columns (migration-safe with IF NOT EXISTS checks)
  // Check if columns exist before adding
  const tableInfo = db.prepare("PRAGMA table_info(user_tables)").all() as Array<{ name: string }>;
  const columnNames = tableInfo.map(col => col.name);

  if (!columnNames.includes('unique_key_columns')) {
    db.exec(`ALTER TABLE user_tables ADD COLUMN unique_key_columns TEXT`);
    console.log('✅ Added unique_key_columns column to user_tables');
  }

  if (!columnNames.includes('duplicate_action')) {
    db.exec(`ALTER TABLE user_tables ADD COLUMN duplicate_action TEXT DEFAULT 'skip' CHECK(duplicate_action IN ('skip', 'update', 'allow'))`);
    console.log('✅ Added duplicate_action column to user_tables');
  }

  console.log('✅ User Data database schema initialized');
}
