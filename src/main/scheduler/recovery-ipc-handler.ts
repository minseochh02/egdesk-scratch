import { ipcMain } from 'electron';
import { getSchedulerRecoveryService } from './recovery-service';

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
      const today = now.toISOString().split('T')[0];

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
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

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
          AND COALESCE(retry_count, 0) < 5
        ORDER BY intended_date ASC, intended_time ASC
      `).all(cutoffDateStr, now.toISOString());

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

  console.log('✅ Scheduler recovery IPC handlers registered');
}
