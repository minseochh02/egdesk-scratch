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
const { sendPasswordWithNaturalTiming } = require('../../utils/virtual-hid-bridge');

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
    this.manualPassword = options.manualPassword ?? false; // Debug mode for manual password entry
  }

  // ============================================================================
  // DEBUG MODE - MANUAL PASSWORD ENTRY
  // ============================================================================

  /**
   * Waits for user to click Continue button in app after manually typing password
   * @returns {Promise<void>}
   */
  async waitForManualPasswordEntry() {
    this.log('DEBUG MODE: Waiting for manual password entry...');

    const { BrowserWindow, ipcMain } = require('electron');

    return new Promise((resolve, reject) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];

      if (!mainWindow) {
        this.log('No main window found, falling back to timeout');
        setTimeout(() => resolve(), 10000);
        return;
      }

      this.log('Sending show-continue event to renderer...');

      const continueHandler = () => {
        this.log('✅ Continue button clicked! Hiding modal and proceeding...');

        try {
          ipcMain.removeListener('manual-password:continue', continueHandler);
          mainWindow.webContents.send('manual-password:hide-continue');

          setTimeout(() => {
            this.log('Resuming automation...');
            resolve();
          }, 300);
        } catch (error) {
          this.log(`Error in continue handler: ${error.message}`, 'error');
          reject(error);
        }
      };

      ipcMain.on('manual-password:continue', continueHandler);
      mainWindow.webContents.send('manual-password:show-continue');

      this.log('Modal should now be visible. Waiting for user to click continue...');
    });
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

      // Step 5: Enter password (Virtual HID with Natural Timing or Manual)
      if (this.manualPassword) {
        // DEBUG MODE: Manual password entry
        this.log('Manual password mode enabled');
        const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
        await passwordField.click();
        await this.page.waitForTimeout(1000);

        this.log('Waiting for manual password entry...');
        await this.waitForManualPasswordEntry();
        this.log('Manual password entry completed');
      } else {
        // AUTOMATIC MODE: Enter password via Virtual HID with natural timing
        this.log('Entering password via Virtual HID with natural timing...');
        try {
          const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
          await passwordField.click();
          await this.page.waitForTimeout(1000);

          // Use natural timing: 80-200ms between characters
          const success = await sendPasswordWithNaturalTiming(password, {
            minDelay: 80,
            maxDelay: 200,
            preDelay: 300,
            debug: true,
            onProgress: (index, char, total) => {
              if ((index + 1) % 5 === 0) {
                this.log(`Password progress: ${index + 1}/${total}`);
              }
            }
          });

          if (!success) {
            throw new Error('Virtual HID password entry failed');
          }

          this.log('Password typed via Virtual HID with natural timing');
        } catch (e) {
          this.log('Virtual HID password entry failed');
          throw new Error(`Password entry failed: ${e.message}`);
        }
      }
      await this.page.waitForTimeout(2000);

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

    // Step 1: Hover over menu tree to expand it
    this.log('Hovering over menu to expand...');
    const menuTreeHover = this.page.locator('xpath=/html/body/div[1]/div[1]/div[3]/div[2]/div[1]/ul/li[1]/a/span');
    await menuTreeHover.hover();
    await this.page.waitForTimeout(1000);

    // Step 2: Click 승인내역조회 link
    this.log('Clicking 승인내역조회...');
    const approvalHistoryLink = this.page.locator('xpath=/html/body/div[1]/div[1]/div[3]/div[2]/div[1]/ul/li[1]/div/div/ul/li[2]/ul/li[2]/a/span');
    await approvalHistoryLink.click();
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

      // Step 2: Set date range (requires manual deletion, format: 20260103)
      this.log(`Setting date range: ${startDate} to ${endDate}`);

      // Start date
      const startDateInput = this.page.locator('xpath=/html/body/div[1]/div[3]/div/div[2]/div[1]/form/table/tbody/tr[4]/td/div/div[1]/div[1]/div/input');
      await startDateInput.click();
      await this.page.waitForTimeout(500);
      // Manually delete each character
      for (let i = 0; i < 20; i++) {
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(50);
      }
      await startDateInput.fill(startDate.toString());
      await this.page.waitForTimeout(1000);

      // End date
      const endDateInput = this.page.locator('xpath=/html/body/div[1]/div[3]/div/div[2]/div[1]/form/table/tbody/tr[4]/td/div/div[1]/div[2]/div/input');
      await endDateInput.click();
      await this.page.waitForTimeout(500);
      // Manually delete each character
      for (let i = 0; i < 20; i++) {
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(50);
      }
      await endDateInput.fill(endDate.toString());
      await this.page.waitForTimeout(1000);

      // Step 3: Click search button
      this.log('Clicking search button...');
      await this.clickElement(this.config.xpaths.transactionSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 4: Download Excel file
      this.log('Downloading Excel file...');
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

      // Click Excel download button
      await this.page.locator('xpath=/html/body/div[1]/div[3]/div/div[2]/div[2]/div/div[1]/div/button[3]').click();
      await this.page.waitForTimeout(1000);

      // Check for confirmation popup and click if exists
      const popupExists = await this.page.locator('#pop_fileSave > div.layContainer').isVisible({ timeout: 2000 }).catch(() => false);
      if (popupExists) {
        this.log('Clicking download confirmation button...');
        await this.page.locator('xpath=/html/body/div[5]/div/div[1]/div[2]/button[1]').click();
      }

      // Wait for download
      const download = await downloadPromise;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `KB카드_거래내역_${timestamp}.xls`;
      const downloadPath = path.join(this.outputDir, 'downloads', filename);

      // Ensure download directory exists
      if (!fs.existsSync(path.dirname(downloadPath))) {
        fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
      }

      await download.saveAs(downloadPath);
      this.log(`Downloaded file: ${downloadPath}`);

      // Step 5: Parse Excel file
      const extractedData = await this.parseKBCardExcel(downloadPath);

      // Step 6: Return result
      const excelPath = downloadPath;

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
  // EXCEL PARSING
  // ============================================================================

  /**
   * Parse KB Card Excel file
   * @param {string} filePath - Path to downloaded Excel file
   * @returns {Promise<Object>} Parsed transaction data
   */
  async parseKBCardExcel(filePath) {
    this.log(`Parsing KB Card Excel: ${filePath}`);

    const XLSX = require('xlsx');
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Column mapping for KB Card
    const columnMapping = {
      '승인일': 'approvalDate',
      '승인시간': 'approvalTime',
      '부서번호': 'departmentNumber',
      '부서명': 'departmentName',
      '카드번호': 'cardNumber',
      '이용자명': 'userName',
      '가맹점명': 'merchantName',
      '업종명': 'businessType',
      '결제방법': 'paymentMethod',
      '할부개월수': 'installmentMonths',
      '승인금액': 'amount',
      '부가세': 'vat',
      '승인구분': 'approvalType',
      '승인방식': 'approvalMethod',
      '승인번호': 'approvalNumber',
      '상태': 'status',
      '과세유형': 'taxType',
      '가맹점상태': 'merchantStatus',
      '가맹점번호': 'merchantNumber',
      '가맹점사업자등록번호': 'merchantBusinessNumber',
      '대표자성명': 'representativeName',
      '가맹점주소': 'merchantAddress',
      '가맹점전화번호': 'merchantPhone',
    };

    // Find header row
    let headerRowIndex = -1;
    let headers = [];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowText = row.join(' ');
      if (rowText.includes('승인일') && rowText.includes('카드번호') && rowText.includes('가맹점명')) {
        headerRowIndex = i;
        headers = row.map(h => String(h || '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      this.log('Header row not found, using first row', 'warn');
      headerRowIndex = 0;
      headers = rawData[0].map(h => String(h || '').trim());
    }

    this.log(`Found headers at row ${headerRowIndex}: ${headers.join(', ')}`);

    // Parse transactions
    const transactions = [];
    let totalAmount = 0;

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // Skip total rows
      const firstCell = String(row[0] || '').trim();
      if (firstCell.includes('합계') || firstCell.includes('총')) continue;

      // Map to object with both Korean and English names
      const transaction = {};
      headers.forEach((header, index) => {
        const value = row[index];
        transaction[header] = value;
        const englishColumn = columnMapping[header];
        if (englishColumn) {
          transaction[englishColumn] = value;
        }
      });

      transactions.push(transaction);

      // Calculate total
      const amountValue = transaction.amount || transaction['승인금액'] || 0;
      const amount = parseInt(String(amountValue).replace(/[^\d-]/g, '')) || 0;
      totalAmount += amount;
    }

    this.log(`Parsed ${transactions.length} transactions, total: ${totalAmount}`);

    return {
      metadata: {
        bankName: 'KB국민카드',
        downloadDate: new Date().toISOString(),
        sourceFile: path.basename(filePath),
        sheetName: sheetName,
        columnMapping: columnMapping,
      },
      summary: {
        totalCount: transactions.length,
        totalAmount: totalAmount,
      },
      headers: headers,
      transactions: transactions,
    };
  }

  // ============================================================================
  // DATA EXTRACTION (OLD - DEPRECATED)
  // ============================================================================

  /**
   * Extracts transaction data from KB Card's HTML structure
   * Reference: KBCard-alltransactions.spec.js (table capture comments)
   * @returns {Promise<Object>} Extracted transaction data
   * @deprecated Use parseKBCardExcel instead
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
