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
      console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
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
  year?: number,
  month?: number
): Promise<HometaxConnectionResult & { downloadedFile?: string }> {
  try {
    console.log('[Hometax] Logging in with selected certificate...');

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
        console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
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

      // Scrape company name from main page (not in iframe)
      console.log('[Hometax] Scraping company name...');
      const companyNameXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[2]/div/span[1]';

      companyName = await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        return element?.textContent?.trim() || '';
      }, companyNameXPath);

      console.log('[Hometax] Company name:', companyName);

      // Scrape company type (법인, etc.) from main page (not in iframe)
      console.log('[Hometax] Scraping company type...');
      const companyTypeXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span';

      companyType = await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        return element?.textContent?.trim() || '';
      }, companyTypeXPath);

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

    // Select year from dropdown (works both for fresh login and already logged in)
    console.log(`[Hometax] Selecting year: ${targetYear}...`);
    const yearXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[2]';

    // Wait for year select to exist
    await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, yearXPath, { timeout: 180000 }).catch(() => console.log('[Hometax] Year select wait timed out'));

    await page.evaluate(({ xpath, yearToSelect }) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const select = result.singleNodeValue as HTMLSelectElement;
      if (select) {
        const yearString = yearToSelect.toString();
        console.log('[Hometax] Setting year to:', yearString);
        console.log('[Hometax] Available options:', Array.from(select.options).map(o => `"${o.value}"`));

        // Find and click the option instead of setting value
        const option = Array.from(select.options).find(o => o.value === yearString || o.value === yearString + '년');
        if (option) {
          select.selectedIndex = option.index;
          // Trigger native events that Hometax expects
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Hometax] Year selected:', select.value);
        } else {
          console.error('[Hometax] Year option not found for:', yearString);
        }
      } else {
        console.error('[Hometax] Year select element not found');
      }
    }, { xpath: yearXPath, yearToSelect: targetYear });
    await page.waitForTimeout(1000);

    // Select month from dropdown (works both for fresh login and already logged in)
    console.log(`[Hometax] Selecting month: ${targetMonth}...`);
    const monthXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[3]';

    await page.evaluate(({ xpath, monthToSelect }) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const select = result.singleNodeValue as HTMLSelectElement;
      if (select) {
        const monthString = monthToSelect.toString().padStart(2, '0');
        console.log('[Hometax] Setting month to:', monthString);
        console.log('[Hometax] Available options:', Array.from(select.options).map(o => `"${o.value}"`));

        // Find and click the option (try both "03" and "03월" formats)
        const option = Array.from(select.options).find(o => o.value === monthString || o.value === monthString + '월');
        if (option) {
          select.selectedIndex = option.index;
          // Trigger native events that Hometax expects
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Hometax] Month selected:', select.value);
        } else {
          console.error('[Hometax] Month option not found for:', monthString);
        }
      } else {
        console.error('[Hometax] Month select element not found');
      }
      }, { xpath: monthXPath, monthToSelect: targetMonth });
      await page.waitForTimeout(1000);

    // Click radio button for 매출 or 매입
    const radioIndex = invoiceType === 'sales' ? 0 : 1;
    const radioSelector = `#mf_txppWframe_radio3 > div.w2radio_item.w2radio_item_${radioIndex} > label`;
    console.log(`[Hometax] Selecting ${invoiceType === 'sales' ? '매출' : '매입'}...`);
    await page.locator(radioSelector).click({ timeout: 180000 });
    await page.waitForTimeout(1092); // Human-like delay (1x multiplier)

    console.log('[Hometax] Reached tax invoice list page');

    // Click 조회 button
    console.log('[Hometax] Clicking search button...');
    const searchButtonXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[4]/div/span';
    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, searchButtonXPath);
    await page.waitForTimeout(3000);

    // Click excel download button and handle confirmations automatically
    console.log('[Hometax] Starting download with auto-confirmations...');
    const excelButtonXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[3]/div[1]/div/span[1]';
    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, excelButtonXPath);

    // Wait for and auto-click first confirmation (skip if doesn't exist - no data case)
    const firstConfirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[1]/div[3]/span[2]/input';
    const firstConfirmExists = await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, firstConfirmXPath, { timeout: 5000 }).then(() => true).catch(() => false);

    if (firstConfirmExists) {
      await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        element?.click();
      }, firstConfirmXPath);
      console.log('[Hometax] First confirmation clicked');
    } else {
      console.log('[Hometax] First confirmation skipped (not present - likely no data)');
    }

    // Wait for and auto-click second confirmation (skip if doesn't exist - no data case)
    const secondConfirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[2]/div[3]/span[2]/input';
    const secondConfirmExists = await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, secondConfirmXPath, { timeout: 5000 }).then(() => true).catch(() => false);

    if (secondConfirmExists) {
      await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        element?.click();
      }, secondConfirmXPath);
      console.log('[Hometax] Second confirmation clicked');
    } else {
      console.log('[Hometax] Second confirmation skipped (not present - likely no data)');
    }

    // Wait for and auto-close confirmation dialog (skip if doesn't exist - no data case)
    const closeDialogXPath = '/html/body/div[6]/div[2]/div[1]/div/div[2]/div[2]/input';
    const closeDialogExists = await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, closeDialogXPath, { timeout: 5000 }).then(() => true).catch(() => false);

    if (closeDialogExists) {
      await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        element?.click();
      }, closeDialogXPath);
      console.log('[Hometax] Close dialog clicked');
    } else {
      console.log('[Hometax] Close dialog skipped (not present - likely no data)');
    }

    console.log('[Hometax] Download completed (confirmations auto-handled)');

    // Wait a bit for download to complete and get the file path
    await page.waitForTimeout(2000);

    // Get downloaded file from the downloads folder
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    const files = fs.readdirSync(downloadsPath);

    // Find the most recently downloaded file (매출 or 매입)
    const recentFile = files
      .filter((f: string) => f.endsWith('.xls') || f.endsWith('.xlsx'))
      .map((f: string) => ({
        name: f,
        path: path.join(downloadsPath, f),
        time: fs.statSync(path.join(downloadsPath, f)).mtime.getTime()
      }))
      .sort((a: any, b: any) => b.time - a.time)[0];

    const downloadedFile = recentFile?.path;
    console.log('[Hometax] Downloaded file:', downloadedFile);

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
 * Collect tax invoices (매출/매입) for a business
 * Collects data for both current month and last month, for both sales and purchases (4 downloads total)
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
  error?: string
}> {
  try {
    console.log('[Hometax] Starting tax invoice collection for current and last month...');

    // Calculate current and last month
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

    let lastYear = thisYear;
    let lastMonth = thisMonth - 1;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastYear = thisYear - 1;
    }

    console.log(`[Hometax] Target months - This: ${thisYear}-${thisMonth.toString().padStart(2, '0')}, Last: ${lastYear}-${lastMonth.toString().padStart(2, '0')}`);
    console.log('[Hometax] ==================== Starting 4-part collection ====================');

    // 1. Collect this month 매출 (sales)
    console.log('[Hometax] ▶ (1/4) Collecting this month 매출...');
    const thisMonthSalesResult = await connectToHometax(certificateData, certificatePassword, 'sales', thisYear, thisMonth);
    if (!thisMonthSalesResult.success) {
      return { success: false, error: thisMonthSalesResult.error };
    }
    const thisMonthSalesFile = thisMonthSalesResult.downloadedFile;
    console.log('[Hometax] ✓ (1/4) Completed:', thisMonthSalesFile);

    // 2. Collect last month 매출 (sales)
    console.log('[Hometax] ▶ (2/4) Collecting last month 매출...');
    const lastMonthSalesResult = await connectToHometax(certificateData, certificatePassword, 'sales', lastYear, lastMonth);
    if (!lastMonthSalesResult.success) {
      return { success: false, error: lastMonthSalesResult.error };
    }
    const lastMonthSalesFile = lastMonthSalesResult.downloadedFile;
    console.log('[Hometax] ✓ (2/4) Completed:', lastMonthSalesFile);

    // 3. Collect this month 매입 (purchases)
    console.log('[Hometax] ▶ (3/4) Collecting this month 매입...');
    const thisMonthPurchaseResult = await connectToHometax(certificateData, certificatePassword, 'purchase', thisYear, thisMonth);
    if (!thisMonthPurchaseResult.success) {
      return { success: false, error: thisMonthPurchaseResult.error };
    }
    const thisMonthPurchaseFile = thisMonthPurchaseResult.downloadedFile;
    console.log('[Hometax] ✓ (3/4) Completed:', thisMonthPurchaseFile);

    // 4. Collect last month 매입 (purchases)
    console.log('[Hometax] ▶ (4/4) Collecting last month 매입...');
    const lastMonthPurchaseResult = await connectToHometax(certificateData, certificatePassword, 'purchase', lastYear, lastMonth);
    if (!lastMonthPurchaseResult.success) {
      return { success: false, error: lastMonthPurchaseResult.error };
    }
    const lastMonthPurchaseFile = lastMonthPurchaseResult.downloadedFile;
    console.log('[Hometax] ✓ (4/4) Completed:', lastMonthPurchaseFile);

    console.log('[Hometax] ==================== ✅ All 4 collections completed! ====================');
    return {
      success: true,
      thisMonthSalesFile,
      lastMonthSalesFile,
      thisMonthPurchaseFile,
      lastMonthPurchaseFile
    };

  } catch (error) {
    console.error('[Hometax] Error collecting tax invoices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
