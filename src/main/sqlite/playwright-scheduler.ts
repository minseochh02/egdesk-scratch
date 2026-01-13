import Database from 'better-sqlite3';

/**
 * Playwright Scheduled Test
 */
export interface PlaywrightScheduledTest {
  id: string;
  testPath: string;
  testName: string;
  enabled: boolean;
  scheduledTime: string; // HH:MM format (e.g., "09:00")
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfMonth?: number; // 1-31
  customIntervalDays?: number; // For custom frequency
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Playwright Test Execution Record
 */
export interface PlaywrightTestExecution {
  id: string;
  testId: string;
  status: 'success' | 'failure' | 'running';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Create Playwright Scheduled Test Data
 */
export interface CreatePlaywrightTestData {
  testPath: string;
  testName: string;
  scheduledTime: string;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number;
  dayOfMonth?: number;
  customIntervalDays?: number;
}

/**
 * Create Playwright Test Execution Data
 */
export interface CreatePlaywrightTestExecutionData {
  testId: string;
  status: 'success' | 'failure' | 'running';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
}

/**
 * SQLite Playwright Scheduler Manager
 *
 * Manages scheduled Playwright test runs in SQLite database
 */
export class SQLitePlaywrightSchedulerManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    // Create playwright_scheduled_tests table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playwright_scheduled_tests (
        id TEXT PRIMARY KEY,
        test_path TEXT NOT NULL,
        test_name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        scheduled_time TEXT NOT NULL,
        frequency_type TEXT NOT NULL,
        day_of_week INTEGER,
        day_of_month INTEGER,
        custom_interval_days INTEGER,
        last_run TEXT,
        next_run TEXT,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create playwright_test_executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playwright_test_executions (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        duration INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (test_id) REFERENCES playwright_scheduled_tests(id) ON DELETE CASCADE
      )
    `);

    // Create index on test_id for faster execution history queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_playwright_executions_test_id
      ON playwright_test_executions(test_id)
    `);
  }

  /**
   * Create a scheduled test
   */
  createTest(data: CreatePlaywrightTestData): PlaywrightScheduledTest {
    const id = this.generateId();
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO playwright_scheduled_tests (
        id, test_path, test_name, enabled, scheduled_time, frequency_type,
        day_of_week, day_of_month, custom_interval_days,
        run_count, success_count, failure_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.testPath,
      data.testName,
      1, // enabled
      data.scheduledTime,
      data.frequencyType,
      data.dayOfWeek ?? null,
      data.dayOfMonth ?? null,
      data.customIntervalDays ?? null,
      0, // run_count
      0, // success_count
      0, // failure_count
      now.toISOString(),
      now.toISOString()
    );

    return this.getTest(id)!;
  }

  /**
   * Get a test by ID
   */
  getTest(id: string): PlaywrightScheduledTest | null {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_scheduled_tests WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToTest(row);
  }

  /**
   * Get test by path
   */
  getTestByPath(testPath: string): PlaywrightScheduledTest | null {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_scheduled_tests WHERE test_path = ?
    `);

    const row = stmt.get(testPath) as any;
    if (!row) return null;

    return this.mapRowToTest(row);
  }

  /**
   * Get all tests
   */
  getAllTests(): PlaywrightScheduledTest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_scheduled_tests ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToTest(row));
  }

  /**
   * Get enabled tests
   */
  getEnabledTests(): PlaywrightScheduledTest[] {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_scheduled_tests
      WHERE enabled = 1
      ORDER BY next_run ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToTest(row));
  }

  /**
   * Update a test
   */
  updateTest(id: string, updates: Partial<CreatePlaywrightTestData>): PlaywrightScheduledTest | null {
    const existing = this.getTest(id);
    if (!existing) return null;

    const now = new Date();

    const stmt = this.db.prepare(`
      UPDATE playwright_scheduled_tests
      SET test_name = ?, scheduled_time = ?, frequency_type = ?,
          day_of_week = ?, day_of_month = ?, custom_interval_days = ?,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.testName ?? existing.testName,
      updates.scheduledTime ?? existing.scheduledTime,
      updates.frequencyType ?? existing.frequencyType,
      updates.dayOfWeek !== undefined ? updates.dayOfWeek : existing.dayOfWeek,
      updates.dayOfMonth !== undefined ? updates.dayOfMonth : existing.dayOfMonth,
      updates.customIntervalDays !== undefined ? updates.customIntervalDays : existing.customIntervalDays,
      now.toISOString(),
      id
    );

    return this.getTest(id);
  }

  /**
   * Delete a test
   */
  deleteTest(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM playwright_scheduled_tests WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Toggle test enabled/disabled
   */
  toggleTest(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE playwright_scheduled_tests
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(enabled ? 1 : 0, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Update test statistics after execution
   */
  updateTestStats(id: string, success: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE playwright_scheduled_tests
      SET run_count = run_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_run = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    const result = stmt.run(
      success ? 1 : 0,
      success ? 0 : 1,
      now,
      now,
      id
    );

    return result.changes > 0;
  }

  /**
   * Update next run time
   */
  updateNextRun(id: string, nextRun: Date): boolean {
    const stmt = this.db.prepare(`
      UPDATE playwright_scheduled_tests
      SET next_run = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(nextRun.toISOString(), new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Create execution record
   */
  createExecution(data: CreatePlaywrightTestExecutionData): PlaywrightTestExecution {
    const id = this.generateExecutionId();
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO playwright_test_executions (
        id, test_id, status, started_at, completed_at, duration, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.testId,
      data.status,
      data.startedAt.toISOString(),
      data.completedAt ? data.completedAt.toISOString() : null,
      data.duration ?? null,
      data.errorMessage ?? null,
      now.toISOString()
    );

    return this.getExecution(id)!;
  }

  /**
   * Update execution record
   */
  updateExecution(id: string, data: CreatePlaywrightTestExecutionData): boolean {
    const stmt = this.db.prepare(`
      UPDATE playwright_test_executions
      SET status = ?, completed_at = ?, duration = ?, error_message = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      data.status,
      data.completedAt ? data.completedAt.toISOString() : null,
      data.duration ?? null,
      data.errorMessage ?? null,
      id
    );

    return result.changes > 0;
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): PlaywrightTestExecution | null {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_test_executions WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapRowToExecution(row);
  }

  /**
   * Get execution history for a test
   */
  getTestExecutions(testId: string, limit: number = 50): PlaywrightTestExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_test_executions
      WHERE test_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(testId, limit) as any[];
    return rows.map(row => this.mapRowToExecution(row));
  }

  /**
   * Get recent executions across all tests
   */
  getRecentExecutions(limit: number = 50): PlaywrightTestExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM playwright_test_executions
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToExecution(row));
  }

  /**
   * Map database row to PlaywrightScheduledTest
   */
  private mapRowToTest(row: any): PlaywrightScheduledTest {
    return {
      id: row.id,
      testPath: row.test_path,
      testName: row.test_name,
      enabled: Boolean(row.enabled),
      scheduledTime: row.scheduled_time,
      frequencyType: row.frequency_type,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
      customIntervalDays: row.custom_interval_days,
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined,
      runCount: row.run_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to PlaywrightTestExecution
   */
  private mapRowToExecution(row: any): PlaywrightTestExecution {
    return {
      id: row.id,
      testId: row.test_id,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration || undefined,
      errorMessage: row.error_message || undefined,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Generate unique test ID
   */
  private generateId(): string {
    return `pw_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `pw_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
