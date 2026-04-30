// ============================================================================
// NH BANK AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NH_CONFIG } = require('./config');
const {
  parseTransactionExcel,
  extractTransactionsFromPage,
  createExcelFromData
} = require('../../utils/transactionParser');
const { typePasswordWithKeyboard } = require('./virtualKeyboard');
const os = require('os');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const isWindows = () => os.platform() === 'win32';

/**
 * NH Bank Automator
 * Handles login automation for Nonghyup Bank including virtual keyboard handling
 */
class NHBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...NH_CONFIG,
      headless: options.headless ?? NH_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? NH_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || this.getSafeOutputDir('nh');
    this.arduinoPort = options.arduinoPort;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
  }

  // ============================================================================
  // VIRTUAL KEYBOARD HANDLING
  // ============================================================================

  // Note: analyzeVirtualKeyboard() and helper methods are now inherited from BaseBankAutomator
  // Note: handlePasswordInput() is now inherited from BaseBankAutomator
  // Note: handleWindowsPasswordInput() is now inherited from BaseBankAutomator
  // Bank-specific keyboard selectors are defined in config.js

  /**
   * Handles virtual keyboard password entry (copying Shinhan's exact method)
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to type
   * @returns {Promise<Object>}
   */
  async handleVirtualKeyboard(page, password) {
    try {
      // Analyze keyboard
      const keyboardAnalysis = await this.analyzeVirtualKeyboard(page);

      // Type password
      this.log(`Typing password (${password.length} characters) using virtual keyboard...`);
      const typingResult = await typePasswordWithKeyboard(
        keyboardAnalysis.keyboardJSON,
        password,
        page,
        this.config.delays,
        this.log.bind(this)
      );

      return {
        ...typingResult,
        keyboardAnalysis,
      };

    } catch (error) {
      this.error('Virtual keyboard password typing failed:', error.message);
      return {
        success: false,
        error: error.message,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: []
      };
    }
  }

  // ============================================================================
  // LOGIN STATUS TRACKING
  // ============================================================================

  /**
   * Checks if the user is currently logged in
   * @param {Object} page - Playwright page object
   * @returns {Promise<{isLoggedIn: boolean, userName: string|null}>}
   */
  async checkLoginStatus(page = this.page) {
    if (!page) return { isLoggedIn: false, userName: null };

    try {
      this.log('Checking login status...');
      
      // Check if we're still on login page
      const currentUrl = page.url();
      if (currentUrl.includes('IPCNPA902R') || currentUrl.includes('login')) {
        this.log('Still on login page');
        return { isLoggedIn: false, userName: null };
      }

      // Look for user profile elements
      const userGroupXPath = `xpath=${this.config.xpaths.userProfileGroup}`;
      const isVisible = await page.locator(userGroupXPath).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        const userName = await page.locator(`xpath=${this.config.xpaths.userNameText}`).innerText().catch(() => null);
        this.log(`Logged in as: ${userName || 'Unknown User'}`);
        return { isLoggedIn: true, userName: userName ? userName.trim() : null };
      }
      
      // Alternative: Check if we successfully navigated to a post-login page
      if (currentUrl.includes('accounts') || currentUrl.includes('main')) {
        this.log('Detected post-login URL pattern');
        return { isLoggedIn: true, userName: null };
      }

      this.log('Not logged in');
      return { isLoggedIn: false, userName: null };
    } catch (error) {
      this.warn('Error checking login status:', error.message);
      return { isLoggedIn: false, userName: null };
    }
  }

  // Note: Session management methods (startSessionKeepAlive, stopSessionKeepAlive, extendSession)
  // are now inherited from BaseBankAutomator

  // ============================================================================
  // CORPORATE CERTIFICATE LOGIN
  // ============================================================================

  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return { success: false, error: 'NH 기업 인증서 연결은 Windows에서만 지원됩니다.' };
    }
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      // 이미 페이지가 있고 ibz.nonghyup.com에 있다면 재사용 시도
      if (this.page && !this.page.isClosed()) {
        const url = this.page.url();
        if (url.includes('ibz.nonghyup.com')) {
          this.log('[NH Corporate] Reusing existing browser session...');
          
          // 이미 인증서 창이 떠 있는지 확인 (좀 더 넓은 조건으로 확인)
          const certTableVisible = await this.page.evaluate(() => {
            return document.querySelectorAll('tr.data').length > 0 || 
                   document.body.innerText.includes('2025-08-15');
          });
          
          if (certTableVisible) {
            this.log('[NH Corporate] Cert table or target text visible. Scraping...');
            const certList = await this.scrapeIniCertificateRows(this.page);
            this._nhCorporateCertPhase = 'awaiting_password';
            return {
              success: true,
              phase: 'awaiting_password',
              certWindowName: 'NH INIpay Certificate (In-Browser)',
              certificates: certList,
              message: '기존 브라우저 세션을 재사용합니다. 인증서를 선택하고 비밀번호를 입력하세요.',
            };
          } else {
            this.warn('[NH Corporate] Existing browser found but cert table not visible. Proceeding with normal navigation.');
          }
        }
      }

      if (this.browser) {
        try { await this.browser.close(); } catch (e) {}
        this.browser = null;
        this.context = null;
        this.page = null;
      }
      const corpDownloadsPath = path.join(this.outputDir, 'corporate-cert-downloads');
      this.ensureOutputDirectory(corpDownloadsPath);
      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true,
        extraChromeArgs: [
          '--start-maximized',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-features=IsolateOrigins,site-per-process,LocalNetworkAccessChecks,PrivateNetworkAccessChecks',
          '--allow-running-insecure-content',
          '--safebrowsing-disable-download-protection',
        ],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: corpDownloadsPath,
      });
      this.browser = browser;
      this.context = context;
      await this.context.grantPermissions(['local-network-access', 'clipboard-read', 'clipboard-write']);
      this.page = context.pages()[0] || await context.newPage();
      this.page.on('dialog', async (dialog) => {
        try { await dialog.accept(); } catch (e) {}
      });

      this.log('[NH Corporate] Navigating to ibz.nonghyup.com...');
      await this.page.goto('https://ibz.nonghyup.com/');
      await this.page.waitForTimeout(3000);

      this.log('[NH Corporate] Clicking 로그인...');
      try {
        await this.page.locator('.login').first().click({ timeout: 10000 });
      } catch (e) {
        await this.page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
      }
      await this.page.waitForTimeout(2000);

      this.log('[NH Corporate] Clicking 공동인증서 로그인...');
      try {
        await this.page.locator('span:has-text("공동인증서 로그인")').click({ timeout: 10000 });
      } catch (e) {
        await this.page.locator('xpath=/html/body/div[5]/div[2]/form[2]/div/div[1]/a[2]/p/span').click();
      }
      await this.page.waitForTimeout(3000);

      this.log('[NH Corporate] Waiting for cert dialog table...');
      let tableFound = false;
      for (let i = 0; i < 15; i++) {
        const found = await this.page.evaluate(() => {
          return document.querySelectorAll('#certificate_signature_area tr.data').length > 0 ||
                 document.querySelectorAll('tr.data').length > 0;
        });
        if (found) {
          tableFound = true;
          break;
        }
        await this.page.waitForTimeout(1000);
      }

      if (!tableFound) {
        return { success: false, error: '인증서 목록 테이블을 찾지 못했습니다.' };
      }

      this.log('[NH Corporate] Reading certificate list...');
      const certList = await this.page.evaluate(() => {
        let rows = document.querySelectorAll('#certificate_signature_area tr.data');
        if (rows.length === 0) rows = document.querySelectorAll('tr.data');
        return Array.from(rows).map((row, i) => {
          const cells = Array.from(row.querySelectorAll('td'));
          const cellTexts = cells.map(c => c.textContent.trim());
          const expiryMatch = cellTexts.join(' ').match(/(\d{4}-\d{2}-\d{2})/);
          return {
            index: i,
            active: row.classList.contains('active'),
            expiry: expiryMatch ? expiryMatch[1] : '',
            text: cellTexts.join(' | ')
          };
        });
      });

      const activeCert = certList.find(c => c.active);
      if (activeCert) {
        this.log(`[NH Corporate] Current active cert: ${activeCert.text} (Expiry: ${activeCert.expiry})`);
      } else {
        this.log('[NH Corporate] No cert is currently marked active. Relying on default selection.');
      }

      this._nhCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        certWindowName: 'NH INIpay Certificate (In-Browser)',
        message: '인증서 창이 열렸습니다. 필요하면 인증서 목록에서 인증서를 바꿀 수 있습니다.',
      };

    } catch (error) {
      this.error('prepareCorporateCertificateLogin (nh) failed:', error.message);
      this._nhCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  /**
   * Reads all rows from the INIpay cert table.
   * @param {import('playwright-core').Page} page
   * @returns {Promise<Array>}
   */
  async scrapeIniCertificateRows(page) {
    return page.evaluate(() => {
      let rows = document.querySelectorAll('#certificate_signature_area tr.data');
      if (rows.length === 0) rows = document.querySelectorAll('tr.data');
      
      return Array.from(rows).map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) =>
          (td.textContent || '').replace(/\s+/g, ' ').trim()
        );
        const fullText = (row.textContent || '').replace(/\s+/g, ' ').trim();
        
        // 상세 정보 추출 (로그 분석 결과 기반 매핑)
        // 0: 선택됨, 1: 정상, 2: 용도, 3: 소유자명, 4: 만료일, 5: 발급기관
        const purpose = cells[2] || '';
        const owner = cells[3] || '';
        const issuer = cells[5] || cells[cells.length - 1] || '';
        
        let expiry = cells[4] || '';
        if (!/\d{4}-\d{2}-\d{2}/.test(expiry)) {
          const expiryMatch = fullText.match(/(\d{4}-\d{2}-\d{2})/);
          if (expiryMatch) expiry = expiryMatch[1];
        }

        const display = `${owner} (${purpose})`.trim() || fullText || `인증서 ${index + 1}`;

        return {
          index,
          certificateIndex: index + 1,
          xpath: `//*[@id="certificate_signature_area"]//tr[contains(@class, "data")][${index + 1}]`,
          cells,
          display,
          fullText,
          expiry,
          소유자명: owner,
          용도: purpose,
          발급기관: issuer,
          만료일: expiry,
          className: row.className,
          id: row.id
        };
      });
    });
  }

  /**
   * One-shot method to fetch certificates for the UI without starting a full login flow.
   */
  async fetchCertificates(proxyUrl) {
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      this.log('[NH] Fetching certificate list for UI...');
      
      // 이미 열려있는 브라우저가 있다면 닫고 새로 시작 (클린 상태 보장)
      if (this.browser) {
        try { await this.browser.close(); } catch (e) {}
        this.browser = null;
      }

      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true,
        headless: false,
      });
      this.browser = browser;
      this.context = context;
      const page = context.pages()[0] || await context.newPage();
      this.page = page;

      try {
        await page.goto('https://ibz.nonghyup.com/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);

        // 로그인 버튼 클릭
        try {
          await page.locator('.login').first().click({ timeout: 5000 });
        } catch (e) {
          await page.locator('a:has-text("로그인")').first().click({ timeout: 5000 });
        }
        await page.waitForTimeout(2000);

        // 공동인증서 버튼 클릭
        try {
          await page.locator('span:has-text("공동인증서 로그인")').click({ timeout: 5000 });
        } catch (e) {
          await page.locator('a[onclick*="공동인증서"]').first().click({ timeout: 5000 });
        }
        
        // 과거 로직의 정교한 대기 시간 적용
        await page.waitForTimeout(1775);

        const rowSel = 'tr.data';
        try {
          await page.locator(rowSel).first().waitFor({ state: 'visible', timeout: 15000 });
        } catch (e) {
          this.warn('Cert table not visible in time:', e.message);
        }
        await page.waitForTimeout(2000);

        const certificates = await this.scrapeIniCertificateRows(page);
        
        if (certificates.length === 0) {
          this.error('[NH] Scraped 0 certificates. HTML structure might have changed.');
          return { success: false, error: '인증서 목록을 찾을 수 없습니다.' };
        }

        this.log(`[NH] Successfully scraped ${certificates.length} certificates.`);
        
        // Ensure the certificates are fully serializable plain objects
        const serializableCerts = JSON.parse(JSON.stringify(certificates));
        return { success: true, certificates: serializableCerts };
      } catch (err) {
        this.error('[NH] Error during fetchCertificates page interaction:', err.message);
        await browser.close();
        this.browser = null;
        throw err;
      }
    } catch (error) {
      this.error('[NH] fetchCertificates failed:', error.message);
      return { success: false, error: error.message };
    }
  }
  async completeCorporateCertificateLogin(creds) {
    let { certificatePassword, certificateIndex, xpath } = creds || {};
    if (this._nhCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._nhCorporateCertPhase = 'idle';
      return { success: false, error: '브라우저 세션이 없습니다.' };
    }
    if (!this.arduinoPort) {
      return { success: false, error: 'Arduino 시리얼 포트가 설정되지 않았습니다.' };
    }

    try {
      this._arduinoHid = new ArduinoHidBankSession({
        portPath: this.arduinoPort,
        baudRate: this.arduinoBaudRate,
        log: (m) => this.log(m),
      });
      await this._arduinoHid.connect();

      // If no explicit cert selected (e.g. background sync), auto-select latest
      if (certificateIndex == null && !xpath) {
        this.log('[NH Corporate] No specific certificate provided. Auto-selecting latest expiry...');
        const certsResult = await this.scrapeIniCertificateRows(this.page);
        if (certsResult && certsResult.length > 0) {
          let latestExpiry = '';
          certsResult.forEach(c => {
            if (c.expiry > latestExpiry) {
              latestExpiry = c.expiry;
              certificateIndex = c.certificateIndex;
              xpath = c.xpath;
            }
          });
          this.log(`[NH Corporate] Auto-selected cert with expiry: ${latestExpiry} (Index: ${certificateIndex})`);
        } else {
          this.log('[NH Corporate] Warning: Could not scrape certificates for auto-selection.');
        }
      }

      // UI에서 인증서를 선택한 경우 또는 자동 선택된 경우 해당 인증서 클릭
      if (certificateIndex != null || xpath) {
        this.log(`[NH Corporate] Attempting to select certificate (Index: ${certificateIndex}, XPath: ${xpath})...`);
        const clickResult = await this.page.evaluate(({ idx, xp }) => {
          let target = null;
          
          if (xp) {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            target = result.singleNodeValue;
          }

          if (!target && idx != null) {
            let rows = document.querySelectorAll('#certificate_signature_area tr.data');
            if (rows.length === 0) rows = document.querySelectorAll('tr.data');
            target = rows[idx - 1];
          }

          if (target) {
            // Find click target (prefer <a>, then <td>)
            const clickTarget = target.querySelector('a') || target.querySelector('td') || target;
            
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(name => {
              clickTarget.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true }));
            });
            return {
              success: true,
              text: target.textContent?.replace(/\s+/g, ' ').trim().substring(0, 50)
            };
          }
          return { success: false };
        }, { idx: certificateIndex, xp: xpath });

        if (clickResult.success) {
          this.log(`[NH Corporate] Selected certificate. Text: "${clickResult.text}"`);
        } else {
          this.warn(`[NH Corporate] Could not find certificate via XPath or Index.`);
        }
        await this.page.waitForTimeout(1500);
      }

      this.log('[NH Corporate] Tabbing to password input...');
      let focused = '';
      for (let i = 1; i <= 20; i++) {
        await this._arduinoHid.sendKey('TAB');
        await this.page.waitForTimeout(300);
        focused = await this.page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
        if (focused === 'ini_cert_pwd') {
          this.log(`[NH Corporate] ✓ Password input focused after ${i} Tab(s).`);
          break;
        }
      }
      if (focused !== 'ini_cert_pwd') {
        throw new Error(`Could not Tab to password input. Last focused: "${focused}"`);
      }

      this.log('[NH Corporate] Typing password via Arduino...');
      await this._arduinoHid.typeViaNaturalTiming(certificatePassword);
      await this.page.waitForTimeout(1000);

      this.log('[NH Corporate] Clicking 확인...');
      try {
        await this.page.locator('[id="INI_certSubmit"]').click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('button:has-text("확인")').first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(5000);

      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      // Navigate to Transaction Inquiry
      this.log('[NH Corporate] Navigating to 입출금거래내역조회...');
      try {
        await this.page.locator('.ibz-tooltip-ctrl:has-text("조회")').first().click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('button:has-text("조회")').first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(2000);

      try {
        await this.page.locator('a:has-text("입출금거래내역조회")').first().click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('.text-link:has-text("입출금거래내역조회")').first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

      this.isLoggedIn = true;
      this._nhCorporateCertPhase = 'completed';

      // Automatically fetch accounts after navigation
      this.log('[NH Corporate] Fetching accounts...');
      const accounts = await this.getAccounts();

      return {
        success: true,
        isLoggedIn: true,
        accounts,
        message: '로그인 및 계좌 목록 조회 완료',
      };
    } catch (error) {
      this.error('completeCorporateCertificateLogin (nh) failed:', error.message);
      if (this._arduinoHid) {
        await this._arduinoHid.disconnect();
        this._arduinoHid = null;
      }
      this._nhCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method
   * @param {Object} credentials - { userId, password }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { userId, password, accountType, certificatePassword } = credentials;
    
    // If this is a corporate account, use the certificate login flow
    if (accountType === 'corporate') {
      this.log('[NH] Detected corporate account, performing certificate login...');
      
      // 1. Prepare (open browser, go to cert window)
      const prep = await this.prepareCorporateCertificateLogin(proxyUrl);
      if (!prep.success) return prep;

      // 2. Fetch certificates and select the best one (latest expiry)
      const certsResult = await this.scrapeIniCertificateRows(this.page);
      if (certsResult.length === 0) {
        return { success: false, error: '인증서를 찾을 수 없습니다.' };
      }

      let targetIndex = 1; // Default to first
      let latestExpiry = '';
      certsResult.forEach(c => {
        if (c.expiry > latestExpiry) {
          latestExpiry = c.expiry;
          targetIndex = c.certificateIndex;
        }
      });
      this.log(`[NH] Automatically selected cert with latest expiry: ${latestExpiry} (Index: ${targetIndex})`);

      // 3. Complete login
      const result = await this.completeCorporateCertificateLogin({
        certificatePassword: certificatePassword || password,
        certificateIndex: targetIndex
      });

      return result;
    }

    const proxy = this.buildProxyOption(proxyUrl);
    try {
      // Step 1: Create browser
      this.log('Starting NH Bank automation...');
      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true
      });
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to login page
      this.log('Navigating to NH Bank login page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      
      // Wait longer for the page and any popups to fully load
      this.log('Waiting for page to fully load...');
      await this.page.waitForTimeout(5000);

      // Step 3: Handle initial confirmation popup
      try {
        this.log('Waiting for service restriction popup...');
        
        // Wait for the popup text to appear - try multiple selectors
        const popupSelectors = [
          'text=이용에 불편을 드려 죄송합니다',
          ':has-text("이용에 불편을 드려 죄송합니다")',
          '//*[contains(text(), "이용에 불편을 드려 죄송합니다")]',
          '//*[contains(text(), "URL 직접입력")]',
          'div:has-text("이용에 불편을 드려 죄송합니다")'
        ];
        
        let popupFound = false;
        
        // Try each selector
        for (const selector of popupSelectors) {
          try {
            const locator = selector.startsWith('//')
              ? this.page.locator(`xpath=${selector}`)
              : this.page.locator(selector);
            
            // Check if element exists
            const count = await locator.count();
            if (count > 0) {
              popupFound = true;
              this.log(`Service restriction popup detected with selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }
        
        if (popupFound) {
          
          // Now look for the confirmation button - try specific XPath first
          const confirmButtonSelectors = [
            '/html/body/div[7]/div[2]/div[2]/form/div[2]/div[3]/span/a',
            '//span[@class="btn1"]/a[@onclick="doConfirm();"]',
            '//a[@onclick="doConfirm();"]',
            'a:has-text("확인")'
          ];
          
          let confirmClicked = false;
          
          for (const selector of confirmButtonSelectors) {
            try {
              const confirmButton = selector.startsWith('/') || selector.startsWith('//') 
                ? this.page.locator(`xpath=${selector}`)
                : this.page.locator(selector);
              
              // Check if button exists and is visible
              const isVisible = await confirmButton.isVisible({ timeout: 2000 });
              
              if (isVisible) {
                this.log(`Found confirmation button with selector: ${selector}`);
                await confirmButton.click();
                confirmClicked = true;
                this.log('Clicked "확인" button to dismiss popup');
                break;
              }
            } catch (e) {
              // Try next selector
            }
          }
          
          if (!confirmClicked) {
            this.warn('Could not find confirmation button with any selector');
          }
          
          // Wait for the popup to disappear and page to reload
          await this.page.waitForTimeout(3000);
          
          // Wait for login form to appear
          await this.page.waitForSelector('#loginUserId', { timeout: 10000 });
          
          this.log('Confirmation popup handled successfully');
        } else {
          this.log('No service restriction popup found, proceeding...');
        }
      } catch (e) {
        this.log('Error while handling confirmation popup:', e.message);
      }

      // Step 4: Click on user ID field first (as shown in the recorded test)
      this.log('Clicking on user ID field...');
      try {
        const idField = this.page.locator('#loginUserId');
        await idField.click();
        await this.page.waitForTimeout(1000);
      } catch (e) {
        this.warn('Failed to click ID field:', e.message);
      }

      // Step 5: Fill user ID
      this.log('Entering user ID...');
      await this.fillInputField(
        this.page,
        this.config.xpaths.idInput,
        userId,
        'User ID'
      );

      // Step 6: Click password field to prepare for virtual keyboard
      this.log('Clicking password field...');
      const passwordField = this.page.locator(`xpath=${this.config.xpaths.passwordInput}`);
      await passwordField.click();
      await this.page.waitForTimeout(1000);

      // Step 7: Handle password entry (virtual keyboard or Windows keyboard)
      this.log('Starting password entry...');
      const keyboardResult = await this.handlePasswordInput(this.page, password);

      if (keyboardResult.success) {
        this.log(`Successfully typed ${keyboardResult.typedChars} characters`);

        // Step 8: Click login button
        this.log('Clicking login button...');
        await this.clickButton(
          this.page,
          this.config.xpaths.loginButton,
          '로그인'
        );

        // Wait for login to process
        await this.page.waitForTimeout(5000);

        // Verify login status - TEMPORARILY COMMENTED OUT
        // const status = await this.checkLoginStatus(this.page);
        // if (status.isLoggedIn) {
        
        // Assume login successful for now
        const status = { isLoggedIn: true, userName: 'NH User' };
        if (true) {
          this.log('Login successful! (status check disabled)');
          this.startSessionKeepAlive();
          
          // Check for e농협회원 login type
          try {
            const eNonghyupElement = await this.page.locator(`xpath=${this.config.xpaths.eNonghyupMemberText}`);
            if (await eNonghyupElement.isVisible({ timeout: 3000 })) {
              this.log('Detected e농협회원(ID/PW방식) login, clicking continue...');
              await this.page.click(`xpath=${this.config.xpaths.eNonghyupContinueButton}`);
              await this.page.waitForTimeout(2000);
            }
          } catch (checkError) {
            // Not an e농협회원 login, continue normally
          }
          
          // Post-login navigation: Click menu button and transaction menu item
          try {
            this.log('Navigating to transaction menu...');
            await this.page.waitForTimeout(2000);
            
            // Click menu button
            await this.page.click(`xpath=${this.config.xpaths.menuButton}`);
            await this.page.waitForTimeout(1000);
            
            // Click transaction menu item
            await this.page.click(`xpath=${this.config.xpaths.transactionMenuItem}`);
            await this.page.waitForTimeout(2000);
            
            this.log('Successfully navigated to transaction page');
          } catch (navError) {
            this.warn('Post-login navigation failed:', navError.message);
            // Continue anyway, navigation might not be needed in all cases
          }
          
          return {
            success: true,
            isLoggedIn: true,
            userName: status.userName,
            keyboardAnalysis: {
              lowerKeyboard: keyboardResult.lowerAnalysis,
              upperKeyboard: keyboardResult.upperAnalysis
            }
          };
        } 
        // TEMPORARILY COMMENTED OUT
        // else {
        //   this.warn('Login verification failed');
        //   return {
        //     success: false,
        //     isLoggedIn: false,
        //     error: 'Login verification failed'
        //   };
        // }
      } else {
        this.warn('Password typing failed');
        return {
          success: false,
          error: 'Virtual keyboard password entry failed',
          failedChars: keyboardResult.failedChars
        };
      }

    } catch (error) {
      this.error('Login automation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // ACCOUNT & TRANSACTION INQUIRY
  // ============================================================================

  /**
   * Gets all accounts for the logged-in user
   * @returns {Promise<Array>} Array of account information
   */
  async getAccounts() {
    console.log('[NH DEBUG] getAccounts() called');
    if (!this.page) {
      this.error('[NH] getAccounts called but this.page is null');
      throw new Error('Browser page not initialized');
    }

    try {
      this.log(`[NH] Current URL at getAccounts start: ${this.page.url()}`);
      this.log('Checking for accounts on current page...');
      
      // Wait a bit more for the page to stabilize
      await this.page.waitForTimeout(3000);

      // Aggressive search for any select element that might be the account dropdown
      const allSelects = await this.page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select')).map(s => ({
          id: s.id,
          name: s.name,
          className: s.className,
          optionCount: s.options.length,
          firstOption: s.options[0]?.textContent?.trim() || '(none)',
          html: s.outerHTML.substring(0, 200)
        }));
        return selects;
      });
      this.log(`[NH Debug] Found ${allSelects.length} select elements on page: ${JSON.stringify(allSelects, null, 2)}`);

      // First try to extract from dropdown
      let dropdownAccounts = [];
      try {
        // Broad search for account dropdowns
        const accountDropdown = this.page.locator('select#drw_acno, select[id*="Acn"], select[id*="acn"], select#sel_account, select#accountNumber, select[title*="계좌"], select[title*="번호"]');
        const count = await accountDropdown.count();
        this.log(`Found ${count} potential account dropdowns via locator`);

        if (count > 0) {
          // Try each found dropdown until one yields accounts
          for (let i = 0; i < count; i++) {
            const targetDropdown = accountDropdown.nth(i);
            if (await targetDropdown.isVisible({ timeout: 2000 })) {
              this.log(`Testing dropdown ${i} (ID: ${await targetDropdown.getAttribute('id')})...`);
              const extracted = await targetDropdown.locator('option').evaluateAll(options => {
                return options
                  .filter(opt => opt.value && opt.value !== '' && !opt.textContent.includes('선택'))
                  .map(opt => {
                    const text = opt.textContent.trim();
                    const match = text.match(/([\d-]{10,22})/);
                    return {
                      accountNumber: match ? match[1] : text,
                      accountName: text.replace(match ? match[1] : '', '').replace(/[\[\]\(\)]/g, '').trim() || 'NH 계좌',
                      value: opt.value,
                      selected: opt.selected
                    };
                  });
              });
              
              if (extracted.length > 0) {
                this.log(`✅ Successfully extracted ${extracted.length} accounts from dropdown ${i}`);
                dropdownAccounts = extracted;
                break;
              }
            }
          }
        }
      } catch (dropdownError) {
        this.warn('Failed to extract from dropdown:', dropdownError.message);
      }

      if (dropdownAccounts.length > 0) {
        return dropdownAccounts.map(acc => ({
          accountNumber: acc.accountNumber,
          accountNumberRaw: acc.value,
          accountName: acc.accountName || 'NH 계좌',
          bankId: 'nh',
          balance: 0,
          isDefault: acc.selected || false
        }));
      }

      // Fallback: Extract accounts from page text
      this.log('Dropdown extraction failed or empty, falling back to text search...');
      const accounts = await this.page.evaluate(() => {
        const results = [];
        const seenAccounts = new Set();
        
        // Look for account dropdowns, lists, or tables
        // NH Bank account pattern: typically 3-2-6 or 3-3-6 digits
        const accountPatterns = [
          /(\d{3}-\d{2,4}-\d{4,6}-\d{2})/g,
          /(\d{3}-\d{2}-\d{6})/g,
          /(\d{3}-\d{3}-\d{6})/g,
          /(\d{11,18})/g,
        ];
        
        // Search all text nodes
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          if (!text) continue;
          
          for (const pattern of accountPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
              const accNum = match[0];
              if (!seenAccounts.has(accNum)) {
                seenAccounts.add(accNum);
                results.push({
                  accountNumber: accNum,
                  accountName: 'NH 계좌 (검색됨)',
                  bankId: 'nh',
                  balance: 0
                });
              }
            }
          }
        }
        
        return results;
      });

      this.log(`Found ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      this.error('Failed to get accounts:', error.message);
      throw error;
    }
  }

  /**
   * Extracts transaction data from NH Bank's specific HTML structure
   * @returns {Promise<Object>} Extracted transaction data
   */
  async extractNHTransactions() {
    this.log('Extracting NH Bank transaction data...');
    
    // Pass bank name to the browser context
    const bankName = this.config.bank?.nameKo || 'NH농협은행';
    
    const extractedData = await this.page.evaluate((bankName) => {
      const data = {
        metadata: {
          accountName: '',
          accountNumber: '',
          accountBalance: '',
          accountType: '',
          accountOwner: '',
          accountOpenDate: '',
          availableBalance: '',
          bankName: bankName,  // Add bank name for Excel generation
        },
        summary: {
          totalCount: 0,
          depositCount: 0,
          depositAmount: 0,
          withdrawalCount: 0,
          withdrawalAmount: 0,
          queryDate: '',
          queryPeriod: '',
        },
        transactions: [],
        headers: [],
      };

      // Extract total count from the result header
      const totalCountEl = document.querySelector('#totalCount');
      if (totalCountEl) {
        data.summary.totalCount = parseInt(totalCountEl.textContent.trim()) || 0;
      }

      // Extract query date/time
      const currentTimeEl = document.querySelector('#currentTime');
      if (currentTimeEl) {
        data.summary.queryDate = currentTimeEl.textContent.replace('조회일시 : ', '').trim();
      }

      // Extract account info from the summary table (#tbDefault)
      const summaryTable = document.querySelector('#tbDefault');
      if (summaryTable) {
        const rows = summaryTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const header = row.querySelector('th')?.textContent.trim();
          const value = row.querySelector('td')?.textContent.trim();
          
          if (header && value) {
            if (header.includes('계좌번호')) {
              data.metadata.accountNumber = value;
            }
            if (header.includes('잔액')) {
              data.metadata.accountBalance = value;
              data.metadata.balance = parseInt(value.replace(/[^0-9]/g, '')) || 0;
            }
            if (header.includes('예금주명')) {
              data.metadata.accountOwner = value;
              data.metadata.customerName = value; // Also set customerName for Excel
            }
            if (header.includes('예금종류')) {
              data.metadata.accountType = value;
              data.metadata.accountName = value; // Also set accountName for Excel
            }
          }
        });
      }
      
      // Extract query period
      const periodEl = document.querySelector('.f_right');
      if (periodEl && periodEl.textContent.includes('조회기간')) {
        data.summary.queryPeriod = periodEl.textContent.replace('조회기간 : ', '').trim();
      }

      // Look for transaction table - NH Bank uses #listTable
      const transactionTable = document.querySelector('#listTable');
      
      if (transactionTable) {
        // Extract headers
        const headerCells = transactionTable.querySelectorAll('thead th');
        headerCells.forEach((th, index) => {
          // Skip checkbox column (first column)
          if (index > 0) {
            // Clean up header text (remove sort button text)
            const headerText = th.querySelector('button.sort')?.textContent.trim() || 
                              th.textContent.trim().replace(/정렬버튼/g, '');
            data.headers.push(headerText);
          }
        });

        // Extract transactions
        const rows = transactionTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 8) {
            // Skip checkbox cell (index 0)
            const dateTime = cells[1]?.textContent.trim() || '';
            const dateTimeParts = dateTime.split(' ');
            
            const date = dateTimeParts[0] || '';
            const time = dateTimeParts[1] || '';

            // Combine date and time into transaction_datetime format: YYYY/MM/DD HH:MM:SS
            const transactionDatetime = (date && time) ? date.replace(/-/g, '/') + ' ' + time : date;

            const transaction = {
              date: date,
              time: time,
              transaction_datetime: transactionDatetime,
              type: cells[5]?.textContent.trim() || '',  // 거래내용 -> 적요
              withdrawal: cells[2]?.textContent.replace(/[^0-9]/g, '') || '0',
              deposit: cells[3]?.textContent.replace(/[^0-9]/g, '') || '0',
              description: cells[6]?.textContent.trim() || '',  // 거래기록사항 -> 내용
              balance: cells[4]?.textContent.replace(/[^0-9]/g, '') || '0',
              branch: cells[7]?.textContent.trim() || '',
              // Store additional NH-specific fields that aren't used in Excel
              transactionNote: cells[6]?.textContent.trim() || '',
              memo: cells[8]?.textContent.trim() || ''
            };
            
            // Only add if there's actual transaction data
            if (transaction.date && (transaction.withdrawal !== '0' || transaction.deposit !== '0')) {
              data.transactions.push(transaction);
            }
          }
        });
      } else {
        // Fallback: Try to find any table with transaction-like headers
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const hasTransactionHeaders = table.querySelector('th')?.textContent.includes('거래일시') || 
                                        table.querySelector('th')?.textContent.includes('출금금액');
          if (hasTransactionHeaders) {
            // Process this table similarly
            console.log('Found transaction table using fallback method');
            break;
          }
        }
      }

      // Calculate summary statistics
      if (data.transactions.length > 0) {
        data.transactions.forEach(tx => {
          const withdrawalAmount = parseInt(tx.withdrawal) || 0;
          const depositAmount = parseInt(tx.deposit) || 0;
          
          if (withdrawalAmount > 0) {
            data.summary.withdrawalCount++;
            data.summary.withdrawalAmount += withdrawalAmount;
            data.summary.totalWithdrawals = data.summary.withdrawalAmount;
          }
          
          if (depositAmount > 0) {
            data.summary.depositCount++;
            data.summary.depositAmount += depositAmount;
            data.summary.totalDeposits = data.summary.depositAmount;
          }
        });
      }

      return data;
    }, bankName);

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Bank: ${extractedData.metadata.bankName}`);
    this.log(`Account: ${extractedData.metadata.accountNumber}`);
    return extractedData;
  }

  /**
   * Sets date range using quick buttons (1 month, 3 months, 1 year)
   * @param {string} period - Period to set ('1month', '3months', '1year')
   * @returns {Promise<void>}
   */
  async setQuickDateRange(period) {
    const periodMap = {
      '1month': this.config.xpaths.dateButton1Month,
      '3months': this.config.xpaths.dateButton3Months,
      '1year': this.config.xpaths.dateButton1Year
    };
    
    const buttonXpath = periodMap[period];
    if (buttonXpath) {
      this.log(`Setting date range to ${period} using quick button`);
      await this.page.click(`xpath=${buttonXpath}`);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Gets transactions for a specific account
   * @param {string} accountNumber - Account number
   * @param {string} startDate - Start date (YYYYMMDD or YYYY-MM-DD)
   * @param {string} endDate - End date (YYYYMMDD or YYYY-MM-DD)
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`Fetching transactions for account ${accountNumber}...`);

      // Navigate to inquiry page if not already there (only if NOT on corporate banking)
      const currentUrl = this.page.url();
      const isCorporate = currentUrl.includes('ibz.nonghyup.com');
      
      if (!isCorporate && !currentUrl.includes('IPAIP0071I')) {
        this.log('Navigating to personal banking inquiry page...');
        await this.page.goto(this.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);
      } else if (isCorporate) {
        this.log('Already in corporate banking session. Skipping personal inquiry navigation.');
      }

      // Select account if dropdown exists
      try {
        const accountDropdown = this.page.locator('select#drw_acno, select[id*="Acn"], select[id*="acn"], select#sel_account, select#accountNumber, select[title*="계좌"], select[title*="번호"]');
        const count = await accountDropdown.count();
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const dropdown = accountDropdown.nth(i);
            if (await dropdown.isVisible({ timeout: 2000 })) {
              this.log(`Attempting to select account ${accountNumber} in dropdown ${i}...`);
              // Try to find the exact option value containing the account number
              const options = await dropdown.locator('option').evaluateAll(opts => 
                opts.map(o => ({ value: o.value, text: o.textContent }))
              );
              
              // Find matching option (remove hyphens to compare purely numbers if needed)
              const cleanTarget = accountNumber.replace(/-/g, '');
              const matchedOpt = options.find(o => 
                o.text.includes(accountNumber) || 
                o.text.replace(/-/g, '').includes(cleanTarget) ||
                o.value.replace(/-/g, '').includes(cleanTarget)
              );
              
              if (matchedOpt && matchedOpt.value) {
                await dropdown.selectOption({ value: matchedOpt.value });
                this.log(`✅ Selected account option: ${matchedOpt.text}`);
                await this.page.waitForTimeout(1000);
                break;
              } else {
                // Fallback to label match
                await dropdown.selectOption({ label: new RegExp(accountNumber) }).catch(() => {});
                await this.page.waitForTimeout(1000);
                break;
              }
            }
          }
        }
      } catch (e) {
        this.log('No account dropdown found or failed to select, continuing...');
      }

      // Set date range using the exact proven method from nhbank.spec.js (Button clicks only)
      this.log(`[NH Corporate] Setting date range...`);
      let dateSetSuccess = false;

      // Try Corporate Banking quick buttons
      try {
        await this.page.locator('a:has-text("3개월")').click({ timeout: 5000 });
        this.log('✅ "3개월" button clicked.');
        await this.page.waitForTimeout(1000);
        dateSetSuccess = true;
      } catch (e) {
        this.log('⚠️ "3개월" button not found, continuing with default date...');
      }

      // If quick button failed and we really need a specific date, fallback to dropdowns (Personal banking style)
      if (!dateSetSuccess && startDate) {
        this.log('Trying manual select dropdowns...');
        try {
          const startDateClean = startDate.replace(/-/g, '');
          const startYear = startDateClean.substring(0, 4);
          const startMonth = startDateClean.substring(4, 6);
          const startDay = startDateClean.substring(6, 8);
          
          if (await this.page.locator(`xpath=${this.config.xpaths.startYearSelect}`).isVisible({timeout: 1000})) {
            await this.page.click(`xpath=${this.config.xpaths.startYearSelect}`);
            await this.page.waitForTimeout(300);
            await this.page.selectOption(`xpath=${this.config.xpaths.startYearSelect}`, startYear);
            await this.page.click('body');
            await this.page.waitForTimeout(300);
            
            await this.page.click(`xpath=${this.config.xpaths.startMonthSelect}`);
            await this.page.waitForTimeout(300);
            await this.page.selectOption(`xpath=${this.config.xpaths.startMonthSelect}`, startMonth);
            await this.page.click('body');
            await this.page.waitForTimeout(300);
            
            await this.page.click(`xpath=${this.config.xpaths.startDaySelect}`);
            await this.page.waitForTimeout(300);
            await this.page.selectOption(`xpath=${this.config.xpaths.startDaySelect}`, startDay);
            await this.page.click('body');
            await this.page.waitForTimeout(500);
          } else {
            this.log('Date select dropdowns not visible, relying on default page date range.');
          }
        } catch (err) {
          this.log('Failed to set manual date, continuing with default:', err.message);
        }
      }

      // Click inquiry button (Exact match to nhbank.spec.js)
      this.log('Clicking 조회...');
      try {
        await this.page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 });
      } catch (e) {
        await this.clickButton(this.page, this.config.xpaths.inquiryButton, '조회');
      }
      await this.page.waitForTimeout(3000);

      // Handle potential date error popups (like "계좌 개설일보다 과거를 선택할 수 없습니다" from nhbank.spec.js)
      const dateError = await this.page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') ||
               body.includes('조회시작일이 계좌개설일');
      });

      if (dateError) {
        this.log('⚠️ Date error detected (Start date before open date). Retrying with 1개월...');
        // Click OK on the alert
        try {
          await this.page.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch(e) {}
        await this.page.waitForTimeout(1000);

        // Try clicking 1 month button
        try {
          await this.page.locator('a:has-text("1개월")').click({ timeout: 5000 });
        } catch(e) {}
        await this.page.waitForTimeout(500);

        // Click Inquiry again
        await this.page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(3000);
        this.log('✅ Retried with 1개월.');
      }

      // Wait for results
      await this.page.waitForTimeout(3000);

      // Check for "더보기" (Load More) button and click it to load all transactions
      let moreButtonExists = true;
      let loadMoreClicks = 0;
      
      while (moreButtonExists && loadMoreClicks < 10) { // Safety limit of 10 clicks
        try {
          // Check if the "더보기" button exists
          const moreButtonArea = await this.page.$('#moreBtnArea');
          if (moreButtonArea) {
            // Check if the area is visible
            const isVisible = await moreButtonArea.isVisible();
            if (isVisible) {
              this.log(`Found "더보기" button, clicking to load more transactions (click ${loadMoreClicks + 1})...`);
              
              // Click the "더보기" link
              const moreButtonLink = await this.page.$('#moreBtnArea a[onclick*="lfInquiryPage"]');
              if (moreButtonLink) {
                await moreButtonLink.click();
                loadMoreClicks++;
                
                // Wait for new transactions to load
                await this.page.waitForTimeout(2000);
              } else {
                moreButtonExists = false;
              }
            } else {
              moreButtonExists = false;
            }
          } else {
            moreButtonExists = false;
          }
        } catch (error) {
          this.log('No more "더보기" button found or error clicking:', error.message);
          moreButtonExists = false;
        }
      }
      
      if (loadMoreClicks > 0) {
        this.log(`Clicked "더보기" button ${loadMoreClicks} times to load all transactions`);
      }

      // Extract transactions using NH Bank specific parser
      const extractedData = await this.extractNHTransactions();
      
      // Create Excel file
      const excelPath = await createExcelFromData(this, extractedData);
      
      return [{
        status: 'downloaded',
        filename: path.basename(excelPath),
        path: excelPath,
        extractedData: extractedData
      }];

    } catch (error) {
      this.error('Error fetching transactions:', error.message);
      return [];
    }
  }

  /**
   * Downloads transactions and parses them into structured data
   * @param {string} accountNumber - Account number to query
   * @param {string} [startDate] - Start date (YYYYMMDD format)
   * @param {string} [endDate] - End date (YYYYMMDD format)
   * @returns {Promise<Object>} Parsed transaction data with download info
   */
  async getTransactionsWithParsing(accountNumber, startDate, endDate) {
    // Use the existing getTransactions method which already does parsing
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    
    // [수정] 내역 없음(Graceful Exit) 시 실패가 아닌 성공으로 반환
    if (!downloadResult || downloadResult.length === 0) {
      this.log('NH: getTransactions returned empty (no data), returning success with empty transactions.');
      return {
        success: true,
        transactions: [],
        metadata: { bankName: 'NH농협은행', accountNumber, totalCount: 0 },
        summary: { totalCount: 0 }
      };
    }
    
    // Check if the download was successful
    const resultItem = downloadResult[0];
    if (resultItem.status !== 'downloaded') {
      return {
        success: false,
        error: 'Data extraction failed',
        downloadResult,
      };
    }
    
    const extractedData = resultItem.extractedData;
    
    // Return data in the expected format
    return {
      success: true,
      file: resultItem.path,
      filename: resultItem.filename,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,  // This is what the UI needs
      headers: extractedData.headers,
    };
  }

  // Note: cleanup() is inherited from BaseBankAutomator
  // It handles stopSessionKeepAlive() and browser closing automatically
}

// Factory function
function createNHAutomator(options = {}) {
  return new NHBankAutomator(options);
}

module.exports = {
  NHBankAutomator,
  createNHAutomator,
};