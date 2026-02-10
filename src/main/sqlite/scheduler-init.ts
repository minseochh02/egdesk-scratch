import Database from 'better-sqlite3';

/**
 * Initialize scheduler database schema
 *
 * This database tracks execution intents and recovery state for all schedulers:
 * - FinanceHubScheduler
 * - DockerSchedulerService
 * - PlaywrightSchedulerService
 * - ScheduledPostsExecutor
 */
export function initializeSchedulerDatabaseSchema(db: Database.Database): void {
  console.log('📅 Initializing scheduler database schema...');

  // =============================================
  // Schema Version Check & Migration
  // =============================================
  // Check if we need to recreate the table with retry_count column
  try {
    const tableInfo = db.pragma('table_info(scheduler_execution_intents)');
    const hasRetryCount = tableInfo.some((col: any) => col.name === 'retry_count');

    if (!hasRetryCount && tableInfo.length > 0) {
      // Table exists but missing retry_count column - need to migrate
      console.log('🔄 Scheduler database needs migration (adding retry_count column)...');

      // Backup existing data
      const existingData = db.prepare('SELECT * FROM scheduler_execution_intents').all();
      console.log(`📦 Backing up ${existingData.length} existing execution intents...`);

      // Drop old table
      db.exec('DROP TABLE IF EXISTS scheduler_execution_intents');
      console.log('🗑️ Dropped old scheduler_execution_intents table');

      // Will recreate with new schema below
    }
  } catch (error) {
    console.log('ℹ️ Table does not exist yet, will create fresh');
  }

  // =============================================
  // Execution Intents Table
  // =============================================
  // Tracks INTENDED executions (what SHOULD have run)
  // vs actual executions (what DID run)
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduler_execution_intents (
      id TEXT PRIMARY KEY,
      scheduler_type TEXT NOT NULL CHECK (scheduler_type IN ('financehub', 'docker', 'playwright', 'scheduled_posts')),
      task_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      intended_date TEXT NOT NULL,
      intended_time TEXT NOT NULL,
      execution_window_start TEXT NOT NULL,
      execution_window_end TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
      actual_execution_id TEXT,
      actual_started_at TEXT,
      actual_completed_at TEXT,
      skip_reason TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      UNIQUE(scheduler_type, task_id, intended_date)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_intents_status ON scheduler_execution_intents(status);
    CREATE INDEX IF NOT EXISTS idx_intents_date ON scheduler_execution_intents(intended_date);
    CREATE INDEX IF NOT EXISTS idx_intents_scheduler_task ON scheduler_execution_intents(scheduler_type, task_id);
    CREATE INDEX IF NOT EXISTS idx_intents_window_end ON scheduler_execution_intents(execution_window_end);
    CREATE INDEX IF NOT EXISTS idx_intents_created_at ON scheduler_execution_intents(created_at);
  `);

  // Create trigger for updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_intents_timestamp
    AFTER UPDATE ON scheduler_execution_intents
    BEGIN
      UPDATE scheduler_execution_intents SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  console.log('✅ Scheduler database schema initialized with retry_count column');
}
