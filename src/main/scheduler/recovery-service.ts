import { randomUUID } from 'crypto';
import { getSQLiteManager } from '../sqlite/manager';
import Database from 'better-sqlite3';

/**
 * Scheduler Recovery Service
 *
 * Provides unified recovery mechanism for all schedulers:
 * - Tracks execution intents (what SHOULD have run)
 * - Detects missed executions during downtime
 * - Recovers missed tasks on startup
 * - Prevents duplicate executions
 */

export interface ExecutionIntent {
  id: string;
  schedulerType: 'financehub' | 'docker' | 'playwright' | 'scheduled_posts';
  taskId: string;
  taskName: string;
  intendedDate: string; // YYYY-MM-DD
  intendedTime: string; // HH:MM
  executionWindowStart: string; // ISO 8601
  executionWindowEnd: string; // ISO 8601
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  actualExecutionId?: string;
  actualStartedAt?: string;
  actualCompletedAt?: string;
  skipReason?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MissedExecution {
  intentId: string;
  schedulerType: string;
  taskId: string;
  taskName: string;
  intendedDate: string;
  daysMissed: number;
}

export interface RecoveryOptions {
  lookbackDays: number; // How far back to check (default: 3)
  autoExecute: boolean; // Auto-run or notify only (default: true)
  maxCatchUpExecutions: number; // Max tasks to execute (default: 3)
  priorityOrder: 'oldest_first' | 'newest_first';
  schedulerFilter?: string[]; // Only recover specific schedulers
}

export interface RecoveryReport {
  missedCount: number;
  executedCount: number;
  failedCount: number;
  skippedCount: number;
  missedExecutions: MissedExecution[];
  executionResults: Array<{
    intentId: string;
    taskName: string;
    success: boolean;
    error?: string;
  }>;
}

export class SchedulerRecoveryService {
  private static instance: SchedulerRecoveryService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): SchedulerRecoveryService {
    if (!SchedulerRecoveryService.instance) {
      SchedulerRecoveryService.instance = new SchedulerRecoveryService();
    }
    return SchedulerRecoveryService.instance;
  }

  /**
   * Get scheduler database
   */
  private getDb(): Database.Database {
    const manager = getSQLiteManager();
    return manager.getSchedulerDatabase();
  }

  // ============================================
  // Intent Management
  // ============================================

  /**
   * Create execution intent
   */
  public async createIntent(intent: Omit<ExecutionIntent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = this.getDb();
    const id = randomUUID();

    try {
      db.prepare(`
        INSERT INTO scheduler_execution_intents (
          id, scheduler_type, task_id, task_name,
          intended_date, intended_time,
          execution_window_start, execution_window_end,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scheduler_type, task_id, intended_date) DO UPDATE SET
          intended_time = excluded.intended_time,
          execution_window_start = excluded.execution_window_start,
          execution_window_end = excluded.execution_window_end,
          updated_at = datetime('now')
      `).run(
        id,
        intent.schedulerType,
        intent.taskId,
        intent.taskName,
        intent.intendedDate,
        intent.intendedTime,
        intent.executionWindowStart,
        intent.executionWindowEnd,
        intent.status || 'pending'
      );

      return id;
    } catch (error) {
      console.error('[RecoveryService] Failed to create intent:', error);
      throw error;
    }
  }

  /**
   * Bulk create intents (for generating future schedules)
   */
  public async bulkCreateIntents(intents: Array<Omit<ExecutionIntent, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const db = this.getDb();

    try {
      db.transaction(() => {
        for (const intent of intents) {
          const id = randomUUID();
          db.prepare(`
            INSERT INTO scheduler_execution_intents (
              id, scheduler_type, task_id, task_name,
              intended_date, intended_time,
              execution_window_start, execution_window_end,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(scheduler_type, task_id, intended_date) DO NOTHING
          `).run(
            id,
            intent.schedulerType,
            intent.taskId,
            intent.taskName,
            intent.intendedDate,
            intent.intendedTime,
            intent.executionWindowStart,
            intent.executionWindowEnd,
            intent.status || 'pending'
          );
        }
      })();
    } catch (error) {
      console.error('[RecoveryService] Failed to bulk create intents:', error);
      throw error;
    }
  }

