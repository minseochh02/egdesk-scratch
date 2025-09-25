import Database from 'better-sqlite3';
import { ScheduledTask, TaskExecution } from '../preload';

export interface Topic {
  id: string;
  name: string;
  description?: string;
  taskId: string;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * SQLite Task Manager
 * 
 * Handles all task and task execution storage operations using SQLite.
 * This replaces the Electron store for task persistence.
 */
export class SQLiteTaskManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Create a new task
   */
  createTask(task: ScheduledTask): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, name, description, command, schedule, enabled,
        environment, metadata, created_at, updated_at,
        last_run, next_run, run_count, success_count, failure_count,
        frequency_days, frequency_hours, frequency_minutes, topic_selection_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.name,
      task.description || null,
      task.command,
      task.schedule,
      task.enabled ? 1 : 0,
      task.environment ? JSON.stringify(task.environment) : null,
      task.metadata ? JSON.stringify(task.metadata) : null,
      task.createdAt.toISOString(),
      task.updatedAt.toISOString(),
      task.lastRun ? task.lastRun.toISOString() : null,
      task.nextRun ? task.nextRun.toISOString() : null,
      task.runCount,
      task.successCount,
      task.failureCount,
      task.frequencyDays || 1,
      task.frequencyHours || 0,
      task.frequencyMinutes || 0,
      task.topicSelectionMode || 'least-used'
    );
  }

  /**
   * Update an existing task
   */
  updateTask(taskId: string, updates: Partial<ScheduledTask>): void {
    const existingTask = this.getTask(taskId);
    if (!existingTask) {
      throw new Error('Task not found');
    }

    const updatedTask = { ...existingTask, ...updates, updatedAt: new Date() };
    
    const stmt = this.db.prepare(`
      UPDATE tasks SET
        name = ?, description = ?, command = ?, schedule = ?, enabled = ?,
        environment = ?, metadata = ?, updated_at = ?, last_run = ?, next_run = ?,
        run_count = ?, success_count = ?, failure_count = ?,
        frequency_days = ?, frequency_hours = ?, frequency_minutes = ?,
        topic_selection_mode = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedTask.name,
      updatedTask.description || null,
      updatedTask.command,
      updatedTask.schedule,
      updatedTask.enabled ? 1 : 0,
      updatedTask.environment ? JSON.stringify(updatedTask.environment) : null,
      updatedTask.metadata ? JSON.stringify(updatedTask.metadata) : null,
      updatedTask.updatedAt.toISOString(),
      updatedTask.lastRun ? updatedTask.lastRun.toISOString() : null,
      updatedTask.nextRun ? updatedTask.nextRun.toISOString() : null,
      updatedTask.runCount,
      updatedTask.successCount,
      updatedTask.failureCount,
      updatedTask.frequencyDays || 1,
      updatedTask.frequencyHours || 0,
      updatedTask.frequencyMinutes || 0,
      updatedTask.topicSelectionMode || 'least-used',
      taskId
    );
  }

  /**
   * Delete a task and all its executions
   */
  deleteTask(taskId: string): void {
    // Delete executions first (foreign key constraint)
    const deleteExecutionsStmt = this.db.prepare('DELETE FROM task_executions WHERE task_id = ?');
    deleteExecutionsStmt.run(taskId);

    // Delete the task
    const deleteTaskStmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    deleteTaskStmt.run(taskId);
  }

  /**
   * Get a single task by ID
   */
  getTask(taskId: string): ScheduledTask | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(taskId) as any;

    if (!row) return null;

    return this.mapRowToTask(row);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * Get tasks by status (enabled/disabled)
   */
  getTasksByStatus(enabled: boolean): ScheduledTask[] {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE enabled = ? ORDER BY created_at DESC');
    const rows = stmt.all(enabled ? 1 : 0) as any[];

    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * Create a new task execution
   */
  createExecution(execution: TaskExecution): void {
    const stmt = this.db.prepare(`
      INSERT INTO task_executions (
        id, task_id, start_time, end_time, status, output, exit_code, error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      execution.id,
      execution.taskId,
      execution.startTime.toISOString(),
      execution.endTime ? execution.endTime.toISOString() : null,
      execution.status,
      execution.output || null,
      execution.exitCode || null,
      execution.error || null,
      execution.createdAt.toISOString()
    );
  }

  /**
   * Update an existing task execution
   */
  updateExecution(executionId: string, updates: Partial<TaskExecution>): void {
    const existingExecution = this.getExecution(executionId);
    if (!existingExecution) {
      throw new Error('Execution not found');
    }

    const updatedExecution = { ...existingExecution, ...updates };
    
    const stmt = this.db.prepare(`
      UPDATE task_executions SET
        end_time = ?, status = ?, output = ?, exit_code = ?, error = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedExecution.endTime ? updatedExecution.endTime.toISOString() : null,
      updatedExecution.status,
      updatedExecution.output || null,
      updatedExecution.exitCode || null,
      updatedExecution.error || null,
      executionId
    );
  }

  /**
   * Get a single execution by ID
   */
  getExecution(executionId: string): TaskExecution | null {
    const stmt = this.db.prepare('SELECT * FROM task_executions WHERE id = ?');
    const row = stmt.get(executionId) as any;

    if (!row) return null;

    return this.mapRowToExecution(row);
  }

  /**
   * Get all executions, optionally filtered by task ID
   */
  getExecutions(taskId?: string): TaskExecution[] {
    let query = 'SELECT * FROM task_executions';
    let params: any[] = [];

    if (taskId) {
      query += ' WHERE task_id = ?';
      params.push(taskId);
    }

    query += ' ORDER BY start_time DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToExecution(row));
  }

  /**
   * Get executions by status
   */
  getExecutionsByStatus(status: string, taskId?: string): TaskExecution[] {
    let query = 'SELECT * FROM task_executions WHERE status = ?';
    let params: any[] = [status];

    if (taskId) {
      query += ' AND task_id = ?';
      params.push(taskId);
    }

    query += ' ORDER BY start_time DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToExecution(row));
  }

  /**
   * Get task statistics
   */
  getTaskStats(): {
    totalTasks: number;
    enabledTasks: number;
    disabledTasks: number;
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const taskStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled
      FROM tasks
    `).get() as any;

    const executionStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM task_executions
    `).get() as any;

    return {
      totalTasks: taskStats.total || 0,
      enabledTasks: taskStats.enabled || 0,
      disabledTasks: taskStats.disabled || 0,
      totalExecutions: executionStats.total || 0,
      runningExecutions: executionStats.running || 0,
      completedExecutions: executionStats.completed || 0,
      failedExecutions: executionStats.failed || 0,
    };
  }

  /**
   * Clear all tasks and executions (for testing/cleanup)
   */
  clearAll(): void {
    this.db.exec('DELETE FROM task_executions');
    this.db.exec('DELETE FROM topics');
    this.db.exec('DELETE FROM tasks');
  }

  // ===== TOPIC MANAGEMENT METHODS =====

  /**
   * Create a new topic
   */
  createTopic(topic: Omit<Topic, 'id' | 'createdAt' | 'updatedAt'>): string {
    const { v4: uuidv4 } = require('uuid');
    const topicId = uuidv4();
    
    const stmt = this.db.prepare(`
      INSERT INTO topics (
        id, name, description, task_id, usage_count, last_used, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      topicId,
      topic.name,
      topic.description || null,
      topic.taskId,
      topic.usageCount || 0,
      topic.lastUsed ? topic.lastUsed.toISOString() : null,
      topic.isActive ? 1 : 0
    );

    return topicId;
  }

  /**
   * Get a topic by ID
   */
  getTopic(topicId: string): Topic | null {
    const stmt = this.db.prepare('SELECT * FROM topics WHERE id = ?');
    const row = stmt.get(topicId) as any;

    if (!row) return null;

    return this.mapRowToTopic(row);
  }

  /**
   * Get a topic by name and task ID
   */
  getTopicByNameAndTask(name: string, taskId: string): Topic | null {
    const stmt = this.db.prepare('SELECT * FROM topics WHERE name = ? AND task_id = ?');
    const row = stmt.get(name, taskId) as any;

    if (!row) return null;

    return this.mapRowToTopic(row);
  }

  /**
   * Get all topics
   */
  getAllTopics(): Topic[] {
    const stmt = this.db.prepare('SELECT * FROM topics ORDER BY usage_count DESC, name ASC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapRowToTopic(row));
  }

  /**
   * Get active topics only
   */
  getActiveTopics(): Topic[] {
    const stmt = this.db.prepare('SELECT * FROM topics WHERE is_active = 1 ORDER BY usage_count DESC, name ASC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapRowToTopic(row));
  }

  /**
   * Get least used topics for a specific task (for topic selection)
   */
  getLeastUsedTopicsForTask(taskId: string, limit: number = 10): Topic[] {
    const stmt = this.db.prepare(`
      SELECT * FROM topics 
      WHERE task_id = ? AND is_active = 1 
      ORDER BY usage_count ASC, last_used ASC, name ASC 
      LIMIT ?
    `);
    const rows = stmt.all(taskId, limit) as any[];

    return rows.map(row => this.mapRowToTopic(row));
  }

  /**
   * Get least used topics across all tasks (for topic selection)
   */
  getLeastUsedTopics(limit: number = 10): Topic[] {
    const stmt = this.db.prepare(`
      SELECT * FROM topics 
      WHERE is_active = 1 
      ORDER BY usage_count ASC, last_used ASC, name ASC 
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map(row => this.mapRowToTopic(row));
  }

  /**
   * Update a topic
   */
  updateTopic(topicId: string, updates: Partial<Topic>): void {
    const existingTopic = this.getTopic(topicId);
    if (!existingTopic) {
      throw new Error('Topic not found');
    }

    const updatedTopic = { ...existingTopic, ...updates, updatedAt: new Date() };
    
    const stmt = this.db.prepare(`
      UPDATE topics SET
        name = ?, description = ?, usage_count = ?, last_used = ?, is_active = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedTopic.name,
      updatedTopic.description || null,
      updatedTopic.usageCount,
      updatedTopic.lastUsed ? updatedTopic.lastUsed.toISOString() : null,
      updatedTopic.isActive ? 1 : 0,
      topicId
    );
  }

  /**
   * Delete a topic
   */
  deleteTopic(topicId: string): void {
    const deleteTopicStmt = this.db.prepare('DELETE FROM topics WHERE id = ?');
    deleteTopicStmt.run(topicId);
  }

  /**
   * Increment topic usage count and update last used
   */
  incrementTopicUsage(topicId: string): void {
    const stmt = this.db.prepare(`
      UPDATE topics 
      SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(topicId);
  }

  /**
   * Get topics associated with a task
   */
  getTopicsForTask(taskId: string): Topic[] {
    const stmt = this.db.prepare(`
      SELECT * FROM topics 
      WHERE task_id = ?
      ORDER BY usage_count DESC, name ASC
    `);
    const rows = stmt.all(taskId) as any[];

    return rows.map(row => this.mapRowToTopic(row));
  }

  /**
   * Get tasks associated with a topic name (across all tasks)
   */
  getTasksForTopicName(topicName: string): ScheduledTask[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN topics top ON t.id = top.task_id
      WHERE top.name = ?
      ORDER BY t.created_at DESC
    `);
    const rows = stmt.all(topicName) as any[];

    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * Calculate next run time based on frequency
   */
  calculateNextRun(task: ScheduledTask): Date {
    const now = new Date();
    const lastRun = task.lastRun || task.createdAt;
    
    // Calculate total frequency in milliseconds
    const totalMs = (task.frequencyDays || 1) * 24 * 60 * 60 * 1000 +
                   (task.frequencyHours || 0) * 60 * 60 * 1000 +
                   (task.frequencyMinutes || 0) * 60 * 1000;
    
    // If no frequency specified, default to 1 day
    const frequencyMs = totalMs > 0 ? totalMs : 24 * 60 * 60 * 1000;
    
    // Calculate next run time
    const nextRun = new Date(lastRun.getTime() + frequencyMs);
    
    // If next run is in the past, calculate from now
    if (nextRun <= now) {
      return new Date(now.getTime() + frequencyMs);
    }
    
    return nextRun;
  }

  /**
   * Update next run time for a task based on its frequency
   */
  updateNextRun(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    const nextRun = this.calculateNextRun(task);
    this.updateTask(taskId, { nextRun });
  }

  /**
   * Get topic statistics
   */
  getTopicStats(): {
    totalTopics: number;
    activeTopics: number;
    inactiveTopics: number;
    mostUsedTopic: Topic | null;
    leastUsedTopic: Topic | null;
    averageUsage: number;
  } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
        AVG(usage_count) as avg_usage
      FROM topics
    `).get() as any;

    const mostUsed = this.db.prepare(`
      SELECT * FROM topics 
      WHERE is_active = 1 
      ORDER BY usage_count DESC, last_used DESC 
      LIMIT 1
    `).get() as any;

    const leastUsed = this.db.prepare(`
      SELECT * FROM topics 
      WHERE is_active = 1 
      ORDER BY usage_count ASC, last_used ASC 
      LIMIT 1
    `).get() as any;

    return {
      totalTopics: stats.total || 0,
      activeTopics: stats.active || 0,
      inactiveTopics: stats.inactive || 0,
      mostUsedTopic: mostUsed ? this.mapRowToTopic(mostUsed) : null,
      leastUsedTopic: leastUsed ? this.mapRowToTopic(leastUsed) : null,
      averageUsage: Math.round((stats.avg_usage || 0) * 100) / 100,
    };
  }

  /**
   * Map database row to ScheduledTask object
   */
  private mapRowToTask(row: any): ScheduledTask {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      command: row.command,
      schedule: row.schedule,
      enabled: Boolean(row.enabled),
      environment: row.environment ? JSON.parse(row.environment) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined,
      runCount: row.run_count || 0,
      successCount: row.success_count || 0,
      failureCount: row.failure_count || 0,
      frequencyDays: row.frequency_days || 1,
      frequencyHours: row.frequency_hours || 0,
      frequencyMinutes: row.frequency_minutes || 0,
      topicSelectionMode: row.topic_selection_mode || 'least-used',
    };
  }

  /**
   * Map database row to TaskExecution object
   */
  private mapRowToExecution(row: any): TaskExecution {
    return {
      id: row.id,
      taskId: row.task_id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      output: row.output || undefined,
      exitCode: row.exit_code || undefined,
      error: row.error || undefined,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Map database row to Topic object
   */
  private mapRowToTopic(row: any): Topic {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      taskId: row.task_id,
      usageCount: row.usage_count || 0,
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: Boolean(row.is_active),
    };
  }
}
