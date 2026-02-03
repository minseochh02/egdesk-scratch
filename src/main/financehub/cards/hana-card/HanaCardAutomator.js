// ============================================================================
// HANA CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { BaseCardAutomator } = require('../../core');
const { HANA_CARD_INFO, HANA_CARD_CONFIG } = require('./config');

class HanaCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    const config = {
      ...HANA_CARD_CONFIG,
      targetUrl: HANA_CARD_INFO.loginUrl,
      bank: HANA_CARD_INFO,
      card: HANA_CARD_INFO,
      headless: options.headless ?? false,
      chromeProfile: options.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'hana-card');
    this.downloadDir = path.join(this.outputDir, 'downloads');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;
    this.manualPassword = options.manualPassword ?? false; // Debug mode for manual password entry

    // Ensure output directories exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  // ============================================================================
  // DEBUG MODE - MANUAL PASSWORD ENTRY
  // ============================================================================

  /**
   * Waits for user to press Enter in console after manually typing password
   * @returns {Promise<void>}
   */
  async waitForManualPasswordEntry() {
    this.log('DEBUG MODE: Waiting for manual password entry...');

    const { BrowserWindow, ipcMain } = require('electron');

    return new Promise((resolve, reject) => {
      // Get the main window to send event to renderer
      const mainWindow = BrowserWindow.getAllWindows()[0];

      if (!mainWindow) {
        this.log('No main window found, falling back to timeout');
        // Fallback: just wait 10 seconds
        setTimeout(() => resolve(), 10000);
        return;
      }

      this.log('Sending show-continue event to renderer...');

      // Set up listener BEFORE sending the show event
      const continueHandler = () => {
        this.log('✅ Continue button clicked! Hiding modal and proceeding...');

        try {
          // Clean up listener
          ipcMain.removeListener('manual-password:continue', continueHandler);

          // Hide the modal
          mainWindow.webContents.send('manual-password:hide-continue');

          // Small delay to let modal close
          setTimeout(() => {
            this.log('Resuming automation...');
            resolve();
          }, 300);
        } catch (error) {
          this.log(`Error in continue handler: ${error.message}`, 'error');
          reject(error);
        }
      };

      // Attach listener
      ipcMain.on('manual-password:continue', continueHandler);

      // Now send event to show the modal
      mainWindow.webContents.send('manual-password:show-continue');

      this.log('Modal should now be visible. Waiting for user to click continue...');
    });
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
      this.log('Starting Hana Card automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Setup download path for this page
      this.page._downloadPath = this.downloadDir;

      // Step 2: Navigate to main page
      this.log('Navigating to Hana Card main page...');
      await this.page.goto(this.config.targetUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeouts.pageLoad
      });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Switch to main frame (hsci)
      this.log('Waiting for main frame to load...');
      await this.page.waitForTimeout(2000); // Give frames time to load

      const mainFrame = this.page.frame({ name: 'hsci' }) || this.page.frame({ id: 'hsci' });
      if (!mainFrame) {
        throw new Error('Could not find main frame (hsci)');
      }
      this.log('Successfully found main frame');
      this.mainFrame = mainFrame;

      // Step 4: Handle initial popup if it exists (in frame)
      this.log('Checking for initial popup...');
      await this.handleInitialPopup();

      // Step 5: Click business selector (기업)
      this.log('Clicking business selector (기업)...');
      await this.clickElementInFrame(this.config.xpaths.businessSelector);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Wait for page to load after clicking 기업
      await this.page.waitForTimeout(2000);

      // Step 6: Check for popups again after moving to 기업
      this.log('Checking for popups after navigating to 기업...');
      await this.handleInitialPopup();

      // Step 7: Click login button
      this.log('Clicking login button...');
      await this.clickElementInFrame(this.config.xpaths.loginButton);
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Wait longer for login form to load
      this.log('Waiting for login form to load...');
      await this.page.waitForTimeout(3000);

      // Step 8: Fill user ID (login form should now be visible)
      this.log('Entering user ID...');
      const idLocator = this.getLocatorInFrame(this.config.xpaths.idInput);
      await idLocator.click({ timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await idLocator.fill(userId, { timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 9: Fill password (Arduino HID or Manual)
      this.log('Entering password...');
      const passwordLocator = this.getLocatorInFrame(this.config.xpaths.passwordInput);
      await passwordLocator.click({ timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      if (this.manualPassword) {
        // DEBUG MODE: Manual password entry
        this.log('Manual password mode enabled');
        await passwordLocator.focus({ timeout: this.config.timeouts.elementWait });
        await this.page.waitForTimeout(1500);

        this.log('Waiting for manual password entry...');
        await this.waitForManualPasswordEntry();
        this.log('Manual password entry completed');
      } else {
        // AUTOMATIC MODE: Arduino HID keyboard with app-controlled natural timing (bypasses security keyboard!)
        this.log('Entering password via Arduino HID with natural timing...');
        try {
          await passwordLocator.focus({ timeout: this.config.timeouts.elementWait });
          await this.page.waitForTimeout(this.config.delays.betweenActions);

          await this.typeViaArduinoWithNaturalTiming(password, {
            minDelay: 80,
            maxDelay: 200
          });

          this.log('Password typed via Arduino HID with natural timing');
        } catch (e) {
          this.log(`Arduino HID password entry failed: ${e.message}`, 'error');
          throw new Error(`Password entry failed: ${e.message}`);
        }
      }
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 10: Submit login (press Enter or find submit button)
      this.log('Submitting login form...');
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 11: Start session keep-alive
      this.startSessionKeepAlive();

      this.log('Login successful!');
      return {
        success: true,
        isLoggedIn: true,
        message: 'Successfully logged into Hana Card',
      };
    } catch (error) {
      this.log(`Login failed: ${error.message}`, 'error');

      // Take screenshot on error
      if (this.page) {
        try {
          const errorScreenshot = path.join(this.outputDir, `error-${Date.now()}.png`);
          await this.page.screenshot({ path: errorScreenshot, fullPage: true });
          this.log('Error screenshot saved:', errorScreenshot);
        } catch (e) {
          // Ignore screenshot errors
        }
      }

      return {
        success: false,
        error: error.message,
      };
    } finally {
      await this.disconnectArduino();
    }
  }

  // ============================================================================
  // ARDUINO HID METHODS
  // ============================================================================

  async connectArduino() {
    if (!this.arduinoPort) {
      throw new Error('Arduino port not configured. Pass arduinoPort in options (e.g. "COM6")');
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

  async typeViaArduino(text) {
    if (!this.arduino) {
      await this.connectArduino();
    }
    return new Promise((resolve, reject) => {
      this.arduino.write(text + '\n', (err) => {
        if (err) return reject(err);
        this.log(`Sent ${text.length} chars to Arduino HID`);
        const typingTime = text.length * 950 + 800;
        setTimeout(() => resolve(), typingTime);
      });
    });
  }

  /**
   * Type password character-by-character via Arduino with app-controlled natural timing
   * @param {string} text - Text to type
   * @param {Object} options - Timing options
   * @param {number} options.minDelay - Minimum delay between characters in ms (default: 80)
   * @param {number} options.maxDelay - Maximum delay between characters in ms (default: 200)
   */
  async typeViaArduinoWithNaturalTiming(text, options = {}) {
    const { minDelay = 80, maxDelay = 200 } = options;

    if (!this.arduino) {
      await this.connectArduino();
    }

    this.log(`Typing ${text.length} characters with natural timing (${minDelay}-${maxDelay}ms delays)`);

    // Type each character individually
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Send single character to Arduino
      await new Promise((resolve, reject) => {
        this.arduino.write(char + '\n', (err) => {
          if (err) return reject(err);

          // Wait for Arduino to finish typing this character
          // Arduino takes ~950ms per character based on its programming
          setTimeout(() => resolve(), 950);
        });
      });

      // Progress logging
      if ((i + 1) % 5 === 0) {
        this.log(`Password progress: ${i + 1}/${text.length}`);
      }

      // Add variable delay before next character (except after last char)
      if (i < text.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.log(`Completed typing ${text.length} characters`);
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
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Handles initial popup if it exists (in main frame)
   */
  async handleInitialPopup() {
    try {
      this.log('Waiting for initial popup...');
      const popupLocator = this.mainFrame.locator(`xpath=${this.config.xpaths.initialPopup}`);

      const isVisible = await popupLocator.isVisible({ timeout: this.config.timeouts.popupWait });

      if (isVisible) {
        this.log('Initial popup found, closing it...');
        await this.clickElementInFrame(this.config.xpaths.initialPopupClose);
        await this.page.waitForTimeout(1000);
        this.log('Initial popup closed');
      } else {
        this.log('No initial popup found, skipping');
      }
    } catch (e) {
      // If popup doesn't exist, just continue
      this.log('No initial popup detected (timeout), continuing...');
    }
  }

  /**
   * Helper to get locator in frame (supports both CSS and XPath)
   */
  getLocatorInFrame(selector) {
    // If selector starts with # or . it's CSS, if starts with / or // it's XPath
    if (selector.startsWith('#') || selector.startsWith('.')) {
      return this.mainFrame.locator(selector);
    } else {
      return this.mainFrame.locator(`xpath=${selector}`);
    }
  }

  /**
   * Helper to click element in main frame (supports both CSS and XPath)
   */
  async clickElementInFrame(selector) {
    const locator = this.getLocatorInFrame(selector);
    await locator.click({ timeout: this.config.timeouts.elementWait });
  }

  /**
   * Gets all cards for the logged-in user
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Getting card list...');

      // For now, return a default card structure
      // This can be enhanced later to navigate to card list page and extract actual cards
      return [{
        cardNumber: 'default',
        cardName: 'Hana Card',
        cardCompanyId: 'hana-card',
        cardType: 'corporate',
      }];

    } catch (error) {
      this.error('Failed to get cards:', error.message);
      throw error;
    }
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('Hana Card transaction fetching is not yet implemented');
  }
}

function createHanaCardAutomator(options = {}) {
  return new HanaCardAutomator(options);
}

async function runHanaCardAutomation(credentials) {
  const automator = createHanaCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  HanaCardAutomator,
  createHanaCardAutomator,
  runHanaCardAutomation,
};
