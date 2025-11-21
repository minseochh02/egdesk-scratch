// const installExtensions = async () => {
//     const installer = require('electron-devtools-installer');
//     const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
//     const extensions = ['REACT_DEVELOPER_TOOLS'];
  
//     return installer
//       .default(
//         extensions.map((name) => installer[name]),
//         forceDownload,
//       )
//       .catch(console.log);
//   };
  
  
//   const createWindow = async () => {
//     // Initialize Electron Store first
//     try {
//       await initializeStore();
//       const store = getStore();
//       console.log('✅ Electron Store initialized successfully');
      
//       // Migration: Fix port 8081 -> 8080 for connections
//       try {
//         const config = store.get('mcpConfiguration');
//         let updated = false;
//         if (config && config.connections) {
//           config.connections.forEach((conn: any) => {
//             if (conn.accessLevel && conn.accessLevel.port === 8081) {
//               console.log(`🔧 Migrating connection "${conn.name}" port from 8081 to 8080`);
//               conn.accessLevel.port = 8080;
//               updated = true;
//             }
//           });
//           if (updated) {
//             store.set('mcpConfiguration', config);
//             console.log('✅ Port migration completed');
//           }
//         }
//       } catch (migrationError) {
//         console.warn('⚠️ Port migration warning:', migrationError);
//       }
  
//       // Migration: Move standalone mcpServerName to mcpConfiguration.serverName
//       try {
//         if (store.has('mcpServerName')) {
//           const oldServerName = store.get('mcpServerName') as string;
//           const config = store.get('mcpConfiguration');
          
//           // Only migrate if the new location is empty
//           if (oldServerName && !config.serverName) {
//             console.log(`🔧 Migrating MCP server name: ${oldServerName}`);
//             config.serverName = oldServerName;
//             store.set('mcpConfiguration', config);
//             store.delete('mcpServerName');
//             console.log('✅ MCP server name migration completed');
//           } else if (oldServerName && config.serverName) {
//             // Both exist, just delete the old one
//             console.log('🔧 Cleaning up old mcpServerName key');
//             store.delete('mcpServerName');
//           }
//         }
//       } catch (migrationError) {
//         console.warn('⚠️ MCP server name migration warning:', migrationError);
//       }
  
//       try {
//         ipcMain.handle('start-automation', async (_event, creds?: { id?: string; pw?: string; proxy?: string; title?: string; content?: string; tags?: string }) => {
//           const { runAutomation } = require('./automator');
//           return await runAutomation(creds?.id, creds?.pw, creds?.proxy, creds?.title, creds?.content, creds?.tags);
//         });
//         ipcMain.handle('start-woori-automation', async (_event, opts?: { id?: string; password?: string; proxy?: string }) => {
//           const { runShinhanAutomation } = require('./bank-automator');
//           // Note: ROBOFLOW_API_KEY should be set in environment variables
//           return await runShinhanAutomation(undefined, opts?.password, opts?.id, opts?.proxy);
//         });
//         ipcMain.handle('start-naver-blog-with-image', async (_event, opts?: { id?: string; password?: string; proxy?: string; title?: string; content?: string; tags?: string; includeDogImage?: boolean; dogImagePrompt?: string }) => {
//           try {
//             // Get the "egdesk" API key from store
//             const { getStore } = require('./storage');
//             const store = getStore();
//             const aiKeys = store.get('ai-keys', []);
//             const egdeskKey = aiKeys.find((key: any) => key.name === 'egdesk' && key.providerId === 'google' && key.fields?.apiKey);
            
//             if (!egdeskKey) {
//               throw new Error('No "egdesk" API key found. Please configure a Google/Gemini API key with the name "egdesk" in the AI Keys Manager.');
//             }
  
//             // Set the API key as environment variable
//             process.env.GEMINI_API_KEY = egdeskKey.fields.apiKey;
//             console.log(`🔑 Using "egdesk" API key for Naver Blog automation`);
  
//             const { runNaverBlogAutomation } = require('./naver/browser-controller');
//             return await runNaverBlogAutomation(
//               {
//                 username: opts?.id || '',
//                 password: opts?.password || '',
//                 proxyUrl: opts?.proxy
//               },
//               {
//                 title: opts?.title || 'Test Title',
//                 content: opts?.content || 'Test Content',
//                 tags: opts?.tags || '#test'
//               }
//             );
//           } catch (error) {
//             console.error('❌ Naver Blog automation failed:', error);
//             return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
//           }
//         });
//         ipcMain.handle('launch-chrome', async () => {
//           try {
//             const { chromium } = require('playwright');
//             const browser = await chromium.launch({ 
//               headless: false,
//               channel: 'chrome'
//             });
//             const context = await browser.newContext();
//             const page = await context.newPage();
//             await page.goto('https://blog.naver.com/GoBlogWrite.naver');
//             console.log('🌐 Chrome launched and navigated to Naver Blog write page');
//             return { success: true };
//           } catch (error) {
//             console.error('❌ Chrome launch failed:', error);
//             return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
//           }
//         });
//         ipcMain.handle('crawl-website', async (event, { url, proxy, openDevTools }) => {
//           try {
//             const { chromium } = require('playwright');
//             const fs = require('fs');
//             const path = require('path');
            
//             console.log('🕷️ Starting website crawler...');
            
//             // Build proxy configuration if provided
//             const proxyConfig = proxy ? { server: proxy } : undefined;
            
//             // Launch browser
//             const browser = await chromium.launch({ 
//               headless: false,
//               channel: 'chrome',
//               proxy: proxyConfig
//             });
            
//             const context = await browser.newContext({
//               userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
//             });
            
//             const page = await context.newPage();
            
//             // Enable DevTools if requested
//             if (openDevTools) {
//               await page.pause();
//             }
            
//             console.log(`🌐 Navigating to: ${url}`);
//             await page.goto(url, { waitUntil: 'networkidle' });
            
//             // Wait a bit for dynamic content to load
//             await page.waitForTimeout(2000);
            
