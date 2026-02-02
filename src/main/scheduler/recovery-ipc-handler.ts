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

  console.log('✅ Scheduler recovery IPC handlers registered');
}
