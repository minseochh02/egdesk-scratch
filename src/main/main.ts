/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of EGDesk's main process. You can start
 * renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain, shell, dialog, powerSaveBlocker } from 'electron';

// NOTE: We do NOT set a global undici dispatcher here because it breaks website fetching.
// Instead, we configure custom dispatchers only for specific Gemini API calls that need longer timeouts.
// The @google/genai SDK will use the default fetch behavior, which should work fine for most cases.
// If Gemini API calls timeout, we'll handle it at the call site with retries or custom dispatchers.
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { autonomousGeminiClient } from './ai-code/gemini-autonomous-client';
import { WordPressHandler } from './wordpress/wordpress-handler';
import { NaverHandler } from './naver/naver-handler';
import { InstagramHandler } from './sns/instagram/instagram-handler';
import { YouTubeHandler } from './sns/youtube/youtube-handler';
import { FacebookHandler } from './sns/facebook/facebook-handler';
import { LocalServerManager } from './php/local-server';
import { PHPDownloadManager } from './php/php-installer';
import { BrowserController } from './browser-controller';
import { initializeStore, getStore } from './storage';
import { exec } from 'child_process';
import { isGitInstalled, GitError } from './utils/git';
import { getEGDeskDevSpreadsheetService } from './egdesk-dev-spreadsheet';
import { crawlWebsiteIntelligent, CrawlResult } from './company-research/company-research-stage1';
import { summarizeWebsiteContent, WebsiteSummary } from './company-research/company-research-stage2';
import { executeAgenticResearch, AgenticResearchData } from './company-research/company-research-stage3';
import { generateDetailedReport, DetailedReport } from './company-research/company-research-stage3b1';
import { generateExecutiveSummary, ExecutiveSummary } from './company-research/company-research-stage3b2';
import { exportReport } from './company-research/company-research-stage4';
import { processFullCompanyResearch } from './company-research/company-research-workflow';
import { migrateTokensToSupabase, hasTokenMigrationRun } from './auth/migrate-tokens-to-supabase';

function ensureGeminiApiKey(): string | null {
  const existing = process.env.GEMINI_API_KEY;
  if (typeof existing === 'string' && existing.trim().length > 0) {
    return existing.trim();
  }

  try {
    const store = getStore?.();
    const aiKeys = store ? store.get('ai-keys', []) : [];
    if (Array.isArray(aiKeys)) {
      const preferred =
        aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
        aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
        aiKeys.find((k: any) => k?.providerId === 'google');

      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        process.env.GEMINI_API_KEY = apiKey.trim();
        return process.env.GEMINI_API_KEY;
      }
    }
  } catch (error) {
    console.warn('[Instagram Launcher] Failed to resolve Gemini API key from store:', error);
  }

  return null;
}
import { getSQLiteManager } from './sqlite/manager';
import { aiChatDataService } from './ai-code/ai-chat-data-service';
import { registerFileSystemHandlers } from './fs';
import { backupHandler } from './codespace/backup-handler';
import { ScheduledPostsExecutor } from './scheduler/scheduled-posts-executor';
import { setScheduledPostsExecutor } from './scheduler/executor-instance';
import { DockerSchedulerService } from './docker/DockerSchedulerService';
import { setDockerSchedulerService } from './docker/docker-scheduler-instance';
import { PlaywrightSchedulerService } from './scheduler/playwright-scheduler-service';
import { setPlaywrightSchedulerService } from './scheduler/playwright-scheduler-instance';
import { registerNaverBlogHandlers } from './naver/blog-handlers';
import { registerChromeHandlers } from './chrome-handlers';
import { registerEGDeskMCP, testEGDeskMCPConnection } from './mcp/gmail/registration-service';
import { registerGmailMCPHandlers } from './mcp/gmail/gmail-mcp-handler';
import { getMCPServerManager } from './mcp/gmail/mcp-server-manager';
import { getLocalServerManager } from './mcp/server-creator/local-server-manager';
import { 
  registerServerName, 
  startTunnel, 
  stopTunnel, 
  getTunnelStatus, 
  getTunnelInfo, 
  getActiveTunnels, 
  stopAllTunnels,
  addPermissions,
  getPermissions,
  updatePermission,
  revokePermission
} from './mcp/server-creator/tunneling-manager';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { registerSEOHandlers } from './seo/seo-analyzer';
import { getAuthService } from './auth/auth-service';
import { ollamaManager } from './ollama/installer';
import { registerOllamaHandlers } from './ollama/ollama-handlers';
import { googleWorkspaceService } from './workspace';
import { registerAppsScriptToolHandlers } from './ai-code/tool-executor';
import { fetchWebsiteContent } from './web/content-fetcher';
import { crawlHomepageForBusinessIdentity } from './web/homepage-crawler';
import { crawlMultiplePagesForBusinessIdentity } from './web/multi-page-crawler';
import { generateBusinessIdentity, generateSnsPlan } from './web/ai-search';
import { AuthContext } from './sns/instagram/login';
import { createBusinessIdentityInstagramPost } from './sns/instagram';
import { dockerService } from './docker';

const envCandidates = new Set<string>();

if (app.isPackaged) {
  envCandidates.add(path.join(process.resourcesPath, '.env'));
} else {
  envCandidates.add(path.resolve(__dirname, '../../.env'));
}

envCandidates.add(path.resolve(process.cwd(), '.env'));

let envLoaded = false;
for (const candidate of envCandidates) {
  try {
    if (fs.existsSync(candidate)) {
      const result = dotenv.config({ path: candidate });
      if (!result.error) {
        envLoaded = true;
        break;
      }
    }
  } catch (error) {
    log.warn(`Failed to read environment file at ${candidate}:`, error);
  }
}

if (!envLoaded) {
  dotenv.config();
}
let wordpressHandler: WordPressHandler;
let naverHandler: NaverHandler;
let instagramHandler: InstagramHandler;
let youtubeHandler: YouTubeHandler;
let facebookHandler: FacebookHandler;
let localServerManager: LocalServerManager;
let electronApiServer: any = null;
// Tunnel functionality removed

const activeInstagramSessions: AuthContext[] = [];

/**
 * Generate a random MCP server name
 * Format: mcp-server-[6 random alphanumeric characters]
 * Example: mcp-server-a7f3k2
 */
function generateRandomServerName(): string {
  const randomString = Math.random().toString(36).substring(2, 8);
  return `mcp-server-${randomString}`;
}

/**
 * Validate OAuth token on app startup
 * Shows notification to user if token is invalid and needs refresh
 */
async function validateOAuthToken(mainWindow: BrowserWindow): Promise<void> {
  try {
    console.log('🔐 Checking OAuth token validity...');

    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();

    if (!token || !token.access_token) {
      // No token found - user hasn't signed in yet
      console.log('⚠️ No Google OAuth token found - user needs to sign in');

      // Ensure webContents is ready before sending
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('📤 Sending auth:token-invalid event to renderer...');
        mainWindow.webContents.send('auth:token-invalid', {
          message: 'Google 계정 연결이 필요합니다',
          detail: '스프레드시트 자동 동기화를 사용하려면 Google 계정으로 로그인해주세요.',
          needsSignIn: true
        });
        console.log('✅ Event sent successfully');
      } else {
        console.error('❌ Main window not ready or destroyed');
      }

      return;
    }

    // Token exists - check if it's valid by trying to use it
    // getGoogleWorkspaceToken() already handles refresh automatically
    // If we got here with a token, it should be valid
    console.log('✅ OAuth token is valid');

  } catch (error) {
    console.error('❌ OAuth token validation error:', error);

    // Show notification to user
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📤 Sending auth:token-invalid event (error case) to renderer...');
      mainWindow.webContents.send('auth:token-invalid', {
        message: 'Google 계정 인증 오류',
        detail: '계정을 다시 연결해주세요.',
        needsReauth: true
      });
      console.log('✅ Event sent successfully');
    } else {
      console.error('❌ Main window not ready or destroyed');
    }
  }
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false; // Don't auto-download, wait for user confirmation
    
    // Check for updates on startup (after a delay to not slow down app launch)
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);

    // Set up event handlers
    this.setupUpdateHandlers();
  }

  private setupUpdateHandlers(): void {
    // Update available - notify user
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.notifyUpdateAvailable(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available. Current version is latest.');
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      this.notifyDownloadProgress(progressObj);
    });

    // Update downloaded - ready to install
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.notifyUpdateDownloaded(info);
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      log.error('Update error:', error);
      this.notifyUpdateError(error);
    });
  }

  public checkForUpdates(): void {
    if (!app.isPackaged) {
      log.info('Skipping update check in development mode');
      return;
    }
    
    log.info('Checking for updates...');
    autoUpdater.checkForUpdates().catch((error) => {
      log.error('Failed to check for updates:', error);
    });
  }

  private notifyUpdateAvailable(info: any): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      });
    }
  }

  private notifyDownloadProgress(progressObj: { percent: number; transferred: number; total: number }): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
  }

  private notifyUpdateDownloaded(info: any): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      });
    }
  }

  private notifyUpdateError(error: Error): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: error.message,
      });
    }
  }

  // Public method to download update (called from renderer)
  public downloadUpdate(): void {
    log.info('Downloading update...');
    autoUpdater.downloadUpdate().catch((error) => {
      log.error('Failed to download update:', error);
      this.notifyUpdateError(error);
    });
  }

  // Public method to quit and install (called from renderer)
  public quitAndInstall(): void {
    log.info('Quitting and installing update...');
    
    // Set flag to indicate we're updating (skip cleanup that might block quit)
    isUpdating = true;
    
    // Ensure all windows are closable (important for update to work)
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      win.setClosable(true);
      win.removeAllListeners('close');
    });
    
    // On macOS without code signing, auto-restart may not work
    // Show a dialog informing the user
    if (process.platform === 'darwin') {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Installing',
        message: 'The app will now close to install the update.',
        detail: 'Please reopen EGDesk after it closes to use the new version.',
        buttons: ['OK']
      }).then(() => {
        autoUpdater.quitAndInstall(false, true);
        app.exit(0);
      });
    } else {
      // Windows - auto-restart usually works
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
        app.exit(0);
      }, 100);
    }
  }
}

// Flag to track if we're in the middle of an update
let isUpdating = false;

let mainWindow: BrowserWindow | null = null;
let browserController: BrowserController;
let appUpdater: AppUpdater | null = null;
let scheduledPostsExecutor: ScheduledPostsExecutor;
let dockerSchedulerService: DockerSchedulerService;
let playwrightSchedulerService: PlaywrightSchedulerService;
let keepAwakeBlockerId: number | null = null;
let handlersRegistered = false;

const getDefaultChromeProfileRoot = (): string | undefined => {
  const homeDir = app.getPath('home');

  if (process.platform === 'darwin') {
    return path.join(
      homeDir,
      'Library',
      'Application Support',
      'Google',
      'Chrome',
    );
  }

  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(localAppData, 'Google', 'Chrome', 'User Data');
  }

  if (process.platform === 'linux') {
    return path.join(homeDir, '.config', 'google-chrome');
  }

  return undefined;
};

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


import { registerEgChattingHandlers, initializeEgChattingService } from './sqlite/egchatting-service';
import { registerGmailHandlers } from './gmail-ipc-register';
import { registerSheetsHandlers } from './sheets-ipc-handler';
import { registerSyncSetupHandlers } from './ipc/sync-setup-handlers';
import { handleFullDiskAccess, checkFullDiskAccess, requestFullDiskAccess } from './utils/full-disk-access';

