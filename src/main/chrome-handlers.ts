// IPC handlers for Chrome browser automation and Lighthouse reports
import { ipcMain, app, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { PlaywrightRecorder } from './playwright-recorder';
import { codeViewerWindow } from './code-viewer-window';

/**
 * Get output directory path - uses userData in production, cwd in development
 */
function getOutputDir(): string {
  const outputDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'output')
    : path.join(process.cwd(), 'output');
  
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
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
          const { generateTextWithAI } = require('../gemini');

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
  let activeRecorder: PlaywrightRecorder | null = null;
  
  ipcMain.handle('launch-playwright-recorder-enhanced', async (event, { url }) => {
    try {
      console.log('🎭 Launching enhanced Playwright recorder for URL:', url);
      
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
      const outputFile = path.join(getOutputDir(), `playwright-test-${timestamp}.spec.js`);
      
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
      activeRecorder = new PlaywrightRecorder();
      activeRecorder.setOutputFile(outputFile);
      
      // Set up real-time updates
      activeRecorder.setUpdateCallback((code) => {
        console.log('🔔 Update callback triggered, code length:', code.length);

        // Update code viewer window
        codeViewerWindow.updateCode(code);

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
      
      try {
        await activeRecorder.start(url, async () => {
        // Browser was closed by user - auto-stop recording
        console.log('🔌 Browser closed - stopping recording automatically');
        
        // Stop the recorder
        if (activeRecorder) {
          const testCode = await activeRecorder.stop();
          const recordedActions = activeRecorder.getActions();
          activeRecorder = null;
          
          // Create timed version
          const timedCode = createTimedTestFromCode(testCode);
          const timedFile = outputFile.replace('.spec.js', '.timed.spec.js');
          fs.writeFileSync(timedFile, timedCode);
          
          // Close the code viewer window
          codeViewerWindow.close();
          
          // Notify renderer
          event.sender.send('playwright-test-saved', {
            filePath: outputFile,
            code: testCode,
            timestamp: new Date().toISOString()
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
  
  ipcMain.handle('stop-playwright-recorder-enhanced', async (event) => {
    try {
      if (!activeRecorder) {
        return {
          success: false,
          error: 'No active recorder'
        };
      }
      
      const testCode = await activeRecorder.stop();
      const recordedActions = activeRecorder.getActions();
      activeRecorder = null;
      
      // The test file has already been created and updated in real-time
      // Just create the timed version
      const outputFiles = fs.readdirSync(getOutputDir())
        .filter(f => f.startsWith('playwright-test-') && f.endsWith('.spec.js'))
        .map(f => path.join(getOutputDir(), f))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());
      
      if (outputFiles.length > 0) {
        const outputFile = outputFiles[0]; // Most recent file
        const timedCode = createTimedTestFromCode(testCode);
        const timedFile = outputFile.replace('.spec.js', '.timed.spec.js');
        fs.writeFileSync(timedFile, timedCode);
        
        console.log(`✅ Enhanced test saved to: ${outputFile}`);
        
        // Close the code viewer window
        codeViewerWindow.close();
        
        // Notify renderer
        event.sender.send('playwright-test-saved', {
          filePath: outputFile,
          code: testCode,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          filePath: outputFile,
          code: testCode
        };
      } else {
        return {
          success: false,
          error: 'No test file found'
        };
      }
    } catch (error: any) {
      console.error('Error stopping recorder:', error);
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
        
        // Check if there's a timed version
        const dir = path.dirname(testFile);
        const basename = path.basename(testFile, '.spec.js');
        const timedFile = path.join(dir, `${basename}.timed.spec.js`);
        let fileToRun = testFile;
        
        // Create timed version on-the-fly if it doesn't exist
        if (!fs.existsSync(timedFile)) {
          console.log('🔧 Creating timed version on-the-fly...');
          const originalCode = fs.readFileSync(testFile, 'utf8');
          const timedCode = createTimedTestFromCode(originalCode);
          fs.writeFileSync(timedFile, timedCode);
          console.log(`✅ Timed test created: ${timedFile}`);
        }
        
        // Always use the timed version
        fileToRun = timedFile;
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
          const tryMatch = generatedCode.match(/try\s*\{([\s\S]+?)\}\s*finally\s*\{/);

          if (tryMatch && tryMatch[1]) {
            testBody = tryMatch[1].trim();
            console.log('✅ Extracted test body from try block');
          } else {
            // Fallback: try to find actions after page setup
            const lines = generatedCode.split('\n');
            const tryIndex = lines.findIndex(line => line.trim() === 'try {');
            const finallyIndex = lines.findIndex(line => line.includes('} finally {'));

            if (tryIndex !== -1 && finallyIndex !== -1 && tryIndex < finallyIndex) {
              testBody = lines.slice(tryIndex + 1, finallyIndex).join('\n').trim();
              console.log('✅ Extracted test body using line-by-line fallback');
            }
          }
        }

        if (!testBody) {
          console.error('❌ Failed to extract test body. File content preview:', generatedCode.substring(0, 500));
          throw new Error('Could not extract test body from file. Check console for file preview.');
        }

        console.log('📋 Test body extracted, length:', testBody.length);
        
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
          const testFunction = new AsyncFunction('page', 'expect', testBody);

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

          await testFunction(page, expect);

          console.log('✅ Test completed successfully');

          // Send success event
          event.sender.send('playwright-test-completed', {
            success: true,
            testFile,
            exitCode: 0
          });

        } catch (error: any) {
          console.error('❌ Test failed:', error);

          // Send failure event
          event.sender.send('playwright-test-completed', {
            success: false,
            testFile,
            exitCode: 1,
            error: error?.message || 'Test execution failed'
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
      
      // Check if there's a timed version
      const dir = path.dirname(testFile);
      const basename = path.basename(testFile, '.spec.js');
      const timedFile = path.join(dir, `${basename}.timed.spec.js`);
      let fileToRun = testFile;
      
      // Create timed version on-the-fly if it doesn't exist
      if (!fs.existsSync(timedFile)) {
        console.log('🔧 Creating timed version on-the-fly...');
        const originalCode = fs.readFileSync(testFile, 'utf8');
        const timedCode = createTimedTestFromCode(originalCode);
        fs.writeFileSync(timedFile, timedCode);
        console.log(`✅ Timed test created: ${timedFile}`);
      }
      
      // Always use the timed version
      fileToRun = timedFile;
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
      
      const tests = files
        .filter(file => file.startsWith('playwright-test-') && file.endsWith('.spec.js'))
        .map(file => {
          const filePath = path.join(outputDir, file);
          const stats = fs.statSync(filePath);
          const code = fs.readFileSync(filePath, 'utf8');
          
          return {
            name: file,
            path: filePath,
            createdAt: stats.birthtime,
            size: stats.size,
            preview: code.substring(0, 200) + '...'
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
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
  
  // Delete a Playwright test
  ipcMain.handle('delete-playwright-test', async (event, { testPath }) => {
    try {
      console.log('🗑️ Deleting test:', testPath);
      
      // Delete the main test file
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
        console.log('✅ Deleted main test file');
      }
      
      // Delete the timed version if it exists
      const deleteDir = path.dirname(testPath);
      const deleteBasename = path.basename(testPath, '.spec.js');
      const timedPath = path.join(deleteDir, `${deleteBasename}.timed.spec.js`);
      if (fs.existsSync(timedPath)) {
        fs.unlinkSync(timedPath);
        console.log('✅ Deleted timed test file');
      }
      
      // Delete the run file if it exists
      const runPath = path.join(deleteDir, `${deleteBasename}.run.js`);
      if (fs.existsSync(runPath)) {
        fs.unlinkSync(runPath);
        console.log('✅ Deleted run file');
      }
      
      // Delete the mjs file if it exists (from earlier attempts)
      const mjsPath = path.join(deleteDir, `${deleteBasename}.run.mjs`);
      if (fs.existsSync(mjsPath)) {
        fs.unlinkSync(mjsPath);
        console.log('✅ Deleted mjs file');
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

      // Open the code viewer window in view mode
      await codeViewerWindow.create();
      codeViewerWindow.setViewMode(testPath);
      codeViewerWindow.updateCode(testCode);

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

  // Get list of downloaded files from EGDesk-Playwright directory
  ipcMain.handle('get-playwright-downloads', async () => {
    try {
      const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');

      // Check if directory exists
      if (!fs.existsSync(downloadsPath)) {
        return {
          success: true,
          files: []
        };
      }

      // Read directory and get file stats
      const files = fs.readdirSync(downloadsPath);
      const fileList = files.map(filename => {
        const filePath = path.join(downloadsPath, filename);
        const stats = fs.statSync(filePath);

        return {
          name: filename,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

      // Sort by modified date (newest first)
      fileList.sort((a, b) => b.modified.getTime() - a.modified.getTime());

      return {
        success: true,
        files: fileList
      };
    } catch (error: any) {
      console.error('Error getting playwright downloads:', error);
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

  // Open EGDesk-Playwright folder in file viewer (Finder/Explorer)
  ipcMain.handle('open-playwright-downloads-folder', async () => {
    try {
      const { shell } = require('electron');
      const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');

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

  console.log('✅ Chrome browser automation IPC handlers registered');
}

