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

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

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

      CREATE TABLE IF NOT EXISTS egchatting_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
        content TEXT,
        
        -- Tool call specific fields
        tool_call_id TEXT,
        tool_name TEXT,
        tool_server_name TEXT, -- Which MCP server this tool belongs to
        tool_args TEXT,        -- JSON string of arguments
        tool_result TEXT,      -- JSON string or text of result
        tool_status TEXT CHECK (tool_status IN ('pending', 'success', 'error') OR tool_status IS NULL),
        
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        
        FOREIGN KEY (conversation_id) REFERENCES egchatting_conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_egchatting_messages_conversation_id
        ON egchatting_messages(conversation_id);
        
      CREATE INDEX IF NOT EXISTS idx_egchatting_messages_timestamp
        ON egchatting_messages(timestamp);
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
