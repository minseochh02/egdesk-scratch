import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface EgChattingInitResult {
  success: boolean;
  database?: Database.Database;
  dbPath?: string;
  error?: string;
}

export function getEgChattingDatabasePath(): string {
  return path.join(app.getPath('userData'), 'database', 'egchatting.db');
}

export function initializeEgChattingDatabase(): EgChattingInitResult {
  try {
    const dataDir = path.join(app.getPath('userData'), 'database');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = getEgChattingDatabasePath();
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS egchatting_conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_egchatting_conversations_updated_at
        ON egchatting_conversations(updated_at);

      CREATE TRIGGER IF NOT EXISTS trg_egchatting_conversations_set_updated_at
      AFTER UPDATE ON egchatting_conversations
      BEGIN
        UPDATE egchatting_conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;
    `);

    return {
      success: true,
      database: db,
      dbPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to initialize egchatting database:', message);
    return { success: false, error: message };
  }
}

