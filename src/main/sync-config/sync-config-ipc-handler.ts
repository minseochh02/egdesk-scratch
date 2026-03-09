import { ipcMain, dialog } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';
import { FileWatcherService } from './file-watcher-service';
import {
  CreateSyncConfigurationData,
  UpdateSyncConfigurationData,
} from './types';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

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

  /**
   * Export all sync configurations
   */
  ipcMain.handle('sync-config:export-all', async () => {
    try {
      console.log('📤 Export all sync configurations');

      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();
      const configs = syncConfigManager.getAllConfigurations();

      if (configs.length === 0) {
        return {
          success: false,
          error: 'No sync configurations available to export',
        };
      }

      // Show save dialog
      const defaultName = `sync-configs-export-${new Date().toISOString().split('T')[0]}.json`;
      const saveResult = await dialog.showSaveDialog({
        title: 'Export Sync Configurations',
        defaultPath: defaultName,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return {
          success: false,
          error: 'Export canceled',
        };
      }

      // Create export data
      const exportData = {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        configCount: configs.length,
        configurations: configs.map(config => ({
          // Core configuration
          scriptName: config.scriptName,
          folderName: config.folderName,
          targetTableId: config.targetTableId,

          // Parsing configuration
          headerRow: config.headerRow,
          skipBottomRows: config.skipBottomRows,
          sheetIndex: config.sheetIndex,

          // Column mappings and transformations
          columnMappings: config.columnMappings,
          appliedSplits: config.appliedSplits,

          // Duplicate detection
          uniqueKeyColumns: config.uniqueKeyColumns,
          duplicateAction: config.duplicateAction,

          // File handling
          fileAction: config.fileAction,

          // Auto-sync settings
          autoSyncEnabled: config.autoSyncEnabled,

          // Note: scriptFolderPath is excluded as it's system-specific
        }))
      };

      // Write to file
      fs.writeFileSync(saveResult.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      console.log(`✅ Exported ${configs.length} sync configurations`);

      return {
        success: true,
        data: {
          filePath: saveResult.filePath,
          configCount: configs.length,
        },
      };
    } catch (error) {
      console.error('Error exporting sync configurations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export configurations',
      };
    }
  });

  /**
   * Import sync configurations
   */
  ipcMain.handle('sync-config:import', async () => {
    try {
      console.log('📥 Import sync configurations');

      // Show open dialog
      const openResult = await dialog.showOpenDialog({
        title: 'Import Sync Configurations',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (openResult.canceled || openResult.filePaths.length === 0) {
        return {
          success: false,
          error: 'Import canceled',
        };
      }

      const importPath = openResult.filePaths[0];

      // Read and parse file
      const fileContent = fs.readFileSync(importPath, 'utf-8');
      let importData: any;

      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        return {
          success: false,
          error: 'Invalid JSON file',
        };
      }

      // Validate import data structure
      if (!importData.configurations || !Array.isArray(importData.configurations)) {
        return {
          success: false,
          error: 'Invalid sync configuration file format',
        };
      }

      const manager = getSQLiteManager();
      const syncConfigManager = manager.getSyncConfigManager();
      const userDataManager = manager.getUserDataManager();

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const configData of importData.configurations) {
        try {
          // Check if table exists
          const targetTable = userDataManager.getTable(configData.targetTableId);
          if (!targetTable) {
            errors.push(`Skipped "${configData.scriptName}": Target table not found`);
            skipped++;
            continue;
          }

          // Since scriptFolderPath is system-specific, we need to ask user or skip
          // For now, we'll skip configs that would need folder selection
          errors.push(`Skipped "${configData.scriptName}": Manual folder selection required (import feature limitation)`);
          skipped++;

          // Future enhancement: Could show a folder picker dialog for each config
          // const folderResult = await dialog.showOpenDialog({
          //   title: `Select folder for "${configData.scriptName}"`,
          //   properties: ['openDirectory']
          // });

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to import "${configData.scriptName}": ${errorMsg}`);
          skipped++;
        }
      }

      console.log(`📥 Import complete: ${imported} imported, ${skipped} skipped`);

      return {
        success: true,
        data: {
          imported,
          skipped,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      console.error('Error importing sync configurations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import configurations',
      };
    }
  });
}
