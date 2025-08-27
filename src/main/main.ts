/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as fs from 'fs';
import * as os from 'os';
// Dynamic import for electron-store to avoid CommonJS/ESM issues
let Store: any;
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

// Store will be initialized in createWindow function
let store: any;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// WordPress connection management IPC handlers
ipcMain.handle('wp-save-connection', async (event, connection) => {
  try {
    const connections = store.get('wordpressConnections', []) as any[];
    
    // Check if connection already exists (by URL)
    const existingIndex = connections.findIndex(conn => conn.url === connection.url);
    
    if (existingIndex >= 0) {
      // Update existing connection
      connections[existingIndex] = {
        ...connections[existingIndex],
        ...connection,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new connection
      connections.push({
        ...connection,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    store.set('wordpressConnections', connections);
    return { success: true, connections };
  } catch (error) {
    console.error('Error saving WordPress connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Notify renderer about file sync completion
ipcMain.handle('notify-sync-completion', async (event, syncData) => {
  try {
    // Broadcast to all renderer processes
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-completed', syncData);
    }
    return { success: true };
  } catch (error) {
    console.error('Error notifying sync completion:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Navigate to synced folder in Finder UI
ipcMain.handle('wp-navigate-to-synced-folder', async (event, navigationData) => {
  try {
    // Send navigation request to renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('navigate-to-synced-folder', navigationData);
    }
    return { success: true };
  } catch (error) {
    console.error('Error navigating to synced folder:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('wp-get-connections', async () => {
  try {
    const connections = store.get('wordpressConnections', []) as any[];
    return { success: true, connections };
  } catch (error) {
    console.error('Error getting WordPress connections:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('wp-delete-connection', async (event, connectionId) => {
  try {
    const connections = store.get('wordpressConnections', []) as any[];
    const filteredConnections = connections.filter(conn => conn.id !== connectionId);
    store.set('wordpressConnections', filteredConnections);
    return { success: true, connections: filteredConnections };
  } catch (error) {
    console.error('Error deleting WordPress connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('wp-update-connection', async (event, connectionId, updates) => {
  try {
    const connections = store.get('wordpressConnections', []) as any[];
    const connectionIndex = connections.findIndex(conn => conn.id === connectionId);
    
    if (connectionIndex >= 0) {
      connections[connectionIndex] = {
        ...connections[connectionIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      store.set('wordpressConnections', connections);
      return { success: true, connection: connections[connectionIndex] };
    } else {
      return { success: false, error: 'Connection not found' };
    }
  } catch (error) {
    console.error('Error updating WordPress connection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// User preferences IPC handlers
ipcMain.handle('prefs-get', async () => {
  try {
    const preferences = store.get('userPreferences');
    return { success: true, preferences };
  } catch (error) {
    console.error('Error getting preferences:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('prefs-set', async (event, preferences) => {
  try {
    store.set('userPreferences', preferences);
    return { success: true };
  } catch (error) {
    console.error('Error setting preferences:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
      errors: []
    };
    
    syncHistory.push(newSyncRecord);
    store.set('syncHistory', syncHistory);
    return { success: true, syncRecord: newSyncRecord };
  } catch (error) {
    console.error('Error saving sync history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sync-update-progress', async (event, syncId, progressData) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    const syncIndex = syncHistory.findIndex(record => record.id === syncId);
    
    if (syncIndex >= 0) {
      syncHistory[syncIndex] = {
        ...syncHistory[syncIndex],
        ...progressData,
        updatedAt: new Date().toISOString()
      };
      
      store.set('syncHistory', syncHistory);
      return { success: true, syncRecord: syncHistory[syncIndex] };
    } else {
      return { success: false, error: 'Sync record not found' };
    }
  } catch (error) {
    console.error('Error updating sync progress:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sync-complete', async (event, syncId, completionData) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    const syncIndex = syncHistory.findIndex(record => record.id === syncId);
    
    if (syncIndex >= 0) {
      syncHistory[syncIndex] = {
        ...syncHistory[syncIndex],
        ...completionData,
        completedAt: new Date().toISOString(),
        status: 'completed',
        updatedAt: new Date().toISOString()
      };
      
      store.set('syncHistory', syncHistory);
      return { success: true, syncRecord: syncHistory[syncIndex] };
    } else {
      return { success: false, error: 'Sync record not found' };
    }
  } catch (error) {
    console.error('Error completing sync:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sync-get-history', async (event, connectionId) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    
    if (connectionId) {
      // Filter by specific connection
      const filteredHistory = syncHistory.filter(record => record.connectionId === connectionId);
      return { success: true, syncHistory: filteredHistory };
    } else {
      // Return all sync history
      return { success: true, syncHistory };
    }
  } catch (error) {
    console.error('Error getting sync history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sync-get-file-status', async (event, connectionId, filePath) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    
    // Find the most recent successful sync for this connection
    const recentSync = syncHistory
      .filter(record => record.connectionId === connectionId && record.status === 'completed')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    
    if (recentSync) {
      const fileDetail = recentSync.fileDetails.find((file: any) => file.path === filePath);
      return { 
        success: true, 
        fileStatus: fileDetail || null,
        lastSync: recentSync.completedAt,
        syncPath: recentSync.syncPath
      };
    } else {
      return { success: false, error: 'No sync history found' };
    }
  } catch (error) {
    console.error('Error getting file sync status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sync-clear-history', async (event, connectionId) => {
  try {
    const syncHistory = store.get('syncHistory', []) as any[];
    
    if (connectionId) {
      // Clear history for specific connection
      const filteredHistory = syncHistory.filter(record => record.connectionId !== connectionId);
      store.set('syncHistory', filteredHistory);
      return { success: true, syncHistory: filteredHistory };
    } else {
      // Clear all sync history
      store.set('syncHistory', []);
      return { success: true, syncHistory: [] };
    }
  } catch (error) {
    console.error('Error clearing sync history:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// File system IPC handlers
ipcMain.handle('fs-read-directory', async (event, dirPath: string) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    console.log(`Reading directory: ${dirPath}`);
    console.log(`Total items found: ${items.length}`);
    
    // Hide ALL items that start with a dot (both files and folders)
    const fileItems = items
      .filter(item => {
        const isHidden = item.name.startsWith('.');
        
        if (isHidden) {
          console.log(`✗ Hiding hidden item: ${item.name} (${item.isDirectory() ? 'folder' : 'file'})`);
          return false;
        }
        
        console.log(`✓ Showing item: ${item.name} (${item.isDirectory() ? 'folder' : 'file'})`);
        return true;
      })
      .map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
        isFile: item.isFile(),
        isHidden: item.name.startsWith('.'),
        isSymlink: item.isSymbolicLink()
      }));

    console.log(`Filtered items: ${fileItems.length}`);
    console.log(`Hidden items filtered out: ${items.filter(item => item.name.startsWith('.')).length}`);
    
    // Sort: folders first, then files, both alphabetically
    fileItems.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, items: fileItems };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Folder picker dialog
ipcMain.handle('fs-pick-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '동기화할 폴더 선택',
      buttonLabel: '선택'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, folderPath: result.filePaths[0] };
    } else {
      return { success: false, error: '폴더가 선택되지 않았습니다.' };
    }
  } catch (error) {
    console.error('Error picking folder:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-get-file-info', async (event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      success: true,
      info: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        extension: ext,
        permissions: stats.mode
      }
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-get-home-directory', async () => {
  return os.homedir();
});

ipcMain.handle('fs-get-system-directories', async () => {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  let systemDirs = [];
  
  if (platform === 'darwin') { // macOS
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: '🖥️' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: '📁' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: '⬇️' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: '🖼️' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: '🎵' },
      { name: '영화', path: path.join(homeDir, 'Movies'), icon: '🎬' },
      { name: '애플리케이션', path: '/Applications', icon: '🚀' }
    ];
  } else if (platform === 'win32') { // Windows
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: '🖥️' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: '📁' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: '⬇️' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: '🖼️' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: '🎵' },
      { name: '비디오', path: path.join(homeDir, 'Videos'), icon: '🎬' }
    ];
  } else { // Linux
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: '🖥️' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: '📁' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: '⬇️' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: '🖼️' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: '🎵' },
      { name: '비디오', path: path.join(homeDir, 'Videos'), icon: '🎬' }
    ];
  }
  
  return systemDirs;
});

ipcMain.handle('fs-create-folder', async (event, folderPath: string) => {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating folder:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-delete-item', async (event, itemPath: string) => {
  try {
    const stats = await fs.promises.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.promises.rmdir(itemPath, { recursive: true });
    } else {
      await fs.promises.unlink(itemPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-rename-item', async (event, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Error renaming item:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// WordPress sync file operations
ipcMain.handle('wp-sync-create-folders', async (event, basePath: string) => {
  try {
    const postsPath = path.join(basePath, 'posts');
    const mediaPath = path.join(basePath, 'media');
    
    await fs.promises.mkdir(basePath, { recursive: true });
    await fs.promises.mkdir(postsPath, { recursive: true });
    await fs.promises.mkdir(mediaPath, { recursive: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error creating sync folders:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('wp-sync-save-post', async (event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    const stats = await fs.promises.stat(filePath);
    return { success: true, size: stats.size };
  } catch (error) {
    console.error('Error saving post file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('wp-sync-download-media', async (event, mediaUrl: string, filePath: string) => {
  try {
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve) => {
      const protocol = mediaUrl.startsWith('https:') ? https : http;
      
      protocol.get(mediaUrl, (response: any) => {
        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);
          
          fileStream.on('finish', async () => {
            fileStream.close();
            try {
              const stats = await fs.promises.stat(filePath);
              resolve({ success: true, size: stats.size });
            } catch (error) {
              resolve({ success: false, error: 'Failed to get file stats' });
            }
          });
          
          fileStream.on('error', (error: any) => {
            resolve({ success: false, error: error.message });
          });
        } else {
          resolve({ success: false, error: `HTTP ${response.statusCode}` });
        }
      }).on('error', (error: any) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('Error downloading media:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  // Initialize Electron Store
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
          autoSync: false
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize Electron Store:', error);
  }

  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
