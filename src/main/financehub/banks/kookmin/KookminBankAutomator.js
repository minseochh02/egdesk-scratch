// ============================================================================
// KOOKMIN BANK AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { isWindows, waitForKookminKbCertificateWindow } = require('../../utils/windows-uia-native');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const {
  runNativeCertArduinoSteps,
  KOOKMIN_NATIVE_CERT_STEPS,
} = require('../../utils/corporate-cert-native-steps');
const { KOOKMIN_CONFIG } = require('./config');
const { handleSecurityPopup } = require('./securityPopup');
const { typePasswordWithKeyboard } = require('./virtualKeyboard');
const {
  parseTransactionExcel,
  extractTransactionsFromPage,
  createExcelFromData
} = require('../../utils/transactionParser');

/**
 * Kookmin Bank Automator
 * Handles login automation for Kookmin Bank including virtual keyboard handling
 */
class KookminBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...KOOKMIN_CONFIG,
      headless: options.headless ?? KOOKMIN_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? KOOKMIN_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || this.getSafeOutputDir('kookmin');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    /** @type {import('../../utils/arduino-hid-bank').ArduinoHidBankSession | null} */
    this._arduinoHid = null;
    /** @type {'idle'|'awaiting_password'|'completed'} */
    this._kookminCorporateCertPhase = 'idle';
  }

  // ============================================================================
  // SECURITY POPUP HANDLING
  // ============================================================================

  /**
   * Handles security program installation popup
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async handleSecurityPopup(page) {
    return handleSecurityPopup(page, this.log.bind(this), this.warn.bind(this));
  }

  // ============================================================================
  // VIRTUAL KEYBOARD HANDLING
  // ============================================================================

  // Note: analyzeVirtualKeyboard() is now inherited from BaseBankAutomator
  // Bank-specific keyboard selectors are defined in config.js

  /**
   * Override keyboard config to include ⇧ symbol for shift detection
   */
  getKeyboardConfig() {
    return {
      ...super.getKeyboardConfig(),
      shiftKeyPatterns: ['shift', '⇧']  // Kookmin uses ⇧ symbol
    };
  }

  /**
   * Handles virtual keyboard password entry
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
      this.error('Virtual keyboard handling failed:', error.message);
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
   * Checks if the user is currently logged in by looking for the user profile element
   * @param {Object} page - Playwright page object
   * @returns {Promise<{isLoggedIn: boolean, userName: string|null}>}
   */
  async checkLoginStatus(page = this.page) {
    if (!page) return { isLoggedIn: false, userName: null };

    try {
      this.log('Checking login status...');
      
      // Look for the user group element
      const userGroupXPath = `xpath=${this.config.xpaths.userProfileGroup}`;
      const nameTextXPath = `xpath=${this.config.xpaths.userNameText}`;
      
      const isVisible = await page.locator(userGroupXPath).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        const userName = await page.locator(nameTextXPath).innerText().catch(() => null);
        this.log(`Logged in as: ${userName || 'Unknown User'}`);
        return { isLoggedIn: true, userName: userName ? userName.trim() : null };
      }
      
      this.log('Not logged in (user profile element not visible)');
      return { isLoggedIn: false, userName: null };
    } catch (error) {
      this.warn('Error checking login status:', error.message);
      return { isLoggedIn: false, userName: null };
    }
  }

  // Note: Session management methods (startSessionKeepAlive, stopSessionKeepAlive, extendSession)
  // are now inherited from BaseBankAutomator

  // ============================================================================
  // ACCOUNT & TRANSACTION INQUIRY
  // ============================================================================

  /**
   * Navigates to the transaction inquiry page and extracts all accounts
   * @returns {Promise<AccountInfo[]>} Array of found accounts
   */
  async getAccounts() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Navigating to transaction inquiry page...');
      
      // Navigate to the inquiry page
      await this.page.goto(this.config.xpaths.inquiryUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await this.page.waitForTimeout(3000);

      // Handle any security popups that might appear during navigation
      await this.handleSecurityPopup(this.page);

      // Try to click the inquiry button if it exists
      try {
        this.log('Looking for inquiry button...');
        const inquiryButton = this.page.locator(`xpath=${this.config.xpaths.inquiryButton}`);
        const buttonExists = await inquiryButton.count() > 0;
        
        if (buttonExists) {
          this.log('Clicking "조회" (Inquiry) button...');
          await inquiryButton.click({ timeout: 5000 });
          await this.page.waitForTimeout(3000);
        }
      } catch (btnError) {
        this.warn('Could not find or click inquiry button:', btnError.message);
      }

      this.log('Searching for accounts...');
      
      // Multiple strategies to find accounts
      const accounts = await this.page.evaluate(() => {
        const results = [];
        const seenAccounts = new Set();
        
        // Account number patterns for Korean banks
        // Kookmin Bank format: XXXXXX-XX-XXXXXXX or similar
        const accountPatterns = [
          /(\d{6}-\d{2}-\d{7})/g,           // 123456-12-1234567
          /(\d{3,6}-\d{2,4}-\d{4,7})/g,     // Flexible format
          /(\d{13,16})/g,                    // No dashes
        ];
        
        // Get all text content from the page
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
              let accountNum = match[1];
              
              // Normalize: remove dashes for comparison
              const normalized = accountNum.replace(/-/g, '');
              
              // Skip if too short or already seen
              if (normalized.length < 10 || seenAccounts.has(normalized)) continue;
              seenAccounts.add(normalized);
              
              // Try to find account name from surrounding context
              let accountName = '';
              const parent = node.parentElement;
              if (parent) {
                // Look for common patterns in parent or sibling elements
                const parentText = parent.textContent || '';
                
                // Look for account type keywords
                const accountTypes = ['예금', '적금', '대출', '카드', '통장'];
                for (const type of accountTypes) {
                  if (parentText.includes(type)) {
                    accountName = type;
                    break;
                  }
                }
                
                // Look for custom account names
                if (!accountName) {
                  const siblings = parent.querySelectorAll('span, div, td');
                  for (const sibling of siblings) {
                    const sibText = sibling.textContent.trim();
                    if (sibText && !sibText.includes(accountNum) && sibText.length < 50) {
                      if (accountTypes.some(type => sibText.includes(type))) {
                        accountName = sibText;
                        break;
                      }
                    }
                  }
                }
              }
              
              results.push({
                accountNumber: accountNum,
                accountName: accountName || '국민은행 계좌',
                bankId: 'kookmin',
                balance: 0,
                currency: 'KRW',
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }
        
        // Also check select/dropdown options for accounts
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
          const options = select.querySelectorAll('option');
          options.forEach(option => {
            const text = option.textContent;
            for (const pattern of accountPatterns) {
              const matches = text.matchAll(pattern);
              for (const match of matches) {
                let accountNum = match[1];
                const normalized = accountNum.replace(/-/g, '');
                
                if (normalized.length < 10 || seenAccounts.has(normalized)) continue;
                seenAccounts.add(normalized);
                
                // Extract account name from option text
                const accountName = text.replace(accountNum, '').trim() || '국민은행 계좌';
                
                results.push({
                  accountNumber: accountNum,
                  accountName: accountName,
                  bankId: 'kookmin',
                  balance: 0,
                  currency: 'KRW',
                  lastUpdated: new Date().toISOString()
                });
              }
            }
          });
        });
        
        // Deduplicate by account number
        const unique = [];
        const seen = new Set();
        for (const acc of results) {
          const key = acc.accountNumber.replace(/-/g, '');
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(acc);
          }
        }
        
        return unique;
      });

      this.log(`Found ${accounts.length} accounts:`, accounts.map(a => a.accountNumber).join(', '));
      return accounts;
    } catch (error) {
      this.error('Failed to get accounts:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // KB 기업 — 공동인증서 (native Delfino + Arduino, kb.spec.js)
  // ============================================================================

  async _disconnectArduinoHid() {
    if (this._arduinoHid) {
      try {
        await this._arduinoHid.disconnect();
      } catch (e) {
        /* ignore */
      }
      this._arduinoHid = null;
    }
  }

  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return { success: false, error: 'KB 기업 인증서 연결은 Windows에서만 지원됩니다.' };
    }
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {
          this.warn('Could not close previous browser:', e.message);
        }
        this.browser = null;
        this.context = null;
        this.page = null;
      }
      // Match scripts/bank-excel-download-automation/kb.spec.js: Chrome args, viewport null,
      // acceptDownloads — and do NOT dismiss 보안프로그램 before 공동인증서 (script never does).
      const corpDownloadsPath = path.join(this.outputDir, 'corporate-cert-downloads');
      this.ensureOutputDirectory(corpDownloadsPath);
      const { browser, context } = await this.createBrowser(proxy, {
        // Same profile location as kb.spec.js (system temp + playwright-profile-*), not userData/chrome-profiles
        useKbScriptPlaywrightProfile: true,
        extraChromeArgs: [
          '--start-maximized',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
        ],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: corpDownloadsPath,
      });
      this.browser = browser;
      this.context = context;

      // Match kb.spec.js EXACTLY: use existing page, no setupBrowserContext routing
      // kb.spec.js line 59: let page = context.pages()[0] || await context.newPage();
      this.page = context.pages()[0] || await context.newPage();

      // Auto-accept dialogs (from kb.spec.js lines 62-65)
      this.page.on('dialog', async (dialog) => {
        try {
          await dialog.accept();
        } catch (e) {
          /* ignore */
        }
      });

      // Add close event listeners for diagnostics
      this.context.on('close', () => {
        this.log('[DEBUG] Browser context closed event fired');
      });
      this.page.on('close', () => {
        this.log('[DEBUG] Page closed event fired');
      });

      const bizUrl = this.config.xpaths.bizMainUrl;
      await this.page.goto(bizUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      try {
        await this.page.evaluate(() => {
          if (typeof DelfinoConfig !== 'undefined') {
            DelfinoConfig.lastUsedCertFirst = true;
          }
        });
      } catch (e) {
        this.warn('DelfinoConfig:', e.message);
      }

      this.log('[PREPARE] Clicking 공동인증서 button...');
      try {
        await this.page.locator('button:has-text("공동인증서")').first().click({ timeout: 15000 });
        this.log('[PREPARE] ✓ Clicked button:has-text("공동인증서")');
      } catch (e) {
        this.log('[PREPARE] Fallback: trying .btn:has-text("공동인증서")...');
        await this.page.locator('.btn:has-text("공동인증서")').first().click({ timeout: 15000 });
        this.log('[PREPARE] ✓ Clicked .btn:has-text("공동인증서")');
      }

      this.log('[PREPARE] Waiting 2s before cert window detection...');
      await this.page.waitForTimeout(2000);

      // Same PowerShell probes + polling as kb.spec.js STEP 3 (30×1s default; extend if needed)
      this.log('[PREPARE] Starting cert window detection (KB spec: ps() + INICertManUI → QWidget → 인증서 선택)...');
      const uia = await waitForKookminKbCertificateWindow({
        timeoutMs: 30000,
        pollMs: 1000,
        onLog: (m) => this.log(`[CERT-DETECT] ${m}`),
      });
      if (!uia.ok) {
        this._kookminCorporateCertPhase = 'idle';
        return { success: false, error: uia.error || '인증서 창을 찾지 못했습니다.' };
      }
      this._kookminCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        certWindowName: uia.windowName,
        certWindowClass: uia.matchedClass,
        message: '인증서 창이 열렸습니다.',
      };
    } catch (error) {
      this.error('prepareCorporateCertificateLogin (kookmin) failed:', error.message);
      this._kookminCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._kookminCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._kookminCorporateCertPhase = 'idle';
      return { success: false, error: '브라우저 세션이 없습니다.' };
    }
    if (!isWindows()) {
      return { success: false, error: 'Windows에서만 지원됩니다.' };
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
      await runNativeCertArduinoSteps(
        this._arduinoHid,
        this.page,
        certificatePassword,
        KOOKMIN_NATIVE_CERT_STEPS,
        {
          log: this.log.bind(this),
          warn: this.warn.bind(this),
          sendkeysEnterFallbackEnv: 'CORP_CERT_SENDKEYS_ENTER_FALLBACK',
        }
      );
      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      await this.page.waitForTimeout(5000);
      await this._navigateKookminBizTransactionInquiry();
      const accounts = await this._getKookminBizAccountsFromAcct();

      this._kookminCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = 'KB 기업뱅킹';

      try {
        this.startSessionKeepAlive();
      } catch (e) {
        this.warn('Session keep-alive:', e.message);
      }

      return {
        success: true,
        isLoggedIn: this.isLoggedIn,
        userName: this.userName,
        accounts,
      };
    } catch (error) {
      this.error('completeCorporateCertificateLogin (kookmin) failed:', error.message);
      try {
        await this._disconnectArduinoHid();
      } catch (e) {
        /* ignore */
      }
      return { success: false, error: error.message };
    }
  }

  async cancelCorporateCertificateLogin(closeBrowser = true) {
    this._kookminCorporateCertPhase = 'idle';
    try {
      await this._disconnectArduinoHid();
    } catch (e) {
      /* ignore */
    }
    if (closeBrowser) {
      await this.cleanup(false);
    }
  }

  async _navigateKookminBizTransactionInquiry() {
    try {
      const bizPos = await this.page.evaluate(() => {
        const els = document.querySelectorAll('a, button, span');
        for (const el of els) {
          if (el.textContent.trim() === '기업') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
            }
          }
        }
        return null;
      });
      if (bizPos) {
        await this.page.mouse.click(bizPos.x, bizPos.y);
        await this.page.waitForTimeout(2000);
      }
    } catch (e) {
      this.warn('기업 tab:', e.message);
    }

    const menuPos = await this.page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.trim() === '조회/이체') {
          const rect = a.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
          }
        }
      }
      return null;
    });
    if (menuPos) {
      await this.page.mouse.move(menuPos.x, menuPos.y);
      await this.page.waitForTimeout(2000);
    }

    const allSubs = await this.page.evaluate(() => {
      const links = document.querySelectorAll('a');
      const matches = [];
      for (const a of links) {
        if (a.textContent.trim() === '거래내역조회') {
          const rect = a.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            matches.push({ x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) });
          }
        }
      }
      return matches;
    });

    if (allSubs.length >= 1) {
      await this.page.mouse.click(allSubs[0].x, allSubs[0].y);
      await this.page.waitForTimeout(2000);
      const debugLinks = await this.page.evaluate(() => {
        const links = document.querySelectorAll('a');
        const results = [];
        for (const a of links) {
          if (a.textContent.includes('거래내역')) {
            const rect = a.getBoundingClientRect();
            results.push({
              text: a.textContent.trim(),
              visible: rect.width > 0 && rect.height > 0,
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
            });
          }
        }
        return results;
      });
      const targetLink = debugLinks.find((l) => l.visible && l.text === '거래내역 조회');
      if (targetLink) {
        await this.page.mouse.click(targetLink.x, targetLink.y);
      } else {
        await this.page.goto(this.config.xpaths.bizTransactionAltUrl, { waitUntil: 'domcontentloaded' });
      }
    } else {
      await this.page.goto(this.config.xpaths.bizTransactionFallbackUrl, { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForTimeout(5000);
  }

  async _getKookminBizAccountsFromAcct() {
    const sel = this.page.locator('#acct');
    if ((await sel.count()) === 0) return [];
    const rows = await sel.evaluate((el) =>
      Array.from(el.options)
        .filter((o) => o.value)
        .map((o) => ({ text: (o.textContent || '').trim(), value: o.value }))
    );
    const accounts = [];
    const seen = new Set();
    const re = /(\d{3}-\d{2,4}-\d{4,7})/;
    for (const row of rows) {
      const m = row.text.match(re);
      if (!m) continue;
      const accountNumber = m[1];
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: row.text.replace(accountNumber, '').trim() || 'KB 기업 계좌',
        bankId: 'kookmin',
        balance: 0,
        currency: 'KRW',
        lastUpdated: new Date().toISOString(),
      });
    }
    return accounts;
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
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting Kookmin Bank automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      // Use existing page from persistent context (best practice)
      this.page = context.pages()[0] || await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to login page
      const navigationUrl = this.config.xpaths.inquiryUrl || this.config.targetUrl;
      this.log('Navigating to:', navigationUrl);
      await this.page.goto(navigationUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(this.config.timeouts.pageLoad);

      // Step 3: Handle security popup
      this.log('Checking for security popup...');
      await this.handleSecurityPopup(this.page);
      await this.page.waitForTimeout(2000);

      // Step 4: Fill user ID
      await this.fillInputField(
        this.page,
        this.config.xpaths.idInput,
        userId,
        'User ID'
      );

      // Step 5: Click password field to trigger virtual keyboard
      this.log('Clicking password field to trigger virtual keyboard...');
      try {
        const passwordLocator = this.page.locator(`xpath=${this.config.xpaths.passwordInput}`);
        await passwordLocator.click({ timeout: this.config.timeouts.click });
        await this.page.waitForTimeout(1000);
        this.log('Password field clicked, waiting for virtual keyboard...');
      } catch (pwClickError) {
        this.warn('Failed to click password field:', pwClickError.message);
      }

      // Step 6: Handle virtual keyboard and type password
      let keyboardResult = null;
      try {
        keyboardResult = await this.handleVirtualKeyboard(this.page, password);

        if (keyboardResult.success) {
          this.log('Successfully typed password using virtual keyboard!');
          this.log(`Typed ${keyboardResult.typedChars}/${keyboardResult.totalChars} characters`);

          // Step 7: Click login button
          this.log('Clicking login button...');
          await this.page.waitForTimeout(500);
          const loginSuccess = await this.clickButton(
            this.page,
            this.config.xpaths.loginButton,
            '로그인'
          );

          if (loginSuccess) {
            this.log('Login button clicked, waiting for response...');
            await this.page.waitForTimeout(5000); // Wait for login to process

            // Verify login status
            const status = await this.checkLoginStatus(this.page);
            if (status.isLoggedIn) {
              this.log('Login verification successful!');
              keyboardResult.success = true;
              keyboardResult.userName = status.userName;

              // Start keep-alive
              this.startSessionKeepAlive();
            } else {
              this.warn('Login verification failed - user profile not found after login');
            }
          }
        } else {
          this.warn('Password typing completed with errors');
          if (keyboardResult.failedChars?.length > 0) {
            this.warn('Failed characters:', keyboardResult.failedChars.map(f => `'${f.char}'`).join(', '));
          }
        }
      } catch (kbError) {
        this.error('Keyboard handling error:', kbError.message);
      }

      return {
        success: keyboardResult?.success && (await this.checkLoginStatus(this.page)).isLoggedIn,
        isLoggedIn: keyboardResult?.success || false,
        userName: keyboardResult?.userName || null,
        keyboardAnalysis: keyboardResult?.keyboardAnalysis || null,
        typingResult: keyboardResult || null,
      };

    } catch (error) {
      this.error('Login automation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetches transaction history for a specific account
   * @param {string} accountNumber - Account number
   * @param {string} [startDate] - Start date (YYYYMMDD format)
   * @param {string} [endDate] - End date (YYYYMMDD format)
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.log(`Fetching transactions for account ${accountNumber} (${startDate} ~ ${endDate})...`);
    
    try {
      // 1. Navigate to inquiry page if needed
      if (!this.page.url().includes('C017213')) {
        await this.page.goto(this.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);
      }

      // 2. Handle account selection
      this.log('Selecting account...');
      
      const selectSelector = `xpath=${this.config.xpaths.accountDropdown}`;
      const isNativeSelect = await this.page.locator(selectSelector).count() > 0;
      
      if (isNativeSelect) {
        this.log('Native select element detected');
        
        // Get all options from the select element
        const options = await this.page.locator(`${selectSelector}/option`).all();
        this.log(`Found ${options.length} account options`);
        
        // Find the option that contains our account number
        let matchFound = false;
        for (let i = 0; i < options.length; i++) {
          const optionText = await options[i].textContent();
          this.log(`Option ${i}: ${optionText}`);
          
          if (optionText && optionText.includes(accountNumber.replace(/-/g, ''))) {
            await this.page.selectOption(selectSelector.replace('xpath=', ''), { index: i });
            this.log(`Selected account: ${optionText}`);
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          this.log('Account not found in select options, using current selection...');
        }
      }
      
      await this.page.waitForTimeout(1000);

      // 3. Set date range
      if (startDate) {
        this.log('Setting start date...');
        const startDateSelector = `xpath=${this.config.xpaths.startDateInput}`;
        const formattedStartDate = startDate.replace(/[^0-9]/g, '');
        await this.page.fill(startDateSelector, formattedStartDate);
      }

      if (endDate) {
        this.log('Setting end date...');
        const endDateSelector = `xpath=${this.config.xpaths.endDateInput}`;
        const formattedEndDate = endDate.replace(/[^0-9]/g, '');
        await this.page.fill(endDateSelector, formattedEndDate);
      }

      await this.page.waitForTimeout(500);

      // 4. Click inquiry button
      this.log('Clicking Inquiry button...');
      await this.page.click(`xpath=${this.config.xpaths.inquiryButton}`);
      
      // Wait for transaction data to load
      this.log('Waiting for transaction data to load...');
      await this.page.waitForTimeout(3000);

      // 5. Extract transaction data
      this.log('Extracting transaction data from page...');
      const extractedData = await extractTransactionsFromPage(this);

      // 6. Create Excel file from extracted data
      const excelPath = await createExcelFromData(this, extractedData);
      extractedData.file = excelPath;
      extractedData.status = 'success';
      
      // Log summary
      if (extractedData.transactions.length === 0) {
        this.log('No transactions found for the specified period');
      } else {
        this.log(`Found ${extractedData.transactions.length} transactions`);
      }
      
      return [{
        status: 'downloaded',
        filename: path.basename(excelPath),
        path: excelPath,
        extractedData: extractedData
      }];

    } catch (error) {
      this.error('Error fetching transactions:', error.message);
      
      // Debug: Take screenshot on error
      try {
        this.ensureOutputDirectory(this.outputDir);
        const errorScreenshot = path.join(this.outputDir, `error-${Date.now()}.png`);
        await this.page.screenshot({ path: errorScreenshot, fullPage: true });
        this.log(`Error screenshot saved to: ${errorScreenshot}`);
      } catch (ssErr) {
        // Ignore screenshot errors
      }
      
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
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    
    if (!downloadResult || downloadResult.length === 0) {
      return {
        success: false,
        error: 'Failed to fetch transaction data - no result returned',
        downloadResult,
      };
    }
    
    const resultItem = downloadResult[0];
    if (resultItem.status !== 'downloaded') {
      return {
        success: false,
        error: 'Data extraction failed',
        downloadResult,
      };
    }
    
    const extractedData = resultItem.extractedData;
    
    return {
      success: true,
      file: resultItem.path,
      filename: resultItem.filename,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,
      headers: extractedData.headers
    };
  }

  // Note: cleanup() is inherited from BaseBankAutomator
  // It handles stopSessionKeepAlive() and browser closing automatically
}

// Factory function for convenience
function createKookminAutomator(options = {}) {
  return new KookminBankAutomator(options);
}

// Standalone function for backward compatibility
async function runKookminAutomation(username, password, id, proxyUrl) {
  const automator = createKookminAutomator();
  return automator.login({ userId: id, password }, proxyUrl);
}

module.exports = {
  KookminBankAutomator,
  createKookminAutomator,
  runKookminAutomation,
};