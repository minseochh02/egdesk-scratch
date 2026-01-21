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

    // Open certificate login popup
    const newPagePromise = context.waitForEvent('page');
    await page.locator('[id="mf_txppWframe_loginboxFrame_anchor22"]').click();

    // Handle popup
    const newPage = await newPagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    await newPage.waitForLoadState('networkidle').catch(() => {});
    await newPage.waitForTimeout(2000);

    pageStack.push(page);
    page = newPage;
    globalPage = page;

    // Set up dialog handling for new page
    page.on('dialog', async (dialog) => {
      console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
      await dialog.accept();
      console.log('✅ Dialog accepted');
    });

    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.mouse.click(865, 18); // Click at coordinates

    // Popup/tab was closed during recording
    // Wait for current page to close and switch back
    {
      await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

      // Switch back to previous page
      const previousPage = pageStack.pop();
      if (previousPage) {
        page = previousPage;
        globalPage = page;
        console.log('⬅️ Switched back to previous page:', page.url());
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
  certificatePassword: string
): Promise<HometaxConnectionResult> {
  try {
    console.log('[Hometax] Logging in with selected certificate...');

    let page = globalPage;
    let context = globalContext;

    // If browser not initialized, run fetchCertificates flow first
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

      // Open certificate login popup
      const newPagePromise = context.waitForEvent('page');
      await page.locator('[id="mf_txppWframe_loginboxFrame_anchor22"]').click();

      // Handle popup
      const newPage = await newPagePromise;
      await newPage.waitForLoadState('domcontentloaded');
      await newPage.waitForLoadState('networkidle').catch(() => {});
      await newPage.waitForTimeout(2000);

      pageStack.push(page);
      page = newPage;
      globalPage = page;

      // Set up dialog handling for new page
      page.on('dialog', async (dialog) => {
        console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
        await dialog.accept();
        console.log('✅ Dialog accepted');
      });

      await page.waitForTimeout(3000);
      await page.mouse.click(865, 18);

      // Handle popup close
      {
        await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});

        const previousPage = pageStack.pop();
        if (previousPage) {
          page = previousPage;
          globalPage = page;
          console.log('⬅️ Switched back to previous page:', page.url());
        } else {
          const allPages = context.pages();
          page = allPages[0];
          globalPage = page;
        }
      }
    }

    // Click on certificate password input in iframe
    console.log('[Hometax] Clicking certificate password input...');
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').click();
    await page.waitForTimeout(3000); // Human-like delay

    // Fill certificate password in iframe
    console.log('[Hometax] Entering certificate password...');
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').fill(certificatePassword);
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

    // Scrape company name from main page (not in iframe)
    console.log('[Hometax] Scraping company name...');
    const companyNameXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[2]/div/span[1]';

    const companyName = await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      return element?.textContent?.trim() || null;
    }, companyNameXPath);

    console.log('[Hometax] Company name:', companyName);

    // Scrape company type (법인, etc.) from main page (not in iframe)
    console.log('[Hometax] Scraping company type...');
    const companyTypeXPath = '/html/body/div[1]/div[2]/div/div/div[1]/div/div[1]/div[1]/div[1]/div[1]/span';

    const companyType = await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      return element?.textContent?.trim() || null;
    }, companyTypeXPath);

    console.log('[Hometax] Company type:', companyType);

    // TODO: Extract business number from the page

    // Navigate to 전자세금계산서 목록조회 (Electronic Tax Invoice List)
    console.log('[Hometax] Navigating to tax invoice list...');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="mf_wfHeader_wq_uuid_358"]').click();
    await page.waitForTimeout(2891); // Human-like delay (1x multiplier)
    await page.locator('a:has-text("조회") >> nth=184').click();
    await page.waitForTimeout(2096); // Human-like delay (1x multiplier)
    await page.locator('[id="grpMenuAtag_46_4609050300"]').click();
    await page.evaluate(() => {
      const xpath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[1]/dl[2]/dd/div/div/div[1]/label';
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    });

    // Wait for year select to be available
    await page.waitForTimeout(3000);

    // Select year from dropdown
    console.log('[Hometax] Selecting year...');
    const yearXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[2]';

    // Wait for year select to exist
    await page.waitForFunction((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue !== null;
    }, yearXPath, { timeout: 10000 }).catch(() => console.log('[Hometax] Year select wait timed out'));

    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const select = result.singleNodeValue as HTMLSelectElement;
      if (select) {
        const currentYear = new Date().getFullYear().toString();
        console.log('[Hometax] Setting year to:', currentYear);
        console.log('[Hometax] Available options:', Array.from(select.options).map(o => `"${o.value}"`));

        // Find and click the option instead of setting value
        const option = Array.from(select.options).find(o => o.value === currentYear || o.value === currentYear + '년');
        if (option) {
          select.selectedIndex = option.index;
          // Trigger native events that Hometax expects
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Hometax] Year selected:', select.value);
        } else {
          console.error('[Hometax] Year option not found for:', currentYear);
        }
      } else {
        console.error('[Hometax] Year select element not found');
      }
    }, yearXPath);
    await page.waitForTimeout(1000);

    // Select month from dropdown
    console.log('[Hometax] Selecting month...');
    const monthXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[3]';

    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const select = result.singleNodeValue as HTMLSelectElement;
      if (select) {
        const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
        console.log('[Hometax] Setting month to:', currentMonth);
        console.log('[Hometax] Available options:', Array.from(select.options).map(o => `"${o.value}"`));

        // Find and click the option (try both "03" and "03월" formats)
        const option = Array.from(select.options).find(o => o.value === currentMonth || o.value === currentMonth + '월');
        if (option) {
          select.selectedIndex = option.index;
          // Trigger native events that Hometax expects
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[Hometax] Month selected:', select.value);
        } else {
          console.error('[Hometax] Month option not found for:', currentMonth);
        }
      } else {
        console.error('[Hometax] Month select element not found');
      }
    }, monthXPath);
    await page.waitForTimeout(1000);

    await page.waitForTimeout(2853); // Human-like delay (1x multiplier)
    await page.locator('#mf_txppWframe_radio3 > div.w2radio_item.w2radio_item_0 > label').click();
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

    // Click excel download button
    console.log('[Hometax] Clicking excel download button...');
    const excelButtonXPath = '/html/body/div[1]/div[2]/div/div[1]/div[2]/div[3]/div[1]/div/span[1]';
    await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      element?.click();
    }, excelButtonXPath);
    await page.waitForTimeout(2000);

    // First confirmation
    console.log('[Hometax] Clicking first confirmation...');
    const firstConfirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[1]/div[3]/span[2]/input';
    const firstConfirmClicked = await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      if (element) {
        console.log('[Hometax] First confirmation element found:', element);
        element.click();
        return true;
      } else {
        console.error('[Hometax] First confirmation element not found');
        return false;
      }
    }, firstConfirmXPath);
    console.log('[Hometax] First confirmation clicked:', firstConfirmClicked);
    await page.waitForTimeout(2000);

    // Second confirmation
    console.log('[Hometax] Clicking second confirmation...');
    const secondConfirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[2]/div[3]/span[2]/input';
    const secondConfirmClicked = await page.evaluate((xpath) => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;
      if (element) {
        console.log('[Hometax] Second confirmation element found:', element);
        element.click();
        return true;
      } else {
        console.error('[Hometax] Second confirmation element not found');
        return false;
      }
    }, secondConfirmXPath);
    console.log('[Hometax] Second confirmation clicked:', secondConfirmClicked);
    await page.waitForTimeout(2000);

    console.log('[Hometax] Excel download completed');

    return {
      success: true,
      businessInfo: {
        businessName: companyName || '사업자명 (조회 실패)',
        representativeName: selectedCertificate.소유자명 || '대표자명 (조회 실패)',
        businessType: companyType || '일반 과세자'
      }
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
 * Uses saved certificate data to login and navigate to invoice list
 */
export async function collectTaxInvoices(
  certificateData: any,
  certificatePassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Hometax] Starting tax invoice collection...');

    // Reuse connectToHometax flow to login and navigate to invoice list
    const result = await connectToHometax(certificateData, certificatePassword);

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    console.log('[Hometax] Successfully navigated to tax invoice list page');

    // TODO: Download excel files for 매출 and 매입
    // TODO: Parse excel files
    // TODO: Save to database

    return {
      success: true
    };

  } catch (error) {
    console.error('[Hometax] Error collecting tax invoices:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
