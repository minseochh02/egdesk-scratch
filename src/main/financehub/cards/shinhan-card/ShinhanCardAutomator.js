// ============================================================================
// SHINHAN CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { SerialPort } = require('serialport');
const { BaseCardAutomator } = require('../../core/BaseCardAutomator');
const { SHINHAN_CARD_INFO, SHINHAN_CARD_CONFIG } = require('./config');
const { sendPasswordWithNaturalTiming } = require('../../utils/virtual-hid-bridge');

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

      // Step 6: Fill password (Arduino HID or Manual)
      if (this.manualPassword) {
        // DEBUG MODE: Manual password entry
        this.log('Manual password mode enabled');
        const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
        await passwordField.click();
        await this.page.waitForTimeout(1500);

        this.log('Waiting for manual password entry...');
        await this.waitForManualPasswordEntry();
        this.log('Manual password entry completed');
      } else {
        // AUTOMATIC MODE: Virtual HID keyboard with natural timing (bypasses security keyboard!)
        this.log('Entering password via Virtual HID with natural timing...');
        try {
          const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
          await passwordField.click();
          await this.page.waitForTimeout(1500);

          this.log('Security keyboard activated, typing via Virtual HID...');
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
          this.log(`Virtual HID password entry failed: ${e.message}`, 'error');
          throw new Error(`Password entry failed: ${e.message}`);
        }
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

      // Step 1: Click "보유카드" link (use first match to avoid strict mode violation)
      try {
        await this.page.locator('a.menu2[href="/crp/CRP21000N/CRP21120PH00.shc"]').click({ timeout: 10000 });
      } catch (e) {
        this.log('Specific selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.myCardsLink.xpath}`).click({ timeout: 10000 });
      }
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

      // Step 2: Click category radio button (click span instead of input since span intercepts clicks)
      this.log('Selecting card category...');
      await this.page.locator('xpath=/html/body/div[2]/div/div/div/div[2]/div[2]/div[1]/form/div[4]/div/ul/li[1]/div/div[2]/div[1]/ol/li/div/label[2]/span').click({ timeout: 10000 });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Click 조회 button
      await this.clickElement(this.config.xpaths.cardSearchButton);
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 4: Download Excel file
      this.log('Downloading card list Excel...');
      const downloadPromise = this.page.waitForEvent('download', {
        timeout: this.config.timeouts.downloadWait,
      });

      // Click Excel download button
      await this.page.locator('xpath=/html/body/div[2]/div/div/div/div[7]/div/button[1]').click({ timeout: 10000 });
      await this.page.waitForTimeout(1000);

      // Click confirmation button in popup
      this.log('Clicking download confirmation button...');
      await this.page.locator('xpath=/html/body/div[3]/div/div/article/div/div[3]/button[1]').click({ timeout: 10000 });

      // Wait for download
      this.log('Waiting for download to complete...');
      const download = await downloadPromise;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `신한카드_보유카드_${timestamp}.xlsx`;
      const downloadPath = path.join(this.downloadDir, filename);
      await download.saveAs(downloadPath);
      this.log(`Downloaded card list: ${downloadPath}`);

      // Step 5: Parse Excel file
      this.log('Parsing card list from Excel...');
      const fileBuffer = fs.readFileSync(downloadPath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const cards = [];

      // Find header row
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        const rowText = row.join(' ');
        if (rowText.includes('카드번호') && rowText.includes('이용자한글명')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        this.log('Could not find header row in Excel', 'warn');
        throw new Error('Header row not found in Excel file');
      }

      const headers = rawData[headerRowIndex];
      const cardNumberIndex = headers.indexOf('카드번호');
      const cardNameIndex = headers.indexOf('이용자한글명');
      const cardTypeIndex = headers.indexOf('카드종류');

      this.log(`Header row at index ${headerRowIndex}, cardNumber at column ${cardNumberIndex}`);

      // Parse data rows
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const cardNumber = row[cardNumberIndex] ? String(row[cardNumberIndex]).trim() : '';
        const cardName = row[cardNameIndex] ? String(row[cardNameIndex]).trim() : '';
        const cardType = row[cardTypeIndex] ? String(row[cardTypeIndex]).trim() : '';

        if (cardNumber) {
          cards.push({
            cardNumber: cardNumber,
            cardName: cardName || cardType || 'Shinhan Card',
            cardCompanyId: 'shinhan-card',
            cardType: 'personal',
          });
          this.log(`Found card: ${cardNumber} - ${cardName || cardType}`);
        }
      }

      if (cards.length === 0) {
        this.log('No cards found in Excel, returning default card');
        return [{
          cardNumber: 'default',
          cardName: 'Shinhan Card',
          cardCompanyId: 'shinhan-card',
          cardType: 'personal',
        }];
      }

      this.log(`Found ${cards.length} card(s) from Excel`);
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

      // Step 2: Set searchGubun = "1" (click span, not fill radio button)
      this.log('Clicking searchGubun radio button...');
      await this.page.locator('xpath=/html/body/div[2]/div/div/div[1]/div/div[2]/div[2]/div[2]/form/div[4]/div/ul/li[1]/div/div[1]/label[1]/span').click({ timeout: 10000 });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Set searchArea = "local" (skip if not needed, or click appropriate radio)
      // await this.clickElement(this.config.xpaths.searchAreaLabel);
      // await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 4: Skip searchPeriod - not needed

      // Step 5: Fill start date (YYYYMMDD format) - select all and delete first
      this.log(`Setting start date: ${startDate}`);
      const startDateInput = this.page.locator('xpath=/html/body/div[2]/div/div/div[1]/div/div[2]/div[2]/div[2]/form/div[4]/div/ul/li[5]/div/div/div/div/div[2]/div[1]/div/span[1]/input');
      await startDateInput.click();
      await this.page.waitForTimeout(300);
      await startDateInput.press('Control+a'); // Select all
      await this.page.waitForTimeout(100);
      await startDateInput.press('Delete'); // Delete
      await this.page.waitForTimeout(100);
      await startDateInput.fill(startDate);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 6: Fill end date (YYYYMMDD format) - select all and delete first
      this.log(`Setting end date: ${endDate}`);
      const endDateInput = this.page.locator('xpath=/html/body/div[2]/div/div/div[1]/div/div[2]/div[2]/div[2]/form/div[4]/div/ul/li[5]/div/div/div/div/div[2]/div[1]/div/span[2]/input');
      await endDateInput.click();
      await this.page.waitForTimeout(300);
      await endDateInput.press('Control+a'); // Select all
      await this.page.waitForTimeout(100);
      await endDateInput.press('Delete'); // Delete
      await this.page.waitForTimeout(100);
      await endDateInput.fill(endDate);
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

      // Step 1: Click search button (first time)
      this.log('Clicking search button...');
      await this.page.locator('xpath=/html/body/div[2]/div/div/div[1]/div/div[2]/div[2]/div[3]/a').click({ timeout: 10000 });
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 2: Check if download button exists (if not, no transactions)
      const downloadButton = this.page.locator(`xpath=${this.config.xpaths.downloadButton.xpath}`);
      const downloadButtonExists = await downloadButton.count() > 0;

      if (!downloadButtonExists) {
        this.log('No download button found - no transactions available');
        return null; // Return null to indicate no transactions
      }

      // Setup download promise
      const downloadPromise = this.page.waitForEvent('download', {
        timeout: this.config.timeouts.downloadWait,
      });

      // Step 3: Click download button
      await this.clickElement(this.config.xpaths.downloadButton);
      await this.page.waitForTimeout(this.config.delays.afterDownload);

      // Step 4: Click "예" confirmation button
      await this.clickElement(this.config.xpaths.downloadConfirmButton);

      // Step 5: Wait for download
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

      // Column mapping: Korean -> SQL-friendly (based on actual Excel headers)
      const columnMapping = {
        '이용일시': 'transactionDate',
        '승인번호': 'approvalNumber',
        '이용카드': 'cardUsed',
        '이용자번호': 'userNumber',
        '가상카드번호': 'virtualCardNumber',
        '이용자명': 'userName',
        '가맹점명': 'merchantName',
        '이용금액': 'amount',
        '이용구분': 'transactionType',
        '할부개월수': 'installmentMonths',
        '카드구분': 'cardType',
        '취소일자': 'cancellationDate',
        '매입상태': 'purchaseStatus',
        '결제예정일': 'paymentDueDate',
      };

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

        // Map row to object with both Korean and English column names
        const transaction = {};
        headers.forEach((header, index) => {
          const value = row[index];
          // Store with Korean column name
          transaction[header] = value;
          // Also store with English column name if mapping exists
          const englishColumn = columnMapping[header];
          if (englishColumn) {
            transaction[englishColumn] = value;
          }
        });

        transactions.push(transaction);

        // Extract amount for total (use mapped 'amount' field)
        if (transaction.amount !== undefined && transaction.amount !== null) {
          const amount = parseFloat(String(transaction.amount).replace(/[^\d.-]/g, ''));
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
          columnMapping: columnMapping,
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
   * Get transactions for ALL cards (Shinhan Card limitation)
   * NOTE: Shinhan Card downloads transactions for ALL cards at once, not per card
   * NOTE: Maximum date range is ~7 days
   * @param {string} cardNumber - Card number (ignored - fetches all cards)
   * @param {string} startDate - Start date in YYYYMMDD format
   * @param {string} endDate - End date in YYYYMMDD format
   * @returns {Promise<Array>} Array of transaction results (for all cards)
   */
  async getTransactions(cardNumber, startDate, endDate) {
    try {
      this.log(`Getting transactions for ALL cards from ${startDate} to ${endDate}`);

      // Step 1: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Step 2: Set search criteria
      await this.setSearchCriteria(startDate, endDate);

      // Step 3: Download Excel file
      const downloadPath = await this.downloadExcelFile();

      // If no download (no transactions), return empty result
      if (!downloadPath) {
        this.log('No transactions found for this period');
        return [{
          status: 'no-transactions',
          filename: null,
          path: null,
          extractedData: {
            metadata: {
              bankName: '신한카드',
              downloadDate: new Date().toISOString(),
              sourceFile: null,
              columnMapping: {
                '이용일시': 'transactionDate',
                '승인번호': 'approvalNumber',
                '이용카드': 'cardUsed',
                '이용자번호': 'userNumber',
                '가상카드번호': 'virtualCardNumber',
                '이용자명': 'userName',
                '가맹점명': 'merchantName',
                '이용금액': 'amount',
                '이용구분': 'transactionType',
                '할부개월수': 'installmentMonths',
                '카드구분': 'cardType',
                '취소일자': 'cancellationDate',
                '매입상태': 'purchaseStatus',
                '결제예정일': 'paymentDueDate',
              },
            },
            summary: {
              totalCount: 0,
              totalAmount: 0,
            },
            headers: [],
            transactions: [],
          },
        }];
      }

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
