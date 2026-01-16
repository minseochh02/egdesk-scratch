// ============================================================================
// NH BUSINESS BANK AUTOMATOR (법인)
// ============================================================================
// Based on workflow from output/nh-business-account.spec.js

const path = require('path');
const fs = require('fs');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NH_BUSINESS_CONFIG } = require('./config');
// Import AI keyboard analysis utilities
const { analyzeKeyboardAndType } = require('../../utils/ai-keyboard-analyzer');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('../../utils/bilingual-keyboard-parser');
const { getGeminiApiKey } = require('../../utils/api-keys');

/**
 * NH Business Bank Automator
 * Handles certificate-based login automation for Nonghyup Business Banking
 */
class NHBusinessBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...NH_BUSINESS_CONFIG,
      headless: options.headless ?? NH_BUSINESS_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? NH_BUSINESS_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'nh-business');
    this.sessionKeepAliveInterval = null;
  }

  // ============================================================================
  // VIRTUAL KEYBOARD ANALYSIS (INItech)
  // ============================================================================

  /**
   * Analyzes the INItech virtual keyboard using Gemini Vision
   * Handles both base and shifted layouts (like NH personal account)
   * @param {Object} page - Playwright page object
   * @returns {Promise<Object>} Keyboard analysis result
   */
  async analyzeINItechKeyboard(page) {
    const timestamp = this.generateTimestamp();
    this.ensureOutputDirectory(this.outputDir);

    try {
      this.log('Analyzing INItech virtual keyboard...');

      // Find the virtual keyboard element
      const keyboardSelector = '[id="ini_cert_pwd_imgTwin"]';
      const keyboardElement = page.locator(keyboardSelector);

      // Wait for keyboard to be visible
      await keyboardElement.waitFor({ state: 'visible', timeout: 5000 });

      // ====================================================================
      // STEP 1: Analyze BASE keyboard (normal layout)
      // ====================================================================

      // Get keyboard bounds
      const baseKeyboardBox = await this.getElementBox(page, keyboardSelector);
      this.log('INItech BASE keyboard bounds:', baseKeyboardBox);

      // Take BASE keyboard screenshot
      const baseScreenshotFilename = `nh-business-keyboard-base-${timestamp}.png`;
      const baseScreenshotPath = path.join(this.outputDir, baseScreenshotFilename);
      await keyboardElement.screenshot({ path: baseScreenshotPath });
      this.log('INItech BASE keyboard screenshot saved to:', baseScreenshotPath);

      // Get Gemini API key
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not set');
      }

      // Analyze BASE keyboard with Gemini
      this.log('Analyzing BASE keyboard with Gemini Vision...');
      const baseAnalysisResult = await analyzeKeyboardAndType(
        baseScreenshotPath,
        geminiApiKey,
        baseKeyboardBox,
        null, // Don't type yet
        null, // Don't pass page yet
        {}
      );

      if (!baseAnalysisResult.success) {
        throw new Error(`BASE keyboard analysis failed: ${baseAnalysisResult.error}`);
      }

      this.log(`BASE keyboard analysis completed, found ${baseAnalysisResult.processed} keys`);

      // ====================================================================
      // STEP 2: Find SHIFT key and capture SHIFTED keyboard
      // ====================================================================

      const shiftKey = Object.entries(baseAnalysisResult.keyboardKeys).find(([label]) => {
        const lowerLabel = label.toLowerCase();
        return lowerLabel.includes('shift') ||
               lowerLabel.includes('특수') ||
               lowerLabel.includes('⇧') ||
               lowerLabel === '↑';
      });

      let shiftedAnalysisResult = null;
      let shiftedScreenshotPath = null;

      if (!shiftKey) {
        this.warn('SHIFT key not found in BASE keyboard, continuing without shifted layout');
      } else {
        const [shiftLabel, shiftData] = shiftKey;
        this.log(`Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);

        // Click SHIFT to get shifted keyboard
        this.log('Clicking SHIFT to switch to shifted keyboard...');
        await page.mouse.move(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(this.config.delays.mouseMove || 300);
        await page.mouse.click(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(this.config.delays.keyboardUpdate || 1000);

        // Wait for keyboard to update
        await page.waitForTimeout(500);

        // Check if keyboard element is still visible
        if (await keyboardElement.isVisible({ timeout: 3000 })) {
          // Get SHIFTED keyboard bounds
          const shiftedKeyboardBox = await this.getElementBox(page, keyboardSelector);
          this.log('INItech SHIFTED keyboard bounds:', shiftedKeyboardBox);

          // Take SHIFTED keyboard screenshot
          const shiftedScreenshotFilename = `nh-business-keyboard-shifted-${timestamp}.png`;
          shiftedScreenshotPath = path.join(this.outputDir, shiftedScreenshotFilename);
          await keyboardElement.screenshot({ path: shiftedScreenshotPath });
          this.log('INItech SHIFTED keyboard screenshot saved to:', shiftedScreenshotPath);

          // Analyze SHIFTED keyboard with Gemini
          this.log('Analyzing SHIFTED keyboard with Gemini Vision...');
          shiftedAnalysisResult = await analyzeKeyboardAndType(
            shiftedScreenshotPath,
            geminiApiKey,
            shiftedKeyboardBox,
            null,
            null,
            {}
          );

          if (shiftedAnalysisResult.success) {
            this.log(`SHIFTED keyboard analysis completed, found ${shiftedAnalysisResult.processed} keys`);
          } else {
            this.warn('SHIFTED keyboard analysis failed:', shiftedAnalysisResult.error);
          }

          // Click SHIFT again to return to BASE keyboard
          this.log('Clicking SHIFT to return to BASE keyboard...');
          await page.mouse.click(shiftData.position.x, shiftData.position.y);
          await page.waitForTimeout(this.config.delays.keyboardUpdate || 500);
        } else {
          this.warn('SHIFTED keyboard not visible after clicking shift');
        }
      }

      // ====================================================================
      // STEP 3: Build combined keyboard JSON (like NH personal account)
      // ====================================================================

      const keyboardJSON = buildBilingualKeyboardJSON(
        baseAnalysisResult.keyboardKeys,
        shiftedAnalysisResult?.keyboardKeys || null
      );

      // Export for debugging
      const jsonFilename = `nh-business-keyboard-layout-${timestamp}.json`;
      const jsonPath = path.join(this.outputDir, jsonFilename);
      exportKeyboardJSON(
        baseAnalysisResult.keyboardKeys,
        jsonPath,
        shiftedAnalysisResult?.keyboardKeys || null
      );
      this.log('Keyboard JSON exported to:', jsonPath);

      return {
        success: true,
        keyboardJSON,
        baseAnalysis: baseAnalysisResult,
        shiftedAnalysis: shiftedAnalysisResult,
        baseScreenshotPath,
        shiftedScreenshotPath
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
   * Types password using bilingual keyboard JSON with shift support
   * (Copied from NH personal account implementation)
   * @param {Object} page - Playwright page object
   * @param {Object} keyboardJSON - Bilingual keyboard JSON with characterMap and shiftKey
   * @param {string} password - Password to type
   * @returns {Promise<Object>}
   */
  async typePasswordWithKeyboard(page, keyboardJSON, password) {
    try {
      this.log(`Typing password with bilingual keyboard... (${password.length} characters)`);

      const results = {
        success: true,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: []
      };

      let shiftActive = false;

      for (let i = 0; i < password.length; i++) {
        const char = password[i];
        let keyInfo = keyboardJSON.characterMap[char];

        // Smart fallback: If uppercase not found, try lowercase with shift
        if (!keyInfo && char >= 'A' && char <= 'Z') {
          const lowerChar = char.toLowerCase();
          const lowerKeyInfo = keyboardJSON.characterMap[lowerChar];
          if (lowerKeyInfo) {
            this.log(`Character '${char}' not found, using lowercase '${lowerChar}' position with shift`);
            keyInfo = {
              ...lowerKeyInfo,
              requiresShift: true  // Force shift for uppercase
            };
          }
        }

        if (!keyInfo) {
          this.warn(`Character '${char}' not found in keyboard mapping`);
          results.failedChars.push({ index: i, char, reason: 'not_found' });
          results.success = false;
          continue;
        }

        const needsShift = keyInfo.requiresShift || false;

        // Handle shift state
        if (needsShift && !shiftActive) {
          if (keyboardJSON.shiftKey) {
            this.log(`Activating shift for '${char}'`);
            await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.mouseMove || 100);
            await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.keyboardUpdate || 200);
            shiftActive = true;
            results.shiftClicks++;
          } else {
            this.warn(`Character '${char}' requires shift but shift key not found`);
            results.failedChars.push({ index: i, char, reason: 'shift_not_found' });
            results.success = false;
            continue;
          }
        } else if (!needsShift && shiftActive) {
          if (keyboardJSON.shiftKey) {
            this.log(`Deactivating shift for '${char}'`);
            await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.mouseMove || 100);
            await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.keyboardUpdate || 200);
            shiftActive = false;
            results.shiftClicks++;
          }
        }

        // Click character key
        this.log(`Clicking '${char}' at (${keyInfo.position.x}, ${keyInfo.position.y})...`);
        await page.mouse.move(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(this.config.delays.mouseMove || 100);
        await page.mouse.click(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(this.config.delays.keyPress || 200);

        results.typedChars++;
        results.details.push({ char, position: keyInfo.position, requiresShift: needsShift, success: true });
      }

      // Deactivate shift at end if needed
      if (shiftActive && keyboardJSON.shiftKey) {
        this.log('Deactivating shift at end of password');
        await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
        results.shiftClicks++;
      }

      this.log(`Password typing completed: ${results.typedChars}/${results.totalChars} characters, ${results.shiftClicks} shift clicks`);
      return results;
    } catch (error) {
      this.error(`Error typing password: ${error.message}`);
      return {
        success: false,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: [],
        error: error.message
      };
    }
  }

  // ============================================================================
  // CERTIFICATE AUTHENTICATION
  // ============================================================================

  /**
   * Handles certificate selection and password entry
   * @param {Object} page - Playwright page object
   * @param {string} certificatePassword - Certificate password
   * @returns {Promise<Object>}
   */
  async handleCertificateLogin(page, certificatePassword) {
    try {
      this.log('Starting certificate authentication...');

      // Step 1: Handle initial confirmation popup
      try {
        this.log('Waiting for confirmation popup...');
        await page.waitForTimeout(this.config.delays.humanLike);

        const confirmButton = page.locator(this.config.xpaths.confirmPopupButton);
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          this.log('Clicking confirmation button...');
          await confirmButton.click();
          await page.waitForTimeout(this.config.delays.humanLike);
        }
      } catch (e) {
        this.log('No confirmation popup found, continuing...');
      }

      // Step 2: Open certificate list (click 공동인증서 로그인 button)
      this.log('Opening certificate list (clicking 공동인증서 로그인)...');
      const certButton = this.config.xpaths.certificateListButton.startsWith('/')
        ? page.locator(`xpath=${this.config.xpaths.certificateListButton}`)
        : page.locator(this.config.xpaths.certificateListButton);
      await certButton.click();
      await page.waitForTimeout(1775); // From spec file timing

      // Step 3: Select certificate
      this.log('Selecting certificate...');
      await page.locator(this.config.xpaths.certificateItem).click();
      await page.waitForTimeout(1775);

      // Step 4: Click certificate password input field
      this.log('Clicking certificate password field...');
      await page.locator(this.config.xpaths.certPasswordInput).click();
      await page.waitForTimeout(1818);

      // Step 5: Open virtual keyboard
      this.log('Opening virtual keyboard...');
      await page.locator(this.config.xpaths.certPasswordKeyboardButton).click();
      await page.waitForTimeout(1169);

      // Step 6: Analyze virtual keyboard with Gemini
      this.log('Analyzing INItech virtual keyboard...');
      const keyboardAnalysis = await this.analyzeINItechKeyboard(page);

      if (!keyboardAnalysis.success) {
        throw new Error(`Keyboard analysis failed: ${keyboardAnalysis.error}`);
      }

      // Step 7: Type password using analyzed keyboard coordinates (with shift support)
      this.log(`Typing certificate password (${certificatePassword.length} characters)...`);
      const typingResult = await this.typePasswordWithKeyboard(
        page,
        keyboardAnalysis.keyboardJSON, // Use bilingual keyboard JSON with characterMap
        certificatePassword
      );

      if (!typingResult.success) {
        this.warn(`Password typing had errors: ${JSON.stringify(typingResult.failedChars)}`);
        throw new Error(`Failed to type password. Failed characters: ${typingResult.failedChars.length}`);
      }

      this.log(`Successfully typed all ${typingResult.typedChars} characters`);
      await page.waitForTimeout(1895);

      // Step 8: Close virtual keyboard by clicking the h2 header
      this.log('Closing virtual keyboard (clicking h2 header)...');
      const closeKeyboardSelector = this.config.xpaths.certPasswordCloseKeyboard.startsWith('/')
        ? page.locator(`xpath=${this.config.xpaths.certPasswordCloseKeyboard}`)
        : page.locator(this.config.xpaths.certPasswordCloseKeyboard);
      await closeKeyboardSelector.click();
      await page.waitForTimeout(1357);

      // Step 9: Submit certificate
      this.log('Submitting certificate...');
      await page.locator(this.config.xpaths.certSubmitButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      return {
        success: true,
        keyboardAnalysis,
        typingResult
      };
    } catch (error) {
      this.error('Certificate login failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // POST-LOGIN NAVIGATION
  // ============================================================================

  /**
   * Navigates to transaction history page after login
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async navigateToTransactionHistory(page) {
    try {
      // Close post-login area by clicking first 조회 button
      this.log('Closing post-login area (clicking first 조회 button)...');
      await page.locator(this.config.xpaths.closeModalButton).first().click();
      await page.waitForTimeout(2268);

      // Navigate to transaction history
      this.log('Navigating to transaction history...');
      await page.locator(this.config.xpaths.transactionMenuLink).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      this.log('Successfully navigated to transaction history page');

      return true;
    } catch (error) {
      this.error('Failed to navigate to transaction history:', error.message);
      return false;
    }
  }

  // ============================================================================
  // DATE RANGE SELECTION
  // ============================================================================

  /**
   * Sets date range for transaction query
   * @param {Object} page - Playwright page object
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<boolean>}
   */
  async setDateRange(page, startDate, endDate) {
    try {
      this.log(`Setting date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

      // Set start date
      const startYear = startDate.getFullYear().toString();
      const startMonth = (startDate.getMonth() + 1).toString();
      const startDay = startDate.getDate().toString();

      await page.selectOption(this.config.xpaths.startYearSelect, startYear);
      await page.waitForTimeout(1200);
      await page.selectOption(this.config.xpaths.startMonthSelect, startMonth);
      await page.waitForTimeout(800);
      await page.selectOption(this.config.xpaths.startDateSelect, startDay);
      await page.waitForTimeout(this.config.delays.humanLike);

      // Set end date
      const endYear = endDate.getFullYear().toString();
      const endMonth = (endDate.getMonth() + 1).toString();
      const endDay = endDate.getDate().toString();

      await page.selectOption(this.config.xpaths.endYearSelect, endYear);
      await page.waitForTimeout(1200);
      await page.selectOption(this.config.xpaths.endMonthSelect, endMonth);
      await page.waitForTimeout(800);
      await page.selectOption(this.config.xpaths.endDateSelect, endDay);
      await page.waitForTimeout(2235);

      return true;
    } catch (error) {
      this.error('Failed to set date range:', error.message);
      return false;
    }
  }

  /**
   * Calculates date range (e.g., 30 days ago to today)
   * @param {number} daysAgo - Number of days ago from today
   * @returns {Object} { startDate, endDate }
   */
  getDateRange(daysAgo = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    return { startDate, endDate };
  }

  // ============================================================================
  // TRANSACTION QUERY
  // ============================================================================

  /**
   * Executes transaction query and handles pagination
   * @param {Object} page - Playwright page object
   * @param {number} maxPages - Maximum number of pages to load (default 5)
   * @returns {Promise<boolean>}
   */
  async queryTransactions(page, maxPages = 5) {
    try {
      // Execute search
      this.log('Executing transaction search...');
      await page.locator(this.config.xpaths.searchButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      // Some UI interactions from spec (exploring the interface)
      await page.locator(this.config.xpaths.startMonthSelect).click();
      await page.waitForTimeout(2687);
      await page.locator(this.config.xpaths.startMonthSelect).click();
      await page.waitForTimeout(2098);

      // Re-query
      await page.locator(this.config.xpaths.searchButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      // Handle pagination - load additional transaction pages
      this.log(`Loading up to ${maxPages} pages of transactions...`);
      for (let i = 0; i < maxPages; i++) {
        try {
          const nextButton = page.locator(this.config.xpaths.nextRecordsButton);
          if (await nextButton.isVisible({ timeout: 2000 })) {
            this.log(`Loading page ${i + 2}...`);
            await nextButton.click();
            await page.waitForTimeout(i < 3 ? this.config.delays.humanLike : 1144);
          } else {
            this.log('No more pages to load');
            break;
          }
        } catch (e) {
          this.log(`Pagination ended at page ${i + 1}`);
          break;
        }
      }

      this.log('Transaction query completed');
      return true;
    } catch (error) {
      this.error('Failed to query transactions:', error.message);
      return false;
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method for NH Business Bank
   * @param {Object} credentials - { certificatePassword }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { certificatePassword } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting NH Business Bank automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to login page
      this.log('Navigating to NH Business Bank login page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(this.config.delays.humanLike);

      // Step 3: Handle certificate login
      const certResult = await this.handleCertificateLogin(this.page, certificatePassword);

      if (!certResult.success) {
        return {
          success: false,
          error: 'Certificate authentication failed',
          details: certResult.error,
        };
      }

      // Step 4: Navigate to transaction history page
      this.log('Navigating to transaction history page...');
      const navResult = await this.navigateToTransactionHistory(this.page);

      if (!navResult) {
        return {
          success: false,
          error: 'Failed to navigate to transaction history',
        };
      }

      // Step 5: Parse accounts from dropdown
      this.log('Parsing accounts from dropdown...');
      const accounts = await this.getAccounts();

      this.log('NH Business Bank login completed successfully!');

      return {
        success: true,
        isLoggedIn: true,
        userName: 'NH 법인사용자',
        accounts: accounts,
      };

    } catch (error) {
      this.error('Login automation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // ACCOUNT & TRANSACTION INQUIRY (Placeholders)
  // ============================================================================

  /**
   * Gets all accounts from the account dropdown on transaction history page
   * @returns {Promise<Array>} Array of account information
   */
  async getAccounts() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Parsing accounts from dropdown...');

      // Extract accounts from the select dropdown
      const accounts = await this.page.evaluate((xpathSelector) => {
        const result = document.evaluate(
          xpathSelector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        const selectElement = result.singleNodeValue;

        if (!selectElement) {
          console.log('Account dropdown not found');
          return [];
        }

        const options = selectElement.querySelectorAll('option');
        const accountList = [];

        options.forEach((option, index) => {
          const value = option.value;
          const text = option.textContent.trim();

          // Skip the first placeholder option ("선택해 주세요.")
          if (!value || value === '' || text === '선택해 주세요.') {
            return;
          }

          accountList.push({
            accountNumber: text,                    // Formatted: "301-0281-7549-41"
            accountNumberRaw: value,                // Raw: "3010281754941"
            accountName: 'NH 법인계좌',
            bankId: 'nh-business',
            balance: 0,                             // Balance not available in dropdown
            currency: 'KRW',
            lastUpdated: new Date().toISOString()
          });
        });

        return accountList;
      }, this.config.xpaths.accountDropdown);

      this.log(`Found ${accounts.length} accounts in dropdown`);

      return accounts;

    } catch (error) {
      this.error('Failed to get accounts:', error.message);
      throw error;
    }
  }

  /**
   * Gets transactions for a specific account
   * @param {string} accountNumber - Account number
   * @param {string} startDate - Start date (YYYYMMDD)
   * @param {string} endDate - End date (YYYYMMDD)
   * @returns {Promise<Object>} Transaction data with metadata
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`Fetching transactions for account ${accountNumber}...`);
      this.log(`Date range: ${startDate} to ${endDate}`);

      // Step 1: Select account from dropdown
      await this.selectAccount(accountNumber);

      // Step 2: Set date range
      const start = new Date(
        parseInt(startDate.substring(0, 4)),
        parseInt(startDate.substring(4, 6)) - 1,
        parseInt(startDate.substring(6, 8))
      );
      const end = new Date(
        parseInt(endDate.substring(0, 4)),
        parseInt(endDate.substring(4, 6)) - 1,
        parseInt(endDate.substring(6, 8))
      );

      await this.setDateRange(this.page, start, end);

      // Step 3: Click search button
      this.log('Clicking search button...');
      await this.page.locator(this.config.xpaths.searchButton).click();
      await this.page.waitForTimeout(this.config.delays.humanLike);

      // Step 4: Handle pagination - click "다음내역" to load all pages
      await this.loadAllTransactionPages();

      // Step 5: Extract transaction data
      const extractedData = await this.extractTransactionData();

      return extractedData;

    } catch (error) {
      this.error('Error fetching transactions:', error.message);
      throw error;
    }
  }

  /**
   * Selects account from dropdown
   * @param {string} accountNumber - Account number (formatted or raw)
   */
  async selectAccount(accountNumber) {
    try {
      this.log(`Selecting account: ${accountNumber}`);

      const dropdown = this.page.locator(`xpath=${this.config.xpaths.accountDropdown}`);

      // Try to select by visible text (formatted account number)
      try {
        await dropdown.selectOption({ label: accountNumber });
        this.log('Selected account by formatted number');
      } catch (e) {
        // Try selecting by value (raw account number without dashes)
        const rawAccountNumber = accountNumber.replace(/-/g, '');
        await dropdown.selectOption({ value: rawAccountNumber });
        this.log('Selected account by raw number');
      }

      await this.page.waitForTimeout(1000);
    } catch (error) {
      this.error('Failed to select account:', error.message);
      throw error;
    }
  }

  /**
   * Loads all transaction pages by clicking "다음내역" button
   */
  async loadAllTransactionPages() {
    let pageCount = 1;
    const maxPages = 10; // Safety limit

    while (pageCount < maxPages) {
      try {
        const nextButton = this.page.locator(this.config.xpaths.nextRecordsButton);

        // Check if button exists and is enabled
        if (await nextButton.isVisible({ timeout: 2000 })) {
          this.log(`Loading page ${pageCount + 1}...`);
          await nextButton.click();
          await this.page.waitForTimeout(this.config.delays.humanLike);
          pageCount++;
        } else {
          this.log('No more pages to load');
          break;
        }
      } catch (e) {
        this.log(`Pagination ended at page ${pageCount}`);
        break;
      }
    }

    if (pageCount > 1) {
      this.log(`Loaded ${pageCount} pages of transactions`);
    }
  }

  /**
   * Extracts transaction data from the page
   * @returns {Promise<Object>} Extracted transaction data with metadata
   */
  async extractTransactionData() {
    this.log('Extracting transaction data...');

    const extractedData = await this.page.evaluate(() => {
      const data = {
        metadata: {
          accountName: '',
          accountNumber: '',
          accountOwner: '',
          accountType: '',
          balance: 0,
          bankName: 'NH농협은행 법인',
        },
        summary: {
          totalCount: 0,
          queryDate: '',
        },
        transactions: [],
      };

      // Extract summary info from tb1
      const summaryTable = document.querySelector('#tb1');
      if (summaryTable) {
        const rows = summaryTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const th = row.querySelector('th')?.textContent.trim();
          const td = row.querySelector('td')?.textContent.trim();

          if (th && td) {
            if (th === '예금주명') data.metadata.accountOwner = td;
            if (th === '예금종류') data.metadata.accountType = td;
            if (th === '현재통장잔액') {
              const balanceSpan = row.querySelector('#totAmt');
              if (balanceSpan) {
                data.metadata.balance = parseInt(balanceSpan.textContent.replace(/[^0-9]/g, '')) || 0;
              }
            }
          }
        });
      }

      // Extract total count
      const totalCountEl = document.querySelector('#totalCnt');
      if (totalCountEl) {
        data.summary.totalCount = parseInt(totalCountEl.textContent.trim()) || 0;
      }

      // Extract current time
      const timeEl = document.querySelector('.text-time');
      if (timeEl) {
        data.summary.queryDate = timeEl.textContent.replace('현재시간 : ', '').trim();
      }

      // Extract transactions from tb3
      const transactionTable = document.querySelector('#tb3');
      if (transactionTable) {
        const rows = transactionTable.querySelectorAll('tbody tr');

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');

          if (cells.length >= 8) {
            // Skip checkbox cell (index 0)

            // Get date and time
            const dateTimeText = cells[1]?.textContent.trim() || '';
            const dateTimeParts = dateTimeText.split(/\s+/);
            const date = dateTimeParts[0] || ''; // "2026/01/16"
            const time = dateTimeParts[1] || ''; // "19:36:11"

            // Get withdrawal amount
            const withdrawalDiv = cells[2]?.querySelector('.text-price');
            const withdrawalText = withdrawalDiv?.textContent.trim() || '0';
            const withdrawal = parseInt(withdrawalText.replace(/[^0-9]/g, '')) || 0;

            // Get deposit amount
            const depositDiv = cells[3]?.querySelector('.text-price');
            const depositText = depositDiv?.textContent.trim() || '0';
            const deposit = parseInt(depositText.replace(/[^0-9]/g, '')) || 0;

            // Get balance
            const balanceDiv = cells[4]?.querySelector('.text-price');
            const balanceText = balanceDiv?.textContent.trim() || '0';
            const balance = parseInt(balanceText.replace(/[^0-9]/g, '')) || 0;

            // Get transaction type (거래내용)
            const type = cells[5]?.textContent.trim() || '';

            // Get description (거래기록사항)
            const description = cells[6]?.textContent.trim() || '';

            // Get branch (거래점)
            const branch = cells[7]?.textContent.trim().replace(/\s+/g, ' ') || '';

            // Get memo (이체메모) - last column
            const memo = cells[8]?.textContent.trim() || '';

            const transaction = {
              date: date.replace(/\//g, '-'), // Convert to YYYY-MM-DD
              time: time,
              type: type,
              withdrawal: withdrawal,
              deposit: deposit,
              balance: balance,
              description: description,
              branch: branch,
              memo: memo
            };

            // Only add if there's actual transaction data
            if (date && (withdrawal > 0 || deposit > 0)) {
              data.transactions.push(transaction);
            }
          }
        });
      }

      return data;
    });

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Account: ${extractedData.metadata.accountOwner} - ${extractedData.metadata.accountType}`);
    this.log(`Balance: ${extractedData.metadata.balance}`);

    return {
      success: true,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup method
   * @param {boolean} [keepOpen=true] - Whether to keep browser open
   */
  async cleanup(keepOpen = true) {
    if (keepOpen) {
      this.log('Keeping browser open for debugging...');
      return;
    }
    await super.cleanup();
  }
}

// Factory function
function createNHBusinessAutomator(options = {}) {
  return new NHBusinessBankAutomator(options);
}

module.exports = {
  NHBusinessBankAutomator,
  createNHBusinessAutomator,
};
