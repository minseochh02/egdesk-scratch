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
const browserWindows = new Map<number, BrowserWindow>();

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

// WordPress Server Management IPC handlers
let wordpressServerProcess: any = null;
let wordpressServerPort = 8000;
let wordpressServerFolder = '';

// Helper function to detect the best serving root (similar to wordpress-server.js)
function detectBestServingRoot(selectedPath: string): string {
  // Check if the selected path itself is a good serving root
  if (isGoodServingRoot(selectedPath)) {
    return selectedPath;
  }
  
  // Look for common subdirectories that should be served instead
  const possibleRoots = [
    path.join(selectedPath, 'www'),           // Your FTP structure
    path.join(selectedPath, 'wordpress'),    // Standard WordPress folder
    path.join(selectedPath, 'public_html'),  // Common hosting structure
    path.join(selectedPath, 'public'),       // Alternative hosting structure
    path.join(selectedPath, 'htdocs'),       // XAMPP structure
    selectedPath                             // Fallback to selected directory
  ];

  for (const root of possibleRoots) {
    if (isGoodServingRoot(root)) {
      console.log(`Detected best serving root: ${root}`);
      return root;
    }
  }

  // Default fallback to selected path
  console.log('No better serving root detected, using selected path');
  return selectedPath;
}

function isGoodServingRoot(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  try {
    const files = fs.readdirSync(dirPath);
    
    // Check for WordPress core files
    const wordpressFiles = [
      'wp-config.php',
      'wp-config-sample.php',
      'wp-load.php',
      'wp-blog-header.php',
      'index.php'
    ];

    // Check for WordPress directories
    const wordpressDirs = [
      'wp-admin',
      'wp-content',
      'wp-includes'
    ];

    // Check for HTML files (www folder structure)
    const htmlFiles = files.filter(file => 
      file.endsWith('.html') || file.endsWith('.htm')
    );

    // If it's a www folder with HTML files, it's likely your structure
    if (dirPath.includes('www') && htmlFiles.length > 0) {
      console.log(`Found www folder with ${htmlFiles.length} HTML files`);
      return true;
    }

    // Check for WordPress core files
    const hasWordPressFiles = wordpressFiles.some(file => 
      fs.existsSync(path.join(dirPath, file))
    );

    // Check for WordPress directories
    const hasWordPressDirs = wordpressDirs.some(dir => 
      fs.existsSync(path.join(dirPath, dir))
    );

    return hasWordPressFiles || hasWordPressDirs || htmlFiles.length > 0;
  } catch (error) {
    console.error('Error checking serving root:', error);
    return false;
  }
}