//             // Extract all links
//             const links = await page.evaluate(() => {
//               const linkElements = document.querySelectorAll('a[href]');
//               const links = Array.from(linkElements).map(link => ({
//                 href: link.getAttribute('href'),
//                 text: link.textContent?.trim() || '',
//                 title: link.getAttribute('title') || '',
//                 target: link.getAttribute('target') || ''
//               }));
//               return links;
//             });
            
//             // Extract forms
//             const forms = await page.evaluate(() => {
//               const formElements = document.querySelectorAll('form');
//               return Array.from(formElements).map(form => ({
//                 action: form.getAttribute('action') || '',
//                 method: form.getAttribute('method') || 'GET',
//                 id: form.getAttribute('id') || '',
//                 className: form.getAttribute('class') || ''
//               }));
//             });
            
//             // Extract images
//             const images = await page.evaluate(() => {
//               const imgElements = document.querySelectorAll('img[src]');
//               return Array.from(imgElements).map(img => ({
//                 src: img.getAttribute('src'),
//                 alt: img.getAttribute('alt') || '',
//                 title: img.getAttribute('title') || '',
//                 width: img.getAttribute('width') || '',
//                 height: img.getAttribute('height') || ''
//               }));
//             });
            
//             // Categorize links
//             const baseUrl = new URL(url);
//             const internalLinks: any[] = [];
//             const externalLinks: any[] = [];
//             const relativeLinks: any[] = [];
            
//             links.forEach((link: any) => {
//               if (!link.href) return;
              
//               try {
//                 if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
//                   const linkUrl = new URL(link.href);
//                   if (linkUrl.hostname === baseUrl.hostname) {
//                     internalLinks.push(link);
//                   } else {
//                     externalLinks.push(link);
//                   }
//                 } else if (link.href.startsWith('/') || link.href.startsWith('./') || link.href.startsWith('../')) {
//                   relativeLinks.push(link);
//                 } else if (link.href.startsWith('#')) {
//                   // Skip anchor links
//                 } else {
//                   // Other relative links
//                   relativeLinks.push(link);
//                 }
//               } catch (e) {
//                 // Invalid URL, skip
//                 console.warn('Invalid URL:', link.href);
//               }
//             });
            
//             // Calculate statistics
//             const stats = {
//               totalLinks: links.length,
//               internalLinks: internalLinks.length,
//               externalLinks: externalLinks.length,
//               relativeLinks: relativeLinks.length,
//               forms: forms.length,
//               images: images.length
//             };
            
//             // Create output directory if it doesn't exist
//             const outputDir = path.join(process.cwd(), 'output');
//             if (!fs.existsSync(outputDir)) {
//               fs.mkdirSync(outputDir, { recursive: true });
//             }
            
//             // Save results to file
//             const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//             const results = {
//               url,
//               timestamp: new Date().toISOString(),
//               stats,
//               links: {
//                 all: links,
//                 internal: internalLinks,
//                 external: externalLinks,
//                 relative: relativeLinks
//               },
//               forms,
//               images
//             };
            
//             const filename = `crawler-results-${timestamp}.json`;
//             const filepath = path.join(outputDir, filename);
//             fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
            
//             console.log(`📊 Crawler completed: ${stats.totalLinks} links found`);
//             console.log(`💾 Results saved to: ${filepath}`);
            
//             await browser.close();
            
//             return {
//               success: true,
//               data: results,
//               filepath
//             };
            
//           } catch (error) {
//             console.error('❌ Crawler failed:', error);
//             return { 
//               success: false, 
//               error: error instanceof Error ? error.message : 'Unknown error' 
//             };
//           }
//         });
  
//         ipcMain.handle('web-fetch-content', async (_event, url: string) => {
//           try {
//             return await fetchWebsiteContent(url);
//           } catch (error) {
//             console.error('❌ Failed to fetch website content:', error);
//             return {
//               success: false,
//               error:
//                 error instanceof Error
//                   ? error.message || 'Failed to fetch website content.'
//                   : 'Failed to fetch website content.',
//             };
//           }
//         });
        
//         ipcMain.handle('launch-chrome-with-url', async (event, { url, proxy, openDevTools, runLighthouse }) => {
//           try {
//             const { chromium } = require('playwright');
            
//             // Build proxy option if provided
//             let proxyOption;
//             if (proxy) {
//               try {
//                 const proxyUrl = new URL(proxy);
//                 proxyOption = {
//                   server: `${proxyUrl.protocol}//${proxyUrl.host}`,
//                   username: proxyUrl.username || undefined,
//                   password: proxyUrl.password || undefined,
//                 };
//               } catch {
//                 console.warn('Invalid proxy URL, ignoring proxy option');
//               }
//             }
            
//             // Get a random port for remote debugging
//             const debugPort = Math.floor(Math.random() * 10000) + 9000;
            
//             const browser = await chromium.launch({ 
//               headless: false,
//               channel: 'chrome',
//               proxy: proxyOption,
//               args: [
//                 `--remote-debugging-port=${debugPort}`,
//                 '--lang=ko', // Set browser language
//                 ...(openDevTools ? ['--auto-open-devtools-for-tabs'] : []),
//                 ...(runLighthouse ? [
//                   '--enable-features=Lighthouse',
//                   '--disable-web-security',
//                   '--disable-features=VizDisplayCompositor'
//                 ] : [])
//               ]
//             });
//             const context = await browser.newContext({
//               locale: 'ko-KR', // Set context locale
//             });
//             const page = await context.newPage();
            
//             // Validate URL before navigating
//             try {
//               new URL(url);
//               await page.goto(url, { waitUntil: 'networkidle' });
//               console.log(`🌐 Chrome launched and navigated to: ${url}`);
              
//               // Run Lighthouse if requested
//               if (runLighthouse) {
//                 try {
//                   console.log('🔍 [DEBUG] Starting Lighthouse audit process...');
//                   console.log('🔍 [DEBUG] Current page URL:', await page.url());
//                   console.log('🔍 [DEBUG] Debug port:', debugPort);
                  
