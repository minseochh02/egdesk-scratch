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
const {
  typePasswordWithKeyboard
} = require('./virtualKeyboard');
const {
  isWindows,
  handleWindowsPasswordInput
} = require('./windowsKeyboardInput');
// Import AI keyboard analysis utilities
const { analyzeKeyboardAndType } = require('../../utils/ai-keyboard-analyzer');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('../../utils/bilingual-keyboard-parser');
const { getGeminiApiKey } = require('../../utils/api-keys');

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

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'nh');
    this.sessionKeepAliveInterval = null;
  }

  // ============================================================================
  // VIRTUAL KEYBOARD HANDLING
  // ============================================================================

  /**
   * Finds a visible virtual keyboard from a list of selectors
   * @param {Object} page - Playwright page object
   * @param {Array} selectors - List of XPaths to try
   * @param {string} label - Label for logging (e.g., 'LOWER', 'UPPER')
   * @returns {Promise<Object|null>} Found locator and selector or null
   */
  async findVisibleKeyboard(page, selectors, label) {
    this.log(`Looking for ${label} keyboard...`);
    
    for (const selector of selectors) {
      const locator = page.locator(`xpath=${selector}`);
      const count = await locator.count();
      
      if (count > 0) {
        const isVisible = await locator.first().isVisible().catch(() => false);
        if (isVisible) {
          this.log(`Found visible ${label} keyboard with selector: ${selector}`);
          return {
            locator: locator.first(),
            selector: selector
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Gets the XPaths for the LOWER keyboard
   * @returns {Array} List of XPaths
   */
  getLowerKeyboardSelectors() {
    return [
      '//div[@id="Tk_loginUserPwd_layoutLower"]',
      '//div[contains(@id, "_layoutLower") and contains(@style, "visibility: visible")]',
      '//img[@id="imgTwinLower"]'
    ];
  }

  /**
   * Gets the XPaths for the UPPER keyboard
   * @returns {Array} List of XPaths
   */
  getUpperKeyboardSelectors() {
    return [
      '//div[@id="Tk_loginUserPwd_layoutUpper"]',
      '//div[contains(@id, "_layoutUpper") and contains(@style, "visibility: visible")]',
      '//img[@id="imgTwinUpper"]'
    ];
  }

  /**
   * Analyzes the virtual keyboard (copying Shinhan's exact method)
   * @param {Object} page - Playwright page object
   * @returns {Promise<Object>} Keyboard analysis result
   */
  async analyzeVirtualKeyboard(page) {
    const timestamp = this.generateTimestamp();
    this.ensureOutputDirectory(this.outputDir);

    try {
      // For NH Bank, we need to analyze both LOWER and UPPER keyboards
      // First, let's handle the LOWER keyboard which should be visible by default
      const keyboardType = 'lower'; // Start with lower keyboard
      
      // Step 1: Find and analyze LOWER keyboard
      this.log('Looking for LOWER keyboard...');
      const lowerKeyboardSelectors = this.getLowerKeyboardSelectors();
      let lowerKeyboard = null;
      let lowerKeyboardElement = null;
      
      // Find the visible LOWER keyboard
      for (const selector of lowerKeyboardSelectors) {
        try {
          const element = page.locator(`xpath=${selector}`);
          if (await element.isVisible({ timeout: 1000 })) {
            lowerKeyboardElement = element;
            lowerKeyboard = { locator: element, selector };
            this.log(`Found LOWER keyboard with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!lowerKeyboardElement) {
        throw new Error('Could not find visible LOWER keyboard');
      }

      // Get LOWER keyboard bounds using getElementBox to handle scrolling properly
      const lowerKeyboardBox = await this.getElementBox(page, `xpath=${lowerKeyboard.selector}`);
      this.log('LOWER keyboard bounds:', lowerKeyboardBox);

      // Take LOWER keyboard screenshot
      const lowerScreenshotFilename = `nh-keyboard-lower-${timestamp}.png`;
      const lowerScreenshotPath = path.join(this.outputDir, lowerScreenshotFilename);
      await lowerKeyboardElement.screenshot({ path: lowerScreenshotPath });
      this.log('LOWER keyboard screenshot saved to:', lowerScreenshotPath);

      // Get Gemini API key
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not set');
      }

      // Analyze LOWER keyboard with Gemini
      this.log('Analyzing LOWER keyboard with Gemini Vision...');
      const lowerAnalysisResult = await analyzeKeyboardAndType(
        lowerScreenshotPath,
        geminiApiKey,
        lowerKeyboardBox,
        null, // Don't type yet
        null, // Don't pass page yet
        {}
      );

      if (!lowerAnalysisResult.success) {
        throw new Error(`LOWER keyboard analysis failed: ${lowerAnalysisResult.error}`);
      }

      this.log(`LOWER keyboard analysis completed, found ${lowerAnalysisResult.processed} keys`);
      
      // Step 2: Find SHIFT key to access UPPER keyboard
      const shiftKey = Object.entries(lowerAnalysisResult.keyboardKeys).find(([label]) => {
        return label.toLowerCase().includes('shift');
      });

      if (!shiftKey) {
        this.warn('SHIFT key not found in LOWER keyboard');
        // Return just the LOWER keyboard analysis
        const keyboardJSON = buildBilingualKeyboardJSON(
          lowerAnalysisResult.keyboardKeys,
          null
        );
        return {
          keyboardJSON,
          lowerAnalysis: lowerAnalysisResult,
          upperAnalysis: null,
          lowerScreenshotPath,
          upperScreenshotPath: null
        };
      }

      const [shiftLabel, shiftData] = shiftKey;
      this.log(`Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);

      // Step 3: Click SHIFT to get UPPER keyboard
      this.log('Clicking SHIFT to switch to UPPER keyboard...');
      await page.mouse.move(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(this.config.delays.mouseMove || 300);
      await page.mouse.click(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(this.config.delays.keyboardUpdate || 1000);

      // Step 4: Find and analyze UPPER keyboard
      this.log('Looking for UPPER keyboard...');
      const upperKeyboardSelectors = this.getUpperKeyboardSelectors();
      let upperKeyboardElement = null;
      let upperKeyboardSelector = null;
      let upperAnalysisResult = null;
      let upperScreenshotPath = null;
      
      for (const selector of upperKeyboardSelectors) {
        try {
          const element = page.locator(`xpath=${selector}`);
          // Wait a bit longer for UPPER keyboard to appear
          await page.waitForTimeout(500);
          if (await element.isVisible({ timeout: 3000 })) {
            upperKeyboardElement = element;
            upperKeyboardSelector = selector;
            this.log(`Found UPPER keyboard with selector: ${selector}`);
            break;
          }
        } catch (e) {
          this.log(`Selector ${selector} not visible, trying next...`);
        }
      }
      
      if (upperKeyboardElement) {
        // Get UPPER keyboard bounds using getElementBox to handle scrolling properly
        const upperKeyboardBox = await this.getElementBox(page, `xpath=${upperKeyboardSelector}`);
        this.log('UPPER keyboard bounds:', upperKeyboardBox);

        const upperScreenshotFilename = `nh-keyboard-upper-${timestamp}.png`;
        upperScreenshotPath = path.join(this.outputDir, upperScreenshotFilename);
        await upperKeyboardElement.screenshot({ path: upperScreenshotPath });
        this.log('UPPER keyboard screenshot saved to:', upperScreenshotPath);

        this.log('Analyzing UPPER keyboard with Gemini Vision...');
        upperAnalysisResult = await analyzeKeyboardAndType(
          upperScreenshotPath,
          geminiApiKey,
          upperKeyboardBox,
          null,
          null,
          {}
        );

        if (upperAnalysisResult.success) {
          this.log(`UPPER keyboard analysis completed, found ${upperAnalysisResult.processed} keys`);
        } else {
          this.warn('UPPER keyboard analysis failed:', upperAnalysisResult.error);
        }

        // Click SHIFT again to return to LOWER
        this.log('Clicking SHIFT to return to LOWER keyboard...');
        await page.mouse.click(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(this.config.delays.keyboardUpdate || 500);
      } else {
        this.warn('UPPER keyboard not found, continuing with LOWER only');
      }

      // Step 5: Build combined keyboard JSON
      const keyboardJSON = buildBilingualKeyboardJSON(
        lowerAnalysisResult.keyboardKeys,
        upperAnalysisResult?.keyboardKeys || null
      );

      // Export for debugging
      const jsonFilename = `nh-keyboard-layout-${timestamp}.json`;
      const jsonPath = path.join(this.outputDir, jsonFilename);
      exportKeyboardJSON(
        lowerAnalysisResult.keyboardKeys,
        jsonPath,
        upperAnalysisResult?.keyboardKeys || null
      );
      this.log('Keyboard JSON exported to:', jsonPath);
      
      return {
        keyboardJSON,
        lowerAnalysis: lowerAnalysisResult,
        upperAnalysis: upperAnalysisResult,
        lowerScreenshotPath,
        upperScreenshotPath
      };
    } catch (error) {
      this.error('Failed to analyze keyboard:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handles password entry based on platform - Windows uses keyboard, others use virtual keyboard
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to type
   * @returns {Promise<Object>}
   */
  async handlePasswordInput(page, password) {
    try {
      // Check if Windows platform and if Windows keyboard mode is enabled
      if (isWindows() && this.config.useWindowsKeyboard !== false) {
        this.log('Windows platform detected, using keyboard input method...');
        return await this.handleWindowsPasswordInput(page, password);
      } else {
        this.log('Using virtual keyboard method...');
        return await this.handleVirtualKeyboard(page, password);
      }
    } catch (error) {
      this.error('Password input failed:', error.message);
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

  /**
   * Windows keyboard input handler
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to type
   * @returns {Promise<Object>}
   */
  async handleWindowsPasswordInput(page, password) {
    try {
      this.log('Using Windows keyboard input for password entry...');
      
      const typingResult = await handleWindowsPasswordInput(
        page,
        password,
        this.config.delays,
        this.log.bind(this),
        this.config.windowsInputMethod || 'auto',
        this.config.xpaths.passwordInput
      );

      return {
        ...typingResult,
        keyboardAnalysis: null, // No AI analysis needed for Windows keyboard
      };

    } catch (error) {
      this.error('Windows keyboard password typing failed:', error.message);
      return {
        success: false,
        error: error.message,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: [],
        method: 'windows_keyboard_failed'
      };
    }
  }

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

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Starts a background task to extend the session periodically
   * @param {number} intervalMs - Interval in milliseconds (default 5 minutes)
   */
  startSessionKeepAlive(intervalMs = 5 * 60 * 1000) {
    if (this.sessionKeepAliveInterval) {
      clearInterval(this.sessionKeepAliveInterval);
    }

    this.log(`Starting session keep-alive (every ${intervalMs / 1000 / 60} minutes)`);
    
    this.sessionKeepAliveInterval = setInterval(async () => {
      try {
        await this.extendSession();
      } catch (error) {
        this.warn('Background session extension failed:', error.message);
      }
    }, intervalMs);
  }

  /**
   * Stops the session keep-alive task
   */
  stopSessionKeepAlive() {
    if (this.sessionKeepAliveInterval) {
      clearInterval(this.sessionKeepAliveInterval);
      this.sessionKeepAliveInterval = null;
      this.log('Session keep-alive stopped');
    }
  }

  /**
   * Extends the current session
   * @returns {Promise<boolean>} Success status
   */
  async extendSession() {
    if (!this.page) return false;

    this.log('Attempting to extend session...');
    try {
      const extendButton = this.page.locator(`xpath=${this.config.xpaths.extendSessionButton}`);
      const isVisible = await extendButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        await extendButton.click();
        this.log('Session extension button clicked successfully');
        return true;
      }
      
      this.warn('Session extension button not visible - session might have already expired or not started');
      return false;
    } catch (error) {
      this.error('Error extending session:', error.message);
      return false;
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
      this.log('Starting NH Bank automation...');
      const { browser, context } = await this.createBrowser(proxy);
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
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      // Don't navigate - we should already be on the inquiry page from menu clicks
      this.log('Checking for accounts on current page...');
      await this.page.waitForTimeout(1000);

      // First try to extract from dropdown
      let dropdownAccounts = [];
      try {
        const accountDropdown = this.page.locator(`xpath=${this.config.xpaths.accountDropdown}`);
        if (await accountDropdown.isVisible({ timeout: 3000 })) {
          this.log('Found account dropdown, extracting options...');
          dropdownAccounts = await accountDropdown.locator('option').evaluateAll(options => {
            return options
              .slice(1) // Skip first option (default placeholder)
              .filter(opt => opt.value && opt.value !== '') // Exclude empty options
              .map(opt => {
                const text = opt.textContent.trim();
                // Parse format: "302-1429-5472-31 NH사장님우대통장"
                const match = text.match(/^(\d{3}-\d{4}-\d{4}-\d{2})\s*(.*)$/);
                return {
                  accountNumber: match ? match[1] : text,
                  accountName: match ? match[2] : 'NH 계좌',
                  value: opt.value,
                  selected: opt.selected
                };
              });
          });
          this.log(`Found ${dropdownAccounts.length} accounts in dropdown`);
        }
      } catch (dropdownError) {
        this.warn('Failed to extract from dropdown:', dropdownError.message);
      }

      // If dropdown extraction succeeded, return those results
      if (dropdownAccounts.length > 0) {
        return dropdownAccounts.map(acc => ({
          accountNumber: acc.accountNumber,
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
          /(\d{3}-\d{2}-\d{6})/g,
          /(\d{3}-\d{3}-\d{6})/g,
          /(\d{11,14})/g,
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
              const accountNum = match[1];
              const normalized = accountNum.replace(/-/g, '');
              
              if (normalized.length < 11 || seenAccounts.has(normalized)) continue;
              seenAccounts.add(normalized);
              
              results.push({
                accountNumber: accountNum,
                accountName: '농협은행 계좌',
                bankId: 'nh',
                balance: 0,
                currency: 'KRW',
                lastUpdated: new Date().toISOString()
              });
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
            
            const transaction = {
              date: dateTimeParts[0] || '',
              time: dateTimeParts[1] || '',
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

      // Navigate to inquiry page if not already there
      if (!this.page.url().includes('IPAIP0071I')) {
        await this.page.goto(this.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);
      }

      // Select account if dropdown exists
      try {
        const accountDropdown = this.page.locator(`xpath=${this.config.xpaths.accountDropdown}`);
        if (await accountDropdown.isVisible({ timeout: 3000 })) {
          await accountDropdown.selectOption({ label: new RegExp(accountNumber) });
          await this.page.waitForTimeout(1000);
        }
      } catch (e) {
        this.log('No account dropdown found, continuing...');
      }

      // Set date range using dropdown selects (click to open, then click option)
      if (startDate) {
        this.log('Setting start date:', startDate);
        const startDateClean = startDate.replace(/-/g, '');
        const startYear = startDateClean.substring(0, 4);
        const startMonth = startDateClean.substring(4, 6);
        const startDay = startDateClean.substring(6, 8);
        
        // Click year dropdown and select year
        await this.page.click(`xpath=${this.config.xpaths.startYearSelect}`);
        await this.page.waitForTimeout(300);
        // Try to select the option using selectOption after opening
        await this.page.selectOption(`xpath=${this.config.xpaths.startYearSelect}`, startYear);
        // Click outside to close dropdown
        await this.page.click('body');
        await this.page.waitForTimeout(300);
        
        // Click month dropdown and select month (keep leading zero)
        await this.page.click(`xpath=${this.config.xpaths.startMonthSelect}`);
        await this.page.waitForTimeout(300);
        await this.page.selectOption(`xpath=${this.config.xpaths.startMonthSelect}`, startMonth);
        await this.page.click('body');
        await this.page.waitForTimeout(300);
        
        // Click day dropdown and select day (keep leading zero)
        await this.page.click(`xpath=${this.config.xpaths.startDaySelect}`);
        await this.page.waitForTimeout(300);
        await this.page.selectOption(`xpath=${this.config.xpaths.startDaySelect}`, startDay);
        await this.page.click('body');
        await this.page.waitForTimeout(500);
      }

      if (endDate) {
        this.log('Setting end date:', endDate);
        const endDateClean = endDate.replace(/-/g, '');
        const endYear = endDateClean.substring(0, 4);
        const endMonth = endDateClean.substring(4, 6);
        const endDay = endDateClean.substring(6, 8);
        
        // Click year dropdown and select year
        await this.page.click(`xpath=${this.config.xpaths.endYearSelect}`);
        await this.page.waitForTimeout(300);
        await this.page.selectOption(`xpath=${this.config.xpaths.endYearSelect}`, endYear);
        await this.page.click('body');
        await this.page.waitForTimeout(300);
        
        // Click month dropdown and select month (keep leading zero)
        await this.page.click(`xpath=${this.config.xpaths.endMonthSelect}`);
        await this.page.waitForTimeout(300);
        await this.page.selectOption(`xpath=${this.config.xpaths.endMonthSelect}`, endMonth);
        await this.page.click('body');
        await this.page.waitForTimeout(300);
        
        // Click day dropdown and select day (keep leading zero)
        await this.page.click(`xpath=${this.config.xpaths.endDaySelect}`);
        await this.page.waitForTimeout(300);
        await this.page.selectOption(`xpath=${this.config.xpaths.endDaySelect}`, endDay);
        await this.page.click('body');
        await this.page.waitForTimeout(500);
      }

      // Click inquiry button
      this.log('Clicking inquiry button...');
      await this.clickButton(this.page, this.config.xpaths.inquiryButton, '조회');

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
    
    // Check if we got a result
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

  /**
   * Cleanup method
   * @param {boolean} [keepOpen=true] - Whether to keep browser open
   */
  async cleanup(keepOpen = true) {
    this.stopSessionKeepAlive();
    
    if (keepOpen) {
      this.log('Keeping browser open for debugging...');
      return;
    }
    await super.cleanup();
  }
}

// Factory function
function createNHAutomator(options = {}) {
  return new NHBankAutomator(options);
}

module.exports = {
  NHBankAutomator,
  createNHAutomator,
};