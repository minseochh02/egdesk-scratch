// ============================================================================
// SHINHAN BANK AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
let SerialPort = null;
try {
  ({ SerialPort } = require('serialport'));
} catch (e) {
  /* optional dependency */
}
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const {
  isWindows,
  waitForNativeCertificateDialogWindow,
  sendEnterKeyViaSendKeys,
} = require('../../utils/windows-uia-native');
const { SHINHAN_CONFIG } = require('./config');
const { handleSecurityPopup } = require('./securityPopup');
const { typePasswordWithKeyboard } = require('./virtualKeyboard');
const {
  fillIdInputEnhanced,
  diagnoseIdInput
} = require('./shinhan-id-fix');
const {
  parseTransactionExcel,
  extractTransactionsFromPage,
  createExcelFromData
} = require('../../utils/transactionParser');

/**
 * Shinhan Bank Automator
 * Handles login automation for Shinhan Bank including virtual keyboard handling
 */
class ShinhanBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...SHINHAN_CONFIG,
      headless: options.headless ?? SHINHAN_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? SHINHAN_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || this.getSafeOutputDir('shinhan');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;
    /** @type {'idle'|'awaiting_password'|'completed'} */
    this._shinhanCorporateCertPhase = 'idle';
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

  /**
   * Handles ID login warning alert that appears after login
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>} Success status
   */
  async handleIdLoginAlert(page) {
    try {
      this.log('Checking for ID login warning alert...');
      const confirmXPath = `xpath=${this.config.xpaths.idLoginConfirm}`;
      
      const confirmLocator = page.locator(confirmXPath);
      
      try {
        // Wait up to 5 seconds for the alert to appear
        await confirmLocator.waitFor({ state: 'visible', timeout: 5000 });
        this.log('ID login warning alert detected. Clicking "확인" (Confirm)...');
        await confirmLocator.click();
        await page.waitForTimeout(1000); // Short wait after click
        return true;
      } catch (waitError) {
        // If it doesn't appear within 5 seconds, that's fine
        this.log('ID login warning alert did not appear within 5s.');
        return false;
      }
    } catch (error) {
      this.warn('Error handling ID login alert:', error.message);
      return false;
    }
  }

  // ============================================================================
  // VIRTUAL KEYBOARD HANDLING
  // ============================================================================

  // Note: analyzeVirtualKeyboard() is now inherited from BaseBankAutomator
  // Note: handlePasswordInput() is now inherited from BaseBankAutomator
  // Note: handleWindowsPasswordInput() is now inherited from BaseBankAutomator
  // Bank-specific keyboard selectors are defined in config.js

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
        // Format: XXX-XXX-XXXXXX or XXXXXXXXXXXX (12 digits)
        const accountPatterns = [
          /(\d{3}-\d{3}-\d{6})/g,           // 110-451-909119
          /(\d{3}-\d{2,4}-\d{4,6})/g,       // 110-45-909119 or 110-4519-091
          /(\d{12,14})/g,                    // 110451909119 (no dashes)
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
              
              // Format as XXX-XXX-XXXXXX if not already formatted
              if (!accountNum.includes('-') && accountNum.length >= 12) {
                accountNum = `${accountNum.slice(0, 3)}-${accountNum.slice(3, 6)}-${accountNum.slice(6)}`;
              }
              
              // Try to find account name from surrounding context
              let accountName = '';
              const parent = node.parentElement;
              if (parent) {
                // Look for common patterns in parent or sibling elements
                const parentText = parent.textContent || '';
                
                // Pattern: [[accountName]bankName ...]
                const bracketMatch = parentText.match(/\[\[(.*?)\]\]/);
                if (bracketMatch) {
                  accountName = bracketMatch[1];
                }
                
                // Pattern: account name in nearby element
                if (!accountName) {
                  const siblings = parent.querySelectorAll('span, div, td');
                  for (const sibling of siblings) {
                    const sibText = sibling.textContent.trim();
                    if (sibText && !sibText.includes(accountNum) && sibText.length < 50) {
                      // Likely an account name
                      if (sibText.includes('계좌') || sibText.includes('예금') || sibText.includes('적금')) {
                        accountName = sibText;
                        break;
                      }
                    }
                  }
                }
              }
              
              results.push({
                accountNumber: accountNum,
                accountName: accountName || '신한은행 계좌',
                bankId: 'shinhan',
                balance: 0,
                currency: 'KRW',
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }
        
        // Also try to find accounts in table rows
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const text = row.textContent;
            for (const pattern of accountPatterns) {
              const matches = text.matchAll(pattern);
              for (const match of matches) {
                let accountNum = match[1];
                const normalized = accountNum.replace(/-/g, '');
                
                if (normalized.length < 10 || seenAccounts.has(normalized)) continue;
                seenAccounts.add(normalized);
                
                if (!accountNum.includes('-') && accountNum.length >= 12) {
                  accountNum = `${accountNum.slice(0, 3)}-${accountNum.slice(3, 6)}-${accountNum.slice(6)}`;
                }
                
                // Try to extract name from other cells
                const cells = row.querySelectorAll('td');
                let accountName = '';
                cells.forEach(cell => {
                  const cellText = cell.textContent.trim();
                  if (cellText && !cellText.includes(accountNum) && cellText.length < 50) {
                    if (!accountName && (cellText.includes('계좌') || cellText.includes('예금'))) {
                      accountName = cellText;
                    }
                  }
                });
                
                results.push({
                  accountNumber: accountNum,
                  accountName: accountName || '신한은행 계좌',
                  bankId: 'shinhan',
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
  // CORPORATE (기업) CERTIFICATE — TWO-PHASE (prepare → user selects cert + app password → complete)
  // ============================================================================

  async _closeBizBankPopup() {
    if (!this.page) return;
    try {
      await this.page.locator('[id="mf_divRPPop99_1775110936087_wframe_btn_closePopIco"]').click({ timeout: 3000 });
      this.log('Closed biz bank popup (primary close).');
    } catch (e) {
      try {
        await this.page.locator('input[value="팝업닫기"]').first().click({ timeout: 2000 });
        this.log('Closed biz bank popup (fallback).');
      } catch (e2) {
        this.log('No biz popup to close.');
      }
    }
    await this.page.waitForTimeout(2000);
  }

  async _clickBizCertLogin() {
    try {
      await this.page.locator(`[id="${this.config.xpaths.bizCertLoginButtonId}"]`).click({ timeout: 10000 });
    } catch (e) {
      await this.page.locator('a:has-text("공동인증서 로그인")').first().click({ timeout: 10000 });
    }
    this.log('Clicked 공동인증서 로그인 (biz).');
  }

  async _navigateBizToAccountInquiry() {
    try {
      await this.page.locator('[id="mf_header_gen_topGnb_0_tbx_topItemText"]').click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('span:has-text("조회")').first().click({ timeout: 5000 });
    }
    await this.page.waitForTimeout(2000);
    try {
      await this.page.locator('span:has-text("계좌별거래내역")').first().click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('[id="mf_header_gen_topGnb_0_gen_menuBox_1_gen_section_0_gen_depth3_0_btn_dep3_text_span"]').click({ timeout: 5000 });
    }
    await this.page.waitForTimeout(3000);
    this.log('Navigated to 계좌별거래내역 (biz).');
  }

  async _getBizAccountsFromPage() {
    const rows = await this.page.evaluate(() => {
      const sel = document.querySelector('select[id*="sbx_acctList"]');
      if (!sel) return [];
      const opts = Array.from(sel.querySelectorAll('option'));
      return opts
        .map((o) => ({ text: (o.textContent || '').trim(), value: o.value }))
        .filter((o) => o.text && o.value);
    });

    const accounts = [];
    const seen = new Set();
    for (const row of rows) {
      const m = row.text.match(/(\d{3}-\d{2,4}-\d{4,7})/);
      if (!m) continue;
      const accountNumber = m[1];
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: row.text.replace(accountNumber, '').trim() || '신한 기업 계좌',
        bankId: 'shinhan',
        balance: 0,
        currency: 'KRW',
        lastUpdated: new Date().toISOString(),
      });
    }
    return accounts;
  }

  async connectArduino() {
    if (!SerialPort) {
      throw new Error('serialport module not available. Install serialport and rebuild native deps.');
    }
    if (!this.arduinoPort) {
      throw new Error('Arduino port not configured (financeHub.arduinoPort).');
    }
    return new Promise((resolve, reject) => {
      this.arduino = new SerialPort({ path: this.arduinoPort, baudRate: this.arduinoBaudRate });
      this.arduino.on('open', () => {
        this.log(`Arduino connected on ${this.arduinoPort}`);
        setTimeout(() => resolve(), 2000);
      });
      this.arduino.on('error', (err) => reject(err));
      this.arduino.on('data', (data) => {
        this.log(`[Arduino] ${data.toString().trim()}`);
      });
    });
  }

  async typeViaArduinoWithNaturalTiming(text, options = {}) {
    const { minDelay = 80, maxDelay = 200 } = options;
    if (!this.arduino) await this.connectArduino();
    this.log(`Typing ${text.length} chars via Arduino HID`);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await new Promise((resolve, reject) => {
        this.arduino.write(char + '\n', (err) => {
          if (err) return reject(err);
          setTimeout(() => resolve(), 950);
        });
      });
      if (i < text.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async disconnectArduino() {
    if (this.arduino && this.arduino.isOpen) {
      return new Promise((resolve) => {
        this.arduino.close(() => {
          this.log('Arduino disconnected');
          this.arduino = null;
          resolve();
        });
      });
    }
    this.arduino = null;
  }

  /**
   * Phase 1: Open 기업 뱅킹, trigger native cert dialog, wait for native cert window (Windows).
   * Renderer collects certificate password first, then runs prepare → complete; user typically relies on last-used cert in the native UI.
   * @param {string} [proxyUrl]
   */
  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return {
        success: false,
        error: '신한 기업 인증서 연결은 Windows에서만 지원됩니다.',
      };
    }

    const proxy = this.buildProxyOption(proxyUrl);

    try {
      this.log('Starting Shinhan corporate certificate flow (phase 1)...');
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

      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;
      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      const bizUrl = this.config.xpaths.bizMainUrl;
      this.log('Navigating to biz bank:', bizUrl);
      await this.page.goto(bizUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      await this._closeBizBankPopup();
      await this._clickBizCertLogin();

      const uia = await waitForNativeCertificateDialogWindow({
        timeoutMs: 60000,
        pollMs: 1000,
        onLog: (m) => this.log(m),
      });

      if (!uia.ok) {
        this._shinhanCorporateCertPhase = 'idle';
        return {
          success: false,
          error:
            uia.error ||
            '인증서 창을 찾지 못했습니다. 은행 보안창이 뜬 경우 창 제목·클래스가 다를 수 있습니다. EGDesk를 관리자 권한으로 실행해 보거나 NPKI/공동인증 프로그램을 재설치해 보세요.',
        };
      }

      this._shinhanCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;

      return {
        success: true,
        phase: 'awaiting_password',
        certWindowName: uia.windowName,
        certWindowClass: uia.matchedClass,
        message:
          '인증서 창이 열렸습니다. 곧 HID로 비밀번호가 입력됩니다. 필요하면 인증서 창에서 인증서를 바꿀 수 있습니다.',
      };
    } catch (error) {
      this.error('prepareCorporateCertificateLogin failed:', error.message);
      this._shinhanCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  /**
   * Phase 2: Type certificate password from UI via Arduino, confirm, load accounts (기업).
   * @param {{ certificatePassword: string }} creds
   */
  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._shinhanCorporateCertPhase !== 'awaiting_password') {
      return {
        success: false,
        error: '인증서 준비 단계가 완료되지 않았습니다. 먼저 1단계를 실행하세요.',
      };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._shinhanCorporateCertPhase = 'idle';
      return { success: false, error: '브라우저 세션이 없습니다.' };
    }
    if (!isWindows()) {
      return { success: false, error: 'Windows에서만 지원됩니다.' };
    }

    try {
      if (!this.arduinoPort) {
        return {
          success: false,
          error: 'Arduino 시리얼 포트가 설정되지 않았습니다. 설정에서 포트를 지정하세요.',
        };
      }

      await this.connectArduino();
      await this.typeViaArduinoWithNaturalTiming(certificatePassword);
      await this.disconnectArduino();

      await this.page.waitForTimeout(1000);
      const enterResult = sendEnterKeyViaSendKeys();
      if (!enterResult.ok) {
        this.warn('SendKeys Enter failed:', enterResult.error);
      }
      await this.page.waitForTimeout(5000);

      await this._navigateBizToAccountInquiry();
      const accounts = await this._getBizAccountsFromPage();

      this._shinhanCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = '신한 기업뱅킹';

      try {
        this.startSessionKeepAlive();
      } catch (e) {
        this.warn('Session keep-alive not started (biz UI may differ):', e.message);
      }

      return {
        success: true,
        isLoggedIn: this.isLoggedIn,
        userName: this.userName,
        accounts,
      };
    } catch (error) {
      this.error('completeCorporateCertificateLogin failed:', error.message);
      try {
        await this.disconnectArduino();
      } catch (e) {
        /* ignore */
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Abort corporate cert flow and optionally close browser.
   * @param {boolean} closeBrowser
   */
  async cancelCorporateCertificateLogin(closeBrowser = true) {
    this._shinhanCorporateCertPhase = 'idle';
    try {
      await this.disconnectArduino();
    } catch (e) {
      /* ignore */
    }
    if (closeBrowser) {
      await this.cleanup(false);
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
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting Shinhan Bank automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);

      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to inquiry page (which will redirect to login if needed)
      // This is more reliable as it lands us on the inquiry page after login
      const navigationUrl = this.config.xpaths.inquiryUrl || this.config.targetUrl;
      this.log('Navigating to:', navigationUrl);
      await this.page.goto(navigationUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(this.config.timeouts.pageLoad);

      // Step 3: Handle security popup
      this.log('Checking for security popup...');
      await this.handleSecurityPopup(this.page);
      await this.page.waitForTimeout(2000);

      // Check if we need to click a login link/button first (if we are not on login page)
      // Sometimes direct navigation lands on a main page where we need to click "Login"
      const currentUrl = this.page.url();
      if (!currentUrl.includes('login') && !currentUrl.includes('index.jsp')) {
        this.log('Not on login page, checking for login button...');
        // Add logic here if needed to click a "Login" button to get to the actual login form
      }

      // Step 4: Fill user ID
      if (this.config.useEnhancedIdInput) {
        this.log('Using enhanced ID input handling...');
        
        // First, run diagnostics if in debug mode
        if (this.config.debug || process.env.DEBUG_SHINHAN) {
          await diagnoseIdInput(
            this.page,
            this.config.xpaths.idInput,
            this.log.bind(this)
          );
        }
        
        // Try enhanced fill method
        const idFillSuccess = await fillIdInputEnhanced(
          this.page,
          this.config.xpaths.idInput,
          userId,
          this.config,
          this.log.bind(this)
        );
        
        if (!idFillSuccess) {
          this.warn('Enhanced ID fill failed, trying standard method as fallback...');
          await this.fillInputField(
            this.page,
            this.config.xpaths.idInput,
            userId,
            'User ID'
          );
        }
      } else {
        // Use standard method
        await this.fillInputField(
          this.page,
          this.config.xpaths.idInput,
          userId,
          'User ID'
        );
      }
      
      // Add a wait after ID input to ensure it's properly registered
      await this.page.waitForTimeout(1000);

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
        keyboardResult = await this.handlePasswordInput(this.page, password);

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
            
            // Handle ID login warning alert if it appears
            await this.handleIdLoginAlert(this.page);
            
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

  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.log(`Fetching transactions for account ${accountNumber} (${startDate} ~ ${endDate})...`);
    
    try {
      // 1. Navigate to inquiry page if needed
      if (!this.page.url().includes('010101100010')) {
        await this.page.goto(this.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);
      }

      // 2. Handle account selection
      this.log('Selecting account...');
      
      // Check if it's a native select element
      const selectSelector = '//select[@id="sbx_accno_input_0"]';
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
          
          if (optionText && optionText.includes(accountNumber)) {
            // Select by value or index
            await this.page.selectOption(selectSelector, { index: i });
            this.log(`Selected account: ${optionText}`);
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          this.log('Account not found in select options, using current selection...');
        }
      } else {
        // Fallback to clicking dropdown (for custom dropdowns)
        this.log('Attempting custom dropdown selection...');
        const dropdownSelector = `xpath=${this.config.xpaths.accountDropdown}`;
        await this.page.click(dropdownSelector);
        await this.page.waitForTimeout(1000);
        
        // Try to find and click the account option
        const accountOption = this.page.locator(`//div[contains(@class, "w2selectbox_layer")]//div[contains(text(), "${accountNumber}")]`).first();
        if (await accountOption.count() > 0) {
          await accountOption.click();
          this.log('Account selected from custom dropdown');
        } else {
          this.log('Account not found in dropdown, using current selection...');
        }
      }
      
      await this.page.waitForTimeout(1000);

      // 4. Set start date
      this.log('Setting start date...');
      const dateInputSelector = `xpath=${this.config.xpaths.startDateInput}`;
      
      let targetStartDate = startDate;
      if (!targetStartDate) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 10);
        targetStartDate = d.toISOString().split('T')[0].replace(/-/g, '');
      }
      const formattedDate = targetStartDate.replace(/[^0-9]/g, '');
      await this.page.fill(dateInputSelector, formattedDate);
      await this.page.waitForTimeout(500);

          // 5. Unfocus by clicking on a neutral area (the page title or form header)
    this.log('Unfocusing date picker...');
    try {
      // Click on the page title "거래내역조회" to unfocus
      const pageTitleSelector = 'h1.titH01, h1[id*="title"], .pageTop h1';
      const pageTitle = this.page.locator(pageTitleSelector).first();
      if (await pageTitle.count() > 0) {
        await pageTitle.click();
        this.log('Clicked on page title to unfocus');
      } else {
        // Alternative: click on form label
        const formLabel = this.page.locator('th:has-text("조회계좌번호")').first();
        if (await formLabel.count() > 0) {
          await formLabel.click();
          this.log('Clicked on form label to unfocus');
        } else {
          // Last resort: click body at a safe position
          await this.page.mouse.click(100, 100);
          this.log('Clicked on page body to unfocus');
        }
      }
    } catch (unfocusError) {
      this.warn('Unfocus click failed:', unfocusError.message);
      // Try clicking at coordinates outside the date picker area
      await this.page.mouse.click(200, 150);
    }
    
    await this.page.waitForTimeout(500);

      // 5. Click "조회" (Inquiry) button
      this.log('Clicking Inquiry button...');
      await this.page.click(`xpath=${this.config.xpaths.inquiryButton}`);
      
      // Wait for transaction data to load
      this.log('Waiting for transaction data to load...');
      try {
        // Wait for either transaction rows or "no data" message
        await Promise.race([
          // Wait for transaction table rows
          this.page.waitForSelector('#grd_list tbody tr.grid_body_row', { timeout: 10000 }),
          // Or wait for the total count element
          this.page.waitForSelector('.total em', { timeout: 10000 }),
          // Or wait for no data message
          this.page.waitForSelector('.no-data, .empty-message', { timeout: 10000 })
        ]);
        
        // Additional wait to ensure data is fully rendered
        await this.page.waitForTimeout(2000);
      } catch (waitError) {
        this.log('Warning: Transaction data wait timed out, proceeding anyway...');
      }

      // 6. Extract data directly from HTML (No download)
      this.log('Extracting transaction data from page...');
      const extractedData = await extractTransactionsFromPage(this);

      // 7. Create Excel file from extracted data (even if no transactions)
      const excelPath = await createExcelFromData(this, extractedData);
      extractedData.file = excelPath;
      extractedData.status = 'success';
      
      // Log summary
      if (extractedData.transactions.length === 0) {
        this.log('No transactions found for the specified period - this is normal');
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

  // Note: cleanup() is inherited from BaseBankAutomator
  // It handles stopSessionKeepAlive() and browser closing automatically

  /**
   * Downloads transactions and parses them into structured data
   * @param {string} accountNumber - Account number to query
   * @param {string} [startDate] - Start date (YYYYMMDD format)
   * @param {string} [endDate] - End date (YYYYMMDD format)
   * @returns {Promise<Object>} Parsed transaction data with download info
   */
  async getTransactionsWithParsing(accountNumber, startDate, endDate) {
    // We reuse the getTransactions method which now does parsing internally
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    
    // Check if the method returned any result
    if (!downloadResult || downloadResult.length === 0) {
      return {
        success: false,
        error: 'Failed to fetch transaction data - no result returned',
        downloadResult,
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
    
    // Success - return data even if no transactions (0 transactions is valid)
    return {
      success: true,
      file: resultItem.path,
      filename: resultItem.filename,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,  // Can be empty array
      headers: extractedData.headers
    };
  }
}

// Factory function for convenience
function createShinhanAutomator(options = {}) {
  return new ShinhanBankAutomator(options);
}

// Standalone function for backward compatibility
async function runShinhanAutomation(username, password, id, proxyUrl) {
  const automator = createShinhanAutomator();
  return automator.login({ userId: id, password }, proxyUrl);
}

module.exports = {
  ShinhanBankAutomator,
  createShinhanAutomator,
  runShinhanAutomation,
};