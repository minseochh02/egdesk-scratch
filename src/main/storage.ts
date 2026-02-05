/* eslint global-require: off, no-console: off, promise/always-return: off */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ipcMain } from 'electron';
import { insertPhoto, removePhoto } from './ai-code/tools/insert-photo';

// Dynamic import for electron-store to avoid CommonJS/ESM issues
let Store: any;

// Store will be initialized in createWindow function
let store: any;

export function initializeStore(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      Store = (await import('electron-store')).default;
      store = new Store({
        encryptionKey: 'your-encryption-key-here', // 실제 프로덕션에서는 환경변수에서 가져와야 함
        defaults: {
          wordpressConnections: [],
          syncHistory: [],
          userPreferences: {
            theme: 'light',
            language: 'ko',
            defaultSyncPath: '',
            autoSync: false,
          },
          scheduledTasks: [],
          taskExecutions: [],
          // smartProjectContext: Reserved for upcoming automatic project analysis cache
          // This will store summarized/derived project insights keyed by project id/path
          // Example shape (planned): { [projectId]: { lastAnalyzedAt, summary, features, risks, todos } }
          smartProjectContext: {},
          // MCP Configuration: Store for Model Context Protocol server configurations
          mcpConfiguration: {
            // Gmail MCP servers (existing)
            servers: [],
            connections: [],
            
            // Local MCP server configuration
            serverName: '',  // e.g., "mcp-server-a7f3k2"
            
            // Tunnel configuration
            tunnel: {
              registered: false,
              registrationId: '',
              serverName: '',
              publicUrl: '',
              registeredAt: '',
              lastConnectedAt: '',
            },
            
            // HTTP server settings
            httpServer: {
              enabled: false,
              port: 8080,
              lastStartedAt: '',
            },
            
          // General settings
          settings: {
            autoStart: false,
            defaultPort: 8080,
            enableLogging: true,
            logLevel: 'info',
          },
          // Finance Hub: Bank credentials and settings
          financeHub: {
            savedCredentials: {}, // { bankId: { userId, password } }
            connectedBanks: [],
            arduinoPort: 'COM3', // Default Arduino HID keyboard port
            persistentSpreadsheet: {
              spreadsheetId: null, // Google Sheets ID for persistent transactions spreadsheet
              lastUpdated: null,
              title: null,
              spreadsheetUrl: null,
            },
          },
        },
        // MCP Servers list
        mcpServers: [
          {
            name: 'gmail',
            enabled: false,
            description: 'Gmail MCP Server - Access Gmail data from Google Workspace'
          },
          {
            name: 'filesystem',
            enabled: true,
            description: 'File System MCP Server - Access files and directories with security controls'
          },
          {
            name: 'file-conversion',
            enabled: true,
            description: 'File Conversion MCP Server - Convert between file formats (PDF, images, documents)'
          },
          {
            name: 'apps-script',
            enabled: true,
            description: 'Apps Script MCP Server - Virtual Filesystem for editing Google Apps Script projects'
          }
        ],
      },
    });
      
      // Migrations: Add filesystem and file-conversion servers to existing stores
      migrateFilesystemServer();
      migrateFileConversionServer();
      migrateAppsScriptServer();
      migrateFinanceHub();
      migrateFinanceHubScheduler();
      
      resolve();
    } catch (error) {
      console.error('Failed to initialize Electron Store:', error);
      reject(error);
    }
  });
}

/**
 * Migration: Add filesystem server to existing stores if not present
 */
function migrateFilesystemServer() {
  try {
    const mcpServers = store.get('mcpServers', []) as any[];
    
    // Check if filesystem server already exists
    const hasFilesystem = mcpServers.some(server => server.name === 'filesystem');
    
    if (!hasFilesystem) {
      console.log('🔄 Migrating: Adding filesystem server to MCP servers list');
      
      // Add filesystem server
      mcpServers.push({
        name: 'filesystem',
        enabled: true,
        description: 'File System MCP Server - Access files and directories with security controls'
      });
      
      store.set('mcpServers', mcpServers);
      console.log('✅ Filesystem server added to MCP servers list');
    }
  } catch (error) {
    console.error('Error during filesystem server migration:', error);
  }
}

/**
 * Migration: Add file-conversion server to existing stores if not present
 */
function migrateFileConversionServer() {
  try {
    const mcpServers = store.get('mcpServers', []) as any[];
    
    // Check if file-conversion server already exists
    const hasFileConversion = mcpServers.some(server => server.name === 'file-conversion');
    
    if (!hasFileConversion) {
      console.log('🔄 Migrating: Adding file-conversion server to MCP servers list');
      
      // Add file-conversion server
      mcpServers.push({
        name: 'file-conversion',
        enabled: true,
        description: 'File Conversion MCP Server - Convert between file formats (PDF, images, documents)'
      });
      
      store.set('mcpServers', mcpServers);
      console.log('✅ File-conversion server added to MCP servers list');
    }
  } catch (error) {
    console.error('Error during file-conversion server migration:', error);
  }
}

/**
 * Migration: Add apps-script server to existing stores if not present
 */
function migrateAppsScriptServer() {
  try {
    const mcpServers = store.get('mcpServers', []) as any[];
    
    // Check if apps-script server already exists
    const hasAppsScript = mcpServers.some(server => server.name === 'apps-script');
    
    if (!hasAppsScript) {
      console.log('🔄 Migrating: Adding apps-script server to MCP servers list');
      
      // Add apps-script server
      mcpServers.push({
        name: 'apps-script',
        enabled: true,
        description: 'Apps Script MCP Server - Virtual Filesystem for editing Google Apps Script projects'
      });
      
      store.set('mcpServers', mcpServers);
      console.log('✅ Apps-script server added to MCP servers list');
    }
  } catch (error) {
    console.error('Error during apps-script server migration:', error);
  }
}

/**
 * Migration: Add financeHub to existing stores if not present
 */
function migrateFinanceHub() {
  try {
    const fhConfig = store.get('financeHub');
    
    if (!fhConfig) {
      console.log('🔄 Migrating: Adding financeHub to store');
      store.set('financeHub', {
        savedCredentials: {},
        connectedBanks: [],
        persistentSpreadsheet: {
          spreadsheetId: null,
          lastUpdated: null,
          title: null,
          spreadsheetUrl: null,
        },
      });
      console.log('✅ financeHub added to store');
    } else if (!fhConfig.persistentSpreadsheet) {
      console.log('🔄 Migrating: Adding persistentSpreadsheet to financeHub');
      fhConfig.persistentSpreadsheet = {
        spreadsheetId: null,
        lastUpdated: null,
        title: null,
        spreadsheetUrl: null,
      };
      store.set('financeHub', fhConfig);
      console.log('✅ persistentSpreadsheet added to financeHub');
    }
  } catch (error) {
    console.error('Error during financeHub migration:', error);
  }
}

/**
 * Migration: Add financeHubScheduler with default enabled state and individual entity schedules
 */
