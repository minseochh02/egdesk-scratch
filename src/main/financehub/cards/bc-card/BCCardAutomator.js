// ============================================================================
// BC CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
const { BaseCardAutomator } = require('../../core/BaseCardAutomator');
const { BC_CARD_INFO, BC_CARD_CONFIG } = require('./config');

/**
 * BC Card Automator
 * Handles login and transaction automation for BC Card (wisebiz.bccard.com)
 *
 * Key Difference: BC Card uses Excel download (ZIP format) instead of in-page table extraction
 */
class BCCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...BC_CARD_CONFIG,
      targetUrl: BC_CARD_INFO.loginUrl,
      bank: BC_CARD_INFO,
      card: BC_CARD_INFO,
      headless: options.headless ?? false,
      chromeProfile: options.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'bc-card');
    this.downloadDir = path.join(this.outputDir, 'downloads');

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
   * Reference: bccard.spec.js lines 176-213
   * @param {Object} credentials - { userId, password }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const { userId, password } = credentials;
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Create browser
      this.log('Starting BC Card automation...');
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;

      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

      // Setup download path for this page
      this.page._downloadPath = this.downloadDir;

      // Step 2: Navigate to intro page (line 176)
      this.log('Navigating to BC Card intro page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Click login link (line 180)
      this.log('Clicking login link...');
      try {
        await this.page.locator(this.config.xpaths.loginLink.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.loginLink.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 4: Fill user ID (lines 188-194)
      this.log('Entering user ID...');
      await this.page.locator(this.config.xpaths.idInput.css).click();
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await this.page.fill(this.config.xpaths.idInput.css, userId);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 5: Fill password (lines 198-204)
      this.log('Entering password...');
      await this.page.locator(this.config.xpaths.passwordInput.css).click();
      await this.page.waitForTimeout(this.config.delays.betweenActions);
      await this.page.fill(this.config.xpaths.passwordInput.css, password);
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 6: Click login button (line 208)
      this.log('Clicking login button...');
      try {
        await this.page.locator(this.config.xpaths.loginButton.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.loginButton.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 7: Handle post-login popups
      await this.handlePostLoginPopups();

      // Step 8: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Start session keep-alive
      this.log('Login successful!');
      this.startSessionKeepAlive();

      return {
        success: true,
        isLoggedIn: true,
        userName: null,
      };

    } catch (error) {
      this.error('Login automation failed:', error.message);

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
    }
  }

  // ============================================================================
  // POST-LOGIN NAVIGATION
  // ============================================================================

  /**
   * Handles popups after login
   * BC Card may have popups - use defensive approach
   */
  async handlePostLoginPopups() {
    try {
      this.log('Handling post-login popups...');

      const popupSelectors = this.config.xpaths.popupClose;

      for (const selector of popupSelectors) {
        try {
          const locator = this.page.locator(`xpath=${selector}`);
          const isVisible = await locator.isVisible({ timeout: 2000 });

          if (isVisible) {
            await locator.click();
            this.log('Closed popup with selector:', selector);
            await this.page.waitForTimeout(1000);
          }
        } catch (e) {
          // Silent failure - popup might not exist
        }
      }

      this.log('Popup handling complete');
    } catch (error) {
      this.warn('Error handling popups:', error.message);
    }
  }

  /**
   * Navigates to transaction history page
   * Reference: bccard.spec.js lines 214-228
   */
  async navigateToTransactionHistory() {
    this.log('Navigating to transaction history...');

    try {
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Hover "카드이용조회" menu to reveal submenu
      this.log('Hovering card usage menu...');
      try {
        await this.page.locator(this.config.xpaths.cardUsageMenu.css).hover({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.cardUsageMenu.xpath}`).hover();
      }
      await this.page.waitForTimeout(this.config.delays.afterMenuClick);

      // Click "승인내역조회" submenu (line 224)
      this.log('Clicking approval history submenu...');
      try {
        await this.page.locator(this.config.xpaths.approvalHistorySubmenu.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.approvalHistorySubmenu.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

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
   * Navigates to 카드정보조회 > 보유카드조회 and extracts from table
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Getting card list...');

      // Wait for page to fully load
      await this.page.waitForTimeout(2000);

      // Step 1: Click "카드정보조회" button
      this.log('Clicking 카드정보조회 menu...');
      await this.page.locator('#lnb > div.lnbCon > nav > ul > li.KEY0106 > a').click();
      await this.page.waitForTimeout(1000);

      // Step 2: Click "보유카드조회" submenu
      this.log('Clicking 보유카드조회 submenu...');
      await this.page.locator('#lnb > div.lnbCon > nav > ul > li.KEY0106.on > ul > li.KEY010601 > a').click();
      await this.page.waitForTimeout(2000);

      // Step 3: Extract cards from table
      this.log('Extracting cards from table...');
      const cards = await this.page.evaluate(() => {
        const table = document.querySelector('#grid > div:nth-child(2) > canvas > table');
        if (!table) return [];

        const rows = table.querySelectorAll('tbody tr');
        const cardList = [];

        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length < 11) continue; // Should have 11 columns

          // Extract card information from columns
          const departmentCode = cells[0]?.textContent.trim() || '';
          const issuer = cells[1]?.textContent.trim() || '';
          const cardName = cells[2]?.textContent.trim() || '';
          const cardNumber = cells[3]?.textContent.trim() || '';
          const assignee = cells[4]?.textContent.trim() || '';
          const cardType = cells[5]?.textContent.trim() || '';
          const paymentDate = cells[6]?.textContent.trim() || '';
          const paymentBank = cells[7]?.textContent.trim() || '';
          const paymentAccount = cells[8]?.textContent.trim() || '';

          if (cardNumber) {
            cardList.push({
              cardNumber: cardNumber,
              cardName: cardName || 'BC Card',
              issuer: issuer,
              cardCompanyId: 'bc-card',
              cardType: cardType || 'corporate',
              assignee: assignee,
              departmentCode: departmentCode,
              paymentDate: paymentDate,
              paymentBank: paymentBank,
              paymentAccount: paymentAccount,
            });
          }
        }

        return cardList;
      });

      this.log(`Found ${cards.length} card(s)`);

      if (cards.length === 0) {
        this.warn('No cards found in table, returning default');
        return [{
          cardNumber: 'default',
          cardName: 'BC Card',
          cardCompanyId: 'bc-card',
          cardType: 'corporate',
        }];
      }

      // Step 4: Navigate back to transaction history page
      this.log('Navigating back to transaction history...');

      // Hover "카드이용조회" menu to reveal submenu
      this.log('Hovering card usage menu...');
      try {
        await this.page.locator(this.config.xpaths.cardUsageMenu.css).hover({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.cardUsageMenu.xpath}`).hover();
      }
      await this.page.waitForTimeout(this.config.delays.afterMenuClick);

      // Click "승인내역조회" submenu
      this.log('Clicking approval history submenu...');
      try {
        await this.page.locator(this.config.xpaths.approvalHistorySubmenu.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.approvalHistorySubmenu.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.afterNavigation);

      this.log('Successfully navigated back to transaction history');

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
   * Sets search criteria for transactions
   * @param {string} startDate - Start date (YYYYMMDD)
   * @param {string} endDate - End date (YYYYMMDD)
   */
  async setSearchCriteria(startDate, endDate) {
    this.log('Setting search criteria...');

    try {
      // Step 1: Click "기간 지정" (period specification) label
      this.log('Clicking period specification label...');
      try {
        await this.page.locator(this.config.xpaths.periodSpecificationLabel.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.periodSpecificationLabel.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 2: Fill start date in #fromDate (format: YYYYMMDD)
      this.log(`Setting start date: ${startDate}`);
      try {
        await this.page.fill(this.config.xpaths.fromDateInput.css, startDate);
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.fromDateInput.xpath}`).fill(startDate);
      }
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      // Step 3: Fill end date in #toDate (format: YYYYMMDD)
      this.log(`Setting end date: ${endDate}`);
      try {
        await this.page.fill(this.config.xpaths.toDateInput.css, endDate);
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.toDateInput.xpath}`).fill(endDate);
      }
      await this.page.waitForTimeout(this.config.delays.betweenActions);

      this.log('Search criteria set');
    } catch (error) {
      this.error('Failed to set search criteria:', error.message);
      throw error;
    }
  }

  /**
   * Downloads Excel file from BC Card
   * Reference: bccard.spec.js lines 327-345
   * @returns {Promise<string>} Path to downloaded file
   */
  async downloadExcelFile() {
    this.log('Downloading Excel file...');

    try {
      // Setup download handler before clicking (line 328)
      const downloadPromise = this.page.waitForEvent('download', {
        timeout: this.config.timeouts.downloadWait
      });

      // Click Excel download button (line 331)
      this.log('Clicking Excel download button...');
      try {
        await this.page.locator(this.config.xpaths.excelDownloadButton.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.excelDownloadButton.xpath}`).click();
      }

      // Wait for download to complete (lines 338-341)
      this.log('Waiting for download...');
      const download = await downloadPromise;

      const originalFilename = download.suggestedFilename();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `BC카드_승인내역_${timestamp}_${originalFilename}`;
      const filePath = path.join(this.downloadDir, filename);

      await download.saveAs(filePath);
      this.log('Download completed:', filePath);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Downloaded file not found: ' + filePath);
      }

      return filePath;

    } catch (error) {
      this.error('Failed to download Excel file:', error.message);
      throw error;
    }
  }

  /**
   * Parses downloaded Excel file (ZIP format)
   * BC Card downloads as .zip containing .xlsx file
   * @param {string} filePath - Path to downloaded ZIP file
   * @returns {Promise<Object>} Parsed transaction data
   */
  async parseDownloadedExcel(filePath) {
    this.log('Parsing downloaded Excel file:', filePath);

    try {
      const AdmZip = require('adm-zip');
      const XLSX = require('xlsx');

      let excelPath = filePath;
      let extractDir = null;

      // Step 1: Handle ZIP file
      if (filePath.endsWith('.zip')) {
        this.log('Extracting ZIP file...');
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        // Find Excel file in ZIP
        const excelEntry = zipEntries.find(e =>
          e.entryName.endsWith('.xlsx') || e.entryName.endsWith('.xls')
        );

        if (!excelEntry) {
          throw new Error('No Excel file found in ZIP archive');
        }

        this.log('Found Excel file in ZIP:', excelEntry.entryName);

        // Extract to temp directory
        extractDir = path.join(os.tmpdir(), `bc-card-extract-${Date.now()}`);
        fs.mkdirSync(extractDir, { recursive: true });

        zip.extractEntryTo(excelEntry, extractDir, false, true);
        excelPath = path.join(extractDir, excelEntry.entryName);

        this.log('Extracted to:', excelPath);
      }

      // Step 2: Parse Excel file using buffer (handles both .xls and .xlsx)
      this.log('Reading Excel file...');
      const fileBuffer = fs.readFileSync(excelPath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      this.log(`Excel has ${rows.length} rows`);

      // Step 3: Find header row
      // BC Card actual headers: 본부명, 부서명, 카드번호, 카드구분, 카드소지자, 거래은행, 사용구분, 매출종류,
      //                        할부기간, 승인일자, 승인시간, 승인번호, 가맹점명/국가명, 승인금액, 환율, 해외승인원화금액
      let headerRowIndex = -1;
      const headerKeywords = ['카드번호', '승인일자', '승인금액'];

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        const rowText = row.join('');

        if (headerKeywords.every(keyword => rowText.includes(keyword))) {
          headerRowIndex = i;
          this.log('Found header row at index:', i);
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Could not find header row in Excel file');
      }

      const headers = rows[headerRowIndex];
      this.log('Headers:', headers);

      // Step 4: Parse transaction rows
      const transactions = [];
      const dataRows = rows.slice(headerRowIndex + 1);

      for (const row of dataRows) {
        if (row.length < headers.length) continue;

        // Skip empty rows
        if (!row.join('').trim()) continue;

        // Skip total rows (합계)
        const firstCell = row[0] ? String(row[0]).trim() : '';
        if (firstCell === '합' || firstCell === '합계' || firstCell.includes('합계')) {
          this.log('Skipping total row');
          continue;
        }

        const transaction = {};

        // Map based on actual BC Card Excel structure (16 columns)
        headers.forEach((header, index) => {
          const value = row[index];

          switch (header) {
            case '본부명':
              transaction.headquartersName = value;
              break;
            case '부서명':
              transaction.departmentName = value;
              break;
            case '카드번호':
              transaction.cardNumber = value;
              break;
            case '카드구분':
              transaction.cardType = value;
              break;
            case '카드소지자':
              transaction.cardHolder = value;
              break;
            case '거래은행':
              transaction.transactionBank = value;
              break;
            case '사용구분':
              transaction.usageType = value;
              break;
            case '매출종류':
              transaction.salesType = value;
              break;
            case '할부기간':
              transaction.installmentPeriod = value;
              break;
            case '승인일자':
              transaction.approvalDate = value;
              break;
            case '승인시간':
              transaction.approvalTime = value;
              break;
            case '승인번호':
              transaction.approvalNumber = value;
              break;
            case '가맹점명/국가명':
              transaction.merchantName = value;
              break;
            case '승인금액':
              transaction.approvalAmount = this.parseAmount(value);
              break;
            case '환율':
              transaction.exchangeRate = value;
              break;
            case '해외승인원화금액':
              transaction.foreignAmountKRW = this.parseAmount(value);
              break;
            default:
              // Store additional columns
              transaction[header] = value;
          }
        });

        // Only add if has meaningful data
        if (transaction.cardNumber || transaction.merchantName) {
          // Combine date and time for compatibility
          if (transaction.approvalDate && transaction.approvalTime) {
            transaction.approvalDateTime = `${transaction.approvalDate} ${transaction.approvalTime}`;
          }
          transactions.push(transaction);
        }
      }

      this.log(`Parsed ${transactions.length} transactions`);

      // Calculate summary
      const totalAmount = transactions.reduce((sum, t) => {
        const amount = parseFloat(t.approvalAmount) || 0;
        return sum + amount;
      }, 0);

      const result = {
        metadata: {
          bankName: 'BC카드',
          downloadDate: new Date().toISOString(),
          sourceFile: path.basename(filePath),
          extractedFile: excelPath !== filePath ? path.basename(excelPath) : null,
        },
        summary: {
          totalCount: transactions.length,
          totalAmount: totalAmount,
        },
        headers: headers,
        transactions: transactions,
      };

      // Cleanup extracted directory
      if (extractDir && fs.existsSync(extractDir)) {
        try {
          fs.rmSync(extractDir, { recursive: true, force: true });
          this.log('Cleaned up extraction directory');
        } catch (e) {
          this.warn('Failed to cleanup extraction directory:', e.message);
        }
      }

      return result;

    } catch (error) {
      this.error('Failed to parse Excel file:', error.message);
      throw error;
    }
  }

  /**
   * Gets transactions for selected card and date range
   * @param {string} [cardNumber] - Card number (optional)
   * @param {string} startDate - Start date (YYYYMMDD)
   * @param {string} endDate - End date (YYYYMMDD)
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`Fetching transactions from ${startDate} to ${endDate}...`);

      // Step 1: Set search criteria
      await this.setSearchCriteria(startDate, endDate);

      // Step 2: Click search button
      this.log('Clicking search button...');
      try {
        await this.page.locator(this.config.xpaths.searchButton.css).click({ timeout: 10000 });
      } catch (e) {
        this.log('CSS selector failed, trying XPath fallback...');
        await this.page.locator(`xpath=${this.config.xpaths.searchButton.xpath}`).click();
      }
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 3: Download Excel file
      const downloadPath = await this.downloadExcelFile();

      // Step 4: Parse Excel file
      const extractedData = await this.parseDownloadedExcel(downloadPath);

      return [{
        status: 'downloaded',
        filename: path.basename(downloadPath),
        path: downloadPath,
        extractedData: extractedData,
      }];

    } catch (error) {
      this.error('Error fetching transactions:', error.message);
      return [];
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Formats date with dashes (YYYYMMDD -> YYYY-MM-DD)
   */
  formatDateWithDashes(dateStr) {
    if (dateStr.includes('-')) return dateStr;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }

  /**
   * Formats date with dots (YYYYMMDD -> YYYY.MM.DD)
   */
  formatDateWithDots(dateStr) {
    if (dateStr.includes('.')) return dateStr;
    return `${dateStr.substring(0, 4)}.${dateStr.substring(4, 6)}.${dateStr.substring(6, 8)}`;
  }

  /**
   * Parses amount string to number
   */
  parseAmount(value) {
    if (typeof value === 'number') return value.toString();
    if (!value) return '0';

    // Remove commas and non-numeric characters except decimal point
    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    return cleaned || '0';
  }
}

// Factory function
function createBCCardAutomator(options = {}) {
  return new BCCardAutomator(options);
}

/**
 * Run BC Card automation (convenience function)
 * @param {string} userId - User ID
 * @param {string} password - Password
 * @param {string} [cardNumber] - Optional card number
 * @param {string} [proxyUrl] - Optional proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runBCCardAutomation(userId, password, cardNumber = null, proxyUrl) {
  const automator = createBCCardAutomator();
  try {
    const loginResult = await automator.login({ userId, password }, proxyUrl);
    if (loginResult.success) {
      // Get transactions for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
      const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');

      const transactions = await automator.getTransactions(cardNumber, startDateStr, endDateStr);
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
  BC_CARD_INFO,
  BC_CARD_CONFIG,
  BCCardAutomator,
  createBCCardAutomator,
  runBCCardAutomation,
};
