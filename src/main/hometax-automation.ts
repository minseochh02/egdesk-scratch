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
let currentProfileDir: string | null = null;
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
    currentProfileDir = profileDir;
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
        '--disable-features=IsolateOrigins,site-per-process,LocalNetworkAccessChecks,PrivateNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults',
        '--allow-running-insecure-content',
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

    // Prepare listener for initial popup BEFORE navigation to avoid race conditions
    console.log('[Hometax] Preparing initial popup listener...');
    const initialPopupPromise = context.waitForEvent('page', { timeout: 30000 }).catch(() => null);

    // Navigate to Hometax with retry logic for transient connection failures
    const hometaxUrl = 'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=index3';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto(hometaxUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
        const currentUrl = page.url();
        if (currentUrl.startsWith('chrome-error://') || currentUrl.startsWith('about:neterror')) {
          throw new Error(`Navigation failed: landed on error page (${currentUrl})`);
        }
        break;
      } catch (navError) {
        console.warn(`[Hometax] Navigation attempt ${attempt}/3 failed:`, navError instanceof Error ? navError.message : navError);
        if (attempt < 3) {
          await page.waitForTimeout(3000);
        } else {
          throw navError;
        }
      }
    }

    // Handle initial popup that appears on page load
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
      } else {
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
 * Login to Hometax using selected certificate and password.
 * Handles browser launch, initial popups, and certificate authentication.
 * Returns company info scraped after login.
 */
export async function loginToHometax(
  selectedCertificate: any,
  certificatePassword: string
): Promise<HometaxConnectionResult> {
  try {
    let page = globalPage;
    let context = globalContext;

    // Check if already logged in
    const alreadyLoggedIn = page && context && await page.evaluate(() => {
      const url = window.location.href;
      // If we are on any page after login (not the login page or error page)
      return url.includes('hometax.go.kr') && !url.includes('menuCd=index3') && !url.includes('ComLoginActn.corp');
    }).catch(() => false);

    let companyName = '';
    let companyType = '';

    if (alreadyLoggedIn) {
      console.log('[Hometax] ✅ Already logged in, scraping company info...');

      // Get company info from page if available
      companyName = await page!.evaluate(() => {
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
      }).catch(() => '');

      companyType = await page!.evaluate(() => {
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
      }).catch(() => '');

      console.log('[Hometax] Company name:', companyName, 'Type:', companyType);
      
      return {
        success: true,
        businessInfo: {
          businessName: companyName || '사업자명',
          representativeName: selectedCertificate.소유자명 || '대표자명',
          businessType: companyType || '일반 과세자'
        }
      };
    }

    // Need to login - either browser not initialized or not logged in
    if (!page || !context) {
      const fetchRes = await fetchCertificates();
      if (!fetchRes.success) return { success: false, error: fetchRes.error };
      page = globalPage!;
      context = globalContext!;
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
              const anchor = row.querySelector('a');
              if (!anchor) return false;
              anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              anchor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            }
            return false;
          }, selectedCertificate.xpath);

          if (certificateClicked) break;
        } catch (error) {
          continue;
        }
      }
    }

    await page.waitForTimeout(3000);
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').click({ timeout: 180000 });
    await page.waitForTimeout(1000);
    await page.frameLocator('[id="dscert"]').locator('[id="input_cert_pw"]').fill(certificatePassword, { timeout: 180000 });
    await page.waitForTimeout(1000);

    // Click submit button in iframe
    {
      const frame = page.frameLocator('[id="dscert"]');
      await frame.locator('body').evaluate((body, coords) => {
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: coords.x, clientY: coords.y });
        document.elementFromPoint(coords.x, coords.y)?.dispatchEvent(clickEvent);
      }, { x: 357, y: 585 });
    }

    await page.waitForTimeout(5000);
    console.log('[Hometax] ✅ Login successful, scraping company info...');

    // Scrape company info
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

    return {
      success: true,
      businessInfo: {
        businessName: companyName || '사업자명',
        representativeName: selectedCertificate.소유자명 || '대표자명',
        businessType: companyType || '일반 과세자'
      }
    };

  } catch (error) {
    console.error('[Hometax] Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Navigate to the Electronic Tax Invoice List page.
 */
export async function navigateToInvoicePage(): Promise<{ success: boolean; error?: string }> {
  const page = globalPage;
  if (!page) return { success: false, error: 'No active browser session' };

  try {
    const alreadyOnPage = await page.evaluate(() => {
      const url = window.location.href;
      return url.includes('grpMenuAtag_46_4609050300') || document.querySelector('#mf_txppWframe_radio3') !== null;
    }).catch(() => false);

    if (alreadyOnPage) return { success: true };

    await page.waitForTimeout(2000);
    await page.locator('#mf_wfHeader_wq_uuid_358').click({ timeout: 180000 });
    await page.waitForTimeout(2000);

    // Expand 조회 menu
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[2]/ul/li[1]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) element.click();
        else throw new Error('조회 element not found');
      });
    } catch (error) {
      await page.locator('#grpMenuLi_46_4609050000 > a').click({ timeout: 10000 }).catch(() => {});
    }

    await page.waitForTimeout(1000);

    // Click 월/분기별 목록조회
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[2]/ul/li[1]/ul/li[3]/a';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element) element.click();
        else throw new Error('월/분기별 element not found');
      });
    } catch (error) {
      await page.locator('#grpMenuAtag_46_4609050300').click({ timeout: 10000 }).catch(() => {});
    }

    await page.waitForTimeout(3000);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Connect to Hometax and download invoice
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
    noDataDetected = false;
    const loginResult = await loginToHometax(selectedCertificate, certificatePassword);
    if (!loginResult.success) return loginResult;

    const navResult = await navigateToInvoicePage();
    if (!navResult.success) return { success: false, error: navResult.error };

    const page = globalPage!;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    // Category Selection
    const categoryIndex = invoiceCategory === 'tax-exempt' ? 1 : 0;
    await page.locator(`label.w2radio_label[for="mf_txppWframe_wf01_radioEtxivClsfCd_input_${categoryIndex}"]`).click();
    await page.waitForTimeout(1000);

    // Type Selection
    const radioIndex = invoiceType === 'sales' ? 0 : 1;
    await page.locator(`#mf_txppWframe_radio3 > div.w2radio_item.w2radio_item_${radioIndex} > label`).click();
    await page.waitForTimeout(1000);

    // Year/Month Selection
    const selectFromRobustXPath = async (subPath: string, val: string, type: 'year' | 'month') => {
      return await page.evaluate(({ sub, val, type }) => {
        const roots = ['/html/body/div[1]', '/html/body/div[2]'];
        for (const root of roots) {
          const xpath = `${root}${sub}`;
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const select = result.singleNodeValue as HTMLSelectElement;
          if (select) {
            const target = Array.from(select.options).find(o => o.value === val || o.value === val + (type === 'year' ? '년' : '월') || o.textContent?.includes(val));
            if (target) {
              select.selectedIndex = target.index;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
        return false;
      }, { sub: subPath, val, type });
    };

    await selectFromRobustXPath('/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[2]', targetYear.toString(), 'year');
    await page.waitForTimeout(500);
    await selectFromRobustXPath('/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[2]/dl[2]/dd/div/select[3]', targetMonth.toString().padStart(2, '0'), 'month');
    await page.waitForTimeout(1000);

    // Search
    await page.evaluate(() => {
      const subPath = '/div[2]/div/div[1]/div[2]/div[2]/div[3]/div/div[4]/div/span';
      const roots = ['/html/body/div[1]', '/html/body/div[2]'];
      for (const root of roots) {
        const result = document.evaluate(`${root}${subPath}`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) { (result.singleNodeValue as HTMLElement).click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(3000);

    if (noDataDetected) return { success: true, businessInfo: loginResult.businessInfo };

    // Download
    const downloadStartTime = Date.now();
    await page.evaluate((category) => {
      const subPath = category === 'tax-exempt' ? '/div[2]/div/div[1]/div[2]/div[2]/div[6]/div/div/span[1]/input' : '/div[2]/div/div[1]/div[2]/div[3]/div[1]/div/span[1]/input';
      const roots = ['/html/body/div[1]', '/html/body/div[2]'];
      for (const root of roots) {
        const result = document.evaluate(`${root}${subPath}`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) { (result.singleNodeValue as HTMLElement).click(); return true; }
      }
      return false;
    }, invoiceCategory);
    await page.waitForTimeout(2000);

    const clickByLastDivXPath = async (subPath: string) => {
      const xpath = `/html/body/div[last()]/div[2]/div[1]/div/${subPath}`;
      try {
        await page.waitForFunction((xp) => document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue !== null, xpath, { timeout: 5000 });
        await page.evaluate((xp) => (document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement)?.click(), xpath);
        return true;
      } catch (e) { return false; }
    };

    await clickByLastDivXPath('div[1]/div[3]/span[2]/input');
    await page.waitForTimeout(1000);
    await clickByLastDivXPath('div[2]/div[3]/span[2]/input');
    await page.waitForTimeout(1000);
    await clickByLastDivXPath('div[2]/div[2]/input');
    await page.waitForTimeout(2000);

    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    const expectedPattern = invoiceType === 'sales' ? '매출' : '매입';
    const files = fs.readdirSync(downloadsPath);
    const recentFile = files
      .filter(f => (f.endsWith('.xls') || f.endsWith('.xlsx')) && f.includes(expectedPattern) && (invoiceType !== 'sales' || !f.includes('매출내역')))
      .map(f => ({ name: f, path: path.join(downloadsPath, f), time: fs.statSync(path.join(downloadsPath, f)).mtime.getTime() }))
      .filter(f => f.time >= downloadStartTime)
      .sort((a, b) => b.time - a.time)[0];

    if (!recentFile) return { success: true, businessInfo: loginResult.businessInfo };

    const timestamp = new Date().getTime();
    const fileExt = path.extname(recentFile.path);
    const fileBase = path.basename(recentFile.path, fileExt);
    const actualType = fileBase.includes('매출') ? 'sales' : (fileBase.includes('매입') ? 'purchase' : invoiceType);
    const newFileName = `${fileBase}_${targetYear}${targetMonth.toString().padStart(2, '0')}_${actualType}_${invoiceCategory}_${timestamp}${fileExt}`;
    const newFilePath = path.join(downloadsPath, newFileName);
    fs.renameSync(recentFile.path, newFilePath);

    return { success: true, businessInfo: loginResult.businessInfo, downloadedFile: newFilePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Download cash receipts
 */
export async function downloadCashReceipts(selectedCertificate: any, certificatePassword: string): Promise<{ success: boolean; downloadedFile?: string; error?: string }> {
  try {
    const loginResult = await loginToHometax(selectedCertificate, certificatePassword);
    if (!loginResult.success) return { success: false, error: loginResult.error };

    const page = globalPage!;
    await page.waitForTimeout(2000);
    await page.locator('#mf_wfHeader_wq_uuid_358').click({ timeout: 180000 });
    await page.waitForTimeout(2000);

    // Expand 가맹점 매출 조회
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[7]/ul/li[1]/a';
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.click();
      });
    } catch (e) {
      await page.locator('#grpMenuLi_46_4606010000 > a').click({ timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(1000);

    // Click 현금영수증 매출내역 조회
    try {
      await page.evaluate(() => {
        const xpath = '/html/body/div[6]/div[2]/div[1]/div/div/div/div[4]/div[3]/div/div[2]/div[1]/div/div/div/div/ul/li[7]/ul/li[1]/ul/li[1]/a';
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
        if (el) el.click();
      });
    } catch (e) {
      await page.locator('#grpMenuAtag_46_4606010100').click({ timeout: 10000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);

    // Click 주별 tab
    await page.locator('#mf_txppWframe_tabControl1_UTECRCB057_tab_tabs2_tabHTML').click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Click 조회
    const downloadStartTime = Date.now();
    await page.evaluate(() => {
      const xpath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[4]/div/div/div/span/input';
      (document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement)?.click();
    });
    await page.waitForTimeout(3000);

    // Click 내려받기
    await page.evaluate(() => {
      const xpath = '/html/body/div[1]/div[2]/div/div/div[1]/div[3]/div[5]/div[2]/span[2]/input';
      (document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement)?.click();
    });
    await page.waitForTimeout(2000);

    // Confirm
    const confirmXPath = '/html/body/div[6]/div[2]/div[1]/div/div[1]/div[2]/span[2]/input';
    try {
      await page.waitForFunction(xp => document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue !== null, confirmXPath, { timeout: 5000 });
      await page.evaluate(xp => (document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement)?.click(), confirmXPath);
    } catch (e) {}
    await page.waitForTimeout(2000);

    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');
    const files = fs.readdirSync(downloadsPath);
    const recentFile = files
      .filter(f => (f.endsWith('.xls') || f.endsWith('.xlsx')) && f.includes('매출내역'))
      .map(f => ({ name: f, path: path.join(downloadsPath, f), time: fs.statSync(path.join(downloadsPath, f)).mtime.getTime() }))
      .filter(f => f.time >= downloadStartTime)
      .sort((a, b) => b.time - a.time)[0];

    if (!recentFile) return { success: true };

    const timestamp = new Date().getTime();
    const fileExt = path.extname(recentFile.path);
    const fileBase = path.basename(recentFile.path, fileExt);
    const newFilePath = path.join(downloadsPath, `${fileBase}_cash_receipt_${timestamp}${fileExt}`);
    fs.renameSync(recentFile.path, newFilePath);

    return { success: true, downloadedFile: newFilePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/** Hometax calendar text fields usually expect `YYYY.MM.DD` */
function formatHometaxCalendarDate(y: number, m: number, d: number): string {
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

function hometaxGojiDateRangeStrings(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const start = formatHometaxCalendarDate(startYear, startMonth, 1);
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const end = formatHometaxCalendarDate(endYear, endMonth, lastDay);
  return { start, end };
}

async function setGojiNaeYeokDateRange(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const page = globalPage;
  if (!page) return { success: false, error: 'No active browser session' };
  const { start, end } = hometaxGojiDateRangeStrings(startYear, startMonth, endYear, endMonth);
  try {
    const startLoc = page.locator('#mf_txppWframe_idx_strtDt_input');
    const endLoc = page.locator('#mf_txppWframe_idx_endDt_input');
    await startLoc.fill(start, { timeout: 180000 });
    await page.waitForTimeout(400);
    await endLoc.fill(end, { timeout: 180000 });
    await page.waitForTimeout(500);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Download tax bills
 */
export async function downloadTaxBills(
  _certificateData: any,
  _certificatePassword: string,
  _startYear: number,
  _startMonth: number,
  _endYear: number,
  _endMonth: number,
  _onProgress?: (message: string) => void
): Promise<{ success: boolean; downloadedFiles: any[]; cards?: any[]; error?: string }> {
  try {
    if (_onProgress) _onProgress('홈택스 접속 및 로그인 확인 중...');
    const loginResult = await loginToHometax(_certificateData, _certificatePassword);
    if (!loginResult.success) return { success: false, downloadedFiles: [], error: loginResult.error };

    const page = globalPage!;
    await goHome();
    await openTotalMenu();
    await goToPaymentNoticeRefundMenu();
    await goToGojiNaeYeok();
    await setGojiNaeYeokDateRange(_startYear, _startMonth, _endYear, _endMonth);
    await clickGojiNaeYeokSearch();

    const allCards: any[] = [];
    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      const scrapRes = await scrapeTaxBillCards();
      if (!scrapRes.success) break;
      allCards.push(...scrapRes.cards);
      const nextButton = page.locator('#mf_txppWframe_btn_pgl_navi_right');
      if (await nextButton.isVisible() && !(await nextButton.isDisabled())) {
        await nextButton.click();
        await page.waitForTimeout(2000);
        pageNum++;
      } else hasNextPage = false;
    }

    const downloadedFiles: any[] = [];
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax');

    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i];
      if (!card.canView || !card.viewButtonId) continue;
      if (_onProgress) _onProgress(`고지서 다운로드 중 (${i + 1}/${allCards.length}): ${card.title}`);

      try {
        const pagePromise = globalContext!.waitForEvent('page');
        await page.locator(`#${card.viewButtonId}`).click();
        const newPage = await pagePromise;
        await newPage.waitForLoadState('load');
        await newPage.waitForTimeout(5000);

        let reportFrame: any = null;
        for (const frame of newPage.frames()) {
          if (await frame.$('.report_paint_div')) { reportFrame = frame; break; }
        }

        if (reportFrame) {
          const timestamp = Date.now();
          const filePath = path.join(downloadsPath, `TaxBill_${card.title.replace(/\s+/g, '_')}_${timestamp}.html`);
          const htmlContent = await reportFrame.evaluate(() => document.querySelector('.report_paint_div')?.outerHTML || document.body.innerHTML);
          fs.writeFileSync(filePath, htmlContent);
          
          const reportData = await reportFrame.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('.report_paint_div span[aria-label]')) as HTMLElement[];
            const sortedItems = spans.map(s => ({ text: (s.getAttribute('aria-label') || '').trim(), top: parseFloat(s.style.top) || 0, left: parseFloat(s.style.left) || 0 }))
              .filter(i => i.text.length > 0)
              .sort((a, b) => Math.abs(a.top - b.top) < 5 ? a.left - b.left : a.top - b.top);
            return { fullTextList: sortedItems.map(i => i.text) };
          });
          
          card.scrapedBillData = reportData;
          card.htmlPath = filePath;
          downloadedFiles.push({ year: _startYear, month: 0, type: 'tax-bill', category: 'notice', path: filePath });
        }
        await newPage.close();
      } catch (e) { console.error(e); }
    }

    return { success: true, downloadedFiles, cards: allCards };
  } catch (error) {
    return { success: false, downloadedFiles: [], error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    await disconnectFromHometax();
  }
}

export async function goHome() {
  const page = globalPage;
  if (page) { await page.locator('#mf_wfHeader_hdGroup001').click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1000); }
  return { success: true };
}

export async function openTotalMenu() {
  const page = globalPage;
  if (page) { await page.locator('#mf_wfHeader_wq_uuid_358').click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1000); }
  return { success: true };
}

export async function goToPaymentNoticeRefundMenu() {
  const page = globalPage;
  if (page) { await page.locator('a[title="납부·고지·환급"]').click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1000); }
  return { success: true };
}

export async function goToGojiNaeYeok() {
  const page = globalPage;
  if (page) { await page.locator('#grpMenuAtag_42_4204040000').click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(1000); }
  return { success: true };
}

export async function clickGojiNaeYeokSearch() {
  const page = globalPage;
  if (page) { await page.locator('#mf_txppWframe_btn_search').click({ timeout: 10000 }).catch(() => {}); await page.waitForTimeout(2000); }
  return { success: true };
}

export async function scrapeTaxBillCards() {
  const page = globalPage;
  if (!page) return { success: false, cards: [] };
  const cards = await page.locator('div.notice_view').all();
  const scrapedData = [];
  for (const card of cards) {
    const title = await card.locator('.noti_box .lta span').textContent().catch(() => 'Unknown');
    const viewButton = card.locator('input[value="열람하기"]');
    const buttonId = await viewButton.getAttribute('id').catch(() => '');
    scrapedData.push({ title: title?.trim(), viewButtonId: buttonId, canView: await viewButton.isVisible() && !(await viewButton.isDisabled()) });
  }
  return { success: true, cards: scrapedData };
}

export async function disconnectFromHometax() {
  if (globalContext) { await globalContext.close(); globalContext = null; globalPage = null; }
  if (currentProfileDir && fs.existsSync(currentProfileDir)) { fs.rmSync(currentProfileDir, { recursive: true, force: true }); currentProfileDir = null; }
}

export function getHometaxConnectionStatus() {
  return { isConnected: globalContext !== null };
}

export async function collectTaxInvoicesInRange(
  certificateData: any,
  certificatePassword: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  onProgress?: (message: string) => void,
  keepAlive?: boolean
): Promise<{ success: boolean; downloadedFiles: any[]; error?: string }> {
  const downloadedFiles: any[] = [];
  try {
    const targetMonths: any[] = [];
    let cy = startYear, cm = startMonth;
    while (cy < endYear || (cy === endYear && cm <= endMonth)) {
      targetMonths.push({ year: cy, month: cm });
      if (++cm > 12) { cm = 1; cy++; }
    }
    for (const { year, month } of targetMonths) {
      for (const type of ['sales', 'purchase'] as const) {
        for (const cat of ['tax', 'tax-exempt'] as const) {
          const res = await connectToHometax(certificateData, certificatePassword, type, cat, year, month);
          if (res.success && res.downloadedFile) downloadedFiles.push({ year, month, type, category: cat, path: res.downloadedFile });
        }
      }
    }
    const now = new Date();
    if (endYear === now.getFullYear() && endMonth === (now.getMonth() + 1)) {
      const res = await downloadCashReceipts(certificateData, certificatePassword);
      if (res.success && res.downloadedFile) downloadedFiles.push({ year: endYear, month: endMonth, type: 'cash-receipt', category: 'none', path: res.downloadedFile });
    }
    return { success: true, downloadedFiles };
  } finally {
    if (!keepAlive) await disconnectFromHometax();
  }
}

export async function collectTaxInvoices(certificateData: any, certificatePassword: string, keepAlive?: boolean) {
  const now = new Date();
  const ty = now.getFullYear(), tm = now.getMonth() + 1;
  let ly = ty, lm = tm - 1;
  if (lm === 0) { lm = 12; ly--; }
  const res = await collectTaxInvoicesInRange(certificateData, certificatePassword, ly, lm, ty, tm, undefined, keepAlive);
  if (!res.success) return { success: false, error: res.error };
  const find = (y: number, m: number, t: string, c: string) => res.downloadedFiles.find(f => f.year === y && f.month === m && f.type === t && f.category === c)?.path;
  return {
    success: true,
    thisMonthSalesFile: find(ty, tm, 'sales', 'tax'),
    lastMonthSalesFile: find(ly, lm, 'sales', 'tax'),
    thisMonthPurchaseFile: find(ty, tm, 'purchase', 'tax'),
    lastMonthPurchaseFile: find(ly, lm, 'purchase', 'tax'),
    thisMonthTaxExemptSalesFile: find(ty, tm, 'sales', 'tax-exempt'),
    lastMonthTaxExemptSalesFile: find(ly, lm, 'sales', 'tax-exempt'),
    thisMonthTaxExemptPurchaseFile: find(ty, tm, 'purchase', 'tax-exempt'),
    lastMonthTaxExemptPurchaseFile: find(ly, lm, 'purchase', 'tax-exempt'),
    cashReceiptFile: res.downloadedFiles.find(f => f.type === 'cash-receipt')?.path
  };
}
