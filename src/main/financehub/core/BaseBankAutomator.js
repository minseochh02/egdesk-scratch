// ============================================================================
// BASE BANK AUTOMATOR
// ============================================================================
// Abstract base class that all bank automators should extend

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import keyboard analysis utilities
const { analyzeKeyboardAndType } = require('../utils/ai-keyboard-analyzer');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('../utils/bilingual-keyboard-parser');
const { getGeminiApiKey } = require('../utils/api-keys');
const { handleWindowsPasswordInput: utilHandleWindowsPasswordInput } = require('../utils/windowsKeyboardInput');

/**
 * @typedef {import('../types').BankAutomationConfig} BankAutomationConfig
 * @typedef {import('../types').BankCredentials} BankCredentials
 * @typedef {import('../types').AutomationResult} AutomationResult
 * @typedef {import('../types').ProxyConfig} ProxyConfig
 * @typedef {import('../types').BrowserSetupResult} BrowserSetupResult
 */

class BaseBankAutomator {
  /**
   * @param {BankAutomationConfig} config
   */
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.outputDir = path.join(process.cwd(), 'output', config.bank.id);
    this.sessionKeepAliveInterval = null;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Builds proxy configuration from URL string
   * @param {string} proxyUrl - Proxy URL string
   * @returns {ProxyConfig|undefined}
   */
  buildProxyOption(proxyUrl) {
    try {
      if (!proxyUrl) return undefined;
      const u = new URL(String(proxyUrl));
      const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
      const proxy = { server };
      if (u.username) proxy.username = decodeURIComponent(u.username);
      if (u.password) proxy.password = decodeURIComponent(u.password);
      return proxy;
    } catch {
      return undefined;
    }
  }