// Analyze WordPress folder
ipcMain.handle('wp-server-analyze-folder', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder does not exist' };
    }

    // Detect the best serving root
    const actualServingRoot = detectBestServingRoot(folderPath);
    
    // Analyze the actual serving root
    const hasIndexPhp = fs.existsSync(path.join(actualServingRoot, 'index.php'));
    const hasWpContent = fs.existsSync(path.join(actualServingRoot, 'wp-content'));
    const hasWpAdmin = fs.existsSync(path.join(actualServingRoot, 'wp-admin'));
    const hasWpIncludes = fs.existsSync(path.join(actualServingRoot, 'wp-includes'));
    
    // Get file counts from the serving root
    const files = fs.readdirSync(actualServingRoot);
    const htmlFiles = files.filter(file => file.endsWith('.html') || file.endsWith('.htm'));
    const phpFiles = files.filter(file => file.endsWith('.php'));
    
    const htmlFileCount = htmlFiles.length;
    const phpFileCount = phpFiles.length;
    const hasHtmlFiles = htmlFileCount > 0;
    
    // Determine folder type and server compatibility
    let folderType: 'www' | 'wordpress' | 'mixed' | 'unknown' = 'unknown';
    let hasWordPress = false;
    let detectedRoot: string | undefined = actualServingRoot;
    
    // Traditional WordPress detection
    const isTraditionalWordPress = hasIndexPhp && hasWpContent && (hasWpAdmin || hasWpIncludes);
    
    // www folder detection (HTML files present)
    const isWwwFolder = actualServingRoot.includes('www') && htmlFileCount > 0;
    
    // Any folder with files can be served by PHP server
    const hasAnyServeableFiles = htmlFileCount > 0 || phpFileCount > 0 || files.length > 0;
    
    if (isTraditionalWordPress && hasHtmlFiles) {
      folderType = 'mixed';
      hasWordPress = true;
    } else if (isTraditionalWordPress) {
      folderType = 'wordpress';
      hasWordPress = true;
    } else if (isWwwFolder || hasHtmlFiles) {
      folderType = 'www';
      hasWordPress = true; // www folders are valid for PHP server
    } else if (hasAnyServeableFiles) {
      folderType = 'unknown';
      hasWordPress = true; // Any folder with files can be served
    } else {
      folderType = 'unknown';
      hasWordPress = false;
    }
    
    // Check PHP version if available
    let phpVersion: string | undefined;
    try {
      const { execSync } = require('child_process');
      const version = execSync('/opt/homebrew/bin/php -v', { encoding: 'utf8' });
      phpVersion = version.split('\n')[0];
    } catch (error) {
      phpVersion = 'PHP not available';
    }

    return {
      success: true,
      info: {
        path: folderPath,
        exists: true,
        hasWordPress,
        hasIndexPhp,
        hasWpContent,
        hasWpAdmin,
        hasWpIncludes,
        hasHtmlFiles,
        htmlFileCount,
        phpFileCount,
        folderType,
        detectedRoot,
        availableFiles: htmlFiles.concat(phpFiles).slice(0, 10), // Limit to first 10 files
        phpVersion
      }
    };
  } catch (error) {
    console.error('Error analyzing WordPress folder:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Start WordPress server
ipcMain.handle('wp-server-start', async (event, folderPath, port = 8000) => {
  try {
    if (wordpressServerProcess) {
      return { success: false, error: 'Server is already running' };
    }

    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder does not exist' };
    }

    const { spawn } = require('child_process');
    
    // Detect the best serving root (like wordpress-server.js does)
    const actualServingRoot = detectBestServingRoot(folderPath);
    
    console.log(`Starting WordPress server on http://localhost:${port}`);
    console.log(`Selected folder: ${folderPath}`);
    console.log(`Serving from: ${actualServingRoot}`);
    
    // Check what we're serving (similar to wordpress-server.js logic)
    const files = fs.readdirSync(actualServingRoot);
    const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.htm'));
    const phpFiles = files.filter(f => f.endsWith('.php'));
    const folders = files.filter(f => fs.statSync(path.join(actualServingRoot, f)).isDirectory());
    
    console.log(`Found ${files.length} total files/directories`);
    if (htmlFiles.length > 0) console.log(`HTML files: ${htmlFiles.length}`);
    if (phpFiles.length > 0) console.log(`PHP files: ${phpFiles.length}`);
    if (folders.length > 0) console.log(`Folders: ${folders.join(', ')}`);
    
    // If it's a www folder with HTML files, show the main entry points
    if (actualServingRoot.includes('www') && htmlFiles.length > 0) {
      console.log(`\n🌐 Main HTML files available:`);
      htmlFiles.forEach(file => {
        console.log(`   http://localhost:${port}/${file}`);
      });
    }
    
    wordpressServerProcess = spawn('/opt/homebrew/bin/php', [
      '-S',
      `localhost:${port}`,
      '-t',
      actualServingRoot
    ]);

    wordpressServerPort = port;
    wordpressServerFolder = actualServingRoot;

    wordpressServerProcess.stdout.on('data', (data: Buffer) => {
      console.log('WordPress Server:', data.toString());
    });

    wordpressServerProcess.stderr.on('data', (data: Buffer) => {
      console.error('WordPress Server Error:', data.toString());
    });

    wordpressServerProcess.on('close', (code: number) => {
      console.log(`WordPress Server stopped with code ${code}`);
      wordpressServerProcess = null;
    });

    wordpressServerProcess.on('error', (error: Error) => {
      console.error('WordPress Server spawn error:', error);
      wordpressServerProcess = null;
    });

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true, port };
  } catch (error) {
    console.error('Error starting WordPress server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Stop WordPress server
ipcMain.handle('wp-server-stop', async (event) => {
  try {
    if (wordpressServerProcess) {
      wordpressServerProcess.kill();
      wordpressServerProcess = null;
      return { success: true };
    }
    return { success: false, error: 'No server running' };
  } catch (error) {
    console.error('Error stopping WordPress server:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Get WordPress server status
ipcMain.handle('wp-server-status', async (event) => {
  try {
    return {
      success: true,
      status: {
        isRunning: !!wordpressServerProcess,
        port: wordpressServerPort,
        url: `http://localhost:${wordpressServerPort}`,
        folderPath: wordpressServerFolder,
        pid: wordpressServerProcess?.pid
      }
    };
  } catch (error) {
    console.error('Error getting WordPress server status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Pick WordPress folder
ipcMain.handle('wp-server-pick-folder', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select WordPress Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false, error: 'No folder selected' };
  } catch (error) {
    console.error('Error picking WordPress folder:', error);
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

// Read file content
ipcMain.handle('fs-read-file', async (event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Write file content
ipcMain.handle('fs-write-file', async (event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-get-home-directory', async () => {
  return os.homedir();
});

// Browser Window management IPC handlers
ipcMain.handle('browser-window-create', async (event, options) => {
  try {
    const { url, title, width, height, x, y, show = true, webPreferences = {} } = options;
    
    const browserWindow = new BrowserWindow({
      width: width || 1200,
      height: height || 800,
      x: x || 100,
      y: y || 100,
      show: show,
      title: title || 'Browser Window',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        ...webPreferences
      }
    });

    const windowId = browserWindow.id;
    browserWindows.set(windowId, browserWindow);

    // Load the URL
    if (url) {
      await browserWindow.loadURL(url);
    }

    // Handle window close
    browserWindow.on('closed', () => {
      browserWindows.delete(windowId);
      // Notify renderer about window close
      mainWindow?.webContents.send('browser-window-closed', windowId);
    });

    // Handle URL changes
    browserWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      mainWindow?.webContents.send('browser-window-url-changed', windowId, navigationUrl);
    });

    browserWindow.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
      mainWindow?.webContents.send('browser-window-url-changed', windowId, navigationUrl);
    });

    return {
      success: true,
      windowId: windowId
    };
  } catch (error) {
    console.error('Failed to create browser window:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle('browser-window-close', async (event, windowId) => {
  try {
    const browserWindow = browserWindows.get(windowId);
    if (browserWindow) {
      browserWindow.close();
      browserWindows.delete(windowId);
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  } catch (error) {
    console.error('Failed to close browser window:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('browser-window-load-url', async (event, windowId, url) => {
  try {
    const browserWindow = browserWindows.get(windowId);
    if (browserWindow) {
      await browserWindow.loadURL(url);
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  } catch (error) {
    console.error('Failed to load URL:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('browser-window-reload', async (event, windowId) => {
  try {
    const browserWindow = browserWindows.get(windowId);
    if (browserWindow) {
      browserWindow.reload();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  } catch (error) {
    console.error('Failed to reload browser window:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// External browser control IPC handlers
ipcMain.handle('browser-window-launch-external', async (event, browserType, url) => {
  try {
    const { spawn } = require('child_process');
    let command: string;
    let args: string[];

    switch (browserType) {
      case 'chrome':
        command = process.platform === 'win32' ? 'chrome.exe' : 
                  process.platform === 'darwin' ? 'open' : 'google-chrome';
        args = process.platform === 'darwin' ? ['-a', 'Google Chrome', url] : [url];
        break;
      case 'firefox':
        command = process.platform === 'win32' ? 'firefox.exe' : 
                  process.platform === 'darwin' ? 'open' : 'firefox';
        args = process.platform === 'darwin' ? ['-a', 'Firefox', url] : [url];
        break;
      case 'safari':
        if (process.platform !== 'darwin') {
          return { success: false, error: 'Safari is only available on macOS' };
        }
        command = 'open';
        args = ['-a', 'Safari', url];
        break;
      case 'edge':
        command = process.platform === 'win32' ? 'msedge.exe' : 
                  process.platform === 'darwin' ? 'open' : 'microsoft-edge';
        args = process.platform === 'darwin' ? ['-a', 'Microsoft Edge', url] : [url];
        break;
      default:
        return { success: false, error: 'Unsupported browser type' };
    }

    const browserProcess = spawn(command, args, { detached: true, stdio: 'ignore' });
    browserProcess.unref();

    return {
      success: true,
      process: {
        pid: browserProcess.pid,
        browserType: browserType
      }
    };
  } catch (error) {
    console.error('Failed to launch external browser:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Global refresh for all localhost browser windows
ipcMain.handle('browser-window-refresh-all-localhost', async () => {
  try {
    console.log('🔄 Refreshing all browser windows showing localhost...');
    let refreshedCount = 0;
    
    // Iterate through all browser windows
    for (const [windowId, browserWindow] of browserWindows.entries()) {
      try {
        const currentUrl = browserWindow.webContents.getURL();
        
        // Check if the window is showing localhost
        if (currentUrl && (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))) {
          console.log(`🔄 Refreshing browser window ${windowId} showing ${currentUrl}`);
          browserWindow.reload();
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to refresh browser window ${windowId}:`, error);
      }
    }
    
    console.log(`✅ Refreshed ${refreshedCount} localhost browser window(s)`);
    return { success: true, refreshedCount };
  } catch (error) {
    console.error('❌ Failed to refresh localhost browser windows:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('browser-window-close-external', async (event, pid) => {
  try {
    if (process.platform === 'win32') {
      require('child_process').exec(`taskkill /PID ${pid} /F`);
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to close external browser:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('browser-window-navigate-external', async (event, pid, url) => {
  try {
    // For external browsers, we can't directly control navigation
    // This is a limitation of external browser control
    // We could potentially use browser automation tools like Puppeteer or Playwright
    // For now, we'll just return success as the URL change is handled by the browser itself
    return { success: true };
  } catch (error) {
    console.error('Failed to navigate external browser:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Main window management IPC handlers
ipcMain.handle('main-window-get-bounds', async () => {
  try {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      return { success: true, bounds };
    }
    return { success: false, error: 'Main window not found' };
  } catch (error) {
    console.error('Failed to get main window bounds:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('main-window-set-bounds', async (event, bounds) => {
  try {
    if (mainWindow) {
      mainWindow.setBounds(bounds);
      return { success: true };
    }
    return { success: false, error: 'Main window not found' };
  } catch (error) {
    console.error('Failed to set main window bounds:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('main-window-set-size', async (event, width, height) => {
  try {
    if (mainWindow) {
      mainWindow.setSize(width, height);
      return { success: true };
    }
    return { success: false, error: 'Main window not found' };
  } catch (error) {
    console.error('Failed to set main window size:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('main-window-set-position', async (event, x, y) => {
  try {
    if (mainWindow) {
      mainWindow.setPosition(x, y);
      return { success: true };
    }
    return { success: false, error: 'Main window not found' };
  } catch (error) {
    console.error('Failed to set main window position:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('fs-get-system-directories', async () => {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  let systemDirs = [];
  
  if (platform === 'darwin') { // macOS
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: 'desktop' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: 'download' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
      { name: '영화', path: path.join(homeDir, 'Movies'), icon: 'video' },
      { name: '애플리케이션', path: '/Applications', icon: 'rocket' }
    ];
  } else if (platform === 'win32') { // Windows
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: 'desktop' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: 'download' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
      { name: '비디오', path: path.join(homeDir, 'Videos'), icon: 'video' }
    ];
  } else { // Linux
    systemDirs = [
      { name: '바탕화면', path: path.join(homeDir, 'Desktop'), icon: 'desktop' },
      { name: '문서', path: path.join(homeDir, 'Documents'), icon: 'folder' },
      { name: '다운로드', path: path.join(homeDir, 'Downloads'), icon: 'download' },
      { name: '사진', path: path.join(homeDir, 'Pictures'), icon: 'image' },
      { name: '음악', path: path.join(homeDir, 'Music'), icon: 'music' },
      { name: '비디오', path: path.join(homeDir, 'Videos'), icon: 'video' }
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