  /**
   * Mark intent as running
   */
  public async markIntentRunning(
    schedulerType: string,
    taskId: string,
    intendedDate: string,
    executionId: string
  ): Promise<void> {
    const db = this.getDb();

    db.prepare(`
      UPDATE scheduler_execution_intents
      SET status = 'running',
          actual_execution_id = ?,
          actual_started_at = datetime('now'),
          updated_at = datetime('now')
      WHERE scheduler_type = ?
        AND task_id = ?
        AND intended_date = ?
    `).run(executionId, schedulerType, taskId, intendedDate);
  }

  /**
   * Mark intent as completed
   */
  public async markIntentCompleted(
    schedulerType: string,
    taskId: string,
    intendedDate: string,
    executionId: string
  ): Promise<void> {
    const db = this.getDb();

    db.prepare(`
      UPDATE scheduler_execution_intents
      SET status = 'completed',
          actual_execution_id = ?,
          actual_completed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE scheduler_type = ?
        AND task_id = ?
        AND intended_date = ?
    `).run(executionId, schedulerType, taskId, intendedDate);
  }

  /**
   * Mark intent as failed
   */
  public async markIntentFailed(
    schedulerType: string,
    taskId: string,
    intendedDate: string,
    error: any,
    skipReason?: string
  ): Promise<void> {
    const db = this.getDb();
    const errorMessage = error instanceof Error ? error.message : String(error);

    db.prepare(`
      UPDATE scheduler_execution_intents
      SET status = 'failed',
          error_message = ?,
          skip_reason = ?,
          updated_at = datetime('now')
      WHERE scheduler_type = ?
        AND task_id = ?
        AND intended_date = ?
    `).run(errorMessage, skipReason || null, schedulerType, taskId, intendedDate);
  }

  /**
   * Mark intent as skipped
   */
  public async markIntentSkipped(
    schedulerType: string,
    taskId: string,
    intendedDate: string,
    skipReason: string
  ): Promise<void> {
    const db = this.getDb();

    db.prepare(`
      UPDATE scheduler_execution_intents
      SET status = 'skipped',
          skip_reason = ?,
          updated_at = datetime('now')
      WHERE scheduler_type = ?
        AND task_id = ?
        AND intended_date = ?
    `).run(skipReason, schedulerType, taskId, intendedDate);
  }

  // ============================================
  // Recovery Detection
  // ============================================

  /**
   * Check if task already ran today
   */
  public async hasRunToday(schedulerType: string, taskId: string): Promise<boolean> {
    const db = this.getDb();
    const today = new Date().toISOString().split('T')[0];

    const intent = db.prepare(`
      SELECT * FROM scheduler_execution_intents
      WHERE scheduler_type = ?
        AND task_id = ?
        AND intended_date = ?
        AND status IN ('completed', 'running')
    `).get(schedulerType, taskId, today);

    return !!intent;
  }

  /**
   * Detect missed executions within lookback window
   */
  public async detectMissedExecutions(options: Partial<RecoveryOptions> = {}): Promise<MissedExecution[]> {
    const db = this.getDb();
    const lookbackDays = options.lookbackDays || 3;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Get pending intents where execution window has passed
    let query = `
      SELECT * FROM scheduler_execution_intents
      WHERE status = 'pending'
        AND intended_date >= ?
        AND execution_window_end < ?
      ORDER BY intended_date ASC, intended_time ASC
    `;

    const params: any[] = [cutoffDateStr, new Date().toISOString()];

    // Apply scheduler filter if provided
    if (options.schedulerFilter && options.schedulerFilter.length > 0) {
      const placeholders = options.schedulerFilter.map(() => '?').join(',');
      query = query.replace(
        'WHERE status',
        `WHERE scheduler_type IN (${placeholders}) AND status`
      );
      params.unshift(...options.schedulerFilter);
    }

    const pendingIntents = db.prepare(query).all(...params) as any[];

    // Convert to MissedExecution format (SQLite returns snake_case columns)
    const missedExecutions: MissedExecution[] = pendingIntents.map((intent: any) => {
      const windowEnd = new Date(intent.execution_window_end);
      const now = new Date();
      const daysMissed = Math.floor((now.getTime() - windowEnd.getTime()) / (1000 * 60 * 60 * 24));

      return {
        intentId: intent.id,
        schedulerType: intent.scheduler_type,
        taskId: intent.task_id,
        taskName: intent.task_name,
        intendedDate: intent.intended_date,
        daysMissed,
      };
    });

    return missedExecutions;
  }