//                   // Wait for page to be fully loaded
//                   console.log('🔍 [DEBUG] Waiting for page to load completely...');
//                   await page.waitForLoadState('networkidle');
//                   await page.waitForTimeout(2000);
                  
//                   // Use playwright-lighthouse for proper integration
//                   console.log('🔍 [DEBUG] Using playwright-lighthouse...');
                  
//                   const { playAudit } = require('playwright-lighthouse');
                  
//                   const reportName = `lighthouse-report-${Date.now()}`;
                  
//                   await playAudit({
//                     page: page,
//                     port: debugPort,
//                     // Set Lighthouse report locale to Korean
//                     opts: {
//                       locale: 'ko',
//                     },
//                     thresholds: {
//                       performance: 50,
//                       accessibility: 50,
//                       'best-practices': 50,
//                       seo: 50,
//                       pwa: 50,
//                     },
//                     reports: {
//                       formats: {
//                         html: true,
//                         json: true,
//                       },
//                       name: reportName,
//                       directory: './output/',
//                     },
//                   });
                  
//                   console.log('🔍 [DEBUG] Lighthouse audit completed successfully');
//                   console.log('🔍 [DEBUG] Reports saved to ./output/ directory');
                  
//                   // Generate PDF with all sections expanded
//                   try {
//                     console.log('📄 [DEBUG] Generating PDF with expanded sections...');
                    
//                     // Load the generated HTML report
//                     const htmlReportPath = `file://${path.join(process.cwd(), 'output', `${reportName}.html`)}`;
//                     const pdfPage = await context.newPage();
                    
//                     await pdfPage.goto(htmlReportPath);
                    
//                     // Wait for the page to load completely
//                     await pdfPage.waitForLoadState('networkidle');
//                     await pdfPage.waitForTimeout(2000);
                    
//                     // Expand all collapsible sections
//                     await pdfPage.evaluate(() => {
//                       // Expand all <details> elements
//                       document.querySelectorAll('details').forEach(detail => {
//                         detail.open = true;
//                       });
                      
//                       // Expand any other collapsible elements (common Lighthouse patterns)
//                       document.querySelectorAll('[aria-expanded="false"]').forEach(element => {
//                         element.setAttribute('aria-expanded', 'true');
//                       });
                      
//                       // Remove any collapsed classes
//                       document.querySelectorAll('.lh-collapsed, .collapsed').forEach(element => {
//                         element.classList.remove('lh-collapsed', 'collapsed');
//                       });
                      
//                       // Show any hidden content
//                       document.querySelectorAll('[style*="display: none"]').forEach(element => {
//                         (element as HTMLElement).style.display = '';
//                       });
//                     });
                    
//                     // Wait a bit for any animations to complete
//                     await pdfPage.waitForTimeout(1000);
                    
//                     // Generate PDF
//                     const pdfPath = path.join(process.cwd(), 'output', `${reportName}.pdf`);
//                     await pdfPage.pdf({
//                       path: pdfPath,
//                       format: 'A4',
//                       printBackground: true,
//                       margin: {
//                         top: '20px',
//                         right: '20px',
//                         bottom: '20px',
//                         left: '20px'
//                       }
//                     });
                    
//                     console.log('📄 [DEBUG] PDF generated successfully:', pdfPath);
                    
//                     await pdfPage.close();
                    
//                   } catch (pdfError: any) {
//                     console.error('❌ [DEBUG] PDF generation failed:', pdfError);
//                     console.error('❌ [DEBUG] PDF Error details:', {
//                       message: pdfError?.message || 'Unknown error',
//                       stack: pdfError?.stack || 'No stack trace'
//                     });
//                   }
                  
//                 } catch (lighthouseError: any) {
//                   console.error('❌ [DEBUG] Lighthouse audit failed:', lighthouseError);
//                   console.error('❌ [DEBUG] Error details:', {
//                     message: lighthouseError?.message || 'Unknown error',
//                     stack: lighthouseError?.stack || 'No stack trace',
//                     name: lighthouseError?.name || 'Unknown error type'
//                   });
                  
//                   // Provide fallback instructions
//                   console.log('🔍 [DEBUG] Manual Lighthouse access:');
//                   console.log('🔍 [DEBUG] 1. Open Chrome DevTools (F12)');
//                   console.log('🔍 [DEBUG] 2. Click on the "Lighthouse" tab');
//                   console.log('🔍 [DEBUG] 3. Or navigate to: chrome://lighthouse/');
//                   console.log('🔍 [DEBUG] 4. Enter the URL: ' + await page.url());
//                 }
//               }
              
//               return { success: true };
//             } catch (urlError) {
//               console.error('❌ Invalid URL provided:', urlError);
//               return { success: false, error: 'Invalid URL provided' };
//             }
//           } catch (error) {
//             console.error('❌ Chrome launch failed:', error);
//             return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
//           }
//         });
//         ipcMain.handle('generate-lighthouse-reports', async (event, { urls, proxy }) => {
//           try {
//             const { chromium } = require('playwright');
//             const { playAudit } = require('playwright-lighthouse');
//             const fs = require('fs');
//             const path = require('path');
            
//             console.log(`🔍 Starting batch Lighthouse generation for ${urls.length} URLs...`);
            
//             // Build proxy option if provided
//             let proxyOption;
//             if (proxy) {
//               try {
//                 const proxyUrl = new URL(proxy);
//                 proxyOption = {
//                   server: `${proxyUrl.protocol}//${proxyUrl.host}`,
//                   username: proxyUrl.username || undefined,
//                   password: proxyUrl.password || undefined,
//                 };
//               } catch {
//                 console.warn('Invalid proxy URL, ignoring proxy option');
//               }
//             }
            
//             // Create output directory if it doesn't exist
//             const outputDir = path.join(process.cwd(), 'output');
//             if (!fs.existsSync(outputDir)) {
//               fs.mkdirSync(outputDir, { recursive: true });
//             }
            
