import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteTaskManager } from './tasks';

/**
 * Central SQLite Manager
 * 
 * This is the main entry point for all SQLite operations in the application.
 * It manages initialization, provides a unified API, and handles all database
 * operations for AI chat storage.
 */
export class SQLiteManager {
  private static instance: SQLiteManager | null = null;
  
  // Database connection
  private db: Database.Database | null = null;
  private dbPath: string = '';
  
  // State management
  private isInitialized = false;
  private initializationError: string | null = null;
  
  // Task manager
  private taskManager: SQLiteTaskManager | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of SQLiteManager
   */
  public static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  /**
   * Initialize SQLite database
   */
  public async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 Initializing SQLite Manager...');
      
      // Create data directory if it doesn't exist
      const dataDir = path.join(app.getPath('userData'), 'ai-chat');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.dbPath = path.join(dataDir, 'ai-chat.db');
      this.db = new Database(this.dbPath);
      
      // Initialize database schema
      this.initializeDatabase();
      
      // Initialize task manager
      this.taskManager = new SQLiteTaskManager(this.db);
      
      this.isInitialized = true;
      console.log('🎉 SQLite Manager fully initialized');
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.initializationError = errorMessage;
      console.error('❌ Failed to initialize SQLite Manager:', errorMessage);
      
      return { 
        success: false, 
        error: `SQLite initialization failed: ${errorMessage}` 
      };
    }
  }

  /**
   * Initialize database schema for AI chat storage
   */
  private initializeDatabase(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        project_context TEXT, -- JSON string for project context
        is_active BOOLEAN DEFAULT 1
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'model', 'tool')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        tool_call_id TEXT,
        tool_status TEXT CHECK (tool_status IN ('executing', 'completed', 'failed')),
        metadata TEXT, -- JSON string for additional data
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_is_active ON conversations(is_active);
    `);

    // Create triggers for updated_at timestamps
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp 
      AFTER UPDATE ON conversations
      BEGIN
        UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_messages_timestamp 
      AFTER UPDATE ON messages
      BEGIN
        UPDATE messages SET timestamp = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
  }

  /**
   * Check if SQLite is available and initialized
   */
  public isAvailable(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Get initialization error if any
   */
  public getInitializationError(): string | null {
    return this.initializationError;
  }

  /**
   * Get database status information
   */
  public getStatus(): {
    isInitialized: boolean;
    hasDatabase: boolean;
    error: string | null;
    databasePath: string;
  } {
    return {
      isInitialized: this.isInitialized,
      hasDatabase: this.db !== null,
      error: this.initializationError,
      databasePath: this.dbPath
    };
  }

  /**
   * Get database path for debugging
   */
  public getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Get database size in MB
   */
  public getDatabaseSize(): number {
    if (!this.db || !fs.existsSync(this.dbPath)) return 0;
    const stats = fs.statSync(this.dbPath);
    return Math.round((stats.size / 1024 / 1024) * 100) / 100;
  }

  /**
   * Clean up database connection
   */
  public cleanup(): void {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      this.isInitialized = false;
      this.initializationError = null;
      
      console.log('🧹 SQLite Manager cleaned up');
    } catch (error) {
      console.error('❌ Error during SQLite cleanup:', error);
    }
  }

  /**
   * Ensure SQLite is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error(
        this.initializationError || 
        'SQLite Manager is not initialized. Please call initialize() first.'
      );
    }
  }

  /**
   * Get the database instance (for internal use)
   */
  public getDatabase(): Database.Database {
    this.ensureInitialized();
    return this.db!;
  }

  /**
   * Get the task manager instance
   */
  public getTaskManager(): SQLiteTaskManager {
    this.ensureInitialized();
    if (!this.taskManager) {
      throw new Error('Task manager not initialized');
    }
    return this.taskManager;
  }
}

// Export singleton instance getter
export const getSQLiteManager = (): SQLiteManager => SQLiteManager.getInstance();