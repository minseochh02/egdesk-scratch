/**
 * SQLite database layer for Skillset System
 * Handles database initialization, schema creation, and low-level operations
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let db: Database.Database | null = null;

/**
 * Initialize the Rookie database with Skillset tables
 */
export function initializeRookieDatabase(): Database.Database {
  if (db) return db;

  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'databases', 'rookie.db')
    : path.join(process.cwd(), 'databases', 'rookie.db');

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log('[Skillset DB] Initializing database at:', dbPath);

  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  initializeSchema(db);

  console.log('[Skillset DB] Database initialized successfully');

  return db;
}

/**
 * Create database schema for Skillset System
 */
function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Main website registry
    CREATE TABLE IF NOT EXISTS skillset_websites (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      domain TEXT NOT NULL,
      site_name TEXT NOT NULL,
      site_type TEXT,

      -- Authentication (stored as JSON)
      login_method TEXT,

      -- Timestamps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_explored_at DATETIME,
      last_used_at DATETIME,

      -- Counters
      exploration_count INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,

      -- Health metrics
      overall_confidence REAL DEFAULT 0.5,
      stale_count INTEGER DEFAULT 0,

      -- User annotations
      tags TEXT,
      notes TEXT
    );

    -- Individual capabilities
    CREATE TABLE IF NOT EXISTS skillset_capabilities (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,

      -- What it is
      section TEXT NOT NULL,
      description TEXT NOT NULL,
      data_available TEXT NOT NULL,

      -- Discovery
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      discovered_by TEXT,

      -- Confidence metrics
      confidence REAL DEFAULT 0.5,
      successful_navigations INTEGER DEFAULT 0,
      failed_navigations INTEGER DEFAULT 0,

      -- Tracking
      last_accessed_at DATETIME,
      last_verified_at DATETIME,
      has_changed BOOLEAN DEFAULT FALSE,

      -- Usage (stored as JSON array)
      used_in_reports TEXT,

      FOREIGN KEY (website_id) REFERENCES skillset_websites(id) ON DELETE CASCADE
    );

    -- Navigation paths (multiple ways to reach same capability)
    CREATE TABLE IF NOT EXISTS skillset_navigation_paths (
      id TEXT PRIMARY KEY,
      capability_id TEXT NOT NULL,

      -- The path (stored as JSON array of NavigationStep)
      steps TEXT NOT NULL,

      -- Reliability
      confidence REAL DEFAULT 0.5,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_success_at DATETIME,
      last_failure_at DATETIME,

      -- Metadata
      requires_filters BOOLEAN DEFAULT FALSE,
      filter_instructions TEXT,
      estimated_time_ms INTEGER,

      -- Flags
      is_primary BOOLEAN DEFAULT FALSE,
      is_deprecated BOOLEAN DEFAULT FALSE,

      FOREIGN KEY (capability_id) REFERENCES skillset_capabilities(id) ON DELETE CASCADE
    );

    -- Element signatures (how to find UI elements)
    CREATE TABLE IF NOT EXISTS skillset_element_signatures (
      id TEXT PRIMARY KEY,
      navigation_path_id TEXT NOT NULL,

      -- Semantic locators
      role TEXT,
      name TEXT,
      aria_label TEXT,

      -- Fallback locators
      xpath TEXT,
      css_selector TEXT,

      -- Reliability
      reliability REAL DEFAULT 0.5,
      last_worked_at DATETIME,
      last_failed_at DATETIME,

      -- Alternates (JSON array of backup signatures)
      alternates TEXT,

      FOREIGN KEY (navigation_path_id) REFERENCES skillset_navigation_paths(id) ON DELETE CASCADE
    );

    -- Exploration history (audit trail)
    CREATE TABLE IF NOT EXISTS skillset_exploration_logs (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,

      explored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT,
      capabilities_found INTEGER,
      tool_calls_used INTEGER,
      execution_time_ms INTEGER,

      -- What changed
      new_capabilities INTEGER,
      updated_capabilities INTEGER,
      removed_capabilities INTEGER,

      -- Full log
      log_file_path TEXT,

      FOREIGN KEY (website_id) REFERENCES skillset_websites(id) ON DELETE CASCADE
    );

    -- Stored credentials (encrypted)
    CREATE TABLE IF NOT EXISTS skillset_credentials (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,

      -- Encrypted credential data
      encrypted_credentials TEXT NOT NULL,  -- JSON of field_name: encrypted_value

      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME,
      last_verified_at DATETIME,

      -- Status
      is_valid BOOLEAN DEFAULT TRUE,
      last_error TEXT,

      FOREIGN KEY (website_id) REFERENCES skillset_websites(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_websites_domain
      ON skillset_websites(domain);

    CREATE INDEX IF NOT EXISTS idx_capabilities_website
      ON skillset_capabilities(website_id);

    CREATE INDEX IF NOT EXISTS idx_capabilities_confidence
      ON skillset_capabilities(confidence DESC);

    CREATE INDEX IF NOT EXISTS idx_capabilities_section
      ON skillset_capabilities(section);

    CREATE INDEX IF NOT EXISTS idx_paths_capability
      ON skillset_navigation_paths(capability_id);

    CREATE INDEX IF NOT EXISTS idx_paths_confidence
      ON skillset_navigation_paths(confidence DESC, is_primary DESC);

    CREATE INDEX IF NOT EXISTS idx_logs_website
      ON skillset_exploration_logs(website_id, explored_at DESC);

    CREATE INDEX IF NOT EXISTS idx_credentials_website
      ON skillset_credentials(website_id);
  `);

  console.log('[Skillset DB] Schema initialized');
}

/**
 * Get the initialized database instance
 */
export function getRookieDatabase(): Database.Database {
  if (!db) {
    return initializeRookieDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeRookieDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Skillset DB] Database closed');
  }
}

/**
 * Execute a query and return results
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const database = getRookieDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Execute a query and return a single result
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const database = getRookieDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

/**
 * Execute an insert/update/delete query
 */
export function execute(sql: string, params: any[] = []): Database.RunResult {
  const database = getRookieDatabase();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

/**
 * Execute multiple statements in a transaction
 */
export function transaction(callback: () => void): void {
  const database = getRookieDatabase();
  const txn = database.transaction(callback);
  txn();
}