//             const results = [];
//             const debugPort = Math.floor(Math.random() * 10000) + 9000;
            
//             // Launch browser once for all audits
//             const browser = await chromium.launch({ 
//               headless: false,
//               channel: 'chrome',
//               proxy: proxyOption,
//               args: [
//                 `--remote-debugging-port=${debugPort}`,
//                 '--lang=ko',
//                 '--enable-features=Lighthouse',
//                 '--disable-web-security',
//                 '--disable-features=VizDisplayCompositor'
//               ]
//             });
            
//             const context = await browser.newContext({
//               locale: 'ko-KR',
//             });
            
//             // Process each URL
//             for (let i = 0; i < urls.length; i++) {
//               const url = urls[i];
//               const urlResult: {
//                 url: string;
//                 success: boolean;
//                 reportName: string | null;
//                 error: string | null;
//                 index: number;
//                 total: number;
//               } = {
//                 url,
//                 success: false,
//                 reportName: null,
//                 error: null,
//                 index: i + 1,
//                 total: urls.length
//               };
              
//               try {
//                 console.log(`\n🔍 [${i + 1}/${urls.length}] Processing: ${url}`);
                
//                 // Send progress update to renderer
//                 event.sender.send('lighthouse-progress', {
//                   current: i + 1,
//                   total: urls.length,
//                   url,
//                   status: 'processing'
//                 });
                
//                 const page = await context.newPage();
                
//                 // Navigate to URL
//                 await page.goto(url, { waitUntil: 'networkidle' });
//                 console.log(`✅ Navigated to: ${url}`);
                
//                 // Wait for page to be fully loaded
//                 await page.waitForLoadState('networkidle');
//                 await page.waitForTimeout(2000);
                
//                 // Generate unique report name
//                 const timestamp = Date.now();
//                 const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
//                 const reportName = `lighthouse-${sanitizedUrl}-${timestamp}`;
                
//                 // Run Lighthouse audit
//                 await playAudit({
//                   page: page,
//                   port: debugPort,
//                   opts: {
//                     locale: 'ko',
//                   },
//                   thresholds: {
//                     performance: 50,
//                     accessibility: 50,
//                     'best-practices': 50,
//                     seo: 50,
//                     pwa: 50,
//                   },
//                   reports: {
//                     formats: {
//                       html: true,
//                       json: true,
//                     },
//                     name: reportName,
//                     directory: outputDir,
//                   },
//                 });
                
//                 console.log(`✅ Lighthouse audit completed for: ${url}`);
                
//                 // Generate PDF with expanded sections
//                 try {
//                   const htmlReportPath = `file://${path.join(outputDir, `${reportName}.html`)}`;
//                   const pdfPage = await context.newPage();
                  
//                   await pdfPage.goto(htmlReportPath);
//                   await pdfPage.waitForLoadState('networkidle');
//                   await pdfPage.waitForTimeout(2000);
                  
//                   // Expand all sections
//                   await pdfPage.evaluate(() => {
//                     document.querySelectorAll('details').forEach(detail => {
//                       detail.open = true;
//                     });
//                     document.querySelectorAll('[aria-expanded="false"]').forEach(element => {
//                       element.setAttribute('aria-expanded', 'true');
//                     });
//                     document.querySelectorAll('.lh-collapsed, .collapsed').forEach(element => {
//                       element.classList.remove('lh-collapsed', 'collapsed');
//                     });
//                   });
                  
//                   await pdfPage.waitForTimeout(1000);
                  
//                   const pdfPath = path.join(outputDir, `${reportName}.pdf`);
//                   await pdfPage.pdf({
//                     path: pdfPath,
//                     format: 'A4',
//                     printBackground: true,
//                     margin: {
//                       top: '20px',
//                       right: '20px',
//                       bottom: '20px',
//                       left: '20px'
//                     }
//                   });
                  
//                   console.log(`📄 PDF generated: ${pdfPath}`);
//                   await pdfPage.close();
                  
//                 } catch (pdfError) {
//                   console.error('❌ PDF generation failed:', pdfError);
//                 }
                
//                 urlResult.success = true;
//                 urlResult.reportName = reportName;
                
//                 // Send success update
//                 event.sender.send('lighthouse-progress', {
//                   current: i + 1,
//                   total: urls.length,
//                   url,
//                   status: 'completed',
//                   reportName
//                 });
                
//                 await page.close();
                
//               } catch (error) {
//                 console.error(`❌ Failed to process ${url}:`, error);
//                 urlResult.error = error instanceof Error ? error.message : 'Unknown error';
                
//                 // Send error update
//                 event.sender.send('lighthouse-progress', {
//                   current: i + 1,
//                   total: urls.length,
//                   url,
//                   status: 'failed',
//                   error: urlResult.error
//                 });
//               }
              
//               results.push(urlResult);
//             }
            
//             console.log(`\n✅ Batch Lighthouse generation completed: ${results.filter(r => r.success).length}/${urls.length} successful`);
            
//             // Merge all JSON reports
//             const mergedJsonPath = path.join(outputDir, `merged-lighthouse-${Date.now()}.json`);
//             const allJsonData: any[] = [];
//             const successfulResults = results.filter(r => r.success && r.reportName);
            
//             for (const result of successfulResults) {
//               try {
//                 const jsonPath = path.join(outputDir, `${result.reportName}.json`);
//                 if (fs.existsSync(jsonPath)) {
//                   const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
//                   allJsonData.push({
//                     url: result.url,
//                     reportName: result.reportName,
//                     data: jsonData
//                   });
//                 }
//               } catch (err) {
//                 console.error(`Failed to read JSON for ${result.url}:`, err);
//               }
//             }
            
//             fs.writeFileSync(mergedJsonPath, JSON.stringify(allJsonData, null, 2));
//             console.log(`📄 Merged JSON saved: ${mergedJsonPath}`);
            
