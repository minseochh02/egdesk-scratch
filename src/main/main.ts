/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of EGDesk's main process. You can start
 * renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { autonomousGeminiClient } from './ai-code/gemini-autonomous-client';
import { WordPressHandler } from './wordpress/wordpress-handler';
import { NaverHandler } from './naver/naver-handler';
import { LocalServerManager } from './php/local-server';
import { BrowserController } from './browser-controller';
import { initializeStore, getStore } from './storage';
import { getSQLiteManager } from './sqlite/manager';
import { aiChatDataService } from './ai-code/ai-chat-data-service';
import { registerFileSystemHandlers } from './fs';
import { backupHandler } from './codespace/backup-handler';
import { ScheduledPostsExecutor } from './scheduler/scheduled-posts-executor';
import { setScheduledPostsExecutor } from './scheduler/executor-instance';
import { registerNaverBlogHandlers } from './naver-blog-handlers';
import { getGoogleAuthHandler } from './mcp/google-auth-handler';
import { registerEGDeskMCP, testEGDeskMCPConnection } from './mcp/registration-service';
import { registerGmailMCPHandlers } from './mcp/gmail-mcp-handler';
import { getMCPServerManager } from './mcp/mcp-server-manager';
import { createServer, IncomingMessage, ServerResponse } from 'http';
let wordpressHandler: WordPressHandler;
let naverHandler: NaverHandler;
let localServerManager: LocalServerManager;
let electronApiServer: any = null;
// Tunnel functionality removed

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
      ipcMain.handle('start-automation', async (_event, creds?: { id?: string; pw?: string; proxy?: string; title?: string; content?: string; tags?: string }) => {
        const { runAutomation } = require('./automator');
        return await runAutomation(creds?.id, creds?.pw, creds?.proxy, creds?.title, creds?.content, creds?.tags);
      });
      ipcMain.handle('start-woori-automation', async (_event, opts?: { id?: string; password?: string; proxy?: string; geminiApiKey?: string }) => {
        const { runShinhanAutomation } = require('./bank-automator');
        return await runShinhanAutomation(undefined, opts?.password, opts?.id, opts?.proxy, opts?.geminiApiKey);
      });
      ipcMain.handle('start-naver-blog-with-image', async (_event, opts?: { id?: string; password?: string; proxy?: string; title?: string; content?: string; tags?: string; includeDogImage?: boolean; dogImagePrompt?: string }) => {
        try {
          // Get the "egdesk" API key from store
          const { getStore } = require('./storage');
          const store = getStore();
          const aiKeys = store.get('ai-keys', []);
          const egdeskKey = aiKeys.find((key: any) => key.name === 'egdesk' && key.providerId === 'google' && key.fields?.apiKey);
          
          if (!egdeskKey) {
            throw new Error('No "egdesk" API key found. Please configure a Google/Gemini API key with the name "egdesk" in the AI Keys Manager.');
          }

          // Set the API key as environment variable
          process.env.GEMINI_API_KEY = egdeskKey.fields.apiKey;
          console.log(`🔑 Using "egdesk" API key for Naver Blog automation`);

          const { runNaverBlogAutomation } = require('./naver/browser-controller');
          return await runNaverBlogAutomation(
            {
              username: opts?.id || '',
              password: opts?.password || '',
              proxyUrl: opts?.proxy
            },
            {
              title: opts?.title || 'Test Title',
              content: opts?.content || 'Test Content',
              tags: opts?.tags || '#test'
            }
          );
        } catch (error) {
          console.error('❌ Naver Blog automation failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      ipcMain.handle('launch-chrome', async () => {
        try {
          const { chromium } = require('playwright');
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
      ipcMain.handle('test-paste-component', async () => {
        try {
          const { chromium } = require('playwright');
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
                // Try iframe
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

    // Initialize PHP Server handlers
    try {
      const { SimplePHPServerTest } = require('./mcp/api-server-test');
      let phpServerTest: any = null;

      ipcMain.handle('php-server-start', async (_event, port?: number) => {
        try {
          if (!phpServerTest) {
            phpServerTest = new SimplePHPServerTest(port || 8080);
          }
          const success = await phpServerTest.startServer();
          if (success) {
            const localIP = await phpServerTest.getLocalIP();
            return { 
              success: true, 
              port: port || 8080,
              localIP,
              url: `http://${localIP}:${port || 8080}`,
              helloUrl: `http://${localIP}:${port || 8080}/hello.php`
            };
          } else {
            return { success: false, error: 'Failed to start PHP server' };
          }
        } catch (error) {
          console.error('❌ PHP server start failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('php-server-stop', async () => {
        try {
          if (phpServerTest) {
            phpServerTest.stopServer();
            phpServerTest = null;
            return { success: true };
          }
          return { success: false, error: 'No server running' };
        } catch (error) {
          console.error('❌ PHP server stop failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('php-server-status', async () => {
        try {
          if (phpServerTest) {
            const localIP = await phpServerTest.getLocalIP();
            return { 
              success: true, 
              isRunning: true,
              port: phpServerTest.port,
              localIP,
              url: `http://${localIP}:${phpServerTest.port}`,
              helloUrl: `http://${localIP}:${phpServerTest.port}/hello.php`
            };
          }
          return { success: true, isRunning: false };
        } catch (error) {
          console.error('❌ PHP server status check failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('php-server-test-hello', async () => {
        try {
          if (phpServerTest) {
            const success = await phpServerTest.testHelloEndpoint();
            return { success, message: success ? 'Hello endpoint working' : 'Hello endpoint failed' };
          }
          return { success: false, error: 'No server running' };
        } catch (error) {
          console.error('❌ PHP server hello test failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('php-server-get-local-ip', async () => {
        try {
          const os = require('os');
          const interfaces = os.networkInterfaces();
          for (let iface of Object.values(interfaces) as any[]) {
            for (let alias of iface) {
              if (alias.family === 'IPv4' && !alias.internal) {
                return { success: true, ip: alias.address };
              }
            }
          }
          return { success: true, ip: 'localhost' };
        } catch (error) {
          console.error('❌ Get local IP failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('php-server-gmail-endpoint', async () => {
        try {
          if (phpServerTest) {
            const result = await phpServerTest.handleGmailRequest();
            return result;
          } else {
            return { 
              success: false, 
              error: 'PHP server not running. Please start the server first.' 
            };
          }
        } catch (error) {
          console.error('❌ Gmail endpoint error:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      console.log('✅ PHP Server handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PHP Server handlers:', error);
    }

    // ========================================================================
    // GOOGLE AUTH HANDLERS
    // ========================================================================
    try {
      const googleAuthHandler = getGoogleAuthHandler();

      ipcMain.handle('google-auth-sign-in', async () => {
        try {
          const result = await googleAuthHandler.signIn();
          return result;
        } catch (error) {
          console.error('❌ Google sign-in failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('google-auth-sign-out', async () => {
        try {
          const result = await googleAuthHandler.signOut();
          return result;
        } catch (error) {
          console.error('❌ Google sign-out failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('google-auth-is-signed-in', async () => {
        try {
          const isSignedIn = googleAuthHandler.isSignedIn();
          return { success: true, isSignedIn };
        } catch (error) {
          console.error('❌ Google auth check failed:', error);
          return { 
            success: false, 
            isSignedIn: false,
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('gmail-list-messages', async (_event, maxResults?: number) => {
        try {
          const result = await googleAuthHandler.listMessages(maxResults);
          return result;
        } catch (error) {
          console.error('❌ Gmail list messages failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('gmail-list-messages-basic', async (_event, maxResults?: number) => {
        try {
          const result = await googleAuthHandler.listMessagesBasic(maxResults);
          return result;
        } catch (error) {
          console.error('❌ Gmail list messages basic failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('gmail-get-message', async (_event, messageId: string) => {
        try {
          const result = await googleAuthHandler.getMessage(messageId);
          return result;
        } catch (error) {
          console.error('❌ Gmail get message failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('gmail-send-email', async (_event, to: string, subject: string, body: string) => {
        try {
          const result = await googleAuthHandler.sendEmail(to, subject, body);
          return result;
        } catch (error) {
          console.error('❌ Gmail send email failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

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

      // Simple environment check handler
      ipcMain.handle('env-check-config', async () => {
        try {
          const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;
          const supabaseUrl = process.env.SUPABASE_URL || 'https://cbptgzaubhcclkmvkiua.supabase.co';
          
          return { 
            success: true, 
            hasSupabaseKey,
            supabaseUrl,
            message: hasSupabaseKey ? 'Supabase configured' : 'Supabase anon key not found in environment'
          };
        } catch (error: any) {
          console.error('❌ Failed to check environment config:', error);
          return { success: false, error: error.message };
        }
      });

      console.log('✅ Google Auth and Gmail handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Auth handlers:', error);
    }

    // ========================================================================
    // ELECTRON HTTP API SERVER (for PHP to access Gmail)
    // ========================================================================
    try {
      const googleAuthHandler = getGoogleAuthHandler();
      
      electronApiServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:3333`);
        const pathname = url.pathname;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // Only handle /api/gmail endpoint
        if (pathname !== '/api/gmail') {
          res.writeHead(404);
          res.end(JSON.stringify({
            success: false,
            error: 'Not Found',
            message: 'Only /api/gmail endpoint is available',
            available_endpoints: ['/api/gmail'],
            timestamp: new Date().toISOString()
          }));
          return;
        }

        try {
          console.log('📧 HTTP request to Gmail API from PHP');
          
          // Check if user is signed in
          if (!googleAuthHandler.isSignedIn()) {
            res.writeHead(401);
            res.end(JSON.stringify({
              success: false,
              error: 'User not authenticated',
              message: 'Please sign in with Google in the Electron app first',
              timestamp: new Date().toISOString()
            }));
            return;
          }

          // Fetch Gmail messages
          const result = await googleAuthHandler.listMessages(10);
          
          if (result.success) {
            const response = {
              success: true,
              message: 'Gmail messages fetched successfully',
              data: {
                messages: result.messages,
                totalMessages: result.resultSizeEstimate,
                count: result.messages?.length || 0
              },
              timestamp: new Date().toISOString()
            };
            res.writeHead(200);
            res.end(JSON.stringify(response, null, 2));
          } else {
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              error: result.error || 'Failed to fetch Gmail messages',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error: any) {
          console.error('❌ Gmail API HTTP endpoint error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({
            success: false,
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
          }));
        }
      });

      // Start the API server on port 3333 (accessible only from localhost for security)
      electronApiServer.listen(3333, 'localhost', () => {
        console.log('✅ Electron HTTP API server started');
        console.log('📧 Gmail API endpoint: http://localhost:3333/api/gmail');
        console.log('🔒 Only accessible from localhost (PHP server can call it)');
      });

      electronApiServer.on('error', (error: any) => {
        console.error('❌ Electron API server error:', error);
      });

    } catch (error) {
      console.error('❌ Failed to initialize Electron HTTP API server:', error);
    }

    // Local tunnel handlers removed

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

    // Initialize Naver handler with the store
    naverHandler = new NaverHandler(store);
    naverHandler.registerHandlers();

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
    setScheduledPostsExecutor(scheduledPostsExecutor);
    await scheduledPostsExecutor.start();

    console.log('✅ All components initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize components:', error);
  }

    // Register blog generation IPC handlers
    // registerBlogGenerationHandlers(); // TODO: Implement blog generation handlers
    
    // Register Naver Blog automation handlers
    registerNaverBlogHandlers();
    
    // Register Gmail MCP handlers
    registerGmailMCPHandlers();
    
    // Register MCP Server Manager handlers
    const mcpServerManager = getMCPServerManager();
    mcpServerManager.registerIPCHandlers();

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

  // Cleanup Electron HTTP API server
  if (electronApiServer) {
    console.log('🛑 Closing Electron HTTP API server...');
    electronApiServer.close();
    electronApiServer = null;
  }

  // Tunnel cleanup removed
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
