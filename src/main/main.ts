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
import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
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
import { registerNaverBlogHandlers } from './naver-blog-handlers';
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
import { fetchWebsiteContent } from './web/content-fetcher';
import { AuthContext, login as playwrightInstagramLogin, getAuthenticatedPage, loginWithPage } from './instagramlogin';
import { createInstagramPost } from './instagram-post';

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

async function waitForPageReady(page: any, maxWaitMs = 5000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const url = page.url();
      if (url && url !== 'about:blank' && url !== '') {
        return;
      }
    } catch (error) {
      // Page might not be ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}


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

    try {
      ipcMain.handle('start-automation', async (_event, creds?: { id?: string; pw?: string; proxy?: string; title?: string; content?: string; tags?: string }) => {
        const { runAutomation } = require('./automator');
        return await runAutomation(creds?.id, creds?.pw, creds?.proxy, creds?.title, creds?.content, creds?.tags);
      });
      ipcMain.handle('start-woori-automation', async (_event, opts?: { id?: string; password?: string; proxy?: string }) => {
        const { runShinhanAutomation } = require('./bank-automator');
        // Note: ROBOFLOW_API_KEY should be set in environment variables
        return await runShinhanAutomation(undefined, opts?.password, opts?.id, opts?.proxy);
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
      ipcMain.handle('crawl-website', async (event, { url, proxy, openDevTools }) => {
        try {
          const { chromium } = require('playwright');
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
          await page.goto(url, { waitUntil: 'networkidle' });
          
          // Wait a bit for dynamic content to load
          await page.waitForTimeout(2000);
          
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
          const outputDir = path.join(process.cwd(), 'output');
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
      
      ipcMain.handle('launch-chrome-with-url', async (event, { url, proxy, openDevTools, runLighthouse }) => {
        try {
          const { chromium } = require('playwright');
          
          // Build proxy option if provided
          let proxyOption;
          if (proxy) {
            try {
              const proxyUrl = new URL(proxy);
              proxyOption = {
                server: `${proxyUrl.protocol}//${proxyUrl.host}`,
                username: proxyUrl.username || undefined,
                password: proxyUrl.password || undefined,
              };
            } catch {
              console.warn('Invalid proxy URL, ignoring proxy option');
            }
          }
          
          // Get a random port for remote debugging
          const debugPort = Math.floor(Math.random() * 10000) + 9000;
          
          const browser = await chromium.launch({ 
            headless: false,
            channel: 'chrome',
            proxy: proxyOption,
            args: [
              `--remote-debugging-port=${debugPort}`,
              '--lang=ko', // Set browser language
              ...(openDevTools ? ['--auto-open-devtools-for-tabs'] : []),
              ...(runLighthouse ? [
                '--enable-features=Lighthouse',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
              ] : [])
            ]
          });
          const context = await browser.newContext({
            locale: 'ko-KR', // Set context locale
          });
          const page = await context.newPage();
          
          // Validate URL before navigating
          try {
            new URL(url);
            await page.goto(url, { waitUntil: 'networkidle' });
            console.log(`🌐 Chrome launched and navigated to: ${url}`);
            
            // Run Lighthouse if requested
            if (runLighthouse) {
              try {
                console.log('🔍 [DEBUG] Starting Lighthouse audit process...');
                console.log('🔍 [DEBUG] Current page URL:', await page.url());
                console.log('🔍 [DEBUG] Debug port:', debugPort);
                
                // Wait for page to be fully loaded
                console.log('🔍 [DEBUG] Waiting for page to load completely...');
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);
                
                // Use playwright-lighthouse for proper integration
                console.log('🔍 [DEBUG] Using playwright-lighthouse...');
                
                const { playAudit } = require('playwright-lighthouse');
                
                const reportName = `lighthouse-report-${Date.now()}`;
                
                await playAudit({
                  page: page,
                  port: debugPort,
                  // Set Lighthouse report locale to Korean
                  opts: {
                    locale: 'ko',
                  },
                  thresholds: {
                    performance: 50,
                    accessibility: 50,
                    'best-practices': 50,
                    seo: 50,
                    pwa: 50,
                  },
                  reports: {
                    formats: {
                      html: true,
                      json: true,
                    },
                    name: reportName,
                    directory: './output/',
                  },
                });
                
                console.log('🔍 [DEBUG] Lighthouse audit completed successfully');
                console.log('🔍 [DEBUG] Reports saved to ./output/ directory');
                
                // Generate PDF with all sections expanded
                try {
                  console.log('📄 [DEBUG] Generating PDF with expanded sections...');
                  
                  // Load the generated HTML report
                  const htmlReportPath = `file://${path.join(process.cwd(), 'output', `${reportName}.html`)}`;
                  const pdfPage = await context.newPage();
                  
                  await pdfPage.goto(htmlReportPath);
                  
                  // Wait for the page to load completely
                  await pdfPage.waitForLoadState('networkidle');
                  await pdfPage.waitForTimeout(2000);
                  
                  // Expand all collapsible sections
                  await pdfPage.evaluate(() => {
                    // Expand all <details> elements
                    document.querySelectorAll('details').forEach(detail => {
                      detail.open = true;
                    });
                    
                    // Expand any other collapsible elements (common Lighthouse patterns)
                    document.querySelectorAll('[aria-expanded="false"]').forEach(element => {
                      element.setAttribute('aria-expanded', 'true');
                    });
                    
                    // Remove any collapsed classes
                    document.querySelectorAll('.lh-collapsed, .collapsed').forEach(element => {
                      element.classList.remove('lh-collapsed', 'collapsed');
                    });
                    
                    // Show any hidden content
                    document.querySelectorAll('[style*="display: none"]').forEach(element => {
                      (element as HTMLElement).style.display = '';
                    });
                  });
                  
                  // Wait a bit for any animations to complete
                  await pdfPage.waitForTimeout(1000);
                  
                  // Generate PDF
                  const pdfPath = path.join(process.cwd(), 'output', `${reportName}.pdf`);
                  await pdfPage.pdf({
                    path: pdfPath,
                    format: 'A4',
                    printBackground: true,
                    margin: {
                      top: '20px',
                      right: '20px',
                      bottom: '20px',
                      left: '20px'
                    }
                  });
                  
                  console.log('📄 [DEBUG] PDF generated successfully:', pdfPath);
                  
                  await pdfPage.close();
                  
                } catch (pdfError: any) {
                  console.error('❌ [DEBUG] PDF generation failed:', pdfError);
                  console.error('❌ [DEBUG] PDF Error details:', {
                    message: pdfError?.message || 'Unknown error',
                    stack: pdfError?.stack || 'No stack trace'
                  });
                }
                
              } catch (lighthouseError: any) {
                console.error('❌ [DEBUG] Lighthouse audit failed:', lighthouseError);
                console.error('❌ [DEBUG] Error details:', {
                  message: lighthouseError?.message || 'Unknown error',
                  stack: lighthouseError?.stack || 'No stack trace',
                  name: lighthouseError?.name || 'Unknown error type'
                });
                
                // Provide fallback instructions
                console.log('🔍 [DEBUG] Manual Lighthouse access:');
                console.log('🔍 [DEBUG] 1. Open Chrome DevTools (F12)');
                console.log('🔍 [DEBUG] 2. Click on the "Lighthouse" tab');
                console.log('🔍 [DEBUG] 3. Or navigate to: chrome://lighthouse/');
                console.log('🔍 [DEBUG] 4. Enter the URL: ' + await page.url());
              }
            }
            
            return { success: true };
          } catch (urlError) {
            console.error('❌ Invalid URL provided:', urlError);
            return { success: false, error: 'Invalid URL provided' };
          }
        } catch (error) {
          console.error('❌ Chrome launch failed:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      ipcMain.handle('generate-lighthouse-reports', async (event, { urls, proxy }) => {
        try {
          const { chromium } = require('playwright');
          const { playAudit } = require('playwright-lighthouse');
          const fs = require('fs');
          const path = require('path');
          
          console.log(`🔍 Starting batch Lighthouse generation for ${urls.length} URLs...`);
          
          // Build proxy option if provided
          let proxyOption;
          if (proxy) {
            try {
              const proxyUrl = new URL(proxy);
              proxyOption = {
                server: `${proxyUrl.protocol}//${proxyUrl.host}`,
                username: proxyUrl.username || undefined,
                password: proxyUrl.password || undefined,
              };
            } catch {
              console.warn('Invalid proxy URL, ignoring proxy option');
            }
          }
          
          // Create output directory if it doesn't exist
          const outputDir = path.join(process.cwd(), 'output');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const results = [];
          const debugPort = Math.floor(Math.random() * 10000) + 9000;
          
          // Launch browser once for all audits
          const browser = await chromium.launch({ 
            headless: false,
            channel: 'chrome',
            proxy: proxyOption,
            args: [
              `--remote-debugging-port=${debugPort}`,
              '--lang=ko',
              '--enable-features=Lighthouse',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor'
            ]
          });
          
          const context = await browser.newContext({
            locale: 'ko-KR',
          });
          
          // Process each URL
          for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const urlResult: {
              url: string;
              success: boolean;
              reportName: string | null;
              error: string | null;
              index: number;
              total: number;
            } = {
              url,
              success: false,
              reportName: null,
              error: null,
              index: i + 1,
              total: urls.length
            };
            
            try {
              console.log(`\n🔍 [${i + 1}/${urls.length}] Processing: ${url}`);
              
              // Send progress update to renderer
              event.sender.send('lighthouse-progress', {
                current: i + 1,
                total: urls.length,
                url,
                status: 'processing'
              });
              
              const page = await context.newPage();
              
              // Navigate to URL
              await page.goto(url, { waitUntil: 'networkidle' });
              console.log(`✅ Navigated to: ${url}`);
              
              // Wait for page to be fully loaded
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(2000);
              
              // Generate unique report name
              const timestamp = Date.now();
              const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
              const reportName = `lighthouse-${sanitizedUrl}-${timestamp}`;
              
              // Run Lighthouse audit
              await playAudit({
                page: page,
                port: debugPort,
                opts: {
                  locale: 'ko',
                },
                thresholds: {
                  performance: 50,
                  accessibility: 50,
                  'best-practices': 50,
                  seo: 50,
                  pwa: 50,
                },
                reports: {
                  formats: {
                    html: true,
                    json: true,
                  },
                  name: reportName,
                  directory: outputDir,
                },
              });
              
              console.log(`✅ Lighthouse audit completed for: ${url}`);
              
              // Generate PDF with expanded sections
              try {
                const htmlReportPath = `file://${path.join(outputDir, `${reportName}.html`)}`;
                const pdfPage = await context.newPage();
                
                await pdfPage.goto(htmlReportPath);
                await pdfPage.waitForLoadState('networkidle');
                await pdfPage.waitForTimeout(2000);
                
                // Expand all sections
                await pdfPage.evaluate(() => {
                  document.querySelectorAll('details').forEach(detail => {
                    detail.open = true;
                  });
                  document.querySelectorAll('[aria-expanded="false"]').forEach(element => {
                    element.setAttribute('aria-expanded', 'true');
                  });
                  document.querySelectorAll('.lh-collapsed, .collapsed').forEach(element => {
                    element.classList.remove('lh-collapsed', 'collapsed');
                  });
                });
                
                await pdfPage.waitForTimeout(1000);
                
                const pdfPath = path.join(outputDir, `${reportName}.pdf`);
                await pdfPage.pdf({
                  path: pdfPath,
                  format: 'A4',
                  printBackground: true,
                  margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                  }
                });
                
                console.log(`📄 PDF generated: ${pdfPath}`);
                await pdfPage.close();
                
              } catch (pdfError) {
                console.error('❌ PDF generation failed:', pdfError);
              }
              
              urlResult.success = true;
              urlResult.reportName = reportName;
              
              // Send success update
              event.sender.send('lighthouse-progress', {
                current: i + 1,
                total: urls.length,
                url,
                status: 'completed',
                reportName
              });
              
              await page.close();
              
            } catch (error) {
              console.error(`❌ Failed to process ${url}:`, error);
              urlResult.error = error instanceof Error ? error.message : 'Unknown error';
              
              // Send error update
              event.sender.send('lighthouse-progress', {
                current: i + 1,
                total: urls.length,
                url,
                status: 'failed',
                error: urlResult.error
              });
            }
            
            results.push(urlResult);
          }
          
          console.log(`\n✅ Batch Lighthouse generation completed: ${results.filter(r => r.success).length}/${urls.length} successful`);
          
          // Merge all JSON reports
          const mergedJsonPath = path.join(outputDir, `merged-lighthouse-${Date.now()}.json`);
          const allJsonData: any[] = [];
          const successfulResults = results.filter(r => r.success && r.reportName);
          
          for (const result of successfulResults) {
            try {
              const jsonPath = path.join(outputDir, `${result.reportName}.json`);
              if (fs.existsSync(jsonPath)) {
                const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                allJsonData.push({
                  url: result.url,
                  reportName: result.reportName,
                  data: jsonData
                });
              }
            } catch (err) {
              console.error(`Failed to read JSON for ${result.url}:`, err);
            }
          }
          
          fs.writeFileSync(mergedJsonPath, JSON.stringify(allJsonData, null, 2));
          console.log(`📄 Merged JSON saved: ${mergedJsonPath}`);
          
          // Create final score report
          const finalReportPath = path.join(outputDir, `final-seo-report-${Date.now()}.html`);
          const scores: any[] = [];
          let totalPerformance = 0;
          let totalAccessibility = 0;
          let totalBestPractices = 0;
          let totalSEO = 0;
          let totalPWA = 0;
          let validScoresCount = 0;
          
          for (const jsonItem of allJsonData) {
            const lhr = jsonItem.data?.lhr || jsonItem.data;
            if (lhr?.categories) {
              const perf = lhr.categories.performance?.score || 0;
              const a11y = lhr.categories.accessibility?.score || 0;
              const bp = lhr.categories['best-practices']?.score || 0;
              const seo = lhr.categories.seo?.score || 0;
              const pwa = lhr.categories.pwa?.score || 0;
              
              scores.push({
                url: jsonItem.url,
                performance: Math.round(perf * 100),
                accessibility: Math.round(a11y * 100),
                bestPractices: Math.round(bp * 100),
                seo: Math.round(seo * 100),
                pwa: Math.round(pwa * 100),
                average: Math.round(((perf + a11y + bp + seo + pwa) / 5) * 100)
              });
              
              totalPerformance += perf;
              totalAccessibility += a11y;
              totalBestPractices += bp;
              totalSEO += seo;
              totalPWA += pwa;
              validScoresCount++;
            }
          }
          
          const avgPerformance = validScoresCount > 0 ? Math.round((totalPerformance / validScoresCount) * 100) : 0;
          const avgAccessibility = validScoresCount > 0 ? Math.round((totalAccessibility / validScoresCount) * 100) : 0;
          const avgBestPractices = validScoresCount > 0 ? Math.round((totalBestPractices / validScoresCount) * 100) : 0;
          const avgSEO = validScoresCount > 0 ? Math.round((totalSEO / validScoresCount) * 100) : 0;
          const avgPWA = validScoresCount > 0 ? Math.round((totalPWA / validScoresCount) * 100) : 0;
          const overallAverage = validScoresCount > 0 ? Math.round(((totalPerformance + totalAccessibility + totalBestPractices + totalSEO + totalPWA) / (validScoresCount * 5)) * 100) : 0;
          
          // Collect all recommendations and issues
          const allRecommendations: any[] = [];
          const issuesByCategory: { [key: string]: Set<string> } = {
            performance: new Set(),
            accessibility: new Set(),
            'best-practices': new Set(),
            seo: new Set(),
            pwa: new Set()
          };
          
          for (const jsonItem of allJsonData) {
            const lhr = jsonItem.data?.lhr || jsonItem.data;
            if (lhr?.audits) {
              Object.entries(lhr.audits).forEach(([key, audit]: [string, any]) => {
                if (audit.score !== null && audit.score < 1 && audit.score !== -1) {
                  // This is a failed audit
                  const category = Object.keys(lhr.categories || {}).find(cat => {
                    const categoryAudits = lhr.categories[cat]?.auditRefs || [];
                    return categoryAudits.some((ref: any) => ref.id === key);
                  }) || 'other';
                  
                  const issue = {
                    id: key,
                    title: audit.title,
                    description: audit.description,
                    score: audit.score,
                    displayValue: audit.displayValue,
                    category,
                    url: jsonItem.url
                  };
                  
                  allRecommendations.push(issue);
                  
                  if (issuesByCategory[category]) {
                    issuesByCategory[category].add(audit.title);
                  }
                }
              });
            }
          }
          
          // Generate AI explanation for the issues
          let aiExplanation = '';
          try {
            // Retrieve Google/Gemini API key from Electron Store
            const { getStore } = require('./storage');
            const store = getStore();
            const aiKeys = store ? store.get('ai-keys', []) : [];
            let googleKey: any = null;

            if (Array.isArray(aiKeys)) {
              // Prefer a key explicitly named 'egdesk' (case-insensitive) for debugging
              const egdeskKey = aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google');
              if (egdeskKey) {
                googleKey = egdeskKey;
                console.log('🔑 Using Google AI key named "egdesk" from store for debugging');
              } else {
                // Fallbacks: active Google key, then any Google key
                googleKey = aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) || aiKeys.find((k: any) => k?.providerId === 'google');
              }
            }

            const geminiApiKey = googleKey?.fields?.apiKey || process.env.GEMINI_API_KEY || '';

            if (geminiApiKey) {
              // Build issues summary text
              const issuesSummary = Object.entries(issuesByCategory)
                .filter(([_, issues]) => (issues as Set<string>).size > 0)
                .map(([category, issues]) => `${category}: ${Array.from(issues as Set<string>).join(', ')}`)
                .join('\n');

              const prompt = `당신은 SEO 전문가입니다. 웹사이트 분석 결과 발견된 다음 문제들을 SEO에 대해 전혀 모르는 일반 사용자가 이해할 수 있도록 쉽고 친절하게 설명해주세요:\n\n웹사이트 분석 점수:\n- 전체 평균: ${overallAverage}점\n- 성능: ${avgPerformance}점\n- 접근성: ${avgAccessibility}점\n- SEO: ${avgSEO}점\n\n발견된 주요 문제들:\n${issuesSummary}\n\n다음 형식으로 답변해주세요:\n1. 전체적인 상황 요약 (2-3문장)\n2. 각 카테고리별 문제점과 해결 방법을 쉽게 설명\n3. 우선순위가 높은 개선사항 3가지\n\n전문 용어는 피하고, 일반인도 이해할 수 있는 쉬운 말로 설명해주세요.`;

              // Use Google Generative AI (Gemini 2.5 Flash)
              const { GoogleGenerativeAI } = await import('@google/generative-ai');
              const genAI = new GoogleGenerativeAI(geminiApiKey);
              const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

              const result = await model.generateContent({
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: prompt }],
                  },
                ],
              });

              const response = result?.response;
              const text = response ? await response.text() : '';
              aiExplanation = text || '(AI 설명을 생성하지 못했습니다)';

              console.log('✅ AI explanation generated successfully with Gemini 2.5 Flash');
            } else {
              console.warn('⚠️ Gemini API key not found in Electron Store or env, skipping AI explanation');
              aiExplanation = '(AI 설명을 생성하려면 Google AI 키를 추가하거나 GEMINI_API_KEY 환경 변수를 설정하세요)';
            }
          } catch (aiError) {
            console.error('Failed to generate AI explanation:', aiError);
            aiExplanation = '(AI 설명 생성 중 오류가 발생했습니다)';
          }
          
          const getScoreColor = (score: number) => {
            if (score >= 90) return '#0cce6b';
            if (score >= 50) return '#ffa400';
            return '#ff4e42';
          };
          
          const finalReportHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO 최종 분석 보고서</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #202124; margin-bottom: 10px; font-size: 32px; }
    .subtitle { color: #5f6368; margin-bottom: 40px; font-size: 16px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .summary-card { padding: 20px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .summary-card .value { font-size: 48px; font-weight: bold; margin-bottom: 8px; }
    .summary-card .label { font-size: 14px; opacity: 0.9; }
    .overall-score { text-align: center; padding: 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; color: white; margin-bottom: 40px; }
    .overall-score .score { font-size: 72px; font-weight: bold; margin-bottom: 10px; }
    .overall-score .label { font-size: 20px; opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 16px; text-align: left; border-bottom: 1px solid #e0e0e0; }
    th { background: #f8f9fa; font-weight: 600; color: #202124; }
    .score-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; color: white; }
    .url-cell { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #5f6368; font-size: 14px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 SEO 최종 분석 보고서</h1>
    <div class="subtitle">생성일: ${new Date().toLocaleString('ko-KR')}</div>
    
    <div class="overall-score">
      <div class="score">${overallAverage}</div>
      <div class="label">전체 평균 점수</div>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value">${avgPerformance}</div>
        <div class="label">평균 성능</div>
      </div>
      <div class="summary-card">
        <div class="value">${avgAccessibility}</div>
        <div class="label">평균 접근성</div>
      </div>
      <div class="summary-card">
        <div class="value">${avgBestPractices}</div>
        <div class="label">평균 모범 사례</div>
      </div>
      <div class="summary-card">
        <div class="value">${avgSEO}</div>
        <div class="label">평균 SEO</div>
      </div>
      <div class="summary-card">
        <div class="value">${avgPWA}</div>
        <div class="label">평균 PWA</div>
      </div>
    </div>
    
    <h2 style="margin-bottom: 20px; color: #202124;">페이지별 상세 점수</h2>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>성능</th>
          <th>접근성</th>
          <th>모범 사례</th>
          <th>SEO</th>
          <th>PWA</th>
          <th>평균</th>
        </tr>
      </thead>
      <tbody>
        ${scores.map(s => `
          <tr>
            <td class="url-cell" title="${s.url}">${s.url}</td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.performance)}">${s.performance}</span></td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.accessibility)}">${s.accessibility}</span></td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.bestPractices)}">${s.bestPractices}</span></td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.seo)}">${s.seo}</span></td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.pwa)}">${s.pwa}</span></td>
            <td><span class="score-badge" style="background-color: ${getScoreColor(s.average)}">${s.average}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="footer">
      <p>총 ${urls.length}개 페이지 분석 완료 (성공: ${results.filter(r => r.success).length}개, 실패: ${results.filter(r => !r.success).length}개)</p>
      <p>상세 보고서는 개별 Lighthouse HTML 파일을 참조하세요.</p>
    </div>
  </div>
</body>
</html>
          `;
          
          fs.writeFileSync(finalReportPath, finalReportHtml);
          console.log(`📊 Final report saved: ${finalReportPath}`);
          
          // Simple approach: Create a single combined HTML with all reports and convert to one PDF
          const mergedPdfPath = path.join(outputDir, `merged-lighthouse-${Date.now()}.pdf`);
          try {
            console.log('📄 Creating merged PDF with cover and all reports...');
            
            const pdfPage = await context.newPage();
            
            // Build combined HTML with cover + all reports
            let combinedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EG SEO 분석 보고서</title>
  <style>
    .cover-page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f7fa; /* simplified solid background */
      page-break-after: always;
    }
    .cover-container {
      max-width: 800px;
      text-align: center;
      background: white;
      padding: 60px;
      border-radius: 12px;
      border: 1px solid #e0e0e0; /* replace shadow with border for print */
    }
    .cover-title { 
      color: #202124;
      font-size: 36px;
      margin-bottom: 20px;
      padding: 10px 0;
    }
    .cover-subtitle {
      color: #5f6368;
      font-size: 18px;
      margin-bottom: 40px;
    }
    .cover-logo {
      font-size: 48px; /* smaller for print */
      margin-bottom: 20px;
    }
    .report-section {
      page-break-before: always;
      padding: 20px;
    }
    
    /* Summary Page Styles */
    .summary-page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      min-height: 100vh;
      background: #f8f9fa; /* solid */
      page-break-after: always;
    }
    .summary-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      border: 1px solid #e0e0e0; /* replace shadow */
    }
    .summary-title {
      color: #202124;
      font-size: 28px;
      margin-bottom: 24px;
      text-align: center;
    }
    .overall-score-section {
      text-align: center;
      margin-bottom: 32px;
    }
    .overall-score-card {
      display: inline-block;
      padding: 32px 48px;
      background: #f5576c; /* solid instead of gradient */
      border-radius: 12px;
      color: white;
    }
    .overall-score-value {
      font-size: 56px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .overall-score-label {
      font-size: 16px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .metric-card {
      padding: 16px;
      background: #667eea; /* solid */
      border-radius: 8px;
      color: white;
      text-align: center;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    .metric-label {
      font-size: 13px;
    }
    .table-title {
      color: #202124;
      font-size: 20px;
      margin-bottom: 16px;
    }
    .scores-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .scores-table th,
    .scores-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
      font-size: 13px;
    }
    .scores-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #202124;
    }
    .url-cell {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }
    .score-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 12px;
      color: white;
    }
    .summary-footer {
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      color: #5f6368;
      font-size: 13px;
    }
    .summary-footer p {
      margin: 4px 0;
    }
    
    /* AI Explanation Page Styles */
    .ai-explanation-page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      min-height: 100vh;
      background: #e7f4ff; /* solid */
      page-break-after: always;
    }
    .ai-explanation-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }
    .ai-title {
      color: #202124;
      font-size: 28px;
      margin-bottom: 24px;
      text-align: center;
    }
    .ai-content {
      background: #f8f9fa;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 32px;
      border-left: 4px solid #667eea;
    }
    .ai-content p {
      margin: 12px 0;
      line-height: 1.6;
      color: #202124;
      font-size: 14px;
    }
    .ai-content p:first-child { margin-top: 0; }
    .ai-content p:last-child { margin-bottom: 0; }
    .top-issues { margin-top: 32px; }
    .issues-title {
      color: #202124;
      font-size: 20px;
      margin-bottom: 16px;
    }
    .issues-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .issue-category-card {
      background: #f5f5f5; /* solid */
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .issue-category-card h3 {
      color: #202124;
      font-size: 16px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .issue-category-card ul { list-style: none; padding: 0; margin: 0; }
    .issue-category-card li {
      padding: 6px 0;
      color: #5f6368;
      font-size: 13px;
      border-bottom: 1px solid #ddd;
    }
    .issue-category-card li:last-child { border-bottom: none; }
    .issue-category-card li.more-items { font-style: italic; color: #9e9e9e; }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-container">
      <div class="cover-logo">🔍</div>
      <h1 class="cover-title">EG SEO 분석 보고서</h1>
      <div class="cover-subtitle">생성일: ${new Date().toLocaleString('ko-KR')}</div>
    </div>
  </div>
  
  <!-- Summary Page -->
  <div class="summary-page">
    <div class="summary-container">
      <h1 class="summary-title">📊 분석 요약</h1>
      
      <div class="overall-score-section">
        <div class="overall-score-card">
          <div class="overall-score-value">${overallAverage}</div>
          <div class="overall-score-label">전체 평균 점수</div>
        </div>
      </div>
      
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${avgPerformance}</div>
          <div class="metric-label">성능</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${avgAccessibility}</div>
          <div class="metric-label">접근성</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${avgBestPractices}</div>
          <div class="metric-label">모범 사례</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${avgSEO}</div>
          <div class="metric-label">SEO</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${avgPWA}</div>
          <div class="metric-label">PWA</div>
        </div>
      </div>
      
      <h2 class="table-title">페이지별 상세 점수</h2>
      <table class="scores-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>성능</th>
            <th>접근성</th>
            <th>모범 사례</th>
            <th>SEO</th>
            <th>PWA</th>
            <th>평균</th>
          </tr>
        </thead>
        <tbody>
          ${scores.map(s => `
            <tr>
              <td class="url-cell">${s.url}</td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.performance)}">${s.performance}</span></td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.accessibility)}">${s.accessibility}</span></td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.bestPractices)}">${s.bestPractices}</span></td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.seo)}">${s.seo}</span></td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.pwa)}">${s.pwa}</span></td>
              <td><span class="score-badge" style="background-color: ${getScoreColor(s.average)}">${s.average}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="summary-footer">
        <p>총 ${urls.length}개 페이지 분석 완료</p>
        <p>성공: ${results.filter(r => r.success).length}개 | 실패: ${results.filter(r => !r.success).length}개</p>
      </div>
    </div>
  </div>
  
  <!-- AI Explanation Page -->
  <div class="ai-explanation-page">
    <div class="ai-explanation-container">
      <h1 class="ai-title">🤖 AI가 설명하는 개선 방안</h1>
      <div class="ai-content">
        ${aiExplanation.split('\n').map(line => `<p>${line}</p>`).join('')}
      </div>
      
      <div class="top-issues">
        <h2 class="issues-title">주요 발견 사항</h2>
        <div class="issues-grid">
          ${Object.entries(issuesByCategory)
            .filter(([_, issues]) => (issues as Set<string>).size > 0)
            .map(([category, issues]) => {
              const categoryNames: any = {
                'performance': '⚡ 성능',
                'accessibility': '♿ 접근성',
                'best-practices': '✅ 모범 사례',
                'seo': '🔍 SEO',
                'pwa': '📱 PWA'
              };
              return `
                <div class="issue-category-card">
                  <h3>${categoryNames[category] || category}</h3>
                  <ul>
                    ${Array.from(issues as Set<string>).slice(0, 5).map(issue => `<li>${issue}</li>`).join('')}
                    ${(issues as Set<string>).size > 5 ? `<li class="more-items">그 외 ${(issues as Set<string>).size - 5}개 항목...</li>` : ''}
                  </ul>
                </div>
              `;
            }).join('')}
        </div>
      </div>
    </div>
  </div>
`;

            // Add each report's HTML content
            for (const result of successfulResults) {
              if (result.reportName) {
                const htmlPath = path.join(outputDir, `${result.reportName}.html`);
                if (fs.existsSync(htmlPath)) {
                  try {
                    const reportHtml = fs.readFileSync(htmlPath, 'utf8');
                    // Extract body content from the Lighthouse HTML
                    const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    if (bodyMatch) {
                      combinedHtml += `
  <div class="report-section">
    ${bodyMatch[1]}
  </div>
`;
                    }
                  } catch (err) {
                    console.error(`Failed to read HTML for ${result.reportName}:`, err);
                  }
                }
              }
            }
            
            combinedHtml += `
</body>
</html>
            `;
            
            // Convert combined HTML to PDF
            await pdfPage.setContent(combinedHtml, { waitUntil: 'networkidle' });
            await pdfPage.waitForTimeout(2000);
            
            await pdfPage.pdf({
              path: mergedPdfPath,
              format: 'A4',
              printBackground: true,
              margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });
            
            await pdfPage.close();
            
            console.log(`📄 Merged PDF saved: ${mergedPdfPath}`);
          } catch (pdfMergeError) {
            console.error('Failed to create merged PDF:', pdfMergeError);
          }
          
          await browser.close();
          
          return {
            success: true,
            results,
            summary: {
              total: urls.length,
              successful: results.filter(r => r.success).length,
              failed: results.filter(r => !r.success).length
            },
            mergedJsonPath,
            mergedPdfPath,
            finalReportPath,
            scores: {
              overall: overallAverage,
              performance: avgPerformance,
              accessibility: avgAccessibility,
              bestPractices: avgBestPractices,
              seo: avgSEO,
              pwa: avgPWA
            }
          };
          
        } catch (error) {
          console.error('❌ Batch Lighthouse generation failed:', error);
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      ipcMain.handle('open-instagram-with-profile', async (_event, opts?: { profilePath?: string; profileDirectory?: string; profileRoot?: string; targetUrl?: string; username?: string; password?: string; imagePath?: string; caption?: string; waitAfterShare?: number; structuredPrompt?: any }) => {
        const profilePath = opts?.profilePath;
        const profileDirectory = opts?.profileDirectory;
        const profileRoot = opts?.profileRoot;
        const targetUrl = opts?.targetUrl || 'https://www.instagram.com/';
        const username = typeof opts?.username === 'string' ? opts.username.trim() || undefined : undefined;
        const password = typeof opts?.password === 'string' ? opts.password : undefined;
        const hasCredentials = Boolean(username && password);
        const profilePathProvided =
          typeof profilePath === 'string' && profilePath.trim().length > 0;
        const resolvedImagePath = (() => {
          if (typeof opts?.imagePath === 'string' && opts.imagePath.trim().length > 0) {
            return path.resolve(opts.imagePath.trim());
          }
          const defaultCatPath = path.join(app.getPath('home'), 'Downloads', 'cat.png');
          if (fs.existsSync(defaultCatPath)) {
            console.log('[Instagram Launcher] Using default image path:', defaultCatPath);
            return defaultCatPath;
          }
          return undefined;
        })();
        const structuredPrompt = opts?.structuredPrompt;
        const caption =
          typeof opts?.caption === 'string' && opts.caption.trim().length > 0
            ? opts.caption.trim()
            : structuredPrompt
              ? undefined
              : `[Automated Test] ${new Date().toISOString()}`;
        const shouldAttemptPost = Boolean(resolvedImagePath);
        const needsGemini = Boolean(!caption && structuredPrompt);
        const loginOptions = hasCredentials
          ? { username: username as string, password: password as string }
          : undefined;
      
        try {
          try {
            new URL(targetUrl);
          } catch {
            return {
              success: false,
              error: `Invalid target URL: ${targetUrl}`,
            };
          }

          if (!profilePathProvided) {
            if (loginOptions) {
              console.log('[Instagram Launcher] Performing Playwright login with provided credentials.');
              try {
                await playwrightInstagramLogin(loginOptions);
              } catch (authError) {
                console.error('[Instagram Launcher] Playwright login failed:', authError);
                return {
                  success: false,
                  error:
                    authError instanceof Error
                      ? authError.message || 'Instagram login failed.'
                      : 'Instagram login failed.',
                };
              }
            }
      
            try {
              const authSession = await getAuthenticatedPage(loginOptions);
              const { page } = authSession;
              await waitForPageReady(page, 3000);
      
              try {
                await page.goto(targetUrl, {
                  waitUntil: 'domcontentloaded',
                  timeout: 60000,
                });
              } catch (navigationError) {
                console.error('[Instagram Launcher] Playwright navigation failed:', navigationError);
                try {
                  await authSession.close();
                } catch (closeError) {
                  console.warn('[Instagram Launcher] Failed to close Playwright session after navigation error:', closeError);
                }
                return {
                  success: false,
                  error:
                    navigationError instanceof Error
                      ? navigationError.message || 'Failed to navigate to Instagram.'
                      : 'Failed to navigate to Instagram.',
                };
              }
      
              if (!resolvedImagePath) {
                await authSession.close();
                return {
                  success: false,
                  error: 'No image available for Instagram post. Provide imagePath or ensure ~/Downloads/cat.png exists.',
                };
              }

              if (needsGemini && !ensureGeminiApiKey()) {
                await authSession.close();
                return {
                  success: false,
                  error: 'Gemini API key not configured. Add a Google key in settings or set GEMINI_API_KEY.',
                };
              }

              if (shouldAttemptPost && resolvedImagePath) {
                try {
                  await createInstagramPost(page, {
                    imagePath: resolvedImagePath,
                    caption,
                    structuredPrompt,
                    waitAfterShare: opts?.waitAfterShare,
                  });
                } catch (postError) {
                  console.error('[Instagram Launcher] Failed to create Instagram post (Playwright session):', postError);
                  await authSession.close();
                  return {
                    success: false,
                    error:
                      postError instanceof Error
                        ? postError.message || 'Failed to create Instagram post.'
                        : 'Failed to create Instagram post.',
                  };
                }
              }

              try {
                await page.bringToFront();
              } catch (bringError) {
                console.warn('[Instagram Launcher] Failed to bring Playwright page to front:', bringError);
              }
      
              activeInstagramSessions.push(authSession);
              console.log('[Instagram Launcher] Instagram opened successfully via Playwright session.');
              return {
                success: true,
                automation: 'playwright',
              };
            } catch (sessionError) {
              console.error('[Instagram Launcher] Failed to open authenticated Playwright session:', sessionError);
              return {
                success: false,
                error:
                  sessionError instanceof Error
                    ? sessionError.message || 'Failed to open authenticated Instagram session.'
                    : 'Failed to open authenticated Instagram session.',
              };
            }
          }
      
          if (!profilePathProvided) {
            return {
              success: false,
              error: 'A valid Chrome profile path is required.',
            };
          }
      
          const resolvedProfilePath = path.resolve(profilePath);
          const resolvedRootPath =
            profileRoot && typeof profileRoot === 'string' && profileRoot.trim()
              ? path.resolve(profileRoot)
              : path.dirname(resolvedProfilePath);
          const profileDirName =
            (profileDirectory && profileDirectory.trim()) || path.basename(resolvedProfilePath);
          const fs = require('fs');
      
          if (!fs.existsSync(resolvedRootPath)) {
            return {
              success: false,
              error: `Profile root does not exist: ${resolvedRootPath}`,
            };
          }
      
          const targetProfileDirPath = path.join(resolvedRootPath, profileDirName);
      
          if (!fs.existsSync(targetProfileDirPath)) {
            return {
              success: false,
              error: `Profile directory does not exist: ${targetProfileDirPath}`,
            };
          }
      
          const { chromium } = require('playwright');
          console.log(
            `[Instagram Launcher] Opening Instagram with profile: ${targetProfileDirPath} (root: ${resolvedRootPath})`,
          );
      
          // Launch a non-persistent Chrome session (fresh runtime each call)
          const browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            args: [
              `--profile-directory=${profileDirName}`,
            ],
            ignoreDefaultArgs: ['--enable-automation'],
          });
      
          const context = await browser.newContext();
          const page = await context.newPage();
          await waitForPageReady(page, 3000);
      
          if (loginOptions) {
            console.log('[Instagram Launcher] Performing automated login inside Chrome session.');
            try {
              await loginWithPage(page, loginOptions);
            } catch (loginError) {
              console.error('[Instagram Launcher] Automated login failed:', loginError);
              await browser.close();
              return {
                success: false,
                error:
                  loginError instanceof Error
                    ? loginError.message || 'Failed to log in to Instagram.'
                    : 'Failed to log in to Instagram.',
              };
            }
          }
      
          console.log('[Instagram Launcher] Navigating to', targetUrl);
      
          try {
            await page.goto(targetUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 60000,
            });
          } catch (navigationError) {
            console.error('[Instagram Launcher] Navigation failed:', navigationError);
            await browser.close();
            return {
              success: false,
              error:
                navigationError instanceof Error
                  ? navigationError.message || 'Failed to navigate to Instagram.'
                  : 'Failed to navigate to Instagram.',
            };
          }
      
          if (!resolvedImagePath) {
            await browser.close();
            return {
              success: false,
              error: 'No image available for Instagram post. Provide imagePath or ensure ~/Downloads/cat.png exists.',
            };
          }

          if (needsGemini && !ensureGeminiApiKey()) {
            await browser.close();
            return {
              success: false,
              error: 'Gemini API key not configured. Add a Google key in settings or set GEMINI_API_KEY.',
            };
          }

          if (shouldAttemptPost && resolvedImagePath) {
            try {
              await createInstagramPost(page, {
                imagePath: resolvedImagePath,
                caption,
                structuredPrompt,
                waitAfterShare: opts?.waitAfterShare,
              });
            } catch (postError) {
              console.error('[Instagram Launcher] Failed to create Instagram post (Chrome session):', postError);
              await browser.close();
              return {
                success: false,
                error:
                  postError instanceof Error
                    ? postError.message || 'Failed to create Instagram post.'
                    : 'Failed to create Instagram post.',
              };
            }
          }

          try {
            await page.bringToFront();
          } catch (bringError) {
            console.warn('[Instagram Launcher] Failed to bring page to front:', bringError);
          }
      
          console.log('[Instagram Launcher] Instagram opened successfully.');
      
          // Leave browser running so the user can interact with the window.
      
          return {
            success: true,
            automation: loginOptions ? 'chrome-automation' : 'chrome-profile',
          };
      
        } catch (error) {
          console.error('[Instagram Launcher] Unexpected error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred.',
          };
        }
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
        try {
          console.log(`🚀 Starting tunnel: ${serverName}`);
          const result = await startTunnel(serverName, localServerUrl);
          
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
              console.log(`💾 Auto-saved tunnel configuration: ${result.publicUrl}`);
            } catch (saveError) {
              console.error('⚠️ Failed to auto-save tunnel config:', saveError);
              // Don't fail the whole operation if save fails
            }
          }
          
          return result;
        } catch (error: any) {
          console.error('❌ Failed to start tunnel:', error);
          return {
            success: false,
            error: error.message || 'Unknown error'
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

    // Register SQLite IPC handlers (database already initialized earlier)
    try {
      const sqliteManager = getSQLiteManager();
      sqliteManager.registerIPCHandlers();
      console.log('✅ SQLite Manager IPC handlers registered');
    } catch (error) {
      console.error('❌ Failed to register SQLite IPC handlers:', error);
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

    // Register MCP Local Server Manager handlers
    const mcpLocalServerManager = getLocalServerManager();
    mcpLocalServerManager.registerIPCHandlers();

    // Register Ollama handlers
    registerOllamaHandlers();

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
      console.error('Main window was not available during ready-to-show');
      return;
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

// Set up protocol for OAuth deep links
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('egdesk', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('egdesk');
}

app
  .whenReady()
  .then(() => {
    // Initialize auth service
    const authService = getAuthService();
    authService.registerHandlers();
    
    createWindow();
    
    // Set up deep link handler for OAuth callbacks
    // Pass a function that returns the current main window
    authService.setupDeepLinkHandler(() => mainWindow);
    
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
