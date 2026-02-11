// IPC handlers for Chrome browser automation and Lighthouse reports
import { ipcMain, app, screen, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { BrowserRecorder } from './browser-recorder';
import { getChainMetadataStore } from './chain-metadata';
import { codeViewerWindow } from './code-viewer-window';
import { Browser, BrowserContext, Page } from 'playwright-core';
import { ChromeExtensionScanner } from './chrome-extension-scanner';
import { getStore } from './storage';
import { browserPoolManager, applyAntiDetectionMeasures } from './shared/browser';

// ===== Paused Browser Session Management =====

interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' | 'waitForElement' | 'download' | 'datePickerGroup' | 'captureTable' | 'newTab' | 'print' | 'clickUntilGone' | 'closeTab';
  selector?: string;
  xpath?: string;
  value?: string;
  key?: string;
  url?: string;
  waitCondition?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  timeout?: number;
  timestamp: number;
  coordinates?: { x: number; y: number };
  frameSelector?: string;
  dateComponents?: {
    year: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  };
  dateOffset?: number;
  tables?: Array<{
    xpath: string;
    cssSelector: string;
    headers: string[];
    sampleRow: string[];
    rowCount: number;
  }>;
  newTabUrl?: string;
  closedTabUrl?: string;
  maxIterations?: number;
  checkCondition?: 'gone' | 'hidden' | 'disabled';
  waitBetweenClicks?: number;
}

interface PausedSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  pausedAtActionIndex: number;
  actions: RecordedAction[];
  testPath: string;
  createdAt: Date;
}

const pausedSessions: Map<string, PausedSession> = new Map();
let activeRecorder: BrowserRecorder | null = null;

/**
 * Helper to inject Resume Recording UI into paused browser
 */
