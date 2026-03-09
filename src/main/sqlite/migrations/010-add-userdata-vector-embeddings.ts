import Database from 'better-sqlite3';

/**
 * Migration 010: Add user data vector embeddings support
 *
 * This migration adds tables for storing vector embeddings of user data
 * (imported from Excel, browser downloads, etc.) for semantic search capabilities.
 */
export function migrate010AddUserDataVectorEmbeddings(
  db: Database.Database
): void {
  console.log('Running migration 010: Add user data vector embeddings tables');

  // Create user_data_embeddings table to store vector embeddings for user table data
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_data_embeddings (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      row_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_dimensions INTEGER NOT NULL,
      embedding BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES user_tables(id) ON DELETE CASCADE,
      UNIQUE(table_id, row_id, column_name)
    )
  `);

  // Create user_data_embedding_metadata table to track embedding statistics per column
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_data_embedding_metadata (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      column_name TEXT NOT NULL,
      total_embeddings INTEGER DEFAULT 0,
      embedding_model TEXT NOT NULL,
      embedding_dimensions INTEGER NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      estimated_cost_usd REAL DEFAULT 0,
      FOREIGN KEY (table_id) REFERENCES user_tables(id) ON DELETE CASCADE,
      UNIQUE(table_id, column_name)
    )
  `);

  // Create indexes for fast vector search
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_data_embeddings_table_id
      ON user_data_embeddings(table_id);

    CREATE INDEX IF NOT EXISTS idx_user_data_embeddings_row_id
      ON user_data_embeddings(table_id, row_id);

    CREATE INDEX IF NOT EXISTS idx_user_data_embeddings_column
      ON user_data_embeddings(table_id, column_name);

    CREATE INDEX IF NOT EXISTS idx_user_data_embeddings_model
      ON user_data_embeddings(embedding_model);
  `);

  // Create trigger to update updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_user_data_embeddings_timestamp
    AFTER UPDATE ON user_data_embeddings
    BEGIN
      UPDATE user_data_embeddings
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END
  `);

  console.log('  ✅ Created user_data_embeddings table');
  console.log('  ✅ Created user_data_embedding_metadata table');
  console.log('  ✅ Created indexes for vector search');
  console.log('Migration 010 completed successfully');
}

/**
 * Rollback migration 010
 * Drops the user data vector embedding tables and related indexes
 */
export function rollback010(db: Database.Database): void {
  console.log('Rolling back migration 010');

  try {
    // Drop trigger first
    db.exec('DROP TRIGGER IF EXISTS update_user_data_embeddings_timestamp');

    // Drop indexes
    db.exec('DROP INDEX IF EXISTS idx_user_data_embeddings_table_id');
    db.exec('DROP INDEX IF EXISTS idx_user_data_embeddings_row_id');
    db.exec('DROP INDEX IF EXISTS idx_user_data_embeddings_column');
    db.exec('DROP INDEX IF EXISTS idx_user_data_embeddings_model');

    // Drop tables
    db.exec('DROP TABLE IF EXISTS user_data_embeddings');
    db.exec('DROP TABLE IF EXISTS user_data_embedding_metadata');

    console.log('  ✅ Dropped user data vector embedding tables and indexes');
    console.log('Migration 010 rollback completed successfully');
  } catch (error) {
    console.error('  ❌ Failed to rollback migration 010:', error);
    throw error;
  }
}
