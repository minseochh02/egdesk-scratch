// ============================================================================
// HANA CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');
const XLSX = require('xlsx');
const { BaseCardAutomator } = require('../../core');
const { HANA_CARD_INFO, HANA_CARD_CONFIG } = require('./config');

/**
 * Clean card number by removing company name prefixes and extra whitespace
 * @param {string} cardNumber - Raw card number from Excel
 * @returns {string} Cleaned card number
 */
function cleanCardNumber(cardNumber) {
  if (!cardNumber) return '';

  // Remove common card company prefixes
  const prefixes = [
    'BC카드',
    'KB국민카드', 'KB카드',
    'NH농협카드', 'NH카드',
    '신한카드',
    '삼성카드',
    '현대카드',
    '롯데카드',
    '하나카드'
  ];

  let cleaned = String(cardNumber);
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(new RegExp(`^${prefix}\\s*`, 'g'), '');
  }

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

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

    this.outputDir = options.outputDir || this.getSafeOutputDir('hana-card');
    this.downloadDir = path.join(this.outputDir, 'downloads');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;
    this.manualPassword = options.manualPassword ?? false; // Debug mode for manual password entry
    this.isOnTransactionsPage = false; // Track if we're already on transactions page
    this.cachedDepartments = null; // Store parsed departments to reuse across getCards and getTransactions

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

      let mainFrame = null;
      const initialFrames = this.page.frames();
      this.log(`Searching for hsci frame among ${initialFrames.length} frames...`);

      for (const frame of initialFrames) {
        if (frame.name() === 'hsci') {
          mainFrame = frame;
          break;
        }
      }

      if (!mainFrame) {
        throw new Error('Could not find main frame (hsci)');
      }
      this.log('Successfully found main frame');
      this.mainFrame = mainFrame;

      // Step 4: Handle initial popup if it exists (in frame)
      this.log('Checking for initial popup...');
      await this.handleInitialPopup();

      // Step 5: Click business selector (기업) with fallback
      this.log('Clicking business selector (기업)...');
      try {
        // Try primary selector first
        this.log('Trying primary business selector...');
        await this.clickElementInFrame(this.config.xpaths.businessSelector);
        this.log('Primary business selector clicked successfully');
      } catch (primaryError) {
        // If primary fails, try backup selector
        this.log(`Primary business selector failed: ${primaryError.message}, trying backup...`);
        if (this.config.xpaths.businessSelectorBackup) {
          await this.clickElementInFrame(this.config.xpaths.businessSelectorBackup);
          this.log('Backup business selector clicked successfully');
        } else {
          throw new Error(`Business selector failed and no backup configured: ${primaryError.message}`);
        }
      }
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

      // Step 8: Find the login form - it might be in a different frame or newly loaded frame
      this.log('Searching for login form in frames...');

      // Try to find login form in all frames
      const allFrames = this.page.frames();
      this.log(`Found ${allFrames.length} frames total`);

      let loginFrame = null;
      let idLocator = null;

      // First try the main frame (hsci)
      try {
        idLocator = this.mainFrame.locator(`xpath=${this.config.xpaths.idInput}`);
        const isVisible = await idLocator.isVisible({ timeout: 2000 });
        if (isVisible) {
          this.log('Login form found in main frame (hsci)');
          loginFrame = this.mainFrame;
        }
      } catch (e) {
        this.log('Login form not in main frame, searching other frames...');
      }

      // If not found in main frame, search all frames
      if (!loginFrame) {
        for (const frame of allFrames) {
          try {
            const testLocator = frame.locator(`xpath=${this.config.xpaths.idInput}`);
            const isVisible = await testLocator.isVisible({ timeout: 1000 });
            if (isVisible) {
              this.log(`Login form found in frame: ${frame.name() || frame.url()}`);
              loginFrame = frame;
              idLocator = testLocator;
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }

      if (!loginFrame || !idLocator) {
        throw new Error('Could not find login form in any frame');
      }

      // Step 8: Fill user ID
      this.log('Entering user ID...');
      await idLocator.click({ timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await idLocator.fill(userId, { timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 9: Fill password (Arduino HID or Manual)
      this.log('Entering password...');
      const passwordLocator = loginFrame.locator(`xpath=${this.config.xpaths.passwordInput}`);
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

      // Step 10: Submit login by clicking the login button
      this.log('Clicking login submit button...');
      const loginSubmitButton = loginFrame.locator(`xpath=${this.config.xpaths.loginSubmitButton}`);
      await loginSubmitButton.click({ timeout: this.config.timeouts.elementWait });
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 11: Handle post-login popup if it exists (do this first before frame context)
      this.log('Checking for post-login popup...');
      await this.page.waitForTimeout(2000); // Give page time to load popup
      await this.handlePostLoginPopup();

      // Step 12: Re-establish frame context after login and popup (page may have reloaded)
      this.log('Re-establishing frame context after login...');
      await this.page.waitForTimeout(1000); // Give frames time to reload

      // Find the hsci frame by name
      let newMainFrame = null;
      const postLoginFrames = this.page.frames();
      this.log(`Searching for hsci frame among ${postLoginFrames.length} frames...`);

      for (const frame of postLoginFrames) {
        const frameName = frame.name();
        const frameUrl = frame.url();
        this.log(`Frame: name="${frameName}", url="${frameUrl}"`);

        if (frameName === 'hsci') {
          newMainFrame = frame;
          this.log(`Found hsci frame by name`);
          break;
        }
      }

      if (newMainFrame) {
        this.mainFrame = newMainFrame;
        this.log('Successfully re-established main frame (hsci) after login');
      } else {
        this.log('Warning: Could not find main frame (hsci) after login, using existing reference');
      }

      // Step 13: Start session keep-alive
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
   * Handles post-login popup if it exists (on main page or in frames)
   */
  async handlePostLoginPopup() {
    try {
      this.log('Waiting for post-login popup...');

      // Try multiple strategies to find and close the popup

      // Strategy 1: Try the configured XPath on main page
      try {
        const popupLocator = this.page.locator(`xpath=${this.config.xpaths.postLoginPopupClose}`);
        const isVisible = await popupLocator.isVisible({ timeout: 3000 });
        if (isVisible) {
          this.log('Post-login popup found on main page, closing it...');
          await popupLocator.click({ timeout: this.config.timeouts.elementWait });
          await this.page.waitForTimeout(1000);
          this.log('Post-login popup closed');
          return;
        }
      } catch (e) {
        this.log('Popup not found on main page, trying frames...');
      }

      // Strategy 2: Search all frames for the popup
      const popupFrames = this.page.frames();
      for (const frame of popupFrames) {
        try {
          const popupLocator = frame.locator(`xpath=${this.config.xpaths.postLoginPopupClose}`);
          const isVisible = await popupLocator.isVisible({ timeout: 1000 });
          if (isVisible) {
            this.log(`Post-login popup found in frame: ${frame.name() || frame.url()}, closing it...`);
            await popupLocator.click({ timeout: this.config.timeouts.elementWait });
            await this.page.waitForTimeout(1000);
            this.log('Post-login popup closed');
            return;
          }
        } catch (e) {
          // Continue searching
        }
      }

      // Strategy 3: Try common close button selectors
      const commonSelectors = [
        'button[class*="close"]',
        'button[class*="btn-close"]',
        'a[class*="close"]',
        '.modal button',
        '.popup button',
      ];

      for (const selector of commonSelectors) {
        try {
          const closeButton = this.page.locator(selector).first();
          const isVisible = await closeButton.isVisible({ timeout: 1000 });
          if (isVisible) {
            this.log(`Post-login popup close button found with selector: ${selector}`);
            await closeButton.click({ timeout: this.config.timeouts.elementWait });
            await this.page.waitForTimeout(1000);
            this.log('Post-login popup closed');
            return;
          }
        } catch (e) {
          // Continue trying
        }
      }

      this.log('No post-login popup found after trying all strategies');
    } catch (e) {
      this.log(`Error handling post-login popup: ${e.message}`, 'error');
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
   * Cards are listed on the transactions page (승인내역) under each department/branch
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Getting card list from transactions page...');

      // Step 1: Navigate to transactions page (승인내역) only if not already there
      if (!this.isOnTransactionsPage) {
        this.log('Navigating to transactions page (승인내역)...');
        await this.clickElementInFrame(this.config.xpaths.transactionButton);
        await this.page.waitForTimeout(this.config.delays.afterNavigation);
        this.isOnTransactionsPage = true;
      } else {
        this.log('Already on transactions page, skipping navigation');
      }

      // Step 2: Wait for organization tree and card table to load
      this.log('Waiting for organization tree to load...');
      await this.page.waitForTimeout(2000);

      // Step 3: Parse organization tree to get all departments
      this.log('Parsing organization tree to get all departments...');
      const treeLocator = this.getLocatorInFrame(this.config.xpaths.organizationTree);
      const isTreeVisible = await treeLocator.isVisible({ timeout: this.config.timeouts.elementWait });

      if (!isTreeVisible) {
        throw new Error('Organization tree not visible');
      }

      this.log('Organization tree found');
      const treeHTML = await treeLocator.innerHTML();
      const departments = this.parseOrganizationTree(treeHTML);

      if (departments.length === 0) {
        throw new Error('No departments found in organization tree');
      }

      // Cache departments list for reuse in getTransactions
      this.cachedDepartments = departments;
      this.log(`Cached ${departments.length} departments for future use`);

      // Step 4: Iterate through all departments and collect cards
      const allCards = [];
      const cardsByDepartment = new Map(); // Track cards by department to avoid duplicates

      for (const dept of departments) {
        this.log(`\n--- Checking cards for department ${dept.name} ---`);

        // Select department
        await this.selectDepartment(dept.id, dept.name);
        await this.page.waitForTimeout(1000);

        // Find the card table in frames
        this.log('Searching for card table in frames...');
        const cardFrames = this.page.frames();
        let cardTableFrame = null;
        let cardTableBody = null;

        // Search all frames for the card table
        for (const frame of cardFrames) {
          try {
            const testLocator = frame.locator(this.config.xpaths.cardTableBody);
            const isVisible = await testLocator.isVisible({ timeout: 2000 });
            if (isVisible) {
              this.log(`Card table found in frame: ${frame.name() || frame.url()}`);
              cardTableFrame = frame;
              cardTableBody = testLocator;
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }

        if (cardTableFrame && cardTableBody) {
          // Parse card table for this department
          const cardTableHTML = await cardTableBody.innerHTML();
          const deptCards = this.parseCardTable(cardTableHTML);

          this.log(`Found ${deptCards.length} cards for ${dept.name}`);

          // Add department info to each card and deduplicate by card number
          for (const card of deptCards) {
            card.departments = card.departments || [];
            card.departments.push({
              id: dept.id,
              name: dept.name
            });

            // Use card number as unique key
            if (!cardsByDepartment.has(card.cardNumber)) {
              cardsByDepartment.set(card.cardNumber, card);
            } else {
              // Card already exists, just add this department to its list
              const existingCard = cardsByDepartment.get(card.cardNumber);
              existingCard.departments.push({
                id: dept.id,
                name: dept.name
              });
            }
          }
        } else {
          this.log(`No card table found for department ${dept.name}`);
        }
      }

      // Convert map to array
      allCards.push(...Array.from(cardsByDepartment.values()));

      this.log(`\n=== Total unique cards found: ${allCards.length} ===`);
      return allCards;

    } catch (error) {
      this.log('Failed to get cards:', error.message);
      throw error;
    }
  }

  /**
   * Parses the card table HTML to extract card information
   * @param {string} html - Card table tbody HTML
   * @returns {Array} Array of card objects
   */
  parseCardTable(html) {
    const cards = [];

    // Match all table rows
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHTML = rowMatch[1];

      // Extract card number from first <td><a>
      const cardNumberMatch = /<a[^>]*>([^<]+)<\/a>/.exec(rowHTML);
      if (!cardNumberMatch) continue;

      const cardNumber = cardNumberMatch[1].trim();

      // Extract all td contents
      const tdRegex = /<td[^>]*>(?:<a[^>]*>[^<]+<\/a>|([^<]+))<\/td>/g;
      const tdContents = [];
      let tdMatch;

      while ((tdMatch = tdRegex.exec(rowHTML)) !== null) {
        // If there's an <a> tag, we already got it from cardNumberMatch
        // Otherwise get the text content from capture group 1
        if (tdMatch[1]) {
          tdContents.push(tdMatch[1].trim());
        }
      }

      // Row structure: cardNumber, userName, cardType, status, issueDate
      // tdContents will have: [userName, cardType, status, issueDate]
      if (tdContents.length >= 4) {
        cards.push({
          cardNumber: cardNumber,
          cardName: `Hana Card - ${tdContents[0]}`, // userName as card name
          cardCompanyId: 'hana-card',
          cardType: 'corporate',
          userName: tdContents[0], // 이용자
          type: tdContents[1], // 구분 (공용, etc.)
          status: tdContents[2], // 상태 (정상, etc.)
          issueDate: tdContents[3], // 발급일
        });
      }
    }

    this.log(`Parsed ${cards.length} cards from table`);
    return cards;
  }

  /**
   * Parses organization tree HTML to extract department information
   * @param {string} html - Organization tree HTML
   * @returns {Array} Array of {id, name, level} objects
   */
  parseOrganizationTree(html) {
    const departments = [];

    // Match all cls3Level list items (third-level departments)
    const cls3Regex = /<li class="cls3Level" id="(\d+)">.*?<a href="javascript:setTreeSelected\('3', '(\d+)', '([^']+)',/g;

    let match;
    while ((match = cls3Regex.exec(html)) !== null) {
      departments.push({
        id: match[2],
        name: match[3],
        level: 3
      });
    }

    this.log(`Found ${departments.length} departments: ${departments.map(d => d.name).join(', ')}`);
    return departments;
  }

  /**
   * Selects a department in the organization tree
   * @param {string} departmentId - Department ID (e.g., '340002')
   * @param {string} departmentName - Department name (for logging)
   */
  async selectDepartment(departmentId, departmentName) {
    this.log(`Selecting department: ${departmentName} (ID: ${departmentId})`);

    // Click the department link using its ID
    const selector = `//li[@id="${departmentId}"]//a`;
    await this.clickElementInFrame(selector);
    await this.page.waitForTimeout(this.config.delays.betweenActions);
  }

  /**
   * Converts YYYY-MM-DD to YYYYMMDD format
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Date in YYYYMMDD format
   */
  formatDateForHanaCard(dateStr) {
    return dateStr.replace(/-/g, '');
  }

  /**
   * Sets date range for transaction query
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  async setDateRange(startDate, endDate) {
    const formattedStartDate = this.formatDateForHanaCard(startDate);
    const formattedEndDate = this.formatDateForHanaCard(endDate);

    this.log(`Setting date range: ${formattedStartDate} to ${formattedEndDate}`);

    // Set start date
    const startDateLocator = this.getLocatorInFrame(this.config.xpaths.startDateInput);
    await startDateLocator.click({ timeout: this.config.timeouts.elementWait });
    await this.page.waitForTimeout(300);
    // Select all twice to ensure everything is selected
    await this.page.keyboard.press('Control+A');
    await this.page.waitForTimeout(100);
    await this.page.keyboard.press('Control+A');
    await this.page.waitForTimeout(200);
    await startDateLocator.fill(formattedStartDate, { timeout: this.config.timeouts.elementWait });
    await this.page.waitForTimeout(300);
    // Close date picker by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    // Set end date
    const endDateLocator = this.getLocatorInFrame(this.config.xpaths.endDateInput);
    await endDateLocator.click({ timeout: this.config.timeouts.elementWait });
    await this.page.waitForTimeout(300);
    // Select all twice to ensure everything is selected
    await this.page.keyboard.press('Control+A');
    await this.page.waitForTimeout(100);
    await this.page.keyboard.press('Control+A');
    await this.page.waitForTimeout(200);
    await endDateLocator.fill(formattedEndDate, { timeout: this.config.timeouts.elementWait });
    await this.page.waitForTimeout(300);
    // Close date picker by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    this.log('Date range set successfully');
  }

  /**
   * Clicks the query button to search for transactions
   */
  async submitTransactionQuery() {
    this.log('Submitting transaction query...');
    await this.clickElementInFrame(this.config.xpaths.queryButton);
    await this.page.waitForTimeout(this.config.delays.afterSearch);
  }

  /**
   * Clicks "More" button repeatedly until all transactions are loaded
   */
  async loadAllTransactions() {
    this.log('Loading all transactions (clicking More button until it disappears)...');

    let clickCount = 0;
    while (true) {
      try {
        const moreButtonLocator = this.getLocatorInFrame(this.config.xpaths.moreButton);

        // Check if button is visible (not display: none)
        const isVisible = await moreButtonLocator.isVisible({ timeout: 2000 });

        if (!isVisible) {
          this.log('More button is no longer visible, all transactions loaded');
          break;
        }

        // Click the more button
        clickCount++;
        this.log(`Clicking More button (click #${clickCount})...`);
        await moreButtonLocator.click({ timeout: this.config.timeouts.elementWait });
        await this.page.waitForTimeout(1500); // Wait for more transactions to load

      } catch (error) {
        // If button is not found or not visible, we're done
        this.log('More button not found or not clickable, all transactions loaded');
        break;
      }
    }

    this.log(`Finished loading transactions (clicked More button ${clickCount} times)`);
  }

  /**
   * Downloads transactions as Excel file
   * @returns {Promise<string|null>} Path to downloaded file, or null if no transactions
   */
  async downloadTransactionExcel() {
    this.log('Checking if Excel download is available...');

    // Check if Excel download button is visible (means there are transactions)
    try {
      const excelButtonLocator = this.getLocatorInFrame(this.config.xpaths.excelDownloadButton);
      const isVisible = await excelButtonLocator.isVisible({ timeout: 3000 });

      if (!isVisible) {
        this.log('Excel download button not visible - likely no transactions for this department');
        return null;
      }

      this.log('Excel download button found, downloading...');

      // Set up download promise before clicking
      const downloadPromise = this.page.waitForEvent('download', {
        timeout: this.config.timeouts.downloadWait
      });

      // Click Excel download button
      await this.clickElementInFrame(this.config.xpaths.excelDownloadButton);

      // Wait for download to complete
      const download = await downloadPromise;
      const fileName = download.suggestedFilename();
      const downloadPath = path.join(this.downloadDir, fileName);

      await download.saveAs(downloadPath);
      this.log(`Excel file downloaded: ${downloadPath}`);

      return downloadPath;
    } catch (error) {
      this.log(`Excel download not available: ${error.message}`);
      return null;
    }
  }

  /**
   * Parses Excel file to extract transaction data
   * Column headers start at row 6:
   * NO, 이용일, 이용시간, 카드번호, 승인번호, 승인금액, 승인취소금액, 가맹점명, 업종명, 가맹점번호,
   * 가맹점사업자번호, 이용구분, 할부기간, 매입, 매입금액, 매출취소금액, 매입일, 상태, 부가세, 하위몰정보
   *
   * @param {string} filePath - Path to Excel file
   * @param {Object} departmentInfo - Department information to add to each transaction
   * @returns {Array} Array of transaction objects
   */
  parseExcelTransactions(filePath, departmentInfo = {}) {
    this.log(`Parsing Excel file: ${filePath}`);

    // Read Excel file as buffer to avoid permission issues
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Extract metadata from first 5 rows (본부명, 부서명, etc.)
    const metadataRows = XLSX.utils.sheet_to_json(worksheet, {
      range: 0,
      header: 1, // Use array format
      defval: ''
    });

    // Try to extract 본부명 and 부서명 from the first few rows
    let headquartersName = '';
    let departmentName = '';

    for (let i = 0; i < Math.min(5, metadataRows.length); i++) {
      const row = metadataRows[i];
      const rowStr = row.join(' ');

      // Look for patterns like "본부명: XXX" or just the value
      if (row[0] && row[0].toString().includes('본부')) {
        headquartersName = row[1] || row[0].toString().replace(/본부명\s*:?\s*/g, '').trim();
      }
      if (row[0] && row[0].toString().includes('부서')) {
        departmentName = row[1] || row[0].toString().replace(/부서명\s*:?\s*/g, '').trim();
      }
    }

    this.log(`Extracted metadata - 본부명: ${headquartersName}, 부서명: ${departmentName}`);

    // Convert to JSON, starting from row 7 (first data row, skipping header at row 6)
    // Range option starts from A7 to skip the first 6 rows (5 metadata rows + 1 header row)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      range: 6, // Start from row 7 (0-indexed, so 6) - skip metadata (1-5) and header (6)
      header: [
        'no',
        'usageDate',           // 이용일 = 접수일자/승인일자
        'usageTime',           // 이용시간 = 접수시간/승인시간
        'cardNumber',
        'approvalNumber',
        'approvalAmount',
        'approvalCancelAmount',
        'merchantName',
        'businessType',
        'merchantNumber',
        'merchantBusinessNumber',
        'usageType',
        'installmentPeriod',
        'purchase',
        'purchaseAmount',
        'salesCancelAmount',
        'purchaseDate',
        'status',
        'vat',
        'subMallInfo'
      ],
      defval: '' // Default value for empty cells
    });

    // Filter out empty rows and map to transaction objects
    const transactions = jsonData
      .filter(row => row.usageDate || row.approvalNumber) // Filter rows with actual data
      .map(row => {
        const approvalAmount = this.parseAmount(row.approvalAmount);
        const approvalCancelAmount = this.parseAmount(row.approvalCancelAmount);
        const purchaseAmount = this.parseAmount(row.purchaseAmount);
        const salesCancelAmount = this.parseAmount(row.salesCancelAmount);
        const vat = this.parseAmount(row.vat);

        // Calculate net amount (approval + cancellation)
        // If both exist, the cancellation is usually negative
        const netAmount = approvalAmount + approvalCancelAmount;

        // Determine if this is a cancelled transaction
        const isCancelled = approvalCancelAmount !== 0 || row.status === '승인취소';

        // Combine usageDate and usageTime into dateTime format (keep YYYY.MM.DD format)
        // Excel gives us dates like "2026.03.03" and time like "20:30"
        const dateTime = row.usageDate && row.usageTime
          ? `${row.usageDate} ${row.usageTime}`
          : row.usageDate || '';

        return {
          // Basic transaction info
          no: row.no,
          dateTime: dateTime,                 // Combined: "2026.03.03 20:30" (for mapper)
          approvalDate: row.usageDate,         // Alias for usageDate for consistency
          usageDate: row.usageDate,           // 이용일 = 접수일자/승인일자 (raw format)
          usageTime: row.usageTime,           // 이용시간 = 접수시간/승인시간
          cardNumber: cleanCardNumber(row.cardNumber),
          approvalNumber: row.approvalNumber,

          // Amounts
          approvalAmount,
          approvalCancelAmount,
          purchaseAmount,
          salesCancelAmount,
          vat,
          netAmount, // Net amount after cancellation

          // Merchant info
          merchantName: row.merchantName,
          businessType: row.businessType,
          merchantNumber: row.merchantNumber,
          merchantBusinessNumber: row.merchantBusinessNumber,
          subMallInfo: row.subMallInfo,

          // Additional info
          usageType: row.usageType,
          installmentPeriod: row.installmentPeriod,
          purchase: row.purchase,
          purchaseDate: row.purchaseDate,
          status: row.status,
          isCancelled, // Flag indicating if transaction was cancelled

          // Department/Organization info
          // 부서명 = department name from parsed organization tree
          // 본부명 = headquarters name from Excel metadata (if available)
          department: departmentInfo.name,           // 부서명 (legacy field)
          departmentName: departmentInfo.name,       // 부서명 (for export compatibility)
          departmentId: departmentInfo.id,
          headquartersName: headquartersName || '',  // 본부명 (from Excel metadata)

          // Metadata
          source: 'hana-card',
          excelFile: path.basename(filePath)
        };
      });

    this.log(`Parsed ${transactions.length} transactions from Excel file`);
    return transactions;
  }

  /**
   * Parses amount strings to numbers (handles Korean number formatting)
   * @param {string|number} amount - Amount value
   * @returns {number} Parsed amount
   */
  parseAmount(amount) {
    if (!amount) return 0;
    if (typeof amount === 'number') return amount;

    // Remove commas and convert to number
    const cleaned = String(amount).replace(/,/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Gets transactions for all cards across all departments within a date range
   * Note: Hana Card downloads all transactions per department, not per individual card
   * @param {string} cardNumber - Card number (IGNORED - we download all cards)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of transactions across all departments
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`Getting transactions from ${startDate} to ${endDate} across all departments...`);
      this.log(`Note: cardNumber parameter (${cardNumber}) is ignored - downloading all transactions`);

      // Step 1: Navigate to transactions page if not already there
      if (!this.isOnTransactionsPage) {
        this.log('Navigating to transactions page (승인내역)...');
        await this.clickElementInFrame(this.config.xpaths.transactionButton);
        await this.page.waitForTimeout(this.config.delays.afterNavigation);
        this.isOnTransactionsPage = true;
      } else {
        this.log('Already on transactions page from getCards(), reusing existing tree');
      }

      // Step 2: Get departments list (use cached if available, otherwise parse tree)
      let departments;

      if (this.cachedDepartments && this.cachedDepartments.length > 0) {
        this.log(`Using cached departments list (${this.cachedDepartments.length} departments)`);
        departments = this.cachedDepartments;
      } else {
        this.log('No cached departments, parsing organization tree...');
        await this.page.waitForTimeout(2000);

        const treeLocator = this.getLocatorInFrame(this.config.xpaths.organizationTree);
        const isTreeVisible = await treeLocator.isVisible({ timeout: this.config.timeouts.elementWait });

        if (!isTreeVisible) {
          throw new Error('Organization tree not visible');
        }

        this.log('Organization tree found');
        const treeHTML = await treeLocator.innerHTML();
        departments = this.parseOrganizationTree(treeHTML);

        if (departments.length === 0) {
          throw new Error('No departments found in organization tree');
        }

        // Cache for future use
        this.cachedDepartments = departments;
      }

      // Step 3: Iterate through all departments and collect transactions
      const allTransactions = [];

      for (const dept of departments) {
        this.log(`\n--- Processing department ${dept.name} ---`);

        // Select department
        await this.selectDepartment(dept.id, dept.name);

        // Set date range
        await this.setDateRange(startDate, endDate);

        // Submit query
        await this.submitTransactionQuery();

        // Load all transactions by clicking More button
        await this.loadAllTransactions();

        // Download Excel file
        const excelPath = await this.downloadTransactionExcel();

        // Parse Excel file if download was successful (null means no transactions)
        if (excelPath) {
          const deptTransactions = this.parseExcelTransactions(excelPath, {
            name: dept.name,
            id: dept.id
          });

          this.log(`Extracted ${deptTransactions.length} transactions from ${dept.name}`);
          allTransactions.push(...deptTransactions);
        } else {
          this.log(`No transactions found for ${dept.name}, skipping to next department`);
        }

        this.log(`Completed processing for ${dept.name}`);
      }

      this.log(`\n=== Total transactions collected: ${allTransactions.length} ===`);

      // Return in the same format as BC Card and Shinhan Card (for UI compatibility)
      return [{
        status: 'downloaded',
        filename: 'hana-card-transactions',
        path: this.downloadDir,
        extractedData: {
          transactions: allTransactions
        }
      }];

    } catch (error) {
      this.log(`Failed to get transactions: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Wrapper for manual Excel import for Hana Card
   * @param {string} filePath - Path to Excel file
   * @returns {Promise<Object>} Extracted data in standard format
   */
  async parseDownloadedExcel(filePath) {
    this.log(`Parsing downloaded Excel for Hana Card: ${filePath}`);

    try {
      const transactions = this.parseExcelTransactions(filePath);

      const totalAmount = transactions.reduce((sum, tx) => {
        return sum + (tx.netAmount || 0);
      }, 0);

      return {
        metadata: {
          bankName: '하나카드',
          cardName: '하나카드',
          sourceFile: path.basename(filePath),
        },
        summary: {
          totalCount: transactions.length,
          totalAmount: totalAmount,
        },
        transactions: transactions
      };
    } catch (error) {
      this.log(`Failed to parse Hana Card Excel: ${error.message}`, 'error');
      throw error;
    }
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
