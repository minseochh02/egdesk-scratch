import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteTaskManager } from './tasks';

/**
 * SQLite Database Initialization
 * 
 * This module handles the initialization of the SQLite database,
 * including schema creation, indexes, and triggers.
 */

/**
 * Get database size in MB
 */
export function getDatabaseSize(dbPath: string): number {
    if (!fs.existsSync(dbPath)) return 0;
    const stats = fs.statSync(dbPath);
    return Math.round((stats.size / 1024 / 1024) * 100) / 100;
  }
  
  /**
   * Get WordPress database file path
   */
  export function getConversationsDatabasePath(): string {
    return path.join(app.getPath('userData'), 'database', 'conversations.db');
  }
  
  /**
   * Get WordPress database instance
   */
  export function getConversationsDatabase(): Database.Database {
    const conversationsDbPath = getConversationsDatabasePath();
    return new Database(conversationsDbPath);
  }

  export function getWordPressDatabasePath(): string {
    return path.join(app.getPath('userData'), 'database', 'wordpress.db');
  }

  export function getWordPressDatabase(): Database.Database {
    const wordpressDbPath = getWordPressDatabasePath();
    return new Database(wordpressDbPath);
  }
  

export interface DatabaseInitResult {
  success: boolean;
  error?: string;
  conversationsDatabase?: Database.Database;
  taskDatabase?: Database.Database;
  wordpressDatabase?: Database.Database;
  taskManager?: SQLiteTaskManager;
  conversationsDbPath?: string;
  taskDbPath?: string;
  wordpressDbPath?: string;
}

/**
 * Initialize SQLite database with schema and task manager
 */
