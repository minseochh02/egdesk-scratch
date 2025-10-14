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
import { registerEGDeskMCP, testEGDeskMCPConnection } from './mcp/gmail/server-script/registration-service';
import { registerGmailMCPHandlers } from './mcp/gmail/server-script/gmail-mcp-handler';
import { getMCPServerManager } from './mcp/gmail/server-script/mcp-server-manager';
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
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf5 100%);
      page-break-after: always;
    }
    .cover-container {
      max-width: 800px;
      text-align: center;
      background: white;
      padding: 60px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .cover-title { 
      color: #202124;
      font-size: 48px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      padding: 10px 0;
    }
    .cover-subtitle {
      color: #5f6368;
      font-size: 20px;
    }
    .cover-logo {
      font-size: 72px;
      margin-bottom: 30px;
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
      background: #f8f9fa;
      page-break-after: always;
    }
    .summary-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .summary-title {
      color: #202124;
      font-size: 32px;
      margin-bottom: 30px;
      text-align: center;
    }
    .overall-score-section {
      text-align: center;
      margin-bottom: 40px;
    }
    .overall-score-card {
      display: inline-block;
      padding: 40px 60px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 12px;
      color: white;
    }
    .overall-score-value {
      font-size: 64px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .overall-score-label {
      font-size: 18px;
      opacity: 0.95;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      margin-bottom: 40px;
    }
    .metric-card {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      color: white;
      text-align: center;
    }
    .metric-value {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .metric-label {
      font-size: 14px;
      opacity: 0.9;
    }
    .table-title {
      color: #202124;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .scores-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .scores-table th,
    .scores-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
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
      font-size: 14px;
    }
    .score-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      color: white;
    }
    .summary-footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #5f6368;
      font-size: 14px;
    }
    .summary-footer p {
      margin: 5px 0;
    }
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
