// ============================================================================
// SHINHAN BANK AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { SHINHAN_CONFIG } = require('./config');
const { handleSecurityPopup } = require('./securityPopup');
const {
  typePasswordWithKeyboard,
  findVisibleKeyboard,
  getLowerKeyboardSelectors,
  getUpperKeyboardSelectors,
} = require('./virtualKeyboard');

// Import AI keyboard analysis utilities
const { analyzeKeyboardAndType } = require('../../utils/ai-keyboard-analyzer');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('../../utils/bilingual-keyboard-parser');
const { generateKeyboardVisualization } = require('../../utils/keyboard-visualization');
const { getGeminiApiKey } = require('../../utils/api-keys');

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

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'shinhan');
    this.sessionKeepAliveInterval = null;
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

  /**
   * Captures and analyzes the virtual keyboard
   * @param {Object} page - Playwright page object
   * @returns {Promise<Object>} Keyboard analysis result
   */
  async analyzeVirtualKeyboard(page) {
    const timestamp = this.generateTimestamp();
    this.ensureOutputDirectory(this.outputDir);

    // Step 1: Find LOWER keyboard
    const lowerKeyboard = await findVisibleKeyboard(
      page,
      getLowerKeyboardSelectors(),
      'LOWER',
      this.log.bind(this)
    );

    if (!lowerKeyboard) {
      this.warn('LOWER keyboard not found or not visible');
      throw new Error('LOWER keyboard not found');
    }

    const lowerKeyboardBox = await this.getElementBox(page, `xpath=${lowerKeyboard.selector}`);
    this.log('LOWER keyboard bounds:', lowerKeyboardBox);

    // Step 2: Screenshot LOWER keyboard
    const lowerFilename = `shinhan-keyboard-LOWER-${timestamp}.png`;
    const lowerScreenshotPath = path.join(this.outputDir, lowerFilename);
    await lowerKeyboard.locator.screenshot({ path: lowerScreenshotPath });
    this.log('LOWER keyboard screenshot saved to:', lowerScreenshotPath);

    // Step 3: Get Gemini API key
    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      this.warn('Skipping AI analysis - GEMINI_API_KEY not set');
      throw new Error('Gemini API key not found');
    }

    // Step 4: Analyze LOWER keyboard
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
      this.warn('LOWER keyboard analysis failed:', lowerAnalysisResult.error);
      throw new Error('LOWER keyboard analysis failed');
    }

    this.log('LOWER keyboard analysis completed, found', lowerAnalysisResult.processed, 'keys');

    // Step 5: Find SHIFT key
    const shiftKey = Object.entries(lowerAnalysisResult.keyboardKeys).find(([label]) => {
      return label.toLowerCase().includes('shift');
    });

    if (!shiftKey) {
      this.warn('SHIFT key not found in LOWER keyboard');
      throw new Error('SHIFT key not found');
    }

    const [shiftLabel, shiftData] = shiftKey;
    this.log(`Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);

    // Step 6: Click SHIFT to get UPPER keyboard
    this.log('Clicking SHIFT to switch to UPPER keyboard...');
    await page.mouse.move(shiftData.position.x, shiftData.position.y);
    await page.waitForTimeout(this.config.delays.mouseMove);
    await page.mouse.click(shiftData.position.x, shiftData.position.y);
    await page.waitForTimeout(this.config.delays.keyboardUpdate);

    // Step 7: Find and analyze UPPER keyboard
    let upperAnalysisResult = null;
    let upperScreenshotPath = null;

    const upperKeyboard = await findVisibleKeyboard(
      page,
      getUpperKeyboardSelectors(),
      'UPPER',
      this.log.bind(this)
    );

    if (upperKeyboard) {
      const upperKeyboardBox = await this.getElementBox(page, `xpath=${upperKeyboard.selector}`);
      this.log('UPPER keyboard bounds:', upperKeyboardBox);

      const upperFilename = `shinhan-keyboard-UPPER-${timestamp}.png`;
      upperScreenshotPath = path.join(this.outputDir, upperFilename);
      await upperKeyboard.locator.screenshot({ path: upperScreenshotPath });
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
        this.log('UPPER keyboard analysis completed, found', upperAnalysisResult.processed, 'keys');
      } else {
        this.warn('UPPER keyboard analysis failed:', upperAnalysisResult.error);
      }

      // Click SHIFT again to return to LOWER
      this.log('Clicking SHIFT to return to LOWER keyboard...');
      await page.mouse.click(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(this.config.delays.keyboardUpdate);
    } else {
      this.warn('UPPER keyboard not found, continuing with LOWER only');
    }

    // Step 8: Build combined keyboard JSON
    const keyboardJSON = buildBilingualKeyboardJSON(
      lowerAnalysisResult.keyboardKeys,
      upperAnalysisResult?.keyboardKeys || null
    );

    // Export for debugging
    const jsonFilename = `keyboard-layout-${timestamp}.json`;
    const jsonPath = path.join(this.outputDir, jsonFilename);
    exportKeyboardJSON(
      lowerAnalysisResult.keyboardKeys,
      jsonPath,
      upperAnalysisResult?.keyboardKeys || null
    );
    this.log('Keyboard JSON exported to:', jsonPath);

    // Generate HTML visualization
    try {
      const visualizationFilename = `keyboard-visualization-${timestamp}.html`;
      const visualizationPath = path.join(this.outputDir, visualizationFilename);

      generateKeyboardVisualization({
        screenshotPath: lowerScreenshotPath,
        keyboardBox: lowerKeyboardBox,
        keyboardKeys: lowerAnalysisResult.keyboardKeys,
        segmentationResults: lowerAnalysisResult.segmentationResults,
        password: '***',
        outputPath: visualizationPath
      });

      this.log('HTML visualization saved to:', visualizationPath);
    } catch (vizError) {
      this.warn('Failed to generate HTML visualization:', vizError);
    }

    return {
      keyboardJSON,
      lowerAnalysis: lowerAnalysisResult,
      upperAnalysis: upperAnalysisResult,
      lowerScreenshotPath,
      upperScreenshotPath,
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

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Starts a background task to click the session extension button every 5 minutes
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
   * Clicks the "Extend" (연장) button to keep the session alive
   * @returns {Promise<boolean>} Success status
   */
  async extendSession() {
    if (!this.page) return false;

    this.log('Attempting to extend session...');
    try {
      const extendButtonXPath = `xpath=${this.config.xpaths.extendSessionButton}`;
      
      // Check if button is visible before clicking
      const isVisible = await this.page.locator(extendButtonXPath).isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        await this.clickButton(this.page, this.config.xpaths.extendSessionButton, 'Session extension (연장)');
        this.log('Session extension button clicked successfully');
        return true;
      }
      
      this.warn('Session extension button not visible - session might have already expired or not started');
      return false;
    } catch (error) {
      this.error('Error during session extension:', error.message);
      return false;
    }
  }

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
      await this.page.goto(this.config.xpaths.inquiryUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      // Handle any security popups that might appear during navigation
      await this.handleSecurityPopup(this.page);

      this.log('Clicking "조회" (Inquiry) button...');
      await this.clickButton(this.page, this.config.xpaths.inquiryButton, 'Inquiry (조회)');
      await this.page.waitForTimeout(3000);

      this.log('Searching for accounts...');
      // Extract account information based on the provided text pattern
      // Pattern like: 110-451-909119 [[금융거래한도계좌1]신한 ...]
      const accounts = await this.page.evaluate(() => {
        const results = [];
        
        // Strategy: Look for all text nodes or elements containing the account pattern
        const elements = Array.from(document.querySelectorAll('*'));
        const accountRegex = /(\d{3}-\d{3}-\d{6})/;
        
        elements.forEach(el => {
          // Check if this element directly contains an account number and has minimal children (likely a leaf or near-leaf node)
          if (el.children.length <= 2 && accountRegex.test(el.innerText)) {
            const text = el.innerText.trim();
            const match = text.match(accountRegex);
            
            if (match) {
              const accNum = match[1];
              // Avoid duplicates
              if (!results.some(r => r.accountNumber === accNum)) {
                // Extract clean name from format: 110-451-909119 [[금융거래한도계좌1]신한 ...]
                let cleanName = text.replace(accNum, '').trim();
                // Match the [[...]] pattern if present
                const nameMatch = cleanName.match(/\[\[(.*?)\]\]/);
                if (nameMatch) {
                  cleanName = nameMatch[1];
                }

                results.push({
                  accountNumber: accNum,
                  accountName: cleanName,
                  bankId: 'shinhan',
                  balance: 0,
                  currency: 'KRW',
                  lastUpdated: new Date().toISOString()
                });
              }
            }
          }
        });
        
        return results;
      });

      this.log(`Found ${accounts.length} accounts:`, accounts.map(a => a.accountNumber).join(', '));
      return accounts;
    } catch (error) {
      this.error('Failed to get accounts:', error.message);
      throw error;
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

      // Step 2: Navigate to login page
      this.log('Navigating to:', this.config.targetUrl);
      await this.page.goto(this.config.targetUrl, { waitUntil: 'domcontentloaded' });
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
            '로그인 button'
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
   * Closes browser - override to keep open for debugging
   * @param {boolean} [keepOpen=true] - Whether to keep browser open
   */
  async cleanup(keepOpen = true) {
    this.stopSessionKeepAlive();
    
    if (keepOpen) {
      this.log('Keeping browser open for debugging... Press Ctrl+C to close');
      return;
    }
    await super.cleanup();
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