const createWindow = async () => {
  // Check Full Disk Access on macOS (non-blocking notification)
  if (process.platform === 'darwin') {
    handleFullDiskAccess('notification').then(hasAccess => {
      if (!hasAccess) {
        console.log('[Main] Full Disk Access not granted, notification shown to user');
      } else {
        console.log('[Main] Full Disk Access granted');
      }
    });
  }

  // Initialize Electron Store first
  try {
    await initializeStore();
    const store = getStore();
    console.log('✅ Electron Store initialized successfully');
    
    // Migration: Fix port 8081 -> 8080 for connections
    try {
      const config = store.get('mcpConfiguration');
      let updated = false;
      if (config && config.connections) {
        config.connections.forEach((conn: any) => {
          if (conn.accessLevel && conn.accessLevel.port === 8081) {
            console.log(`🔧 Migrating connection "${conn.name}" port from 8081 to 8080`);
            conn.accessLevel.port = 8080;
            updated = true;
          }
        });
        if (updated) {
          store.set('mcpConfiguration', config);
          console.log('✅ Port migration completed');
        }
      }
    } catch (migrationError) {
      console.warn('⚠️ Port migration warning:', migrationError);
    }

    // Migration: Move standalone mcpServerName to mcpConfiguration.serverName
    try {
      if (store.has('mcpServerName')) {
        const oldServerName = store.get('mcpServerName') as string;
        const config = store.get('mcpConfiguration');
        
        // Only migrate if the new location is empty
        if (oldServerName && !config.serverName) {
          console.log(`🔧 Migrating MCP server name: ${oldServerName}`);
          config.serverName = oldServerName;
          store.set('mcpConfiguration', config);
          store.delete('mcpServerName');
          console.log('✅ MCP server name migration completed');
        } else if (oldServerName && config.serverName) {
          // Both exist, just delete the old one
          console.log('🔧 Cleaning up old mcpServerName key');
          store.delete('mcpServerName');
        }
      }
    } catch (migrationError) {
      console.warn('⚠️ MCP server name migration warning:', migrationError);
    }

    // Only register IPC handlers once - skip if already registered
    if (!handlersRegistered) {
    try {
      ipcMain.handle('start-automation', async (_event, creds?: { id?: string; pw?: string; proxy?: string; title?: string; content?: string; tags?: string }) => {
        const { runAutomation } = require('./automator');
        return await runAutomation(creds?.id, creds?.pw, creds?.proxy, creds?.title, creds?.content, creds?.tags);
      });
      ipcMain.handle('start-woori-automation', async (_event, opts?: { id?: string; password?: string; proxy?: string }) => {
        const { runShinhanAutomation } = require('./financehub/bank-automator');
        // Note: ROBOFLOW_API_KEY should be set in environment variables
        return await runShinhanAutomation(undefined, opts?.password, opts?.id, opts?.proxy);
      });
      // Store active automator instances by bankId
      const activeAutomators = new Map();

      ipcMain.handle('finance-hub:open-browser', async (_event, { bankId, proxyUrl }) => {
        try {
          const { createAutomator } = require('./financehub');
          const automator = createAutomator(bankId, { headless: false });
          
          // Build proxy configuration
          const proxy = automator.buildProxyOption(proxyUrl);
          
          // Create browser using the automator's method
          console.log('[FINANCE-HUB] Creating browser for', bankId);
          const { browser, context } = await automator.createBrowser(proxy);
          automator.browser = browser;
          automator.context = context;
          
          // Setup context
          await automator.setupBrowserContext(context, null);
          
          // Create page
          automator.page = await context.newPage();
          await automator.setupBrowserContext(context, automator.page);
          
          // Navigate to URL (prefer inquiry URL for debug flow, otherwise login URL)
          const navigationUrl = automator.config.xpaths.inquiryUrl || automator.config.targetUrl;
          console.log('[FINANCE-HUB] Navigating to:', navigationUrl);
          await automator.page.goto(navigationUrl, { waitUntil: 'domcontentloaded' });
          await automator.page.waitForTimeout(2000);
          
          // Handle security popup if any
          if (automator.handleSecurityPopup) {
            await automator.handleSecurityPopup(automator.page);
          }
          
          // Store the automator instance
          activeAutomators.set(bankId, automator);
          
          console.log(`[FINANCE-HUB] Browser opened for ${bankId}. You can now manually log in.`);
          return { success: true, message: 'Browser opened. You can manually log in now.' };
        } catch (error) {
          console.error(`[FINANCE-HUB] Failed to open browser for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:login', async (_event, { bankId, credentials, proxyUrl }) => {
        try {
          // Check if we have an existing automator instance
          let automator = activeAutomators.get(bankId);
          
          if (!automator) {
            const { createAutomator } = require('./financehub');
            automator = createAutomator(bankId, { headless: false });
            activeAutomators.set(bankId, automator);
          }
          
          return await automator.login(credentials, proxyUrl);
        } catch (error) {
          console.error(`[FINANCE-HUB] Login failed for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:get-accounts', async (_event, { bankId, credentials, proxyUrl }) => {
        try {
          // Check if we have an existing automator instance
          let automator = activeAutomators.get(bankId);
          
          if (!automator) {
            const { createAutomator } = require('./financehub');
            automator = createAutomator(bankId, { headless: false });
            activeAutomators.set(bankId, automator);
            
            if (credentials) {
              await automator.login(credentials, proxyUrl);
            }
          }
          
          const accounts = await automator.getAccounts();
          return { success: true, accounts };
        } catch (error) {
          console.error(`[FINANCE-HUB] Failed to get accounts for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:get-transactions', async (_event, { bankId, accountNumber, startDate, endDate, parse }) => {
        try {
          const automator = activeAutomators.get(bankId);
          if (!automator) {
            throw new Error('No active browser session found. Please open browser or login first.');
          }
          
          if (parse && typeof automator.getTransactionsWithParsing === 'function') {
            return await automator.getTransactionsWithParsing(accountNumber, startDate, endDate);
          }
          
          const transactions = await automator.getTransactions(accountNumber, startDate, endDate);
          return { success: true, transactions };
        } catch (error) {
          console.error(`[FINANCE-HUB] Failed to get transactions for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:login-and-get-accounts', async (_event, { bankId, credentials, proxyUrl }) => {
        try {
          // Check if we have an existing automator instance
          let automator = activeAutomators.get(bankId);
          
          if (!automator) {
            const { createAutomator } = require('./financehub');
            automator = createAutomator(bankId, { headless: false });
            activeAutomators.set(bankId, automator);
          }
          
          const loginResult = await automator.login(credentials, proxyUrl);
          if (!loginResult.success) return loginResult;
          
          const accounts = await automator.getAccounts();
          return { ...loginResult, accounts };
        } catch (error) {
          console.error(`[FINANCE-HUB] Login and get accounts failed for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:get-connected-banks', async () => {
        // Return list of banks with active browser sessions
        const connectedBanks = [];
        for (const [bankId, automator] of activeAutomators.entries()) {
          if (automator.page && !automator.page.isClosed()) {
            connectedBanks.push({
              bankId,
              isLoggedIn: automator.isLoggedIn || false,
              userName: automator.userName || null
            });
          }
        }
        return connectedBanks;
      });

      ipcMain.handle('finance-hub:disconnect', async (_event, bankId) => {
        try {
          // Close browser and cleanup automator
          const automator = activeAutomators.get(bankId);
          if (automator) {
            await automator.cleanup(false); // Close browser on disconnect
            activeAutomators.delete(bankId);
          }

          // Delete all accounts for this bank from database
          const sqliteManager = getSQLiteManager();
          const financeHubManager = sqliteManager.getFinanceHubManager();
          const accounts = financeHubManager.getAccountsByBank(bankId);

          for (const account of accounts) {
            financeHubManager.deleteAccount(account.accountNumber);
            console.log(`[FINANCE-HUB] Deleted account ${account.accountNumber} for ${bankId}`);
          }

          return { success: true };
        } catch (error) {
          console.error(`[FINANCE-HUB] Disconnect failed for ${bankId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      // ========================================================================
      // CARD COMPANY AUTOMATION HANDLERS
      // ========================================================================

      /**
       * Helper: Get Arduino port with auto-detection
       */
      async function getArduinoPort(): Promise<string> {
        try {
          const { SerialPort } = require('serialport');
          const ports = await SerialPort.list();

          // Look for Arduino by Vendor ID, manufacturer, or common USB-Serial chips
          const arduinoPort = ports.find((port: any) => {
            // Arduino official VID
            if (port.vendorId === '2341' || port.vendorId === '0x2341') return true;

            // Manufacturer name
            if (port.manufacturer?.toLowerCase().includes('arduino')) return true;

            // Common USB-Serial chips in Arduino clones
            if (port.vendorId === '0403' || port.manufacturer?.toLowerCase().includes('ftdi')) return true;
            if (port.vendorId === '1a86' || port.manufacturer?.toLowerCase().includes('ch340')) return true;
            if (port.vendorId === '10c4' || port.manufacturer?.toLowerCase().includes('silicon labs')) return true;

            // Path patterns
            if (port.path?.includes('usbserial') || port.path?.includes('usbmodem')) return true;

            return false;
          });

          if (arduinoPort) {
            console.log(`🔍 Auto-detected Arduino on port: ${arduinoPort.path}`);
            // Save for future use
            store.set('financeHub.arduinoPort', arduinoPort.path);
            return arduinoPort.path;
          }

          // Fall back to saved setting
          const savedPort = store.get('financeHub.arduinoPort', 'COM3');
          console.log(`⚠️  No Arduino detected. Using saved port: ${savedPort}`);
          return savedPort;
        } catch (error) {
          console.error('Error detecting Arduino port:', error);
          return store.get('financeHub.arduinoPort', 'COM3');
        }
      }

      ipcMain.handle('finance-hub:card:login-and-get-cards', async (_event, { cardCompanyId, credentials, proxyUrl, manualPassword }) => {
        try {
          // Check if we have an existing automator instance
          let automator = activeAutomators.get(cardCompanyId);

          if (!automator) {
            const { cards } = require('./financehub');
            const arduinoPort = await getArduinoPort();
            automator = cards.createCardAutomator(cardCompanyId, {
              headless: false,
              arduinoPort,
              manualPassword: manualPassword ?? false
            });
            activeAutomators.set(cardCompanyId, automator);
          }

          const loginResult = await automator.login(credentials, proxyUrl);
          if (!loginResult.success) return loginResult;

          // For cards, we might have a getCards method instead of getAccounts
          let cards = [];
          if (typeof automator.getCards === 'function') {
            cards = await automator.getCards();
          } else if (typeof automator.getAccounts === 'function') {
            // Fallback if card automator uses accounts terminology
            cards = await automator.getAccounts();
          }

          return { ...loginResult, cards };
        } catch (error) {
          console.error(`[FINANCE-HUB] Login and get cards failed for ${cardCompanyId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:card:get-transactions', async (_event, { cardCompanyId, cardNumber, startDate, endDate }) => {
        try {
          let automator = activeAutomators.get(cardCompanyId);

          // If no active session, try to login automatically with saved credentials
          if (!automator) {
            console.log(`[FINANCE-HUB] No active session for ${cardCompanyId}, attempting auto-login...`);

            // Get saved credentials
            const fhConfig = getStore().get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
            const savedCredentials = (fhConfig.savedCredentials && fhConfig.savedCredentials[cardCompanyId]) || null;

            if (!savedCredentials) {
              throw new Error('No active browser session found. Please login first.');
            }

            console.log(`[FINANCE-HUB] Found saved credentials for ${cardCompanyId}, logging in...`);

            // Create new automator
            const { cards } = require('./financehub');
            const arduinoPort = await getArduinoPort();
            automator = cards.createCardAutomator(cardCompanyId, { headless: false, arduinoPort });
            activeAutomators.set(cardCompanyId, automator);

            // Login with saved credentials
            const loginResult = await automator.login(savedCredentials);
            if (!loginResult.success) {
              activeAutomators.delete(cardCompanyId);
              throw new Error(`Auto-login failed: ${loginResult.error || 'Unknown error'}`);
            }

            console.log(`[FINANCE-HUB] Auto-login successful for ${cardCompanyId}`);
          }

          const transactions = await automator.getTransactions(cardNumber, startDate, endDate);
          return { success: true, transactions };
        } catch (error) {
          console.error(`[FINANCE-HUB] Failed to get card transactions for ${cardCompanyId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      ipcMain.handle('finance-hub:card:disconnect', async (_event, cardCompanyId) => {
        try {
          // Close browser and cleanup automator
          const automator = activeAutomators.get(cardCompanyId);
          if (automator) {
            await automator.cleanup(false); // Close browser on disconnect
            activeAutomators.delete(cardCompanyId);
          }

          // Delete all accounts (cards) for this card company from database
          const sqliteManager = getSQLiteManager();
          const financeHubManager = sqliteManager.getFinanceHubManager();
          const accounts = financeHubManager.getAccountsByBank(cardCompanyId);

          for (const account of accounts) {
            financeHubManager.deleteAccount(account.accountNumber);
            console.log(`[FINANCE-HUB] Deleted account ${account.accountNumber} for ${cardCompanyId}`);
          }

          return { success: true };
        } catch (error) {
          console.error(`[FINANCE-HUB] Card disconnect failed for ${cardCompanyId}:`, error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      // ========================================================================
      // KEEPAWAKE FUNCTIONALITY
      // ========================================================================

      ipcMain.handle('keepawake:start', async () => {
        try {
          if (keepAwakeBlockerId !== null) {
            return { success: true, message: 'Keep awake is already active', isActive: true };
          }

          keepAwakeBlockerId = powerSaveBlocker.start('prevent-display-sleep');
          console.log('Keep awake started with blocker ID:', keepAwakeBlockerId);

          return { success: true, message: 'Keep awake activated', isActive: true };
        } catch (error) {
          console.error('Failed to start keep awake:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            isActive: false
          };
        }
      });

      ipcMain.handle('keepawake:stop', async () => {
        try {
          if (keepAwakeBlockerId === null) {
            return { success: true, message: 'Keep awake is not active', isActive: false };
          }

          powerSaveBlocker.stop(keepAwakeBlockerId);
          console.log('Keep awake stopped for blocker ID:', keepAwakeBlockerId);
          keepAwakeBlockerId = null;

          return { success: true, message: 'Keep awake deactivated', isActive: false };
        } catch (error) {
          console.error('Failed to stop keep awake:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            isActive: keepAwakeBlockerId !== null
          };
        }
      });

      ipcMain.handle('keepawake:status', async () => {
        try {
          const isActive = keepAwakeBlockerId !== null && powerSaveBlocker.isStarted(keepAwakeBlockerId);
          return {
            success: true,
            isActive,
            blockerId: keepAwakeBlockerId
          };
        } catch (error) {
          console.error('Failed to get keep awake status:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            isActive: false
          };
        }
      });

      ipcMain.handle('keepawake:toggle', async () => {
        try {
          if (keepAwakeBlockerId !== null) {
            // Stop keep awake
            powerSaveBlocker.stop(keepAwakeBlockerId);
            console.log('Keep awake toggled off for blocker ID:', keepAwakeBlockerId);
            keepAwakeBlockerId = null;
            return { success: true, message: 'Keep awake deactivated', isActive: false };
          } else {
            // Start keep awake
            keepAwakeBlockerId = powerSaveBlocker.start('prevent-display-sleep');
            console.log('Keep awake toggled on with blocker ID:', keepAwakeBlockerId);
            return { success: true, message: 'Keep awake activated', isActive: true };
          }
        } catch (error) {
          console.error('Failed to toggle keep awake:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            isActive: keepAwakeBlockerId !== null
          };
        }
      });

      // ========================================================================
      // AUTO-START FUNCTIONALITY
      // ========================================================================

      ipcMain.handle('autostart:get-status', async () => {
        try {
          const loginItemSettings = app.getLoginItemSettings();
          return {
            success: true,
            enabled: loginItemSettings.openAtLogin,
            openAsHidden: loginItemSettings.openAsHidden
          };
        } catch (error) {
          console.error('Failed to get auto-start status:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            enabled: false
          };
        }
      });

      ipcMain.handle('autostart:set', async (_event, enabled: boolean, openAsHidden: boolean = false) => {
        try {
          app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: openAsHidden,
          });
          console.log(`Auto-start ${enabled ? 'enabled' : 'disabled'}${openAsHidden ? ' (hidden)' : ''}`);
          return {
            success: true,
            enabled: enabled,
            openAsHidden: openAsHidden
          };
        } catch (error) {
          console.error('Failed to set auto-start:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            enabled: false
          };
        }
      });

      ipcMain.handle('autostart:toggle', async () => {
        try {
          const loginItemSettings = app.getLoginItemSettings();
          const newState = !loginItemSettings.openAtLogin;

          app.setLoginItemSettings({
            openAtLogin: newState,
            openAsHidden: false,
          });

          console.log(`Auto-start toggled ${newState ? 'on' : 'off'}`);
          return {
            success: true,
            enabled: newState
          };
        } catch (error) {
          console.error('Failed to toggle auto-start:', error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            enabled: false
          };
        }
      });

      ipcMain.handle('launch-chrome', async () => {
        try {
          const { chromium } = require('playwright-core');
          const browser = await chromium.launch({ 
            headless: false,
            channel: 'chrome'
          });
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto('https://blog.naver.com/GoBlogWrite.naver');
          console.log('🌐 Chrome launched and navigated to Naver Blog write page');
          return { success: true };
        } catch (error) {
          console.error('❌ Chrome launch failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      ipcMain.handle('crawl-website', async (event, { url, proxy, openDevTools }) => {
        try {
          const { chromium } = require('playwright-core');
          const fs = require('fs');
          const path = require('path');
          
          console.log('🕷️ Starting website crawler...');
          
          // Build proxy configuration if provided
          const proxyConfig = proxy ? { server: proxy } : undefined;
          
          // Launch browser
          const browser = await chromium.launch({ 
            headless: false,
            channel: 'chrome',
            proxy: proxyConfig
          });
          
          const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          });
          
          const page = await context.newPage();
          
          // Enable DevTools if requested
          if (openDevTools) {
            await page.pause();
          }
          
          console.log(`🌐 Navigating to: ${url}`);
          await page.goto(url, { 
            waitUntil: 'load',
            timeout: 60000
          });
          
          // Wait for network to be idle (but don't fail if it times out)
          try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
          } catch (networkIdleError) {
            console.warn(`⚠️ Network idle timeout for ${url} (page may still be loading)`);
          }
          
          // Wait a bit for dynamic content to load
          await page.waitForTimeout(2000);
          
          // Verify we're not stuck at about:blank
          const currentUrl = page.url();
          if (currentUrl === 'about:blank' || currentUrl.startsWith('about:')) {
            console.error(`❌ Navigation failed for ${url} - still at ${currentUrl}`);
            // Try navigation again
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          }
          
          // Extract all links
          const links = await page.evaluate(() => {
            const linkElements = document.querySelectorAll('a[href]');
            const links = Array.from(linkElements).map(link => ({
              href: link.getAttribute('href'),
              text: link.textContent?.trim() || '',
              title: link.getAttribute('title') || '',
              target: link.getAttribute('target') || ''
            }));
            return links;
          });
          
          // Extract forms
          const forms = await page.evaluate(() => {
            const formElements = document.querySelectorAll('form');
            return Array.from(formElements).map(form => ({
              action: form.getAttribute('action') || '',
              method: form.getAttribute('method') || 'GET',
              id: form.getAttribute('id') || '',
              className: form.getAttribute('class') || ''
            }));
          });
          
          // Extract images
          const images = await page.evaluate(() => {
            const imgElements = document.querySelectorAll('img[src]');
            return Array.from(imgElements).map(img => ({
              src: img.getAttribute('src'),
              alt: img.getAttribute('alt') || '',
              title: img.getAttribute('title') || '',
              width: img.getAttribute('width') || '',
              height: img.getAttribute('height') || ''
            }));
          });
          
          // Categorize links
          const baseUrl = new URL(url);
          const internalLinks: any[] = [];
          const externalLinks: any[] = [];
          const relativeLinks: any[] = [];
          
          links.forEach((link: any) => {
            if (!link.href) return;
            
            try {
              if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
                const linkUrl = new URL(link.href);
                if (linkUrl.hostname === baseUrl.hostname) {
                  internalLinks.push(link);
                } else {
                  externalLinks.push(link);
                }
              } else if (link.href.startsWith('/') || link.href.startsWith('./') || link.href.startsWith('../')) {
                relativeLinks.push(link);
              } else if (link.href.startsWith('#')) {
                // Skip anchor links
              } else {
                // Other relative links
                relativeLinks.push(link);
              }
            } catch (e) {
              // Invalid URL, skip
              console.warn('Invalid URL:', link.href);
            }
          });
          
          // Calculate statistics
          const stats = {
            totalLinks: links.length,
            internalLinks: internalLinks.length,
            externalLinks: externalLinks.length,
            relativeLinks: relativeLinks.length,
            forms: forms.length,
            images: images.length
          };
          
          // Create output directory if it doesn't exist
          // Use userData directory in production, cwd in development
          const outputDir = app.isPackaged
            ? path.join(app.getPath('userData'), 'output')
            : path.join(process.cwd(), 'output');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Save results to file
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const results = {
            url,
            timestamp: new Date().toISOString(),
            stats,
            links: {
              all: links,
              internal: internalLinks,
              external: externalLinks,
              relative: relativeLinks
            },
            forms,
            images
          };
          
          const filename = `crawler-results-${timestamp}.json`;
          const filepath = path.join(outputDir, filename);
          fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
          
          console.log(`📊 Crawler completed: ${stats.totalLinks} links found`);
          console.log(`💾 Results saved to: ${filepath}`);
          
          await browser.close();
          
          return {
            success: true,
            data: results,
            filepath
          };
          
        } catch (error) {
          console.error('❌ Crawler failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('web-fetch-content', async (_event, url: string) => {
        try {
          return await fetchWebsiteContent(url);
        } catch (error) {
          console.error('❌ Failed to fetch website content:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to fetch website content.'
                : 'Failed to fetch website content.',
          };
        }
      });

      // Git operations
      ipcMain.handle('git-clone', async (event, repoUrl: string, destPath: string) => {
        try {
          // Pre-flight check: ensure Git is installed
          if (!(await isGitInstalled())) {
            return {
              success: false,
              error: GitError.GIT_NOT_INSTALLED,
              message: 'Git is not installed on this system.',
            };
          }

          // Ensure the destination path exists before cloning
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }

          // The `exec` function returns a Promise-like object, but not a native Promise.
          // Wrap it in a Promise for async/await compatibility.
          await new Promise<void>((resolve, reject) => {
            exec(`git clone ${repoUrl} ${destPath}`, (error, stdout, stderr) => {
              if (error) {
                console.error(`Git clone stderr: ${stderr}`);
                reject(new Error(`Git clone failed: ${error.message}. Stderr: ${stderr}`));
              } else {
                console.log(`Git clone stdout: ${stdout}`);
                resolve();
              }
            });
          });
          return { success: true };
        } catch (error) {
          console.error('Error cloning repository:', error);
          return { 
            success: false, 
            error: (error as any).error || GitError.CLONE_FAILED,
            message: (error as Error).message 
          };
        }
      });

      // Homepage crawler for business identity
      ipcMain.handle('web-crawl-homepage', async (_event, url: string) => {
        try {
          return await crawlHomepageForBusinessIdentity(url);
        } catch (error) {
          console.error('❌ Failed to crawl homepage:', error);
          return {
            success: false,
            homepageUrl: url,
            error:
              error instanceof Error
                ? error.message || 'Failed to crawl homepage.'
                : 'Failed to crawl homepage.',
          };
        }
      });

      // Multi-page crawler for business identity
      ipcMain.handle('web-crawl-multiple-pages', async (_event, url: string, options?: { maxPages?: number; includePages?: string[] }) => {
        try {
          // Type cast includePages to match expected type
          const typedOptions = options ? {
            ...options,
            includePages: options.includePages as ('about' | 'contact' | 'products' | 'services' | 'blog' | 'careers' | 'pricing')[] | undefined
          } : undefined;
          return await crawlMultiplePagesForBusinessIdentity(url, typedOptions);
        } catch (error) {
          console.error('❌ Failed to crawl multiple pages:', error);
          return {
            success: false,
            domain: new URL(url).hostname,
            baseUrl: url,
            pages: [],
            siteStructure: {
              navigation: { main: 0, footer: 0 },
              commonPages: {},
            },
            combinedContent: {
              text: '',
              totalWordCount: 0,
              pagesCrawled: 0,
            },
            error:
              error instanceof Error
                ? error.message || 'Failed to crawl multiple pages.'
                : 'Failed to crawl multiple pages.',
          };
        }
      });

      // AI Search handlers for business identity
      ipcMain.handle('ai-search-generate-business-identity', async (_event, websiteText: string, rootUrl?: string, language?: string) => {
        try {
          return await generateBusinessIdentity(websiteText, rootUrl, language);
        } catch (error) {
          console.error('❌ Failed to generate business identity:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to generate business identity.'
                : 'Failed to generate business identity.',
          };
        }
      });

      ipcMain.handle('ai-search-generate-sns-plan', async (_event, identityData: any) => {
        try {
          // Get available blog platforms from user's connections
          const { getAvailableBlogPlatforms } = require('./web/get-available-blog-platforms');
          const availableBlogPlatforms = await getAvailableBlogPlatforms();
          console.log('[main] Available blog platforms for SNS plan:', availableBlogPlatforms);
          return await generateSnsPlan(identityData, availableBlogPlatforms);
        } catch (error) {
          console.error('❌ Failed to generate SNS plan:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to generate SNS plan.'
                : 'Failed to generate SNS plan.',
          };
        }
      });

      // IPC handler for company research intelligent crawl
      ipcMain.handle('company-research-crawl-intelligent', async (_event, domain: string, bypassCache: boolean = false) => {
        try {
          console.log(`[IPC] Starting intelligent crawl for domain: ${domain}${bypassCache ? ' (Bypassing cache)' : ''}`);
          const result: CrawlResult = await crawlWebsiteIntelligent(domain, bypassCache);
          return { success: true, data: result };
        } catch (error: any) {
          console.error(`❌ Intelligent crawl failed for ${domain}:`, error);
          return { 
            success: false, 
            error: error.message || 'Unknown error during intelligent crawl' 
          };
        }
      });

      // IPC handler for company research website summary
      ipcMain.handle('company-research-summarize', async (_event, crawlResult: CrawlResult, bypassCache: boolean = false) => {
        try {
          console.log(`[IPC] Starting website summary for domain: ${crawlResult.domain}${bypassCache ? ' (Bypassing cache)' : ''}`);
          const result: WebsiteSummary | null = await summarizeWebsiteContent(crawlResult, bypassCache);
          if (result) {
            return { success: true, data: result };
          } else {
            return { success: false, error: 'Failed to generate summary' };
          }
        } catch (error: any) {
          console.error(`❌ Website summary failed:`, error);
          return { 
            success: false, 
            error: error.message || 'Unknown error during summary' 
          };
        }
      });

      // IPC handler for company research agentic research
      ipcMain.handle('company-research-agentic-research', async (_event, domain: string, summary: WebsiteSummary, bypassCache: boolean = false) => {
        try {
          console.log(`[IPC] Starting agentic research for domain: ${domain}${bypassCache ? ' (Bypassing cache)' : ''}`);
          const result: AgenticResearchData | null = await executeAgenticResearch(domain, summary, bypassCache);
          if (result) {
            return { success: true, data: result };
          } else {
            return { success: false, error: 'Failed to perform research' };
          }
        } catch (error: any) {
          console.error(`❌ Agentic research failed:`, error);
          return { 
            success: false, 
            error: error.message || 'Unknown error during research' 
          };
        }
      });

      // IPC handler for company research stage 3B1: Detailed Report
      ipcMain.handle('company-research-generate-3b1', async (_event, domain: string, summary: WebsiteSummary, research: AgenticResearchData, inquiryData: any = {}, bypassCache: boolean = false) => {
        try {
          console.log(`[IPC] Starting Detailed Report (3B1) for domain: ${domain}${bypassCache ? ' (Bypassing cache)' : ''}`);
          const result: DetailedReport | null = await generateDetailedReport(domain, summary, research, inquiryData, bypassCache);
          if (result) {
            return { success: true, data: result };
          } else {
            return { success: false, error: 'Failed to generate detailed report' };
          }
        } catch (error: any) {
          console.error(`❌ Detailed report generation failed:`, error);
          return { success: false, error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for company research stage 3B2: Executive Summary
      ipcMain.handle('company-research-generate-3b2', async (_event, domain: string, detailedReportContent: string, inquiryData: any, summary: WebsiteSummary, research: AgenticResearchData, bypassCache: boolean = false) => {
        try {
          console.log(`[IPC] Starting Executive Summary (3B2) for domain: ${domain}${bypassCache ? ' (Bypassing cache)' : ''}`);
          const result: ExecutiveSummary | null = await generateExecutiveSummary(domain, detailedReportContent, inquiryData, summary, research, bypassCache);
          if (result) {
            return { success: true, data: result };
          } else {
            return { success: false, error: 'Failed to generate executive summary' };
          }
        } catch (error: any) {
          console.error(`❌ Executive summary generation failed:`, error);
          return { success: false, error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for company research stage 4: Export to File
      ipcMain.handle('company-research-export', async (_event, fileName: string, content: string, extension: 'md' | 'txt' = 'md') => {
        try {
          console.log(`[IPC] Exporting report: ${fileName}.${extension}`);
          const result = await exportReport(fileName, content, 'local', { extension });
          return result;
        } catch (error: any) {
          console.error(`❌ Export failed:`, error);
          return { success: false, error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for manual export of combined report
      ipcMain.handle('company-research-export-combined', async (_event, domain: string, execSummaryContent: string | null, detailedReportContent: string | null) => {
        try {
          console.log(`[IPC] Manually exporting combined report as DOCX for: ${domain}`);
          const { exportCombinedReportToUserPath } = await import('./company-research/company-research-stage4');
          const result = await exportCombinedReportToUserPath(domain, execSummaryContent, detailedReportContent);
          return result;
        } catch (error: any) {
          console.error(`❌ Combined Export failed:`, error);
          return { success: false, error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for exporting both reports as DOCX
      ipcMain.handle('company-research-export-docx', async (_event, domain: string, companyName: string, execSummaryContent: string | null, detailedReportContent: string | null) => {
        try {
          console.log(`[IPC] Exporting both reports as DOCX for: ${companyName} (${domain})`);
          const { exportBothReportsAsDocx } = await import('./company-research/company-research-stage4');
          const result = await exportBothReportsAsDocx(domain, companyName, execSummaryContent, detailedReportContent);
          return result;
        } catch (error: any) {
          console.error(`❌ DOCX Export failed:`, error);
          return { success: false, files: [], error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for opening reports folder
      ipcMain.handle('company-research-open-folder', async () => {
        try {
          const { openReportsFolder } = await import('./company-research/company-research-stage4');
          await openReportsFolder();
          return { success: true };
        } catch (error: any) {
          console.error(`❌ Open folder failed:`, error);
          return { success: false, error: error.message || 'Unknown error' };
        }
      });

      // IPC handler for FULL company research workflow (Stages 1-4)
      ipcMain.handle('company-research-full-process', async (_event, domain: string, inquiryData: any = {}, options: any = {}) => {
        try {
          console.log(`[IPC] Starting full company research for: ${domain}`);
          const result = await processFullCompanyResearch(
            domain, 
            inquiryData, 
            options, 
            mainWindow || undefined
          );
          return { success: !result.error, data: result, error: result.error };
        } catch (error: any) {
          console.error(`❌ Full research workflow failed for ${domain}:`, error);
          return { 
            success: false, 
            error: error.message || 'Unknown error during full research workflow' 
          };
        }
      });

      // Initialize EGChatting database before registering handlers
      console.log('[main] Initializing EGChatting database...');
      const egChattingInitResult = initializeEgChattingService();
      if (egChattingInitResult.success) {
        console.log('[main] ✅ EGChatting database initialized successfully');
      } else {
        console.error('[main] ❌ Failed to initialize EGChatting database:', egChattingInitResult.error);
        // Continue anyway - handlers will return empty arrays if DB is not available
      }
      
      // Register EGChatting IPC handlers
      registerEgChattingHandlers();
      
      // Chrome handlers moved to chrome-handlers.ts - see chrome-handlers.ts

      ipcMain.handle('open-instagram-with-profile', async (_event, opts?: { planId?: string; profilePath?: string; profileDirectory?: string; profileRoot?: string; targetUrl?: string; username?: string; password?: string; imagePath?: string; caption?: string; waitAfterShare?: number; structuredPrompt?: any }) => {
        // Use the separated business identity Instagram post handler
        return await createBusinessIdentityInstagramPost({
          planId: opts?.planId,
          username: opts?.username,
          password: opts?.password,
          imagePath: opts?.imagePath,
          caption: opts?.caption,
          structuredPrompt: opts?.structuredPrompt,
          profilePath: opts?.profilePath,
          profileDirectory: opts?.profileDirectory,
          profileRoot: opts?.profileRoot,
          targetUrl: opts?.targetUrl,
          waitAfterShare: opts?.waitAfterShare,
        });
      });

      ipcMain.handle('pick-chrome-profile-folder', async () => {
        try {
          const parentWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? null;
          const defaultDirectory = getDefaultChromeProfileRoot();

          const dialogOptions: Electron.OpenDialogOptions = {
            title: 'Select Chrome Profile Folder',
            buttonLabel: 'Select Profile',
            properties: ['openDirectory'],
            defaultPath: defaultDirectory,
          };

          const result = parentWindow
            ? await dialog.showOpenDialog(parentWindow, dialogOptions)
            : await dialog.showOpenDialog(dialogOptions);

          if (result.canceled || !result.filePaths?.length) {
            return {
              success: false,
              canceled: true,
            };
          }

          return {
            success: true,
            path: result.filePaths[0],
          };
        } catch (error) {
          console.error('[Instagram Launcher] Failed to pick Chrome profile folder:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to pick Chrome profile folder.'
                : 'Failed to pick Chrome profile folder.',
          };
        }
      });

      ipcMain.handle('list-chrome-profiles', async () => {
        try {
          const defaultDirectory = getDefaultChromeProfileRoot();
          if (!defaultDirectory) {
            return {
              success: false,
              error: 'Unsupported platform for automatic Chrome profile discovery.',
            };
          }

          const fs = require('fs');
          const fsPromises = require('fs/promises');

          if (!fs.existsSync(defaultDirectory)) {
            return {
              success: true,
              root: defaultDirectory,
              profiles: [],
            };
          }

          type ProfileInfo = {
            name: string;
            path: string;
            directoryName: string;
          };

          let infoCache: Record<
            string,
            {
              name?: string;
            }
          > = {};

          const localStatePath = path.join(defaultDirectory, 'Local State');
          if (fs.existsSync(localStatePath)) {
            try {
              const localStateRaw = await fsPromises.readFile(
                localStatePath,
                'utf8',
              );
              const localState = JSON.parse(localStateRaw);
              if (
                localState?.profile &&
                typeof localState.profile === 'object' &&
                localState.profile.info_cache &&
                typeof localState.profile.info_cache === 'object'
              ) {
                infoCache = localState.profile.info_cache as Record<
                  string,
                  { name?: string }
                >;
              }
            } catch (error) {
              console.warn(
                '[Instagram Launcher] Failed to parse Chrome Local State file:',
                error,
              );
            }
          }

          const entries = await fsPromises.readdir(defaultDirectory);

          const profileDirNames = entries.filter((name: string) => {
            if (!name || typeof name !== 'string') {
              return false;
            }

            const lower = name.toLowerCase();
            if (lower === 'default') {
              return true;
            }

            if (/^profile \d+$/i.test(name)) {
              return true;
            }

            if (/^guest profile$/i.test(name)) {
              return true;
            }

            if (/^system profile$/i.test(name)) {
              return false;
            }

            if (lower.endsWith('-profile')) {
              return true;
            }

            if (
              infoCache[name] &&
              typeof infoCache[name] === 'object' &&
              infoCache[name].name
            ) {
              return true;
            }

            const excludedPrefixes = [
              'crashpad',
              'swiftshader',
              'grshadercache',
              'shadercache',
              'certificate revocation',
              'component updater',
              'extensions',
              'system',
              'webstore',
              'gpu',
            ];

            return !excludedPrefixes.some((prefix) =>
              lower.startsWith(prefix),
            );
          });

          const profiles: ProfileInfo[] = profileDirNames
            .map((directoryName: string) => {
              const profilePath = path.join(defaultDirectory, directoryName);
              const preferencesPath = path.join(profilePath, 'Preferences');
              if (!fs.existsSync(preferencesPath)) {
                return null;
              }

              const displayName =
                infoCache[directoryName]?.name?.trim() || directoryName;

              return {
                name: displayName,
                path: profilePath,
                directoryName,
              };
            })
            .filter((profile: ProfileInfo | null) => {
              if (!profile || !profile.path) return false;
              try {
                const stat = fs.lstatSync(profile.path);
                return stat.isDirectory();
              } catch {
                return false;
              }
            })
            .sort((a: ProfileInfo, b: ProfileInfo) =>
              a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base',
              }),
            );

          return {
            success: true,
            root: defaultDirectory,
            profiles,
          };
        } catch (error) {
          console.error(
            '[Instagram Launcher] Failed to list Chrome profiles:',
            error,
          );
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to list Chrome profiles.'
                : 'Failed to list Chrome profiles.',
          };
        }
      });
      
      ipcMain.handle('test-paste-component', async () => {
        try {
          const { chromium } = require('playwright-core');
          const browser = await chromium.launch({ 
            headless: false,
            channel: 'chrome'
          });
          const context = await browser.newContext();
          const page = await context.newPage();
          
          console.log('🧪 Starting paste component test...');
          
          // Navigate to Naver Blog write page
          await page.goto('https://blog.naver.com/GoBlogWrite.naver');
          await page.waitForTimeout(3000);
          
          // Wait for login if needed
          const currentUrl = page.url();
          if (currentUrl.includes('nid.naver.com')) {
            console.log('🔐 Login required, waiting for manual login...');
            console.log('Please log in manually and close any popups. The test will continue automatically...');
            await page.waitForURL('**/GoBlogWrite.naver**', { timeout: 120000 }); // 2 minutes
            console.log('✅ Login completed, proceeding with test...');
          }
          
          // Wait a bit for any popups to be closed
          console.log('⏳ Waiting for any popups to be closed...');
          await page.waitForTimeout(3000);
          
          // Wait for the editor to load with multiple possible selectors
          console.log('⏳ Waiting for editor to load...');
          try {
            // Try multiple selectors for the editor
            await page.waitForSelector('.se-content.__se-scroll-target', { timeout: 15000 });
            console.log('✅ Editor loaded with .se-content.__se-scroll-target');
          } catch (error) {
            console.log('❌ .se-content.__se-scroll-target not found, trying alternative selectors...');
            
            try {
              // Try other possible selectors
              await page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });
              console.log('✅ Editor found with [contenteditable="true"]');
            } catch (error2) {
              console.log('❌ [contenteditable="true"] not found, trying iframe...');
              
              try {
                await page.waitForSelector('iframe', { timeout: 10000 });
                console.log('✅ Iframe found, editor might be inside iframe');
              } catch (error3) {
                console.log('❌ No editor found with any selector. Current URL:', page.url());
                console.log('Please check if you need to close any popups or if the page structure has changed.');
                return { 
                  success: false, 
                  error: 'No editor found. Please check if popups need to be closed or if page structure has changed.',
                  details: { currentUrl: page.url() }
                };
              }
            }
          }
          
          console.log('✅ Editor loaded, starting paste test...');
          
          // Test 1: Use the specific XPath you provided
          console.log('🔍 Looking for content area using your XPath...');
          const contentArea = page.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p');
          const contentAreaCount = await contentArea.count();
          console.log(`📝 Found ${contentAreaCount} element(s) with XPath`);
          
          if (contentAreaCount > 0) {
            // Test 1: Use the old method - first click, then right-click
            console.log('🖱️ Testing old method: first click, then right-click...');
            try {
              // First click on the targetField (or body if no targetField)
              if (contentArea) {
                await contentArea.first().click({ timeout: 5000 });
                console.log('✅ First click successful');
              } else {
                await page.click('body');
                console.log('✅ Clicked on body as fallback');
              }
              
              // Wait a bit
              await page.waitForTimeout(500);
              
              // Then right-click on the targetField
              if (contentArea) {
                await contentArea.first().click({ button: 'right', timeout: 5000 });
                console.log('✅ Right click successful');
              }
              
              // Wait a bit to see if context menu appears
              await page.waitForTimeout(1000);
              
              // Check if context menu is visible
              const contextMenu = page.locator('[role="menu"], .context-menu, .se-context-menu');
              const contextMenuCount = await contextMenu.count();
              console.log(`📋 Found ${contextMenuCount} context menu(s)`);
              
              if (contextMenuCount > 0) {
                console.log('✅ Context menu appeared!');
                // Try to find paste option
                const pasteOption = page.locator('text=Paste, text=붙여넣기, [data-action="paste"]');
                const pasteOptionCount = await pasteOption.count();
                console.log(`📋 Found ${pasteOptionCount} paste option(s)`);
                
                if (pasteOptionCount > 0) {
                  console.log('✅ Paste option found in context menu!');
                } else {
                  console.log('❌ No paste option found in context menu');
                }
              } else {
                console.log('❌ No context menu appeared');
              }
            } catch (error) {
              console.log('❌ Old method failed:', error instanceof Error ? error.message : 'Unknown error');
            }
            
            // Test 4: Try typing to see if we can focus
            console.log('⌨️ Testing keyboard input...');
            try {
              await contentArea.first().focus();
              await page.keyboard.type('Test content for paste component debugging');
              console.log('✅ Keyboard input successful');
            } catch (error) {
              console.log('❌ Keyboard input failed:', error);
            }
            
            // Test 5: Check for other possible content areas
            console.log('🔍 Checking for other content areas...');
            const otherContentAreas = [
              '[contenteditable="true"]',
              '.se-text-paragraph',
              '.se-component',
              '.se-module',
              'iframe'
            ];
            
            for (const selector of otherContentAreas) {
              const elements = page.locator(selector);
              const count = await elements.count();
              if (count > 0) {
                console.log(`📝 Found ${count} element(s) with selector: ${selector}`);
              }
            }
            
            // Test 6: Check for iframes
            console.log('🖼️ Checking for iframes...');
            const iframes = page.locator('iframe');
            const iframeCount = await iframes.count();
            console.log(`🖼️ Found ${iframeCount} iframe(s)`);
            
            if (iframeCount > 0) {
              for (let i = 0; i < iframeCount; i++) {
                const iframe = iframes.nth(i);
                const src = await iframe.getAttribute('src');
                const id = await iframe.getAttribute('id');
                console.log(`🖼️ Iframe ${i + 1}: id="${id}", src="${src}"`);
              }
            }
            
          } else {
            console.log('❌ No content area found');
          }
          
          // Keep browser open for manual inspection
          console.log('🔍 Browser kept open for manual inspection. Close manually when done.');
          
          return { 
            success: true, 
            message: 'Paste component test completed. Check console for detailed results.',
            details: {
              contentAreaCount,
              currentUrl: page.url(),
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          console.error('❌ Paste component test failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize Automation:', error);
    }

    // YouTube video upload test handler
    try {
      ipcMain.handle('test-youtube-upload', async (_event, opts?: {
        username?: string;
        password?: string;
        chromeUserDataDir?: string;
        chromeExecutablePath?: string;
        videoPath: string;
        title: string;
        description?: string;
        tags?: string[];
        visibility?: 'public' | 'unlisted' | 'private';
      }) => {
        try {
          if (!opts) {
            return { success: false, error: 'Options are required' };
          }

          const { username, password, chromeUserDataDir, chromeExecutablePath, videoPath, title, description, tags, visibility } = opts;

          // Validate authentication method
          const useChromeProfile = !!(chromeUserDataDir && chromeExecutablePath);
          const useCredentials = !!(username && password);

          if (!useChromeProfile && !useCredentials) {
            return { 
              success: false, 
              error: 'Either Chrome profile (chromeUserDataDir + chromeExecutablePath) OR username + password is required' 
            };
          }

          if (!videoPath) {
            return { success: false, error: 'Video file path is required' };
          }

          if (!title) {
            return { success: false, error: 'Video title is required' };
          }

          // Check if video file exists
          if (!fs.existsSync(videoPath)) {
            return { success: false, error: `Video file not found at path: ${videoPath}` };
          }

          console.log('[test-youtube-upload] Starting YouTube video upload test...');
          console.log('[test-youtube-upload] Authentication method:', useChromeProfile ? 'Chrome Profile' : 'Username/Password');
          console.log('[test-youtube-upload] Video path:', videoPath);
          console.log('[test-youtube-upload] Title:', title);
          console.log('[test-youtube-upload] Visibility:', visibility || 'public');

          // Import YouTube functions dynamically
          const { getAuthenticatedPage } = await import('./sns/youtube/login.js');
          const { createYouTubePost } = await import('./sns/youtube/youtube-post.js');

          // Get authenticated YouTube page
          const loginOptions: any = {};
          if (useChromeProfile) {
            loginOptions.chromeUserDataDir = chromeUserDataDir;
            loginOptions.chromeExecutablePath = chromeExecutablePath;
            console.log('[test-youtube-upload] Using Chrome profile:', chromeUserDataDir);
          } else {
            loginOptions.username = username;
            loginOptions.password = password;
            console.log('[test-youtube-upload] Using username/password authentication');
          }

          const authContext = await getAuthenticatedPage(loginOptions);

          try {
            // Create YouTube post
            await createYouTubePost(authContext.page, {
              videoPath,
              title,
              description,
              tags,
              visibility: visibility || 'public',
              waitAfterPublish: 30000,
            });

            // Wait a moment before closing
            await authContext.page.waitForTimeout(2000);

            // Close the browser
            await authContext.close();

            return {
              success: true,
              message: 'YouTube video upload test completed successfully',
            };
          } catch (error) {
            console.error('[test-youtube-upload] Error during upload:', error);
            try {
              await authContext.close();
            } catch (closeError) {
              console.warn('[test-youtube-upload] Failed to close browser:', closeError);
            }
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error during YouTube upload',
            };
          }
        } catch (error) {
          console.error('[test-youtube-upload] Failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize YouTube upload test handler:', error);
    }

    // YouTube video file picker handler
    try {
      ipcMain.handle('pick-video-file', async () => {
        try {
          const parentWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? null;

          const dialogOptions: Electron.OpenDialogOptions = {
            title: 'Select Video File',
            buttonLabel: 'Select Video',
            properties: ['openFile'],
            filters: [
              { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          };

          const result = parentWindow
            ? await dialog.showOpenDialog(parentWindow, dialogOptions)
            : await dialog.showOpenDialog(dialogOptions);

          if (result.canceled || !result.filePaths?.length) {
            return {
              success: false,
              canceled: true,
            };
          }

          return {
            success: true,
            filePath: result.filePaths[0],
          };
        } catch (error) {
          console.error('[YouTube] Failed to pick video file:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to pick video file.'
                : 'Failed to pick video file.',
          };
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize YouTube video file picker handler:', error);
    }

    // Image file picker handler (for Facebook, Instagram, etc.)
    try {
      ipcMain.handle('pick-image-file', async () => {
        try {
          const parentWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? null;

          const dialogOptions: Electron.OpenDialogOptions = {
            title: 'Select Image File',
            buttonLabel: 'Select Image',
            properties: ['openFile'],
            filters: [
              { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          };

          const result = parentWindow
            ? await dialog.showOpenDialog(parentWindow, dialogOptions)
            : await dialog.showOpenDialog(dialogOptions);

          if (result.canceled || !result.filePaths?.length) {
            return {
              success: false,
              canceled: true,
            };
          }

          return {
            success: true,
            filePath: result.filePaths[0],
          };
        } catch (error) {
          console.error('[Facebook/Instagram] Failed to pick image file:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message || 'Failed to pick image file.'
                : 'Failed to pick image file.',
          };
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize image file picker handler:', error);
    }

    // Facebook post test handler
    try {
      ipcMain.handle('test-facebook-post', async (_event, opts?: {
        username: string;
        password: string;
        imagePath?: string;
        text?: string;
      }) => {
        try {
          if (!opts) {
            return { success: false, error: 'Options are required' };
          }

          const { username, password, imagePath, text } = opts;

          if (!username || !password) {
            return { success: false, error: 'Facebook username and password are required' };
          }

          if (!text && !imagePath) {
            return { success: false, error: 'Either text or image path is required for Facebook post' };
          }

          // Check if image file exists if provided
          if (imagePath) {
            const fs = require('fs');
            if (!fs.existsSync(imagePath)) {
              return { success: false, error: `Image file not found at path: ${imagePath}` };
            }
          }

          console.log('[test-facebook-post] Starting Facebook post test...');
          console.log('[test-facebook-post] Has image:', !!imagePath);
          console.log('[test-facebook-post] Has text:', !!text);

          // Import Facebook functions dynamically
          const { getAuthenticatedPage } = await import('./sns/facebook/login.js');
          const { createFacebookPost } = await import('./sns/facebook/facebook-post.js');

          // Get authenticated Facebook page
          const authContext = await getAuthenticatedPage({
            username,
            password,
          });

          try {
            // Create Facebook post
            await createFacebookPost(authContext.page, {
              imagePath,
              text,
              waitAfterPost: 10000,
            });

            // Wait a moment for post to be fully processed
            await authContext.page.waitForTimeout(2000);

            // Bring page to front briefly so user can see the success
            try {
              await authContext.page.bringToFront();
              await authContext.page.waitForTimeout(1000);
            } catch (bringError) {
              console.warn('[test-facebook-post] Failed to bring Playwright page to front:', bringError);
            }

            console.log('[test-facebook-post] Facebook post created successfully. Closing browser...');

            // Close the browser after successful post
            try {
              await authContext.close();
              console.log('[test-facebook-post] Browser closed successfully');
            } catch (closeError) {
              console.warn('[test-facebook-post] Failed to close browser after successful post:', closeError);
            }

            return {
              success: true,
              message: 'Facebook post test completed successfully',
            };
          } catch (error) {
            console.error('[test-facebook-post] Error during post:', error);
            try {
              await authContext.close();
              console.log('[test-facebook-post] Browser closed after error');
            } catch (closeError) {
              console.warn('[test-facebook-post] Failed to close browser:', closeError);
            }
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error during Facebook post',
            };
          }
        } catch (error) {
          console.error('[test-facebook-post] Failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize Facebook post test handler:', error);
    }

    // Initialize central SQLite manager ONCE - all other services will use this singleton
    let sqliteInitialized = false;
    try {
      const sqliteManager = getSQLiteManager();
      const sqliteInitResult = await sqliteManager.initialize();
      if (!sqliteInitResult.success) {
        console.warn('⚠️ SQLite initialization failed:', sqliteInitResult.error);
      } else {
        console.log('✅ SQLite Manager initialized');
        sqliteInitialized = true;
      }
    } catch (error) {
      console.error('❌ Failed to initialize SQLite Manager:', error);
    }

    // Initialize services in parallel (they all use the already-initialized SQLite singleton)
    try {
      await Promise.all([
        // Initialize Autonomous Gemini AI Client with streaming and tool execution
        (async () => {
          try {
            const client = autonomousGeminiClient;
            console.log('✅ Autonomous Gemini AI Client initialized');
          } catch (error) {
            console.error('❌ Failed to initialize Autonomous Gemini AI Client:', error);
          }
        })(),
        
        // Initialize AI Chat Data Service
        (async () => {
          try {
            const dataService = aiChatDataService;
            // Wait for its internal initialization
            await (dataService as any).initializationPromise;
            console.log('✅ AI Chat Data Service initialized');
          } catch (error) {
            console.error('❌ Failed to initialize AI Chat Data Service:', error);
          }
        })(),
        
        // Initialize Backup Handler
        (async () => {
          try {
            const backupService = backupHandler;
            console.log('✅ Backup Handler initialized');
          } catch (error) {
            console.error('❌ Failed to initialize Backup Handler:', error);
          }
        })()
      ]);
    } catch (error) {
      console.error('❌ Failed to initialize some services:', error);
    }

    // Initialize File System handlers
    try {
      registerFileSystemHandlers();
      console.log('✅ File System handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize File System handlers:', error);
    }

    // Initialize Docker service (IPC handlers registered on import)
    try {
      // dockerService is a singleton that self-initializes on import
      // Just reference it to ensure it's loaded and log confirmation
      const _docker = dockerService;
      console.log('✅ Docker service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Docker service:', error);
    }

    // ========================================================================
    // MCP REGISTRATION HANDLERS
    // ========================================================================
    try {
      // MCP Registration handlers
      ipcMain.handle('mcp-register', async (_event, name: string, password?: string) => {
        try {
          console.log(`🔗 Registering MCP server: ${name}`);
          const result = await registerEGDeskMCP(name, password);
          return result;
        } catch (error: any) {
          console.error('❌ MCP registration error:', error);
          return { 
            success: false, 
            status: 'error', 
            message: error.message || 'Unknown error during MCP registration' 
          };
        }
      });

      ipcMain.handle('mcp-test-connection', async () => {
        try {
          console.log('🧪 Testing MCP connection...');
          const result = await testEGDeskMCPConnection();
          return { success: true, connected: result };
        } catch (error: any) {
          console.error('❌ MCP connection test error:', error);
          return { success: false, connected: false, error: error.message };
        }
      });

      // Tunnel registration handler
      ipcMain.handle('mcp-tunnel-register', async (_event, name: string, password?: string) => {
        try {
          console.log(`🌐 Registering tunnel for: ${name}`);
          const result = await registerServerName(name, password);
          return result;
        } catch (error: any) {
          console.error('❌ Tunnel registration error:', error);
          return {
            success: false,
            status: 'error',
            message: error.message || 'Unknown error during tunnel registration'
          };
        }
      });

      // Tunnel start handler (auto-registers and saves config)
      ipcMain.handle('mcp-tunnel-start', async (_event, serverName: string, localServerUrl?: string) => {
        // Capture logs for debugging
        const logs: string[] = [];
        const captureLog = (msg: string) => {
          const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
          logs.push(`[${timestamp}] ${msg}`);
          console.log(msg);
        };
        
        try {
          captureLog(`🚀 [IPC] Starting tunnel: ${serverName}`);
          captureLog(`   Local server URL: ${localServerUrl || 'http://localhost:8080 (default)'}`);
          captureLog(`   Environment: SUPABASE_URL=${process.env.SUPABASE_URL ? 'set' : 'NOT SET'}, TUNNEL_SERVER_URL=${process.env.TUNNEL_SERVER_URL || 'default'}`);
          
          const result = await startTunnel(serverName, localServerUrl);
          
          // Merge logs from startTunnel
          if (result._logs) {
            logs.push(...result._logs);
          }
          
          captureLog(`   [IPC] Final result: success=${result.success}, publicUrl=${result.publicUrl || 'none'}`);
          if (result.message) captureLog(`   [IPC] Message: ${result.message}`);
          if (result.error) captureLog(`   [IPC] Error: ${result.error}`);
          
          // Auto-save tunnel configuration to electron store if successful
          if (result.success && result.publicUrl) {
            try {
              const mcpConfig = store.get('mcpConfiguration');
              mcpConfig.tunnel = {
                registered: true,
                registrationId: result.registrationId || '',
                serverName: serverName,
                publicUrl: result.publicUrl,
                registeredAt: new Date().toISOString(),
                lastConnectedAt: new Date().toISOString(),
              };
              store.set('mcpConfiguration', mcpConfig);
              captureLog(`💾 Auto-saved tunnel configuration: ${result.publicUrl}`);
            } catch (saveError) {
              captureLog(`⚠️ Failed to auto-save tunnel config: ${saveError}`);
              // Don't fail the whole operation if save fails
            }
          }
          
          // Include captured logs in the result for debugging (remove internal _logs)
          const { _logs, ...cleanResult } = result;
          return { ...cleanResult, _debugLogs: logs };
        } catch (error: any) {
          captureLog(`❌ Failed to start tunnel: ${error.message || error}`);
          return {
            success: false,
            error: error.message || 'Unknown error',
            _debugLogs: logs
          };
        }
      });

      // Tunnel stop handler
      ipcMain.handle('mcp-tunnel-stop', async (_event, serverName: string) => {
        try {
          console.log(`🛑 Stopping tunnel: ${serverName}`);
          const result = stopTunnel(serverName);
          
          // Clear the stored tunnel configuration (success or failure)
          try {
            const mcpConfig = store.get('mcpConfiguration');
            mcpConfig.tunnel = {
              registered: false,
              registrationId: '',
              serverName: '',
              publicUrl: '',
              registeredAt: '',
              lastConnectedAt: '',
            };
            store.set('mcpConfiguration', mcpConfig);
            console.log(`💾 Cleared stored tunnel configuration`);
          } catch (clearError) {
            console.error('⚠️ Failed to clear tunnel config:', clearError);
            // Don't fail the whole operation if clear fails
          }
          
          return result;
        } catch (error: any) {
          console.error('❌ Failed to stop tunnel:', error);
          
          // Still try to clear stored config even on error
          try {
            const mcpConfig = store.get('mcpConfiguration');
            mcpConfig.tunnel = {
              registered: false,
              registrationId: '',
              serverName: '',
              publicUrl: '',
              registeredAt: '',
              lastConnectedAt: '',
            };
            store.set('mcpConfiguration', mcpConfig);
            console.log(`💾 Cleared stored tunnel configuration (after error)`);
          } catch (clearError) {
            console.error('⚠️ Failed to clear tunnel config:', clearError);
          }
          
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Tunnel status handler
      ipcMain.handle('mcp-tunnel-status', async (_event, serverName: string) => {
        try {
          const status = getTunnelStatus(serverName);
          return {
            success: true,
            ...status
          };
        } catch (error: any) {
          console.error('❌ Failed to get tunnel status:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Get tunnel info (including public URL)
      ipcMain.handle('mcp-tunnel-info', async (_event, serverName: string) => {
        try {
          const info = getTunnelInfo(serverName);
          return {
            success: true,
            ...info
          };
        } catch (error: any) {
          console.error('❌ Failed to get tunnel info:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Get active tunnels handler
      ipcMain.handle('mcp-tunnel-list', async () => {
        try {
          const tunnels = getActiveTunnels();
          return {
            success: true,
            tunnels
          };
        } catch (error: any) {
          console.error('❌ Failed to list tunnels:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Permission Management Handlers

      // Add permissions to a server
      ipcMain.handle('mcp-permissions-add', async (_event, request: {
        server_key: string;
        emails: string[];
        access_level?: 'read_only' | 'read_write' | 'admin';
        expires_at?: string;
        notes?: string;
      }) => {
        try {
          console.log(`🔐 Adding permissions to server: ${request.server_key}`);
          const result = await addPermissions(request);
          return result;
        } catch (error: any) {
          console.error('❌ Failed to add permissions:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Get permissions for a server
      ipcMain.handle('mcp-permissions-get', async (_event, serverKey: string) => {
        try {
          console.log(`🔐 Getting permissions for server: ${serverKey}`);
          const result = await getPermissions(serverKey);
          return result;
        } catch (error: any) {
          console.error('❌ Failed to get permissions:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Update a permission
      ipcMain.handle('mcp-permissions-update', async (_event, permissionId: string, updates: {
        access_level?: 'read_only' | 'read_write' | 'admin';
        expires_at?: string;
        notes?: string;
        status?: 'pending' | 'active' | 'revoked' | 'expired';
      }) => {
        try {
          console.log(`🔐 Updating permission: ${permissionId}`);
          const result = await updatePermission(permissionId, updates);
          return result;
        } catch (error: any) {
          console.error('❌ Failed to update permission:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Revoke a permission
      ipcMain.handle('mcp-permissions-revoke', async (_event, permissionId: string) => {
        try {
          console.log(`🔐 Revoking permission: ${permissionId}`);
          const result = await revokePermission(permissionId);
          return result;
        } catch (error: any) {
          console.error('❌ Failed to revoke permission:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Save tunnel configuration handler
      ipcMain.handle('save-tunnel-config', async (_event, config: {
        name: string;
        tunnelUrl: string;
        registeredAt: string;
        id?: string;
        ip?: string;
      }) => {
        try {
          console.log(`💾 Saving tunnel configuration for: ${config.name}`);
          
          // Get existing tunnel configs or initialize empty array
          const existingConfigs = store.get('tunnelConfigs', []) as any[];
          
          // Check if this tunnel name already exists
          const existingIndex = existingConfigs.findIndex((c: any) => c.name === config.name);
          
          if (existingIndex >= 0) {
            // Update existing configuration
            existingConfigs[existingIndex] = {
              ...existingConfigs[existingIndex],
              ...config,
              updatedAt: new Date().toISOString()
            };
          } else {
            // Add new configuration
            existingConfigs.push({
              ...config,
              createdAt: new Date().toISOString()
            });
          }
          
          // Save to store
          store.set('tunnelConfigs', existingConfigs);
          
          console.log(`✅ Tunnel configuration saved successfully`);
          return {
            success: true,
            message: 'Tunnel configuration saved successfully'
          };
        } catch (error: any) {
          console.error('❌ Failed to save tunnel configuration:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Get tunnel configurations handler
      ipcMain.handle('get-tunnel-configs', async () => {
        try {
          const tunnelConfigs = store.get('tunnelConfigs', []) as any[];
          return {
            success: true,
            configs: tunnelConfigs
          };
        } catch (error: any) {
          console.error('❌ Failed to get tunnel configurations:', error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            configs: []
          };
        }
      });

      // Get MCP server name handler
      ipcMain.handle('get-mcp-server-name', async () => {
        try {
          const mcpConfig = store.get('mcpConfiguration');
          let serverName = mcpConfig.serverName as string;
          
          // If no server name exists, generate a random one
          if (!serverName) {
            serverName = generateRandomServerName();
            mcpConfig.serverName = serverName;
            store.set('mcpConfiguration', mcpConfig);
            console.log(`🎲 Generated random MCP server name: ${serverName}`);
          }
          
          return {
            success: true,
            serverName
          };
        } catch (error: any) {
          console.error('❌ Failed to get MCP server name:', error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            serverName: 'mcp-server-' + Math.random().toString(36).substring(2, 8)
          };
        }
      });

      // Set MCP server name handler
      ipcMain.handle('set-mcp-server-name', async (_event, serverName: string) => {
        try {
          console.log(`💾 Setting MCP server name: ${serverName}`);
          const mcpConfig = store.get('mcpConfiguration');
          mcpConfig.serverName = serverName;
          store.set('mcpConfiguration', mcpConfig);
          return {
            success: true,
            message: 'MCP server name saved successfully'
          };
        } catch (error: any) {
          console.error('❌ Failed to set MCP server name:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
          };
        }
      });

      // Get MCP tunnel configuration
      ipcMain.handle('get-mcp-tunnel-config', async () => {
        try {
          const mcpConfig = store.get('mcpConfiguration');
          return {
            success: true,
            tunnel: mcpConfig.tunnel || {
              registered: false,
              registrationId: '',
              serverName: '',
              publicUrl: '',
              registeredAt: '',
              lastConnectedAt: '',
            }
          };
        } catch (error: any) {
          console.error('❌ Failed to get MCP tunnel config:', error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            tunnel: {
              registered: false,
              registrationId: '',
              serverName: '',
              publicUrl: '',
              registeredAt: '',
              lastConnectedAt: '',
            }
          };
        }
      });

      // Simple environment check handler
      ipcMain.handle('env-check-config', async () => {
        try {
          const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;
          const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || null;
          const supabaseUrl = process.env.SUPABASE_URL || 'https://cbptgzaubhcclkmvkiua.supabase.co';
          
          return { 
            success: true, 
            hasSupabaseKey,
            supabaseAnonKey,
            supabaseUrl,
            message: hasSupabaseKey ? 'Supabase configured' : 'Supabase anon key not found in environment'
          };
        } catch (error: any) {
          console.error('❌ Failed to check environment config:', error);
          return { success: false, error: error.message };
        }
      });

      // Debug info handler - useful for troubleshooting production issues
      ipcMain.handle('debug-info', async () => {
        try {
          const logPath = log.transports.file.getFile()?.path || 'unknown';
          
          return {
            success: true,
            environment: {
              NODE_ENV: process.env.NODE_ENV || 'not set',
              isPackaged: app.isPackaged,
              appPath: app.getAppPath(),
              resourcesPath: app.isPackaged ? process.resourcesPath : 'N/A (development)',
              userDataPath: app.getPath('userData'),
            },
            tunnelConfig: {
              SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 30)}...` : 'NOT SET',
              SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 10)}...` : 'NOT SET',
              TUNNEL_SERVER_URL: process.env.TUNNEL_SERVER_URL || 'https://tunneling-service.onrender.com (default)',
            },
            logging: {
              logFilePath: logPath,
            },
            platform: {
              platform: process.platform,
              arch: process.arch,
              nodeVersion: process.version,
              electronVersion: process.versions.electron,
            },
          };
        } catch (error: any) {
          console.error('❌ Failed to get debug info:', error);
          return { success: false, error: error.message };
        }
      });

      ipcMain.handle('ollama-check-installed', async () => {
        try {
          const installed = await ollamaManager.checkInstalled();
          return { success: true, installed };
        } catch (error: any) {
          console.error('❌ Ollama check failed:', error);
          return {
            success: false,
            installed: false,
            error: error?.message || 'Unknown error while checking Ollama status',
          };
        }
      });

      ipcMain.handle('ollama-ensure', async () => {
        try {
          const installed = await ollamaManager.ensureOllama();
          return {
            success: true,
            installed,
          };
        } catch (error: any) {
          console.error('❌ Ollama ensure failed:', error);
          return {
            success: false,
            installed: false,
            error: error?.message || 'Unable to ensure Ollama installation',
          };
        }
      });

      ipcMain.handle('ollama-install', async () => {
        try {
          const installed = await ollamaManager.install();
          return {
            success: installed,
            installed,
            message: installed ? 'Ollama installed successfully' : 'Ollama installation did not complete',
          };
        } catch (error: any) {
          console.error('❌ Ollama installation failed:', error);
          return {
            success: false,
            installed: false,
            error: error?.message || 'Ollama installation failed',
          };
        }
      });

      ipcMain.handle('ollama-start', async () => {
        try {
          const started = await ollamaManager.startOllama();
          return {
            success: started,
            started,
          };
        } catch (error: any) {
          console.error('❌ Ollama start failed:', error);
          return {
            success: false,
            started: false,
            error: error?.message || 'Unable to start Ollama',
          };
        }
      });

      ipcMain.handle('ollama-pull-model', async (_event, model: string) => {
        try {
          const pulled = await ollamaManager.pullModel(model);
          autonomousGeminiClient.updateOllamaModelAvailability(model, pulled);
          return {
            success: pulled,
            model,
          };
        } catch (error: any) {
          console.error(`❌ Ollama pull failed for ${model}:`, error);
          return {
            success: false,
            model,
            error: error?.message || `Unable to pull Ollama model "${model}"`,
          };
        }
      });

      ipcMain.handle('ollama-has-model', async (_event, model: string) => {
        if (!model) {
          return {
            success: false,
            exists: false,
            error: 'Model identifier is required',
          };
        }

        try {
          const exists = await ollamaManager.hasModel(model);
          autonomousGeminiClient.updateOllamaModelAvailability(model, exists);
          return {
            success: true,
            exists,
            model,
          };
        } catch (error: any) {
          console.error(`❌ Ollama model check failed for ${model}:`, error);
          return {
            success: false,
            exists: false,
            model,
            error: error?.message || `Unable to verify Ollama model "${model}"`,
          };
        }
      });

      console.log('✅ MCP Registration handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MCP Registration handlers:', error);
    }

    // Local tunnel handlers removed

      // Note: Don't set handlersRegistered = true here yet
      // We still need to register SQLite and component handlers below
      console.log('✅ Direct IPC handlers registered');
    } else {
      console.log('⏭️ Direct IPC handlers already registered, skipping...');
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

  // Register OAuth validation listener immediately after window creation
  // This ensures the listener is registered before the page loads
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('🕒 Renderer loaded, checking OAuth token...');
    // Give React a moment to mount
    setTimeout(async () => {
      try {
        await validateOAuthToken(mainWindow);
      } catch (error) {
        console.error('OAuth token validation failed:', error);
      }
    }, 2000); // Wait 2 seconds after page load to ensure React is mounted
  });

  // Now that mainWindow is created, initialize components that need it
  // Only register handlers once, but update component references each time
  try {
    const store = getStore();

    // Initialize or update WordPress handler with the main window
    // Only register handlers once, but update window reference each time
    if (!wordpressHandler) {
    wordpressHandler = new WordPressHandler(store, mainWindow);
    await wordpressHandler.initialize();
      if (!handlersRegistered) {
    wordpressHandler.registerHandlers();
      }
    } else {
      // Update mainWindow reference if handler already exists
      (wordpressHandler as any).mainWindow = mainWindow;
    }

    // Initialize or update Naver handler - only register handlers once
    if (!naverHandler) {
    naverHandler = new NaverHandler(store);
      if (!handlersRegistered) {
    naverHandler.registerHandlers();
      }
    }

    // Initialize or update Instagram handler - only register handlers once
    if (!instagramHandler) {
    instagramHandler = new InstagramHandler(store);
      if (!handlersRegistered) {
    instagramHandler.registerHandlers();
      }
    }

    // Initialize or update YouTube handler - only register handlers once
    if (!youtubeHandler) {
      youtubeHandler = new YouTubeHandler(store);
      if (!handlersRegistered) {
        youtubeHandler.registerHandlers();
      }
    }

    // Initialize or update Facebook handler - only register handlers once
    if (!facebookHandler) {
      facebookHandler = new FacebookHandler(store);
      if (!handlersRegistered) {
        facebookHandler.registerHandlers();
      }
    }

    // Register SQLite IPC handlers (database already initialized earlier) - only once
    if (!handlersRegistered) {
    try {
      const sqliteManager = getSQLiteManager();
      sqliteManager.registerIPCHandlers();
      console.log('✅ SQLite Manager IPC handlers registered');
    } catch (error) {
      console.error('❌ Failed to register SQLite IPC handlers:', error);
      }
    }

    // Initialize or update Local Server Manager with the main window
    if (!localServerManager) {
    localServerManager = new LocalServerManager(mainWindow);
    await localServerManager.initialize();
      if (!handlersRegistered) {
    localServerManager.registerHandlers();
      }
    } else {
      // Update mainWindow reference if manager already exists
      (localServerManager as any).mainWindow = mainWindow;
    }

    // Register PHP installer IPC handlers (once)
    if (!handlersRegistered) {
      const phpDownloadManager = PHPDownloadManager.getInstance();

      ipcMain.handle('php:check-downloaded', async () => {
        try {
          const downloaded = await phpDownloadManager.checkDownloaded();
          return { success: true, downloaded };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      ipcMain.handle('php:download', async () => {
        try {
          const success = await phpDownloadManager.downloadPHP(mainWindow);
          return { success };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      ipcMain.handle('php:ensure', async () => {
        try {
          const installed = await phpDownloadManager.ensurePHP(mainWindow);
          return { success: true, installed };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      ipcMain.handle('php:cancel-download', async () => {
        try {
          phpDownloadManager.cancelDownload();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      ipcMain.handle('php:is-downloading', async () => {
        try {
          const isDownloading = phpDownloadManager.isDownloading();
          return { success: true, isDownloading };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      console.log('✅ PHP Installer IPC handlers registered');
    }

    // Initialize or update Browser controller with the main window
    if (!browserController) {
    browserController = new BrowserController(mainWindow);
    } else {
      browserController.setMainWindow(mainWindow);
    }

    // Initialize Scheduled Posts Executor - only once
    if (!scheduledPostsExecutor) {
    scheduledPostsExecutor = new ScheduledPostsExecutor();
    setScheduledPostsExecutor(scheduledPostsExecutor);
    await scheduledPostsExecutor.start();
    }

    // Initialize Docker Scheduler Service - only once
    if (!dockerSchedulerService) {
      dockerSchedulerService = DockerSchedulerService.getInstance();
      setDockerSchedulerService(dockerSchedulerService);
      await dockerSchedulerService.start();
    }

    // Initialize Playwright Scheduler Service - only once
    if (!playwrightSchedulerService) {
      playwrightSchedulerService = PlaywrightSchedulerService.getInstance();
      setPlaywrightSchedulerService(playwrightSchedulerService);
      await playwrightSchedulerService.start();
    }

    console.log('✅ All components initialized successfully');

    // Initialize Scheduler Recovery Service (5 seconds after startup)
    setTimeout(async () => {
      try {
        console.log('🔄 Checking for missed scheduler executions...');

        const { getSchedulerRecoveryService } = await import('./scheduler/recovery-service');
        const recoveryService = getSchedulerRecoveryService();

        const report = await recoveryService.recoverMissedExecutions({
          lookbackDays: 3,         // 3-day lookback window (user preference)
          autoExecute: true,       // Auto-execute missed tasks
          maxCatchUpExecutions: 3, // Max 3 catch-up executions
          priorityOrder: 'oldest_first',
        });

        console.log('📊 Recovery Report:', report);

        // Send notification to renderer if missed executions were found
        if (report.missedCount > 0 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('scheduler:recovery-report', report);
        }
      } catch (error) {
        console.error('❌ Scheduler recovery failed:', error);
      }
    }, 5000); // 5-second delay to ensure all services are initialized
  } catch (error) {
    console.error('❌ Failed to initialize components:', error);
  }

  // Register additional handlers - only once
  if (!handlersRegistered) {
    // Register blog generation IPC handlers
    // registerBlogGenerationHandlers(); // TODO: Implement blog generation handlers
    
    // Register Naver Blog automation handlers
    registerNaverBlogHandlers();
    
    // Register Chrome browser automation handlers
    registerChromeHandlers();
    
    // Register Gmail MCP handlers
    registerGmailMCPHandlers();
    
    // Register Gmail handlers (for authentication and sending)
    registerGmailHandlers(mainWindow);
    
    // Register Sheets handlers
    registerSheetsHandlers();

    // Register Sync Setup handlers (auto-inject sync endpoints)
    registerSyncSetupHandlers();

    // Register Scheduler Recovery handlers
    const { registerSchedulerRecoveryHandlers } = await import('./scheduler/recovery-ipc-handler');
    registerSchedulerRecoveryHandlers();

    // Register MCP Server Manager handlers
    const mcpServerManager = getMCPServerManager();
    mcpServerManager.registerIPCHandlers();

    // Register MCP Local Server Manager handlers
    const mcpLocalServerManager = getLocalServerManager();
    mcpLocalServerManager.registerIPCHandlers();

    // Register Ollama handlers
    registerOllamaHandlers();

    // Register Google Workspace handlers
    googleWorkspaceService.registerIPCHandlers();
    
    // Register AppsScript tool handlers
    registerAppsScriptToolHandlers();

    // Register EGDesk Dev Spreadsheet handlers
    const egdeskDevService = getEGDeskDevSpreadsheetService();
    egdeskDevService.registerIPCHandlers();

    // Mark handlers as fully registered AFTER all handlers are registered
    handlersRegistered = true;
    console.log('✅ All IPC handlers registered (including SQLite and components)');
  }

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
  
  // Load the HTML file - this should always happen, even if handler registration had errors
  try {
  mainWindow.loadURL(htmlPath);
    console.log('[createWindow] Window URL loaded:', htmlPath);
  } catch (error) {
    console.error('[createWindow] Failed to load window URL:', error);
  }

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      console.error('Main window was not available during ready-to-show');
      return;
    }
    console.log('[createWindow] Window ready to show');
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      console.log('[createWindow] Window shown');
    }

    // Start keep awake by default
    try {
      if (keepAwakeBlockerId === null) {
        keepAwakeBlockerId = powerSaveBlocker.start('prevent-display-sleep');
        console.log('[Keep Awake] Started by default with blocker ID:', keepAwakeBlockerId);
      }
    } catch (error) {
      console.error('[Keep Awake] Failed to start by default:', error);
    }
  });

  // Add error handler for window loading
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[createWindow] Window failed to load:', {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[createWindow] Window DOM ready');
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

  // Open local file path
  ipcMain.handle('shell-open-path', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('[shell-open-path] Error opening file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Open external URL
  ipcMain.handle('shell-open-external', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('[shell-open-external] Error opening URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get current working directory
  ipcMain.handle('get-cwd', async () => {
    return process.cwd();
  });

  // Get absolute path for output file
  ipcMain.handle('get-absolute-output-path', async (_event, relativePath: string) => {
    const path = require('path');
    const fs = require('fs');
    // Use userData directory in production, cwd in development
    const baseDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'output')
      : process.cwd();
    const absolutePath = path.join(baseDir, relativePath);
    
    // Ensure output directory exists
    const outputDir = path.dirname(absolutePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return absolutePath;
  });

  // Full Disk Access handlers for macOS
  ipcMain.handle('check-full-disk-access', async () => {
    try {
      const hasAccess = await checkFullDiskAccess();
      return { success: true, hasAccess };
    } catch (error: any) {
      console.error('[Full Disk Access] Check error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('request-full-disk-access', async () => {
    try {
      const userOpened = await requestFullDiskAccess();
      return { success: true, userOpened };
    } catch (error: any) {
      console.error('[Full Disk Access] Request error:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize auto-updater
  appUpdater = new AppUpdater();

  // Register IPC handlers for update controls
  ipcMain.handle('app-updater-download', async () => {
    if (appUpdater) {
      appUpdater.downloadUpdate();
      return { success: true };
    }
    return { success: false, error: 'Updater not initialized' };
  });

  ipcMain.handle('app-updater-quit-and-install', async () => {
    if (appUpdater) {
      appUpdater.quitAndInstall();
      return { success: true };
    }
    return { success: false, error: 'Updater not initialized' };
  });

  ipcMain.handle('app-updater-check', async () => {
    if (appUpdater) {
      appUpdater.checkForUpdates();
      return { success: true };
    }
    return { success: false, error: 'Updater not initialized' };
  });
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  // BUT if we're updating, quit the app so the update can install
  if (process.platform !== 'darwin' || isUpdating) {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, recreate the window when the dock icon is clicked and there are no other windows open
  // This is the recommended approach from Electron docs
  console.log('[activate] App activated, checking windows...');
  const allWindows = BrowserWindow.getAllWindows();
  console.log(`[activate] Found ${allWindows.length} window(s)`);
  
  if (allWindows.length === 0) {
    console.log('[activate] No windows open, creating new window...');
    await createWindow();
    console.log('[activate] New window created');
  } else {
    // If window exists, focus it
    const window = allWindows[0];
    console.log(`[activate] Window exists, focusing... (minimized: ${window.isMinimized()}, visible: ${window.isVisible()})`);
    if (window.isMinimized()) {
      window.restore();
    }
    window.show();
    window.focus();
  }
});

app.on('before-quit', async () => {
  // If we're updating, skip cleanup to allow quick restart
  if (isUpdating) {
    log.info('Skipping cleanup - app is updating...');
    return;
  }

  // Cleanup keep awake blocker
  try {
    if (keepAwakeBlockerId !== null) {
      powerSaveBlocker.stop(keepAwakeBlockerId);
      console.log('[Keep Awake] Stopped on app quit, blocker ID:', keepAwakeBlockerId);
      keepAwakeBlockerId = null;
    }
  } catch (error) {
    console.error('[Keep Awake] Failed to cleanup on quit:', error);
  }

  const store = getStore();
  // Cleanup tunnels and clear stored config
  try {
    stopAllTunnels();
    const mcpConfig = store.get('mcpConfiguration');
    mcpConfig.tunnel = {
      registered: false,
      registrationId: '',
      serverName: '',
      publicUrl: '',
      registeredAt: '',
      lastConnectedAt: '',
    };
    store.set('mcpConfiguration', mcpConfig);
    console.log('💾 Cleared tunnel configuration on app quit');
  } catch (error) {
    console.error('⚠️ Failed to cleanup tunnels on quit:', error);
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

  // Cleanup scheduled posts executor
  if (scheduledPostsExecutor) {
    await scheduledPostsExecutor.cleanup();
  }

  // Cleanup Docker scheduler service
  if (dockerSchedulerService) {
    dockerSchedulerService.stop();
  }

  if (activeInstagramSessions.length > 0) {
    await Promise.all(
      activeInstagramSessions.splice(0).map(async (session) => {
        try {
          await session.close();
        } catch (error) {
          console.warn('[Instagram Launcher] Failed to close Playwright session on shutdown:', error);
        }
      }),
    );
  }

  // Cleanup central SQLite manager
  const sqliteManager = getSQLiteManager();
  sqliteManager.cleanup();

  // Cleanup Electron HTTP API server
  if (electronApiServer) {
    console.log('🛑 Closing Electron HTTP API server...');
    electronApiServer.close();
    electronApiServer = null;
  }

  // Tunnel cleanup removed
});

// Only register protocol in production
// In development, we'll use localhost redirect to avoid Windows path issues
if (!app.isPackaged) {
  // Development mode - don't register protocol, use localhost instead
  console.log('Development mode: Using localhost for OAuth redirects');
} else {
  // Production mode - register the protocol
  app.setAsDefaultProtocolClient('egdesk');
}

// Set up single instance lock (after protocol registration)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // Set up handler for when another instance tries to start
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Protocol URL is in command line on Windows
    const url = commandLine.find(arg => arg.startsWith('egdesk://'));
    if (url) {
      // The auth service will handle the OAuth callback
      console.log('Second instance received protocol URL:', url);
    }
    
    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app
  .whenReady()
  .then(() => {
    // Initialize auth service
    const authService = getAuthService();
    authService.registerHandlers();
    
    createWindow();
    
    // In development on Windows, create a local server to catch OAuth callbacks
    if (!app.isPackaged && process.platform === 'win32') {
      const server = createServer((req, res) => {
        if (req.url?.startsWith('/auth/callback')) {
          const fullUrl = `http://localhost:54321${req.url}`;
          console.log('OAuth callback received on localhost:', fullUrl);
          
          // Convert to egdesk:// URL format for the auth service to handle
          const egdeskUrl = fullUrl.replace('http://localhost:54321', 'egdesk://');
          
          // Let the auth service handle the OAuth callback
          authService.handleOAuthCallback(egdeskUrl).then(result => {
            console.log('OAuth callback handled:', result);
            
            // Notify renderer about auth state change
            if (mainWindow && !mainWindow.isDestroyed()) {
              const authData = {
                success: result.success,
                session: authService.currentSession,
                user: authService.currentSession?.user || null,
              };
              mainWindow.webContents.send('auth:state-changed', authData);
            }
          });
          
          // Send response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><script>window.close()</script>Logged in! You can close this tab.</body></html>');
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      server.listen(54321, () => {
        console.log('OAuth callback server listening on http://localhost:54321');
      });
      
      // Store server reference for cleanup
      (global as any).oauthCallbackServer = server;
    }
    
    // Set up deep link handler for OAuth callbacks (for production and non-Windows dev)
    // Pass a function that returns the current main window
    authService.setupDeepLinkHandler(() => mainWindow);

    // Run token migration to Supabase (Phase 3: Supabase Only)
    // This runs in the background after app startup
    setTimeout(async () => {
      if (!hasTokenMigrationRun()) {
        console.log('🔄 Starting automatic token migration to Supabase...');
        try {
          const results = await migrateTokensToSupabase();
          console.log('✅ Token migration complete:', results);

          if (results.migrated > 0) {
            console.log(`   ✅ Successfully migrated ${results.migrated} token(s) to Supabase`);
          }
          if (results.skipped > 0) {
            console.log(`   ℹ️ Skipped ${results.skipped} token(s) (already in Supabase)`);
          }
          if (results.failed > 0) {
            console.error(`   ⚠️ Failed to migrate ${results.failed} token(s)`);
          }
        } catch (error) {
          console.error('❌ Token migration failed:', error);
        }
      } else {
        console.log('✅ Token migration already completed previously');
      }
    }, 5000); // Wait 5 seconds after app startup to ensure everything is initialized

    // Note: activate handler is set up earlier in the file (line ~3226)
    // to ensure it's registered before app is ready

    // Note: Spreadsheet organization migration has been moved to run on first spreadsheet sync
    // instead of app startup to ensure Google OAuth token is available

    // Note: OAuth token validation is registered in createWindow() function
    // to ensure the listener is set up before the page loads
  })
  .catch(console.log);