//             // Create final score report
//             const finalReportPath = path.join(outputDir, `final-seo-report-${Date.now()}.html`);
//             const scores: any[] = [];
//             let totalPerformance = 0;
//             let totalAccessibility = 0;
//             let totalBestPractices = 0;
//             let totalSEO = 0;
//             let totalPWA = 0;
//             let validScoresCount = 0;
            
//             for (const jsonItem of allJsonData) {
//               const lhr = jsonItem.data?.lhr || jsonItem.data;
//               if (lhr?.categories) {
//                 const perf = lhr.categories.performance?.score || 0;
//                 const a11y = lhr.categories.accessibility?.score || 0;
//                 const bp = lhr.categories['best-practices']?.score || 0;
//                 const seo = lhr.categories.seo?.score || 0;
//                 const pwa = lhr.categories.pwa?.score || 0;
                
//                 scores.push({
//                   url: jsonItem.url,
//                   performance: Math.round(perf * 100),
//                   accessibility: Math.round(a11y * 100),
//                   bestPractices: Math.round(bp * 100),
//                   seo: Math.round(seo * 100),
//                   pwa: Math.round(pwa * 100),
//                   average: Math.round(((perf + a11y + bp + seo + pwa) / 5) * 100)
//                 });
                
//                 totalPerformance += perf;
//                 totalAccessibility += a11y;
//                 totalBestPractices += bp;
//                 totalSEO += seo;
//                 totalPWA += pwa;
//                 validScoresCount++;
//               }
//             }
            
//             const avgPerformance = validScoresCount > 0 ? Math.round((totalPerformance / validScoresCount) * 100) : 0;
//             const avgAccessibility = validScoresCount > 0 ? Math.round((totalAccessibility / validScoresCount) * 100) : 0;
//             const avgBestPractices = validScoresCount > 0 ? Math.round((totalBestPractices / validScoresCount) * 100) : 0;
//             const avgSEO = validScoresCount > 0 ? Math.round((totalSEO / validScoresCount) * 100) : 0;
//             const avgPWA = validScoresCount > 0 ? Math.round((totalPWA / validScoresCount) * 100) : 0;
//             const overallAverage = validScoresCount > 0 ? Math.round(((totalPerformance + totalAccessibility + totalBestPractices + totalSEO + totalPWA) / (validScoresCount * 5)) * 100) : 0;
            
//             // Collect all recommendations and issues
//             const allRecommendations: any[] = [];
//             const issuesByCategory: { [key: string]: Set<string> } = {
//               performance: new Set(),
//               accessibility: new Set(),
//               'best-practices': new Set(),
//               seo: new Set(),
//               pwa: new Set()
//             };
            
//             for (const jsonItem of allJsonData) {
//               const lhr = jsonItem.data?.lhr || jsonItem.data;
//               if (lhr?.audits) {
//                 Object.entries(lhr.audits).forEach(([key, audit]: [string, any]) => {
//                   if (audit.score !== null && audit.score < 1 && audit.score !== -1) {
//                     // This is a failed audit
//                     const category = Object.keys(lhr.categories || {}).find(cat => {
//                       const categoryAudits = lhr.categories[cat]?.auditRefs || [];
//                       return categoryAudits.some((ref: any) => ref.id === key);
//                     }) || 'other';
                    
//                     const issue = {
//                       id: key,
//                       title: audit.title,
//                       description: audit.description,
//                       score: audit.score,
//                       displayValue: audit.displayValue,
//                       category,
//                       url: jsonItem.url
//                     };
                    
//                     allRecommendations.push(issue);
                    
//                     if (issuesByCategory[category]) {
//                       issuesByCategory[category].add(audit.title);
//                     }
//                   }
//                 });
//               }
//             }
            
//             // Generate AI explanation for the issues
//             let aiExplanation = '';
//             try {
//               // Retrieve Google/Gemini API key from Electron Store
//               const { getStore } = require('./storage');
//               const store = getStore();
//               const aiKeys = store ? store.get('ai-keys', []) : [];
//               let googleKey: any = null;
  
//               if (Array.isArray(aiKeys)) {
//                 // Prefer a key explicitly named 'egdesk' (case-insensitive) for debugging
//                 const egdeskKey = aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google');
//                 if (egdeskKey) {
//                   googleKey = egdeskKey;
//                   console.log('🔑 Using Google AI key named "egdesk" from store for debugging');
//                 } else {
//                   // Fallbacks: active Google key, then any Google key
//                   googleKey = aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) || aiKeys.find((k: any) => k?.providerId === 'google');
//                 }
//               }
  
//               const geminiApiKey = googleKey?.fields?.apiKey || process.env.GEMINI_API_KEY || '';
  
//               if (geminiApiKey) {
//                 // Build issues summary text
//                 const issuesSummary = Object.entries(issuesByCategory)
//                   .filter(([_, issues]) => (issues as Set<string>).size > 0)
//                   .map(([category, issues]) => `${category}: ${Array.from(issues as Set<string>).join(', ')}`)
//                   .join('\n');
  
//                 const prompt = `당신은 SEO 전문가입니다. 웹사이트 분석 결과 발견된 다음 문제들을 SEO에 대해 전혀 모르는 일반 사용자가 이해할 수 있도록 쉽고 친절하게 설명해주세요:\n\n웹사이트 분석 점수:\n- 전체 평균: ${overallAverage}점\n- 성능: ${avgPerformance}점\n- 접근성: ${avgAccessibility}점\n- SEO: ${avgSEO}점\n\n발견된 주요 문제들:\n${issuesSummary}\n\n다음 형식으로 답변해주세요:\n1. 전체적인 상황 요약 (2-3문장)\n2. 각 카테고리별 문제점과 해결 방법을 쉽게 설명\n3. 우선순위가 높은 개선사항 3가지\n\n전문 용어는 피하고, 일반인도 이해할 수 있는 쉬운 말로 설명해주세요.`;
  
