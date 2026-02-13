import { ipcMain } from 'electron';
import { FileWatcherService } from './file-watcher-service';

/**
 * File Watcher IPC Handlers
 *
 * Handles IPC communication for file watcher control
 */

export function registerFileWatcherIPCHandlers(): void {
  /**
   * Initialize file watcher service
   */
  ipcMain.handle('file-watcher:initialize', async () => {
    try {
      const service = FileWatcherService.getInstance();
      await service.initialize();

      return {
        success: true,
        message: 'File watcher service initialized',
      };
    } catch (error) {
      console.error('Error initializing file watcher:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize file watcher',
      };
    }
  });

  /**
   * Start watching a specific configuration
   */
  ipcMain.handle('file-watcher:start', async (event, configId: string) => {
    try {
      const service = FileWatcherService.getInstance();
      await service.startWatcher(configId);

      return {
        success: true,
        message: `Started watching configuration ${configId}`,
      };
    } catch (error) {
      console.error('Error starting watcher:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start watcher',
      };
    }
  });

  /**
   * Stop watching a specific configuration
   */
  ipcMain.handle('file-watcher:stop', async (event, configId: string) => {
    try {
      const service = FileWatcherService.getInstance();
      service.stopWatcher(configId);

      return {
        success: true,
        message: `Stopped watching configuration ${configId}`,
      };
    } catch (error) {
      console.error('Error stopping watcher:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop watcher',
      };
    }
  });

  /**
   * Get status of all active watchers
   */
  ipcMain.handle('file-watcher:get-status', async () => {
    try {
      const service = FileWatcherService.getInstance();
      const status = service.getWatcherStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      console.error('Error getting watcher status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get watcher status',
      };
    }
  });

  /**
   * Stop all watchers
   */
  ipcMain.handle('file-watcher:stop-all', async () => {
    try {
      const service = FileWatcherService.getInstance();
      service.stopAllWatchers();

      return {
        success: true,
        message: 'All watchers stopped',
      };
    } catch (error) {
      console.error('Error stopping all watchers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop watchers',
      };
    }
  });
}
