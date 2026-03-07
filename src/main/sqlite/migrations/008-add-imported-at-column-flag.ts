import Database from 'better-sqlite3';

/**
 * Migration 008: Add has_imported_at_column flag to user_tables
 *
 * This migration adds a flag to track whether a table was created with
 * the "addTimestamp" option, which automatically adds an imported_at column
 * to track when each row was imported.
 */
export function migrate(db: Database.Database): void {
  console.log('Running migration 008: Add has_imported_at_column flag');

  // Add has_imported_at_column column to user_tables
  db.exec(`
    ALTER TABLE user_tables
    ADD COLUMN has_imported_at_column INTEGER DEFAULT 0
  `);

  // Auto-detect existing tables that have imported_at column
  // and set the flag for them
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

  console.log('Migration 008 completed successfully');
}

export function rollback(db: Database.Database): void {
  console.log('Rolling back migration 008');

  // SQLite doesn't support DROP COLUMN, so we would need to recreate the table
  // For simplicity, we'll just log a warning
  console.warn('⚠️  Cannot rollback migration 008: SQLite does not support DROP COLUMN');
  console.warn('⚠️  The has_imported_at_column column will remain in the database');
}