export async function initializeSQLiteDatabase(): Promise<DatabaseInitResult> {
  try {
    console.log('🔧 Initializing SQLite Database...');
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(app.getPath('userData'), 'database');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const conversationsDbPath = path.join(dataDir, 'conversations.db');
    const taskDbPath = path.join(dataDir, 'tasks.db');
    const wordpressDbPath = path.join(dataDir, 'wordpress.db');
    const conversationsDb = new Database(conversationsDbPath);
    const taskDb = new Database(taskDbPath);
    const wordpressDb = new Database(wordpressDbPath);
    
    // Initialize database schemas
    initializeConversationsDatabaseSchema(conversationsDb);
    initializeTaskSchema(taskDb);
    initializeWordPressDatabaseSchema(wordpressDb);
    
    // Initialize task manager
    const taskManager = new SQLiteTaskManager(taskDb);
    
    console.log('🎉 SQLite Database fully initialized');
    
    return { 
      success: true, 
      conversationsDatabase: conversationsDb, 
      taskDatabase: taskDb,
      wordpressDatabase: wordpressDb,
      taskManager, 
      conversationsDbPath,
      taskDbPath,
      wordpressDbPath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to initialize SQLite Database:', errorMessage);
    
    return { 
      success: false, 
      error: `SQLite initialization failed: ${errorMessage}` 
    };
  }
}

/**
 * Initialize database schema for AI chat storage
 */
export function initializeConversationsDatabaseSchema(db: Database.Database): void {
  // Create conversations table
  db.exec(`
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
  db.exec(`
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
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_is_active ON conversations(is_active);
  `);

  // Create triggers for updated_at timestamps
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp 
    AFTER UPDATE ON conversations
    BEGIN
      UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_messages_timestamp 
    AFTER UPDATE ON messages
    BEGIN
      UPDATE messages SET timestamp = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);
}


/**
 * Initialize task management schema
 */
export function initializeTaskSchema(db: Database.Database): void {
  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      command TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      environment TEXT, -- JSON string
      metadata TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_run DATETIME,
      next_run DATETIME,
      run_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      frequency_days INTEGER DEFAULT 1,
      frequency_hours INTEGER DEFAULT 0,
      frequency_minutes INTEGER DEFAULT 0,
      topic_selection_mode TEXT DEFAULT 'least-used'
    )
  `);

  // Create task_executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
      output TEXT,
      exit_code INTEGER,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create topics table (merged with task_topics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      task_id TEXT NOT NULL,
      usage_count INTEGER DEFAULT 0,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(name, task_id)
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
    CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON tasks(next_run);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON task_executions(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_executions_start_time ON task_executions(start_time);
    CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
    CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);
    CREATE INDEX IF NOT EXISTS idx_topics_task_id ON topics(task_id);
    CREATE INDEX IF NOT EXISTS idx_topics_usage_count ON topics(usage_count);
    CREATE INDEX IF NOT EXISTS idx_topics_last_used ON topics(last_used);
    CREATE INDEX IF NOT EXISTS idx_topics_is_active ON topics(is_active);
  `);

  // Create triggers for updated_at timestamps
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    BEGIN
      UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_topics_timestamp 
    AFTER UPDATE ON topics
    BEGIN
      UPDATE topics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);
}

/**
 * Initialize WordPress database schema
 */
export function initializeWordPressDatabaseSchema(db: Database.Database): void {
  // Create wordpress_posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordpress_posts (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      excerpt TEXT,
      slug TEXT,
      status TEXT DEFAULT 'publish',
      type TEXT DEFAULT 'post',
      author INTEGER DEFAULT 1,
      featured_media INTEGER DEFAULT 0,
      parent INTEGER DEFAULT 0,
      menu_order INTEGER DEFAULT 0,
      comment_status TEXT DEFAULT 'open',
      ping_status TEXT DEFAULT 'open',
      template TEXT DEFAULT '',
      format TEXT DEFAULT 'standard',
      meta TEXT, -- JSON string for post meta
      date DATETIME,
      date_gmt DATETIME,
      modified DATETIME,
      modified_gmt DATETIME,
      link TEXT,
      guid TEXT,
      wordpress_site_id TEXT NOT NULL,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      local_content TEXT,
      export_format TEXT DEFAULT 'wordpress'
    )
  `);

  // Create wordpress_media table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordpress_media (
      id INTEGER PRIMARY KEY,
      title TEXT,
      description TEXT,
      caption TEXT,
      alt_text TEXT,
      source_url TEXT NOT NULL,
      mime_type TEXT DEFAULT 'image/jpeg',
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      wordpress_site_id TEXT NOT NULL,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      local_data BLOB
    )
  `);

  // Create wordpress_comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordpress_comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      parent INTEGER DEFAULT 0,
      author_name TEXT,
      author_email TEXT,
      author_url TEXT,
      author_ip TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'hold',
      type TEXT DEFAULT 'comment',
      karma INTEGER DEFAULT 0,
      date DATETIME,
      date_gmt DATETIME,
      link TEXT,
      wordpress_site_id TEXT NOT NULL,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sync_operations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      site_name TEXT,
      operation_type TEXT DEFAULT 'full_sync',
      status TEXT DEFAULT 'pending',
      start_time DATETIME,
      end_time DATETIME,
      total_posts INTEGER DEFAULT 0,
      synced_posts INTEGER DEFAULT 0,
      total_media INTEGER DEFAULT 0,
      synced_media INTEGER DEFAULT 0,
      errors TEXT, -- JSON string for error details
      export_format TEXT DEFAULT 'wordpress',
      local_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sync_file_details table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_file_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_operation_id INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      synced_at DATETIME,
      wordpress_id TEXT,
      wordpress_url TEXT,
      FOREIGN KEY (sync_operation_id) REFERENCES sync_operations(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wordpress_posts_site_id ON wordpress_posts(wordpress_site_id);
    CREATE INDEX IF NOT EXISTS idx_wordpress_posts_status ON wordpress_posts(status);
    CREATE INDEX IF NOT EXISTS idx_wordpress_posts_type ON wordpress_posts(type);
    CREATE INDEX IF NOT EXISTS idx_wordpress_posts_synced_at ON wordpress_posts(synced_at);
    CREATE INDEX IF NOT EXISTS idx_wordpress_media_site_id ON wordpress_media(wordpress_site_id);
    CREATE INDEX IF NOT EXISTS idx_wordpress_media_mime_type ON wordpress_media(mime_type);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_site_id ON sync_operations(site_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
    CREATE INDEX IF NOT EXISTS idx_sync_file_details_operation_id ON sync_file_details(sync_operation_id);
    CREATE INDEX IF NOT EXISTS idx_sync_file_details_status ON sync_file_details(status);
  `);
}
