// IPC handlers for Chrome browser automation and Lighthouse reports
import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';

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
              const htmlReportPath = `file://${path.join(outputDir, `${reportName}.html`)}`;
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
        await pdfPage.goto(`file://${finalReportPath}`);
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

  // Launch Playwright Codegen
  ipcMain.handle('launch-playwright-codegen', async (event, { url }) => {
    try {
      const { spawn } = require('child_process');
      
      console.log('🎭 Launching Playwright Codegen for URL:', url);
      
      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(getOutputDir(), `playwright-test-${timestamp}.spec.js`);
      
      // Launch codegen with system Chrome browser and save to file
      const codegen = spawn('npx', [
        'playwright', 
        'codegen',
        '--browser=chromium',
        '--channel=chrome', // Use system Chrome installation
        '--output', outputFile, // Save generated code to file
        url
      ], {
        stdio: 'inherit',
        shell: true
      });
      
      codegen.on('error', (error) => {
        console.error('Failed to launch Playwright Codegen:', error);
      });
      
      codegen.on('close', (code) => {
        console.log(`Playwright Codegen process exited with code ${code}`);
        
        // Check if output file was created
        if (fs.existsSync(outputFile)) {
          console.log(`✅ Test code saved to: ${outputFile}`);
          
          // Read the generated code
          const generatedCode = fs.readFileSync(outputFile, 'utf8');
          
          // Notify renderer about the saved test
          event.sender.send('playwright-test-saved', {
            filePath: outputFile,
            code: generatedCode,
            timestamp
          });
        }
      });
      
      return { 
        success: true,
        message: 'Playwright Codegen launched successfully. The generated test will be saved when you close the inspector.',
        outputFile
      };
    } catch (error: any) {
      console.error('Error launching Playwright Codegen:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to launch Playwright Codegen'
      };
    }
  });

  // Run saved Playwright test
  ipcMain.handle('run-playwright-test', async (event, { testFile }) => {
    try {
      const { spawn } = require('child_process');
      
      console.log('🎭 Running Playwright test:', testFile);
      
      // Read the generated code
      let generatedCode = fs.readFileSync(testFile, 'utf8');
      
      console.log('Original code first few lines:', generatedCode.substring(0, 200));
      
      // Convert the test code to a runnable script
      if (generatedCode.includes('@playwright/test')) {
        // It's a test format, convert it to a standalone script
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
    // Extract test steps from the generated code
    ${generatedCode
      .split('\n')
      .filter(line => line.includes('await page.'))
      .join('\n    ')}
    
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
      const tempFile = testFile.replace('.spec.js', '.run.js');
      fs.writeFileSync(tempFile, generatedCode);
      
      // Run the script directly with Node
      const testRun = spawn('node', [tempFile], {
        stdio: 'inherit',
        shell: true
      });
      
      testRun.on('error', (error) => {
        console.error('Failed to run Playwright test:', error);
      });
      
      testRun.on('close', (code) => {
        console.log(`Playwright test process exited with code ${code}`);
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        event.sender.send('playwright-test-completed', {
          success: code === 0,
          testFile
        });
      });
      
      return { 
        success: true,
        message: 'Playwright test started.'
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

  console.log('✅ Chrome browser automation IPC handlers registered');
}

