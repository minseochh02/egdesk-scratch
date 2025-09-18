/* eslint global-require: off, no-console: off, promise/always-return: off */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ipcMain } from 'electron';

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
        },
      });
      resolve();
    } catch (error) {
      console.error('Failed to initialize Electron Store:', error);
      reject(error);
    }
  });
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
