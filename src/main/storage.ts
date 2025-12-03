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
