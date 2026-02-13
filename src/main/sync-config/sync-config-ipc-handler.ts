import { ipcMain } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';
import { FileWatcherService } from './file-watcher-service';
import {
  CreateSyncConfigurationData,
  UpdateSyncConfigurationData,
} from './types';

/**
 * Sync Configuration IPC Handlers
 *
 * Handles IPC communication for sync configuration management
 */

export function registerSyncConfigIPCHandlers(): void {
  /**
   * Create a new sync configuration
   */
  ipcMain.handle('sync-config:create', async (event, data: CreateSyncConfigurationData) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();
      const userDataManager = manager.getUserDataManager();

      // Check if configuration already exists for this folder
      const existing = syncConfigManager.getConfigurationByFolder(data.scriptFolderPath);
      if (existing) {
        return {
          success: false,
          error: `Configuration already exists for this script: ${existing.scriptName}`,
        };
      }

      // Get target table to inherit duplicate detection settings
      const targetTable = userDataManager.getTable(data.targetTableId);
      if (!targetTable) {
        return {
          success: false,
          error: 'Target table not found',
        };
      }

      // Inherit duplicate detection settings from table if not explicitly provided
      const configData: CreateSyncConfigurationData = {
        ...data,
        uniqueKeyColumns: data.uniqueKeyColumns || 
          (targetTable.uniqueKeyColumns ? JSON.parse(targetTable.uniqueKeyColumns) : undefined),
        duplicateAction: data.duplicateAction || targetTable.duplicateAction || 'skip',
      };

      console.log('Creating sync config with duplicate detection:', {
        uniqueKeyColumns: configData.uniqueKeyColumns,
        duplicateAction: configData.duplicateAction,
      });

      const config = syncConfigManager.createConfiguration(configData);

      // If auto-sync is enabled, start watcher
      if (config.autoSyncEnabled && config.enabled) {
        try {
          const fileWatcherService = FileWatcherService.getInstance();
          await fileWatcherService.startWatcher(config.id);
        } catch (error) {
          console.warn('Failed to start watcher for new config:', error);
          // Don't fail the creation if watcher fails
        }
      }

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Error creating sync configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create configuration',
      };
    }
  });

  /**
   * Get all sync configurations
   */
  ipcMain.handle('sync-config:get-all', async () => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const configs = syncConfigManager.getAllConfigurations();

      return {
        success: true,
        data: configs,
      };
    } catch (error) {
      console.error('Error getting sync configurations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get configurations',
      };
    }
  });

  /**
   * Get a specific sync configuration
   */
  ipcMain.handle('sync-config:get', async (event, configId: string) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const config = syncConfigManager.getConfiguration(configId);

      if (!config) {
        return {
          success: false,
          error: 'Configuration not found',
        };
      }

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Error getting sync configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get configuration',
      };
    }
  });

  /**
   * Get configuration by folder path
   */
  ipcMain.handle('sync-config:get-by-folder', async (event, scriptFolderPath: string) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const config = syncConfigManager.getConfigurationByFolder(scriptFolderPath);

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      console.error('Error getting sync configuration by folder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get configuration',
      };
    }
  });

  /**
   * Update a sync configuration
   */
  ipcMain.handle('sync-config:update', async (event, configId: string, data: UpdateSyncConfigurationData) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const oldConfig = syncConfigManager.getConfiguration(configId);
      if (!oldConfig) {
        return {
          success: false,
          error: 'Configuration not found',
        };
      }

      const success = syncConfigManager.updateConfiguration(configId, data);

      if (!success) {
        return {
          success: false,
          error: 'Failed to update configuration',
        };
      }

      const updatedConfig = syncConfigManager.getConfiguration(configId);
      if (!updatedConfig) {
        return {
          success: false,
          error: 'Configuration not found after update',
        };
      }

      // Handle watcher lifecycle based on changes
      const fileWatcherService = FileWatcherService.getInstance();

      const wasAutoSyncEnabled = oldConfig.enabled && oldConfig.autoSyncEnabled;
      const isAutoSyncEnabled = updatedConfig.enabled && updatedConfig.autoSyncEnabled;

      if (wasAutoSyncEnabled && !isAutoSyncEnabled) {
        // Auto-sync was disabled, stop watcher
        try {
          fileWatcherService.stopWatcher(configId);
        } catch (error) {
          console.warn('Failed to stop watcher:', error);
        }
      } else if (!wasAutoSyncEnabled && isAutoSyncEnabled) {
        // Auto-sync was enabled, start watcher
        try {
          await fileWatcherService.startWatcher(configId);
        } catch (error) {
          console.warn('Failed to start watcher:', error);
        }
      }

      return {
        success: true,
        data: updatedConfig,
      };
    } catch (error) {
      console.error('Error updating sync configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update configuration',
      };
    }
  });

  /**
   * Delete a sync configuration
   */
  ipcMain.handle('sync-config:delete', async (event, configId: string) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      // Stop watcher if running
      const fileWatcherService = FileWatcherService.getInstance();
      try {
        fileWatcherService.stopWatcher(configId);
      } catch (error) {
        console.warn('Failed to stop watcher during deletion:', error);
      }

      const success = syncConfigManager.deleteConfiguration(configId);

      if (!success) {
        return {
          success: false,
          error: 'Configuration not found',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting sync configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete configuration',
      };
    }
  });

  /**
   * Get activity logs for a configuration
   */
  ipcMain.handle('sync-config:get-activity', async (event, configId: string, limit?: number) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const logs = syncConfigManager.getActivityLogs(configId, limit);

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      console.error('Error getting activity logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity logs',
      };
    }
  });

  /**
   * Get recent activity logs
   */
  ipcMain.handle('sync-config:get-recent-activity', async (event, limit?: number) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const logs = syncConfigManager.getRecentActivityLogs(limit);

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      console.error('Error getting recent activity logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity logs',
      };
    }
  });

  /**
   * Get configuration statistics
   */
  ipcMain.handle('sync-config:get-stats', async (event, configId: string) => {
    try {
      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();

      const stats = syncConfigManager.getConfigurationStats(configId);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error getting configuration stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      };
    }
  });
}