  // ============================================
  // Recovery Execution
  // ============================================

  /**
   * Recover missed executions
   */
  public async recoverMissedExecutions(options: Partial<RecoveryOptions> = {}): Promise<RecoveryReport> {
    const defaultOptions: RecoveryOptions = {
      lookbackDays: 3,
      autoExecute: true,
      maxCatchUpExecutions: 3,
      priorityOrder: 'oldest_first',
    };

    const opts = { ...defaultOptions, ...options };

    console.log('[RecoveryService] 🔄 Starting recovery process...');
    console.log('[RecoveryService] Options:', opts);

    // Clean up invalid intents first (e.g., from deleted tasks)
    try {
      await this.cleanupInvalidIntents();
    } catch (error) {
      console.warn('[RecoveryService] Failed to cleanup invalid intents:', error);
    }

    // Detect missed executions
    const missedExecutions = await this.detectMissedExecutions(opts);

    console.log(`[RecoveryService] Found ${missedExecutions.length} missed executions`);

    if (missedExecutions.length === 0) {
      return {
        missedCount: 0,
        executedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        missedExecutions: [],
        executionResults: [],
      };
    }

    // Sort by priority
    const sorted = this.prioritizeTasks(missedExecutions, opts.priorityOrder);

    // Limit executions
    const toExecute = sorted.slice(0, opts.maxCatchUpExecutions);
    const toSkip = sorted.slice(opts.maxCatchUpExecutions);

    console.log(`[RecoveryService] Will execute: ${toExecute.length}, Will skip: ${toSkip.length}`);

    // Mark skipped tasks
    for (const missed of toSkip) {
      await this.markIntentSkipped(
        missed.schedulerType,
        missed.taskId,
        missed.intendedDate,
        'exceeded_max_catchup_executions'
      );
    }

    const executionResults: RecoveryReport['executionResults'] = [];

    // Execute tasks if autoExecute is enabled
    if (opts.autoExecute) {
      for (const missed of toExecute) {
        try {
          console.log(`[RecoveryService] Executing missed task: ${missed.taskName} (${missed.intendedDate})`);
          await this.executeTaskByType(missed);

          executionResults.push({
            intentId: missed.intentId,
            taskName: missed.taskName,
            success: true,
          });
        } catch (error) {
          console.error(`[RecoveryService] Failed to execute ${missed.taskName}:`, error);

          await this.markIntentFailed(
            missed.schedulerType,
            missed.taskId,
            missed.intendedDate,
            error,
            'recovery_execution_failed'
          );

          executionResults.push({
            intentId: missed.intentId,
            taskName: missed.taskName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const report: RecoveryReport = {
      missedCount: missedExecutions.length,
      executedCount: executionResults.filter(r => r.success).length,
      failedCount: executionResults.filter(r => !r.success).length,
      skippedCount: toSkip.length,
      missedExecutions,
      executionResults,
    };

    console.log('[RecoveryService] ✅ Recovery complete:', report);

    return report;
  }

  /**
   * Prioritize tasks for execution
   */
  private prioritizeTasks(tasks: MissedExecution[], order: 'oldest_first' | 'newest_first'): MissedExecution[] {
    // Filter out tasks with invalid dates
    const validTasks = tasks.filter(task => {
      if (!task.intendedDate) {
        console.warn('[RecoveryService] Skipping task with undefined intendedDate:', task.taskName, task.taskId);
        return false;
      }
      return true;
    });

    const sorted = [...validTasks];

    sorted.sort((a, b) => {
      if (order === 'oldest_first') {
        return a.intendedDate.localeCompare(b.intendedDate);
      } else {
        return b.intendedDate.localeCompare(a.intendedDate);
      }
    });

    return sorted;
  }

  /**
   * Execute task based on scheduler type
   */
  private async executeTaskByType(missed: MissedExecution): Promise<void> {
    switch (missed.schedulerType) {
      case 'financehub':
        await this.executeFinanceHubTask(missed);
        break;

      case 'docker':
        await this.executeDockerTask(missed);
        break;

      case 'playwright':
        await this.executePlaywrightTask(missed);
        break;

      case 'scheduled_posts':
        await this.executeScheduledPostTask(missed);
        break;

      default:
        throw new Error(`Unknown scheduler type: ${missed.schedulerType}`);
    }
  }

  /**
   * Execute FinanceHub sync task
   */
  private async executeFinanceHubTask(missed: MissedExecution): Promise<void> {
    const { getFinanceHubScheduler } = await import('../financehub/scheduler/FinanceHubScheduler');
    const scheduler = getFinanceHubScheduler();

    // Trigger manual sync
    await scheduler.syncNow();
  }

  /**
   * Execute Docker task
   */
  private async executeDockerTask(missed: MissedExecution): Promise<void> {
    const { getDockerSchedulerService } = await import('../docker/DockerSchedulerService');
    const service = getDockerSchedulerService();

    if (!service) {
      throw new Error('Docker scheduler service not initialized');
    }

    const result = await service.executeTask(missed.taskId);

    if (!result.success) {
      throw new Error(result.error || 'Docker task execution failed');
    }
  }

  /**
   * Execute Playwright test
   */
  private async executePlaywrightTask(missed: MissedExecution): Promise<void> {
    const { getPlaywrightSchedulerService } = await import('./playwright-scheduler-service');
    const service = getPlaywrightSchedulerService();

    if (!service) {
      throw new Error('Playwright scheduler service not initialized');
    }

    const result = await service.executeTest(missed.taskId);

    if (!result.success) {
      throw new Error(result.error || 'Playwright test execution failed');
    }
  }

  /**
   * Execute scheduled post
   */
  private async executeScheduledPostTask(missed: MissedExecution): Promise<void> {
    const { ScheduledPostsExecutor } = await import('./scheduled-posts-executor');
    const sqliteManager = getSQLiteManager();
    const scheduledPostsManager = sqliteManager.getScheduledPostsManager();

    const scheduledPost = scheduledPostsManager.getScheduledPost(missed.taskId);

    if (!scheduledPost) {
      throw new Error(`Scheduled post not found: ${missed.taskId}`);
    }

    const topics = scheduledPostsManager.getScheduledPostTopics(missed.taskId);
    const topicNames = topics.map(t => t.topicName);

    const executor = new ScheduledPostsExecutor();
    await executor.executeScheduledPost({
      ...scheduledPost,
      topics: topicNames,
    });
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up old intents (retention policy)
   */
  public async cleanupOldIntents(retentionDays: number = 30): Promise<number> {
    const db = this.getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const result = db.prepare(`
      DELETE FROM scheduler_execution_intents
      WHERE intended_date < ?
        AND status IN ('completed', 'failed', 'skipped', 'cancelled')
    `).run(cutoffDateStr);

    console.log(`[RecoveryService] Cleaned up ${result.changes} old intents (older than ${retentionDays} days)`);

    return result.changes;
  }

  /**
   * Clean up invalid or corrupted intents (e.g., from deleted tasks)
   */
  public async cleanupInvalidIntents(): Promise<number> {
    const db = this.getDb();

    // Delete intents with null/undefined critical fields
    const result = db.prepare(`
      DELETE FROM scheduler_execution_intents
      WHERE intended_date IS NULL
        OR task_id IS NULL
        OR scheduler_type IS NULL
    `).run();

    console.log(`[RecoveryService] Cleaned up ${result.changes} invalid intents`);

    return result.changes;
  }
}

// Export singleton getter
export function getSchedulerRecoveryService(): SchedulerRecoveryService {
  return SchedulerRecoveryService.getInstance();
}
