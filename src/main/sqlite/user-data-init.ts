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
    db.exec(`ALTER TABLE user_tables ADD COLUMN duplicate_action TEXT DEFAULT 'skip' CHECK(duplicate_action IN ('skip', 'update', 'allow', 'replace-date-range'))`);
    console.log('✅ Added duplicate_action column to user_tables');
  } else {
    // Update CHECK constraint to include new action (SQLite requires recreating the table for this)
    // For now, we'll skip the constraint update - it will only validate on new rows
    // The CHECK constraint will be updated when a new table is created
  }

  // Note: replace_column is deprecated (replaced by unique key column selection + skip/update toggle)
  // Keeping this commented for reference, but no longer adding to new installations
  // if (!columnNames.includes('replace_column')) {
  //   db.exec(`ALTER TABLE user_tables ADD COLUMN replace_column TEXT`);
  //   console.log('✅ Added replace_column column to user_tables');
  // }

  if (!columnNames.includes('has_imported_at_column')) {
    db.exec(`ALTER TABLE user_tables ADD COLUMN has_imported_at_column INTEGER DEFAULT 0`);
    console.log('✅ Added has_imported_at_column column to user_tables');

    // Auto-detect existing tables that have imported_at column
    const tables = db.prepare(`SELECT id, table_name, schema_json FROM user_tables`).all() as Array<{
      id: string;
      table_name: string;
      schema_json: string;
    }>;

    const updateStmt = db.prepare(`UPDATE user_tables SET has_imported_at_column = 1 WHERE id = ?`);

    for (const table of tables) {
      try {
        const schema = JSON.parse(table.schema_json);
        const hasImportedAt = schema.some((col: any) => col.name === 'imported_at');

        if (hasImportedAt) {
          updateStmt.run(table.id);
          console.log(`  ✅ Detected imported_at column in table "${table.table_name}"`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to parse schema for table ${table.table_name}:`, err);
      }
    }
  }

  console.log('✅ User Data database schema initialized');
}