//                 // Use Google Generative AI (Gemini 2.5 Flash)
//                 const { GoogleGenerativeAI } = await import('@google/generative-ai');
//                 const genAI = new GoogleGenerativeAI(geminiApiKey);
//                 const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
//                 const result = await model.generateContent({
//                   contents: [
//                     {
//                       role: 'user',
//                       parts: [{ text: prompt }],
//                     },
//                   ],
//                 });
  
//                 const response = result?.response;
//                 const text = response ? await response.text() : '';
//                 aiExplanation = text || '(AI 설명을 생성하지 못했습니다)';
  
//                 console.log('✅ AI explanation generated successfully with Gemini 2.5 Flash');
//               } else {
//                 console.warn('⚠️ Gemini API key not found in Electron Store or env, skipping AI explanation');
//                 aiExplanation = '(AI 설명을 생성하려면 Google AI 키를 추가하거나 GEMINI_API_KEY 환경 변수를 설정하세요)';
//               }
//             } catch (aiError) {
//               console.error('Failed to generate AI explanation:', aiError);
//               aiExplanation = '(AI 설명 생성 중 오류가 발생했습니다)';
//             }
            
//             const getScoreColor = (score: number) => {
//               if (score >= 90) return '#0cce6b';
//               if (score >= 50) return '#ffa400';
//               return '#ff4e42';
//             };
            
//             const finalReportHtml = `
//   <!DOCTYPE html>
//   <html lang="ko">
//   <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>SEO 최종 분석 보고서</title>
//     <style>
//       * { margin: 0; padding: 0; box-sizing: border-box; }
//       body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #f5f5f5; }
//       .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
//       h1 { color: #202124; margin-bottom: 10px; font-size: 32px; }
//       .subtitle { color: #5f6368; margin-bottom: 40px; font-size: 16px; }
//       .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 40px; }
//       .summary-card { padding: 20px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
//       .summary-card .value { font-size: 48px; font-weight: bold; margin-bottom: 8px; }
//       .summary-card .label { font-size: 14px; opacity: 0.9; }
//       .overall-score { text-align: center; padding: 40px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; color: white; margin-bottom: 40px; }
//       .overall-score .score { font-size: 72px; font-weight: bold; margin-bottom: 10px; }
//       .overall-score .label { font-size: 20px; opacity: 0.9; }
//       table { width: 100%; border-collapse: collapse; margin-top: 20px; }
//       th, td { padding: 16px; text-align: left; border-bottom: 1px solid #e0e0e0; }
//       th { background: #f8f9fa; font-weight: 600; color: #202124; }
//       .score-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 14px; color: white; }
//       .url-cell { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//       .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #5f6368; font-size: 14px; text-align: center; }
//     </style>
//   </head>
//   <body>
//     <div class="container">
//       <h1>🎯 SEO 최종 분석 보고서</h1>
//       <div class="subtitle">생성일: ${new Date().toLocaleString('ko-KR')}</div>
      
//       <div class="overall-score">
//         <div class="score">${overallAverage}</div>
//         <div class="label">전체 평균 점수</div>
//       </div>
      
//       <div class="summary">
//         <div class="summary-card">
//           <div class="value">${avgPerformance}</div>
//           <div class="label">평균 성능</div>
//         </div>
//         <div class="summary-card">
//           <div class="value">${avgAccessibility}</div>
//           <div class="label">평균 접근성</div>
//         </div>
//         <div class="summary-card">
//           <div class="value">${avgBestPractices}</div>
//           <div class="label">평균 모범 사례</div>
//         </div>
//         <div class="summary-card">
//           <div class="value">${avgSEO}</div>
//           <div class="label">평균 SEO</div>
//         </div>
//         <div class="summary-card">
//           <div class="value">${avgPWA}</div>
//           <div class="label">평균 PWA</div>
//         </div>
//       </div>
      
//       <h2 style="margin-bottom: 20px; color: #202124;">페이지별 상세 점수</h2>
//       <table>
//         <thead>
//           <tr>
//             <th>URL</th>
//             <th>성능</th>
//             <th>접근성</th>
//             <th>모범 사례</th>
//             <th>SEO</th>
//             <th>PWA</th>
//             <th>평균</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${scores.map(s => `
//             <tr>
//               <td class="url-cell" title="${s.url}">${s.url}</td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.performance)}">${s.performance}</span></td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.accessibility)}">${s.accessibility}</span></td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.bestPractices)}">${s.bestPractices}</span></td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.seo)}">${s.seo}</span></td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.pwa)}">${s.pwa}</span></td>
//               <td><span class="score-badge" style="background-color: ${getScoreColor(s.average)}">${s.average}</span></td>
//             </tr>
//           `).join('')}
//         </tbody>
//       </table>
      
//       <div class="footer">
//         <p>총 ${urls.length}개 페이지 분석 완료 (성공: ${results.filter(r => r.success).length}개, 실패: ${results.filter(r => !r.success).length}개)</p>
//         <p>상세 보고서는 개별 Lighthouse HTML 파일을 참조하세요.</p>
//       </div>
//     </div>
//   </body>
//   </html>
//             `;
            
//             fs.writeFileSync(finalReportPath, finalReportHtml);
//             console.log(`📊 Final report saved: ${finalReportPath}`);
            
//             // Simple approach: Create a single combined HTML with all reports and convert to one PDF
//             const mergedPdfPath = path.join(outputDir, `merged-lighthouse-${Date.now()}.pdf`);
//             try {
//               console.log('📄 Creating merged PDF with cover and all reports...');
              
//               const pdfPage = await context.newPage();
              