  /**
   * Ensures output directory exists
   * @param {string} dirPath - Directory path
   */
  ensureOutputDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log('Created output directory:', dirPath);
      }
    } catch (error) {
      this.warn('Failed to create output directory:', error);
    }
  }

  /**
   * Generates timestamp string for filenames
   * @returns {string}
   */
  generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Gets element bounding box
   * @param {Object} pageOrFrame - Playwright page or frame
   * @param {string} selector - XPath or CSS selector
   * @returns {Promise<Object|null>}
   */
  async getElementBox(pageOrFrame, selector) {
    try {
      const locator = pageOrFrame.locator(selector);
      if (await locator.count()) {
        await locator.scrollIntoViewIfNeeded();
        await pageOrFrame.waitForTimeout(this.config.timeouts.scrollWait);

        const handle = await locator.first().elementHandle();
        if (handle) {
          const box = await handle.boundingBox();
          if (box) return { x: box.x, y: box.y, width: box.width, height: box.height };
          
          const rect = await handle.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          return rect;
        }
      }
    } catch {}
    return null;
  }

  // ============================================================================
  // LOGGING METHODS
  // ============================================================================

  /**
   * Log with bank prefix
   * @param  {...any} args
   */
  log(...args) {
    console.log(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  /**
   * Warn with bank prefix
   * @param  {...any} args
   */
  warn(...args) {
    console.warn(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  /**
   * Error with bank prefix
   * @param  {...any} args
   */
  error(...args) {
    console.error(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  // ============================================================================
  // BROWSER SETUP
  // ============================================================================

  /**
   * Creates and configures browser instance
   * @param {ProxyConfig} [proxy] - Proxy configuration
   * @returns {Promise<BrowserSetupResult>}
   */
  async createBrowser(proxy) {
    const explicitProfilePath = this.config.chromeProfile?.trim() || null;
    let persistentProfileDir = explicitProfilePath;

    if (!persistentProfileDir) {
      try {
        const tempPrefix = path.join(os.tmpdir(), `egdesk-chrome-${this.config.bank.id}-`);
        persistentProfileDir = fs.mkdtempSync(tempPrefix);
        this.log('Using temporary Chrome profile directory:', persistentProfileDir);
      } catch (e) {
        this.warn('Failed to create temp Chrome profile:', e?.message || e);
      }
    }

    const args = [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-features=PrivateNetworkAccessSendPreflights',
      '--disable-features=PrivateNetworkAccessRespectPreflightResults',
    ];

    // Add cache-disabling flags if configured
    if (this.config.disableCache) {
      args.push(
        '--disable-application-cache',
        '--disable-cache',
        '--disable-offline-load-stale-cache',
        '--disk-cache-size=0',
        '--media-cache-size=0'
      );
    }

    const launchOptions = {
      headless: this.config.headless,
      channel: 'chrome',
      proxy,
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 },
      permissions: ['clipboard-read', 'clipboard-write'],
      args
    };

    if (persistentProfileDir) {
      const context = await chromium.launchPersistentContext(persistentProfileDir, launchOptions);
      return { browser: context, context };
    }

    // Fallback non-persistent context
    const browser = await chromium.launch({
      headless: this.config.headless,
      channel: 'chrome',
      proxy,
      args
    });

    const context = await browser.newContext({
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 }
    });

    return { browser, context };
  }

  /**
   * Sets up browser context with routing and navigation handling
   * @param {Object} context - Playwright browser context
   * @param {Object} [page] - Playwright page object
   */
  async setupBrowserContext(context, page = null) {
    const { targetUrl, undesiredHostnames } = this.config;

    // Intercept unwanted hostnames
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        const isDocument = request.resourceType() === 'document';
        const url = new URL(request.url());
        if (isDocument && undesiredHostnames.includes(url.hostname)) {
          return route.fulfill({ status: 302, headers: { location: targetUrl } });
        }
      } catch {}
      return route.continue();
    });

    // Handle frame navigation
    if (page) {
      page.on('framenavigated', (frame) => {
        try {
          if (frame === page.mainFrame()) {
            const u = new URL(frame.url());
            if (undesiredHostnames.includes(u.hostname)) {
              page.goto(targetUrl).catch(() => {});
            }
          }
        } catch {}
      });
    }
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  /**
   * Fills input field with fallback to frames
   * @param {Object} page - Playwright page object
   * @param {string} xpath - XPath selector
   * @param {string} value - Value to fill
   * @param {string} fieldName - Field name for logging
   * @returns {Promise<boolean>}
   */
  async fillInputField(page, xpath, value, fieldName) {
    try {
      this.log(`Attempting to fill ${fieldName} input field...`);
      await page.waitForSelector(`xpath=${xpath}`, { timeout: this.config.timeouts.elementWait });
      const locator = page.locator(`xpath=${xpath}`);

      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(this.config.timeouts.scrollWait);

      await locator.click({ timeout: this.config.timeouts.click }).catch(() => {});
      await locator.fill(value).catch(async () => {
        await locator.type(value).catch(() => {});
      });
      this.log(`Successfully filled ${fieldName} input field`);
      return true;
    } catch (error) {
      this.warn(`Failed to fill ${fieldName} input field:`, error.message);

      // Fallback: search in frames
      try {
        const frames = page.frames();
        for (const frame of frames) {
          try {
            const handle = await frame.waitForSelector(`xpath=${xpath}`, { 
              timeout: this.config.timeouts.frameSearch 
            });
            if (handle) {
              await handle.click({ timeout: this.config.timeouts.frameSearch }).catch(() => {});
              try {
                await handle.fill(value);
                this.log(`Successfully filled ${fieldName} input field in frame`);
                return true;
              } catch {
                await handle.type(value).catch(() => {});
                return true;
              }
            }
          } catch {}
        }
      } catch {}
      return false;
    }
  }

  /**
   * Clicks a button/element with fallbacks
   * @param {Object} page - Playwright page object
   * @param {string} xpath - XPath selector
   * @param {string} buttonName - Button name for logging
   * @returns {Promise<boolean>}
   */
  async clickButton(page, xpath, buttonName) {
    try {
      this.log(`Attempting to click ${buttonName}...`);
      const locator = page.locator(`xpath=${xpath}`);

      await locator.waitFor({ state: 'visible', timeout: this.config.timeouts.elementWait });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(this.config.timeouts.scrollWait);
      await locator.click({ timeout: this.config.timeouts.click });

      this.log(`Successfully clicked ${buttonName}`);
      return true;
    } catch (error) {
      this.warn(`Failed to click ${buttonName}:`, error.message);

      // Fallback: force click
      try {
        this.log('Trying force click...');
        const locator = page.locator(`xpath=${xpath}`);
        await locator.click({ force: true, timeout: this.config.timeouts.click });
        this.log('Force click succeeded');
        return true;
      } catch (forceError) {
        this.warn('Force click failed:', forceError.message);
      }

      // Fallback: JavaScript click
      try {
        this.log('Trying JavaScript click...');
        await page.evaluate((xp) => {
          const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const element = result.singleNodeValue;
          if (element) {
            element.click();
            return true;
          }
          throw new Error('Element not found');
        }, xpath);
        this.log('JavaScript click succeeded');
        return true;
      } catch (jsError) {
        this.error('JavaScript click failed:', jsError.message);
      }

      return false;
    }
  }

  // ============================================================================
  // ABSTRACT METHODS (to be implemented by subclasses)
  // ============================================================================

  /**
   * Main login method - MUST be implemented by subclasses
   * @param {BankCredentials} credentials
   * @param {string} [proxyUrl]
   * @returns {Promise<AutomationResult>}
   */
  async login(credentials, proxyUrl) {
    throw new Error('login() must be implemented by subclass');
  }

  /**
   * Handle security popup - can be overridden by subclasses
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async handleSecurityPopup(page) {
    // Default implementation - no popup handling
    return true;
  }

  /**
   * Handle virtual keyboard - can be overridden by subclasses
   * @param {Object} page - Playwright page object
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async handleVirtualKeyboard(page, password) {
    // Default implementation - no virtual keyboard
    return { success: true, typedChars: 0, totalChars: password.length };
  }

  // ============================================================================
  // VIRTUAL KEYBOARD ANALYSIS (Shared Implementation)
  // ============================================================================

  /**
   * Gets keyboard configuration - override in subclasses if needed
   * @returns {Object} Keyboard configuration
   */
  getKeyboardConfig() {
    return {
      lowerSelectors: this.config.xpaths.keyboardLowerSelectors || [],
      upperSelectors: this.config.xpaths.keyboardUpperSelectors || [],
      shiftKeyPatterns: ['shift', '⇧', '↑'],
      screenshotPrefix: this.config.bank.id + '-keyboard'
    };
  }

  /**
   * Gets Gemini API key with error handling
   * @returns {string} API key
   * @throws {Error} If API key not found
   */
  getGeminiApiKeyOrFail() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      this.warn('Skipping AI analysis - GEMINI_API_KEY not set');
      throw new Error('Gemini API key not found');
    }
    return apiKey;
  }

  /**
   * Analyzes virtual keyboard using Gemini Vision AI
   * Banks can override getKeyboardConfig() to customize selectors
   * @param {Object} page - Playwright page object
   * @returns {Promise<Object>} Keyboard analysis result
   */
  async analyzeVirtualKeyboard(page) {
    const timestamp = this.generateTimestamp();
    this.ensureOutputDirectory(this.outputDir);

    try {
      // Get bank-specific configuration
      const keyboardConfig = this.getKeyboardConfig();

      // Step 1: Find LOWER keyboard
      const lowerKeyboard = await this.findVisibleKeyboard(
        page,
        keyboardConfig.lowerSelectors,
        'LOWER'
      );

      if (!lowerKeyboard) {
        throw new Error('LOWER keyboard not found or not visible');
      }

      // Step 2: Screenshot and analyze LOWER keyboard
      const lowerResult = await this.analyzeKeyboardLayout(
        page,
        lowerKeyboard,
        'LOWER',
        timestamp
      );

      // Step 3: Find SHIFT key
      const shiftKey = this.findShiftKey(lowerResult.keyboardKeys);

      if (!shiftKey) {
        this.warn('SHIFT key not found in LOWER keyboard');
        return this.buildKeyboardResult(lowerResult, null, timestamp);
      }

      // Step 4: Activate SHIFT and analyze UPPER keyboard
      const upperResult = await this.analyzeShiftedKeyboard(
        page,
        shiftKey,
        keyboardConfig.upperSelectors,
        timestamp
      );

      // Step 5: Build combined result
      return this.buildKeyboardResult(lowerResult, upperResult, timestamp);

    } catch (error) {
      this.error('Virtual keyboard analysis failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Finds a visible virtual keyboard from a list of selectors
   * @param {Object} page - Playwright page object
   * @param {Array} selectors - List of XPaths to try
   * @param {string} label - Label for logging
   * @returns {Promise<Object|null>} Found keyboard or null
   */
  async findVisibleKeyboard(page, selectors, label) {
    this.log(`Looking for ${label} keyboard...`);

    for (const selector of selectors) {
      try {
        const locator = page.locator(`xpath=${selector}`);
        const count = await locator.count();

        if (count > 0) {
          const isVisible = await locator.first().isVisible({ timeout: 1000 });
          if (isVisible) {
            this.log(`Found visible ${label} keyboard with selector: ${selector}`);
            return {
              locator: locator.first(),
              selector: selector
            };
          }
        }
      } catch (e) {
        // Try next selector
      }
    }

    return null;
  }

  /**
   * Analyzes a single keyboard layout (LOWER or UPPER)
   * @param {Object} page - Playwright page
   * @param {Object} keyboard - Keyboard element info
   * @param {string} type - 'LOWER' or 'UPPER'
   * @param {string} timestamp - Timestamp for filenames
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeKeyboardLayout(page, keyboard, type, timestamp) {
    const config = this.getKeyboardConfig();

    // Get keyboard bounds
    const keyboardBox = await this.getElementBox(page, `xpath=${keyboard.selector}`);
    this.log(`${type} keyboard bounds:`, keyboardBox);

    // Take screenshot
    const screenshotFilename = `${config.screenshotPrefix}-${type}-${timestamp}.png`;
    const screenshotPath = path.join(this.outputDir, screenshotFilename);
    await keyboard.locator.screenshot({ path: screenshotPath });
    this.log(`${type} keyboard screenshot saved to:`, screenshotPath);

    // Get Gemini API key
    const geminiApiKey = this.getGeminiApiKeyOrFail();

    // Analyze with Gemini Vision
    this.log(`Analyzing ${type} keyboard with Gemini Vision...`);
    const analysisResult = await analyzeKeyboardAndType(
      screenshotPath,
      geminiApiKey,
      keyboardBox,
      null, // Don't type yet
      null, // Don't pass page yet
      {}
    );

    if (!analysisResult.success) {
      throw new Error(`${type} keyboard analysis failed: ${analysisResult.error}`);
    }

    this.log(`${type} keyboard analysis completed, found ${analysisResult.processed} keys`);

    return {
      analysisResult,
      screenshotPath,
      keyboardBox,
      keyboardKeys: analysisResult.keyboardKeys
    };
  }

  /**
   * Finds SHIFT key in keyboard mapping
   * @param {Object} keyboardKeys - Keyboard keys from analysis
   * @returns {Array|null} [label, keyData] or null
   */
  findShiftKey(keyboardKeys) {
    const config = this.getKeyboardConfig();

    return Object.entries(keyboardKeys).find(([label]) => {
      const lowerLabel = label.toLowerCase();
      return config.shiftKeyPatterns.some(pattern =>
        lowerLabel.includes(pattern.toLowerCase()) || label === pattern
      );
    });
  }

  /**
   * Analyzes shifted (UPPER) keyboard layout
   * @param {Object} page - Playwright page
   * @param {Array} shiftKey - [label, keyData] from findShiftKey
   * @param {Array} upperSelectors - Selectors for UPPER keyboard
   * @param {string} timestamp - Timestamp for filenames
   * @returns {Promise<Object|null>} Upper analysis result or null
   */
  async analyzeShiftedKeyboard(page, shiftKey, upperSelectors, timestamp) {
    const [shiftLabel, shiftData] = shiftKey;
    this.log(`Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);

    // Click SHIFT to activate UPPER keyboard
    this.log('Clicking SHIFT to switch to UPPER keyboard...');
    await page.mouse.move(shiftData.position.x, shiftData.position.y);
    await page.waitForTimeout(this.config.delays.mouseMove);
    await page.mouse.click(shiftData.position.x, shiftData.position.y);
    await page.waitForTimeout(this.config.delays.keyboardUpdate);

    // Find UPPER keyboard
    const upperKeyboard = await this.findVisibleKeyboard(
      page,
      upperSelectors,
      'UPPER'
    );

    let upperResult = null;

    if (upperKeyboard) {
      upperResult = await this.analyzeKeyboardLayout(
        page,
        upperKeyboard,
        'UPPER',
        timestamp
      );

      // Click SHIFT again to return to LOWER
      this.log('Clicking SHIFT to return to LOWER keyboard...');
      await page.mouse.click(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(this.config.delays.keyboardUpdate);
    } else {
      this.warn('UPPER keyboard not found, continuing with LOWER only');
    }

    return upperResult;
  }

  /**
   * Builds final keyboard analysis result
   * @param {Object} lowerResult - LOWER keyboard analysis
   * @param {Object|null} upperResult - UPPER keyboard analysis
   * @param {string} timestamp - Timestamp
   * @returns {Object} Combined keyboard result
   */
  buildKeyboardResult(lowerResult, upperResult, timestamp) {
    const keyboardJSON = buildBilingualKeyboardJSON(
      lowerResult.keyboardKeys,
      upperResult?.keyboardKeys || null
    );

    // Export for debugging
    const jsonFilename = `keyboard-layout-${timestamp}.json`;
    const jsonPath = path.join(this.outputDir, jsonFilename);
    exportKeyboardJSON(
      lowerResult.keyboardKeys,
      jsonPath,
      upperResult?.keyboardKeys || null
    );
    this.log('Keyboard JSON exported to:', jsonPath);

    return {
      keyboardJSON,
      lowerAnalysis: lowerResult.analysisResult,
      upperAnalysis: upperResult?.analysisResult || null,
      lowerScreenshotPath: lowerResult.screenshotPath,
      upperScreenshotPath: upperResult?.screenshotPath || null
    };
  }

  // ============================================================================
  // WINDOWS PASSWORD INPUT (Shared Implementation)
  // ============================================================================

  /**
   * Checks if current platform is Windows
   * @returns {boolean} True if running on Windows
   */
  isWindows() {
    return os.platform() === 'win32';
  }

  /**
   * Creates standardized error result for password operations
   * @param {number} passwordLength - Length of password
   * @param {string} errorMessage - Error message
   * @param {string} [method] - Method that failed
   * @returns {Object} Standardized error result
   */
  createPasswordErrorResult(passwordLength, errorMessage, method = 'unknown') {
    return {
      success: false,
      error: errorMessage,
      totalChars: passwordLength,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: [],
      method: method
    };
  }

  /**
   * Handles password input based on platform
   * Windows: Uses keyboard input (if enabled)
   * Other platforms: Uses virtual keyboard
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to type
   * @returns {Promise<Object>} Typing result
   */
  async handlePasswordInput(page, password) {
    try {
      // Check if Windows platform and if Windows keyboard mode is enabled
      if (this.isWindows() && this.config.useWindowsKeyboard !== false) {
        this.log('Windows platform detected, using keyboard input method...');
        return await this.handleWindowsPasswordInput(page, password);
      } else {
        this.log('Using virtual keyboard method...');
        return await this.handleVirtualKeyboard(page, password);
      }
    } catch (error) {
      this.error('Password input failed:', error.message);
      return this.createPasswordErrorResult(password.length, error.message);
    }
  }

  /**
   * Windows keyboard input handler
   * Uses the shared Windows keyboard utility with smart fallback
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to type
   * @returns {Promise<Object>} Typing result
   */
  async handleWindowsPasswordInput(page, password) {
    try {
      this.log('Using Windows keyboard input for password entry...');

      const typingResult = await utilHandleWindowsPasswordInput(
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
      return this.createPasswordErrorResult(
        password.length,
        error.message,
        'windows_keyboard_failed'
      );
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT (Shared Implementation)
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
  // CLEANUP
  // ============================================================================

  /**
   * Closes browser and cleans up resources
   * @param {boolean} [keepOpen=true] - Whether to keep browser open for debugging
   */
  async cleanup(keepOpen = true) {
    this.stopSessionKeepAlive();

    // CRITICAL: Always disconnect Arduino (even if keeping browser open)
    // Arduino connections must be closed to free the serial port
    if (this.arduino) {
      try {
        await this.disconnectArduino();
      } catch (error) {
        this.warn('Failed to disconnect Arduino:', error.message);
      }
    }

    if (keepOpen) {
      this.log('Keeping browser open for debugging...');
      return;
    }

    if (this.browser) {
      try {
        await this.browser.close();
        this.log('Browser closed');
      } catch (error) {
        this.warn('Failed to close browser:', error.message);
      }
    }
  }

  async disconnectArduino() {
    if (this.arduino) {
      try {
        // Check if port is open before attempting to close
        if (this.arduino.isOpen) {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.warn('Arduino disconnect timeout - forcing cleanup');
              this.arduino = null;
              resolve();
            }, 5000); // 5 second timeout

            this.arduino.close((err) => {
              clearTimeout(timeout);
              if (err) {
                this.warn(`Arduino disconnect error: ${err.message}`);
              } else {
                this.log('Arduino disconnected');
              }
              this.arduino = null;
              resolve();
            });
          });
        } else {
          // Port exists but not open - just clear reference
          this.log('Arduino port not open, clearing reference');
          this.arduino = null;
        }
      } catch (error) {
        this.warn(`Arduino disconnect exception: ${error.message}`);
        this.arduino = null; // Force cleanup
      }
    }
  }
}

module.exports = { BaseBankAutomator };
