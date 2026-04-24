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
      companyName = await page!.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        return element?.textContent?.trim() || '';
      }, companyNameXPath).catch(() => '');

      const companyTypeXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span';
      companyType = await page!.evaluate((xpath) => {
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
    await page!.waitForTimeout(3000);

    // Use provided year/month or default to current date
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    // 1. Category Selection (Explicitly select Tax or Tax-Exempt)
    const categoryIndex = invoiceCategory === 'tax-exempt' ? 1 : 0;
    console.log(`[Hometax] Selecting ${invoiceCategory === 'tax-exempt' ? '전자계산서(면세)' : '전자세금계산서(과세)'} radio...`);
    const categorySelector = `label.w2radio_label[for="mf_txppWframe_wf01_radioEtxivClsfCd_input_${categoryIndex}"]`;
    await page!.locator(categorySelector).click({ timeout: 180000 });
    await page!.waitForTimeout(1000);

    // 2. Type Selection (Click radio button for 매출 or 매입)
    const radioIndex = invoiceType === 'sales' ? 0 : 1;
    const radioSelector = `#mf_txppWframe_radio3 > div.w2radio_item.w2radio_item_${radioIndex} > label`;
    console.log(`[Hometax] Selecting ${invoiceType === 'sales' ? '매출' : '매입'}...`);
    await page!.locator(radioSelector).click({ timeout: 180000 });
    await page!.waitForTimeout(1092); // Human-like delay (1x multiplier)

    // Helper function for year/month selection
    const selectFromRobustXPath = async (subPath: string, valueToSelect: string, type: 'year' | 'month') => {
      return await page!.evaluate(({ sub, val, type }) => {
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
        await page!.selectOption('select[id*="sbxYy"], select[id*="Yy"]', targetYear.toString());
      } catch (e) {
        console.error('[Hometax] Fallback year selection also failed');
      }
    }
    await page!.waitForTimeout(1000);

    // 4. Month Selection
    console.log(`[Hometax] Selecting month: ${targetMonth}...`);
    const monthSubPath = '/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[3]';
    const monthVal = targetMonth.toString().padStart(2, '0');
    
    if (await selectFromRobustXPath(monthSubPath, monthVal, 'month')) {
      console.log('[Hometax] Month selected successfully');
    } else {
      console.error('[Hometax] Failed to select month, trying fallback ID');
      try {
        await page!.selectOption('select[id*="sbxMm"], select[id*="Mm"]', monthVal);
      } catch (e) {
        console.error('[Hometax] Fallback month selection also failed');
      }
    }
    await page!.waitForTimeout(1000);

    console.log('[Hometax] Reached tax invoice list page');

    // Click 조회 button
    console.log('[Hometax] Clicking search button...');
    const clickedSearch = await page!.evaluate(() => {
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
      await page!.locator('span.btn_search, [id*="btnSearch"]').first().click({ timeout: 10000 }).catch(() => {});
    }
    await page!.waitForTimeout(3000);

    // Check for "no data" alert (Check both event flag and DOM)
    console.log('[Hometax] Checking for no-data alert...');
    const noDataAlertExists = await page!.evaluate(() => {
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
      await page!.evaluate(() => {
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
    const clickedExcel = await page!.evaluate((category) => {
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
      await page!.locator('input.w2trigger[value="엑셀"], .btn_excel').first().click({ timeout: 10000 }).catch(() => {});
    }
    await page!.waitForTimeout(2000);

    // Helper: XPath last() 로 body의 가장 마지막 다이얼로그 div를 동적으로 찾아 클릭
    const clickByLastDivXPath = async (subPath: string) => {
      const xpath = `/html/body/div[last()]/div[2]/div[1]/div/${subPath}`;
      return await page!.waitForFunction((xp) => {
        const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue !== null;
      }, xpath, { timeout: 5000 }).then(async () => {
        await page!.evaluate((xp) => {
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
    await page!.waitForTimeout(1000);

    // Second confirmation: 엑셀 button (div[2]/div[3]/span[2]/input)
    if (await clickByLastDivXPath('div[2]/div[3]/span[2]/input')) {
      console.log('[Hometax] Second confirmation (엑셀) clicked');
    } else {
      console.log('[Hometax] Second confirmation (엑셀) skipped (not present)');
    }
    await page!.waitForTimeout(1000);

    // Final dialog close: 닫기 button (div[2]/div[2]/input)
    if (await clickByLastDivXPath('div[2]/div[2]/input')) {
      console.log('[Hometax] Close dialog (닫기) clicked');
    } else {
      console.log('[Hometax] Close dialog skipped (not present)');
    }

    console.log('[Hometax] Download completed (confirmations auto-handled)');

    // Wait a bit for download to complete and get the file path
    await page!.waitForTimeout(2000);

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
    await page!.waitForTimeout(3000);
    await page!.locator('[id="mf_wfHeader_wq_uuid_358"]').click({ timeout: 180000 });
    await page!.waitForTimeout(2891);

    // Expand 가맹점 매출 조회 menu (li[7] instead of li[2])
    console.log('[Hometax] Expanding 가맹점 매출 조회 menu...');
    try {
      await page!.evaluate(() => {
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
      await page!.locator('#grpMenuLi_46_4606010000 > a').click({ timeout: 10000 });
      console.log('[Hometax] 가맹점 매출 조회 menu expanded with CSS selector');
    }

    await page!.waitForTimeout(1000);

    // Click 현금영수증 매출내역 조회 submenu
    console.log('[Hometax] Clicking 현금영수증 매출내역 조회...');
    try {
      await page!.evaluate(() => {
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
      await page!.locator('[id="grpMenuAtag_46_4606010100"]').click({ timeout: 10000 });
      console.log('[Hometax] 현금영수증 매출내역 조회 clicked with ID selector');
    }

    await page!.waitForTimeout(3000);

    // Click 주별 tab (auto-selects current week)
    console.log('[Hometax] Clicking 주별 tab...');
    try {
      await page!.evaluate(() => {
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
      await page!.locator('#mf_txppWframe_tabControl1_UTECRCB057_tab_tabs2_tabHTML').click({ timeout: 10000 });
    }
    await page!.waitForTimeout(2000);

    // Click 조회 button
    console.log('[Hometax] Clicking 조회 button...');
    const searchButtonXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[4]/div/div/div/span/input';
    await page!.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, searchButtonXPath);
    await page!.waitForTimeout(3000);

    // Check for "no data" alert immediately after 조회
    console.log('[Hometax] Checking for no-data alert...');
    const noDataAlertExists = await page!.evaluate(() => {
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
      await page!.evaluate(() => {
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
    await page!.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, downloadButtonXPath);

    // Wait for confirmation dialog
    await page!.waitForTimeout(2000);

    // Click confirmation dialog
    const confirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[1]/div[2]/span[2]/input';
    const confirmExists = await page!.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, confirmXPath, { timeout: 5000 }).then(() => true).catch(() => false);

    if (confirmExists) {
      await page!.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        element?.click();
      }, confirmXPath);
      console.log('[Hometax] Confirmation clicked');
    }

    console.log('[Hometax] Cash receipt download completed');

    // Wait for download to complete
    await page!.waitForTimeout(2000);

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

/** Hometax calendar text fields usually expect `YYYY.MM.DD` (e.g. w2input date). */
function formatHometaxCalendarDate(y: number, m: number, d: number): string {
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/**
 * Inclusive year/month range → start = first day of start month, end = last day of end month
 * (same idea as {@link collectTaxInvoicesInRange} month list).
 */
function hometaxGojiDateRangeStrings(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): { start: string; end: string } {
  const start = formatHometaxCalendarDate(startYear, startMonth, 1);
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const end = formatHometaxCalendarDate(endYear, endMonth, lastDay);
  return { start, end };
}

/**
 * Set 고지내역 query period (시작 / 종료).
 * Start: <input id="mf_txppWframe_idx_strtDt_input" /> — XPath:
 * /html/body/div[1]/div[2]/div/div/div/div[2]/div[1]/table/tbody/tr/td[4]/div/div[1]/div[1]/input
 * End: <input id="mf_txppWframe_idx_endDt_input" /> (symmetric to start).
 */
async function setGojiNaeYeokDateRange(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): Promise<{ success: boolean; error?: string }> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  const { start, end } = hometaxGojiDateRangeStrings(
    startYear,
    startMonth,
    endYear,
    endMonth
  );
  try {
    console.log('[Hometax] Setting 고지내역 date range:', start, '–', end);
    const startLoc = page.locator('#mf_txppWframe_idx_strtDt_input');
    const endLoc = page.locator('#mf_txppWframe_idx_endDt_input');
    await startLoc.click({ timeout: 180000 });
    await startLoc.fill(start, { timeout: 180000 });
    await page.waitForTimeout(400);
    await endLoc.click({ timeout: 180000 });
    await endLoc.fill(end, { timeout: 180000 });
    await page.waitForTimeout(500);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] setGojiNaeYeokDateRange error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download tax bills (납부 고지서) from Hometax for each month in the inclusive range.
 * Placeholder — requires active session; automation not yet implemented.
 * Signature mirrors {@link collectTaxInvoicesInRange}.
 */
export async function downloadTaxBills(
  _certificateData: any,
  _certificatePassword: string,
  _startYear: number,
  _startMonth: number,
  _endYear: number,
  _endMonth: number,
  _onProgress?: (message: string) => void
): Promise<{
  success: boolean;
  downloadedFiles: { year: number; month: number; type: string; category: string; path: string }[];
  cards?: any[];
  error?: string;
}> {
  try {
    // 0. Ensure we are connected/logged in
    if (!globalPage) {
      if (_onProgress) _onProgress('홈택스 접속 및 로그인 중...');
      const conn = await connectToHometax(_certificateData, _certificatePassword, 'sales', 'tax', _startYear, _startMonth);
      if (!conn.success) {
        return { success: false, downloadedFiles: [], error: conn.error || 'Failed to connect to Hometax' };
      }
    }

    if (_onProgress) {
      _onProgress('홈화면으로 이동 중...');
    }
    const home = await goHome();
  if (!home.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: home.error || 'Failed to navigate to Hometax home',
    };
  }

  if (_onProgress) {
    _onProgress('전체 메뉴 여는 중...');
  }
  const totalMenu = await openTotalMenu();
  if (!totalMenu.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: totalMenu.error || 'Failed to open total menu',
    };
  }

  if (_onProgress) {
    _onProgress('납부·고지·환급 메뉴로 이동 중...');
  }
  const pnr = await goToPaymentNoticeRefundMenu();
  if (!pnr.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: pnr.error || 'Failed to open 납부·고지·환급 menu',
    };
  }

  if (_onProgress) {
    _onProgress('고지내역으로 이동 중...');
  }
  const goji = await goToGojiNaeYeok();
  if (!goji.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: goji.error || 'Failed to open 고지내역',
    };
  }

  if (_onProgress) {
    _onProgress('조회 기간 설정 중...');
  }
  const dates = await setGojiNaeYeokDateRange(
    _startYear,
    _startMonth,
    _endYear,
    _endMonth
  );
  if (!dates.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: dates.error || 'Failed to set query date range',
    };
  }

  if (_onProgress) {
    _onProgress('조회 중...');
  }
  const search = await clickGojiNaeYeokSearch();
  if (!search.success) {
    return {
      success: false,
      downloadedFiles: [],
      error: search.error || 'Failed to run 조회',
    };
  }

  if (_onProgress) {
    _onProgress('고지 내역 분석 중...');
  }

  const allCards: any[] = [];
  let hasNextPage = true;
  let pageNum = 1;

  while (hasNextPage) {
    console.log(`[Hometax] Scraping page ${pageNum}...`);
    const scrapRes = await scrapeTaxBillCards();

    if (!scrapRes.success) {
      return {
        success: false,
        downloadedFiles: [],
        error:
          scrapRes.error ||
          `Failed to scrape tax bill cards on page ${pageNum}`,
      };
    }

    allCards.push(...scrapRes.cards);

    // Check for "Next" (다음) pagination button
    const nextButton = globalPage!.locator('#mf_txppWframe_btn_pgl_navi_right');
    const isVisible = await nextButton.isVisible();
    const isDisabled = await nextButton.isDisabled();

    // In Hometax, visibility: hidden or style="display: none" is often used for the last page
    const isHiddenOrDisabled = await nextButton
      .evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        return (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          el.getAttribute('aria-hidden') === 'true' ||
          (el as HTMLInputElement).disabled
        );
      })
      .catch(() => true);

    if (isVisible && !isDisabled && !isHiddenOrDisabled) {
      console.log(`[Hometax] Clicking next page button...`);
      await nextButton.click();
      await globalPage!.waitForTimeout(2000); // Wait for next page content to load
      pageNum++;
    } else {
      hasNextPage = false;
    }
  }

    console.log(
      `[Hometax] Total scraped ${allCards.length} cards across ${pageNum} pages.`,
    );

    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    const downloadedFiles: {
      year: number;
      month: number;
      type: string;
      category: string;
      path: string;
    }[] = [];

  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i];
    if (!card.canView || !card.viewButtonId) {
      console.log(`[Hometax] Skipping card ${i + 1}: ${card.title} (Cannot view)`);
      continue;
    }

    if (_onProgress) {
      _onProgress(`고지서 다운로드 중 (${i + 1}/${allCards.length}): ${card.title}`);
    }

    try {
      const context = globalContext;
      if (!context) throw new Error('No active browser context');

      console.log(`[Hometax] Opening tax bill: ${card.title}`);

      // 1. Wait for the new page event
      const pagePromise = context.waitForEvent('page');

      // 2. Click "열람하기"
      await globalPage!.locator(`#${card.viewButtonId}`).click();

      // 3. Get the new page
      const newPage = await pagePromise;
      await newPage.waitForLoadState('load');
      await newPage.waitForTimeout(3000); // Wait for the report viewer to initialize

      console.log('[Hometax] Tax bill window opened');

      // 4. Find the report frame by searching all frames for the paint div
      console.log('[Hometax] Searching for the report content frame...');
      let reportFrame: any = null;
      
      // Wait a bit for the iframe to at least exist and start loading
      await newPage.waitForTimeout(2000);
      
      const allFrames = newPage.frames();
      console.log(`[Hometax] Found ${allFrames.length} total frames in popup.`);
      
      for (const frame of allFrames) {
        try {
          // Check if this frame has the report paint div
          const paintDiv = await frame.$('.report_paint_div');
          if (paintDiv) {
            reportFrame = frame;
            console.log(`[Hometax] Found report content in frame: ${frame.name() || 'unnamed'} (${frame.url()})`);
            break;
          }
        } catch (e) {
          // Cross-origin frames might throw; skip them
        }
      }

      if (!reportFrame) {
        console.log('[Hometax] Fallback: searching for iframe by title/name...');
        const iframeLocator = newPage.locator('iframe[title*="report"], iframe[name*="reportFrame"], iframe[id*="reportFrame"]').first();
        try {
          const handle = await iframeLocator.elementHandle();
          if (handle) {
            reportFrame = await handle.contentFrame();
          }
        } catch (e) {
          console.warn('[Hometax] Could not get frame handle');
        }
      }

      if (!reportFrame) throw new Error('Could not locate report iframe');

      // 5. Wait for the report to actually RENDER (not just the progress bar)
      console.log('[Hometax] Waiting for report content to render (svg/text)...');
      try {
        // Wait for the .report_paint_div to contain an svg or at least one text span
        // The progress bar is usually div.report_progress
        await reportFrame.waitForSelector('.report_paint_div svg, .report_paint_div span', { 
          state: 'attached', 
          timeout: 45000 
        });
        // Extra buffer for full rendering
        await newPage.waitForTimeout(2000);
      } catch (e) {
        console.warn('[Hometax] Warning: Timed out waiting for SVG/Span in report_paint_div. Content might be missing.');
      }

      // 6. Capture the report content as a raw HTML file.
      console.log('[Hometax] Capturing report as raw HTML...');
      const timestamp = Date.now();
      const filename = `TaxBill_${card.title.replace(/\s+/g, '_')}_${timestamp}.html`;
      const filePath = path.join(downloadsPath, filename);

      const htmlContent = await (reportFrame as any).evaluate(() => {
        // The user specifically mentioned /html/body/div/div/div[2]
        // In the ClipReport viewer, this is typically the report_paint_div.
        const paintDiv = document.querySelector('.report_paint_div') as HTMLElement;
        
        // If we found the paint div, use it. Otherwise try the XPath.
        if (paintDiv) {
          return paintDiv.outerHTML;
        }

        const contentEl = document.evaluate('/html/body/div/div/div[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        return contentEl ? contentEl.outerHTML : document.body.innerHTML;
      });

      fs.writeFileSync(filePath, htmlContent);
      console.log(`[Hometax] Tax bill saved: ${filePath}`);

      // 6.5 Extract detailed information from the report page itself
      console.log('[Hometax] Extracting detailed data from the report page...');
      const reportData = await (reportFrame as any).evaluate(() => {
        const spans = Array.from(document.querySelectorAll('.report_paint_div span[aria-label]')) as HTMLElement[];
        
        // Sort by vertical position first, then horizontal to get logical reading order
        const sortedItems = spans.map(span => {
          const style = window.getComputedStyle(span);
          const top = parseFloat(style.top) || 0;
          const left = parseFloat(style.left) || 0;
          return {
            text: (span.getAttribute('aria-label') || '').trim(),
            top,
            left
          };
        })
        .filter(item => item.text.length > 0)
        .sort((a, b) => {
          // Group by "lines" within 5 pixels
          if (Math.abs(a.top - b.top) < 5) {
            return a.left - b.left;
          }
          return a.top - b.top;
        });

        const allTexts = sortedItems.map(item => item.text);

        // Helper to parse Korean dates like "2022년 04월 25일" to "2022-04-25"
        const parseDate = (text: string) => {
          const m = text.match(/(\d{4})[년\.]\s*(\d{1,2})[월\.]\s*(\d{1,2})[일]?/);
          if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
          return text;
        };

        // Helper to parse numbers like "1,540" to 1540
        const parseNum = (text: string) => {
          const num = text.replace(/[^0-9]/g, '');
          return num ? parseInt(num, 10) : 0;
        };

        // Try to identify key-value pairs or structured data
        const extracted: Record<string, any> = {};

        // Pattern-based extraction with refined logic
        const patterns = [
          // Basic Info
          { key: 'attribution_period', marker: '이 납부고지서는 (', offset: 1 },
          { key: 'attribution_tax_item', marker: ')에 귀속되는(', offset: 1 },
          { key: 'notice_type', marker: ')에 대한 것으로 납세의무 성립', offset: 1 },
          { key: 'attribution_year', marker: '연도는 (', offset: 1 },
          { key: 'business_name', marker: '상   호\n(성   명)', offset: 1 },
          { key: 'business_reg_no', marker: '사업자등록번호\n(주민등록번호)', offset: 1 },
          { key: 'business_address', marker: '사업장\n(주 소)', offset: 1 },
          
          { key: 'prev_period_tax_paid', marker: '① 직전기과세기간납부세액은', offset: 1, type: 'num' },
          { key: 'calculated_tax_amount', marker: '③ 산출세액은', offset: 1, type: 'num' },
          { key: 'total_notice_amount', marker: '⑥ 고지세액은', offset: 1, type: 'num' },
          
          { key: 'class_code', marker: '분류기호', offset: 5, instance: 1 },
          { key: 'imposition_ym', marker: '부과연월', offset: 5, instance: 1 },
          { key: 'decision_type', marker: '결정구분', offset: 5, instance: 1 },
          { key: 'tax_item_code', marker: '세목', offset: 5, instance: 1 },
          { key: 'issue_number', marker: '발행번호', offset: 5, instance: 1 },
          
          { key: 'accounting_year', marker: '회계연도', offset: 1, instance: 1 },
          { key: 'tax_year', marker: '과세연도', offset: 1, instance: 1 },
          
          { key: 'collection_account_no', marker: '수입징수관\n계좌번호', offset: 1 },
          { key: 'virtual_account', marker: '가상계좌 (23:00 까지', offset: 3 }, // Adjusting offset based on likely DOM structure
          { key: 'payment_deadline', marker: '납 부 기 한', offset: 1, type: 'date' },
          { key: 'amount_due', marker: '금   액', offset: 1, type: 'num' },
          { key: 'issue_date', marker: '세 무 서 장 (인)', offset: -1, type: 'date' }
        ];

        // Track seen counts for labels that appear multiple times
        const seenCounts: Record<string, number> = {};

        for (let j = 0; j < sortedItems.length; j++) {
          const current = sortedItems[j].text;
          
          // Daily late fee extraction
          if (current.includes('매 1일마다')) {
            const m = current.match(/\(([\d,]+)\)원의/);
            if (m) extracted['daily_late_fee_amount'] = parseNum(m[1]);
          }

          // Refined "납기경과" handling for Until (까지) and From (부터)
          if (current === '납기경과') {
            if (j + 1 < sortedItems.length) {
              const next = sortedItems[j + 1].text;
              const dateMatch = next.match(/(\d{4}\.\d{2}\.\d{2})/);
              if (dateMatch && j + 2 < sortedItems.length) {
                const amount = parseNum(sortedItems[j + 2].text);
                const cleanDate = dateMatch[1].replace(/\./g, '-');
                if (next.includes('까지')) {
                  extracted['late_payment_until_date'] = cleanDate;
                  extracted['late_payment_until_amount'] = amount;
                } else if (next.includes('부터')) {
                  extracted['late_payment_from_date'] = cleanDate;
                  extracted['late_payment_from_amount'] = amount;
                }
              }
            }
          }

          for (const p of patterns) {
            if (current === p.marker || (p.marker.includes(':') && current.includes(p.marker))) {
              seenCounts[p.marker] = (seenCounts[p.marker] || 0) + 1;
              
              // Only take the requested instance (usually the first one, the Taxpayer copy)
              if (p.instance && seenCounts[p.marker] !== p.instance) continue;

              if (j + (p.offset || 1) < sortedItems.length) {
                let val = sortedItems[j + (p.offset || 1)].text;
                
                if (p.type === 'num') extracted[p.key] = parseNum(val);
                else if (p.type === 'date') extracted[p.key] = parseDate(val);
                else extracted[p.key] = val;
              }
            }
          }
        }

        // Extract "Payment by Date" chart
        const paymentChart: any[] = [];
        for (let j = 0; j < sortedItems.length; j++) {
          const text = sortedItems[j].text;
          // Look for "YYYY.MM.DD" format
          const dateMatch = text.match(/^(\d{4}\.\d{2}\.\d{2})$/);
          if (dateMatch && j + 1 < sortedItems.length) {
            const amountText = sortedItems[j + 1].text;
            if (amountText.match(/^[\d,]+$/)) {
              paymentChart.push({
                date: text.replace(/\./g, '-'),
                amount: parseNum(amountText)
              });
            }
          }
        }
        if (paymentChart.length > 0) extracted['payment_by_date_chart'] = paymentChart;

        // Extract "Tax Items Breakdown" (the table between deadline and total)
        const breakdown: any[] = [];
        let startIdx = -1;
        let endIdx = -1;
        
        // Find the second "납 부 기 한" (or after the first one's value) and the "계" total
        for (let k = 0; k < allTexts.length; k++) {
          if (allTexts[k] === '납 부 기 한') {
            startIdx = k + 2; // Skip label and date value
          }
          if (startIdx !== -1 && allTexts[k] === '계') {
            endIdx = k;
            break;
          }
        }

        if (startIdx !== -1 && endIdx !== -1) {
          for (let k = startIdx; k < endIdx; k += 2) {
            if (k + 1 < endIdx) {
              const label = allTexts[k];
              const val = allTexts[k + 1];
              if (val.match(/^[\d,]+$/)) {
                breakdown.push({
                  item: label,
                  amount: parseNum(val)
                });
              }
            }
          }
        }
        if (breakdown.length > 0) extracted['tax_items_breakdown'] = breakdown;

        return {
          fullTextList: allTexts,
          identifiedFields: extracted
        };
      });

      // Attach the extracted data to the card object (Now using a specific key for detailed bill data)
      card.scrapedBillData = reportData;
      card.htmlPath = filePath;

      // Add to downloaded files list
      const yearMatch = card.title.match(/(\d{4})년/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

      downloadedFiles.push({
        year,
        month: 0, // General year/period
        type: 'tax-bill',
        category: 'notice',
        path: filePath,
      });

      // 7. Close the new page
      await newPage.close();
      await globalPage!.waitForTimeout(2000); // Buffer between captures
    } catch (error) {
      console.error(`[Hometax] Failed to capture card ${i + 1}:`, error);
    }
  }

    return {
      success: true,
      downloadedFiles,
      cards: allCards,
    };
  } catch (error) {
    console.error('[Hometax] Error in downloadTaxBills:', error);
    return {
      success: false,
      downloadedFiles: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // If we started a session just for this, or if we want to be safe,
    // we can close here. But typically we follow the pattern of the caller.
    // For now, let's close to match the invoices logic.
    await disconnectFromHometax().catch(() => {});
  }
}

/**
 * Click the header Hometax logo (국세청 홈택스) to return to the home screen.
 * Target: <a id="mf_wfHeader_hdGroup001" class="w2group logo_hometax ico_apr" ... title="국세청 홈택스">
 */
export async function goHome(): Promise<{ success: boolean; error?: string }> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  try {
    console.log('[Hometax] Clicking home logo (#mf_wfHeader_hdGroup001)...');
    await page.locator('#mf_wfHeader_hdGroup001').click({ timeout: 180000 });
    await page.waitForTimeout(1500);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] goHome error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Open the "Total Menu" (hamburger button) from the header.
 * Target: <div id="mf_wfHeader_wq_uuid_358" class="w2group bar">...</div>
 * XPath: /html/body/div[1]/div[1]/header/div[2]/div/ul/li[3]/a/div
 */
export async function openTotalMenu(): Promise<{
  success: boolean;
  error?: string;
}> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  try {
    console.log('[Hometax] Opening total menu (#mf_wfHeader_wq_uuid_358)...');
    await page.locator('#mf_wfHeader_wq_uuid_358').click({ timeout: 180000 });
    await page.waitForTimeout(1500);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] openTotalMenu error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Open the "납부·고지·환급" (Payment, Notice, Refund) top menu from the header.
 * Target: <a title="납부·고지·환급">...</a>
 */
export async function goToPaymentNoticeRefundMenu(): Promise<{
  success: boolean;
  error?: string;
}> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  try {
    console.log('[Hometax] Opening 납부·고지·환급 menu (via title selector)...');
    // Using title selector as IDs like wq_uuid_2241 are dynamic and fragile
    await page.locator('a[title="납부·고지·환급"]').click({ timeout: 180000 });
    await page.waitForTimeout(1500);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] goToPaymentNoticeRefundMenu error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Open "고지내역" (notice / tax-bill list) from the 납부·고지·환급 submenu.
 * Target: <a id="grpMenuAtag_42_4204040000" href="javascript:void(0)">고지내역</a>
 */
export async function goToGojiNaeYeok(): Promise<{
  success: boolean;
  error?: string;
}> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  try {
    console.log('[Hometax] Clicking 고지내역 (#grpMenuAtag_42_4204040000)...');
    await page.locator('#grpMenuAtag_42_4204040000').click({ timeout: 180000 });
    await page.waitForTimeout(1500);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] goToGojiNaeYeok error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Click 조회 (search) on the 고지내역 screen after date range is set.
 * Target: <input type="button" id="mf_txppWframe_btn_search" class="w2trigger" value="조회" />
 * XPath: /html/body/div[1]/div[2]/div/div/div/div[2]/div[2]/input
 */
export async function clickGojiNaeYeokSearch(): Promise<{
  success: boolean;
  error?: string;
}> {
  const page = globalPage;
  if (!page) {
    return { success: false, error: 'No active browser session' };
  }
  try {
    console.log('[Hometax] Clicking 조회 (#mf_txppWframe_btn_search)...');
    await page.locator('#mf_txppWframe_btn_search').click({ timeout: 180000 });
    await page.waitForTimeout(2000);
    return { success: true };
  } catch (error) {
    console.error('[Hometax] clickGojiNaeYeokSearch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Detect each "notice_view" card on the 고지내역 page and find their "열람하기" (View) buttons.
 * This handles the repeating structure seen in the 고지내역 results.
 */
export async function scrapeTaxBillCards(): Promise<{
  success: boolean;
  cards: {
    title: string;
    amount: string;
    status: string;
    viewButtonId: string;
    canView: boolean;
  }[];
  error?: string;
}> {
  const page = globalPage;
  if (!page) {
    return { success: false, cards: [], error: 'No active browser session' };
  }

  try {
    // Wait for either the cards to appear or the "no data" message
    await page.waitForTimeout(2000);

    const cards = await page.locator('div.notice_view').all();
    console.log(`[Hometax] Found ${cards.length} tax bill cards.`);

    const scrapedData = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      // Extract identifying info
      const title = await card
        .locator('.noti_box .lta span')
        .textContent()
        .catch(() => 'Unknown');
      const totalAmount = await card
        .locator('.noti_box .rta strong')
        .textContent()
        .catch(() => '0');
      const status = await card
        .locator('.rta .badge')
        .textContent()
        .catch(() => '');

      // Map all key-value pairs from the list items (noti_list)
      const details: Record<string, string> = {};
      const listItems = await card.locator('.noti_list li').all();
      
      for (const item of listItems) {
        const label = await item.locator('.lta span').textContent().catch(() => '');
        const value = await item.locator('.rta').textContent().catch(() => '');
        if (label && label.trim()) {
          details[label.trim()] = value?.trim() || '';
        }
      }

      // Find the specific "열람하기" button in this card
      const viewButton = card.locator('input[value="열람하기"]');
      const isVisible = await viewButton.isVisible();
      const isDisabled = await viewButton.isDisabled();
      const buttonId = (await viewButton.getAttribute('id')) || '';

      scrapedData.push({
        title: title?.trim() || 'Unknown',
        amount: totalAmount?.trim() || '0',
        status: status?.trim() || '',
        details,
        viewButtonId: buttonId,
        canView: isVisible && !isDisabled,
      });
    }

    return { success: true, cards: scrapedData };
  } catch (error) {
    console.error('[Hometax] scrapeTaxBillCards error:', error);
    return {
      success: false,
      cards: [],
      error: error instanceof Error ? error.message : 'Unknown error',
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
  onProgress?: (message: string) => void,
  keepAlive?: boolean
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
    if (!keepAlive) {
      try {
        console.log('[Hometax] Closing browser after range collection...');
        await disconnectFromHometax();
      } catch (cleanupError) {
        console.error('[Hometax] Failed to close browser:', cleanupError);
      }
    } else {
      console.log('[Hometax] keeping browser alive for next step');
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

