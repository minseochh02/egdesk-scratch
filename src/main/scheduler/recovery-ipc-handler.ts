import { ipcMain } from 'electron';
import { formatLocalDateString, getSchedulerRecoveryService, resolveMaxIntentRetries } from './recovery-service';

/**
 * Register IPC handlers for scheduler recovery system
 */
export function registerSchedulerRecoveryHandlers(): void {
  // Get missed executions
  ipcMain.handle('scheduler-recovery-get-missed', async (event, options) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const missedExecutions = await recoveryService.detectMissedExecutions(options);

      return { success: true, data: missedExecutions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Execute recovery
  ipcMain.handle('scheduler-recovery-execute', async (event, options) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const report = await recoveryService.recoverMissedExecutions(options);

      return { success: true, data: report };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Check if task ran today
  ipcMain.handle('scheduler-recovery-has-run-today', async (event, schedulerType, taskId) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const hasRun = await recoveryService.hasRunToday(schedulerType, taskId);

      return { success: true, data: hasRun };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Clean up old intents
  ipcMain.handle('scheduler-recovery-cleanup', async (event, retentionDays) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const deletedCount = await recoveryService.cleanupOldIntents(retentionDays);

      return { success: true, data: deletedCount };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Cancel a task
  ipcMain.handle('scheduler-recovery-cancel-task', async (event, schedulerType, taskId, intendedDate) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      await recoveryService.markIntentCancelled(schedulerType, taskId, intendedDate);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get diagnostic information
  ipcMain.handle('scheduler-recovery-diagnostics', async () => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const db = recoveryService['getDb']();
      const now = new Date();
      const today = formatLocalDateString(now);
      const maxIntentRetries = resolveMaxIntentRetries();

      // Get today's tasks
      const todayTasks = db.prepare(`
        SELECT
          task_id,
          intended_date,
          intended_time,
          status,
          execution_window_start,
          execution_window_end,
          retry_count,
          error_message,
          actual_started_at,
          actual_completed_at
        FROM scheduler_execution_intents
        WHERE intended_date = ?
        ORDER BY intended_time
      `).all(today);

      // Get missed tasks eligible for recovery
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 3);
      const cutoffDateStr = formatLocalDateString(cutoffDate);

      const missedTasks = db.prepare(`
        SELECT
          task_id,
          intended_date,
          intended_time,
          status,
          execution_window_end,
          retry_count,
          error_message
        FROM scheduler_execution_intents
        WHERE status IN ('pending', 'failed')
          AND intended_date >= ?
          AND execution_window_end < ?
          AND COALESCE(retry_count, 0) < ?
        ORDER BY intended_date ASC, intended_time ASC
      `).all(cutoffDateStr, now.toISOString(), maxIntentRetries);

      // Get stuck running tasks
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const stuckTasks = db.prepare(`
        SELECT
          task_id,
          intended_date,
          actual_started_at,
          error_message
        FROM scheduler_execution_intents
        WHERE status = 'running'
          AND actual_started_at < ?
      `).all(oneHourAgo);

      return {
        success: true,
        data: {
          currentTime: now.toISOString(),
          today: today,
          todayTasks: todayTasks,
          missedTasks: missedTasks,
          stuckTasks: stuckTasks,
          maxIntentRetries,
          totalIntentsInDb: db.prepare('SELECT COUNT(*) as count FROM scheduler_execution_intents').get(),
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Debug: Reset completed tasks to pending for testing
  ipcMain.handle('scheduler-recovery-debug-reset', async (event, options) => {
    try {
      const recoveryService = getSchedulerRecoveryService();
      const db = recoveryService['getDb']();

      const lookbackDays = options?.lookbackDays || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
      const cutoffDateStr = formatLocalDateString(cutoffDate);

      const result = db.prepare(`
        UPDATE scheduler_execution_intents
        SET status = 'pending',
            retry_count = 0,
            error_message = NULL,
            actual_execution_id = NULL,
            actual_started_at = NULL,
            actual_completed_at = NULL,
            updated_at = datetime('now', 'localtime')
        WHERE intended_date >= ?
          AND status IN ('completed', 'failed')
          ${options?.schedulerType ? 'AND scheduler_type = ?' : ''}
      `).run(options?.schedulerType ? [cutoffDateStr, options.schedulerType] : [cutoffDateStr]);

      console.log(`[RecoveryService] 🐛 DEBUG: Reset ${result.changes} task(s) to pending`);

      return {
        success: true,
        data: { resetCount: result.changes }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Debug: Create a new intent for a specific task/date
  ipcMain.handle('scheduler-recovery-debug-create-intent', async (event, options) => {
    try {
      const recoveryService = getSchedulerRecoveryService();

      const {
        schedulerType = 'financehub',
        taskId,
        taskName,
        intendedDate, // YYYY-MM-DD, defaults to tomorrow
        intendedTime = '09:00',
      } = options;

      if (!taskId || !taskName) {
        return {
          success: false,
          error: 'taskId and taskName are required'
        };
      }

      // Default to tomorrow if no date provided
      let targetDate = intendedDate;
      if (!targetDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetDate = tomorrow.toISOString().split('T')[0];
      }

      // Create execution window (24 hours starting from intended time)
      const windowStart = new Date(`${targetDate}T${intendedTime}:00`);
      const windowEnd = new Date(windowStart);
      windowEnd.setHours(windowEnd.getHours() + 24);

      const intentId = await recoveryService.createIntent({
        schedulerType,
        taskId,
        taskName,
        intendedDate: targetDate,
        intendedTime,
        executionWindowStart: windowStart.toISOString(),
        executionWindowEnd: windowEnd.toISOString(),
        status: 'pending',
      });

      console.log(`[RecoveryService] 🐛 DEBUG: Created intent ${intentId} for ${taskId} on ${targetDate}`);

      return {
        success: true,
        data: {
          intentId,
          schedulerType,
          taskId,
          taskName,
          intendedDate: targetDate,
          intendedTime,
          executionWindowStart: windowStart.toISOString(),
          executionWindowEnd: windowEnd.toISOString(),
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  console.log('✅ Scheduler recovery IPC handlers registered');
}
