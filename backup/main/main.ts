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
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as fs from 'fs';
import * as os from 'os';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { PHPManager } from './php/php-manager';
import { autonomousGeminiClient } from './ai-code/gemini-autonomous-client';
import { toolRegistry } from './ai-code/tool-executor';
import { projectContextBridge } from './ai-code/project-context-bridge';
import { WordPressHandler } from './wordpress/wordpress-handler';
import { LocalServerManager } from './php/local-server';
import { BrowserController } from './browser-controller';
import { initializeStore, getStore } from './storage';
import { getSQLiteManager } from './sqlite/sqlite-manager';
import { createSchedulerManager } from './scheduler/scheduler-manager';
import { aiChatDataService } from './ai-code/ai-chat-data-service';
import { registerFileSystemHandlers } from './fs';
import { backupHandler } from './codespace/backup-handler';
let schedulerManager: any;
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

/**
 * Register blog generation IPC handlers
 */
function registerBlogGenerationHandlers(): void {
  // Generate blog content using Gemini AI
  ipcMain.handle('blog-generate-content', async (event, params) => {
    try {
      const { topics, topicSelectionMode, aiSettings } = params;
      
      // Set environment variables for the script
      const originalEnv = { ...process.env };
      process.env.GEMINI_API_KEY = aiSettings.apiKey;
      process.env.AI_PROVIDER = aiSettings.provider;
      process.env.AI_MODEL = aiSettings.model;
      process.env.IMAGE_GENERATION_ENABLED = aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = aiSettings.imageProvider;
      process.env.IMAGE_QUALITY = aiSettings.imageQuality;
      process.env.IMAGE_SIZE = aiSettings.imageSize;
      process.env.IMAGE_STYLE = aiSettings.imageStyle;
      process.env.IMAGE_ASPECT_RATIO = aiSettings.imageAspectRatio;

      // Import and run the blog generation script
      const { generateStructuredBlogContent } = require('./gemini-generate-blog');
      
      // Select topic based on mode
      const selectedTopic = selectTopic(topics, topicSelectionMode);
      
      // Generate content
      const result = await generateStructuredBlogContent(selectedTopic.topic, {
        imageGenerationEnabled: aiSettings.imageGenerationEnabled,
        imageProvider: aiSettings.imageProvider,
        imageQuality: aiSettings.imageQuality,
        imageSize: aiSettings.imageSize,
        imageStyle: aiSettings.imageStyle,
        imageAspectRatio: aiSettings.imageAspectRatio
      });

      // Restore original environment
      process.env = originalEnv;

      return {
        success: true,
        data: {
          ...result,
          selectedTopic: selectedTopic.topic
        }
      };
    } catch (error) {
      console.error('Error generating blog content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Generate and upload blog to WordPress
  ipcMain.handle('blog-generate-and-upload', async (event, params) => {
    try {
      const { topics, topicSelectionMode, wordpressSettings, aiSettings } = params;
      
      // Set environment variables for the script
      const originalEnv = { ...process.env };
      process.env.GEMINI_API_KEY = aiSettings.apiKey;
      process.env.AI_PROVIDER = aiSettings.provider;
      process.env.AI_MODEL = aiSettings.model;
      process.env.IMAGE_GENERATION_ENABLED = aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = aiSettings.imageProvider;
      process.env.IMAGE_QUALITY = aiSettings.imageQuality;
      process.env.IMAGE_SIZE = aiSettings.imageSize;
      process.env.IMAGE_STYLE = aiSettings.imageStyle;
      process.env.IMAGE_ASPECT_RATIO = aiSettings.imageAspectRatio;
      process.env.WORDPRESS_URL = wordpressSettings.url;
      process.env.WORDPRESS_USERNAME = wordpressSettings.username;
      process.env.WORDPRESS_PASSWORD = wordpressSettings.password;

      // Import and run the combined script
      const { generateAndUploadBlog } = require('./generate-and-upload-blog');
      
      const result = await generateAndUploadBlog({
        topics,
        topicSelectionMode,
        wordpressSettings,
        aiSettings
      });

      // Restore original environment
      process.env = originalEnv;

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error generating and uploading blog:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

/**
 * Select a topic based on the selection mode
 */
function selectTopic(topics: any[], mode: string = 'least-used'): any {
  if (!topics || topics.length === 0) {
    throw new Error('No topics available for selection');
  }

  switch (mode) {
    case 'random':
      return selectRandomTopic(topics);
    case 'round-robin':
      return selectRoundRobinTopic(topics);
    case 'least-used':
    default:
      return selectLeastUsedTopic(topics);
  }
}

/**
 * Select topic using round-robin (sequential) method
 */
function selectRoundRobinTopic(topics: any[]): any {
  const sortedTopics = topics.sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return -1;
    if (!b.lastUsed) return 1;
    return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
  });
  
  return sortedTopics[0];
}

/**
 * Select topic using random method
 */
function selectRandomTopic(topics: any[]): any {
  const randomIndex = Math.floor(Math.random() * topics.length);
  return topics[randomIndex];
}

/**
 * Select topic using least-used method
 */
function selectLeastUsedTopic(topics: any[]): any {
  const sortedTopics = topics.sort((a, b) => (a.count || 0) - (b.count || 0));
  return sortedTopics[0];
}


// WordPress handlers are now managed by WordPressHandler class

// WordPress server management is now handled by WordPressHandler class

// WordPress server helper functions are now in WordPressHandler class

// WordPress server and connection handlers are now managed by WordPressHandler class

// Storage-related IPC handlers are now in storage.ts

// File system IPC handlers are now managed by ReadFileTool class

// Browser Window management is now handled by BrowserController class

// Image download handler removed - was unused

// Debug workflow execution handler removed - was unused

// Browser window management and main window management are now handled by BrowserController class

// File system IPC handlers are now managed by ReadFileTool class



// Read File Tool IPC handlers are now managed by ReadFileTool class

// WordPress sync file operations are now managed by WordPressHandler class

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
    // Initialize Project Context Bridge
    try {
      console.log('✅ Project Context Bridge initialized');
      // Note: projectContextBridge auto-registers IPC handlers in constructor
    } catch (error) {
      console.error('❌ Failed to initialize Project Context Bridge:', error);
    }

    // Initialize Tool Registry (new autonomous tool executor)
    try {
      // The toolRegistry is automatically initialized with built-in tools
      console.log('✅ Tool Registry (Autonomous) initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Tool Registry:', error);
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

    // Initialize scheduler manager with store (critical component)
    try {
      console.log('🚀 Initializing SchedulerManager...');
      schedulerManager = createSchedulerManager(store);
      console.log('✅ SchedulerManager initialized successfully');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize SchedulerManager:', error);
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

    // Initialize Local Server Manager with the main window
    localServerManager = new LocalServerManager(mainWindow);
    await localServerManager.initialize();
    localServerManager.registerHandlers();

    // Initialize Browser controller with the main window
    browserController = new BrowserController(mainWindow);

    console.log('✅ All components initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize components:', error);
  }

  // Register blog generation IPC handlers
  registerBlogGenerationHandlers();

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

app.on('before-quit', () => {
  // Cleanup scheduler resources
  if (schedulerManager) {
    schedulerManager.cleanup();
  }
  
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
