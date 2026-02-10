import { ipcMain } from 'electron';
import { getFinanceHubScheduler } from './FinanceHubScheduler';

export function registerFinanceHubSchedulerHandlers(): void {
  const scheduler = getFinanceHubScheduler();

  // Get scheduler settings
  ipcMain.handle('finance-hub:scheduler:get-settings', async () => {
    try {
      return {
        success: true,
        settings: scheduler.getSettings(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings',
      };
    }
  });

  // Update scheduler settings
  ipcMain.handle('finance-hub:scheduler:update-settings', async (event, settings) => {
    try {
      await scheduler.updateSettings(settings);
      return {
        success: true,
        settings: scheduler.getSettings(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings',
      };
    }
  });

  // Start scheduler
  ipcMain.handle('finance-hub:scheduler:start', async () => {
    try {
      await scheduler.start();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start scheduler',
      };
    }
  });

  // Stop scheduler
  ipcMain.handle('finance-hub:scheduler:stop', async () => {
    try {
      await scheduler.stop();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop scheduler',
      };
    }
  });

  // Trigger manual sync
  ipcMain.handle('finance-hub:scheduler:sync-now', async () => {
    try {
      await scheduler.syncNow();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Manual sync failed',
      };
    }
  });

  // Get last sync info
  ipcMain.handle('finance-hub:scheduler:last-sync-info', async () => {
    try {
      return {
        success: true,
        ...scheduler.getLastSyncInfo(),
        isSyncing: scheduler.isSyncInProgress(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync info',
      };
    }
  });

  // Set up event forwarding to all renderer windows
  const { BrowserWindow } = require('electron');
  
  scheduler.on('sync-started', () => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('finance-hub:scheduler:sync-started');
    });
  });

  scheduler.on('sync-completed', (data) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('finance-hub:scheduler:sync-completed', data);
    });
  });

  scheduler.on('sync-failed', (error) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('finance-hub:scheduler:sync-failed', { error: error?.message || error });
    });
  });

  scheduler.on('settings-updated', (settings) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('finance-hub:scheduler:settings-updated', settings);
    });
  });

  // Get debug log
  ipcMain.handle('finance-hub:scheduler:get-debug-log', async () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const { app } = require('electron');

      const logDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'logs')
        : path.join(process.cwd(), 'logs');

      const logPath = path.join(logDir, 'scheduler-debug.log');

      if (!fs.existsSync(logPath)) {
        return {
          success: true,
          log: 'No debug log found (scheduler not started yet)',
          path: logPath,
        };
      }

      // Read last 500 lines
      const log = fs.readFileSync(logPath, 'utf-8');
      const lines = log.split('\n');
      const last500 = lines.slice(-500).join('\n');

      return {
        success: true,
        log: last500,
        path: logPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get debug log',
      };
    }
  });

  console.log('✅ Finance Hub scheduler IPC handlers registered');
}