//               // Build combined HTML with cover + all reports
//               let combinedHtml = `
//   <!DOCTYPE html>
//   <html>
//   <head>
//     <meta charset="UTF-8">
//     <title>EG SEO 분석 보고서</title>
//     <style>
//       .cover-page {
//         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//         padding: 40px;
//         display: flex;
//         flex-direction: column;
//         justify-content: center;
//         align-items: center;
//         min-height: 100vh;
//         background: #f5f7fa; /* simplified solid background */
//         page-break-after: always;
//       }
//       .cover-container {
//         max-width: 800px;
//         text-align: center;
//         background: white;
//         padding: 60px;
//         border-radius: 12px;
//         border: 1px solid #e0e0e0; /* replace shadow with border for print */
//       }
//       .cover-title { 
//         color: #202124;
//         font-size: 36px;
//         margin-bottom: 20px;
//         padding: 10px 0;
//       }
//       .cover-subtitle {
//         color: #5f6368;
//         font-size: 18px;
//         margin-bottom: 40px;
//       }
//       .cover-logo {
//         font-size: 48px; /* smaller for print */
//         margin-bottom: 20px;
//       }
//       .report-section {
//         page-break-before: always;
//         padding: 20px;
//       }
      
//       /* Summary Page Styles */
//       .summary-page {
//         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//         padding: 40px;
//         min-height: 100vh;
//         background: #f8f9fa; /* solid */
//         page-break-after: always;
//       }
//       .summary-container {
//         max-width: 1200px;
//         margin: 0 auto;
//         background: white;
//         padding: 40px;
//         border-radius: 12px;
//         border: 1px solid #e0e0e0; /* replace shadow */
//       }
//       .summary-title {
//         color: #202124;
//         font-size: 28px;
//         margin-bottom: 24px;
//         text-align: center;
//       }
//       .overall-score-section {
//         text-align: center;
//         margin-bottom: 32px;
//       }
//       .overall-score-card {
//         display: inline-block;
//         padding: 32px 48px;
//         background: #f5576c; /* solid instead of gradient */
//         border-radius: 12px;
//         color: white;
//       }
//       .overall-score-value {
//         font-size: 56px;
//         font-weight: bold;
//         margin-bottom: 8px;
//       }
//       .overall-score-label {
//         font-size: 16px;
//       }
//       .metrics-grid {
//         display: grid;
//         grid-template-columns: repeat(5, 1fr);
//         gap: 12px;
//         margin-bottom: 32px;
//       }
//       .metric-card {
//         padding: 16px;
//         background: #667eea; /* solid */
//         border-radius: 8px;
//         color: white;
//         text-align: center;
//       }
//       .metric-value {
//         font-size: 28px;
//         font-weight: bold;
//         margin-bottom: 6px;
//       }
//       .metric-label {
//         font-size: 13px;
//       }
//       .table-title {
//         color: #202124;
//         font-size: 20px;
//         margin-bottom: 16px;
//       }
//       .scores-table {
//         width: 100%;
//         border-collapse: collapse;
//         margin-bottom: 24px;
//       }
//       .scores-table th,
//       .scores-table td {
//         padding: 10px;
//         text-align: left;
//         border-bottom: 1px solid #e0e0e0;
//         font-size: 13px;
//       }
//       .scores-table th {
//         background: #f8f9fa;
//         font-weight: 600;
//         color: #202124;
//       }
//       .url-cell {
//         max-width: 300px;
//         overflow: hidden;
//         text-overflow: ellipsis;
//         white-space: nowrap;
//         font-size: 13px;
//       }
//       .score-badge {
//         display: inline-block;
//         padding: 3px 10px;
//         border-radius: 10px;
//         font-weight: 600;
//         font-size: 12px;
//         color: white;
//       }
//       .summary-footer {
//         text-align: center;
//         padding-top: 16px;
//         border-top: 1px solid #e0e0e0;
//         color: #5f6368;
//         font-size: 13px;
//       }
//       .summary-footer p {
//         margin: 4px 0;
//       }
      
//       /* AI Explanation Page Styles */
//       .ai-explanation-page {
//         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//         padding: 40px;
//         min-height: 100vh;
//         background: #e7f4ff; /* solid */
//         page-break-after: always;
//       }
//       .ai-explanation-container {
//         max-width: 1200px;
//         margin: 0 auto;
//         background: white;
//         padding: 40px;
//         border-radius: 12px;
//         border: 1px solid #e0e0e0;
//       }
//       .ai-title {
//         color: #202124;
//         font-size: 28px;
//         margin-bottom: 24px;
//         text-align: center;
//       }
//       .ai-content {
//         background: #f8f9fa;
//         padding: 24px;
//         border-radius: 8px;
//         margin-bottom: 32px;
//         border-left: 4px solid #667eea;
//       }
//       .ai-content p {
//         margin: 12px 0;
//         line-height: 1.6;
//         color: #202124;
//         font-size: 14px;
//       }
//       .ai-content p:first-child { margin-top: 0; }
//       .ai-content p:last-child { margin-bottom: 0; }
//       .top-issues { margin-top: 32px; }
//       .issues-title {
//         color: #202124;
//         font-size: 20px;
//         margin-bottom: 16px;
//       }
//       .issues-grid {
//         display: grid;
//         grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
//         gap: 16px;
//       }
//       .issue-category-card {
//         background: #f5f5f5; /* solid */
//         padding: 16px;
//         border-radius: 8px;
//         border-left: 4px solid #667eea;
//       }
//       .issue-category-card h3 {
//         color: #202124;
//         font-size: 16px;
//         margin-bottom: 12px;
//         font-weight: 600;
//       }
//       .issue-category-card ul { list-style: none; padding: 0; margin: 0; }
//       .issue-category-card li {
//         padding: 6px 0;
//         color: #5f6368;
//         font-size: 13px;
//         border-bottom: 1px solid #ddd;
//       }
//       .issue-category-card li:last-child { border-bottom: none; }
//       .issue-category-card li.more-items { font-style: italic; color: #9e9e9e; }
//     </style>
//   </head>
//   <body>
//     <!-- Cover Page -->
//     <div class="cover-page">
//       <div class="cover-container">
//         <div class="cover-logo">🔍</div>
//         <h1 class="cover-title">EG SEO 분석 보고서</h1>
//         <div class="cover-subtitle">생성일: ${new Date().toLocaleString('ko-KR')}</div>
//       </div>
//     </div>
    