function migrateFinanceHubScheduler() {
  try {
    const schedulerConfig = store.get('financeHubScheduler') as any;

    // If scheduler config doesn't exist, create it with defaults
    if (!schedulerConfig) {
      console.log('🔄 Migrating: Adding financeHubScheduler to store with individual entity schedules');
      store.set('financeHubScheduler', {
        enabled: true,
        retryCount: 3,
        retryDelayMinutes: 5,
        spreadsheetSyncEnabled: true,

        // Cards: 4:00 - 5:10 (10-minute intervals)
        cards: {
          bc: { enabled: true, time: '04:00' },
          hana: { enabled: true, time: '04:10' },
          hyundai: { enabled: true, time: '04:20' },
          kb: { enabled: true, time: '04:30' },
          lotte: { enabled: true, time: '04:40' },
          nh: { enabled: true, time: '04:50' },
          samsung: { enabled: true, time: '05:00' },
          shinhan: { enabled: true, time: '05:10' },
        },

        // Banks: 5:20 - 5:50 (10-minute intervals)
        banks: {
          kookmin: { enabled: true, time: '05:20' },
          nh: { enabled: true, time: '05:30' },
          nhBusiness: { enabled: true, time: '05:40' },
          shinhan: { enabled: true, time: '05:50' },
        },

        // Tax: Dynamic based on saved businesses (will be populated when businesses are added)
        tax: {},
      });
      console.log('✅ financeHubScheduler added to store with staggered entity schedules');
    } else if (schedulerConfig.enabled === undefined) {
      // If config exists but enabled is not set, default to true
      console.log('🔄 Migrating: Setting financeHubScheduler enabled to true');
      store.set('financeHubScheduler.enabled', true);
      console.log('✅ financeHubScheduler enabled set to true');
    } else if (!schedulerConfig.cards || !schedulerConfig.banks) {
      // Migrate old single-time config to new entity-based config
      console.log('🔄 Migrating: Converting old scheduler config to new entity-based config');

      const newConfig = {
        ...schedulerConfig,
        cards: schedulerConfig.cards || {
          bc: { enabled: true, time: '04:00' },
          hana: { enabled: true, time: '04:10' },
          hyundai: { enabled: true, time: '04:20' },
          kb: { enabled: true, time: '04:30' },
          lotte: { enabled: true, time: '04:40' },
          nh: { enabled: true, time: '04:50' },
          samsung: { enabled: true, time: '05:00' },
          shinhan: { enabled: true, time: '05:10' },
        },
        banks: schedulerConfig.banks || {
          kookmin: { enabled: true, time: '05:20' },
          nh: { enabled: true, time: '05:30' },
          nhBusiness: { enabled: true, time: '05:40' },
          shinhan: { enabled: true, time: '05:50' },
        },
        tax: schedulerConfig.tax || {},
      };

      // Remove old 'time' and 'includeTaxSync' fields if they exist
      delete (newConfig as any).time;
      delete (newConfig as any).includeTaxSync;

      store.set('financeHubScheduler', newConfig);
      console.log('✅ Scheduler config migrated to new entity-based structure');
    }

    // Auto-populate tax schedules from saved Hometax certificates
    const hometaxConfig = store.get('hometax') as any;
    if (hometaxConfig && hometaxConfig.selectedCertificates) {
      const currentScheduler = store.get('financeHubScheduler') as any;
      const taxSchedules = currentScheduler.tax || {};
      const businessNumbers = Object.keys(hometaxConfig.selectedCertificates);

      let updated = false;
      businessNumbers.forEach((businessNumber, index) => {
        if (!taxSchedules[businessNumber]) {
          // Assign time starting at 6:00am with 10-minute intervals
          const hour = 6 + Math.floor((index * 10) / 60);
          const minute = (index * 10) % 60;
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

          taxSchedules[businessNumber] = {
            enabled: true,
            time,
          };
          updated = true;
        }
      });

      if (updated) {
        currentScheduler.tax = taxSchedules;
        store.set('financeHubScheduler', currentScheduler);
        console.log(`✅ Auto-populated tax schedules for ${businessNumbers.length} businesses`);
      }
    }
  } catch (error) {
    console.error('Error during financeHubScheduler migration:', error);
  }
}

export function getStore() {
  return store;
}


