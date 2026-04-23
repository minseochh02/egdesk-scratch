// ============================================
// Hometax Automation - Playwright-based automation for Korean National Tax Service
// ============================================

import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface HometaxCredentials {
  certificatePassword: string;
}

interface HometaxConnectionResult {
  success: boolean;
  businessInfo?: {
    businessName: string;
    representativeName?: string;
    businessType?: string;
  };
  error?: string;
}

let globalContext: BrowserContext | null = null;
let globalPage: Page | null = null;
const pageStack: Page[] = [];
let downloadedFiles: { sales?: string; purchase?: string } = {};
let noDataDetected = false;

/**
 * Fetch available certificates from Hometax
 * Opens browser and scrapes certificate list from iframe
 */
export async function fetchCertificates(): Promise<{ success: boolean; certificates?: any[]; error?: string }> {
  try {
    console.log('[Hometax] Fetching available certificates...');

    // Create downloads directory
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    // Create temporary profile directory
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hometax-profile-'));
    console.log('📁 Using profile directory:', profileDir);

    // Launch browser
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
      downloadsPath: downloadsPath,
      args: [
        '--window-size=907,871',
        '--window-position=605,0',
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

    globalContext = context;

    // Get or create page
    const pages = context.pages();
    let page = pages.length > 0 ? pages[0] : await context.newPage();
    globalPage = page;

    // Set up dialog handling
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      console.log(`🔔 Dialog detected: ${dialog.type()} - "${msg}"`);
      if (msg.includes('조회된 내역이 없습니다')) {
        noDataDetected = true;
      }
      await dialog.accept();
    });

    // Set up download handling
    page.on('download', async (download) => {
      console.log('📥 Download started:', download.url());
      const suggestedFilename = download.suggestedFilename();
      const filePath = path.join(downloadsPath, suggestedFilename);

      try {
        await download.saveAs(filePath);
        console.log('✅ Download saved to:', filePath);
      } catch (err) {
        console.error('❌ Download failed:', err);
      }
    });

    // Navigate to Hometax
    await page.goto('https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=index3');
    await page.waitForTimeout(3000);

    // Handle initial popup that appears on page load
    console.log('[Hometax] Waiting for initial popup...');
    const initialPopupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
    const initialPopup = await initialPopupPromise;

    if (initialPopup) {
      console.log('[Hometax] Initial popup detected, handling...');
      await initialPopup.waitForLoadState('domcontentloaded', { timeout: 180000 });
      await initialPopup.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {});
      await initialPopup.waitForTimeout(3000);

      pageStack.push(page);
      page = initialPopup;
      globalPage = page;

      // Set up dialog handling for popup
      page.on('dialog', async (dialog) => {
        console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
        await dialog.accept();
        console.log('✅ Dialog accepted');
      });

      await page.waitForTimeout(2000);
      await page.mouse.click(865, 18); // Click at coordinates to close

      // Wait for popup to close and switch back
      await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

      const previousPage = pageStack.pop();
      if (previousPage) {
        page = previousPage;
        globalPage = page;
        console.log('⬅️ Switched back to previous page after initial popup:', page.url());
      } else {
        const allPages = context.pages();
        page = allPages[0];
        globalPage = page;
      }
    } else {
      console.log('[Hometax] No initial popup detected, proceeding...');
    }

    // Now open certificate login popup
    console.log('[Hometax] Opening certificate login popup...');
    await page.waitForTimeout(2000);
    const certPopupPromise = context.waitForEvent('page');
    await page.locator('[id="mf_txppWframe_loginboxFrame_anchor22"]').click({ timeout: 180000 });

    // Handle certificate popup
    const certPopup = await certPopupPromise;
    await certPopup.waitForLoadState('domcontentloaded', { timeout: 180000 });
    await certPopup.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {});
    await certPopup.waitForTimeout(5000);

    pageStack.push(page);
    page = certPopup;
    globalPage = page;

    // Set up dialog handling for certificate popup
    page.on('dialog', async (dialog) => {
      console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
      await dialog.accept();
      console.log('✅ Dialog accepted');
    });

    await page.waitForTimeout(3000);
    await page.mouse.click(865, 18); // Click at coordinates to close certificate popup

    // Wait for certificate popup to close and switch back
    {
      await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

      const previousPage = pageStack.pop();
      if (previousPage) {
        page = previousPage;
        globalPage = page;
        console.log('⬅️ Switched back to previous page after certificate popup:', page.url());
        console.log('📚 Stack size:', pageStack.length);
      } else {
        console.warn('⚠️ No previous page in stack, using first available page');
        const allPages = context.pages();
        page = allPages[0];
        globalPage = page;
      }
    }

    // Fetch certificate list from iframe
    console.log('[Hometax] Fetching certificate list from iframe...');

    const frames = page.frames();
    console.log(`[Hometax] Found ${frames.length} frames`);

    let certificateData = null;
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;

      try {
        const frameUrl = frame.url();
        console.log(`[Hometax] Checking iframe: ${frameUrl}`);

        const tableXPath = '/html/body/div[9]/div[2]/div[1]/div/div[5]/div/div[2]/div/div[4]/div[2]/div/table/tbody';

        const tableExists = await frame.evaluate((xpath) => {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue !== null;
        }, tableXPath);

        if (tableExists) {
          console.log('[Hometax] ✅ Found certificate table in iframe!');

          certificateData = await frame.evaluate((xpath) => {
            const tbody = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLTableSectionElement;

            if (!tbody) return null;

            const rows = tbody.querySelectorAll('tr');
            const certificates = [];

            // Add event listeners to log all click events for debugging
            console.log('[Hometax] Adding event listeners to certificate rows for debugging...');
            rows.forEach((row, index) => {
              ['click', 'mousedown', 'mouseup', 'dblclick', 'mouseenter', 'mouseover'].forEach(eventType => {
                row.addEventListener(eventType, (e) => {
                  console.log(`[Hometax Event] ${eventType.toUpperCase()} on row ${index + 1}`, {
                    bubbles: e.bubbles,
                    cancelable: e.cancelable,
                    target: e.target,
                    currentTarget: e.currentTarget,
                    eventPhase: e.eventPhase
                  });
                }, true);
              });
            });

            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const cells = row.querySelectorAll('td');
              if (cells.length >= 4) {
                // Generate XPath for this specific row (1-indexed for XPath)
                const rowXPath = `${xpath}/tr[${i + 1}]`;

                certificates.push({
                  소유자명: cells[0].textContent?.trim() || '',
                  용도: cells[1].textContent?.trim() || '',
                  발급기관: cells[2].textContent?.trim() || '',
                  만료일: cells[3].textContent?.trim() || '',
                  xpath: rowXPath
                });
              }
            }

            return certificates;
          }, tableXPath);

          break;
        }
      } catch (error) {
        console.log(`[Hometax] Error checking iframe ${frame.url()}:`, error);
        continue;
      }
    }

    if (certificateData && certificateData.length > 0) {
      console.log(`[Hometax] Found ${certificateData.length} certificates`);
      return {
        success: true,
        certificates: certificateData
      };
    } else {
      return {
        success: false,
        error: '인증서를 찾을 수 없습니다'
      };
    }

  } catch (error) {
    console.error('[Hometax] Error fetching certificates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Connect to Hometax using selected certificate and password
 * Uses the already-open browser from fetchCertificates(), or opens new browser if needed
 */
export async function connectToHometax(
  selectedCertificate: any,
  certificatePassword: string,
  invoiceType: 'sales' | 'purchase' = 'sales',
  invoiceCategory: 'tax' | 'tax-exempt' = 'tax',
  year?: number,
  month?: number
): Promise<HometaxConnectionResult & { downloadedFile?: string }> {
  try {
    console.log('[Hometax] Logging in with selected certificate...');

    noDataDetected = false; // Reset global flag at start of each run
    let page = globalPage;
    let context = globalContext;

    // Check if already logged in and on invoice page
    const alreadyLoggedIn = page && context && await page.evaluate(() => {
      const url = window.location.href;
      // Check if we're on the tax invoice list page
      return url.includes('grpMenuAtag_46_4609050300') || document.querySelector('#mf_txppWframe_radio3') !== null;
    }).catch(() => false);

    let companyName = '';
    let companyType = '';

    if (alreadyLoggedIn) {
      console.log('[Hometax] ✅ Already logged in, proceeding with data collection...');

      // Get company info from page if available
      const companyNameXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[2]/div/span[1]';
      companyName = await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        return element?.textContent?.trim() || '';
      }, companyNameXPath).catch(() => '');

      const companyTypeXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span';
      companyType = await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        return element?.textContent?.trim() || '';
      }, companyTypeXPath).catch(() => '');

      console.log('[Hometax] Company name:', companyName, 'Type:', companyType);
      // Jump to download section (skip all login and navigation)
    } else {
      // Need to login - either browser not initialized or not on invoice page
      if (!page || !context) {
        console.log('[Hometax] Browser not initialized, starting browser...');

      // Create downloads directory
      const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
      }

      // Create temporary profile directory
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hometax-profile-'));
      console.log('📁 Using profile directory:', profileDir);

      // Launch browser
      context = await chromium.launchPersistentContext(profileDir, {
        headless: false,
        channel: 'chrome',
        viewport: null,
        permissions: ['clipboard-read', 'clipboard-write'],
        acceptDownloads: true,
        downloadsPath: downloadsPath,
        args: [
          '--window-size=907,871',
          '--window-position=605,0',
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

      globalContext = context;

      // Get or create page
      const pages = context.pages();
      page = pages.length > 0 ? pages[0] : await context.newPage();
      globalPage = page;

      // Set up dialog handling
      page.on('dialog', async (dialog) => {
        const msg = dialog.message();
        console.log(`🔔 Dialog detected: ${dialog.type()} - "${msg}"`);
        if (msg.includes('조회된 내역이 없습니다')) {
          noDataDetected = true;
        }
        await dialog.accept();
      });

      // Set up download handling
      page.on('download', async (download) => {
        console.log('📥 Download started:', download.url());
        const suggestedFilename = download.suggestedFilename();
        const filePath = path.join(downloadsPath, suggestedFilename);

        try {
          await download.saveAs(filePath);
          console.log('✅ Download saved to:', filePath);
        } catch (err) {
          console.error('❌ Download failed:', err);
        }
      });

      // Navigate to Hometax
      await page.goto('https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=index3');
      await page.waitForTimeout(3000);

      // Handle initial popup that appears on page load
      console.log('[Hometax] Waiting for initial popup...');
      const initialPopupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
      const initialPopup = await initialPopupPromise;

      if (initialPopup) {
        console.log('[Hometax] Initial popup detected, handling...');
        await initialPopup.waitForLoadState('domcontentloaded', { timeout: 180000 });
        await initialPopup.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {});
        await initialPopup.waitForTimeout(3000);

        pageStack.push(page);
        page = initialPopup;
        globalPage = page;

        // Set up dialog handling for popup
        page.on('dialog', async (dialog) => {
          console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
          await dialog.accept();
          console.log('✅ Dialog accepted');
        });

        await page.waitForTimeout(2000);
        await page.mouse.click(865, 18); // Click at coordinates to close

        // Wait for popup to close and switch back
        await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

        const previousPage = pageStack.pop();
        if (previousPage) {
          page = previousPage;
          globalPage = page;
          console.log('⬅️ Switched back to previous page after initial popup:', page.url());
        } else {
          const allPages = context.pages();
          page = allPages[0];
          globalPage = page;
        }
      } else {
        console.log('[Hometax] No initial popup detected, proceeding...');
      }

      // Now open certificate login popup
      console.log('[Hometax] Opening certificate login popup...');
      await page.waitForTimeout(2000);
      const certPopupPromise = context.waitForEvent('page');
      await page.locator('[id="mf_txppWframe_loginboxFrame_anchor22"]').click({ timeout: 180000 });

      // Handle certificate popup
      const certPopup = await certPopupPromise;
      await certPopup.waitForLoadState('domcontentloaded', { timeout: 180000 });
      await certPopup.waitForLoadState('networkidle', { timeout: 180000 }).catch(() => {});
      await certPopup.waitForTimeout(5000);

      pageStack.push(page);
      page = certPopup;
      globalPage = page;

      // Set up dialog handling for certificate popup
      page.on('dialog', async (dialog) => {
        console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
        await dialog.accept();
        console.log('✅ Dialog accepted');
      });

      await page.waitForTimeout(3000);
      await page.mouse.click(865, 18); // Click at coordinates to close certificate popup

      // Handle certificate popup close
      {
        await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

        const previousPage = pageStack.pop();
        if (previousPage) {
          page = previousPage;
          globalPage = page;
          console.log('⬅️ Switched back to previous page after certificate popup:', page.url());
        } else {
          const allPages = context.pages();
          page = allPages[0];
          globalPage = page;
        }
      }
    }

    // Click on the selected certificate row in the iframe
    console.log('[Hometax] Clicking on selected certificate...');
    if (selectedCertificate.xpath) {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;

        try {
          const certificateClicked = await frame.evaluate((xpath) => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const row = result.singleNodeValue as HTMLElement;
            if (row) {
              console.log('[Hometax] Certificate row found:', xpath);

              // Find the <a> element inside the row (the actual click target)
              const anchor = row.querySelector('a');
              if (!anchor) {
                console.error('[Hometax] No anchor element found in row');
                return false;
              }

              console.log('[Hometax] Found anchor element, clicking:', anchor);

              // Dispatch proper mouse events sequence on the anchor element
              console.log('[Hometax] Dispatching mousedown event');
              anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

              console.log('[Hometax] Dispatching mouseup event');
              anchor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));

              console.log('[Hometax] Dispatching click event');
              anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

              console.log('[Hometax] All mouse events dispatched successfully on anchor');
              return true;
            }
            return false;
          }, selectedCertificate.xpath);

          if (certificateClicked) {
            console.log('[Hometax] Certificate clicked successfully');
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    await page.waitForTimeout(3000);

    // Click on certificate password input in iframe
    console.log('[Hometax] Clicking certificate password input...');
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').click({ timeout: 180000 });
    await page.waitForTimeout(3000); // Human-like delay

    // Fill certificate password in iframe
    console.log('[Hometax] Entering certificate password...');
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').fill(certificatePassword, { timeout: 180000 });
    await page.waitForTimeout(3000); // Human-like delay

    // Click at coordinates inside iframe (submit button)
    console.log('[Hometax] Clicking submit button in iframe...');
    {
      const frame = page.frameLocator('[id="dscert"]');
      await frame.locator('body').evaluate((body, coords) => {
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: coords.x, clientY: coords.y });
        document.elementFromPoint(coords.x, coords.y)?.dispatchEvent(clickEvent);
      }, { x: 357, y: 585 });
    }

    // Wait for page to load after login
    await page.waitForTimeout(3000);
    console.log('[Hometax] ✅ Login successful, continuing automation...');

      // Scrape company name from main page (try div[1] or div[2])
      console.log('[Hometax] Scraping company name...');
      companyName = await page.evaluate(() => {
        const xpaths = [
          '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[2]/div/span[1]',
          '/html/body/div[2]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[2]/div/span[1]'
        ];
        for (const xpath of xpaths) {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const element = result.singleNodeValue as HTMLElement;
          if (element?.textContent?.trim()) return element.textContent.trim();
        }
        return '';
      });
      console.log('[Hometax] Company name:', companyName);

      // Scrape company type (try div[1] or div[2])
      console.log('[Hometax] Scraping company type...');
      companyType = await page.evaluate(() => {
        const xpaths = [
          '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span',
          '/html/body/div[2]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span'
        ];
        for (const xpath of xpaths) {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const element = result.singleNodeValue as HTMLElement;
          if (element?.textContent?.trim()) return element.textContent.trim();
        }
        return '';
      });
      console.log('[Hometax] Company type:', companyType);

    // TODO: Extract business number from the page

    // Navigate to 전자세금계산서 목록조회 (Electronic Tax Invoice List)
    console.log('[Hometax] Navigating to tax invoice list...');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="mf_wfHeader_wq_uuid_358"]').click({ timeout: 180000 });
    await page.waitForTimeout(2891); // Human-like delay (1x multiplier)

    // Expand 조회 menu (it's collapsed by default - "닫혀있음")
    console.log('[Hometax] Expanding 조회 menu...');
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[2]/ul/li[1]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
        } else {
          throw new Error('조회 element not found');
        }
      });
      console.log('[Hometax] 조회 menu expanded with XPath');
    } catch (error) {
      console.log('[Hometax] XPath failed, trying CSS selector for 조회');
      await page.locator('#grpMenuLi_46_4609050000 > a').click({ timeout: 10000 });
      console.log('[Hometax] 조회 menu expanded with CSS selector');
    }

    // Wait for menu to expand
    await page.waitForTimeout(1000);

    await page.waitForTimeout(2096); // Human-like delay (1x multiplier)

    // Click 월/분기별 목록조회 submenu
    console.log('[Hometax] Clicking 월/분기별 목록조회...');
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[2]/ul/li[1]/ul/li[3]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
        } else {
          throw new Error('월/분기별 element not found');
        }
      });
      console.log('[Hometax] 월/분기별 clicked with XPath');
    } catch (error) {
      console.log('[Hometax] XPath failed, trying ID selector for 월/분기별');
      await page.locator('[id="grpMenuAtag_46_4609050300"]').click({ timeout: 10000 });
      console.log('[Hometax] 월/분기별 clicked with ID selector');
    }

      await page.waitForTimeout(2853); // Human-like delay (1x multiplier)
    } // End of login/navigation block

    // Wait for year select to be available
    await page.waitForTimeout(3000);

    // Use provided year/month or default to current date
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    // 1. Category Selection (Explicitly select Tax or Tax-Exempt)
    const categoryIndex = invoiceCategory === 'tax-exempt' ? 1 : 0;
    console.log(`[Hometax] Selecting ${invoiceCategory === 'tax-exempt' ? '전자계산서(면세)' : '전자세금계산서(과세)'} radio...`);
    const categorySelector = `label.w2radio_label[for="mf_txppWframe_wf01_radioEtxivClsfCd_input_${categoryIndex}"]`;
    await page.locator(categorySelector).click({ timeout: 180000 });
    await page.waitForTimeout(1000);

    // 2. Type Selection (Click radio button for 매출 or 매입)
    const radioIndex = invoiceType === 'sales' ? 0 : 1;
    const radioSelector = `#mf_txppWframe_radio3 > div.w2radio_item.w2radio_item_${radioIndex} > label`;
    console.log(`[Hometax] Selecting ${invoiceType === 'sales' ? '매출' : '매입'}...`);
    await page.locator(radioSelector).click({ timeout: 180000 });
    await page.waitForTimeout(1092); // Human-like delay (1x multiplier)

    // Helper function for year/month selection
    const selectFromRobustXPath = async (subPath: string, valueToSelect: string, type: 'year' | 'month') => {
      return await page.evaluate(({ sub, val, type }) => {
        const roots = ['/html/body/div[1]', '/html/body/div[2]'];
        for (const root of roots) {
          const xpath = `${root}${sub}`;
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const select = result.singleNodeValue as HTMLSelectElement;
          if (select) {
            const options = Array.from(select.options);
            const target = options.find(o => 
              o.value === val || 
              o.value === val + (type === 'year' ? '년' : '월') ||
              o.textContent?.includes(val)
            );
            if (target) {
              select.selectedIndex = target.index;
              select.dispatchEvent(new Event('input', { bubbles: true }));
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
        return false;
      }, { sub: subPath, val: valueToSelect.toString(), type });
    };

    // 3. Year Selection
    console.log(`[Hometax] Selecting year: ${targetYear}...`);
    const yearSubPath = '/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[2]';
    if (await selectFromRobustXPath(yearSubPath, targetYear.toString(), 'year')) {
      console.log('[Hometax] Year selected successfully');
    } else {
      console.error('[Hometax] Failed to select year, trying fallback ID');
      try {
        await page.selectOption('select[id*="sbxYy"], select[id*="Yy"]', targetYear.toString());
      } catch (e) {
        console.error('[Hometax] Fallback year selection also failed');
      }
    }
    await page.waitForTimeout(1000);

    // 4. Month Selection
    console.log(`[Hometax] Selecting month: ${targetMonth}...`);
    const monthSubPath = '/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[3]';
    const monthVal = targetMonth.toString().padStart(2, '0');
    
    if (await selectFromRobustXPath(monthSubPath, monthVal, 'month')) {
      console.log('[Hometax] Month selected successfully');
    } else {
      console.error('[Hometax] Failed to select month, trying fallback ID');
      try {
        await page.selectOption('select[id*="sbxMm"], select[id*="Mm"]', monthVal);
      } catch (e) {
        console.error('[Hometax] Fallback month selection also failed');
      }
    }
    await page.waitForTimeout(1000);

    console.log('[Hometax] Reached tax invoice list page');

    // Click 조회 button
    console.log('[Hometax] Clicking search button...');
    const clickedSearch = await page.evaluate(() => {
      const subPath = '/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[4]/div/span';
      const roots = ['/html/body/div[1]', '/html/body/div[2]'];
      for (const root of roots) {
        const xpath = `${root}${subPath}`;
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
          return true;
        }
      }
      return false;
    });

    if (!clickedSearch) {
      console.log('[Hometax] Search button XPath failed, trying CSS fallback');
      await page.locator('span.btn_search, [id*="btnSearch"]').first().click({ timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);

    // Check for "no data" alert (Check both event flag and DOM)
    console.log('[Hometax] Checking for no-data alert...');
    const noDataAlertExists = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.w2dialog_message');
      for (const alert of alerts) {
        if (alert.textContent?.includes('조회된 내역이 없습니다')) {
          return true;
        }
      }
      return false;
    });

    if (noDataDetected || noDataAlertExists) {
      console.log('[Hometax] 🔔 Dialog detected (via flag or DOM): alert - "조회된 내역이 없습니다." - Skipping download logic');
      // Close the alert (if still present in DOM)
      await page.evaluate(() => {
        const closeButtons = document.querySelectorAll('input[value="확인"]');
        for (const button of closeButtons) {
          (button as HTMLElement).click();
        }
      });

      return {
        success: true,
        businessInfo: {
          businessName: companyName || '사업자명 (조회 실패)',
          representativeName: selectedCertificate.소유자명 || '대표자명 (조회 실패)',
          businessType: companyType || '일반 과세자'
        },
        downloadedFile: undefined // No file downloaded - no data for this period
      };
    }

    console.log('[Hometax] No alert detected - proceeding with download logic');

    // Record timestamp before download to detect if a new file is actually downloaded
    const downloadStartTime = Date.now();
    console.log('[Hometax] Download start time:', downloadStartTime);

    // Click excel download button
    console.log('[Hometax] Starting download with auto-confirmations...');
    const clickedExcel = await page.evaluate((category) => {
      const subTaxExempt = '/div[2]/div/div[1]/div[2]/div[2]/div[6]/div/div/span[1]/input';
      const subTax = '/div[2]/div/div[1]/div[2]/div[3]/div[1]/div/span[1]/input';
      const subPath = category === 'tax-exempt' ? subTaxExempt : subTax;
      
      const roots = ['/html/body/div[1]', '/html/body/div[2]'];
      for (const root of roots) {
        const xpath = `${root}${subPath}`;
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
          return true;
        }
      }
      return false;
    }, invoiceCategory);

    if (!clickedExcel) {
      console.log('[Hometax] Excel button XPath failed, trying CSS fallback');
      await page.locator('input.w2trigger[value="엑셀"], .btn_excel').first().click({ timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(2000);

    // Helper: XPath last() 로 body의 가장 마지막 다이얼로그 div를 동적으로 찾아 클릭
    const clickByLastDivXPath = async (subPath: string) => {
      const xpath = `/html/body/div[last()]/div[2]/div[1]/div/${subPath}`;
      return await page.waitForFunction((xp) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue !== null;
      }, xpath, { timeout: 5000 }).then(async () => {
        await page.evaluate((xp) => {
          const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          (result.singleNodeValue as HTMLElement)?.click();
        }, xpath);
        return true;
      }).catch(() => false);
    };

    // First confirmation: 확인 button (div[1]/div[3]/span[2]/input)
    if (await clickByLastDivXPath('div[1]/div[3]/span[2]/input')) {
      console.log('[Hometax] First confirmation (확인) clicked');
    } else {
      console.log('[Hometax] First confirmation (확인) skipped (not present)');
    }
    await page.waitForTimeout(1000);

    // Second confirmation: 엑셀 button (div[2]/div[3]/span[2]/input)
    if (await clickByLastDivXPath('div[2]/div[3]/span[2]/input')) {
      console.log('[Hometax] Second confirmation (엑셀) clicked');
    } else {
      console.log('[Hometax] Second confirmation (엑셀) skipped (not present)');
    }
    await page.waitForTimeout(1000);

    // Final dialog close: 닫기 button (div[2]/div[2]/input)
    if (await clickByLastDivXPath('div[2]/div[2]/input')) {
      console.log('[Hometax] Close dialog (닫기) clicked');
    } else {
      console.log('[Hometax] Close dialog skipped (not present)');
    }

    console.log('[Hometax] Download completed (confirmations auto-handled)');

    // Wait a bit for download to complete and get the file path
    await page.waitForTimeout(2000);

    // Get downloaded file from the downloads folder
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    const files = fs.readdirSync(downloadsPath);

    // Expected filename pattern based on invoice type (매출 = sales, 매입 = purchase)
    const expectedPattern = invoiceType === 'sales' ? '매출' : '매입';
    console.log(`[Hometax] Looking for file with pattern: ${expectedPattern}`);

    // Find the most recently downloaded file matching the expected type
    // IMPORTANT: Only accept files modified AFTER we clicked the download button
    // IMPORTANT: Exclude cash receipt files (매출내역) when looking for sales invoices
    const recentFile = files
      .filter((f: string) => {
        // Must be Excel file
        if (!f.endsWith('.xls') && !f.endsWith('.xlsx')) return false;

        // If looking for sales (매출), exclude cash receipts (매출내역)
        if (invoiceType === 'sales') {
          return f.includes(expectedPattern) && !f.includes('매출내역');
        }

        // For purchases, just check pattern
        return f.includes(expectedPattern);
      })
      .map((f: string) => ({
        name: f,
        path: path.join(downloadsPath, f),
        time: fs.statSync(path.join(downloadsPath, f)).mtime.getTime()
      }))
      .filter((f: any) => f.time >= downloadStartTime) // Only files created/modified after download started
      .sort((a: any, b: any) => b.time - a.time)[0];

    let downloadedFile = recentFile?.path;
    console.log('[Hometax] Downloaded file:', downloadedFile);

    if (!downloadedFile) {
      console.log(`[Hometax] ⚠️  No new file found matching pattern "${expectedPattern}" - likely no data for this period`);

      return {
        success: true,
        businessInfo: {
          businessName: companyName || '사업자명 (조회 실패)',
          representativeName: selectedCertificate.소유자명 || '대표자명 (조회 실패)',
          businessType: companyType || '일반 과세자'
        },
        downloadedFile: undefined // No file downloaded - no data for this period
      };
    }

    // IMPORTANT: Rename the file immediately to prevent overwriting by subsequent downloads
    // Add timestamp to make filename unique
    // CRITICAL: Detect actual type from Hometax's filename, NOT from our request parameter
    const timestamp = new Date().getTime();
    const fileExt = path.extname(downloadedFile);
    const fileBase = path.basename(downloadedFile, fileExt);

    // Detect actual type from the filename that Hometax gave us
    let actualType: string;
    if (fileBase.includes('매출')) {
      actualType = 'sales';
    } else if (fileBase.includes('매입')) {
      actualType = 'purchase';
    } else {
      // Fallback to requested type if we can't detect
      actualType = invoiceType;
      console.warn(`[Hometax] ⚠️  Could not detect actual type from filename, using requested type: ${invoiceType}`);
    }

    // Verify requested type matches actual type
    if (actualType !== invoiceType) {
      console.error(`[Hometax] ⚠️⚠️⚠️  TYPE MISMATCH! Requested ${invoiceType} but Hometax gave us ${actualType}`);
      console.error(`[Hometax] ⚠️⚠️⚠️  This means the radio button is clicking the WRONG option!`);
    }

    const newFileName = `${fileBase}_${targetYear}${targetMonth.toString().padStart(2, '0')}_${actualType}_${invoiceCategory}_${timestamp}${fileExt}`;
    const newFilePath = path.join(downloadsPath, newFileName);
    fs.renameSync(downloadedFile, newFilePath);
    downloadedFile = newFilePath;
    console.log('[Hometax] Renamed to prevent overwriting:', downloadedFile);

    return {
      success: true,
      businessInfo: {
        businessName: companyName || '사업자명 (조회 실패)',
        representativeName: selectedCertificate.소유자명 || '대표자명 (조회 실패)',
        businessType: companyType || '일반 과세자'
      },
      downloadedFile
    };

  } catch (error) {
    console.error('[Hometax] Connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Download cash receipts (현금영수증) for current week
 * Uses the already-open browser from connectToHometax(), or opens new browser if needed
 */
export async function downloadCashReceipts(
  selectedCertificate: any,
  certificatePassword: string
): Promise<{ success: boolean; downloadedFile?: string; error?: string }> {
  try {
    console.log('[Hometax] Starting cash receipt download...');

    let page = globalPage;
    let context = globalContext;

    // Check if already logged in
    const alreadyLoggedIn = page && context && await page.evaluate(() => {
      const url = window.location.href;
      return url.includes('hometax.go.kr');
    }).catch(() => false);

    let companyName = '';

    if (!alreadyLoggedIn || !page || !context) {
      // Need to login first - reuse login logic from connectToHometax
      console.log('[Hometax] Not logged in, need to login first...');
      return {
        success: false,
        error: 'Must be logged in first. Call connectToHometax() before downloadCashReceipts()'
      };
    }

    // Navigate to 전자세금계산서 menu (same starting point)
    console.log('[Hometax] Navigating to tax menu...');
    await page.waitForTimeout(3000);
    await page.locator('[id="mf_wfHeader_wq_uuid_358"]').click({ timeout: 180000 });
    await page.waitForTimeout(2891);

    // Expand 가맹점 매출 조회 menu (li[7] instead of li[2])
    console.log('[Hometax] Expanding 가맹점 매출 조회 menu...');
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[7]/ul/li[1]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
        } else {
          throw new Error('가맹점 매출 조회 element not found');
        }
      });
      console.log('[Hometax] 가맹점 매출 조회 menu expanded with XPath');
    } catch (error) {
      console.log('[Hometax] XPath failed, trying CSS selector');
      await page.locator('#grpMenuLi_46_4606010000 > a').click({ timeout: 10000 });
      console.log('[Hometax] 가맹점 매출 조회 menu expanded with CSS selector');
    }

    await page.waitForTimeout(1000);

    // Click 현금영수증 매출내역 조회 submenu
    console.log('[Hometax] Clicking 현금영수증 매출내역 조회...');
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[7]/ul/li[1]/ul/li[1]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
        } else {
          throw new Error('현금영수증 매출내역 조회 element not found');
        }
      });
      console.log('[Hometax] 현금영수증 매출내역 조회 clicked with XPath');
    } catch (error) {
      console.log('[Hometax] XPath failed, trying ID selector');
      await page.locator('[id="grpMenuAtag_46_4606010100"]').click({ timeout: 10000 });
      console.log('[Hometax] 현금영수증 매출내역 조회 clicked with ID selector');
    }

    await page.waitForTimeout(3000);

    // Click 주별 tab (auto-selects current week)
    console.log('[Hometax] Clicking 주별 tab...');
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[2]/div/ul/li[2]/div[1]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) {
          element.click();
        } else {
          throw new Error('주별 tab not found');
        }
      });
      console.log('[Hometax] 주별 tab clicked with XPath');
    } catch (error) {
      console.log('[Hometax] XPath failed, trying CSS selector');
      await page.locator('#mf_txppWframe_tabControl1_UTECRCB057_tab_tabs2_tabHTML').click({ timeout: 10000 });
    }
    await page.waitForTimeout(2000);

    // Click 조회 button
    console.log('[Hometax] Clicking 조회 button...');
    const searchButtonXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[4]/div/div/div/span/input';
    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, searchButtonXPath);
    await page.waitForTimeout(3000);

    // Check for "no data" alert immediately after 조회
    console.log('[Hometax] Checking for no-data alert...');
    const noDataAlertExists = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.w2dialog_message');
      for (const alert of alerts) {
        if (alert.textContent?.includes('조회된 내역이 없습니다')) {
          return true;
        }
      }
      return false;
    });

    if (noDataAlertExists) {
      console.log('[Hometax] 🔔 Dialog detected: alert - "조회된 내역이 없습니다." - Skipping download logic');
      // Close the alert
      await page.evaluate(() => {
        const closeButtons = document.querySelectorAll('input[value="확인"]');
        for (const button of closeButtons) {
          (button as HTMLElement).click();
        }
      });

      return {
        success: true,
        downloadedFile: undefined
      };
    }

    console.log('[Hometax] No alert detected - proceeding with download logic');

    // Record timestamp before download
    const downloadStartTime = Date.now();
    console.log('[Hometax] Download start time:', downloadStartTime);

    // Click 내려받기 button
    console.log('[Hometax] Clicking 내려받기 button...');
    const downloadButtonXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[5]/div[2]/span[2]/input';
    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, downloadButtonXPath);

    // Wait for confirmation dialog
    await page.waitForTimeout(2000);

    // Click confirmation dialog
    const confirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[1]/div[2]/span[2]/input';
    const confirmExists = await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, confirmXPath, { timeout: 5000 }).then(() => true).catch(() => false);

    if (confirmExists) {
      await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        element?.click();
      }, confirmXPath);
      console.log('[Hometax] Confirmation clicked');
    }

    console.log('[Hometax] Cash receipt download completed');

    // Wait for download to complete
    await page.waitForTimeout(2000);

    // Get downloaded file from the downloads folder
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    const files = fs.readdirSync(downloadsPath);

    // Find the most recently downloaded file matching cash receipt pattern
    const expectedPattern = '매출내역';
    console.log(`[Hometax] Looking for file with pattern: ${expectedPattern}`);

    const recentFile = files
      .filter((f: string) => (f.endsWith('.xls') || f.endsWith('.xlsx')) && f.includes(expectedPattern))
      .map((f: string) => ({
        name: f,
        path: path.join(downloadsPath, f),
        time: fs.statSync(path.join(downloadsPath, f)).mtime.getTime()
      }))
      .filter((f: any) => f.time >= downloadStartTime)
      .sort((a: any, b: any) => b.time - a.time)[0];

    let downloadedFile = recentFile?.path;
    console.log('[Hometax] Downloaded file:', downloadedFile);

    if (!downloadedFile) {
      console.log(`[Hometax] ⚠️  No new file found matching pattern "${expectedPattern}"`);
      return {
        success: true,
        downloadedFile: undefined
      };
    }

    // Rename the file to prevent overwriting
    const timestamp = new Date().getTime();
    const fileExt = path.extname(downloadedFile);
    const fileBase = path.basename(downloadedFile, fileExt);
    const newFileName = `${fileBase}_cash_receipt_${timestamp}${fileExt}`;
    const newFilePath = path.join(downloadsPath, newFileName);
    fs.renameSync(downloadedFile, newFilePath);
    downloadedFile = newFilePath;
    console.log('[Hometax] Renamed to prevent overwriting:', downloadedFile);

    return {
      success: true,
      downloadedFile
    };

  } catch (error) {
    console.error('[Hometax] Error downloading cash receipts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Disconnect from Hometax (close browser)
 */
export async function disconnectFromHometax(): Promise<void> {
  try {
    if (globalContext) {
      await globalContext.close();
      globalContext = null;
      globalPage = null;
      pageStack.length = 0;
      console.log('[Hometax] Browser context closed');
    }
  } catch (error) {
    console.error('[Hometax] Error closing browser:', error);
  }
}

/**
 * Get current connection status
 */
export function getHometaxConnectionStatus(): { isConnected: boolean } {
  return {
    isConnected: globalContext !== null && !globalContext.browser()?.isConnected()
  };
}

/**
 * Collect tax invoices (매출/매입) and cash receipts for a business
 * Collects data for both current month and last month, for both sales and purchases (4 downloads total)
 * Also collects current week cash receipts (1 download)
 * Total: 5 downloads
 */
/**
 * Collect tax invoices (매출/매입) and cash receipts for a business for a specific date range
 * Loops through each month in the range and collects data
 */
export async function collectTaxInvoicesInRange(
  certificateData: any,
  certificatePassword: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  onProgress?: (message: string) => void
): Promise<{
  success: boolean;
  downloadedFiles: { year: number; month: number; type: string; category: string; path: string }[];
  error?: string
}> {
  const downloadedFiles: { year: number; month: number; type: string; category: string; path: string }[] = [];

  try {
    console.log(`[Hometax] Starting tax invoice collection from ${startYear}-${startMonth} to ${endYear}-${endMonth}`);

    // Generate list of year-month pairs to collect
    const targetMonths: { year: number; month: number }[] = [];
    let currYear = startYear;
    let currMonth = startMonth;

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      targetMonths.push({ year: currYear, month: currMonth });
      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }

    console.log(`[Hometax] Target months to collect:`, targetMonths);

    for (let i = 0; i < targetMonths.length; i++) {
        const { year, month } = targetMonths[i];
        const progressPrefix = `(${i + 1}/${targetMonths.length}) [${year}-${month.toString().padStart(2, '0')}]`;

        if (onProgress) onProgress(`${progressPrefix} 매출 전자세금계산서 수집 중...`);
        // 1. 매출 과세
        const sTax = await connectToHometax(certificateData, certificatePassword, 'sales', 'tax', year, month);
        if (sTax.success && sTax.downloadedFile) {
            downloadedFiles.push({ year, month, type: 'sales', category: 'tax', path: sTax.downloadedFile });
        }

        if (onProgress) onProgress(`${progressPrefix} 매입 전자세금계산서 수집 중...`);
        // 2. 매입 과세
        const pTax = await connectToHometax(certificateData, certificatePassword, 'purchase', 'tax', year, month);
        if (pTax.success && pTax.downloadedFile) {
            downloadedFiles.push({ year, month, type: 'purchase', category: 'tax', path: pTax.downloadedFile });
        }

        if (onProgress) onProgress(`${progressPrefix} 매출 전자계산서(면세) 수집 중...`);
        // 3. 매출 면세
        const sExempt = await connectToHometax(certificateData, certificatePassword, 'sales', 'tax-exempt', year, month);
        if (sExempt.success && sExempt.downloadedFile) {
            downloadedFiles.push({ year, month, type: 'sales', category: 'tax-exempt', path: sExempt.downloadedFile });
        }

        if (onProgress) onProgress(`${progressPrefix} 매입 전자계산서(면세) 수집 중...`);
        // 4. 매입 면세
        const pExempt = await connectToHometax(certificateData, certificatePassword, 'purchase', 'tax-exempt', year, month);
        if (pExempt.success && pExempt.downloadedFile) {
            downloadedFiles.push({ year, month, type: 'purchase', category: 'tax-exempt', path: pExempt.downloadedFile });
        }
    }

    // Cash receipts are handled slightly differently in the UI (weekly), but here we can try to download for current month if it's in range
    const now = new Date();
    if (endYear === now.getFullYear() && endMonth === (now.getMonth() + 1)) {
        if (onProgress) onProgress(`현금영수증 내역 수집 중...`);
        const cashRes = await downloadCashReceipts(certificateData, certificatePassword);
        if (cashRes.success && cashRes.downloadedFile) {
            downloadedFiles.push({ year: endYear, month: endMonth, type: 'cash-receipt', category: 'none', path: cashRes.downloadedFile });
        }
    }

    return {
      success: true,
      downloadedFiles
    };

  } catch (error) {
    console.error('[Hometax] Error in collective range collection:', error);
    return {
      success: false,
      downloadedFiles,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    try {
      console.log('[Hometax] Closing browser after range collection...');
      await disconnectFromHometax();
    } catch (cleanupError) {
      console.error('[Hometax] Failed to close browser:', cleanupError);
    }
  }
}

/**
 * Collect tax invoices (매출/매입) and cash receipts for a business
 * Collects data for both current month and last month, for both sales and purchases (4 downloads total)
 * Also collects current week cash receipts (1 download)
 * Total: 5 downloads
 */
export async function collectTaxInvoices(
  certificateData: any,
  certificatePassword: string
): Promise<{
  success: boolean;
  thisMonthSalesFile?: string;
  lastMonthSalesFile?: string;
  thisMonthPurchaseFile?: string;
  lastMonthPurchaseFile?: string;
  thisMonthTaxExemptSalesFile?: string;
  lastMonthTaxExemptSalesFile?: string;
  thisMonthTaxExemptPurchaseFile?: string;
  lastMonthTaxExemptPurchaseFile?: string;
  cashReceiptFile?: string;
  error?: string
}> {
    // Re-use the range collection for simplicity (current and last month)
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    let lastYear = thisYear;
    let lastMonth = thisMonth - 1;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastYear = thisYear - 1;
    }

    const result = await collectTaxInvoicesInRange(certificateData, certificatePassword, lastYear, lastMonth, thisYear, thisMonth);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    const files = result.downloadedFiles;
    const findFile = (y: number, m: number, t: string, c: string) =>
        files.find(f => f.year === y && f.month === m && f.type === t && f.category === c)?.path;

    return {
      success: true,
      thisMonthSalesFile: findFile(thisYear, thisMonth, 'sales', 'tax'),
      lastMonthSalesFile: findFile(lastYear, lastMonth, 'sales', 'tax'),
      thisMonthPurchaseFile: findFile(thisYear, thisMonth, 'purchase', 'tax'),
      lastMonthPurchaseFile: findFile(lastYear, lastMonth, 'purchase', 'tax'),
      thisMonthTaxExemptSalesFile: findFile(thisYear, thisMonth, 'sales', 'tax-exempt'),
      lastMonthTaxExemptSalesFile: findFile(lastYear, lastMonth, 'sales', 'tax-exempt'),
      thisMonthTaxExemptPurchaseFile: findFile(thisYear, thisMonth, 'purchase', 'tax-exempt'),
      lastMonthTaxExemptPurchaseFile: findFile(lastYear, lastMonth, 'purchase', 'tax-exempt'),
      cashReceiptFile: files.find(f => f.type === 'cash-receipt')?.path
    };
}

