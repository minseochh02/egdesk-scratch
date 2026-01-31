// ============================================================================
// KB CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { KB_CARD_INFO, KB_CARD_CONFIG } = require('./config');
const {
  parseTransactionExcel,
  extractTransactionsFromPage,
  createExcelFromData
} = require('../../utils/transactionParser');

/**
 * KB Card Automator
 * Handles login and transaction automation for KB Card (KB국민카드)
 */
class KBCardAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...KB_CARD_CONFIG,
      targetUrl: KB_CARD_INFO.loginUrl,
      bank: KB_CARD_INFO,
      card: KB_CARD_INFO,
      headless: options.headless ?? KB_CARD_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? KB_CARD_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'kb-card');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Click element with CSS fallback to XPath
   * @param {Object} selector - { css, xpath }
   */
  async clickElement(selector) {
    if (!selector.css || !selector.xpath) {
      throw new Error('Selector must have both css and xpath properties');
    }

    try {
      await this.page.locator(`xpath=${selector.xpath}`).click({ timeout: 10000 });
    } catch (e) {
      this.log('XPath selector failed, trying CSS fallback...');
      await this.page.locator(selector.css).click({ timeout: 10000 });
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method
   * Reference: Recorded browser actions (KBCard-*.spec.js)
   * @param {Object} credentials - { userId, password }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting KB Card automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to main page
      this.log('Navigating to KB Card business login page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      // Step 3: Select business login type
      this.log('Selecting business login...');
      await this.clickElement(this.config.xpaths.loginTypeRadio);
      await this.page.waitForTimeout(3000);

      // Step 4: Enter user ID using keyboard events
      this.log('Entering user ID...');
      const idField = this.page.locator(this.config.xpaths.idInput.css);
      await idField.click();
      await this.page.waitForTimeout(1000);

      // Clear any existing content
      await idField.fill('');
      await this.page.waitForTimeout(200);

      // Type user ID character by character
      for (let i = 0; i < userId.length; i++) {
        const char = userId[i];
        await this.page.keyboard.type(char, { delay: 100 });
        if (i < userId.length - 1) {
          await this.page.waitForTimeout(150);
        }
      }
      await this.page.waitForTimeout(500);

      // Step 5: Enter password via Arduino HID
      this.log('Entering password via Arduino HID...');
      try {
        const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
        await passwordField.click();
        await this.page.waitForTimeout(1000);

        await this.typeViaArduino(password);
        this.log('Password typed via Arduino HID');
      } catch (e) {
        this.log('Arduino HID password entry failed');
        throw new Error(`Password entry failed: ${e.message}`);
      }
      await this.page.waitForTimeout(3000);

      // Step 6: Click login button
      this.log('Clicking login button...');
      await this.clickElement(this.config.xpaths.loginButton);
      await this.page.waitForTimeout(3000);

      // Login successful - start session keep-alive
      this.log('Login successful!');
      this.startSessionKeepAlive();

      return {
        success: true,
        isLoggedIn: true,
        userName: null,
      };

    } catch (error) {
      this.error('Login automation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await this.disconnectArduino();
    }
  }

  // ============================================================================
  // CARD INQUIRY
  // ============================================================================

  /**
   * Gets all cards for the logged-in user
   * Reference: KBCard-getallcards.spec.js
   * Path: 보유카드조회 (Card Ownership Inquiry)
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Navigating to card ownership inquiry...');

      // Step 1: Click "보유카드조회" (Card Ownership Inquiry)
      await this.clickElement(this.config.xpaths.cardOwnershipLink);
      await this.page.waitForTimeout(3000);

      // Step 2: Click search button
      await this.clickElement(this.config.xpaths.cardSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 3: Extract cards from table
      this.log('Extracting cards from table...');
      const cards = await this.page.evaluate(() => {
        const table = document.querySelector('div.wideTblarea > div.tblArea > table.tblH');
        if (!table) {
          console.log('[getCards] Card table not found');
          return [];
        }

        const rows = table.querySelectorAll('tbody tr');
        const extracted = [];

        rows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 15) {
            // Columns: 선택, 부서번호, 부서명, 카드번호, 성명, 닉네임, 제휴카드종류, 카드별 잔여한도,
            // 입력일, 교부일, 만료일, 결제기관, 결제계좌, 결제일, 직전카드번호
            const cardNumber = cells[3]?.textContent.trim() || '';
            const departmentNumber = cells[1]?.textContent.trim() || '';
            const departmentName = cells[2]?.textContent.trim() || '';
            const cardholderName = cells[4]?.textContent.trim() || '';
            const nickname = cells[5]?.textContent.trim() || '';
            const cardType = cells[6]?.textContent.trim() || '';
            const remainingLimit = cells[7]?.textContent.replace(/[^0-9]/g, '') || '0';
            const issueDate = cells[9]?.textContent.trim() || '';
            const expiryDate = cells[10]?.textContent.trim() || '';
            const paymentInstitution = cells[11]?.textContent.trim() || '';
            const paymentAccount = cells[12]?.textContent.trim() || '';
            const paymentDay = cells[13]?.textContent.trim() || '';

            if (cardNumber && cardNumber !== '') {
              extracted.push({
                cardNumber: cardNumber,
                cardName: `KB ${cardType}`.trim(),
                cardCompanyId: 'kb-card',
                cardType: 'corporate',
                departmentNumber: departmentNumber,
                departmentName: departmentName,
                cardholderName: cardholderName,
                nickname: nickname,
                cardTypeDetail: cardType,
                remainingLimit: parseInt(remainingLimit) || 0,
                issueDate: issueDate,
                expiryDate: expiryDate,
                paymentInstitution: paymentInstitution,
                paymentAccount: paymentAccount,
                paymentDay: paymentDay
              });
            }
          }
        });

        console.log('[getCards] Extracted', extracted.length, 'cards');
        return extracted;
      });

      this.log(`Found ${cards.length} card(s)`);
      return cards;
    } catch (error) {
      this.error('Failed to get cards:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // TRANSACTION FETCHING
  // ============================================================================

  /**
   * Navigates to transaction history page
   * Reference: KBCard-alltransactions.spec.js
   * Path: 승인내역조회 (Approval History)
   */
  async navigateToTransactionHistory() {
    this.log('Navigating to transaction history...');
    await this.clickElement(this.config.xpaths.approvalHistoryButton);
    await this.page.waitForTimeout(3000);
  }

  /**
   * Loads all transaction pages by clicking through pagination
   * Reference: KBCard-alltransactions.spec.js pagination section
   */
  async loadAllTransactionPages() {
    this.log('Loading all transaction pages...');

    let currentPage = 1;
    const maxPages = 50; // Safety limit

    while (currentPage < maxPages) {
      try {
        // Check if next page exists
        const nextPage = currentPage + 1;
        const nextPageSelector = `a:has-text("${nextPage}")`;

        // Try to find the next page link
        const isVisible = await this.page.locator(nextPageSelector).isVisible({ timeout: 2000 });

        if (isVisible) {
          await this.page.locator(nextPageSelector).click();
          currentPage++;
          this.log(`Loaded page ${currentPage}`);
          await this.page.waitForTimeout(3000);
        } else {
          this.log('No more pages found - all data loaded');
          break;
        }
      } catch (e) {
        this.log('Error loading next page or no more pages:', e.message);
        break;
      }
    }

    if (currentPage >= maxPages) {
      this.warn(`Reached safety limit of ${maxPages} pages`);
    } else {
      this.log(`Loading complete: ${currentPage} total page(s)`);
    }
  }

  /**
   * Gets transactions for selected card and date range
   * Reference: KBCard-alltransactions.spec.js
   * @param {string} [cardNumber] - Card number (not used - KB Card shows all by default)
   * @param {string|number} startDate - Start date (format: YYYYMMDD)
   * @param {string|number} endDate - End date (format: YYYYMMDD)
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Fetching transactions...');

      // Step 1: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Step 2: Set date range
      this.log('Setting date range...');
      await this.clickElement(this.config.xpaths.startDateInput);
      await this.page.waitForTimeout(3000);
      await this.page.fill(this.config.xpaths.startDateInput.css, startDate.toString());
      await this.page.waitForTimeout(3000);

      await this.clickElement(this.config.xpaths.endDateInput);
      await this.page.waitForTimeout(3000);
      await this.page.fill(this.config.xpaths.endDateInput.css, endDate.toString());
      await this.page.waitForTimeout(3000);

      // Step 3: Click search button
      this.log('Clicking search button...');
      await this.clickElement(this.config.xpaths.transactionSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 4: Load all pages
      await this.loadAllTransactionPages();

      // Step 5: Extract data
      const extractedData = await this.extractKBCardTransactions();

      // Step 6: Create Excel file
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

  // ============================================================================
  // DATA EXTRACTION
  // ============================================================================

  /**
   * Extracts transaction data from KB Card's HTML structure
   * Reference: KBCard-alltransactions.spec.js (table capture comments)
   * @returns {Promise<Object>} Extracted transaction data
   */
  async extractKBCardTransactions() {
    this.log('Extracting KB Card transaction data...');

    const bankName = this.config.card.nameKo;

    const extractedData = await this.page.evaluate((bankName) => {
      const data = {
        metadata: {
          companyName: '',
          businessNumber: '',
          bankName: bankName,
        },
        summary: {
          totalCount: 0,
          totalAmount: 0,
        },
        transactions: [],
        headers: [],
      };

      // Extract company info from the search area
      const companyTable = document.querySelector('div.wideTblarea > table.tblV');
      if (companyTable) {
        const cells = companyTable.querySelectorAll('td');
        // Extract company name and business number if available
        cells.forEach(cell => {
          const text = cell.textContent.trim();
          if (text.includes('|')) {
            const parts = text.split('|');
            if (parts.length >= 2) {
              data.metadata.companyName = parts[1] || '';
            }
          }
        });
      }

      // Extract transactions
      const transactionTable = document.querySelector('#dtailTable');

      if (transactionTable) {
        // Extract headers
        const headerCells = transactionTable.querySelectorAll('thead th');
        headerCells.forEach(th => {
          data.headers.push(th.textContent.trim());
        });

        // Extract transaction rows
        const rows = transactionTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');

          if (cells.length >= 14) {
            // Columns: 선택, 승인일, 부서번호, 카드번호, 닉네임, 가맹점명, 결제방법, 승인금액,
            // 승인구분, 승인번호, 과세유형, 가맹점번호, 대표자성명, 가맹점주소
            const transaction = {
              approvalDate: cells[1]?.textContent.trim() || '',
              departmentNumber: cells[2]?.textContent.trim() || '',
              cardNumber: cells[3]?.textContent.trim() || '',
              nickname: cells[4]?.textContent.trim() || '',
              merchantName: cells[5]?.textContent.trim() || '',
              paymentMethod: cells[6]?.textContent.trim() || '',
              amount: cells[7]?.textContent.replace(/[^0-9]/g, '') || '0',
              approvalType: cells[8]?.textContent.trim() || '',
              approvalNumber: cells[9]?.textContent.trim() || '',
              taxType: cells[10]?.textContent.trim() || '',
              merchantNumber: cells[11]?.textContent.trim() || '',
              representativeName: cells[12]?.textContent.trim() || '',
              merchantAddress: cells[13]?.textContent.trim() || '',
            };

            // Only add if there's actual transaction data
            if (transaction.amount !== '0' || transaction.merchantName) {
              data.transactions.push(transaction);
              data.summary.totalAmount += parseInt(transaction.amount) || 0;
              data.summary.totalCount++;
            }
          }
        });
      } else {
        console.log('[extractKBCard] Transaction table not found!');
      }

      return data;
    }, bankName);

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Company: ${extractedData.metadata.companyName}`);
    this.log(`Summary: ${extractedData.summary.totalCount} transactions, total amount: ${extractedData.summary.totalAmount}`);

    return extractedData;
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

  // Note: cleanup() is inherited from BaseBankAutomator
  // It handles stopSessionKeepAlive() and browser closing automatically
}

// Factory function
function createKBCardAutomator(options = {}) {
  return new KBCardAutomator(options);
}

/**
 * Run KB Card automation (convenience function)
 * @param {string} userId - User ID
 * @param {string} password - Password
 * @param {string} [cardNumber] - Optional card number (not used - shows all cards)
 * @param {string} [proxyUrl] - Optional proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runKBCardAutomation(userId, password, cardNumber = null, proxyUrl) {
  const automator = createKBCardAutomator();
  try {
    const loginResult = await automator.login({ userId, password }, proxyUrl);
    if (loginResult.success) {
      // Get all transactions
      const transactions = await automator.getTransactions(cardNumber, null, null);
      return {
        ...loginResult,
        transactions,
      };
    }
    return loginResult;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  KB_CARD_INFO,
  KB_CARD_CONFIG,
  KBCardAutomator,
  createKBCardAutomator,
  runKBCardAutomation,
};
