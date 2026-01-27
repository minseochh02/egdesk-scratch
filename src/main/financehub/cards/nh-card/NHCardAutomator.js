// ============================================================================
// NH CARD AUTOMATOR
// ============================================================================

const path = require('path');
const fs = require('fs');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NH_CARD_INFO, NH_CARD_CONFIG } = require('./config');
const {
  parseTransactionExcel,
  extractTransactionsFromPage,
  createExcelFromData
} = require('../../utils/transactionParser');

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
      const element = this.page.locator(selector.css);
      await element.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await element.click({ timeout: 10000 });
    } catch (e) {
      this.log('CSS selector failed, trying XPath fallback...');
      try {
        const element = this.page.locator(`xpath=${selector.xpath}`);
        await element.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await element.click({ timeout: 10000 });
      } catch (xpathError) {
        this.log('XPath click failed, trying force click...');
        await this.page.locator(`xpath=${selector.xpath}`).click({ force: true, timeout: 10000 });
      }
    }
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

      // Step 5: Click and type password using keyboard
      this.log('Entering password...');
      await this.clickElement(this.config.xpaths.passwordInput);
      await this.page.waitForTimeout(3000);

      // Focus the password field
      const passwordField = this.page.locator(this.config.xpaths.passwordInput.css);
      await passwordField.focus();
      await this.page.waitForTimeout(500);

      // Clear any existing content
      await passwordField.fill('');
      await this.page.waitForTimeout(200);

      // Type password character by character using keyboard events
      this.log(`Typing password (${password.length} characters)...`);
      for (let i = 0; i < password.length; i++) {
        const char = password[i];
        await this.page.keyboard.type(char, { delay: 100 });
      }

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
      await this.page.waitForTimeout(1002);
      await this.page.fill(this.config.xpaths.searchGubunRadio.css, 'on');
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
   * Clicks "더보기" (Load More) button until all transactions are loaded
   * Reference: NHCard-getalltransactions.spec.js line 258
   */
  async loadAllTransactions() {
    this.log('Loading all transactions...');

    let totalExpansions = 0;
    const maxClicks = 50; // Safety limit

    while (totalExpansions < maxClicks) {
      try {
        const loadMoreButton = this.page.locator(this.config.xpaths.loadMoreButton.css);
        const isVisible = await loadMoreButton.isVisible({ timeout: 2000 });

        if (isVisible) {
          const isDisabled = await loadMoreButton.evaluate(el => {
            return el.classList.contains('disabled') ||
                   el.hasAttribute('disabled') ||
                   el.disabled;
          }).catch(() => false);

          if (!isDisabled) {
            await loadMoreButton.click();
            totalExpansions++;
            this.log(`Clicked "더보기" button (${totalExpansions} expansions)`);
            await this.page.waitForTimeout(3000);
          } else {
            this.log('Button is disabled - all data loaded');
            break;
          }
        } else {
          this.log('No more "더보기" button found - all data loaded');
          break;
        }
      } catch (e) {
        this.log('Button not found or error clicking:', e.message);
        break;
      }
    }

    if (totalExpansions >= maxClicks) {
      this.warn(`Reached safety limit of ${maxClicks} expansions`);
    } else {
      this.log(`Loading complete: ${totalExpansions} total expansions`);
    }
  }

  /**
   * Gets transactions for selected card and date range
   * Reference: NHCard-getalltransactions.spec.js
   * @param {string} [cardNumber] - Card number (not used - NH Card shows all by default)
   * @param {string|number} startDate - Start date (not used in recording)
   * @param {string|number} endDate - End date (not used in recording)
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Fetching transactions...');

      // Step 1: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Step 2: Click radio button #rdoSchGubun2
      await this.clickElement(this.config.xpaths.searchGubunRadio);
      await this.page.waitForTimeout(1002);
      await this.page.fill(this.config.xpaths.searchGubunRadio.css, 'on');
      await this.page.waitForTimeout(3000);

      // Step 3: Click search button
      this.log('Clicking search button...');
      await this.clickElement(this.config.xpaths.transactionSearchButton);
      await this.page.waitForTimeout(3000);

      // Step 4: Load all results by clicking "더보기"
      await this.loadAllTransactions();

      // Step 5: Extract data
      const extractedData = await this.extractNHCardTransactions();

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
   * Extracts transaction data from NH Card's HTML structure
   * Reference: NHCard-getalltransactions.spec.js (table capture comments)
   * @returns {Promise<Object>} Extracted transaction data
   */
  async extractNHCardTransactions() {
    this.log('Extracting NH Card transaction data...');

    const bankName = this.config.bank.nameKo;

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

      // Extract company info (Table 1)
      // XPath: /html/body/div[3]/div[3]/div/section[2]/div/table
      const companyTable = document.querySelector('section.result-wrap > div.result-group > table.customer-list');
      if (companyTable) {
        const cells = companyTable.querySelectorAll('td');
        if (cells.length >= 4) {
          data.metadata.companyName = cells[1]?.textContent.trim() || '';
          data.metadata.businessNumber = cells[3]?.textContent.trim() || '';
        }
      }

      // Extract summary (Table 2)
      // XPath: /html/body/div[3]/div[3]/div[2]/section/div[2]/table
      const summaryTable = document.querySelector('section.result-wrap > div.table-area > table.customer-list');
      if (summaryTable) {
        const summaryText = summaryTable.textContent;
        // Parse "0건", "0" format
        const countMatch = summaryText.match(/(\d+)건/);
        const amountMatch = summaryText.match(/총금액.*?(\d+)/);
        if (countMatch) {
          data.summary.totalCount = parseInt(countMatch[1]) || 0;
        }
        if (amountMatch) {
          data.summary.totalAmount = parseInt(amountMatch[1]) || 0;
        }
      }

      // Extract transactions (Table 3: Main transaction table)
      // XPath: /html/body/div[3]/div[3]/div[2]/section/div[3]/div[2]/table
      // Headers: 이용카드, 이용일시, 승인번호, 이용금액, 가맹점명, 매출종류, 할부기간, 접수일, 즉시결제, 취소여부, 결제(예정일), 매출전표
      const transactionTable = document.querySelector('div.table-wrap > div.nh-table-wrapper > table.table');

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

          // Check if it's a "no data" row
          if (cells.length === 1) {
            console.log('[extractNHCard] No transaction data row detected');
            return;
          }

          if (cells.length >= 12) {
            const transaction = {
              cardNumber: cells[0]?.textContent.trim() || '',
              dateTime: cells[1]?.textContent.trim() || '',
              approvalNumber: cells[2]?.textContent.trim() || '',
              amount: cells[3]?.textContent.replace(/[^0-9]/g, '') || '0',
              merchantName: cells[4]?.textContent.trim() || '',
              salesType: cells[5]?.textContent.trim() || '',
              installmentPeriod: cells[6]?.textContent.trim() || '',
              receiptDate: cells[7]?.textContent.trim() || '',
              immediatePayment: cells[8]?.textContent.trim() || '',
              cancellationStatus: cells[9]?.textContent.trim() || '',
              paymentDate: cells[10]?.textContent.trim() || '',
              receipt: cells[11]?.textContent.trim() || '',
            };

            // Only add if there's actual transaction data
            if (transaction.amount !== '0' || transaction.merchantName) {
              data.transactions.push(transaction);
            }
          }
        });
      } else {
        console.log('[extractNHCard] Transaction table not found!');
      }

      return data;
    }, bankName);

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Company: ${extractedData.metadata.companyName} (${extractedData.metadata.businessNumber})`);
    this.log(`Summary: ${extractedData.summary.totalCount} transactions, total amount: ${extractedData.summary.totalAmount}`);

    return extractedData;
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
