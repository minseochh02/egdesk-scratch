import Database from 'better-sqlite3';

// ============================================
// Types
// ============================================

export interface DockerContainerCreateOptions {
  containerName?: string;
  hostPort?: string;
  containerPort?: string;
  envVars?: Record<string, string>;
  volumes?: Array<{ hostPath: string; containerPath: string }>;
  network?: string;
  restartPolicy?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
  command?: string[];
}

export interface DockerScheduledTask {
  id: string;
  name: string;
  taskType: 'start_container' | 'stop_container' | 'restart_container' | 'run_image';

  // Target identification
  containerId?: string;
  containerName?: string;
  imageName?: string;

  // Container creation options (for run_image)
  createOptions?: DockerContainerCreateOptions;

  // Scheduling configuration
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' | 'cron';
  scheduledTime: string; // HH:MM
  scheduledDate?: string; // For 'once' type: YYYY-MM-DD
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  customIntervalDays?: number;
  cronExpression?: string;

  // Status
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;

  // Metadata
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DockerTaskExecution {
  id: string;
  taskId: string;
  status: 'running' | 'success' | 'failure' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  errorMessage?: string;
  containerId?: string;
  executionOutput?: string;
  createdAt: Date;
}

export interface CreateDockerTaskData {
  name: string;
  taskType: DockerScheduledTask['taskType'];
  containerId?: string;
  containerName?: string;
  imageName?: string;
  createOptions?: DockerContainerCreateOptions;
  scheduleType: DockerScheduledTask['scheduleType'];
  scheduledTime: string;
  scheduledDate?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customIntervalDays?: number;
  cronExpression?: string;
  description?: string;
}

export interface CreateDockerTaskExecutionData {
  taskId: string;
  status: 'running' | 'success' | 'failure' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
  containerId?: string;
  executionOutput?: string;
}

// ============================================
// SQLite Schema Initialization
// ============================================

export function initializeDockerSchedulerSchema(db: Database.Database): void {
  // Create docker_scheduled_tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS docker_scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      task_type TEXT NOT NULL CHECK (task_type IN ('start_container', 'stop_container', 'restart_container', 'run_image')),
      
      -- Target identification
      container_id TEXT,
      container_name TEXT,
      image_name TEXT,
      
      -- Container creation options (JSON)
      create_options_json TEXT,
      
      -- Scheduling configuration
      schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'custom', 'cron')),
      scheduled_time TEXT NOT NULL,
      scheduled_date TEXT,
      day_of_week INTEGER,
      day_of_month INTEGER,
      custom_interval_days INTEGER,
      cron_expression TEXT,
      
      -- Status & tracking
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      
      -- Metadata
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create docker_task_executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS docker_task_executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure', 'cancelled')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      error_message TEXT,
      container_id TEXT,
      execution_output TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES docker_scheduled_tasks(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_docker_tasks_enabled ON docker_scheduled_tasks(enabled);
    CREATE INDEX IF NOT EXISTS idx_docker_tasks_next_run ON docker_scheduled_tasks(next_run);
    CREATE INDEX IF NOT EXISTS idx_docker_tasks_schedule_type ON docker_scheduled_tasks(schedule_type);
    CREATE INDEX IF NOT EXISTS idx_docker_tasks_task_type ON docker_scheduled_tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_docker_executions_task_id ON docker_task_executions(task_id);
    CREATE INDEX IF NOT EXISTS idx_docker_executions_started_at ON docker_task_executions(started_at);
    CREATE INDEX IF NOT EXISTS idx_docker_executions_status ON docker_task_executions(status);
  `);

  // Create trigger for updated_at timestamp
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_docker_tasks_timestamp 
    AFTER UPDATE ON docker_scheduled_tasks
    BEGIN
      UPDATE docker_scheduled_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
}

// ============================================
// SQLite Docker Scheduler Manager
// ============================================

export class SQLiteDockerSchedulerManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // ============================================
  // Task CRUD Operations
  // ============================================

  /**
   * Create a new Docker scheduled task
   */
  createTask(data: CreateDockerTaskData): DockerScheduledTask {
    const id = this.generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO docker_scheduled_tasks (
        id, name, task_type, container_id, container_name, image_name,
        create_options_json, schedule_type, scheduled_time, scheduled_date,
        day_of_week, day_of_month, custom_interval_days, cron_expression,
        enabled, description, created_at, updated_at,
        run_count, success_count, failure_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.taskType,
      data.containerId || null,
      data.containerName || null,
      data.imageName || null,
      data.createOptions ? JSON.stringify(data.createOptions) : null,
      data.scheduleType,
      data.scheduledTime,
      data.scheduledDate || null,
      data.dayOfWeek ?? null,
      data.dayOfMonth ?? null,
      data.customIntervalDays ?? null,
      data.cronExpression || null,
      1, // enabled
      data.description || null,
      now,
      now,
      0, // run_count
      0, // success_count
      0 // failure_count
    );

    return this.getTask(id)!;
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): DockerScheduledTask | null {
    const stmt = this.db.prepare(`SELECT * FROM docker_scheduled_tasks WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToTask(row);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): DockerScheduledTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM docker_scheduled_tasks 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * Get enabled tasks
   */
  getEnabledTasks(): DockerScheduledTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM docker_scheduled_tasks 
      WHERE enabled = 1
      ORDER BY next_run ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * Get due tasks (tasks that should run now)
   */
  getDueTasks(): DockerScheduledTask[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM docker_scheduled_tasks 
      WHERE enabled = 1 AND (next_run IS NULL OR next_run <= ?)
      ORDER BY next_run ASC
    `);
    const rows = stmt.all(now) as any[];
    return rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * Update a task
   */
  updateTask(
    id: string,
    updates: Partial<CreateDockerTaskData>
  ): DockerScheduledTask | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE docker_scheduled_tasks 
      SET name = ?, task_type = ?, container_id = ?, container_name = ?,
          image_name = ?, create_options_json = ?, schedule_type = ?,
          scheduled_time = ?, scheduled_date = ?, day_of_week = ?,
          day_of_month = ?, custom_interval_days = ?, cron_expression = ?,
          description = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.name ?? existing.name,
      updates.taskType ?? existing.taskType,
      updates.containerId ?? existing.containerId ?? null,
      updates.containerName ?? existing.containerName ?? null,
      updates.imageName ?? existing.imageName ?? null,
      updates.createOptions
        ? JSON.stringify(updates.createOptions)
        : existing.createOptions
          ? JSON.stringify(existing.createOptions)
          : null,
      updates.scheduleType ?? existing.scheduleType,
      updates.scheduledTime ?? existing.scheduledTime,
      updates.scheduledDate ?? existing.scheduledDate ?? null,
      updates.dayOfWeek ?? existing.dayOfWeek ?? null,
      updates.dayOfMonth ?? existing.dayOfMonth ?? null,
      updates.customIntervalDays ?? existing.customIntervalDays ?? null,
      updates.cronExpression ?? existing.cronExpression ?? null,
      updates.description ?? existing.description ?? null,
      now,
      id
    );

    return this.getTask(id);
  }

  /**
   * Delete a task
   */
  deleteTask(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM docker_scheduled_tasks WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Toggle task enabled/disabled
   */
  toggleTask(id: string, enabled: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE docker_scheduled_tasks 
      SET enabled = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(enabled ? 1 : 0, new Date().toISOString(), id);
    return result.changes > 0;
  }

  // ============================================
  // Statistics Operations
  // ============================================

  /**
   * Update run statistics after execution
   */
  updateTaskStats(id: string, success: boolean): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE docker_scheduled_tasks 
      SET run_count = run_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          last_run = ?,
          updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(success ? 1 : 0, success ? 0 : 1, now, now, id);
    return result.changes > 0;
  }

  /**
   * Update next run time
   */
  updateNextRun(id: string, nextRun: Date | null): boolean {
    const stmt = this.db.prepare(`
      UPDATE docker_scheduled_tasks 
      SET next_run = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      nextRun ? nextRun.toISOString() : null,
      new Date().toISOString(),
      id
    );
    return result.changes > 0;
  }

  // ============================================
  // Execution History Operations
  // ============================================

  /**
   * Create an execution record
   */
  createExecution(data: CreateDockerTaskExecutionData): DockerTaskExecution {
    const id = this.generateExecutionId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO docker_task_executions (
        id, task_id, status, started_at, completed_at, duration,
        error_message, container_id, execution_output, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.taskId,
      data.status,
      data.startedAt.toISOString(),
      data.completedAt ? data.completedAt.toISOString() : null,
      data.duration ?? null,
      data.errorMessage ?? null,
      data.containerId ?? null,
      data.executionOutput ?? null,
      now
    );

    return this.getExecution(id)!;
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): DockerTaskExecution | null {
    const stmt = this.db.prepare(`SELECT * FROM docker_task_executions WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToExecution(row);
  }

  /**
   * Get execution history for a task
   */
  getTaskExecutions(
    taskId: string,
    limit: number = 50
  ): DockerTaskExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM docker_task_executions 
      WHERE task_id = ? 
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(taskId, limit) as any[];
    return rows.map((row) => this.mapRowToExecution(row));
  }

  /**
   * Get recent executions across all tasks
   */
  getRecentExecutions(limit: number = 100): DockerTaskExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM docker_task_executions 
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((row) => this.mapRowToExecution(row));
  }

  /**
   * Update execution (e.g., when completed)
   */
  updateExecution(
    id: string,
    updates: Partial<CreateDockerTaskExecutionData>
  ): boolean {
    const stmt = this.db.prepare(`
      UPDATE docker_task_executions 
      SET status = COALESCE(?, status),
          completed_at = COALESCE(?, completed_at),
          duration = COALESCE(?, duration),
          error_message = COALESCE(?, error_message),
          container_id = COALESCE(?, container_id),
          execution_output = COALESCE(?, execution_output)
      WHERE id = ?
    `);
    const result = stmt.run(
      updates.status ?? null,
      updates.completedAt ? updates.completedAt.toISOString() : null,
      updates.duration ?? null,
      updates.errorMessage ?? null,
      updates.containerId ?? null,
      updates.executionOutput ?? null,
      id
    );
    return result.changes > 0;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapRowToTask(row: any): DockerScheduledTask {
    return {
      id: row.id,
      name: row.name,
      taskType: row.task_type,
      containerId: row.container_id || undefined,
      containerName: row.container_name || undefined,
      imageName: row.image_name || undefined,
      createOptions: row.create_options_json
        ? JSON.parse(row.create_options_json)
        : undefined,
      scheduleType: row.schedule_type,
      scheduledTime: row.scheduled_time,
      scheduledDate: row.scheduled_date || undefined,
      dayOfWeek: row.day_of_week ?? undefined,
      dayOfMonth: row.day_of_month ?? undefined,
      customIntervalDays: row.custom_interval_days ?? undefined,
      cronExpression: row.cron_expression || undefined,
      enabled: Boolean(row.enabled),
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined,
      runCount: row.run_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      description: row.description || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToExecution(row: any): DockerTaskExecution {
    return {
      id: row.id,
      taskId: row.task_id,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      duration: row.duration ?? undefined,
      errorMessage: row.error_message || undefined,
      containerId: row.container_id || undefined,
      executionOutput: row.execution_output || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  private generateId(): string {
    return `docker_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `docker_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

