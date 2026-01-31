// ============================================================================
// SHINHAN CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { SerialPort } = require('serialport');
const { BaseCardAutomator } = require('../../core/BaseCardAutomator');
const { SHINHAN_CARD_INFO, SHINHAN_CARD_CONFIG } = require('./config');

/**
 * Shinhan Card Automator
 * Handles login and transaction automation for Shinhan Card (www.shinhancard.com)
 *
 * Key Features:
 * - Login via standard form
 * - Card discovery via "보유카드" section
 * - Transaction download via sitemap navigation
 * - Excel file download (not ZIP)
 */
class ShinhanCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    const config = {
      ...SHINHAN_CARD_CONFIG,
      targetUrl: SHINHAN_CARD_INFO.loginUrl,
      bank: SHINHAN_CARD_INFO,
      card: SHINHAN_CARD_INFO,
      headless: options.headless ?? false,
      chromeProfile: options.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'shinhan-card');
    this.downloadDir = path.join(this.outputDir, 'downloads');
    this.arduinoPort = options.arduinoPort || null; // e.g. 'COM6'
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;

    // Ensure output directories exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method
   * Reference: shinhancardfindcards.spec.js lines 171-197
   * @param {Object} credentials - { userId, password }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting Shinhan Card automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Setup download path for this page
      this.page._downloadPath = this.downloadDir;

      // Step 2: Navigate to main page
      this.log('Navigating to Shinhan Card main page...');
      await this.page.goto(this.config.targetUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeouts.pageLoad
      });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Click ID input field
      this.log('Clicking ID input field...');
      await this.clickElement(this.config.xpaths.idInput);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 4: Fill user ID
      this.log('Entering user ID...');
      await this.page.fill(this.config.xpaths.idInput.css, userId);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 5: Click password input field
      this.log('Clicking password input field...');
      await this.clickElement(this.config.xpaths.passwordInput);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 6: Fill password via Arduino HID keyboard (bypasses security keyboard!)
      this.log('Entering password via Arduino HID...');
      try {
        const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
        await passwordField.click();
        await this.page.waitForTimeout(1500);

        this.log('Security keyboard activated, typing via Arduino HID...');
        await this.typeViaArduino(password);
        this.log('Password typed via Arduino HID');
      } catch (e) {
        this.log(`Arduino HID password entry failed: ${e.message}`, 'error');
        throw new Error(`Password entry failed: ${e.message}`);
      }
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 7: Click login button
      this.log('Clicking login button...');
      await this.clickElement(this.config.xpaths.loginButton);
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 8: Handle post-login popups
      await this.handlePostLoginPopups();

      // Step 9: Start session keep-alive
      this.startSessionKeepAlive();

      this.log('Login successful!');
      return {
        success: true,
        isLoggedIn: true,
        message: 'Successfully logged into Shinhan Card',
      };
    } catch (error) {
      this.log(`Login failed: ${error.message}`, 'error');

      // Take screenshot on error
      if (this.page) {
        try {
          const screenshotPath = path.join(this.outputDir, `error_${Date.now()}.png`);
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          this.log(`Error screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
          this.log(`Failed to save screenshot: ${screenshotError.message}`, 'error');
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
  // POST-LOGIN POPUP HANDLING
  // ============================================================================

  /**
   * Handle various popups that may appear after login
   */
  async handlePostLoginPopups() {
    this.log('Checking for post-login popups...');

    const popupSelectors = [
      '//button[contains(@class, "close")]',
      '//button[text()="닫기"]',
      '//a[text()="닫기"]',
      '//div[@class="popup"]//button',
      '//button[contains(text(), "확인")]',
    ];

    for (const selector of popupSelectors) {
      try {
        const locator = this.page.locator(`xpath=${selector}`);
        if (await locator.isVisible({ timeout: 2000 })) {
          await locator.click();
          this.log('Closed popup');
          await this.page.waitForTimeout(1000);
        }
      } catch (e) {
        // Silent failure - popup may not exist
      }
    }
  }

  // ============================================================================
  // CARD DISCOVERY
  // ============================================================================

  /**
   * Get list of user's cards
   * Reference: shinhancardfindcards.spec.js lines 199-276
   * @returns {Promise<Array>} Array of card objects
   */
  async getCards() {
    try {
      this.log('Navigating to card list...');

      // Step 1: Click "보유카드" link
      await this.clickElement(this.config.xpaths.myCardsLink);
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

      // Step 2: Click category radio button
      this.log('Selecting card category...');
      await this.page.locator('xpath=/html/body/div[2]/div/div/div/div[2]/div[2]/div[1]/form/div[4]/div/ul/li[1]/div/div[2]/div[1]/ol/li/div/label[2]/input').click({ timeout: 10000 });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Click 조회 button
      await this.clickElement(this.config.xpaths.cardSearchButton);
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 5: Extract cards from list
      this.log('Extracting card information...');
      const cards = await this.page.evaluate(() => {
        const cardList = document.querySelector('#CRP21120PH01_detail_list');
        if (!cardList) return [];

        const listItems = cardList.querySelectorAll('li');
        const cards = [];

        listItems.forEach((li, index) => {
          try {
            // Extract card info from .use_card_info
            const cardInfo = li.querySelector('.use_card_info');
            if (!cardInfo) return;

            const spans = cardInfo.querySelectorAll('span');
            let cardName = '';
            let cardNumber = '';

            spans.forEach(span => {
              const text = span.textContent.trim();
              if (text.includes('카드번호') || text.match(/\d{4}-\d{4}-\d{4}-\d{4}/)) {
                cardNumber = text.replace(/[^\d-]/g, '');
              } else if (text && !text.includes('카드')) {
                cardName = text;
              }
            });

            if (!cardNumber) {
              cardNumber = `shinhan-card-${index + 1}`;
            }
            if (!cardName) {
              cardName = `Shinhan Card ${index + 1}`;
            }

            cards.push({
              cardNumber: cardNumber,
              cardName: cardName,
              cardCompanyId: 'shinhan-card',
              cardType: 'personal',
            });
          } catch (e) {
            console.error('Error extracting card:', e);
          }
        });

        return cards;
      });

      if (cards.length === 0) {
        this.log('No cards found, returning default card');
        return [{
          cardNumber: 'default',
          cardName: 'Shinhan Card',
          cardCompanyId: 'shinhan-card',
          cardType: 'personal',
        }];
      }

      this.log(`Found ${cards.length} card(s)`);
      return cards;
    } catch (error) {
      this.log(`Card discovery failed: ${error.message}`, 'error');

      // Return default card on error
      return [{
        cardNumber: 'default',
        cardName: 'Shinhan Card',
        cardCompanyId: 'shinhan-card',
        cardType: 'personal',
      }];
    }
  }

  // ============================================================================
  // TRANSACTION NAVIGATION
  // ============================================================================

  /**
   * Navigate to transaction history page via sitemap
   * Reference: shinhancardtransactions.spec.js lines 200-215
   */
  async navigateToTransactionHistory() {
    try {
      this.log('Navigating to transaction history...');

      // Step 1: Click "사이트맵 열기" button
      await this.clickElement(this.config.xpaths.sitemapButton);
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

      // Step 2: Click "이용내역조회" link from sitemap
      await this.clickElement(this.config.xpaths.transactionHistoryLink);
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

      // Step 3: Try to close datepicker popup (defensive - may not exist)
      try {
        const datepickerClose = this.page.locator(this.config.xpaths.datepickerCloseButton.css);
        if (await datepickerClose.isVisible({ timeout: 2000 })) {
          await datepickerClose.click();
          this.log('Closed datepicker popup');
          await this.page.waitForTimeout(1000);
        }
      } catch (e) {
        // Silent failure - popup may not exist
      }

      this.log('Successfully navigated to transaction history');
    } catch (error) {
      this.log(`Navigation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // SEARCH CRITERIA SETUP
  // ============================================================================

  /**
   * Set search criteria for transaction query
   * Reference: shinhancardtransactions.spec.js lines 223-343
   * @param {string} startDate - Start date in YYYYMMDD format
   * @param {string} endDate - End date in YYYYMMDD format
   */
  async setSearchCriteria(startDate, endDate) {
    try {
      this.log(`Setting search criteria: ${startDate} to ${endDate}`);

      // Step 1: Click list display radio
      await this.clickElement(this.config.xpaths.listRadioLabel);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 2: Set searchGubun = "1"
      await this.clickElement(this.config.xpaths.searchGubunLabel);
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await this.page.fill(this.config.xpaths.searchGubunInput.css, '1');
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Set searchArea = "local"
      await this.clickElement(this.config.xpaths.searchAreaLabel);
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await this.page.fill(this.config.xpaths.searchAreaInput.css, 'local');
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 4: Set searchPeriod = "term"
      await this.page.fill(this.config.xpaths.searchPeriodInput.css, 'term');
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 5: Click #selTerm dropdown to activate date inputs
      await this.clickElement(this.config.xpaths.termDropdown);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 6: Fill start date (YYYYMMDD format)
      await this.page.fill(this.config.xpaths.startDateInput.css, startDate);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 7: Fill end date (YYYYMMDD format)
      await this.page.fill(this.config.xpaths.endDateInput.css, endDate);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      this.log('Search criteria set successfully');
    } catch (error) {
      this.log(`Failed to set search criteria: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // EXCEL DOWNLOAD
  // ============================================================================

  /**
   * Download Excel file with transaction data
   * Reference: shinhancardtransactions.spec.js lines 347-365
   * @returns {Promise<string>} Path to downloaded file
   */
  async downloadExcelFile() {
    try {
      this.log('Starting Excel download...');

      // Setup download promise
      const downloadPromise = this.page.waitForEvent('download', {
        timeout: this.config.timeouts.downloadWait,
      });

      // Step 1: Click search button (first time)
      await this.clickElement(this.config.xpaths.searchButton);
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 2: Click download button
      await this.clickElement(this.config.xpaths.downloadButton);
      await this.page.waitForTimeout(this.config.delays.afterDownload);

      // Step 3: Click "예" confirmation button
      await this.clickElement(this.config.xpaths.downloadConfirmButton);

      // Step 4: Wait for download
      this.log('Waiting for download to complete...');
      const download = await downloadPromise;

      // Save file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const originalName = download.suggestedFilename();
      const filename = `신한카드_이용내역_${timestamp}_${originalName}`;
      const downloadPath = path.join(this.downloadDir, filename);

      await download.saveAs(downloadPath);
      this.log(`Downloaded file: ${downloadPath}`);

      // Verify file exists
      if (!fs.existsSync(downloadPath)) {
        throw new Error('Download completed but file not found');
      }

      return downloadPath;
    } catch (error) {
      this.log(`Download failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // EXCEL PARSING
  // ============================================================================

  /**
   * Parse downloaded Excel file
   * @param {string} filePath - Path to Excel file
   * @returns {Promise<Object>} Parsed transaction data
   */
  async parseDownloadedExcel(filePath) {
    try {
      this.log(`Parsing Excel file: ${filePath}`);

      // Read Excel file
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Find header row (search first 10 rows)
      let headerRowIndex = -1;
      let headers = [];

      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        const rowText = row.join(' ');

        // Check for common header keywords
        if (rowText.includes('카드번호') ||
            rowText.includes('승인일') ||
            rowText.includes('승인금액') ||
            rowText.includes('이용일')) {
          headerRowIndex = i;
          headers = row.map(h => String(h || '').trim());
          break;
        }
      }

      if (headerRowIndex === -1) {
        this.log('Could not find header row, using first row as headers', 'warn');
        headerRowIndex = 0;
        headers = rawData[0].map(h => String(h || '').trim());
      }

      this.log(`Found headers at row ${headerRowIndex}: ${headers.join(', ')}`);

      // Parse transaction rows
      const transactions = [];
      let totalAmount = 0;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];

        // Skip empty rows
        if (!row || row.length === 0) continue;

        // Skip total rows
        const firstCell = String(row[0] || '').trim();
        if (firstCell.includes('합계') || firstCell.includes('총')) continue;

        // Map row to object
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = row[index];
        });

        transactions.push(transaction);

        // Try to extract amount for total
        const amountField = headers.find(h =>
          h.includes('금액') || h.includes('승인금액') || h.includes('이용금액')
        );
        if (amountField && transaction[amountField]) {
          const amount = parseFloat(String(transaction[amountField]).replace(/[^\d.-]/g, ''));
          if (!isNaN(amount)) {
            totalAmount += amount;
          }
        }
      }

      const result = {
        metadata: {
          bankName: '신한카드',
          downloadDate: new Date().toISOString(),
          sourceFile: path.basename(filePath),
          sheetName: sheetName,
        },
        summary: {
          totalCount: transactions.length,
          totalAmount: totalAmount,
        },
        headers: headers,
        transactions: transactions,
      };

      this.log(`Parsed ${transactions.length} transactions, total amount: ${totalAmount}`);
      return result;
    } catch (error) {
      this.log(`Excel parsing failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============================================================================
  // MAIN TRANSACTION RETRIEVAL
  // ============================================================================

  /**
   * Get transactions for a specific card and date range
   * @param {string} cardNumber - Card number or identifier
   * @param {string} startDate - Start date in YYYYMMDD format
   * @param {string} endDate - End date in YYYYMMDD format
   * @returns {Promise<Array>} Array of transaction results
   */
  async getTransactions(cardNumber, startDate, endDate) {
    try {
      this.log(`Getting transactions for card ${cardNumber} from ${startDate} to ${endDate}`);

      // Step 1: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Step 2: Set search criteria
      await this.setSearchCriteria(startDate, endDate);

      // Step 3: Download Excel file
      const downloadPath = await this.downloadExcelFile();

      // Step 4: Parse Excel file
      const extractedData = await this.parseDownloadedExcel(downloadPath);

      // Return result in standard format
      return [{
        status: 'downloaded',
        filename: path.basename(downloadPath),
        path: downloadPath,
        extractedData: extractedData,
      }];
    } catch (error) {
      this.log(`Failed to get transactions: ${error.message}`, 'error');
      throw error;
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
        // Wait for Arduino to initialize
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
        // 603ms per char (247ms press + 356ms release) + buffer
        const typingTime = text.length * 950 + 800;
        setTimeout(() => resolve(), typingTime);
      });
    });
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
   * Click element with CSS fallback to XPath
   * @param {Object} selector - { css, xpath }
   */
  async clickElement(selector) {
    try {
      await this.page.locator(`xpath=${selector.xpath}`).click({ timeout: this.config.timeouts.elementWait });
    } catch (e) {
      this.log('XPath selector failed, trying CSS fallback...');
      await this.page.locator(selector.css).click({ timeout: this.config.timeouts.elementWait });
    }
  }
}

// ============================================================================
// FACTORY AND UTILITY FUNCTIONS
// ============================================================================

/**
 * Factory function to create a new automator instance
 */
function createShinhanCardAutomator(options) {
  return new ShinhanCardAutomator(options);
}

/**
 * Utility function to run full automation flow
 */
async function runShinhanCardAutomation(credentials, options = {}) {
  const automator = createShinhanCardAutomator(options);

  try {
    // Login
    const loginResult = await automator.login(credentials);
    if (!loginResult.success) {
      return loginResult;
    }

    // Get cards
    const cards = await automator.getCards();

    // Get transactions for each card
    const results = [];
    for (const card of cards) {
      const startDate = options.startDate || '20260101';
      const endDate = options.endDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const transactions = await automator.getTransactions(card.cardNumber, startDate, endDate);
      results.push({
        card: card,
        transactions: transactions,
      });
    }

    return {
      success: true,
      cards: cards,
      results: results,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await automator.disconnectArduino();
    if (automator.browser) {
      await automator.cleanup();
    }
  }
}

module.exports = {
  ShinhanCardAutomator,
  createShinhanCardAutomator,
  runShinhanCardAutomation,
};
