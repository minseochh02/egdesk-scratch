import Database from 'better-sqlite3';

/**
 * Migration 009: Add vector embeddings support
 *
 * This migration adds tables for storing vector embeddings of messages
 * for semantic search capabilities using sqlite-vec extension.
 */
export function migrate009AddVectorEmbeddings(db: Database.Database): void {
  console.log('Running migration 009: Add vector embeddings tables');

  // Create message_embeddings table to store vector embeddings for messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_embeddings (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL UNIQUE,
      conversation_id TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_dimensions INTEGER NOT NULL,
      embedding BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  // Create embedding_metadata table to track embedding statistics
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedding_metadata (
      id TEXT PRIMARY KEY,
      database_name TEXT NOT NULL,
      table_name TEXT NOT NULL,
      total_embeddings INTEGER DEFAULT 0,
      embedding_model TEXT,
      embedding_dimensions INTEGER,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(database_name, table_name)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id
      ON message_embeddings(message_id);

    CREATE INDEX IF NOT EXISTS idx_message_embeddings_conversation_id
      ON message_embeddings(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_message_embeddings_model
      ON message_embeddings(embedding_model);
  `);

  // Create trigger to update updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_message_embeddings_timestamp
    AFTER UPDATE ON message_embeddings
    BEGIN
      UPDATE message_embeddings
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.id;
    END
  `);

  console.log('  ✅ Created message_embeddings table');
  console.log('  ✅ Created embedding_metadata table');
  console.log('  ✅ Created indexes for vector search');
  console.log('Migration 009 completed successfully');
}

/**
 * Rollback migration 009
 * Drops the vector embedding tables and related indexes
 */
export function rollback009(db: Database.Database): void {
  console.log('Rolling back migration 009');

  try {
    // Drop trigger first
    db.exec('DROP TRIGGER IF EXISTS update_message_embeddings_timestamp');

    // Drop indexes
    db.exec('DROP INDEX IF EXISTS idx_message_embeddings_message_id');
    db.exec('DROP INDEX IF EXISTS idx_message_embeddings_conversation_id');
    db.exec('DROP INDEX IF EXISTS idx_message_embeddings_model');

    // Drop tables
    db.exec('DROP TABLE IF EXISTS message_embeddings');
    db.exec('DROP TABLE IF EXISTS embedding_metadata');

    console.log('  ✅ Dropped vector embedding tables and indexes');
    console.log('Migration 009 rollback completed successfully');
  } catch (error) {
    console.error('  ❌ Failed to rollback migration 009:', error);
    throw error;
  }
}
