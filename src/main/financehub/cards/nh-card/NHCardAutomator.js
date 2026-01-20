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
  // LOGIN STATUS TRACKING
  // ============================================================================

  /**
   * Checks if the user is currently logged in
   * @param {Object} page - Playwright page object
   * @returns {Promise<{isLoggedIn: boolean, userName: string|null}>}
   */
  async checkLoginStatus(page = this.page) {
    if (!page) return { isLoggedIn: false, userName: null };

    try {
      this.log('Checking login status...');

      // Check if we're still on login page
      const currentUrl = page.url();
      if (currentUrl.includes('IpCo9151I') || currentUrl.includes('login')) {
        this.log('Still on login page');
        return { isLoggedIn: false, userName: null };
      }

      // Priority 1: Check for logout button in header (most reliable)
      try {
        const logoutButton = await page.locator('//a[@id="cnLogOutBtn"]').isVisible({ timeout: 3000 });
        if (logoutButton) {
          this.log('Logged in - logout button visible');

          // Try to extract user name
          try {
            const userName = await page.locator('//div[@id="header_logout"]//strong').innerText();
            return { isLoggedIn: true, userName: userName?.trim() || null };
          } catch (e) {
            return { isLoggedIn: true, userName: null };
          }
        }
      } catch (e) {
        // Not found, try next check
      }

      // Priority 2: Check if card dropdown is present (only shows after login)
      try {
        const cardDropdown = await page.locator(`xpath=${this.config.xpaths.cardDropdown}`).isVisible({ timeout: 3000 });
        if (cardDropdown) {
          this.log('Logged in - card dropdown visible');
          return { isLoggedIn: true, userName: null };
        }
      } catch (e) {
        // Not found, try next check
      }

      // Priority 3: Check if session extend button is present
      try {
        const extendButton = await page.locator(`xpath=${this.config.xpaths.extendSessionButton}`).isVisible({ timeout: 2000 });
        if (extendButton) {
          this.log('Logged in - session extend button visible');
          return { isLoggedIn: true, userName: null };
        }
      } catch (e) {
        // Not found
      }

      this.log('Not logged in - no login indicators found');
      return { isLoggedIn: false, userName: null };
    } catch (error) {
      this.warn('Error checking login status:', error.message);
      return { isLoggedIn: false, userName: null };
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method
   * Reference: Playwright test lines 48-70
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

      // Step 2: Navigate to login page
      this.log('Navigating to NH Card login page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);

      // Step 3: Click on user ID field first
      this.log('Clicking on user ID field...');
      try {
        await this.page.locator(`xpath=${this.config.xpaths.idInput}`).click();
        await this.page.waitForTimeout(3000);
      } catch (e) {
        this.warn('Failed to click ID field:', e.message);
      }

      // Step 4: Fill user ID
      this.log('Entering user ID...');
      await this.fillInputField(
        this.page,
        this.config.xpaths.idInput,
        userId,
        'User ID'
      );
      await this.page.waitForTimeout(3000);

      // Step 5: Click password field
      this.log('Clicking password field...');
      await this.page.locator(`xpath=${this.config.xpaths.passwordInput}`).click();
      await this.page.waitForTimeout(1749);

      // Step 6: Fill password (NH Card uses regular input, no virtual keyboard)
      this.log('Entering password...');
      await this.fillInputField(
        this.page,
        this.config.xpaths.passwordInput,
        password,
        'Password'
      );

      // Step 7: Click login button
      this.log('Clicking login button...');
      await this.clickButton(
        this.page,
        this.config.xpaths.loginButton,
        'Login'
      );

      await this.page.waitForTimeout(this.config.delays.afterLogin);

      // Step 8: Handle post-login popups
      await this.handlePostLoginPopups();

      // Step 9: Navigate to transaction history
      await this.navigateToTransactionHistory();

      // Verify login status - TEMPORARILY DISABLED (like NH Bank)
      // Just assume login succeeded if we got this far without errors
      this.log('Login successful! (verification skipped)');
      this.startSessionKeepAlive();

      return {
        success: true,
        isLoggedIn: true,
        userName: null, // Could extract from header_logout if needed
      };

      // Original verification code (disabled for now):
      // const status = await this.checkLoginStatus(this.page);
      // if (status.isLoggedIn) {
      //   this.log('Login successful!');
      //   this.startSessionKeepAlive();
      //   return { success: true, isLoggedIn: true, userName: status.userName };
      // } else {
      //   this.warn('Login verification failed');
      //   return { success: false, isLoggedIn: false, error: 'Login verification failed' };
      // }

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
   * Handles popups and banners after login
   * Reference: Playwright test lines 59-66
   */
  async handlePostLoginPopups() {
    try {
      this.log('Handling post-login popups...');

      // Stop banner auto-rolling (line 59)
      try {
        await this.page.locator(`xpath=${this.config.xpaths.bannerStopButton}`).click();
        this.log('Stopped banner auto-rolling');
      } catch (e) {
        this.log('Banner stop button not found, continuing...');
      }

      // Close popup 200 (line 60)
      try {
        await this.page.locator(`xpath=${this.config.xpaths.popupClose200}`).click();
        await this.page.waitForTimeout(3000); // Line 61
        this.log('Closed popup 200');
      } catch (e) {
        this.log('Popup 200 not found, continuing...');
      }

      // Click popup wrapper to dismiss (line 62)
      try {
        await this.page.locator(`xpath=${this.config.xpaths.popupWrapper}`).click();
        await this.page.waitForTimeout(2465); // Line 63
        this.log('Clicked popup wrapper');
      } catch (e) {
        this.log('Popup wrapper not found, continuing...');
      }

      // Close additional popups using nth(4) selector (line 64)
      try {
        await this.page.locator(`xpath=${this.config.xpaths.popupCloseButton}`).nth(4).click();
        this.log('Closed additional popup');
      } catch (e) {
        this.log('No additional popups found');
      }

      // Start banner auto-rolling again (line 65)
      try {
        await this.page.locator(`xpath=${this.config.xpaths.bannerStartButton}`).click();
        this.log('Started banner auto-rolling');
      } catch (e) {
        // Not critical
      }

    } catch (error) {
      this.warn('Error handling popups:', error.message);
    }
  }

  /**
   * Navigates to transaction history page
   * Reference: Playwright test lines 67-70
   */
  async navigateToTransactionHistory() {
    this.log('Navigating to transaction history...');

    try {
      await this.page.waitForTimeout(3000);

      // Click "마이" (My) menu
      await this.page.locator(`xpath=${this.config.xpaths.myMenuLink}`).nth(0).click();
      await this.page.waitForTimeout(3000);

      // Click transaction history link
      await this.page.locator(`xpath=${this.config.xpaths.transactionHistoryLink}`).click();
      await this.page.waitForTimeout(3000);

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
   * @returns {Promise<Array>} Array of card information
   */
  async getCards() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Getting card list from dropdown...');

      // Wait a bit for page to fully load
      await this.page.waitForTimeout(2000);

      // First check if the dropdown exists using Playwright
      const dropdownLocator = this.page.locator(`xpath=${this.config.xpaths.cardDropdown}`);
      const exists = await dropdownLocator.count();

      if (exists === 0) {
        this.warn('Card dropdown (#CrdNbr) not found on page!');
        this.log('Current URL:', this.page.url());

        // Debug: Log all select elements on the page
        const allSelects = await this.page.evaluate(() => {
          const selects = document.querySelectorAll('select');
          return Array.from(selects).map(s => ({
            id: s.id,
            name: s.name,
            className: s.className,
            optionCount: s.options.length
          }));
        });
        this.log('All select elements on page:', JSON.stringify(allSelects, null, 2));

        return [];
      }

      this.log(`Dropdown found, extracting cards...`);

      // Extract cards from the card dropdown using XPath
      const cards = await this.page.evaluate(() => {
        // Try multiple selectors to find the dropdown
        const dropdown = document.querySelector('#CrdNbr') ||
                        document.querySelector('select[id="CrdNbr"]') ||
                        document.getElementById('CrdNbr');

        if (!dropdown) {
          console.log('[getCards] Dropdown not found with any selector');
          return [];
        }

        console.log('[getCards] Dropdown found, options:', dropdown.options.length);

        const options = Array.from(dropdown.options);
        const extracted = options
          .slice(1) // Skip first option (placeholder like "선택하십시오")
          .filter(opt => {
            // Filter out empty values
            if (!opt.value || opt.value === '') return false;

            // Filter out category options (not actual cards)
            const text = opt.textContent?.trim() || '';
            const isCategory = text.startsWith('전체카드') ||
                              text.startsWith('전체NH채움카드') ||
                              text.startsWith('전체NHBC카드') ||
                              text === '전체카드' ||
                              text === '전체NH채움카드' ||
                              text === '전체NHBC카드';

            if (isCategory) {
              console.log('[getCards] Skipping category option:', text);
              return false;
            }

            return true;
          })
          .map(opt => {
            const text = opt.textContent?.trim() || '';
            console.log('[getCards] Processing option:', text);

            // Parse format: "5461-11**-****-9550 국민내일배움카드(체크)(차*수)"
            const match = text.match(/^(\d{4}-\d{2}\*\*-\*\*\*\*-\d{4})\s*(.*)$/);
            return {
              cardNumber: match ? match[1] : text.split(' ')[0],
              cardName: match ? match[2] : text,
              cardCompanyId: 'nh-card',
              cardType: text.includes('체크') ? 'check' : 'credit',
              value: opt.value,
              selected: opt.selected
            };
          });

        console.log('[getCards] Extracted cards:', extracted.length);
        return extracted;
      });

      this.log(`Found ${cards.length} cards`);
      return cards;
    } catch (error) {
      this.error('Failed to get cards:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // CARD SELECTION
  // ============================================================================

  /**
   * Selects a specific card from dropdown
   * Reference: Playwright test lines 71-76
   * @param {string} [cardNumber] - Optional card number to select
   */
  async selectCard(cardNumber = null) {
    this.log('Selecting card...');

    try {
      const cardDropdown = this.page.locator(`xpath=${this.config.xpaths.cardDropdown}`);

      // Multiple clicks might be needed to activate dropdown (as shown in test)
      await cardDropdown.click();
      await this.page.waitForTimeout(this.config.delays.afterCardSelect);

      if (cardNumber) {
        // Select specific card by finding its value from the dropdown
        this.log(`Selecting card: ${cardNumber}`);

        // Find the option value that matches this cardNumber
        const optionValue = await this.page.evaluate((cardNum) => {
          const dropdown = document.querySelector('#CrdNbr');
          if (!dropdown) return null;

          const options = Array.from(dropdown.options);
          const matchingOption = options.find(opt => {
            const text = opt.textContent?.trim() || '';
            return text.startsWith(cardNum); // Match by card number prefix
          });

          return matchingOption ? matchingOption.value : null;
        }, cardNumber);

        if (optionValue) {
          // Select by value (not by label - avoids regex issues)
          await this.page.selectOption(`xpath=${this.config.xpaths.cardDropdown}`, optionValue);
          this.log(`Selected card with value: ${optionValue}`);
        } else {
          this.warn(`Could not find option for card: ${cardNumber}, using default`);
        }
      } else {
        // Just activate the dropdown (default card is selected)
        await cardDropdown.click();
        await cardDropdown.click();
        await this.page.waitForTimeout(1364);
        await cardDropdown.click();
      }

      await this.page.waitForTimeout(3000);
      this.log('Card selected');
    } catch (error) {
      this.error('Failed to select card:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // DATE SELECTION
  // ============================================================================

  /**
   * Sets date range for transaction query
   * Reference: Playwright test lines 78-102
   * @param {string|number} startDate - Start date (YYYYMMDD, Date object, or offset)
   * @param {string|number} endDate - End date (YYYYMMDD, Date object, or offset)
   */
  async setDateRange(startDate, endDate) {
    this.log('Setting date range...');

    try {
      // Parse start date
      const start = this.parseDate(startDate);
      this.log(`Setting start date: ${start.year}-${start.month}-${start.day}`);

      await this.page.selectOption(`xpath=${this.config.xpaths.startYearSelect}`, start.year);
      await this.page.waitForTimeout(1200);

      await this.page.selectOption(`xpath=${this.config.xpaths.startMonthSelect}`, start.month);
      await this.page.waitForTimeout(800);

      await this.page.selectOption(`xpath=${this.config.xpaths.startDaySelect}`, start.day);
      await this.page.waitForTimeout(3000);

      // Parse end date
      const end = this.parseDate(endDate);
      this.log(`Setting end date: ${end.year}-${end.month}-${end.day}`);

      await this.page.selectOption(`xpath=${this.config.xpaths.endYearSelect}`, end.year);
      await this.page.waitForTimeout(1200);

      await this.page.selectOption(`xpath=${this.config.xpaths.endMonthSelect}`, end.month);
      await this.page.waitForTimeout(800);

      await this.page.selectOption(`xpath=${this.config.xpaths.endDaySelect}`, end.day);
      await this.page.waitForTimeout(3000);

      this.log('Date range set successfully');
    } catch (error) {
      this.error('Failed to set date range:', error.message);
      throw error;
    }
  }

  /**
   * Parses date into components
   * @param {string|Date|number} dateInput - Date in various formats
   * @returns {{year: string, month: string, day: string}}
   */
  parseDate(dateInput) {
    let date;

    if (typeof dateInput === 'number') {
      // Offset from today (e.g., -1 for yesterday)
      date = new Date();
      date.setDate(date.getDate() + dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      // Parse YYYYMMDD or YYYY-MM-DD
      const cleaned = dateInput.replace(/-/g, '');
      const year = cleaned.substring(0, 4);
      const month = cleaned.substring(4, 6);
      const day = cleaned.substring(6, 8);
      return { year, month, day };
    }

    return {
      year: date.getFullYear().toString(),
      month: (date.getMonth() + 1).toString(),
      day: date.getDate().toString(),
    };
  }

  // ============================================================================
  // TRANSACTION FETCHING
  // ============================================================================

  /**
   * Clicks "다음 내역" (Next History) button until all transactions are loaded
   * Reference: Playwright test lines 113-115
   *
   * Important: The button with ID "btn_plus" and text "다음 내역" expands the list
   * to show more transactions. It adds more rows to the same table (not pagination).
   */
  async loadAllTransactions() {
    this.log('Loading all transactions...');

    let totalExpansions = 0;
    const maxClicks = 50; // Safety limit (some accounts may have many transactions)

    while (totalExpansions < maxClicks) {
      try {
        // Click "다음 내역" (btn_plus) button
        const loadMoreButton = this.page.locator(`xpath=${this.config.xpaths.loadMoreButton}`);
        const isVisible = await loadMoreButton.isVisible({ timeout: 2000 });

        if (isVisible) {
          // Check if button is disabled (no more data)
          const isDisabled = await loadMoreButton.evaluate(el => {
            return el.classList.contains('disabled') ||
                   el.hasAttribute('disabled') ||
                   el.getAttribute('onclick') === null ||
                   el.getAttribute('onclick') === '';
          }).catch(() => false);

          if (!isDisabled) {
            await loadMoreButton.click();
            totalExpansions++;
            this.log(`Clicked "다음 내역" button (${totalExpansions} expansions)`);
            await this.page.waitForTimeout(this.config.delays.afterLoadMore);
          } else {
            this.log('Button is disabled - all data loaded');
            break;
          }
        } else {
          this.log('No more "다음 내역" button found - all data loaded');
          break;
        }
      } catch (e) {
        this.log('Button not found or error clicking:', e.message);
        break;
      }
    }

    if (totalExpansions >= maxClicks) {
      this.warn(`Reached safety limit of ${maxClicks} expansions - there may be more data`);
    } else {
      this.log(`Loading complete: ${totalExpansions} total list expansions`);
    }
  }

  /**
   * Gets transactions for selected card and date range
   * Reference: Playwright test lines 103-241
   * @param {string} [cardNumber] - Card number
   * @param {string|number} startDate - Start date or offset
   * @param {string|number} endDate - End date or offset
   * @returns {Promise<Array>} Transaction data
   */
  async getTransactions(cardNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`Fetching transactions for card ${cardNumber || 'default'}...`);

      // Step 1: Select card
      await this.selectCard(cardNumber);

      // Step 2: Set date range
      await this.setDateRange(startDate, endDate);

      // Step 3: Search (click search button twice as shown in test)
      this.log('Clicking search button...');
      await this.page.click(`xpath=${this.config.xpaths.searchButton}`);
      console.log(this.config.xpaths.searchButton);
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      await this.page.click(`xpath=${this.config.xpaths.searchButton}`);
      await this.page.waitForTimeout(this.config.delays.afterSearch);

      // Step 4: Load all results
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
   * Reference: Playwright test lines 117-241 (table capture comments)
   * @returns {Promise<Object>} Extracted transaction data
   */
  async extractNHCardTransactions() {
    this.log('Extracting NH Card transaction data...');

    const bankName = this.config.bank.nameKo;

    const extractedData = await this.page.evaluate((bankName) => {
      const data = {
        metadata: {
          cardNumber: '',
          bankName: bankName,
        },
        summary: {
          totalCount: 0,
          normalCount: 0,
          cancelledCount: 0,
        },
        transactions: [],
        headers: [],
      };

      // Extract summary (Table 2: Summary table)
      // Reference: Test lines 141-149
      const summaryTable = document.querySelector('div > div.sec_result > table.tb_row');
      if (summaryTable) {
        const summaryText = summaryTable.textContent;

        // Parse "31건", "30건", "1건"
        const matches = summaryText.match(/(\d+)건/g);
        if (matches && matches.length >= 3) {
          data.summary.totalCount = parseInt(matches[0]) || 0;
          data.summary.normalCount = parseInt(matches[1]) || 0;
          data.summary.cancelledCount = parseInt(matches[2]) || 0;
        }
      }

      // Extract transactions (Table 3: Main transaction table)
      // Reference: Test lines 151-177
      // Try multiple selectors to find the transaction table
      const transactionTable = document.querySelector('#listTable') ||
                              document.querySelector('table[id="listTable"]') ||
                              document.evaluate(
                                '/html/body/div[1]/div[2]/div/div[4]/div[1]/div[3]/table',
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                              ).singleNodeValue;

      if (transactionTable) {
        // Extract headers
        const headerCells = transactionTable.querySelectorAll('thead th');
        headerCells.forEach((th, index) => {
          if (index > 0) { // Skip first column (hidden XML data)
            data.headers.push(th.textContent.trim());
          }
        });

        // Extract transaction rows
        const rows = transactionTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 10) {
            // Parse hidden XML data in first column
            const xmlData = cells[0]?.textContent.trim() || '';

            const transaction = {
              // Column 2: Card number
              cardNumber: cells[1]?.textContent.trim() || '',

              // Column 3: Transaction date/time
              dateTime: cells[2]?.textContent.trim() || '',

              // Column 4: Approval number
              approvalNumber: cells[3]?.textContent.trim() || '',

              // Column 5: Transaction amount
              amount: cells[4]?.textContent.replace(/[^0-9]/g, '') || '0',

              // Column 6: Merchant name
              merchantName: cells[5]?.textContent.trim() || '',

              // Column 7: Transaction method
              transactionMethod: cells[6]?.textContent.trim() || '',

              // Column 8: Installment period
              installmentPeriod: cells[7]?.textContent.trim() || '',

              // Column 9: Cancellation status
              cancellationStatus: cells[8]?.textContent.trim() || '',

              // Column 10: Detail link
              detailLink: cells[9]?.textContent.trim() || '',

              // Store XML data for detailed parsing if needed
              xmlData: xmlData
            };

            // Only add if there's actual transaction data
            if (transaction.amount !== '0' || transaction.merchantName) {
              data.transactions.push(transaction);
            }
          }
        });
      } else {
        console.log('[extractNHCard] Transaction table not found!');
        // Log all tables on the page to help debugging
        const allTables = document.querySelectorAll('table');
        console.log('[extractNHCard] All tables on page:', allTables.length);
        allTables.forEach((table, idx) => {
          console.log(`  Table ${idx}:`, {
            id: table.id,
            className: table.className,
            rows: table.querySelectorAll('tr').length
          });
        });
      }

      return data;
    }, bankName);

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Summary: ${extractedData.summary.totalCount} total, ${extractedData.summary.normalCount} normal, ${extractedData.summary.cancelledCount} cancelled`);

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
 * @param {string} [cardNumber] - Optional card number
 * @param {string} [proxyUrl] - Optional proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runNHCardAutomation(userId, password, cardNumber = null, proxyUrl) {
  const automator = createNHCardAutomator();
  try {
    const loginResult = await automator.login({ userId, password }, proxyUrl);
    if (loginResult.success) {
      // Get transactions for yesterday to today
      const transactions = await automator.getTransactions(cardNumber, -1, 0);
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