// Debug IPC handlers
ipcMain.handle('debug-get-store-info', async () => {
  try {
    if (!store) {
      return {
        success: false,
        error: 'Store not initialized',
        available: false,
        path: '',
        size: 0,
        writable: false
      };
    }

    const storePath = store.path;
    const fs = require('fs');
    
    let size = 0;
    let writable = false;
    let error = undefined;

    try {
      const stats = fs.statSync(storePath);
      size = stats.size;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    try {
      fs.accessSync(storePath, fs.constants.W_OK);
      writable = true;
    } catch (e) {
      writable = false;
    }

    return {
      success: true,
      available: true,
      path: storePath,
      size,
      writable,
      error
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      available: false,
      path: '',
      size: 0,
      writable: false
    };
  }
});

ipcMain.handle('debug-get-filesystem-info', async () => {
  try {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    const tempDir = os.tmpdir();
    const userDataDir = require('electron').app.getPath('userData');
    
    let writable = false;
    let error = undefined;

    try {
      const testFile = path.join(tempDir, 'egdesk-debug-test.txt');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      writable = true;
    } catch (e) {
      writable = false;
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    return {
      success: true,
      tempDir,
      userDataDir,
      writable,
      error
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tempDir: '',
      userDataDir: '',
      writable: false
    };
  }
});

ipcMain.handle('debug-get-disk-space', async () => {
  try {
    const os = require('os');
    const fs = require('fs');
    
    const homeDir = os.homedir();
    const stats = fs.statSync(homeDir);
    
    // This is a simplified version - in production you might want to use a proper disk space library
    return {
      success: true,
      homeDir,
      available: true // Simplified - would need proper disk space calculation
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      homeDir: '',
      available: false
    };
  }
});

// User preferences IPC handlers
ipcMain.handle('prefs-get', async () => {
  try {
    const preferences = store.get('userPreferences');
    return { success: true, preferences };
  } catch (error) {
    console.error('Error getting preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('prefs-set', async (event, preferences) => {
  try {
    store.set('userPreferences', preferences);
    return { success: true };
  } catch (error) {
    console.error('Error setting preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Sync history management IPC handlers
ipcMain.handle('sync-save-history', async (event, syncData) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];

    // Add new sync record
    const newSyncRecord = {
      id: Date.now().toString(),
      connectionId: syncData.connectionId,
      connectionName: syncData.connectionName,
      syncPath: syncData.syncPath,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'in_progress',
      totalFiles: syncData.totalFiles,
      syncedFiles: 0,
      failedFiles: 0,
      fileDetails: [],
      errors: [],
    };

    syncHistory.push(newSyncRecord);
    store.set('syncHistory', syncHistory);
    return { success: true, syncRecord: newSyncRecord };
  } catch (error) {
    console.error('Error saving sync history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('sync-update-progress', async (event, syncId, progressData) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    const syncIndex = syncHistory.findIndex((record) => record.id === syncId);

    if (syncIndex >= 0) {
      syncHistory[syncIndex] = {
        ...syncHistory[syncIndex],
        ...progressData,
        updatedAt: new Date().toISOString(),
      };

      store.set('syncHistory', syncHistory);
      return { success: true, syncRecord: syncHistory[syncIndex] };
    }
    return { success: false, error: 'Sync record not found' };
  } catch (error) {
    console.error('Error updating sync progress:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('sync-complete', async (event, syncId, completionData) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    const syncIndex = syncHistory.findIndex((record) => record.id === syncId);

    if (syncIndex >= 0) {
      syncHistory[syncIndex] = {
        ...syncHistory[syncIndex],
        ...completionData,
        completedAt: new Date().toISOString(),
        status: 'completed',
        updatedAt: new Date().toISOString(),
      };

      store.set('syncHistory', syncHistory);
      return { success: true, syncRecord: syncHistory[syncIndex] };
    }
    return { success: false, error: 'Sync record not found' };
  } catch (error) {
    console.error('Error completing sync:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('sync-get-history', async (event, connectionId) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];

    if (connectionId) {
      // Filter by specific connection
      const filteredHistory = syncHistory.filter(
        (record) => record.connectionId === connectionId,
      );
      return { success: true, syncHistory: filteredHistory };
    }
    // Return all sync history
    return { success: true, syncHistory };
  } catch (error) {
    console.error('Error getting sync history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle(
  'sync-get-file-status',
  async (event, connectionId, filePath) => {
    try {
      const syncHistory = store.get('syncHistory', []) as any[];

      // Find the most recent successful sync for this connection
      const recentSync = syncHistory
        .filter(
          (record) =>
            record.connectionId === connectionId &&
            record.status === 'completed',
        )
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime(),
        )[0];

      if (recentSync) {
        const fileDetail = recentSync.fileDetails.find(
          (file: any) => file.path === filePath,
        );
        return {
          success: true,
          fileStatus: fileDetail || null,
          lastSync: recentSync.completedAt,
          syncPath: recentSync.syncPath,
        };
      }
      return { success: false, error: 'No sync history found' };
    } catch (error) {
      console.error('Error getting file sync status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
);

ipcMain.handle('sync-clear-history', async (event, connectionId) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];

    if (connectionId) {
      // Clear history for specific connection
      const filteredHistory = syncHistory.filter(
        (record) => record.connectionId !== connectionId,
      );
      store.set('syncHistory', filteredHistory);
      return { success: true, syncHistory: filteredHistory };
    }
    // Clear all sync history
    store.set('syncHistory', []);
    return { success: true, syncHistory: [] };
  } catch (error) {
    console.error('Error clearing sync history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Store IPC handlers for AI Keys
ipcMain.handle('store-get', async (event, key: string) => {
  try {
    return store.get(key);
  } catch (error) {
    console.error('Error getting store value:', error);
    throw error;
  }
});

ipcMain.handle('store-set', async (event, key: string, value: any) => {
  try {
    store.set(key, value);
  } catch (error) {
    console.error('Error setting store value:', error);
    throw error;
  }
});

ipcMain.handle('store-delete', async (event, key: string) => {
  try {
    store.delete(key);
  } catch (error) {
    console.error('Error deleting store value:', error);
    throw error;
  }
});

// ========================================================================
// MCP CONFIGURATION HANDLERS
// ========================================================================

/**
 * Get MCP configuration
 */
ipcMain.handle('mcp-config-get', async () => {
  try {
    const config = store.get('mcpConfiguration');
    return { success: true, config };
  } catch (error) {
    console.error('Error getting MCP configuration:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Update MCP configuration
 */
ipcMain.handle('mcp-config-set', async (event, config: any) => {
  try {
    store.set('mcpConfiguration', config);
    return { success: true };
  } catch (error) {
    console.error('Error setting MCP configuration:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Add MCP server
 */
ipcMain.handle('mcp-server-add', async (event, server: any) => {
  try {
    const config = store.get('mcpConfiguration');
    const newServer = {
      id: `mcp-server-${Date.now()}`,
      ...server,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    config.servers.push(newServer);
    store.set('mcpConfiguration', config);
    return { success: true, server: newServer };
  } catch (error) {
    console.error('Error adding MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Update MCP server
 */
ipcMain.handle('mcp-server-update', async (event, serverId: string, updates: any) => {
  try {
    const config = store.get('mcpConfiguration');
    const serverIndex = config.servers.findIndex((s: any) => s.id === serverId);
    if (serverIndex === -1) {
      return { success: false, error: 'Server not found' };
    }
    config.servers[serverIndex] = {
      ...config.servers[serverIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    store.set('mcpConfiguration', config);
    return { success: true, server: config.servers[serverIndex] };
  } catch (error) {
    console.error('Error updating MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Remove MCP server
 */
ipcMain.handle('mcp-server-remove', async (event, serverId: string) => {
  try {
    const config = store.get('mcpConfiguration');
    config.servers = config.servers.filter((s: any) => s.id !== serverId);
    store.set('mcpConfiguration', config);
    return { success: true };
  } catch (error) {
    console.error('Error removing MCP server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Add MCP connection
 */
ipcMain.handle('mcp-connection-add', async (event, connection: any) => {
  try {
    const config = store.get('mcpConfiguration');
    const newConnection = {
      ...connection,
      id: connection.id || `mcp-connection-${Date.now()}`,
      createdAt: connection.createdAt || new Date().toISOString(),
      updatedAt: connection.updatedAt || new Date().toISOString(),
    };
    config.connections.push(newConnection);
    store.set('mcpConfiguration', config);
    return { success: true, connection: newConnection };
  } catch (error) {
    console.error('Error adding MCP connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Update MCP connection
 */
ipcMain.handle('mcp-connection-update', async (event, connectionId: string, updates: any) => {
  try {
    const config = store.get('mcpConfiguration');
    const connectionIndex = config.connections.findIndex((c: any) => c.id === connectionId);
    if (connectionIndex === -1) {
      return { success: false, error: 'Connection not found' };
    }
    config.connections[connectionIndex] = {
      ...config.connections[connectionIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    store.set('mcpConfiguration', config);
    return { success: true, connection: config.connections[connectionIndex] };
  } catch (error) {
    console.error('Error updating MCP connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Remove MCP connection
 */
ipcMain.handle('mcp-connection-remove', async (event, connectionId: string) => {
  try {
    const config = store.get('mcpConfiguration');
    config.connections = config.connections.filter((c: any) => c.id !== connectionId);
    store.set('mcpConfiguration', config);
    return { success: true };
  } catch (error) {
    console.error('Error removing MCP connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get MCP servers
 */
ipcMain.handle('mcp-servers-get', async () => {
  try {
    const config = store.get('mcpConfiguration');
    return { success: true, servers: config.servers };
  } catch (error) {
    console.error('Error getting MCP servers:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get MCP connections
 */
ipcMain.handle('mcp-connections-get', async () => {
  try {
    const config = store.get('mcpConfiguration');
    return { success: true, connections: config.connections };
  } catch (error) {
    console.error('Error getting MCP connections:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Clear all MCP configuration
 */
ipcMain.handle('mcp-config-clear', async () => {
  try {
    const defaultConfig = {
      servers: [],
      connections: [],
      settings: {
        autoStart: false,
        defaultPort: 8080,
        enableLogging: true,
        logLevel: 'info',
      },
    };
    store.set('mcpConfiguration', defaultConfig);
    return { success: true };
  } catch (error) {
    console.error('Error clearing MCP configuration:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('store-has', async (event, key: string) => {
  try {
    return store.has(key);
  } catch (error) {
    console.error('Error checking store key:', error);
    throw error;
  }
});

ipcMain.handle('store-clear', async () => {
  try {
    store.clear();
  } catch (error) {
    console.error('Error clearing store:', error);
    throw error;
  }
});

/**
 * Clear all WordPress-related configuration from Electron store
 */
ipcMain.handle('wordpress-clear-config', async () => {
  try {
    // Clear WordPress connections
    store.set('wordpressConnections', []);
    
    // Clear sync history
    store.set('syncHistory', []);
    
    // Reset user preferences to defaults (keeping non-WordPress settings)
    const currentPrefs = store.get('userPreferences', {});
    store.set('userPreferences', {
      ...currentPrefs,
      defaultSyncPath: '',
      autoSync: false
    });
    
    console.log('✅ WordPress configuration cleared from Electron store');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to clear WordPress configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// SSL Analysis Storage IPC handlers
ipcMain.handle('ssl-analysis-save', async (event, analysis) => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    analyses.push(analysis);
    store.set('sslAnalysisHistory', analyses);
    return { success: true, analysis };
  } catch (error) {
    console.error('Error saving SSL analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('ssl-analysis-get-all', async (event, filter) => {
  try {
    let analyses = store.get('sslAnalysisHistory', []) as any[];
    
    // Apply filters
    if (filter) {
      if (filter.websiteUrl) {
        analyses = analyses.filter(a => 
          a.websiteUrl.toLowerCase().includes(filter.websiteUrl.toLowerCase())
        );
      }
      
      if (filter.dateFrom) {
        const fromDate = new Date(filter.dateFrom);
        analyses = analyses.filter(a => new Date(a.createdAt) >= fromDate);
      }
      
      if (filter.dateTo) {
        const toDate = new Date(filter.dateTo);
        analyses = analyses.filter(a => new Date(a.createdAt) <= toDate);
      }
      
      if (filter.grade) {
        analyses = analyses.filter(a => a.analysis.grade.grade === filter.grade);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        analyses = analyses.filter(a => 
          a.tags && filter.tags.some((tag: string) => a.tags.includes(tag))
        );
      }
    }
    
    // Sort by creation date (newest first)
    analyses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return { success: true, analyses };
  } catch (error) {
    console.error('Error getting SSL analyses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyses: []
    };
  }
});

ipcMain.handle('ssl-analysis-get-by-id', async (event, id) => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    const analysis = analyses.find(a => a.id === id);
    return { success: true, analysis };
  } catch (error) {
    console.error('Error getting SSL analysis by ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analysis: null
    };
  }
});

ipcMain.handle('ssl-analysis-update', async (event, id, updates) => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    const index = analyses.findIndex(a => a.id === id);
    
    if (index >= 0) {
      analyses[index] = {
        ...analyses[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      store.set('sslAnalysisHistory', analyses);
      return { success: true, analysis: analyses[index] };
    } else {
      return { success: false, error: 'Analysis not found' };
    }
  } catch (error) {
    console.error('Error updating SSL analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('ssl-analysis-delete', async (event, id) => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    const filteredAnalyses = analyses.filter(a => a.id !== id);
    store.set('sslAnalysisHistory', filteredAnalyses);
    return { success: true };
  } catch (error) {
    console.error('Error deleting SSL analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('ssl-analysis-get-stats', async () => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    
    const stats = {
      totalAnalyses: analyses.length,
      averageScore: 0,
      gradeDistribution: {} as Record<string, number>,
      mostAnalyzedSites: [] as Array<{ url: string; count: number }>,
      recentAnalyses: analyses.slice(0, 5)
    };
    
    if (analyses.length > 0) {
      // Calculate average score
      const totalScore = analyses.reduce((sum, a) => sum + a.analysis.grade.score, 0);
      stats.averageScore = Math.round(totalScore / analyses.length);
      
      // Calculate grade distribution
      analyses.forEach(a => {
        const grade = a.analysis.grade.grade;
        stats.gradeDistribution[grade] = (stats.gradeDistribution[grade] || 0) + 1;
      });
      
      // Calculate most analyzed sites
      const siteCounts = analyses.reduce((acc, a) => {
        acc[a.websiteUrl] = (acc[a.websiteUrl] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      stats.mostAnalyzedSites = Object.entries(siteCounts)
        .map(([url, count]) => ({ url, count: count as number }))
        .sort((a, b) => (b.count as number) - (a.count as number))
        .slice(0, 10);
    }
    
    return { success: true, stats };
  } catch (error) {
    console.error('Error getting SSL analysis stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: {
        totalAnalyses: 0,
        averageScore: 0,
        gradeDistribution: {},
        mostAnalyzedSites: [],
        recentAnalyses: []
      }
    };
  }
});

ipcMain.handle('ssl-analysis-search', async (event, query) => {
  try {
    const analyses = store.get('sslAnalysisHistory', []) as any[];
    const searchQuery = query.toLowerCase();
    
    const filteredAnalyses = analyses.filter(a => 
      a.websiteUrl.toLowerCase().includes(searchQuery) ||
      (a.tags && a.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery))) ||
      (a.notes && a.notes.toLowerCase().includes(searchQuery)) ||
      a.analysis.grade.grade.toLowerCase().includes(searchQuery)
    );
    
    return { success: true, analyses: filteredAnalyses };
  } catch (error) {
    console.error('Error searching SSL analyses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyses: []
    };
  }
});

ipcMain.handle('ssl-analysis-clear-all', async () => {
  try {
    store.set('sslAnalysisHistory', []);
    return { success: true };
  } catch (error) {
    console.error('Error clearing SSL analyses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Simple photo insertion handler: move a file into project root (or specified path)
ipcMain.handle('photo-insert-into-project', async (event, sourceFilePath: string, projectRootPath: string, destinationFileName?: string) => {
  try {
    if (!sourceFilePath || !projectRootPath) {
      return { success: false, error: 'sourceFilePath and projectRootPath are required' };
    }
    const path = require('path');
    const destName = destinationFileName || path.basename(sourceFilePath);
    const destinationPath = path.join(projectRootPath, destName);
    const result = await insertPhoto(sourceFilePath, destinationPath);
    return { success: true, destinationPath: result.destinationPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Helper: create a simple backup conversation for a photo write
async function createPhotoBackup(projectRootPath: string, destinationPath: string): Promise<void> {
  try {
    const path = require('path');
    const fs = require('fs/promises');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(projectRootPath, '.backup', `conversation-${ts}-uploads-backup`);
    const rel = path.relative(projectRootPath, destinationPath);
    const backupTarget = path.join(backupDir, rel);
    const backupTargetDir = path.dirname(backupTarget);
    await fs.mkdir(backupTargetDir, { recursive: true });

    // If destination exists, copy its current contents as backup; otherwise, create .init marker
    const exists = await fs.access(destinationPath).then(() => true).catch(() => false);
    if (exists) {
      const content = await fs.readFile(destinationPath);
      await fs.writeFile(backupTarget, content);
    } else {
      await fs.writeFile(backupTarget + '.init', '');
    }
  } catch (e) {
    // Best-effort backup; ignore failures
    console.warn('Photo backup failed:', e);
  }
}

// Buffer-based photo insertion: write provided bytes into project root (with backup)
ipcMain.handle('photo-insert-into-project-buffer', async (event, fileBytes: ArrayBuffer, projectRootPath: string, destinationFileName: string) => {
  try {
    if (!fileBytes || !projectRootPath || !destinationFileName) {
      return { success: false, error: 'fileBytes, projectRootPath and destinationFileName are required' };
    }
    const path = require('path');
    const fs = require('fs/promises');
    const destPath = path.join(projectRootPath, destinationFileName);
    const dir = path.dirname(destPath);
    await fs.mkdir(dir, { recursive: true });
    // Create best-effort backup before overwriting/creating
    await createPhotoBackup(projectRootPath, destPath);
    const nodeBuffer = Buffer.from(fileBytes as any);
    await fs.writeFile(destPath, nodeBuffer);
    return { success: true, destinationPath: destPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Remove a photo by absolute file path
ipcMain.handle('photo-remove-from-project', async (event, absoluteFilePath: string) => {
  try {
    if (!absoluteFilePath) {
      return { success: false, error: 'absoluteFilePath is required' };
    }
    await removePhoto(absoluteFilePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// ========================================================================
// FINANCE HUB HANDLERS
// ========================================================================

/**
 * Save bank credentials
 */
ipcMain.handle('finance-hub:save-credentials', async (event, { bankId, credentials }) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
    if (!fhConfig.savedCredentials) fhConfig.savedCredentials = {};
    fhConfig.savedCredentials[bankId] = credentials;
    store.set('financeHub', fhConfig);
    return { success: true };
  } catch (error) {
    console.error('Error saving bank credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get saved bank credentials
 */
ipcMain.handle('finance-hub:get-saved-credentials', async (event, bankId) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
    const credentials = (fhConfig.savedCredentials && fhConfig.savedCredentials[bankId]) || null;
    return { success: true, credentials };
  } catch (error) {
    console.error('Error getting bank credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Remove saved bank credentials
 */
ipcMain.handle('finance-hub:remove-credentials', async (event, bankId) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
    if (fhConfig.savedCredentials) {
      delete fhConfig.savedCredentials[bankId];
      store.set('financeHub', fhConfig);
    }
    return { success: true };
  } catch (error) {
    console.error('Error removing bank credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get persistent spreadsheet info
 * @param key - Optional key for spreadsheet type (e.g., 'bank-spreadsheet', 'card-spreadsheet')
 */
ipcMain.handle('finance-hub:get-persistent-spreadsheet', async (event, key?: string) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [], persistentSpreadsheets: {} };
    const spreadsheetKey = key || 'default';

    // Initialize persistentSpreadsheets if it doesn't exist
    if (!fhConfig.persistentSpreadsheets) {
      fhConfig.persistentSpreadsheets = {};
    }

    const spreadsheet = fhConfig.persistentSpreadsheets[spreadsheetKey] || {
      spreadsheetId: null,
      lastUpdated: null,
      title: null,
      spreadsheetUrl: null
    };

    return { success: true, persistentSpreadsheet: spreadsheet };
  } catch (error) {
    console.error('Error getting persistent spreadsheet:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Save persistent spreadsheet info
 * @param spreadsheetInfo - Spreadsheet information to save
 * @param key - Optional key for spreadsheet type (e.g., 'bank-spreadsheet', 'card-spreadsheet')
 */
ipcMain.handle('finance-hub:save-persistent-spreadsheet', async (event, spreadsheetInfo, key?: string) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [], persistentSpreadsheets: {} };
    const spreadsheetKey = key || 'default';

    // Initialize persistentSpreadsheets if it doesn't exist
    if (!fhConfig.persistentSpreadsheets) {
      fhConfig.persistentSpreadsheets = {};
    }

    fhConfig.persistentSpreadsheets[spreadsheetKey] = {
      ...fhConfig.persistentSpreadsheets[spreadsheetKey],
      ...spreadsheetInfo,
      lastUpdated: new Date().toISOString(),
    };

    store.set('financeHub', fhConfig);
    return { success: true, persistentSpreadsheet: fhConfig.persistentSpreadsheets[spreadsheetKey] };
  } catch (error) {
    console.error('Error saving persistent spreadsheet:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Clear persistent spreadsheet info
 * @param key - Optional key for spreadsheet type (e.g., 'bank-spreadsheet', 'card-spreadsheet')
 */
ipcMain.handle('finance-hub:clear-persistent-spreadsheet', async (event, key?: string) => {
  try {
    const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [], persistentSpreadsheets: {} };
    const spreadsheetKey = key || 'default';

    // Initialize persistentSpreadsheets if it doesn't exist
    if (!fhConfig.persistentSpreadsheets) {
      fhConfig.persistentSpreadsheets = {};
    }

    fhConfig.persistentSpreadsheets[spreadsheetKey] = {
      spreadsheetId: null,
      lastUpdated: null,
      title: null,
      spreadsheetUrl: null,
    };

    store.set('financeHub', fhConfig);
    return { success: true };
  } catch (error) {
    console.error('Error clearing persistent spreadsheet:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// ============================================
// Hometax Integration IPC Handlers
// ============================================

import { fetchCertificates, connectToHometax, disconnectFromHometax, getHometaxConnectionStatus, collectTaxInvoices } from './hometax-automation';
import { parseHometaxExcel, parseCashReceiptExcel } from './hometax-excel-parser';
import { importTaxInvoices, recordSyncOperation, getTaxInvoices, getSpreadsheetUrl, saveSpreadsheetUrl, importCashReceipts, getCashReceipts, getCashReceiptSpreadsheetUrl, saveCashReceiptSpreadsheetUrl } from './sqlite/hometax';
import { getConversationsDatabase, getFinanceHubDatabase } from './sqlite/init';

/**
 * Fetch available certificates from Hometax
 */
ipcMain.handle('hometax:fetch-certificates', async () => {
  try {
    console.log('[IPC] hometax:fetch-certificates called');
    const result = await fetchCertificates();
    return result;
  } catch (error) {
    console.error('[IPC] hometax:fetch-certificates error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Connect to Hometax with selected certificate and password
 */
ipcMain.handle('hometax:connect', async (event, selectedCertificate: any, certificatePassword: string) => {
  try {
    console.log(`[IPC] hometax:connect called for certificate: ${selectedCertificate?.소유자명}`);
    const result = await connectToHometax(selectedCertificate, certificatePassword);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:connect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Disconnect from Hometax
 */
ipcMain.handle('hometax:disconnect', async (event, businessNumber: string) => {
  try {
    console.log(`[IPC] hometax:disconnect called for business: ${businessNumber}`);
    await disconnectFromHometax();
    return { success: true };
  } catch (error) {
    console.error('[IPC] hometax:disconnect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get Hometax connection status
 */
ipcMain.handle('hometax:get-connection-status', async () => {
  try {
    const status = getHometaxConnectionStatus();
    return { success: true, data: status };
  } catch (error) {
    console.error('[IPC] hometax:get-connection-status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Save Hometax credentials (encrypted)
 */
ipcMain.handle('hometax:save-credentials', async (event, businessNumber: string, credentials: any) => {
  try {
    const hometaxConfig = store.get('hometax') || { credentials: {} };
    if (!hometaxConfig.credentials) {
      hometaxConfig.credentials = {};
    }
    hometaxConfig.credentials[businessNumber] = {
      ...credentials,
      businessNumber,
      savedAt: new Date().toISOString()
    };
    store.set('hometax', hometaxConfig);
    console.log(`[Hometax] Credentials saved for business: ${businessNumber}`);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] Error saving credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get saved Hometax credentials
 */
ipcMain.handle('hometax:get-credentials', async (event, businessNumber: string) => {
  try {
    const hometaxConfig = store.get('hometax') || { credentials: {} };
    const credentials = hometaxConfig.credentials?.[businessNumber] || null;
    return { success: true, credentials };
  } catch (error) {
    console.error('[Hometax] Error getting credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Remove Hometax credentials and certificate data
 */
ipcMain.handle('hometax:remove-credentials', async (event, businessNumber: string) => {
  try {
    const hometaxConfig = store.get('hometax') || { credentials: {}, selectedCertificates: {} };

    // Remove credentials
    if (hometaxConfig.credentials) {
      delete hometaxConfig.credentials[businessNumber];
    }

    // Remove selected certificate data
    if (hometaxConfig.selectedCertificates) {
      delete hometaxConfig.selectedCertificates[businessNumber];
    }

    store.set('hometax', hometaxConfig);
    console.log(`[Hometax] Credentials and certificate data removed for business: ${businessNumber}`);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] Error removing credentials:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get connected businesses
 */
ipcMain.handle('hometax:get-connected-businesses', async () => {
  try {
    const hometaxConfig = store.get('hometax') || { connectedBusinesses: [] };
    return { success: true, data: hometaxConfig.connectedBusinesses || [] };
  } catch (error) {
    console.error('[Hometax] Error getting connected businesses:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Save selected certificate information for a business
 */
ipcMain.handle('hometax:save-selected-certificate', async (event, businessNumber: string, certificateData: any) => {
  try {
    const hometaxConfig = store.get('hometax') || { credentials: {}, selectedCertificates: {} };
    if (!hometaxConfig.selectedCertificates) {
      hometaxConfig.selectedCertificates = {};
    }
    hometaxConfig.selectedCertificates[businessNumber] = {
      xpath: certificateData.xpath,
      소유자명: certificateData.소유자명,
      용도: certificateData.용도,
      발급기관: certificateData.발급기관,
      만료일: certificateData.만료일,
      businessName: certificateData.businessName,
      representativeName: certificateData.representativeName,
      businessType: certificateData.businessType,
      certificatePassword: certificateData.certificatePassword || hometaxConfig.selectedCertificates[businessNumber]?.certificatePassword,
      savedAt: new Date().toISOString()
    };
    store.set('hometax', hometaxConfig);
    console.log(`[Hometax] Selected certificate information saved for business: ${businessNumber}`);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] Error saving selected certificate:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get saved certificate xpath for a business
 */
ipcMain.handle('hometax:get-selected-certificate', async (event, businessNumber: string) => {
  try {
    const hometaxConfig = store.get('hometax') || { selectedCertificates: {} };
    const selectedCert = hometaxConfig.selectedCertificates?.[businessNumber] || null;
    return { success: true, data: selectedCert };
  } catch (error) {
    console.error('[Hometax] Error getting selected certificate:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get all saved certificates (for UI display)
 */
ipcMain.handle('hometax:get-all-saved-certificates', async () => {
  try {
    const hometaxConfig = store.get('hometax') || { selectedCertificates: {} };
    return { success: true, data: hometaxConfig.selectedCertificates || {} };
  } catch (error) {
    console.error('[Hometax] Error getting all saved certificates:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * Get tax invoices from database
 */
ipcMain.handle('hometax:get-invoices', async (event, filters: any) => {
  try {
    const db = getFinanceHubDatabase();
    const result = getTaxInvoices(db, filters);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:get-invoices error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get cash receipts from database
 */
ipcMain.handle('hometax:get-cash-receipts', async (event, filters: any) => {
  try {
    const db = getFinanceHubDatabase();
    const result = getCashReceipts(db, filters);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:get-cash-receipts error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get saved spreadsheet URL for a business and invoice type
 */
ipcMain.handle('hometax:get-spreadsheet-url', async (event, businessNumber: string, invoiceType: 'sales' | 'purchase') => {
  try {
    const db = getFinanceHubDatabase();
    const result = getSpreadsheetUrl(db, businessNumber, invoiceType);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:get-spreadsheet-url error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Save spreadsheet URL for a business and invoice type
 */
ipcMain.handle('hometax:save-spreadsheet-url', async (event, businessNumber: string, invoiceType: 'sales' | 'purchase', spreadsheetUrl: string) => {
  try {
    const db = getFinanceHubDatabase();
    const result = saveSpreadsheetUrl(db, businessNumber, invoiceType, spreadsheetUrl);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:save-spreadsheet-url error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Get saved cash receipt spreadsheet URL for a business
 */
ipcMain.handle('hometax:get-cash-receipt-spreadsheet-url', async (event, businessNumber: string) => {
  try {
    const db = getFinanceHubDatabase();
    const result = getCashReceiptSpreadsheetUrl(db, businessNumber);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:get-cash-receipt-spreadsheet-url error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Save cash receipt spreadsheet URL for a business
 */
ipcMain.handle('hometax:save-cash-receipt-spreadsheet-url', async (event, businessNumber: string, spreadsheetUrl: string) => {
  try {
    const db = getFinanceHubDatabase();
    const result = saveCashReceiptSpreadsheetUrl(db, businessNumber, spreadsheetUrl);
    return result;
  } catch (error) {
    console.error('[IPC] hometax:save-cash-receipt-spreadsheet-url error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Drop all Hometax data (clear database)
 */
ipcMain.handle('hometax:drop-all-data', async () => {
  try {
    console.log('[IPC] hometax:drop-all-data called');
    const db = getFinanceHubDatabase();

    // Delete all tax invoices and sync operations
    db.prepare('DELETE FROM tax_invoices').run();
    db.prepare('DELETE FROM hometax_sync_operations').run();
    db.prepare('VACUUM').run();

    console.log('[IPC] ✅ All Hometax data dropped successfully');
    return { success: true };
  } catch (error) {
    console.error('[IPC] hometax:drop-all-data error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Collect tax invoices for a business
 */
ipcMain.handle('hometax:collect-invoices', async (event, certificateData: any, certificatePassword: string) => {
  try {
    console.log(`[IPC] hometax:collect-invoices called for: ${certificateData?.businessName}`);

    // Collect invoices (download Excel files)
    const result = await collectTaxInvoices(certificateData, certificatePassword);

    if (!result.success) {
      return result;
    }

    // Parse and save the downloaded Excel files
    const db = getFinanceHubDatabase();
    let salesInserted = 0;
    let salesDuplicate = 0;
    let purchaseInserted = 0;
    let purchaseDuplicate = 0;

    // Wait a bit for files to be fully written
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Parse this month sales Excel
    if (result.thisMonthSalesFile) {
      console.log('[IPC] Parsing this month sales Excel:', result.thisMonthSalesFile);
      const salesParsed = parseHometaxExcel(result.thisMonthSalesFile);

      if (salesParsed.success && salesParsed.invoices && salesParsed.businessNumber) {
        // Verify detected type matches expected type
        if (salesParsed.detectedType && salesParsed.detectedType !== 'sales') {
          console.error(`[IPC] ⚠️  TYPE MISMATCH! Expected sales but detected ${salesParsed.detectedType} in file: ${result.thisMonthSalesFile}`);
        }

        const importResult = importTaxInvoices(
          db,
          salesParsed.businessNumber,
          'sales',
          salesParsed.invoices,
          result.thisMonthSalesFile
        );
        salesInserted += importResult.inserted;
        salesDuplicate += importResult.duplicate;
        console.log(`[IPC] This month sales: ${importResult.inserted} new, ${importResult.duplicate} duplicate`);
      }
    } else {
      console.log('[IPC] ⚠️  No this month sales file - skipping (no data for this period)');
    }

    // Parse last month sales Excel
    if (result.lastMonthSalesFile) {
      console.log('[IPC] Parsing last month sales Excel:', result.lastMonthSalesFile);
      const salesParsed = parseHometaxExcel(result.lastMonthSalesFile);

      if (salesParsed.success && salesParsed.invoices && salesParsed.businessNumber) {
        // Verify detected type matches expected type
        if (salesParsed.detectedType && salesParsed.detectedType !== 'sales') {
          console.error(`[IPC] ⚠️  TYPE MISMATCH! Expected sales but detected ${salesParsed.detectedType} in file: ${result.lastMonthSalesFile}`);
        }

        const importResult = importTaxInvoices(
          db,
          salesParsed.businessNumber,
          'sales',
          salesParsed.invoices,
          result.lastMonthSalesFile
        );
        salesInserted += importResult.inserted;
        salesDuplicate += importResult.duplicate;
        console.log(`[IPC] Last month sales: ${importResult.inserted} new, ${importResult.duplicate} duplicate`);
      }
    } else {
      console.log('[IPC] ⚠️  No last month sales file - skipping (no data for this period)');
    }

    // Parse this month purchase Excel
    if (result.thisMonthPurchaseFile) {
      console.log('[IPC] Parsing this month purchase Excel:', result.thisMonthPurchaseFile);
      const purchaseParsed = parseHometaxExcel(result.thisMonthPurchaseFile);

      if (purchaseParsed.success && purchaseParsed.invoices && purchaseParsed.businessNumber) {
        // Verify detected type matches expected type
        if (purchaseParsed.detectedType && purchaseParsed.detectedType !== 'purchase') {
          console.error(`[IPC] ⚠️  TYPE MISMATCH! Expected purchase but detected ${purchaseParsed.detectedType} in file: ${result.thisMonthPurchaseFile}`);
        }

        const importResult = importTaxInvoices(
          db,
          purchaseParsed.businessNumber,
          'purchase',
          purchaseParsed.invoices,
          result.thisMonthPurchaseFile
        );
        purchaseInserted += importResult.inserted;
        purchaseDuplicate += importResult.duplicate;
        console.log(`[IPC] This month purchase: ${importResult.inserted} new, ${importResult.duplicate} duplicate`);
      }
    } else {
      console.log('[IPC] ⚠️  No this month purchase file - skipping (no data for this period)');
    }

    // Parse last month purchase Excel
    if (result.lastMonthPurchaseFile) {
      console.log('[IPC] Parsing last month purchase Excel:', result.lastMonthPurchaseFile);
      const purchaseParsed = parseHometaxExcel(result.lastMonthPurchaseFile);

      if (purchaseParsed.success && purchaseParsed.invoices && purchaseParsed.businessNumber) {
        // Verify detected type matches expected type
        if (purchaseParsed.detectedType && purchaseParsed.detectedType !== 'purchase') {
          console.error(`[IPC] ⚠️  TYPE MISMATCH! Expected purchase but detected ${purchaseParsed.detectedType} in file: ${result.lastMonthPurchaseFile}`);
        }

        const importResult = importTaxInvoices(
          db,
          purchaseParsed.businessNumber,
          'purchase',
          purchaseParsed.invoices,
          result.lastMonthPurchaseFile
        );
        purchaseInserted += importResult.inserted;
        purchaseDuplicate += importResult.duplicate;
        console.log(`[IPC] Last month purchase: ${importResult.inserted} new, ${importResult.duplicate} duplicate`);
      }
    } else {
      console.log('[IPC] ⚠️  No last month purchase file - skipping (no data for this period)');
    }

    // Parse cash receipt Excel
    let cashReceiptInserted = 0;
    let cashReceiptDuplicate = 0;

    if (result.cashReceiptFile) {
      console.log('[IPC] Parsing cash receipt Excel:', result.cashReceiptFile);
      const cashReceiptParsed = parseCashReceiptExcel(result.cashReceiptFile);

      if (cashReceiptParsed.success && cashReceiptParsed.receipts && cashReceiptParsed.receipts.length > 0) {
        // Get business number from certificate data or from already-parsed tax invoice files
        let businessNumber = certificateData.businessNumber || certificateData.사업자등록번호;

        // If not found in certificate data, try to get from parsed sales/purchase files
        if (!businessNumber) {
          // Try this month sales first
          if (result.thisMonthSalesFile) {
            const parsed = parseHometaxExcel(result.thisMonthSalesFile);
            if (parsed.success && parsed.businessNumber) {
              businessNumber = parsed.businessNumber;
              console.log('[IPC] Got business number from this month sales file:', businessNumber);
            }
          }
        }

        if (!businessNumber && result.thisMonthPurchaseFile) {
          const parsed = parseHometaxExcel(result.thisMonthPurchaseFile);
          if (parsed.success && parsed.businessNumber) {
            businessNumber = parsed.businessNumber;
            console.log('[IPC] Got business number from this month purchase file:', businessNumber);
          }
        }

        if (businessNumber) {
          const importResult = importCashReceipts(
            db,
            businessNumber,
            cashReceiptParsed.receipts,
            result.cashReceiptFile
          );
          cashReceiptInserted += importResult.inserted;
          cashReceiptDuplicate += importResult.duplicate;
          console.log(`[IPC] Cash receipts: ${importResult.inserted} new, ${importResult.duplicate} duplicate`);
        } else {
          console.error('[IPC] ⚠️  Could not determine business number for cash receipts');
        }
      }
    } else {
      console.log('[IPC] ⚠️  No cash receipt file - skipping (no data for this period)');
    }

    console.log(`[IPC] Import complete - Sales: ${salesInserted} new (${salesDuplicate} duplicate), Purchase: ${purchaseInserted} new (${purchaseDuplicate} duplicate), Cash Receipts: ${cashReceiptInserted} new (${cashReceiptDuplicate} duplicate)`);

    // Clean up downloaded Excel files after successful import
    console.log('[IPC] Cleaning up downloaded Excel files...');
    const filesToDelete = [
      result.thisMonthSalesFile,
      result.lastMonthSalesFile,
      result.thisMonthPurchaseFile,
      result.lastMonthPurchaseFile,
      result.cashReceiptFile
    ].filter(Boolean); // Remove undefined/null values

    for (const filePath of filesToDelete) {
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('[IPC] Deleted file:', filePath);
        }
      } catch (deleteError) {
        console.warn('[IPC] Failed to delete file:', filePath, deleteError);
        // Don't fail the entire operation if file deletion fails
      }
    }

    console.log('[IPC] Cleanup complete');

    return {
      success: true,
      salesInserted,
      salesDuplicate,
      purchaseInserted,
      purchaseDuplicate,
      cashReceiptInserted,
      cashReceiptDuplicate
    };

  } catch (error) {
    console.error('[IPC] hometax:collect-invoices error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// ========================================================================
// DRIVE SERVICE FOLDER MANAGEMENT HELPERS
// ========================================================================

/**
 * Folder configuration type for Drive Service
 */
export interface FolderConfig {
  folderId: string;
  parentId?: string;
  lastVerified: string;
}

/**
 * Get folder configuration from electron-store
 * @param subfolder - The subfolder key (e.g., 'root', 'Dev', 'Transactions', 'Tax Invoices')
 */
export function getFolderConfig(subfolder: string): FolderConfig | null {
  try {
    const folders = store.get('egdeskFolders') as Record<string, FolderConfig> | undefined;
    return folders?.[subfolder] || null;
  } catch (error) {
    console.error('Error getting folder config:', error);
    return null;
  }
}

/**
 * Save folder configuration to electron-store
 * @param subfolder - The subfolder key (e.g., 'root', 'Dev', 'Transactions', 'Tax Invoices')
 * @param config - The folder configuration to save
 */
export function saveFolderConfig(subfolder: string, config: FolderConfig): void {
  try {
    const folders = store.get('egdeskFolders') as Record<string, FolderConfig> | undefined || {};
    folders[subfolder] = config;
    store.set('egdeskFolders', folders);
    console.log(`💾 Saved ${subfolder} folder config to store`);
  } catch (error) {
    console.error('Error saving folder config:', error);
  }
}

/**
 * Get all folder configurations
 */
export function getAllFolderConfigs(): Record<string, FolderConfig> {
  try {
    return store.get('egdeskFolders') as Record<string, FolderConfig> | undefined || {};
  } catch (error) {
    console.error('Error getting all folder configs:', error);
    return {};
  }
}

/**
 * Clear all folder configurations (useful for testing or reset)
 */
export function clearAllFolderConfigs(): void {
  try {
    store.delete('egdeskFolders');
    console.log('🗑️ Cleared all folder configs from store');
  } catch (error) {
    console.error('Error clearing folder configs:', error);
  }
}

/**
 * Auto-detect Arduino port
 * Reference: https://dev.to/azzamjiul/how-to-connect-to-arduino-automatically-using-serial-port-in-nodejs-plh
 */
async function detectArduinoPort(): Promise<string | null> {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();

    console.log('🔍 Scanning for Arduino...');
    console.log('Available ports:', ports.map((p: any) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      vendorId: p.vendorId,
      productId: p.productId
    })));

    // Look for Arduino by Vendor ID (VID) and Product ID (PID)
    // Arduino boards typically have VID 2341 (hex) or 0x2341
    // Common Arduino PIDs: 0043, 0001, 8036, etc.
    const arduinoPort = ports.find((port: any) => {
      // Check by Vendor ID (Arduino's official VID)
      if (port.vendorId === '2341' || port.vendorId === '0x2341') {
        return true;
      }

      // Check by manufacturer name (case-insensitive)
      if (port.manufacturer &&
          (port.manufacturer.toLowerCase().includes('arduino') ||
           port.manufacturer.toLowerCase().includes('(www.arduino.cc)'))) {
        return true;
      }

      // Check for common USB-Serial chips used in Arduino clones
      // FTDI (Future Technology Devices International)
      if (port.vendorId === '0403' || port.manufacturer?.toLowerCase().includes('ftdi')) {
        return true;
      }

      // CH340 (common in Chinese Arduino clones)
      if (port.vendorId === '1a86' || port.manufacturer?.toLowerCase().includes('ch340')) {
        return true;
      }

      // CP210x (Silicon Labs)
      if (port.vendorId === '10c4' || port.manufacturer?.toLowerCase().includes('silicon labs')) {
        return true;
      }

      // Check path patterns for Mac/Linux
      if (port.path?.includes('usbserial') || port.path?.includes('usbmodem')) {
        return true;
      }

      return false;
    });

    if (arduinoPort) {
      console.log(`✅ Auto-detected Arduino on port: ${arduinoPort.path}`);
      console.log(`   Manufacturer: ${arduinoPort.manufacturer || 'Unknown'}`);
      console.log(`   Vendor ID: ${arduinoPort.vendorId || 'Unknown'}`);
      console.log(`   Product ID: ${arduinoPort.productId || 'Unknown'}`);
      return arduinoPort.path;
    }

    console.log('⚠️  No Arduino detected. Available ports:', ports.map((p: any) => p.path).join(', '));
    return null;
  } catch (error) {
    console.error('Error detecting Arduino port:', error);
    return null;
  }
}

/**
 * IPC Handler: Get Arduino port setting (with auto-detection)
 */
ipcMain.handle('finance-hub:get-arduino-port', async () => {
  try {
    // First try auto-detection
    const detectedPort = await detectArduinoPort();

    if (detectedPort) {
      // Save the detected port for future use
      store.set('financeHub.arduinoPort', detectedPort);
      return { success: true, port: detectedPort, autoDetected: true };
    }

    // Fall back to saved setting
    const savedPort = store.get('financeHub.arduinoPort', 'COM6');
    return { success: true, port: savedPort, autoDetected: false };
  } catch (error) {
    console.error('Error getting Arduino port:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', port: 'COM6' };
  }
});

/**
 * IPC Handler: Set Arduino port setting
 */
ipcMain.handle('finance-hub:set-arduino-port', async (event, port: string) => {
  try {
    store.set('financeHub.arduinoPort', port);
    console.log(`✅ Arduino port set to: ${port}`);
    return { success: true };
  } catch (error) {
    console.error('Error setting Arduino port:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

/**
 * IPC Handler: List all available serial ports
 */
ipcMain.handle('finance-hub:list-serial-ports', async () => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return {
      success: true,
      ports: ports.map((p: any) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        productId: p.productId,
        vendorId: p.vendorId
      }))
    };
  } catch (error) {
    console.error('Error listing serial ports:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', ports: [] };
  }
});

/**
 * IPC Handler: Get scheduler execution intents
 */
ipcMain.handle('sqlite-scheduler-get-intents', async (event, options?: { schedulerType?: string; limit?: number; offset?: number }) => {
  try {
    const { getSQLiteManager } = require('./sqlite/manager');
    const manager = getSQLiteManager();
    const db = manager.getSchedulerDatabase();

    const { schedulerType, limit = 500, offset = 0 } = options || {};

    let query = `
      SELECT * FROM scheduler_execution_intents
      WHERE 1=1
    `;
    const params: any[] = [];

    if (schedulerType) {
      query += ` AND scheduler_type = ?`;
      params.push(schedulerType);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const intents = db.prepare(query).all(...params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM scheduler_execution_intents WHERE 1=1`;
    const countParams: any[] = [];
    if (schedulerType) {
      countQuery += ` AND scheduler_type = ?`;
      countParams.push(schedulerType);
    }
    const totalResult = db.prepare(countQuery).get(...countParams) as { total: number };

    return {
      success: true,
      intents: intents.map((intent: any) => ({
        id: intent.id,
        schedulerType: intent.scheduler_type,
        taskId: intent.task_id,
        taskName: intent.task_name,
        intendedDate: intent.intended_date,
        intendedTime: intent.intended_time,
        status: intent.status,
        executionWindowStart: intent.execution_window_start,
        executionWindowEnd: intent.execution_window_end,
        actualExecutionTime: intent.actual_started_at,
        completedAt: intent.actual_completed_at,
        errorMessage: intent.error_message,
        retryCount: intent.retry_count || 0,
        createdAt: intent.created_at,
        updatedAt: intent.updated_at,
      })),
      total: totalResult.total,
      offset,
      limit
    };
  } catch (error) {
    console.error('Error getting scheduler intents:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', intents: [], total: 0 };
  }
});

/**
 * IPC Handler: Manually trigger spreadsheet re-organization
 */
ipcMain.handle('finance-hub:reorganize-spreadsheets', async () => {
  try {
    const { organizeExistingSpreadsheets } = await import('./migrations/organize-existing-spreadsheets');
    const result = await organizeExistingSpreadsheets();
    return {
      success: true,
      organized: result.organized,
      skipped: result.skipped,
      failed: result.failed,
    };
  } catch (error) {
    console.error('Error reorganizing spreadsheets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * IPC Handler: Cleanup deleted Playwright test schedules
 */
ipcMain.handle('scheduler:cleanup-deleted-tests', async () => {
  try {
    const { cleanupDeletedPlaywrightTests } = await import('./migrations/cleanup-deleted-playwright-tests');
    const result = await cleanupDeletedPlaywrightTests();
    return {
      success: true,
      removed: result.removed,
      checked: result.checked,
    };
  } catch (error) {
    console.error('Error cleaning up deleted tests:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * IPC Handler: Reset spreadsheet organization migration status
 */
ipcMain.handle('finance-hub:reset-organization-migration', async () => {
  try {
    const { resetMigrationStatus } = await import('./migrations/organize-existing-spreadsheets');
    resetMigrationStatus();
    return { success: true };
  } catch (error) {
    console.error('Error resetting migration status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * IPC Handler: Check if spreadsheet organization migration has run
 */
ipcMain.handle('finance-hub:check-organization-migration', async () => {
  try {
    const { hasMigrationRun } = await import('./migrations/organize-existing-spreadsheets');
    const hasRun = hasMigrationRun();
    const store = getStore();
    const ranAt = store.get('migrations.spreadsheetsOrganizedAt') as string | undefined;
    return {
      success: true,
      hasRun,
      ranAt: ranAt || null,
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