async function injectResumeUI(page: Page, sessionId: string, pausedAt: number, total: number, browserWindow: BrowserWindow) {
  try {
    // Expose function to be called from browser page
    // This function will be called when user clicks Resume Recording button
    await page.exposeFunction('__playwrightRecorderResumeRecording', async (sid: string) => {
      console.log('▶️ Resume recording requested for session:', sid);

      // Handle resume directly here since we have access to all needed variables
      try {
        const session = pausedSessions.get(sid);
        if (!session) {
          console.error('❌ Session not found:', sid);
          return;
        }

        // Get activeRecorder from the module scope
        if (!activeRecorder) {
          console.error('❌ No active recorder available');
          return;
        }

        // Create new recorder instance
        const resumedRecorder = new BrowserRecorder();

        // Restore state
        resumedRecorder.setActions(session.actions);
        resumedRecorder.setOutputFile(session.testPath);
        const scriptName = path.basename(session.testPath, '.spec.js');
        resumedRecorder.setScriptName(scriptName);

        // Connect to existing browser context
        resumedRecorder.reconnectToContext(session.context, session.page);

        // Start recording
        await resumedRecorder.startRecording();

        // Set up callbacks
        resumedRecorder.setUpdateCallback((code) => {
          codeViewerWindow.updateCode(code);
          codeViewerWindow.updateActions(resumedRecorder.getActions());
        });

        codeViewerWindow.setWaitSettingsCallback((settings) => {
          resumedRecorder.setWaitSettings(settings);
        });

        codeViewerWindow.setDeleteActionCallback((index) => {
          resumedRecorder.deleteAction(index);
        });

        // Update activeRecorder
        activeRecorder = resumedRecorder;

        // Remove session from paused list
        pausedSessions.delete(sid);

        console.log('✅ Recording resumed successfully');
      } catch (error) {
        console.error('❌ Error resuming recording:', error);
      }
    });

    // Inject UI overlay
    await page.evaluate((sessionId, pausedAt, total) => {
      // Remove any existing overlay first
      const existingOverlay = document.getElementById('resume-recording-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      const resumeOverlay = document.createElement('div');
      resumeOverlay.id = 'resume-recording-overlay';
      resumeOverlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 32px 40px;
        border-radius: 16px;
        z-index: 9999999;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        min-width: 400px;
      `;

      resumeOverlay.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⏸️</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
          Test Paused
        </div>
        <div style="font-size: 16px; opacity: 0.95; margin-bottom: 24px;">
          Executed ${pausedAt + 1} of ${total} actions
        </div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="resume-recording-btn" style="
            background: white;
            color: #667eea;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          ">
            ▶️ Resume Recording
          </button>
          <button id="close-browser-btn" style="
            background: rgba(255,255,255,0.15);
            color: white;
            border: 2px solid rgba(255,255,255,0.5);
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">
            ❌ Close Browser
          </button>
        </div>
        <div style="margin-top: 20px; font-size: 13px; opacity: 0.8;">
          You can inspect the page or click Resume to continue recording
        </div>
      `;

      document.body.appendChild(resumeOverlay);

      // Set up button handlers
      const resumeBtn = document.getElementById('resume-recording-btn');
      const closeBtn = document.getElementById('close-browser-btn');

      if (resumeBtn) {
        resumeBtn.addEventListener('mouseenter', () => {
          resumeBtn.style.transform = 'translateY(-2px)';
          resumeBtn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        });
        resumeBtn.addEventListener('mouseleave', () => {
          resumeBtn.style.transform = 'translateY(0)';
          resumeBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        resumeBtn.addEventListener('click', () => {
          // Call the exposed function
          if ((window as any).__playwrightRecorderResumeRecording) {
            (window as any).__playwrightRecorderResumeRecording(sessionId);
          }
          // Remove overlay
          resumeOverlay.remove();
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('mouseenter', () => {
          closeBtn.style.background = 'rgba(255,255,255,0.25)';
        });
        closeBtn.addEventListener('mouseleave', () => {
          closeBtn.style.background = 'rgba(255,255,255,0.15)';
        });
        closeBtn.addEventListener('click', () => {
          window.close();
        });
      }
    }, sessionId, pausedAt, total);

    console.log('✅ Resume UI injected successfully');
  } catch (error) {
    console.error('❌ Error injecting resume UI:', error);
  }
}

/**
 * Helper to execute a single action
 */
async function executeAction(page: Page, context: BrowserContext, action: RecordedAction, index: number, allActions: RecordedAction[], pageStack: Page[]): Promise<Page> {
  console.log(`  ▶️ Executing action ${index + 1}: ${action.type}`);

  switch (action.type) {
    case 'navigate':
      await page.goto(action.url!);
      console.log(`    ✓ Navigated to: ${action.url}`);
      break;

    case 'click':
      if (action.coordinates) {
        await page.mouse.click(action.coordinates.x, action.coordinates.y);
        console.log(`    ✓ Clicked at coordinates: (${action.coordinates.x}, ${action.coordinates.y})`);
      } else {
        const selector = action.xpath || action.selector!;
        if (action.frameSelector) {
          const frame = page.frameLocator(action.frameSelector);
          await frame.locator(selector).click();
          console.log(`    ✓ Clicked in iframe: ${action.frameSelector}`);
        } else {
          await page.locator(selector).click();
          console.log(`    ✓ Clicked: ${selector}`);
        }
      }
      break;

    case 'fill':
      const fillSelector = action.xpath || action.selector!;
      if (action.frameSelector) {
        const frame = page.frameLocator(action.frameSelector);
        await frame.locator(fillSelector).fill(action.value || '');
        console.log(`    ✓ Filled in iframe: ${action.frameSelector}`);
      } else {
        await page.locator(fillSelector).fill(action.value || '');
        console.log(`    ✓ Filled: ${fillSelector} = "${action.value}"`);
      }
      break;

    case 'keypress':
      if (action.key === 'Enter') {
        await page.keyboard.press('Enter');
        console.log(`    ✓ Pressed: Enter`);
      } else if (action.key) {
        await page.keyboard.type(action.key);
        console.log(`    ✓ Typed: ${action.key}`);
      }
      break;

    case 'screenshot':
      await page.screenshot({ path: `screenshot-${index}.png`, fullPage: true });
      console.log(`    ✓ Screenshot saved: screenshot-${index}.png`);
      break;

    case 'waitForElement':
      const waitSelector = action.xpath || action.selector!;
      const condition = action.waitCondition || 'visible';
      const timeout = action.timeout || 30000;
      await page.locator(waitSelector).waitFor({ state: condition as any, timeout });
      console.log(`    ✓ Waited for element: ${waitSelector} (${condition})`);
      break;

    case 'download':
      {
        const downloadPromise = page.waitForEvent('download');
        if (action.xpath || action.selector) {
          const dlSelector = action.xpath || action.selector;
          await page.locator(dlSelector).click();
        }
        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
        if (!fs.existsSync(downloadsPath)) {
          fs.mkdirSync(downloadsPath, { recursive: true });
        }
        const filePath = path.join(downloadsPath, suggestedFilename);
        await download.saveAs(filePath);
        console.log(`    ✓ Downloaded: ${suggestedFilename} to ${filePath}`);
      }
      break;

    case 'datePickerGroup':
      if (action.dateComponents) {
        const dateOffset = action.dateOffset || 0;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dateOffset);
        const year = targetDate.getFullYear().toString();
        const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
        const day = targetDate.getDate().toString().padStart(2, '0');
        console.log(`    📅 Target date (offset ${dateOffset}): ${year}-${month}-${day}`);

        // Execute year
        if (action.dateComponents.year) {
          const comp = action.dateComponents.year;
          if (comp.elementType === 'select') {
            await page.locator(comp.selector).selectOption(year);
          } else if (comp.elementType === 'button' && comp.dropdownSelector) {
            await page.locator(comp.selector).click();
            await page.waitForTimeout(500);
            await page.locator(comp.dropdownSelector).locator(`text="${year}"`).first().click();
          } else if (comp.elementType === 'input') {
            await page.locator(comp.selector).fill(year);
          }
          console.log(`    ✓ Selected year: ${year}`);
        }

        // Execute month
        if (action.dateComponents.month) {
          const comp = action.dateComponents.month;
          if (comp.elementType === 'select') {
            await page.locator(comp.selector).selectOption(month);
          } else if (comp.elementType === 'button' && comp.dropdownSelector) {
            await page.locator(comp.selector).click();
            await page.waitForTimeout(500);
            await page.locator(comp.dropdownSelector).locator(`text="${month}"`).first().click();
          } else if (comp.elementType === 'input') {
            await page.locator(comp.selector).fill(month);
          }
          console.log(`    ✓ Selected month: ${month}`);
        }

        // Execute day
        if (action.dateComponents.day) {
          const comp = action.dateComponents.day;
          if (comp.elementType === 'select') {
            await page.locator(comp.selector).selectOption(day);
          } else if (comp.elementType === 'button' && comp.dropdownSelector) {
            await page.locator(comp.selector).click();
            await page.waitForTimeout(500);
            await page.locator(comp.dropdownSelector).locator(`text="${day}"`).first().click();
          } else if (comp.elementType === 'input') {
            await page.locator(comp.selector).fill(day);
          }
          console.log(`    ✓ Selected day: ${day}`);
        }
      }
      break;

    case 'newTab':
      {
        const newPagePromise = context.waitForEvent('page');
        // The action that triggers the new tab should have already happened
        const newPage = await newPagePromise;
        await newPage.waitForLoadState();
        console.log(`    ✓ New tab opened: ${newPage.url()}`);

        // Set up dialog handling for new page
        newPage.on('dialog', async (dialog) => {
          console.log(`    🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
          await dialog.accept();
          console.log(`    ✅ Dialog accepted`);
        });

        // Push current page to stack
        pageStack.push(page);
        console.log(`    📚 Pushed page to stack, stack size: ${pageStack.length}`);

        // Switch to new page
        page = newPage;
        console.log(`    ✓ Switched to new tab: ${newPage.url()}`);
      }
      break;

    case 'closeTab':
      {
        await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

        // Switch back to previous page
        const previousPage = pageStack.pop();
        if (previousPage) {
          page = previousPage;
          console.log(`    ⬅️ Switched back to previous page: ${page.url()}`);
          console.log(`    📚 Stack size: ${pageStack.length}`);
        } else {
          console.warn(`    ⚠️ No previous page in stack, using first available page`);
          const allPages = context.pages();
          page = allPages[0];
        }
      }
      break;

    case 'clickUntilGone':
      {
        const cugSelector = action.xpath || action.selector!;
        const maxIter = action.maxIterations || 10;
        const waitBetween = action.waitBetweenClicks || 500;
        console.log(`    🔄 Starting Click Until Gone: ${cugSelector}`);

        let iterations = 0;
        while (iterations < maxIter) {
          try {
            const element = page.locator(cugSelector);
            const isVisible = await element.isVisible();

            if (!isVisible) {
              console.log(`    ✅ Element is gone after ${iterations} iterations`);
              break;
            }

            await element.click();
            console.log(`      ↻ Click ${iterations + 1}/${maxIter}`);
            iterations++;

            await page.waitForTimeout(waitBetween);
          } catch (e) {
            console.log(`    ✅ Element disappeared or became unclickable`);
            break;
          }
        }

        if (iterations >= maxIter) {
          console.warn(`    ⚠️ Reached maximum iterations (${maxIter})`);
        }
      }
      break;

    case 'captureTable':
      console.log(`    ✓ Table capture action (skipped in replay)`);
      break;

    case 'print':
      console.log(`    ✓ Print action (requires OS automation)`);
      break;
  }

  return page;
}

/**
 * Get output directory path - uses userData in production, cwd in development
 */
function getOutputDir(): string {
  const baseDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'output')
    : path.join(process.cwd(), 'output');

  // Browser recorder tests go in their own subdirectory
  const outputDir = path.join(baseDir, 'browser-recorder-tests');

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Migrate old test files from the root output directory
  migrateOldTestFiles(baseDir, outputDir);

  return outputDir;
}

/**
 * Migrate old test files from root output directory to browser-recorder-tests folder
 */
function migrateOldTestFiles(baseDir: string, newDir: string): void {
  try {
    if (!fs.existsSync(baseDir)) return;

    const files = fs.readdirSync(baseDir);
    const oldTestFiles = files.filter(f =>
      (f.startsWith('playwright-test-') || f.startsWith('egdesk-browser-recorder-')) &&
      f.endsWith('.spec.js')
    );

    if (oldTestFiles.length === 0) return;

    console.log(`📦 Migrating ${oldTestFiles.length} old test file(s) to new location...`);

    for (const file of oldTestFiles) {
      const oldPath = path.join(baseDir, file);
      const newPath = path.join(newDir, file);

      // Skip if already exists in new location
      if (fs.existsSync(newPath)) {
        console.log(`⏭️  Skipping ${file} (already exists in new location)`);
        continue;
      }

      // Move the file
      fs.renameSync(oldPath, newPath);
      console.log(`✅ Migrated: ${file}`);
    }

    console.log('✅ Migration complete');
  } catch (error) {
    console.error('❌ Error migrating old test files:', error);
    // Don't throw - migration failure shouldn't break the app
  }
}

/**
 * Helper function to normalize URL - tries www version if non-www fails
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // If it's a root domain (no www), try adding www
    if (urlObj.hostname && !urlObj.hostname.startsWith('www.') && urlObj.hostname.split('.').length === 2) {
      urlObj.hostname = `www.${urlObj.hostname}`;
      console.log(`🔧 [URL Normalization] Converted ${url} to ${urlObj.toString()}`);
      return urlObj.toString();
    }
  } catch (e) {
    // Invalid URL, return as-is
  }
  return url;
}

/**
 * Register Chrome browser automation IPC handlers
 */
export function registerChromeHandlers(): void {
  console.log('🌐 Registering Chrome browser automation IPC handlers...');

  // Launch Chrome with a specific URL
  ipcMain.handle('launch-chrome-with-url', async (event, { url, proxy, openDevTools, runLighthouse }) => {
    try {
      const { chromium } = require('playwright-core');
      
      // Normalize URL - try www version for root domains
      url = normalizeUrl(url);
      
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
      
      // Get a random port for remote debugging (only if Lighthouse is needed)
      const debugPort = runLighthouse ? Math.floor(Math.random() * 10000) + 9000 : undefined;
      
      console.log('🔍 [DEBUG] Step 1: Launching browser...');
      console.log('🔍 [DEBUG] - URL:', url);
      console.log('🔍 [DEBUG] - Proxy:', proxy ? 'configured' : 'none');
      console.log('🔍 [DEBUG] - Debug port:', debugPort || 'not needed');
      
      const browser = await chromium.launch({ 
        headless: false,
        channel: 'chrome',
        proxy: proxyOption,
        args: [
          ...(runLighthouse && debugPort ? [`--remote-debugging-port=${debugPort}`] : []),
          ...(openDevTools ? ['--auto-open-devtools-for-tabs'] : []),
          ...(runLighthouse ? [
            '--enable-features=Lighthouse',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ] : [])
        ]
      });
      console.log('✅ [DEBUG] Step 1: Browser launched successfully');
      
      console.log('🔍 [DEBUG] Step 2: Creating browser context...');
      const context = await browser.newContext();
      console.log('✅ [DEBUG] Step 2: Browser context created');
      
      console.log('🔍 [DEBUG] Step 3: Creating new page directly from browser...');
      // Try using browser.newPage() directly instead of context.newPage()
      // This creates a page in the default context which might be more reliable
      const page = await browser.newPage();
      console.log('✅ [DEBUG] Step 3: Page created using browser.newPage()');
      
      // Wait a moment for the page to initialize
      await page.waitForTimeout(500);
      
      // Check initial page state
      try {
        const initialUrl = page.url();
        console.log('🔍 [DEBUG] Step 4: Initial page URL:', initialUrl);
      } catch (e) {
        console.log('⚠️ [DEBUG] Step 4: Could not get initial URL:', e);
      }
      
      // Validate URL before navigating
      try {
        console.log('🔍 [DEBUG] Step 5: Validating URL...');
        new URL(url);
        console.log('✅ [DEBUG] Step 5: URL is valid');
        
        console.log('🔍 [DEBUG] Step 6: Starting navigation to:', url);
        console.log('🔍 [DEBUG] Step 6: Navigation options:', { waitUntil: 'load', timeout: 60000 });
        
        // Add a timeout monitor
        const navigationStartTime = Date.now();
        const checkInterval = setInterval(() => {
          const elapsed = Date.now() - navigationStartTime;
          if (elapsed > 5000 && elapsed % 10000 < 1000) { // Log every 10 seconds
            console.log(`⏳ [DEBUG] Navigation still in progress... (${Math.floor(elapsed / 1000)}s elapsed)`);
            try {
              const currentUrl = page.url();
              console.log(`⏳ [DEBUG] Current page URL during navigation: ${currentUrl}`);
            } catch (e) {
              console.log(`⏳ [DEBUG] Could not check URL during navigation:`, e);
            }
          }
        }, 1000);
        
        try {
          // Try domcontentloaded first (less strict, faster)
          console.log(`🔍 [DEBUG] Step 6: Attempting navigation with 'domcontentloaded'...`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          clearInterval(checkInterval);
          const finalUrl = page.url();
          console.log(`✅ [DEBUG] Step 6: Navigation completed successfully`);
          console.log(`✅ [DEBUG] Final page URL: ${finalUrl}`);
          console.log(`🌐 Chrome launched and navigated to: ${url}`);
        } catch (navError: any) {
          clearInterval(checkInterval);
          const errorUrl = page.url();
          console.error(`❌ [DEBUG] Step 6: Navigation failed`);
          console.error(`❌ [DEBUG] Error type: ${navError?.name || 'Unknown'}`);
          console.error(`❌ [DEBUG] Error message: ${navError?.message || 'Unknown error'}`);
          console.error(`❌ [DEBUG] Page URL at error: ${errorUrl}`);
          
          // If stuck at about:blank, try a workaround
          if (errorUrl === 'about:blank' || errorUrl.startsWith('about:')) {
            console.log(`🔄 [DEBUG] Step 6: Attempting workaround for about:blank hang...`);
            try {
              // Try navigating to about:blank first to "reset" the page
              await page.goto('about:blank', { timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(1000);
              // Then try the actual URL with commit option
              console.log(`🔄 [DEBUG] Step 6: Retrying navigation with 'commit' waitUntil...`);
              await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
              const retryUrl = page.url();
              console.log(`✅ [DEBUG] Step 6: Workaround succeeded! Final URL: ${retryUrl}`);
            } catch (retryError: any) {
              console.error(`❌ [DEBUG] Step 6: Workaround also failed:`, retryError?.message);
              throw navError; // Throw original error
            }
          } else {
            throw navError;
          }
        }
        
        // Wait for network to be idle separately (non-blocking)
        console.log('🔍 [DEBUG] Step 7: Waiting for network idle...');
        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          console.log('✅ [DEBUG] Step 7: Network idle achieved');
        } catch (e) {
          // Continue even if networkidle times out
          console.log('⚠️ [DEBUG] Step 7: Network idle timeout, continuing anyway');
        }
        
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
            
            // Run Lighthouse audit - catch threshold errors but still generate reports
            try {
              await playAudit({
                page: page,
                port: debugPort,
                // Set Lighthouse report locale to Korean
                opts: {
                  locale: 'ko',
                },
                thresholds: {
                  performance: 0, // Lower threshold to avoid blocking on performance issues
                  accessibility: 50,
                  'best-practices': 50,
                  seo: 50,
                  pwa: 0, // PWA is often not applicable, so don't block on it
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
            } catch (thresholdError: any) {
              // If thresholds fail, the report is still generated, so we can continue
              // Log the warning but don't fail the entire analysis
              if (thresholdError?.message?.includes('threshold')) {
                console.warn(`⚠️ Lighthouse thresholds not met, but report generated:`, thresholdError.message);
              } else {
                // Re-throw if it's a different error
                throw thresholdError;
              }
            }
            
            console.log('🔍 [DEBUG] Lighthouse audit completed successfully');
            console.log('🔍 [DEBUG] Reports saved to ./output/ directory');
            
            // Generate PDF with all sections expanded
            try {
              console.log('📄 [DEBUG] Generating PDF with expanded sections...');
              
              // Load the generated HTML report
              const outputDir = getOutputDir();
              const htmlReportPath = pathToFileURL(path.join(outputDir, `${reportName}.html`)).href;
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

  // Generate Lighthouse reports for multiple URLs
  ipcMain.handle('generate-lighthouse-reports', async (event, { urls, proxy }) => {
    try {
      const { chromium } = require('playwright-core');
      const { playAudit } = require('playwright-lighthouse');
      const fs = require('fs');
      
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
      
      // Get output directory (handles both dev and production)
      const outputDir = getOutputDir();
      
      const results = [];
      const debugPort = Math.floor(Math.random() * 10000) + 9000;
      
      console.log('🔍 [DEBUG] Batch: Step 1: Launching browser...');
      console.log('🔍 [DEBUG] Batch: - Debug port:', debugPort);
      console.log('🔍 [DEBUG] Batch: - Proxy:', proxy ? 'configured' : 'none');
      
      // Launch browser once for all audits - using clean browser without user-data-dir
      const browser = await chromium.launch({ 
        headless: false,
        channel: 'chrome',
        proxy: proxyOption,
        args: [
          `--remote-debugging-port=${debugPort}`,
          '--enable-features=Lighthouse',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled', // Prevent detection
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps'
        ]
      });
      console.log('✅ [DEBUG] Batch: Step 1: Browser launched successfully');
      
      // Create context for PDF generation later, but use browser.newPage() for navigation
      // browser.newPage() uses default context which seems more reliable
      console.log('🔍 [DEBUG] Batch: Step 2: Creating browser context for PDF generation...');
      const context = await browser.newContext();
      console.log('✅ [DEBUG] Batch: Step 2: Browser context created');
      
      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const originalUrl = urls[i];
        
        // Normalize URL - try www version for root domains (for navigation only)
        const normalizedUrl = normalizeUrl(originalUrl);
        
        const urlResult: {
          url: string;
          success: boolean;
          reportName: string | null;
          error: string | null;
          index: number;
          total: number;
          originalUrl?: string; // Preserve original URL
          normalizedUrl?: string; // Track normalized URL used for navigation
        } = {
          url: originalUrl, // Keep original URL in result
          success: false,
          reportName: null,
          error: null,
          index: i + 1,
          total: urls.length,
          originalUrl,
          normalizedUrl: normalizedUrl !== originalUrl ? normalizedUrl : undefined
        };
        
        try {
          console.log(`\n🔍 [${i + 1}/${urls.length}] Processing: ${originalUrl}${normalizedUrl !== originalUrl ? ` (using ${normalizedUrl} for navigation)` : ''}`);
          
          // Send progress update to renderer
          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url: originalUrl, // Send original URL to renderer
            status: 'processing'
          });
          
          console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Step 1: Creating new page...`);
          const page = await context.newPage();
          console.log(`✅ [DEBUG] [${i + 1}/${urls.length}] Step 1: Page created`);
          
          // Check initial page state
          try {
            const initialUrl = page.url();
            console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Step 2: Initial page URL: ${initialUrl}`);
          } catch (e) {
            console.log(`⚠️ [DEBUG] [${i + 1}/${urls.length}] Step 2: Could not get initial URL:`, e);
          }
          
          // Navigate to normalized URL - use 'load' for more reliable navigation
          console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Step 3: Starting navigation to ${normalizedUrl}...`);
          console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Step 3: Navigation options:`, { waitUntil: 'load', timeout: 60000 });
          
          // Add a timeout monitor
          const navigationStartTime = Date.now();
          const checkInterval = setInterval(() => {
            const elapsed = Date.now() - navigationStartTime;
            if (elapsed > 5000 && elapsed % 10000 < 1000) { // Log every 10 seconds
              console.log(`⏳ [DEBUG] [${i + 1}/${urls.length}] Navigation still in progress... (${Math.floor(elapsed / 1000)}s elapsed)`);
              try {
                const currentUrl = page.url();
                console.log(`⏳ [DEBUG] [${i + 1}/${urls.length}] Current page URL during navigation: ${currentUrl}`);
              } catch (e) {
                console.log(`⏳ [DEBUG] [${i + 1}/${urls.length}] Could not check URL during navigation:`, e);
              }
            }
          }, 1000);
          
          try {
            // Try domcontentloaded first (less strict, faster)
            console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Attempting navigation with 'domcontentloaded'...`);
            await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            clearInterval(checkInterval);
            const finalUrl = page.url();
            console.log(`✅ [DEBUG] [${i + 1}/${urls.length}] Step 3: Navigation completed successfully`);
            console.log(`✅ [DEBUG] [${i + 1}/${urls.length}] Final page URL: ${finalUrl}`);
            console.log(`✅ Navigated to: ${normalizedUrl} (original: ${originalUrl})`);
          } catch (navError: any) {
            clearInterval(checkInterval);
            const errorUrl = page.url();
            console.error(`❌ [DEBUG] [${i + 1}/${urls.length}] Step 3: Navigation failed`);
            console.error(`❌ [DEBUG] [${i + 1}/${urls.length}] Error type: ${navError?.name || 'Unknown'}`);
            console.error(`❌ [DEBUG] [${i + 1}/${urls.length}] Error message: ${navError?.message || 'Unknown error'}`);
            console.error(`❌ [DEBUG] [${i + 1}/${urls.length}] Page URL at error: ${errorUrl}`);
            
            // If stuck at about:blank, try a workaround
            if (errorUrl === 'about:blank' || errorUrl.startsWith('about:')) {
              console.log(`🔄 [DEBUG] [${i + 1}/${urls.length}] Attempting workaround for about:blank hang...`);
              try {
            // Try navigating to about:blank first to "reset" the page
            await page.goto('about:blank', { timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(1000);
            // Then try the actual URL with commit option
            console.log(`🔄 [DEBUG] [${i + 1}/${urls.length}] Retrying navigation with 'commit' waitUntil...`);
            await page.goto(normalizedUrl, { waitUntil: 'commit', timeout: 30000 });
                const retryUrl = page.url();
                console.log(`✅ [DEBUG] [${i + 1}/${urls.length}] Workaround succeeded! Final URL: ${retryUrl}`);
              } catch (retryError: any) {
                console.error(`❌ [DEBUG] [${i + 1}/${urls.length}] Workaround also failed:`, retryError?.message);
                throw navError; // Throw original error
              }
            } else {
              throw navError;
            }
          }
          
          // Wait for network to be idle separately (non-blocking)
          console.log(`🔍 [DEBUG] [${i + 1}/${urls.length}] Step 4: Waiting for network idle...`);
          try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            console.log(`✅ [DEBUG] [${i + 1}/${urls.length}] Step 4: Network idle achieved`);
          } catch (e) {
            // Continue even if networkidle times out
            console.log(`⚠️ [DEBUG] [${i + 1}/${urls.length}] Step 4: Network idle timeout, continuing anyway`);
          }
          
          // Generate unique report name (use original URL for filename)
          const timestamp = Date.now();
          const sanitizedUrl = originalUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const reportName = `lighthouse-${sanitizedUrl}-${timestamp}`;
          
          // Run Lighthouse audit - catch threshold errors but still generate reports
          try {
            await playAudit({
              page: page,
              port: debugPort,
              opts: {
                locale: 'ko',
              },
              thresholds: {
                performance: 0, // Lower threshold to avoid blocking on performance issues
                accessibility: 50,
                'best-practices': 50,
                seo: 50,
                pwa: 0, // PWA is often not applicable, so don't block on it
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
          } catch (thresholdError: any) {
            // If thresholds fail, the report is still generated, so we can continue
            // Log the warning but don't fail the entire analysis
            if (thresholdError?.message?.includes('threshold')) {
              console.warn(`⚠️ Lighthouse thresholds not met, but report generated:`, thresholdError.message);
            } else {
              // Re-throw if it's a different error
              throw thresholdError;
            }
          }
          
          console.log(`✅ Lighthouse audit completed for: ${originalUrl}`);
          
          // Generate PDF with expanded sections
          try {
            const htmlReportPath = pathToFileURL(path.join(outputDir, `${reportName}.html`)).href;
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
          
          // Send success update (use original URL)
          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url: originalUrl, // Send original URL
            status: 'completed',
            reportName
          });
          
          await page.close();
          
        } catch (error) {
          console.error(`❌ Failed to process ${originalUrl}:`, error);
          urlResult.error = error instanceof Error ? error.message : 'Unknown error';
          
          // Send error update (use original URL)
          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url: originalUrl, // Send original URL
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
            overall: Math.round(((perf + a11y + bp + seo) / 4) * 100)
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
      const overallAverage = Math.round((avgPerformance + avgAccessibility + avgBestPractices + avgSEO) / 4);
      
      // Collect all recommendations
      const allRecommendations: any[] = [];
      const issuesByCategory: any = {
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
          } else {
            // Fallback to any active Google key
            googleKey = aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) || aiKeys.find((k: any) => k?.providerId === 'google');
          }
        }

        if (googleKey?.fields?.apiKey) {
          const { generateTextWithAI } = require('./gemini');

          const prompt = `Analyze the following SEO issues found across multiple websites and provide a comprehensive explanation and recommendations:

Issues by Category:
${Object.entries(issuesByCategory).map(([cat, issues]: [string, any]) => 
  `${cat}: ${Array.from(issues).join(', ')}`
).join('\n')}

All Issues:
${allRecommendations.map((issue: any) => 
  `- ${issue.title} (${issue.category}): ${issue.description}`
).join('\n')}

Please provide:
1. A summary of the most common issues
2. Prioritized recommendations for improvement
3. Actionable steps to address these issues`;

          const result = await generateTextWithAI({
            prompt,
            apiKey: googleKey.fields.apiKey,
            model: 'gemini-2.5-flash',
            streaming: false,
            useRetry: false,
            package: 'generative-ai',
          });
          aiExplanation = result.text;
        }
      } catch (aiError) {
        console.error('Failed to generate AI explanation:', aiError);
      }
      
      // Generate HTML report
      const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .score-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .score-value { font-size: 2em; font-weight: bold; color: #007bff; }
    .score-label { color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #007bff; color: white; }
    tr:hover { background: #f5f5f5; }
    .ai-explanation { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>SEO Analysis Report</h1>
    
    <div class="summary">
      <div class="score-card">
        <div class="score-value">${overallAverage.toFixed(1)}</div>
        <div class="score-label">Overall Average</div>
      </div>
      <div class="score-card">
        <div class="score-value">${avgPerformance.toFixed(1)}</div>
        <div class="score-label">Performance</div>
      </div>
      <div class="score-card">
        <div class="score-value">${avgAccessibility.toFixed(1)}</div>
        <div class="score-label">Accessibility</div>
      </div>
      <div class="score-card">
        <div class="score-value">${avgBestPractices.toFixed(1)}</div>
        <div class="score-label">Best Practices</div>
      </div>
      <div class="score-card">
        <div class="score-value">${avgSEO.toFixed(1)}</div>
        <div class="score-label">SEO</div>
      </div>
    </div>
    
    <h2>Detailed Scores</h2>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Performance</th>
          <th>Accessibility</th>
          <th>Best Practices</th>
          <th>SEO</th>
          <th>Overall</th>
        </tr>
      </thead>
      <tbody>
        ${scores.map((score: any) => `
          <tr>
            <td>${score.url}</td>
            <td>${score.performance.toFixed(1)}</td>
            <td>${score.accessibility.toFixed(1)}</td>
            <td>${score.bestPractices.toFixed(1)}</td>
            <td>${score.seo.toFixed(1)}</td>
            <td>${score.overall.toFixed(1)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${aiExplanation ? `
      <div class="ai-explanation">
        <h2>AI Recommendations</h2>
        <div>${aiExplanation.replace(/\n/g, '<br>')}</div>
      </div>
    ` : ''}
  </div>
</body>
</html>`;
      
      fs.writeFileSync(finalReportPath, htmlContent);
      console.log(`📄 Final report saved: ${finalReportPath}`);
      
      // Generate merged PDF
      let mergedPdfPath: string | null = null;
      try {
        const pdfPage = await context.newPage();
        await pdfPage.goto(pathToFileURL(finalReportPath).href);
        await pdfPage.waitForLoadState('networkidle');
        await pdfPage.waitForTimeout(2000);
        
        mergedPdfPath = path.join(outputDir, `merged-seo-report-${Date.now()}.pdf`);
        await pdfPage.pdf({
          path: mergedPdfPath,
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
          }
        });
        
        await pdfPage.close();
        console.log(`📄 Merged PDF saved: ${mergedPdfPath}`);
      } catch (pdfError) {
        console.error('❌ Failed to generate merged PDF:', pdfError);
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


  // Enhanced Playwright recorder with keyboard tracking
  // (activeRecorder is now defined at module scope)

  ipcMain.handle('launch-browser-recorder-enhanced', async (event, { url, extensionPaths, chainId, previousDownload, previousScriptPath }) => {
    try {
      console.log('🎭 Launching enhanced Playwright recorder for URL:', url);
      if (extensionPaths && extensionPaths.length > 0) {
        console.log(`🧩 With ${extensionPaths.length} Chrome extensions`);
      }
      if (chainId) {
        console.log(`🔗 Chain ID: ${chainId}`);

        // If this is a chain recording, add the previous script to the chain first
        if (previousScriptPath && fs.existsSync(previousScriptPath)) {
          const metadataStore = getChainMetadataStore();

          // Extract the downloaded filename from previousDownload if available
          let downloadedFilename: string | undefined;
          if (previousDownload) {
            downloadedFilename = path.basename(previousDownload);
          }

          // Add the previous script as Step 1
          metadataStore.addScriptToChain(
            chainId,
            previousScriptPath,
            path.basename(previousScriptPath),
            true,  // hasDownloads
            downloadedFilename
          );
          console.log(`🔗 Added previous script to chain as Step 1: ${path.basename(previousScriptPath)}`);
        }
      }
      if (previousDownload) {
        console.log(`📎 Previous download: ${previousDownload}`);
      }

      // Clean up any existing recorder
      if (activeRecorder) {
        try {
          await activeRecorder.stop();
        } catch (err) {
          console.error('Error stopping previous recorder:', err);
        }
      }

      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptName = `egdesk-browser-recorder-${timestamp}`;
      const outputFile = path.join(getOutputDir(), `${scriptName}.spec.js`);

      // Create initial file with empty test
      const initialCode = `import { test, expect } from '@playwright/test';

test('recorded test', async ({ page }) => {
  // Recording in progress...
});`;
      fs.writeFileSync(outputFile, initialCode);

      // Open our code viewer window
      await codeViewerWindow.create();
      codeViewerWindow.setRecordingMode();
      codeViewerWindow.updateCode(initialCode);

      // Create new recorder
      activeRecorder = new BrowserRecorder();
      activeRecorder.setOutputFile(outputFile);
      activeRecorder.setScriptName(scriptName);

      // Set extensions if provided
      if (extensionPaths && extensionPaths.length > 0) {
        activeRecorder.setExtensions(extensionPaths);
      }

      // Set chain parameters if this is a chained recording
      if (chainId && previousDownload) {
        activeRecorder.setChainParameters(chainId, previousDownload);
      }

      // Set up real-time updates
      activeRecorder.setUpdateCallback((code) => {
        console.log('🔔 Update callback triggered, code length:', code.length);

        // Update code viewer window
        codeViewerWindow.updateCode(code);
        codeViewerWindow.updateActions(activeRecorder.getActions());

        // Send update to renderer
        event.sender.send('playwright-test-update', {
          filePath: outputFile,
          code: code,
          timestamp
        });
      });

      // Set up wait settings callback from code viewer
      codeViewerWindow.setWaitSettingsCallback((settings) => {
        console.log('⏱️ Wait settings changed, updating recorder:', settings);
        if (activeRecorder) {
          activeRecorder.setWaitSettings(settings);
        }
      });

      // Set up delete action callback from code viewer
      codeViewerWindow.setDeleteActionCallback((index) => {
        console.log('🗑️ Delete action callback triggered for index:', index);
        if (activeRecorder) {
          activeRecorder.deleteAction(index);
        }
      });

      // Set up play to action callback from code viewer
      codeViewerWindow.setPlayToActionCallback(async (index) => {
        console.log('▶️ Play to action callback triggered for index:', index);

        if (!activeRecorder) {
          console.error('❌ No active recorder');
          return;
        }

        try {
          const { chromium } = require('playwright-core');

          // Get all actions
          const allActions = activeRecorder.getActions();

          if (index >= allActions.length) {
            console.error('❌ Invalid action index');
            return;
          }

          // Get partial actions
          const partialActions = allActions.slice(0, index + 1);

          console.log(`🎬 Executing ${partialActions.length} actions (up to index ${index})`);

          // Launch browser and execute actions
          const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-partial-'));
          const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
          if (!fs.existsSync(downloadsPath)) {
            fs.mkdirSync(downloadsPath, { recursive: true });
          }

          // Get screen dimensions for positioning
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width, height } = primaryDisplay.workAreaSize;
          const browserWidth = Math.floor(width * 0.6);
          const browserHeight = height;
          const browserX = width - browserWidth;
          const browserY = 0;

          const context = await chromium.launchPersistentContext(profileDir, {
            headless: false,
            channel: 'chrome',
            viewport: { width: browserWidth, height: browserHeight },
            acceptDownloads: true,
            downloadsPath: downloadsPath,
            args: [
              '--no-default-browser-check',
              '--disable-blink-features=AutomationControlled',
              `--window-position=${browserX},${browserY}`,
            ]
          });

          let page = context.pages()[0] || await context.newPage();

          // Set up dialog handling
          page.on('dialog', async (dialog) => {
            console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
            await dialog.accept();
            console.log('✅ Dialog accepted');
          });

          // Page stack for multi-tab handling
          const pageStack: Page[] = [];

          // Execute each action in sequence with wait times
          for (let i = 0; i < partialActions.length; i++) {
            const action = partialActions[i];

            // Calculate wait time
            if (i > 0) {
              const prevAction = partialActions[i - 1];
              const waitTime = action.timestamp - prevAction.timestamp;
              const adjustedWait = Math.min(
                Math.round(waitTime * codeViewerWindow.getWaitSettings().multiplier),
                codeViewerWindow.getWaitSettings().maxDelay
              );

              if (adjustedWait > 0) {
                await page.waitForTimeout(adjustedWait);
              }
            }

            // Execute action
            page = await executeAction(page, context, action, i, partialActions, pageStack);
          }

          // Browser is now paused at action index
          console.log(`⏸️ Browser paused at action ${index}`);

          // Create paused session
          const sessionId = `session-${Date.now()}`;
          pausedSessions.set(sessionId, {
            id: sessionId,
            browser: context.browser()!,
            context: context,
            page: page,
            pausedAtActionIndex: index,
            actions: allActions,
            testPath: activeRecorder.getOutputFile(),
            createdAt: new Date()
          });

          // Inject Resume Recording UI (need to get the browser recorder window)
          const browserRecorderWindow = BrowserWindow.getAllWindows().find(w => w.webContents === event.sender);
          if (browserRecorderWindow) {
            await injectResumeUI(page, sessionId, index, allActions.length, browserRecorderWindow);
          }

          console.log(`✅ Session ${sessionId} ready for resume`);

        } catch (error) {
          console.error('❌ Error executing partial test:', error);
        }
      });

      try {
        await activeRecorder.start(url, async () => {
        // Browser was closed by user - auto-stop recording
        console.log('🔌 Browser closed - stopping recording automatically');

        // Stop the recorder
        if (activeRecorder) {
          const testCode = await activeRecorder.stop();
          const recordedActions = activeRecorder.getActions();
          activeRecorder = null;

          // Create timed version with realistic delays
          const timedCode = createTimedTestFromCode(testCode);
          // Save directly as the main file (no separate .timed version)
          fs.writeFileSync(outputFile, timedCode);

          // Close the code viewer window
          codeViewerWindow.close();

          // Check for downloads in recorded actions for chain support
          const downloadActions = recordedActions.filter((action: RecordedAction) => action.type === 'download');
          const hasDownloads = downloadActions.length > 0;
          let lastDownloadedFile = null;
          let lastDownloadPath = null;

          if (hasDownloads && downloadActions.length > 0) {
            const lastDownload = downloadActions[downloadActions.length - 1];
            lastDownloadedFile = lastDownload.value; // filename with "Download completed: " prefix for display

            // Strip "Download completed: " prefix to get actual filename
            const actualFilename = (lastDownloadedFile || '').replace(/^Download completed:\s*/, '');

            const scriptName = path.basename(outputFile, '.spec.js');
            const downloadsDir = path.join(app.getPath('downloads'), 'EGDesk-Browser', scriptName);
            lastDownloadPath = path.join(downloadsDir, actualFilename);  // Use clean filename

            console.log(`📥 Download detected: ${lastDownloadedFile}`);
            console.log(`📂 Actual filename: ${actualFilename}`);
            console.log(`📂 Full path: ${lastDownloadPath}`);
          }

          // Get chain metadata if this is a chained recording
          const chainMetadata = activeRecorder ? activeRecorder.getChainMetadata() : null;

          // Store chain metadata if this is part of a chain
          if (chainMetadata?.chainId) {
            const metadataStore = getChainMetadataStore();
            metadataStore.addScriptToChain(
              chainMetadata.chainId,
              outputFile,
              path.basename(outputFile),
              hasDownloads,
              lastDownloadedFile || undefined
            );
          }

          // Notify renderer
          event.sender.send('playwright-test-saved', {
            filePath: outputFile,
            code: timedCode,
            timestamp: new Date().toISOString(),
            hasDownloads,
            lastDownloadedFile,
            lastDownloadPath,
            chainId: chainMetadata?.chainId || null,
            isChainedRecording: chainMetadata?.isChainedRecording || false
          });

          event.sender.send('recorder-auto-stopped', {
            reason: 'Browser window closed by user'
          });
        }
      });
      } catch (startError: any) {
        console.error('Failed to start recorder:', startError);
        throw startError;
      }
      
      return {
        success: true,
        message: 'Enhanced recorder started with code viewer.',
        filePath: outputFile
      };
    } catch (error: any) {
      console.error('Error launching enhanced recorder:', error);
      return {
        success: false,
        error: error?.message || 'Failed to launch enhanced recorder'
      };
    }
  });
  
  ipcMain.handle('stop-browser-recorder-enhanced', async (event) => {
    console.log('🛑 Stop recording called');
    try {
      if (!activeRecorder) {
        console.log('❌ No active recorder found');
        return {
          success: false,
          error: 'No active recorder'
        };
      }

      console.log('✅ Active recorder found, stopping...');
      const testCode = await activeRecorder.stop();
      console.log('✅ Recorder stopped, test code generated');
      const recordedActions = activeRecorder.getActions();
      console.log(`✅ Got ${recordedActions.length} recorded actions`);

      // Get chain metadata BEFORE setting activeRecorder to null
      const chainMetadata = activeRecorder.getChainMetadata();

      activeRecorder = null;

      // The test file has already been created and updated in real-time
      // Update it with the timed version (with realistic delays)
      const outputFiles = fs.readdirSync(getOutputDir())
        .filter(f => f.endsWith('.spec.js'))
        .map(f => path.join(getOutputDir(), f))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());

      if (outputFiles.length > 0) {
        const outputFile = outputFiles[0]; // Most recent file
        console.log(`📝 Processing output file: ${outputFile}`);
        const timedCode = createTimedTestFromCode(testCode);
        // Overwrite the file with the timed version
        fs.writeFileSync(outputFile, timedCode);

        console.log(`✅ Enhanced test saved to: ${outputFile}`);

        // Close the code viewer window
        console.log('🪟 Closing code viewer window');
        codeViewerWindow.close();

        // Check for downloads in recorded actions for chain support
        const downloadActions = recordedActions.filter((action: RecordedAction) => action.type === 'download');
        const hasDownloads = downloadActions.length > 0;
        let lastDownloadedFile = null;
        let lastDownloadPath = null;

        if (hasDownloads && downloadActions.length > 0) {
          const lastDownload = downloadActions[downloadActions.length - 1];
          lastDownloadedFile = lastDownload.value; // filename with "Download completed: " prefix for display

          // Strip "Download completed: " prefix to get actual filename
          const actualFilename = (lastDownloadedFile || '').replace(/^Download completed:\s*/, '');

          // Construct the full path based on the scriptName used during recording
          const scriptName = path.basename(outputFile, '.spec.js');
          const downloadsDir = path.join(app.getPath('downloads'), 'EGDesk-Browser', scriptName);
          lastDownloadPath = path.join(downloadsDir, actualFilename);  // Use clean filename

          console.log(`📥 Download detected: ${lastDownloadedFile}`);
          console.log(`📂 Actual filename: ${actualFilename}`);
          console.log(`📂 Full path: ${lastDownloadPath}`);
        }

        // Store chain metadata if this is part of a chain (chainMetadata was obtained earlier before activeRecorder was set to null)
        if (chainMetadata?.chainId) {
          const metadataStore = getChainMetadataStore();
          metadataStore.addScriptToChain(
            chainMetadata.chainId,
            outputFile,
            path.basename(outputFile),
            hasDownloads,
            lastDownloadedFile || undefined
          );
        }

        // Notify renderer
        console.log('📤 Notifying renderer about saved test');
        event.sender.send('playwright-test-saved', {
          filePath: outputFile,
          code: timedCode,
          timestamp: new Date().toISOString(),
          hasDownloads,
          lastDownloadedFile,
          lastDownloadPath,
          chainId: chainMetadata?.chainId || null,
          isChainedRecording: chainMetadata?.isChainedRecording || false
        });

        console.log('✅ Stop recording completed successfully');
        return {
          success: true,
          filePath: outputFile,
          code: timedCode
        };
      } else {
        console.log('❌ No test file found in output directory');
        return {
          success: false,
          error: 'No test file found'
        };
      }
    } catch (error: any) {
      console.error('❌ Error stopping recorder:', error);
      console.error('Error stack:', error?.stack);
      return {
        success: false,
        error: error?.message || 'Failed to stop recorder'
      };
    }
  });
  
  // Create test with actual captured timing
  function createTimedTestWithActualTiming(originalCode: string, timingData: any[]): string {
    let enhancedCode = originalCode;
    
    // Add comment about actual timing
    enhancedCode = enhancedCode.replace(
      "import { test, expect } from '@playwright/test';",
      `import { test, expect } from '@playwright/test';
// This test includes actual timing delays captured during recording`
    );
    
    // Get all the page action lines
    const lines = originalCode.split('\n');
    const actionLines = lines.filter(line => line.includes('await page.'));
    
    // Match timing data to actions and insert delays
    let timingIndex = 0;
    actionLines.forEach((actionLine, index) => {
      if (index > 0 && timingIndex < timingData.length) {
        const timing = timingData[timingIndex];
        if (timing.timeSinceLastAction > 100) { // Only add meaningful delays
          const delay = Math.round(timing.timeSinceLastAction);
          const delayLine = `  await page.waitForTimeout(${delay}); // Actual recorded delay: ${delay}ms`;
          enhancedCode = enhancedCode.replace(actionLine, delayLine + '\n' + actionLine);
        }
        timingIndex++;
      }
    });
    
    return enhancedCode;
  }
  
  // Helper function to create timed test from code
  function createTimedTestFromCode(originalCode: string): string {
    // Split into lines
    const lines = originalCode.split('\n');
    let enhancedLines: string[] = [];
    let isInTest = false;
    let actionCount = 0;
    
    // Realistic human delays
    const delays = [500, 1000, 1500, 2000, 800, 1200];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're entering a test
      if (line.includes('test(') && line.includes('async')) {
        isInTest = true;
      }
      
      // Add timing comment at the top
      if (i === 0 && line.includes("import { test, expect }")) {
        enhancedLines.push(line);
        enhancedLines.push('// This test includes realistic timing delays for human-like interaction');
        continue;
      }
      
      // Add the current line
      enhancedLines.push(line);
      
      // If we're in a test and this line has a page action, add delay before next action
      if (isInTest && line.trim().startsWith('await page.')) {
        actionCount++;
        
        // Don't add delay after the first action (usually goto) or the last action
        if (actionCount > 1 && i < lines.length - 2) {
          const nextLine = lines[i + 1];
          
          // Check if next line is also a page action
          if (nextLine && nextLine.trim().startsWith('await page.')) {
            const delay = delays[(actionCount - 2) % delays.length] + Math.floor(Math.random() * 500);
            const indent = line.match(/^(\s*)/)?.[1] || '  ';
            enhancedLines.push(`${indent}await page.waitForTimeout(${delay}); // Human-like delay`);
          }
        }
      }
      
      // Handle Enter key press
      if (isInTest && line.includes('.press') && line.includes('Enter')) {
        // Already handled by Playwright
      } else if (isInTest && line.includes('.fill') && !lines[i + 1]?.includes('.press')) {
        // Check if we should add Enter press after fill
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.includes('.press') && !nextLine.includes('.click')) {
          // This might be a search or form field that needs Enter
          if (line.includes('Search') || line.includes('search') || line.includes('query')) {
            const indent = line.match(/^(\s*)/)?.[1] || '  ';
            enhancedLines.push(`${indent}await page.keyboard.press('Enter'); // Submit form`);
          }
        }
      }
      
      // Check if we're leaving the test
      if (line.includes('});') && isInTest) {
        isInTest = false;
      }
    }
    
    return enhancedLines.join('\n');
  }

  // Run saved Playwright test
  ipcMain.handle('run-playwright-test', async (event, { testFile }) => {
    try {
      console.log('🎭 Running Playwright test:', testFile);
      console.log('📁 App packaged:', app.isPackaged);
      console.log('📍 Current directory:', process.cwd());
      
      // Validate test file exists
      if (!fs.existsSync(testFile)) {
        // Send user-friendly error
        event.sender.send('playwright-test-error', {
          error: `Test file not found: ${testFile}. The file may have been moved or deleted.`,
          testFile,
          userFriendly: true
        });
        throw new Error(`Test file not found: ${testFile}`);
      }
      
      // In production, run the test directly in the main process
      if (app.isPackaged) {
        console.log('🚀 Running test directly in main process (production mode)');
        
        const { chromium } = require('playwright-core');

        // File already has timing delays built-in, use it directly
        const fileToRun = testFile;
        console.log(`Using file: ${fileToRun}`);
        
        // Read the generated code
        let generatedCode = fs.readFileSync(fileToRun, 'utf8');

        // Extract the test body
        let testBody = '';

        if (generatedCode.includes('@playwright/test')) {
          // Extract the test body - find everything between test({ and the final })
          const testMatch = generatedCode.match(/test\s*\([^)]+\)\s*\{([\s\S]+)\}\);?\s*$/m);

          if (testMatch && testMatch[1]) {
            testBody = testMatch[1].trim();
          } else {
            // Fallback: more careful extraction
            const lines = generatedCode.split('\n');
            const startIndex = lines.findIndex(line => line.includes('test(') && line.includes('{'));
            const endIndex = lines.lastIndexOf('});');

            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
              testBody = lines.slice(startIndex + 1, endIndex).join('\n').trim();
            }
          }
        } else if (generatedCode.includes('launchPersistentContext')) {
          // Our new format: standalone IIFE with launchPersistentContext
          // Extract code between "try {" and "} finally {"
          console.log('🔍 Detected standalone launchPersistentContext format');

          const lines = generatedCode.split('\n');

          // Find the '} finally {' line and get its indentation
          let finallyIndex = -1;
          let finallyIndent = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('} finally {')) {
              finallyIndex = i;
              finallyIndent = lines[i].search(/\S/); // First non-whitespace character position
              break;
            }
          }

          if (finallyIndex !== -1 && finallyIndent !== -1) {
            // Search backwards from finally to find a 'try {' with the SAME indentation
            let tryIndex = -1;
            for (let i = finallyIndex - 1; i >= 0; i--) {
              const lineIndent = lines[i].search(/\S/);
              if (lineIndent === finallyIndent && lines[i].trim() === 'try {') {
                tryIndex = i;
                console.log('✅ Found matching try block at line', i, 'with indentation', lineIndent);
                break;
              }
            }

            if (tryIndex !== -1) {
              testBody = lines.slice(tryIndex + 1, finallyIndex).join('\n').trim();
              console.log('✅ Extracted test body from try block (lines', tryIndex + 1, 'to', finallyIndex, ')');
            } else {
              console.error('❌ Could not find matching try block with same indentation as finally');
            }
          }

          if (!testBody) {
            console.error('❌ Failed to extract test body, attempting fallback');
            // Fallback: look for the pattern after page setup
            const setupEndMarker = 'page.on(\'dialog\'';
            const setupEndIndex = generatedCode.indexOf(setupEndMarker);
            if (setupEndIndex !== -1) {
              // Find the next 'try {' after setup
              const afterSetup = generatedCode.substring(setupEndIndex);
              const tryMatch = afterSetup.match(/try\s*\{([\s\S]+?)\}\s*finally\s*\{/);
              if (tryMatch && tryMatch[1]) {
                testBody = tryMatch[1].trim();
                console.log('⚠️ Extracted test body using post-setup regex fallback');
              }
            }
          }
        }

        if (!testBody) {
          console.error('❌ Failed to extract test body. File content preview:', generatedCode.substring(0, 500));
          throw new Error('Could not extract test body from file. Check console for file preview.');
        }

        console.log('📋 Test body extracted, length:', testBody.length);
        console.log('📋 First 500 chars of testBody:', testBody.substring(0, 500));
        console.log('📋 Last 500 chars of testBody:', testBody.substring(testBody.length - 500));

        // Send info to renderer
        event.sender.send('playwright-test-info', {
          message: 'Starting test replay in production mode...',
          testFile
        });

        // Create downloads directory in system Downloads folder
        const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
        if (!fs.existsSync(downloadsPath)) {
          fs.mkdirSync(downloadsPath, { recursive: true });
        }
        console.log('📥 Downloads will be saved to:', downloadsPath);

        // Create temporary profile directory in userData (avoids macOS permission issues)
        // Fallback to os.tmpdir() if userData is not available
        let profilesDir: string;
        try {
          const userData = app.getPath('userData');
          if (!userData || userData === '/' || userData.length < 3) {
            throw new Error('Invalid userData path');
          }
          profilesDir = path.join(userData, 'chrome-profiles');
        } catch (err) {
          console.warn('⚠️ userData not available, using os.tmpdir():', err);
          profilesDir = path.join(os.tmpdir(), 'playwright-profiles');
        }

        if (!fs.existsSync(profilesDir)) {
          fs.mkdirSync(profilesDir, { recursive: true });
        }
        const profileDir = fs.mkdtempSync(path.join(profilesDir, 'playwright-replay-'));
        console.log('📁 Using profile directory:', profileDir);

        // Run the test with persistent context (more reliable in production)
        const context = await chromium.launchPersistentContext(profileDir, {
          headless: false,
          channel: 'chrome',
          viewport: null,
          permissions: ['clipboard-read', 'clipboard-write'],
          acceptDownloads: true,
          downloadsPath: downloadsPath,
          args: [
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--allow-running-insecure-content',
            '--disable-features=PrivateNetworkAccessSendPreflights',
            '--disable-features=PrivateNetworkAccessRespectPreflightResults'
          ]
        });

        // Get or create page
        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();

        try {
          console.log('🎬 Starting test replay...');

          // Create a function from the test body and execute it
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

          let testFunction;
          try {
            testFunction = new AsyncFunction('page', 'expect', 'path', 'downloadsPath', testBody);
          } catch (syntaxError: any) {
            // If there's a syntax error creating the function, provide detailed feedback
            const errorMsg = `Failed to create test function: ${syntaxError.message}`;
            console.error('❌', errorMsg);
            console.error('Test body preview (first 1000 chars):', testBody.substring(0, 1000));
            console.error('Test body preview (last 500 chars):', testBody.substring(Math.max(0, testBody.length - 500)));

            // Write the problematic test body to a temp file for inspection
            const tempDebugFile = path.join(os.tmpdir(), 'egdesk-test-debug.js');
            fs.writeFileSync(tempDebugFile, testBody);

            throw new Error(`${errorMsg}\n\nExtracted test body length: ${testBody.length} chars\nDebug file saved to: ${tempDebugFile}\n\nFirst 200 chars:\n${testBody.substring(0, 200)}\n\nLast 200 chars:\n${testBody.substring(Math.max(0, testBody.length - 200))}`);
          }

          // Simple expect implementation for basic assertions
          const expect = (value: any) => ({
            toBe: (expected: any) => {
              if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
              }
            },
            toContain: (expected: any) => {
              if (!value.includes(expected)) {
                throw new Error(`Expected ${value} to contain ${expected}`);
              }
            }
          });

          await testFunction(page, expect, path, downloadsPath);

          console.log('✅ Test completed successfully');

          // Send success event
          event.sender.send('playwright-test-completed', {
            success: true,
            testFile,
            exitCode: 0
          });

        } catch (error: any) {
          console.error('❌ Test failed:', error);

          // Send failure event with full stack trace
          event.sender.send('playwright-test-completed', {
            success: false,
            testFile,
            exitCode: 1,
            error: error?.message || 'Test execution failed',
            stack: error?.stack,
            details: error?.toString()
          });

        } finally {
          await context.close();

          // Clean up profile directory
          try {
            fs.rmSync(profileDir, { recursive: true, force: true });
            console.log('🧹 Cleaned up profile directory:', profileDir);
          } catch (err) {
            console.warn('Failed to clean up profile directory:', err);
          }
        }
        
        return { 
          success: true,
          message: 'Test executed in production mode'
        };
      }
      
      // For development mode, use the spawn approach
      const { spawn, execSync } = require('child_process');
      
      // Check if Node.js is available in production
      let nodeExecutable = 'node';
      let nodeVersion = 'unknown';
      let isElectronNode = false;
      
      if (app.isPackaged) {
        try {
          // Try to find Node.js in the system
          if (process.platform === 'darwin') {
            // Common Node.js locations on macOS
            const nodePaths = [
              '/usr/local/bin/node',
              '/opt/homebrew/bin/node',
              '/usr/bin/node',
              '/System/Volumes/Data/usr/local/bin/node',
              path.join(os.homedir(), '.nvm/versions/node/*/bin/node'), // NVM installations
            ];
            
            // Expand glob patterns
            const expandedPaths: string[] = [];
            for (const nodePath of nodePaths) {
              if (nodePath.includes('*')) {
                try {
                  const glob = require('glob');
                  const matches = glob.sync(nodePath);
                  expandedPaths.push(...matches);
                } catch (e) {
                  // If glob fails, just skip
                }
              } else {
                expandedPaths.push(nodePath);
              }
            }
            
            for (const nodePath of expandedPaths) {
              if (fs.existsSync(nodePath)) {
                nodeExecutable = nodePath;
                console.log(`✅ Found Node.js at: ${nodePath}`);
                break;
              }
            }
          } else if (process.platform === 'win32') {
            // Common Node.js locations on Windows
            const nodePaths = [
              'C:\\Program Files\\nodejs\\node.exe',
              'C:\\Program Files (x86)\\nodejs\\node.exe',
              path.join(process.env.APPDATA || '', '..', 'Local', 'Programs', 'nodejs', 'node.exe')
            ];
            
            for (const nodePath of nodePaths) {
              if (fs.existsSync(nodePath)) {
                nodeExecutable = nodePath;
                console.log(`✅ Found Node.js at: ${nodePath}`);
                break;
              }
            }
          }
          
          // Test if node works and get version
          try {
            nodeVersion = execSync(`"${nodeExecutable}" --version`, { stdio: 'pipe' }).toString().trim();
            console.log(`📌 Node.js version: ${nodeVersion}`);
          } catch (versionError) {
            throw new Error('Node.js found but unable to execute');
          }
        } catch (nodeError) {
          console.error('Node.js not found in system, trying Electron built-in:', nodeError);
          // Fall back to using Electron's Node.js
          nodeExecutable = process.execPath;
          isElectronNode = true;
          try {
            nodeVersion = process.versions.node;
            console.log(`📌 Using Electron's Node.js version: ${nodeVersion}`);
          } catch (e) {
            nodeVersion = 'Electron built-in';
          }
        }
      } else {
        // In development, check node version
        try {
          nodeVersion = execSync('node --version', { stdio: 'pipe' }).toString().trim();
        } catch (e) {
          nodeVersion = process.versions.node || 'unknown';
        }
      }

      // File already has timing delays built-in, use it directly
      const fileToRun = testFile;
      console.log(`Using file: ${fileToRun}`);
      
      // Read the generated code
      let generatedCode = fs.readFileSync(fileToRun, 'utf8');
      
      console.log('Original code first few lines:', generatedCode.substring(0, 200));
      
      // Convert the test code to a runnable script
      if (generatedCode.includes('@playwright/test')) {
        // Extract the test body - find everything between test({ and the final })
        const testMatch = generatedCode.match(/test\s*\([^)]+\)\s*\{([\s\S]+)\}\);?\s*$/m);
        let testBody = '';
        
        if (testMatch && testMatch[1]) {
          testBody = testMatch[1].trim();
        } else {
          // Fallback: more careful extraction
          const lines = generatedCode.split('\n');
          const startIndex = lines.findIndex(line => line.includes('test(') && line.includes('{'));
          const endIndex = lines.lastIndexOf('});');
          
          if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            testBody = lines.slice(startIndex + 1, endIndex).join('\n').trim();
          }
        }
        
        generatedCode = `
const { chromium } = require('playwright-core');

(async () => {
  // Launch browser with system Chrome
  const browser = await chromium.launch({ 
    headless: false, 
    channel: 'chrome' 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🎬 Starting test replay...');
    ${testBody}
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
})();
`;
      } else {
        // It's already a script format, just modify browser launch
        generatedCode = generatedCode.replace(
          /const browser = await chromium\.launch\(\);/g,
          "const browser = await chromium.launch({ headless: false, channel: 'chrome' });"
        );
      }
      
      // Create a temporary file with the modified code
      const tempDir = path.dirname(fileToRun);
      const tempBasename = path.basename(fileToRun, path.extname(fileToRun));
      const tempFile = path.join(tempDir, `${tempBasename}.run.js`);
      fs.writeFileSync(tempFile, generatedCode);
      
      // Run the script directly with Node
      console.log(`🚀 Executing with: ${nodeExecutable} ${tempFile}`);
      
      // In production, we might need special handling for script execution
      const isUsingElectron = nodeExecutable === process.execPath;
      let args: string[];
      
      if (isUsingElectron) {
        // When using Electron's executable, we need to use different approach
        // Try to use Node.js that comes with npm (if available)
        try {
          const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          const npmPrefix = execSync(`${npmPath} prefix -g`, { encoding: 'utf8' }).trim();
          const npmNodePath = path.join(npmPrefix, 'node');
          
          if (fs.existsSync(npmNodePath)) {
            nodeExecutable = npmNodePath;
            isElectronNode = false;
            console.log('📌 Found Node.js via npm:', npmNodePath);
            args = [tempFile];
          } else {
            // If that fails, we can't use Electron directly to run scripts
            throw new Error('Cannot use Electron executable to run Node.js scripts');
          }
        } catch (npmError) {
          console.error('Could not find Node.js via npm:', npmError);
          // Last resort: try executing the script differently
          args = ['-e', fs.readFileSync(tempFile, 'utf8')];
        }
      } else {
        args = [tempFile];
      }
      
      // Prepare environment variables
      const testEnv = {
        ...process.env,
        // Ensure Playwright can find Chrome
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
        // Add node_modules to PATH for production
        NODE_PATH: app.isPackaged 
          ? path.join(process.resourcesPath, 'app', 'node_modules')
          : path.join(__dirname, '..', '..', 'node_modules')
      };
      
      // Log environment info for debugging
      console.log('🔧 Test execution details:', {
        nodeExecutable,
        nodeVersion,
        isElectronNode,
        isPackaged: app.isPackaged,
        NODE_PATH: testEnv.NODE_PATH,
        tempFile
      });
      
      // Try to spawn the process
      let testRun;
      let spawnError: Error | null = null;
      
      try {
        testRun = spawn(nodeExecutable, args, {
          stdio: 'inherit',
          shell: true,
          env: testEnv,
          cwd: path.dirname(tempFile)
        });
      } catch (spawnErr: any) {
        spawnError = spawnErr;
        console.error('❌ Spawn failed immediately:', spawnErr);
        
        // Try alternative execution method
        if (isElectronNode) {
          console.log('🔄 Attempting to execute script directly with eval...');
          try {
            // Read and execute the script in the main process
            const scriptContent = fs.readFileSync(tempFile, 'utf8');
            
            // Send message to user about alternative execution
            event.sender.send('playwright-test-info', {
              message: 'Running test in alternative mode. Chrome browser will open shortly...',
              testFile
            });
            
            // Execute using eval (careful with this approach)
            eval(scriptContent);
            
            return { 
              success: true,
              message: 'Test executed using alternative method',
              warning: 'Test is running in main process context'
            };
          } catch (evalErr: any) {
            console.error('❌ Alternative execution also failed:', evalErr);
            spawnError = evalErr;
          }
        }
      }
      
      if (spawnError || !testRun) {
        const errorMessage = app.isPackaged 
          ? `Unable to run test in production. Please ensure Node.js is installed on your system. Error: ${spawnError?.message}`
          : `Failed to start test process: ${spawnError?.message}`;
          
        event.sender.send('playwright-test-error', {
          error: errorMessage,
          testFile,
          userFriendly: true,
          details: {
            nodeExecutable,
            nodeVersion,
            isElectronNode,
            originalError: spawnError?.message
          }
        });
        
        throw new Error(errorMessage);
      }
      
      let errorOutput = '';
      let hasReceivedData = false;
      
      // Set up error handler
      testRun.on('error', (error) => {
        console.error('Failed to start Playwright test process:', error);
        errorOutput = error.message;
        
        // Provide user-friendly error messages
        let userMessage = 'Failed to run the test. ';
        
        if (error.message.includes('ENOENT')) {
          if (isElectronNode) {
            userMessage += 'The test runner is not properly configured for production use. Please install Node.js on your system.';
          } else {
            userMessage += 'Required files are missing. Please check your installation.';
          }
        } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          userMessage += 'Permission denied. The app may not have the necessary permissions to run tests.';
        } else if (error.message.includes('playwright')) {
          userMessage += 'Playwright is not properly installed or configured. Please check the app installation.';
        } else {
          userMessage += error.message;
        }
        
        // Send error to renderer immediately
        event.sender.send('playwright-test-error', {
          error: userMessage,
          testFile,
          userFriendly: true,
          technicalDetails: {
            originalError: error.message,
            nodeInfo: { nodeExecutable, nodeVersion, isElectronNode }
          }
        });
      });
      
      // Monitor if we receive any output
      if (testRun.stdout) {
        testRun.stdout.on('data', () => {
          hasReceivedData = true;
        });
      }
      
      if (testRun.stderr) {
        testRun.stderr.on('data', (data) => {
          hasReceivedData = true;
          const errorText = data.toString();
          errorOutput += errorText;
          
          // Check for common errors
          if (errorText.includes('Cannot find module')) {
            const missingModule = errorText.match(/Cannot find module '([^']+)'/)?.[1];
            event.sender.send('playwright-test-error', {
              error: `Missing required module: ${missingModule}. The app may need to be reinstalled.`,
              testFile,
              userFriendly: true
            });
          }
        });
      }
      
      testRun.on('close', (code) => {
        console.log(`Playwright test process exited with code ${code}`);
        
        // Clean up temp file
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.error('Cleanup error:', e);
        }
        
        // Determine error message based on exit code and output
        let errorMessage: string | undefined;
        
        if (code !== 0) {
          if (!hasReceivedData && code === 1) {
            errorMessage = 'Test failed to start. This often happens in production builds. Please ensure Node.js is installed on your system.';
          } else if (errorOutput) {
            // Parse error output for user-friendly messages
            if (errorOutput.includes('Cannot find module')) {
              errorMessage = 'Required test dependencies are missing. Please check your installation.';
            } else if (errorOutput.includes('chrome') || errorOutput.includes('chromium')) {
              errorMessage = 'Chrome browser not found. Please ensure Chrome is installed on your system.';
            } else {
              errorMessage = errorOutput;
            }
          } else {
            errorMessage = `Test failed with exit code ${code}`;
          }
        }
        
        // Send completion event with detailed error info
        event.sender.send('playwright-test-completed', {
          success: code === 0,
          testFile,
          exitCode: code,
          error: errorMessage,
          details: code !== 0 ? {
            nodeInfo: { nodeExecutable, nodeVersion, isElectronNode },
            hasOutput: hasReceivedData
          } : undefined
        });
      });
      
      return { 
        success: true,
        message: 'Playwright test started with timing.'
      };
    } catch (error: any) {
      console.error('Error running Playwright test:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to run Playwright test'
      };
    }
  });

  // Get list of saved Playwright tests
  ipcMain.handle('get-playwright-tests', async () => {
    try {
      const outputDir = getOutputDir();
      const files = fs.readdirSync(outputDir);
      const metadataStore = getChainMetadataStore();

      // All .spec.js files in the browser-recorder-tests folder are valid tests
      const tests = files
        .filter(file => file.endsWith('.spec.js'))
        .map(file => {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);
          const code = fs.readFileSync(filePath, 'utf8');

          // Check if this script is part of a chain
          const chain = metadataStore.getChainByScript(filePath);
          const scriptInChain = chain?.scripts.find(s => s.scriptPath === filePath);

          return {
            name: file,
            path: filePath,
            createdAt: stats.birthtime,
            size: stats.size,
            preview: code.substring(0, 200) + '...',
            // Chain metadata
            chainId: chain?.chainId || null,
            chainOrder: scriptInChain?.order || null,
            chainScripts: chain?.scripts || null
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Clean up any chains that reference deleted scripts
      const existingScriptPaths = new Set(tests.map(t => t.path));
      metadataStore.cleanupDeletedScripts(existingScriptPaths);

      return { success: true, tests };
    } catch (error: any) {
      console.error('Error getting Playwright tests:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get Playwright tests',
        tests: []
      };
    }
  });

  // Run a chain of tests sequentially
  ipcMain.handle('run-chain', async (event, { chainId }) => {
    try {
      console.log(`🔗 Running chain: ${chainId}`);

      const metadataStore = getChainMetadataStore();
      const chain = metadataStore.getChain(chainId);

      if (!chain) {
        throw new Error(`Chain not found: ${chainId}`);
      }

      console.log(`📋 Chain has ${chain.scripts.length} script(s)`);

      // Sort scripts by order
      const sortedScripts = [...chain.scripts].sort((a, b) => a.order - b.order);

      // Run each script sequentially
      for (const script of sortedScripts) {
        console.log(`🎬 Running step ${script.order}: ${script.scriptName}`);

        // Verify script exists
        if (!fs.existsSync(script.scriptPath)) {
          event.sender.send('playwright-test-error', {
            error: `Script not found: ${script.scriptPath}`,
            testFile: script.scriptPath,
            userFriendly: true
          });
          throw new Error(`Script not found: ${script.scriptPath}`);
        }

        // Run the script using the same logic as run-playwright-test
        // For now, we'll use Node.js require to execute the script
        const { chromium } = require('playwright-core');

        // Read the generated code
        let generatedCode = fs.readFileSync(script.scriptPath, 'utf8');

        // Extract test body (same logic as run-playwright-test)
        let testBody = '';
        let extensionPaths: string[] = [];
        let copyExtensionsToTempFn: Function | null = null;
        let copyNativeMessagingHostsFn: Function | null = null;

        if (generatedCode.includes('@playwright/test')) {
          const testMatch = generatedCode.match(/test\s*\([^)]+\)\s*\{([\s\S]+)\}\);?\s*$/m);
          if (testMatch && testMatch[1]) {
            testBody = testMatch[1].trim();
          }
        } else {
          // For standalone scripts, extract EXTENSION_PATHS constant
          const extensionPathsMatch = generatedCode.match(/const EXTENSION_PATHS\s*=\s*(\[[\s\S]*?\]);/);
          if (extensionPathsMatch && extensionPathsMatch[1]) {
            try {
              extensionPaths = JSON.parse(extensionPathsMatch[1]);
            } catch (e) {
              console.warn('Could not parse EXTENSION_PATHS:', e);
              extensionPaths = [];
            }
          }

          // Extract copyExtensionsToTemp function
          const copyExtMatch = generatedCode.match(/function copyExtensionsToTemp\([\s\S]*?\n\}/);
          if (copyExtMatch) {
            try {
              const fnCode = copyExtMatch[0];
              copyExtensionsToTempFn = new Function('fs', 'path', 'os', 'EXTENSION_PATHS', 'copyNativeMessagingHosts', 'console',
                `return (${fnCode.replace('function copyExtensionsToTemp', 'function')});`
              )(fs, path, os, extensionPaths, null, console);
            } catch (e) {
              console.warn('Could not extract copyExtensionsToTemp:', e);
            }
          }

          // Extract copyNativeMessagingHosts function
          const copyNativeMatch = generatedCode.match(/function copyNativeMessagingHosts\([\s\S]*?\n\}/);
          if (copyNativeMatch) {
            try {
              const fnCode = copyNativeMatch[0];
              copyNativeMessagingHostsFn = new Function('fs', 'path', 'os', 'console',
                `return (${fnCode.replace('function copyNativeMessagingHosts', 'function')});`
              )(fs, path, os, console);
            } catch (e) {
              console.warn('Could not extract copyNativeMessagingHosts:', e);
            }
          }

          // Update the copyExtensionsToTemp function to have access to copyNativeMessagingHosts
          if (copyExtensionsToTempFn && copyNativeMessagingHostsFn) {
            const copyExtMatch = generatedCode.match(/function copyExtensionsToTemp\([\s\S]*?\n\}/);
            if (copyExtMatch) {
              try {
                const fnCode = copyExtMatch[0];
                copyExtensionsToTempFn = new Function('fs', 'path', 'os', 'EXTENSION_PATHS', 'copyNativeMessagingHosts', 'console',
                  `return (${fnCode.replace('function copyExtensionsToTemp', 'function')});`
                )(fs, path, os, extensionPaths, copyNativeMessagingHostsFn, console);
              } catch (e) {
                console.warn('Could not re-extract copyExtensionsToTemp:', e);
              }
            }
          }

          // For standalone scripts, extract code from IIFE
          const iifeMatch = generatedCode.match(/\(async\s*\(\)\s*=>\s*\{([\s\S]+)\}\)\(\)\.catch/);
          if (iifeMatch && iifeMatch[1]) {
            testBody = iifeMatch[1].trim();
          }
        }

        if (!testBody) {
          throw new Error(`Could not extract test body from ${script.scriptName}`);
        }

        // Execute the test
        console.log(`⚙️ Executing step ${script.order}...`);

        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const testFunction = new AsyncFunction('chromium', 'require', 'console', 'path', 'os', 'fs', 'EXTENSION_PATHS', 'copyExtensionsToTemp', 'copyNativeMessagingHosts', testBody);
          await testFunction(chromium, require, console, path, os, fs, extensionPaths, copyExtensionsToTempFn, copyNativeMessagingHostsFn);

          console.log(`✅ Step ${script.order} completed: ${script.scriptName}`);

          // Send progress update to renderer
          event.sender.send('chain-progress', {
            chainId,
            currentStep: script.order,
            totalSteps: sortedScripts.length,
            scriptName: script.scriptName,
            status: 'completed'
          });

        } catch (stepError) {
          console.error(`❌ Step ${script.order} failed:`, stepError);

          event.sender.send('chain-progress', {
            chainId,
            currentStep: script.order,
            totalSteps: sortedScripts.length,
            scriptName: script.scriptName,
            status: 'failed',
            error: stepError.message
          });

          throw new Error(`Step ${script.order} (${script.scriptName}) failed: ${stepError.message}`);
        }
      }

      console.log(`✅ Chain completed successfully: ${chainId}`);

      return {
        success: true,
        message: `Chain completed: ${chain.scripts.length} step(s) executed`
      };

    } catch (error: any) {
      console.error('❌ Chain execution failed:', error);

      event.sender.send('playwright-test-error', {
        error: error?.message || 'Chain execution failed',
        userFriendly: true
      });

      return {
        success: false,
        error: error?.message || 'Chain execution failed'
      };
    }
  });

  // Delete a Playwright test
  ipcMain.handle('delete-playwright-test', async (event, { testPath }) => {
    try {
      console.log('🗑️ Deleting test:', testPath);

      // Delete the test file
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
        console.log('✅ Deleted test file');
      }

      // Delete the temporary run file if it exists
      const deleteDir = path.dirname(testPath);
      const deleteBasename = path.basename(testPath, '.spec.js');
      const runPath = path.join(deleteDir, `${deleteBasename}.run.js`);
      if (fs.existsSync(runPath)) {
        fs.unlinkSync(runPath);
        console.log('✅ Deleted run file');
      }

      // Delete the corresponding download folder if it exists
      const browserDownloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser');
      const downloadFolder = path.join(browserDownloadsPath, deleteBasename);

      if (fs.existsSync(downloadFolder)) {
        try {
          fs.rmSync(downloadFolder, { recursive: true, force: true });
          console.log('✅ Deleted download folder:', deleteBasename);
        } catch (folderErr) {
          console.warn('⚠️ Could not delete download folder:', folderErr);
          // Don't fail the whole operation if folder deletion fails
        }
      }

      return {
        success: true,
        message: 'Test deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting test:', error);
      return {
        success: false,
        error: error?.message || 'Failed to delete test'
      };
    }
  });

  // Rename a Playwright test
  ipcMain.handle('rename-playwright-test', async (event, { testPath, newName }) => {
    try {
      console.log('✏️ Renaming test:', testPath, 'to:', newName);

      if (!fs.existsSync(testPath)) {
        return {
          success: false,
          error: 'Test file not found'
        };
      }

      // Ensure the new name has .spec.js extension
      let sanitizedName = newName.trim();
      if (!sanitizedName.endsWith('.spec.js')) {
        if (sanitizedName.endsWith('.spec')) {
          sanitizedName += '.js';
        } else if (!sanitizedName.includes('.spec.')) {
          sanitizedName = sanitizedName.replace(/\.js$/, '') + '.spec.js';
        } else {
          sanitizedName += '.js';
        }
      }

      // Construct new file path
      const dir = path.dirname(testPath);
      const newPath = path.join(dir, sanitizedName);

      // Check if new file already exists
      if (fs.existsSync(newPath) && testPath !== newPath) {
        return {
          success: false,
          error: 'A file with this name already exists'
        };
      }

      // Rename the main test file
      fs.renameSync(testPath, newPath);
      console.log('✅ Renamed test file to:', newPath);

      // Rename the temporary run file if it exists
      const oldBasename = path.basename(testPath, '.spec.js');
      const newBasename = path.basename(newPath, '.spec.js');
      const oldRunPath = path.join(dir, `${oldBasename}.run.js`);
      const newRunPath = path.join(dir, `${newBasename}.run.js`);

      if (fs.existsSync(oldRunPath)) {
        fs.renameSync(oldRunPath, newRunPath);
        console.log('✅ Renamed run file');
      }

      // Rename the corresponding download folder if it exists
      const browserDownloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser');
      const oldDownloadFolder = path.join(browserDownloadsPath, oldBasename);
      const newDownloadFolder = path.join(browserDownloadsPath, newBasename);

      if (fs.existsSync(oldDownloadFolder)) {
        try {
          fs.renameSync(oldDownloadFolder, newDownloadFolder);
          console.log('✅ Renamed download folder:', oldBasename, '→', newBasename);
        } catch (folderErr) {
          console.warn('⚠️ Could not rename download folder:', folderErr);
          // Don't fail the whole operation if folder rename fails
        }
      }

      return {
        success: true,
        message: 'Test renamed successfully',
        newPath
      };
    } catch (error: any) {
      console.error('Error renaming test:', error);
      return {
        success: false,
        error: error?.message || 'Failed to rename test'
      };
    }
  });

  // View a Playwright test in the code viewer window
  ipcMain.handle('view-playwright-test', async (event, { testPath }) => {
    try {
      console.log('👁️ Viewing test:', testPath);

      // Read the test file
      if (!fs.existsSync(testPath)) {
        return {
          success: false,
          error: 'Test file not found'
        };
      }

      const testCode = fs.readFileSync(testPath, 'utf8');

      // Extract actions from the embedded JSON comment
      let actions: any[] = [];
      try {
        // Use greedy match to capture the entire JSON array on the line
        const actionsMatch = testCode.match(/\/\*\*[\s\S]*?RECORDED_ACTIONS:[\s\S]*?\* (.*)[\s\S]*?\*\//);
        if (actionsMatch && actionsMatch[1]) {
          const actionsJson = actionsMatch[1].trim();
          actions = JSON.parse(actionsJson);
          console.log('✅ Extracted', actions.length, 'actions from test file');
        } else {
          console.log('⚠️ No embedded actions found in test file (might be old format)');
        }
      } catch (parseError) {
        console.error('❌ Failed to parse embedded actions:', parseError);
        // Continue without actions - will show raw code instead
      }

      // Open the code viewer window in view mode
      await codeViewerWindow.create();

      // Update actions BEFORE setting view mode to avoid race condition
      if (actions.length > 0) {
        codeViewerWindow.updateActions(actions);
      }

      codeViewerWindow.setViewMode(testPath);
      codeViewerWindow.updateCode(testCode);

      // Set up delete-action for view mode
      codeViewerWindow.setDeleteActionCallback(async (index) => {
        console.log('🗑️ Delete action in view mode, index:', index);

        // Remove the action from the array
        actions.splice(index, 1);
        console.log('✅ Removed action, remaining actions:', actions.length);

        // Update the code viewer with the new actions list
        codeViewerWindow.updateActions(actions);

        // Regenerate the code with the updated actions
        const tempRecorder = new BrowserRecorder();
        tempRecorder.setActions(actions);

        // Set the script name for proper downloads path
        const scriptName = path.basename(testPath, '.spec.js');
        tempRecorder.setScriptName(scriptName);

        // Check if this test is part of a chain and restore chain info
        const metadataStore = getChainMetadataStore();
        const chain = metadataStore.getChainByScript(testPath);
        const scriptInChain = chain?.scripts.find(s => s.scriptPath === testPath);

        console.log('🔍 Chain check - testPath:', testPath);
        console.log('🔍 Chain check - chain exists:', !!chain);
        console.log('🔍 Chain check - scriptInChain:', scriptInChain);

        if (scriptInChain && scriptInChain.order > 1) {
          // This is a chained script - find the previous script's download
          const previousScript = chain?.scripts.find(s => s.order === scriptInChain.order - 1);

          console.log('🔍 Previous script:', previousScript);

          if (previousScript?.downloadedFile) {
            console.log('🔗 Restoring chain info: downloaded file =', previousScript.downloadedFile);

            // Reconstruct the download path
            const prevScriptName = path.basename(previousScript.scriptPath, '.spec.js');
            const downloadsDir = path.join(app.getPath('downloads'), 'EGDesk-Browser', prevScriptName);
            const downloadPath = path.join(downloadsDir, previousScript.downloadedFile);

            console.log('🔗 Reconstructed download path:', downloadPath);
            console.log('🔗 File exists:', fs.existsSync(downloadPath));

            // Set chain properties on the temporary recorder
            tempRecorder.setChainParameters(chain.chainId, downloadPath);
          } else {
            console.log('⚠️ Previous script has no downloadedFile');
          }
        } else {
          console.log('⚠️ Not a chained script or script order is 1');
        }

        const updatedCode = tempRecorder.generateTestCode();

        // Update the code viewer with the new code
        codeViewerWindow.updateCode(updatedCode);
      });

      // Set up play-to-action for view mode
      if (actions.length > 0) {
        codeViewerWindow.setPlayToActionCallback(async (index) => {
          console.log('▶️ Play to action in view mode, index:', index);

          try {
            // Create temporary recorder to generate and execute partial code
            const tempRecorder = new BrowserRecorder();
            tempRecorder.setActions(actions);

            // Set the script name for proper downloads path
            const scriptName = path.basename(testPath, '.spec.js');
            tempRecorder.setScriptName(scriptName);

            // Check if this test is part of a chain and restore chain info
            const metadataStore = getChainMetadataStore();
            const chain = metadataStore.getChainByScript(testPath);
            const scriptInChain = chain?.scripts.find(s => s.scriptPath === testPath);

            console.log('🔍 [Play] Chain check - testPath:', testPath);
            console.log('🔍 [Play] Chain check - chain exists:', !!chain);
            console.log('🔍 [Play] Chain check - scriptInChain:', scriptInChain);

            if (scriptInChain && scriptInChain.order > 1) {
              // This is a chained script - find the previous script's download
              const previousScript = chain?.scripts.find(s => s.order === scriptInChain.order - 1);

              console.log('🔍 [Play] Previous script:', previousScript);

              if (previousScript?.downloadedFile) {
                console.log('🔗 Restoring chain info for play-to-action: downloaded file =', previousScript.downloadedFile);

                // Reconstruct the download path
                const prevScriptName = path.basename(previousScript.scriptPath, '.spec.js');
                const downloadsDir = path.join(app.getPath('downloads'), 'EGDesk-Browser', prevScriptName);
                const downloadPath = path.join(downloadsDir, previousScript.downloadedFile);

                console.log('🔗 [Play] Reconstructed download path:', downloadPath);
                console.log('🔗 [Play] File exists:', fs.existsSync(downloadPath));

                // Set chain properties on the temporary recorder
                tempRecorder.setChainParameters(chain.chainId, downloadPath);
              } else {
                console.log('⚠️ [Play] Previous script has no downloadedFile');
              }
            } else {
              console.log('⚠️ [Play] Not a chained script or script order is 1');
            }

            // Generate partial test code
            const partialCode = tempRecorder.generateTestCodeUpToAction(index);

            // Save to temporary file
            const tempFile = path.join(os.tmpdir(), `playwright-partial-view-${Date.now()}.spec.js`);
            fs.writeFileSync(tempFile, partialCode);

            console.log(`🎬 Executing saved test up to action ${index}`);
            console.log(`📝 Temp file: ${tempFile}`);

            // Execute the partial test
            const { spawn } = require('child_process');
            const nodeProcess = spawn('node', [tempFile], {
              stdio: 'inherit',
              cwd: process.cwd()
            });

            nodeProcess.on('exit', (code) => {
              console.log(`✅ Partial execution completed with code: ${code === 0 ? 'Success' : 'Failed'}`);

              // Clean up temp file after a delay
              setTimeout(() => {
                try {
                  if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                    console.log('🧹 Cleaned up temp file');
                  }
                } catch (err) {
                  console.warn('Failed to clean up temp file:', err);
                }
              }, 5000);
            });

          } catch (error) {
            console.error('❌ Error executing partial test in view mode:', error);
          }
        });
      }

      return {
        success: true,
        message: 'Test opened in code viewer'
      };
    } catch (error: any) {
      console.error('Error viewing test:', error);
      return {
        success: false,
        error: error?.message || 'Failed to view test'
      };
    }
  });

  // Get list of downloaded files from EGDesk-Browser directory (scans all script subfolders)
  ipcMain.handle('get-playwright-downloads', async () => {
    try {
      const browserDownloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser');

      // Check if directory exists
      if (!fs.existsSync(browserDownloadsPath)) {
        return {
          success: true,
          files: []
        };
      }

      // Scan all script subfolders for downloaded files
      const fileList: any[] = [];
      const scriptFolders = fs.readdirSync(browserDownloadsPath, { withFileTypes: true });

      for (const folder of scriptFolders) {
        if (folder.isDirectory()) {
          const scriptFolderPath = path.join(browserDownloadsPath, folder.name);
          try {
            const files = fs.readdirSync(scriptFolderPath);

            for (const filename of files) {
              const filePath = path.join(scriptFolderPath, filename);
              const stats = fs.statSync(filePath);

              // Only include files, not directories
              if (stats.isFile()) {
                fileList.push({
                  name: filename,
                  path: filePath,
                  scriptFolder: folder.name,
                  size: stats.size,
                  created: stats.birthtime,
                  modified: stats.mtime
                });
              }
            }
          } catch (folderErr) {
            console.warn(`Could not read script folder ${folder.name}:`, folderErr);
          }
        }
      }

      // Sort by modified date (newest first)
      fileList.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return {
        success: true,
        files: fileList
      };
    } catch (error: any) {
      console.error('Error getting browser recorder downloads:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get downloads',
        files: []
      };
    }
  });

  // Open downloaded file in default application
  ipcMain.handle('open-playwright-download', async (event, filePath: string) => {
    try {
      const { shell } = require('electron');
      await shell.openPath(filePath);
      return { success: true };
    } catch (error: any) {
      console.error('Error opening file:', error);
      return {
        success: false,
        error: error?.message || 'Failed to open file'
      };
    }
  });

  // Open EGDesk-Browser folder in file viewer (Finder/Explorer)
  ipcMain.handle('open-playwright-downloads-folder', async () => {
    try {
      const { shell } = require('electron');
      const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser');

      // Create directory if it doesn't exist
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }

      await shell.openPath(downloadsPath);
      return { success: true };
    } catch (error: any) {
      console.error('Error opening folder:', error);
      return {
        success: false,
        error: error?.message || 'Failed to open folder'
      };
    }
  });

  // Get browser automation folders (script folders)
  ipcMain.handle('get-browser-download-folders', async () => {
    try {
      const browserDownloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser');

      // Check if directory exists
      if (!fs.existsSync(browserDownloadsPath)) {
        return {
          success: true,
          folders: []
        };
      }

      // Scan all script subfolders
      const folderList: any[] = [];
      const scriptFolders = fs.readdirSync(browserDownloadsPath, { withFileTypes: true });

      for (const folder of scriptFolders) {
        if (folder.isDirectory()) {
          const scriptFolderPath = path.join(browserDownloadsPath, folder.name);
          try {
            const files = fs.readdirSync(scriptFolderPath);
            const stats = fs.statSync(scriptFolderPath);
            
            // Count Excel files
            let excelFileCount = 0;
            let totalSize = 0;
            let latestModified = stats.mtime;

            for (const filename of files) {
              const filePath = path.join(scriptFolderPath, filename);
              try {
                const fileStats = fs.statSync(filePath);
                if (fileStats.isFile()) {
                  totalSize += fileStats.size;
                  if (fileStats.mtime > latestModified) {
                    latestModified = fileStats.mtime;
                  }
                  if (/\.(xlsx?|xlsm|xls)$/i.test(filename)) {
                    excelFileCount++;
                  }
                }
              } catch (fileErr) {
                // Skip files that can't be read
              }
            }

            // Parse script name from folder name
            // Folder format: "ScriptName-2026-01-26T06-35-19-003Z" or just "ScriptName"
            let scriptName = folder.name;
            
            // Try to extract human-readable name before timestamp
            const timestampMatch = folder.name.match(/^(.+?)-\d{4}-\d{2}-\d{2}T/);
            if (timestampMatch) {
              scriptName = timestampMatch[1];
            }
            
            // Convert kebab-case to Title Case
            scriptName = scriptName
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            // Only include folders that have at least one Excel file
            if (excelFileCount > 0) {
              folderList.push({
                scriptName: scriptName,
                folderName: folder.name,
                path: scriptFolderPath,
                fileCount: files.length,
                excelFileCount: excelFileCount,
                size: totalSize,
                lastModified: latestModified,
              });
            }
          } catch (folderErr) {
            console.warn(`Could not read script folder ${folder.name}:`, folderErr);
          }
        }
      }

      // Sort by last modified date (newest first)
      folderList.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      return {
        success: true,
        folders: folderList
      };
    } catch (error: any) {
      console.error('Error getting browser download folders:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get folders',
        folders: []
      };
    }
  });

  // Get files in a specific folder
  ipcMain.handle('get-folder-files', async (event, folderPath: string) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return {
          success: false,
          error: 'Folder not found',
          files: []
        };
      }

      const fileList: any[] = [];
      const files = fs.readdirSync(folderPath);

      for (const filename of files) {
        const filePath = path.join(folderPath, filename);
        try {
          const stats = fs.statSync(filePath);

          // Only include files, not directories
          if (stats.isFile()) {
            fileList.push({
              name: filename,
              path: filePath,
              scriptFolder: path.basename(folderPath),
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            });
          }
        } catch (fileErr) {
          console.warn(`Could not read file ${filename}:`, fileErr);
        }
      }

      // Sort by modified date (newest first)
      fileList.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return {
        success: true,
        files: fileList
      };
    } catch (error: any) {
      console.error('Error getting folder files:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get files',
        files: []
      };
    }
  });

  // Resume recording from a paused session
  ipcMain.handle('resume-recording-from-pause', async (event, { sessionId }) => {
    try {
      console.log('▶️ Resuming recording from session:', sessionId);

      const session = pausedSessions.get(sessionId);
      if (!session) {
        console.error('❌ Session not found:', sessionId);
        return { success: false, error: 'Session not found' };
      }

      if (!activeRecorder) {
        console.error('❌ No active recorder available');
        return { success: false, error: 'No active recorder' };
      }

      // Close any existing browser in the recorder
      try {
        await activeRecorder.stop();
      } catch (err) {
        console.log('Previous recorder stopped');
      }

      // Create new recorder instance
      const resumedRecorder = new BrowserRecorder();

      // Restore state
      resumedRecorder.setActions(session.actions); // Load existing actions
      resumedRecorder.setOutputFile(session.testPath);

      // Extract script name from test path
      const scriptName = path.basename(session.testPath, '.spec.js');
      resumedRecorder.setScriptName(scriptName);

      // Connect to existing browser context
      resumedRecorder.reconnectToContext(session.context, session.page);

      // Start recording from this point
      await resumedRecorder.startRecording();

      // Set up update callback
      resumedRecorder.setUpdateCallback((code) => {
        console.log('🔔 Update callback triggered (resumed), code length:', code.length);

        // Update code viewer window
        codeViewerWindow.updateCode(code);
        codeViewerWindow.updateActions(resumedRecorder.getActions());

        // Send update to renderer
        event.sender.send('playwright-test-update', {
          filePath: session.testPath,
          code: code,
          timestamp: new Date().toISOString()
        });
      });

      // Set up wait settings callback
      codeViewerWindow.setWaitSettingsCallback((settings) => {
        console.log('⏱️ Wait settings changed (resumed), updating recorder:', settings);
        resumedRecorder.setWaitSettings(settings);
      });

      // Set up delete action callback
      codeViewerWindow.setDeleteActionCallback((index) => {
        console.log('🗑️ Delete action callback triggered (resumed) for index:', index);
        resumedRecorder.deleteAction(index);
      });

      // Update activeRecorder
      activeRecorder = resumedRecorder;

      // Remove session from paused list
      pausedSessions.delete(sessionId);

      console.log('✅ Recording resumed successfully');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Error resuming recording:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Chrome Extension Management IPC Handlers
  // ============================================

  /**
   * Scan all Chrome profiles and their extensions
   */
  ipcMain.handle('chrome-extensions:scan-profiles', async () => {
    try {
      console.log('[Chrome Extensions] Scanning Chrome profiles for extensions...');
      const profiles = ChromeExtensionScanner.getAllProfiles();

      // Convert icon paths to data URLs for frontend display
      const profilesWithIcons = profiles.map(profile => ({
        ...profile,
        extensions: profile.extensions.map(ext => ({
          ...ext,
          iconDataUrl: ext.iconPath
            ? ChromeExtensionScanner.getExtensionIconDataUrl(ext.iconPath)
            : null
        }))
      }));

      console.log(`[Chrome Extensions] Found ${profiles.length} profiles with ${profiles.reduce((sum, p) => sum + p.extensions.length, 0)} total extensions`);

      return {
        success: true,
        profiles: profilesWithIcons
      };
    } catch (error) {
      console.error('[Chrome Extensions] Error scanning Chrome extensions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        profiles: []
      };
    }
  });

  /**
   * Get Chrome user data directory path
   */
  ipcMain.handle('chrome-extensions:get-user-data-dir', async () => {
    try {
      const dir = ChromeExtensionScanner.getChromeUserDataDir();
      return { success: !!dir, path: dir };
    } catch (error) {
      console.error('[Chrome Extensions] Error getting Chrome user data dir:', error);
      return { success: false, path: null };
    }
  });

  /**
   * Save selected extensions for future use
   */
  ipcMain.handle('chrome-extensions:save-preferences', async (event, selectedExtensions: string[]) => {
    try {
      const store = getStore();

      store.set('browser-recorder.selected-extensions', selectedExtensions);
      console.log(`[Chrome Extensions] Saved ${selectedExtensions.length} extension preferences`);

      return { success: true };
    } catch (error) {
      console.error('[Chrome Extensions] Error saving extension preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  /**
   * Get saved extension preferences
   */
  ipcMain.handle('chrome-extensions:get-preferences', async () => {
    try {
      const store = getStore();

      const selectedExtensions = store.get('browser-recorder.selected-extensions', []) as string[];
      console.log(`[Chrome Extensions] Retrieved ${selectedExtensions.length} saved extension preferences`);

      return {
        success: true,
        selectedExtensions
      };
    } catch (error) {
      console.error('[Chrome Extensions] Error getting extension preferences:', error);
      return {
        success: false,
        selectedExtensions: []
      };
    }
  });

  console.log('✅ Chrome browser automation IPC handlers registered');
}