//     <!-- Summary Page -->
//     <div class="summary-page">
//       <div class="summary-container">
//         <h1 class="summary-title">📊 분석 요약</h1>
        
//         <div class="overall-score-section">
//           <div class="overall-score-card">
//             <div class="overall-score-value">${overallAverage}</div>
//             <div class="overall-score-label">전체 평균 점수</div>
//           </div>
//         </div>
        
//         <div class="metrics-grid">
//           <div class="metric-card">
//             <div class="metric-value">${avgPerformance}</div>
//             <div class="metric-label">성능</div>
//           </div>
//           <div class="metric-card">
//             <div class="metric-value">${avgAccessibility}</div>
//             <div class="metric-label">접근성</div>
//           </div>
//           <div class="metric-card">
//             <div class="metric-value">${avgBestPractices}</div>
//             <div class="metric-label">모범 사례</div>
//           </div>
//           <div class="metric-card">
//             <div class="metric-value">${avgSEO}</div>
//             <div class="metric-label">SEO</div>
//           </div>
//           <div class="metric-card">
//             <div class="metric-value">${avgPWA}</div>
//             <div class="metric-label">PWA</div>
//           </div>
//         </div>
        
//         <h2 class="table-title">페이지별 상세 점수</h2>
//         <table class="scores-table">
//           <thead>
//             <tr>
//               <th>URL</th>
//               <th>성능</th>
//               <th>접근성</th>
//               <th>모범 사례</th>
//               <th>SEO</th>
//               <th>PWA</th>
//               <th>평균</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${scores.map(s => `
//               <tr>
//                 <td class="url-cell">${s.url}</td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.performance)}">${s.performance}</span></td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.accessibility)}">${s.accessibility}</span></td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.bestPractices)}">${s.bestPractices}</span></td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.seo)}">${s.seo}</span></td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.pwa)}">${s.pwa}</span></td>
//                 <td><span class="score-badge" style="background-color: ${getScoreColor(s.average)}">${s.average}</span></td>
//               </tr>
//             `).join('')}
//           </tbody>
//         </table>
        
//         <div class="summary-footer">
//           <p>총 ${urls.length}개 페이지 분석 완료</p>
//           <p>성공: ${results.filter(r => r.success).length}개 | 실패: ${results.filter(r => !r.success).length}개</p>
//         </div>
//       </div>
//     </div>
    
//     <!-- AI Explanation Page -->
//     <div class="ai-explanation-page">
//       <div class="ai-explanation-container">
//         <h1 class="ai-title">🤖 AI가 설명하는 개선 방안</h1>
//         <div class="ai-content">
//           ${aiExplanation.split('\n').map(line => `<p>${line}</p>`).join('')}
//         </div>
        
//         <div class="top-issues">
//           <h2 class="issues-title">주요 발견 사항</h2>
//           <div class="issues-grid">
//             ${Object.entries(issuesByCategory)
//               .filter(([_, issues]) => (issues as Set<string>).size > 0)
//               .map(([category, issues]) => {
//                 const categoryNames: any = {
//                   'performance': '⚡ 성능',
//                   'accessibility': '♿ 접근성',
//                   'best-practices': '✅ 모범 사례',
//                   'seo': '🔍 SEO',
//                   'pwa': '📱 PWA'
//                 };
//                 return `
//                   <div class="issue-category-card">
//                     <h3>${categoryNames[category] || category}</h3>
//                     <ul>
//                       ${Array.from(issues as Set<string>).slice(0, 5).map(issue => `<li>${issue}</li>`).join('')}
//                       ${(issues as Set<string>).size > 5 ? `<li class="more-items">그 외 ${(issues as Set<string>).size - 5}개 항목...</li>` : ''}
//                     </ul>
//                   </div>
//                 `;
//               }).join('')}
//           </div>
//         </div>
//       </div>
//     </div>
//   `;
  
//               // Add each report's HTML content
//               for (const result of successfulResults) {
//                 if (result.reportName) {
//                   const htmlPath = path.join(outputDir, `${result.reportName}.html`);
//                   if (fs.existsSync(htmlPath)) {
//                     try {
//                       const reportHtml = fs.readFileSync(htmlPath, 'utf8');
//                       // Extract body content from the Lighthouse HTML
//                       const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
//                       if (bodyMatch) {
//                         combinedHtml += `
//     <div class="report-section">
//       ${bodyMatch[1]}
//     </div>
//   `;
//                       }
//                     } catch (err) {
//                       console.error(`Failed to read HTML for ${result.reportName}:`, err);
//                     }
//                   }
//                 }
//               }
              
//               combinedHtml += `
//   </body>
//   </html>
//               `;
              
//               // Convert combined HTML to PDF
//               await pdfPage.setContent(combinedHtml, { waitUntil: 'networkidle' });
//               await pdfPage.waitForTimeout(2000);
              
//               await pdfPage.pdf({
//                 path: mergedPdfPath,
//                 format: 'A4',
//                 printBackground: true,
//                 margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
//               });
              
//               await pdfPage.close();
              
//               console.log(`📄 Merged PDF saved: ${mergedPdfPath}`);
//             } catch (pdfMergeError) {
//               console.error('Failed to create merged PDF:', pdfMergeError);
//             }
            
//             await browser.close();
            
//             return {
//               success: true,
//               results,
//               summary: {
//                 total: urls.length,
//                 successful: results.filter(r => r.success).length,
//                 failed: results.filter(r => !r.success).length
//               },
//               mergedJsonPath,
//               mergedPdfPath,
//               finalReportPath,
//               scores: {
//                 overall: overallAverage,
//                 performance: avgPerformance,
//                 accessibility: avgAccessibility,
//                 bestPractices: avgBestPractices,
//                 seo: avgSEO,
//                 pwa: avgPWA
//               }
//             };
            
//           } catch (error) {
//             console.error('❌ Batch Lighthouse generation failed:', error);
//             return { 
//               success: false, 
//               error: error instanceof Error ? error.message : 'Unknown error' 
//             };
//           }
//         });