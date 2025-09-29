/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of EGDesk's main process. You can start
 * renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { autonomousGeminiClient } from './ai-code/gemini-autonomous-client';
import { WordPressHandler } from './wordpress/wordpress-handler';
import { LocalServerManager } from './php/local-server';
import { BrowserController } from './browser-controller';
import { initializeStore, getStore } from './storage';
import { getSQLiteManager } from './sqlite/manager';
import { aiChatDataService } from './ai-code/ai-chat-data-service';
import { registerFileSystemHandlers } from './fs';
import { backupHandler } from './codespace/backup-handler';
import { ScheduledPostsExecutor } from './scheduler/scheduled-posts-executor';
let wordpressHandler: WordPressHandler;
let localServerManager: LocalServerManager;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let browserController: BrowserController;
let scheduledPostsExecutor: ScheduledPostsExecutor;


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
  // Initialize Electron Store first
  try {
    await initializeStore();
    const store = getStore();
    console.log('✅ Electron Store initialized successfully');

    try {
      ipcMain.handle('start-automation', async (_event, creds?: { id?: string; pw?: string; proxy?: string }) => {
        const { runAutomation } = require('./automator');
        return await runAutomation(creds?.id, creds?.pw, creds?.proxy);
      });
      ipcMain.handle('start-woori-automation', async (_event, opts?: { id?: string; password?: string; proxy?: string; geminiApiKey?: string }) => {
        const { runShinhanAutomation } = require('./bank-automator');
        return await runShinhanAutomation(undefined, opts?.password, opts?.id, opts?.proxy, opts?.geminiApiKey);
      });
    } catch (error) {
      console.error('❌ Failed to initialize Automation:', error);
    }

    // Initialize Autonomous Gemini AI Client with streaming and tool execution (handlers are auto-registered in constructor)
    try {
      // Force initialization of the singleton instance
      const client = autonomousGeminiClient;
      console.log('✅ Autonomous Gemini AI Client initialized');
      // Note: autonomousGeminiClient auto-registers IPC handlers in constructor
    } catch (error) {
      console.error('❌ Failed to initialize Autonomous Gemini AI Client:', error);
    }

    // Initialize central SQLite manager
    try {
      const sqliteManager = getSQLiteManager();
      const sqliteInitResult = await sqliteManager.initialize();
      if (!sqliteInitResult.success) {
        console.warn('⚠️ SQLite initialization failed:', sqliteInitResult.error);
      } else {
        console.log('✅ SQLite Manager initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize SQLite Manager:', error);
    }

    // Initialize AI Chat Data Service (handlers are auto-registered in constructor)
    try {
      // Force initialization of the singleton instance
      const dataService = aiChatDataService;
      console.log('✅ AI Chat Data Service initialized');
      // Note: aiChatDataService auto-registers IPC handlers in constructor
    } catch (error) {
      console.error('❌ Failed to initialize AI Chat Data Service:', error);
    }

    // Initialize Backup Handler (handlers are auto-registered in constructor)
    try {
      // Force initialization of the singleton instance
      const backupService = backupHandler;
      console.log('✅ Backup Handler initialized');
      // Note: backupHandler auto-registers IPC handlers in constructor
    } catch (error) {
      console.error('❌ Failed to initialize Backup Handler:', error);
    }

    // Initialize File System handlers
    try {
      registerFileSystemHandlers();
      console.log('✅ File System handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize File System handlers:', error);
    }

  } catch (error) {
    console.error('❌ CRITICAL: Failed to initialize Electron Store:', error);
  }

  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(app.getAppPath(), 'assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 500,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
        : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Now that mainWindow is created, initialize components that need it
  try {
    const store = getStore();

    // Initialize WordPress handler with the main window
    wordpressHandler = new WordPressHandler(store, mainWindow);
    await wordpressHandler.initialize();
    wordpressHandler.registerHandlers();

    // Initialize SQLite manager and register IPC handlers
    try {
      const sqliteManager = getSQLiteManager();
      await sqliteManager.initialize();
      sqliteManager.registerIPCHandlers();
      console.log('✅ SQLite Manager initialized and IPC handlers registered successfully');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite Manager:', error);
    }

    // Initialize Local Server Manager with the main window
    localServerManager = new LocalServerManager(mainWindow);
    await localServerManager.initialize();
    localServerManager.registerHandlers();

    // Initialize Browser controller with the main window
    browserController = new BrowserController(mainWindow);

    // Initialize Scheduled Posts Executor
    scheduledPostsExecutor = new ScheduledPostsExecutor();
    await scheduledPostsExecutor.start();

    console.log('✅ All components initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize components:', error);
  }

  // Register blog generation IPC handlers
  // registerBlogGenerationHandlers(); // TODO: Implement blog generation handlers

  // Load the HTML file with error handling
  const htmlPath = resolveHtmlPath('index.html');
  console.log('Loading HTML from:', htmlPath);
  
  // Check if the file exists in production
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    // Cross-platform file:// URL to path conversion
    let filePath: string;
    if (htmlPath.startsWith('file:///')) {
      // Windows: file:///C:/path -> C:/path
      // Unix: file:///path -> /path
      filePath = htmlPath.replace('file:///', '');
    } else if (htmlPath.startsWith('file://')) {
      // Fallback for file:// (2 slashes)
      filePath = htmlPath.replace('file://', '');
    } else {
      filePath = htmlPath;
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('Built HTML file not found at:', filePath);
      console.error('Please run npm run build first to create the production build.');
      return;
    }
  }
  
  mainWindow.loadURL(htmlPath);

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

app.on('before-quit', async () => {
  // Cleanup WordPress handler resources
  if (wordpressHandler) {
    wordpressHandler.cleanup();
  }

  // Cleanup Local Server Manager resources
  if (localServerManager) {
    localServerManager.cleanup();
  }

  // Cleanup browser controller resources
  if (browserController) {
    browserController.cleanup();
  }

  // Cleanup scheduled posts executor
  if (scheduledPostsExecutor) {
    await scheduledPostsExecutor.cleanup();
  }

  // Cleanup central SQLite manager
  const sqliteManager = getSQLiteManager();
  sqliteManager.cleanup();
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
