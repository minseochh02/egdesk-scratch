// ============================================================================
// NH CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { SerialPort } = require('serialport');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NH_CARD_INFO, NH_CARD_CONFIG } = require('./config');

/**
 * NH Card Automator
 * Handles login and transaction automation for NH Card (Nonghyup Card)
 */
class NHCardAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...NH_CARD_CONFIG,
      headless: options.headless ?? NH_CARD_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? NH_CARD_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'nh-card');
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this.arduino = null;
    this.manualPassword = options.manualPassword ?? false; // Debug mode for manual password entry
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
      const element = this.page.locator(`xpath=${selector.xpath}`);
      await element.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await element.click({ timeout: 10000 });
    } catch (e) {
      this.log('XPath selector failed, trying CSS fallback...');
      try {
        const element = this.page.locator(selector.css);
        await element.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await element.click({ timeout: 10000 });
      } catch (cssError) {
        this.log('CSS click failed, trying force click...');
        await this.page.locator(`xpath=${selector.xpath}`).click({ force: true, timeout: 10000 });
      }
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
   * Reference: Recorded browser actions (NHCard-*.spec.js)
   * @param {Object} credentials - { userId, password }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting NH Card automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Step 2: Navigate to main page
      this.log('Navigating to NH Card main page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(5000);

      // Step 3: Click the user selection tab span
      this.log('Clicking login tab for user selection...');
      await this.clickElement(this.config.xpaths.loginTabSpan);
      await this.page.waitForTimeout(3000);

      // Step 4: Click and fill user ID
      this.log('Entering user ID...');
      await this.clickElement(this.config.xpaths.idInput);
      await this.page.waitForTimeout(3000);
      await this.page.fill(this.config.xpaths.idInput.css, userId);
      await this.page.waitForTimeout(3000);

      // Step 5: Click and type password
      this.log('Entering password...');
      await this.clickElement(this.config.xpaths.passwordInput);
      await this.page.waitForTimeout(3000);

      // Focus the password field
      const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
      await passwordField.focus();
      await this.page.waitForTimeout(500);

      // Step 6: Fill password (Arduino HID or Manual)
      if (this.manualPassword) {
        // DEBUG MODE: Manual password entry
        this.log('Manual password mode enabled');
        await passwordField.click();
        await this.page.waitForTimeout(1500);

        this.log('Waiting for manual password entry...');
        await this.waitForManualPasswordEntry();
        this.log('Manual password entry completed');
      } else {
        // AUTOMATIC MODE: Arduino HID keyboard (bypasses security keyboard!)
        this.log('Typing password via Arduino HID...');
        try {
          await this.typeViaArduino(password);
          this.log('Password typed via Arduino HID');
        } catch (e) {
          this.log(`Arduino HID password entry failed: ${e.message}`, 'error');
          throw new Error(`Password entry failed: ${e.message}`);
        }
      }

      // Step 7: Click login button
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
  // POST-LOGIN NAVIGATION
  // ============================================================================

  /**
   * Navigates to transaction history page
   * Reference: NHCard-getalltransactions.spec.js
   * Path: 조회/결제 → 승인내역
   */
  async navigateToTransactionHistory() {
    this.log('Navigating to transaction history...');

    try {
      await this.page.waitForTimeout(3000);

      // Click "조회/결제" (Inquiry/Payment) menu
      this.log('Clicking 조회/결제 menu...');
      await this.clickElement(this.config.xpaths.inquiryPaymentMenu);
      await this.page.waitForTimeout(1708);

      // Click "승인내역" (Approval History) submenu
      this.log('Clicking 승인내역 submenu...');
      await this.clickElement(this.config.xpaths.approvalHistoryLink);
      await this.page.waitForTimeout(1236);

      this.log('Successfully navigated to transaction history');
    } catch (error) {
      this.error('Failed to navigate to transaction history:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // CARD INQUIRY
  // ============================================================================

  /**
   * Gets all cards for the logged-in user
   * Reference: NHCard-getallcards.spec.js
   * Path: 카드신청/관리 → 카드발급내역
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Navigating to card issuance history...');

      // Step 1: Click "카드신청/관리" (Card Application/Management) menu
      await this.clickElement(this.config.xpaths.cardManagementMenu);
      await this.page.waitForTimeout(3000);

      // Step 2: Click "카드발급내역" (Card Issuance History) submenu
      await this.clickElement(this.config.xpaths.cardIssuanceHistoryLink);
      await this.page.waitForTimeout(1245);

      // Step 3: Click radio button #rdoSchGubun2
      await this.clickElement(this.config.xpaths.searchGubunRadio);
      await this.page.waitForTimeout(3000);

      // Step 4: Click search button
      await this.clickElement(this.config.xpaths.cardSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 5: Extract cards from #resultTable
      this.log('Extracting cards from table...');
      const cards = await this.page.evaluate(() => {
        const table = document.querySelector('#resultTable');
        if (!table) {
          console.log('[getCards] Table #resultTable not found');
          return [];
        }

        const rows = table.querySelectorAll('tbody tr');
        const extracted = [];

        rows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 9) {
            // Columns: 순번, 사용자 구분, 카드번호, 회원구분, 유효기간, 발급일, 카드등급, 카드 상태, 승인내역/한도조회
            const cardNumber = cells[2]?.textContent.trim() || '';
            const userType = cells[1]?.textContent.trim() || '';
            const memberType = cells[3]?.textContent.trim() || '';
            const expiryDate = cells[4]?.textContent.trim() || '';
            const issueDate = cells[5]?.textContent.trim() || '';
            const cardGrade = cells[6]?.textContent.trim() || '';
            const cardStatus = cells[7]?.textContent.trim() || '';

            if (cardNumber && cardNumber !== '') {
              extracted.push({
                cardNumber: cardNumber,
                cardName: `NH ${memberType} ${cardGrade}`.trim(),
                cardCompanyId: 'nh-card',
                cardType: memberType.includes('체크') ? 'check' : 'credit',
                userType: userType,
                memberType: memberType,
                expiryDate: expiryDate,
                issueDate: issueDate,
                cardGrade: cardGrade,
                cardStatus: cardStatus
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
   * Gets transactions for selected card and date range
   * Reference: NHCard-getalltransactions.spec.js
   * @param {string} [cardNumber] - Card number (not used - NH Card shows all by default)
   * @param {string|number} startDate - Start date in YYYYMMDD format (e.g., 20260203)
   * @param {string|number} endDate - End date in YYYYMMDD format (e.g., 20260203)
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Fetching transactions...');

      // Step 1: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Step 2: Click label for transaction search (not a radio button!)
      await this.page.locator('xpath=/html/body/div[3]/div[3]/div[1]/section[1]/form/div[3]/div[2]/ul/li[3]/label').click({ timeout: 10000 });
      await this.page.waitForTimeout(3000);

      // Step 2.5: Set date range if provided
      if (startDate && endDate) {
        this.log(`Setting date range: ${startDate} to ${endDate}`);

        // Fill start date
        this.log('Setting start date...');
        const startDateInput = this.page.locator('xpath=/html/body/div[3]/div[3]/div[1]/section[1]/form/div[4]/div[2]/div[1]/input');
        await startDateInput.click({ timeout: 10000 });
        await this.page.waitForTimeout(300);
        await startDateInput.press('Control+a'); // Select all on the input
        await this.page.waitForTimeout(100);
        await startDateInput.fill(String(startDate));
        await this.page.waitForTimeout(1000);

        // Fill end date
        this.log('Setting end date...');
        const endDateInput = this.page.locator('xpath=/html/body/div[3]/div[3]/div[1]/section[1]/form/div[4]/div[2]/div[3]/input');
        await endDateInput.click({ timeout: 10000 });
        await this.page.waitForTimeout(300);
        await endDateInput.press('Control+a'); // Select all on the input
        await this.page.waitForTimeout(100);
        await endDateInput.fill(String(endDate));
        await this.page.waitForTimeout(1000);

        this.log('Date range set successfully');
      }

      // Step 3: Click search button
      this.log('Clicking search button...');
      await this.clickElement(this.config.xpaths.transactionSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 4: Select company division and navigate to transaction list
      this.log('Selecting company division...');
      // Wait for division selector to appear (#formResult > div.payment-list)
      await this.page.waitForSelector('#formResult > div.payment-list', { timeout: 10000 });
      await this.page.waitForTimeout(1000);

      // Click division button to navigate to transaction list page
      this.log('Clicking division button...');
      await this.page.locator('xpath=/html/body/div[3]/div[3]/div[1]/section[2]/div[2]/form/div[2]/div/div[2]/button').click({ timeout: 10000 });
      await this.page.waitForTimeout(3000);

      // Step 5: Click download button to trigger popup
      this.log('Clicking download button...');
      await this.page.locator('xpath=/html/body/div[3]/div[3]/div[2]/div/div/ul/li[2]/button/span').click({ timeout: 10000 });
      await this.page.waitForTimeout(2000);

      // Step 6: Confirm download (skip popup check, go straight to confirmation)
      this.log('Confirming Excel download...');
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

      // Click confirmation button in popup
      await this.page.locator('xpath=/html/body/div[6]/div[2]/div/div/div[2]/div/button[2]').click({ timeout: 10000 });

      // Wait for download to complete
      this.log('Waiting for download to complete...');
      const download = await downloadPromise;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `NH카드_승인내역_${timestamp}.xlsx`;
      const downloadPath = path.join(this.outputDir, 'downloads', filename);

      // Ensure download directory exists
      const downloadDir = path.join(this.outputDir, 'downloads');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      await download.saveAs(downloadPath);
      this.log(`Downloaded file: ${downloadPath}`);

      // Parse the downloaded Excel file
      const extractedData = this.parseNHCardExcel(downloadPath);

      return [{
        status: 'downloaded',
        filename: filename,
        path: downloadPath,
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
   * Parses downloaded Excel file from NH Card
   * @param {string} filePath - Path to downloaded Excel file
   * @returns {Object} Extracted transaction data
   */
  parseNHCardExcel(filePath) {
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

      // NH Card Excel header is at row 10 (index 9)
      const headerRowIndex = 9;

      if (rawData.length <= headerRowIndex) {
        throw new Error(`Excel file has insufficient rows. Expected at least ${headerRowIndex + 1} rows, got ${rawData.length}`);
      }

      const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
      this.log(`Found headers at row ${headerRowIndex + 1}: ${headers.join(', ')}`);

      // Expected headers for validation:
      // 이용카드, 사용자명, 이용일시, 승인번호, 국내이용금액(원), 취소금액, 가맹점명, 매출종류, 할부기간, 취소여부,
      // 접수년월일, 결제일, 국내외구분, 공급가액(원), 부가세(원), 보증금(원), 봉사료(원), 가맹점사업자번호,
      // 가맹점업종, 가맹점우편번호, 가맹점주소1, 가맹점주소2, 가맹점주소(전체), 가맹점전화번호, 가맹점대표자명,
      // 기타도로명우편번호, 신주소

      // Parse transaction rows (starting from row 11, index 10)
      const transactions = [];
      let totalAmount = 0;

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];

        // Skip empty rows
        if (!row || row.length === 0) continue;

        // Skip rows where first cell is empty or contains summary text
        const firstCell = String(row[0] || '').trim();
        if (!firstCell || firstCell.includes('합계') || firstCell.includes('총') || firstCell.includes('계')) {
          continue;
        }

        // Map row to object using headers
        const transaction = {};
        headers.forEach((header, index) => {
          const value = row[index];
          transaction[header] = value !== undefined && value !== null ? value : '';
        });

        transactions.push(transaction);

        // Extract amount for total - use "국내이용금액(원)" column
        const amountValue = transaction['국내이용금액(원)'];
        if (amountValue !== undefined && amountValue !== null && amountValue !== '') {
          const amount = parseFloat(String(amountValue).replace(/[^\d.-]/g, ''));
          if (!isNaN(amount)) {
            totalAmount += amount;
          }
        }
      }

      const result = {
        metadata: {
          bankName: 'NH농협카드',
          downloadDate: new Date().toISOString(),
          sourceFile: path.basename(filePath),
          sheetName: sheetName,
          headerRowIndex: headerRowIndex + 1, // 1-based for user display
        },
        summary: {
          totalCount: transactions.length,
          totalAmount: totalAmount,
        },
        headers: headers,
        transactions: transactions,
      };

      this.log(`Parsed ${transactions.length} transactions, total amount: ${totalAmount.toLocaleString()}원`);
      return result;
    } catch (error) {
      this.log(`Excel parsing failed: ${error.message}`, 'error');
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
function createNHCardAutomator(options = {}) {
  return new NHCardAutomator(options);
}

/**
 * Run NH Card automation (convenience function)
 * @param {string} userId - User ID
 * @param {string} password - Password
 * @param {string} [cardNumber] - Optional card number (not used - shows all cards)
 * @param {string} [proxyUrl] - Optional proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runNHCardAutomation(userId, password, cardNumber = null, proxyUrl) {
  const automator = createNHCardAutomator();
  try {
    const loginResult = await automator.login({ userId, password }, proxyUrl);
    if (loginResult.success) {
      // Get all transactions (NH Card doesn't use date filters in the recorded actions)
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
  NH_CARD_INFO,
  NH_CARD_CONFIG,
  NHCardAutomator,
  createNHCardAutomator,
  runNHCardAutomation,
};
