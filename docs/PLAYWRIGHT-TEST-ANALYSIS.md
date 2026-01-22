# Playwright Test Script Analysis

**File:** `scripts/playwright-test-2026-01-19T09-45-22-783Z.spec.js`
**Date:** 2026-01-19
**Analysis Date:** 2026-01-19

## Overview

This is an automated test script for **NH Card (Nonghyup) transaction history** retrieval. The script performs end-to-end automation of:
- Logging into the NH Card website
- Navigating to transaction history
- Setting date ranges
- Searching and capturing transaction data

## Script Flow

1. **Browser Launch**
   - Uses Playwright with persistent Chrome context
   - Creates temporary profile directory
   - Sets up downloads directory at `~/Downloads/EGDesk-Playwright`

2. **Login Process**
   - Navigates to `https://card.nonghyup.com/servlet/IpCo9151I.act`
   - Fills in username and password fields
   - Submits login form

3. **Post-Login Navigation**
   - Handles multiple popups/banners (banner controls, popup close buttons)
   - Navigates to "My" section
   - Accesses transaction history page

4. **Date Selection**
   - Sets start date: Yesterday (today - 1 day)
   - Sets end date: Today
   - Performs search with selected date range

5. **Data Capture**
   - Captures 3 tables with transaction data
   - Main transaction table contains 31 rows

## Key Features

### Browser Configuration
- **Headless mode:** Disabled (visible browser)
- **Viewport:** 907x944 window size at position (605, 0)
- **Permissions:** Clipboard read/write, downloads enabled
- **Security:** Disabled web security for localhost/private network access

### Human-Like Behavior
- Random delays between actions (1.3-3 seconds)
- Natural interaction patterns with clicks and fills
- Mimics real user behavior to avoid detection

### Chrome Security Flags
The script disables multiple security features for automation:
```javascript
'--disable-web-security',
'--disable-features=IsolateOrigins,site-per-process',
'--allow-running-insecure-content',
'--disable-features=PrivateNetworkAccessSendPreflights',
'--disable-features=PrivateNetworkAccessRespectPreflightResults'
```

## Captured Data Structure

### Table 1: Card Selector
- **XPath:** `/html/body/div/div[2]/div/form/table`
- **CSS Selector:** `div > form > table.tb_row`
- **Row Count:** 5 rows
- **Headers:** ["카드번호"]
- **Purpose:** Card selection dropdown with multiple NH cards

### Table 2: Transaction Summary
- **XPath:** `/html/body/div/div[2]/div/div[4]/div/table`
- **CSS Selector:** `div > div.sec_result > table.tb_row`
- **Row Count:** 2 rows
- **Headers:** ["총건수", "정상건수", "취소건수"]
- **Sample Data:** 31건 total, 30건 normal, 1건 cancelled
- **Purpose:** Summary statistics of transactions

### Table 3: Transaction Details (Main Table)
- **XPath:** `//*[@id="listTable"]`
- **CSS Selector:** `[id="listTable"]`
- **Row Count:** 31 rows
- **Headers:**
  - "" (hidden XML data)
  - "카드 번호" (Card Number)
  - "거래 일자" (Transaction Date)
  - "승인 번호" (Approval Number)
  - "거래 금액" (Transaction Amount)
  - "가맹 점명" (Merchant Name)
  - "거래 방법" (Transaction Method)
  - "할부 기간" (Installment Period)
  - "취소 여부" (Cancellation Status)
  - "상세 내역" (Detailed Statement)

**Sample Transaction:**
```
Card: 마스터 771
Date: 2026/01/19 14:46:51
Approval: 55192909
Amount: 3,500원
Merchant: 컴포즈커피군포첨단산업단지점
Method: 예금인출 (Debit Withdrawal)
```

**Hidden XML Data:**
Each row contains embedded XML with detailed information:
- 이용카드 (Card used)
- 이용일시 (Usage datetime)
- 승인번호 (Approval number)
- 공급금액 (Supply amount)
- 부가세 (VAT)
- 봉사료 (Service charge)
- 보증금 (Deposit)
- 이용금액 (Usage amount)
- 가맹점명 (Merchant name)
- 매출종류 (Sales type)
- 할부기간 (Installment period)
- 취소여부 (Cancellation status)
- 결제일 (Payment date)

## Key Selectors Used

| Element | Selector | Purpose |
|---------|----------|---------|
| Username field | `[id="loginUserId"]` | Login form |
| Password field | `[id="loginUserPwd"]` | Login form |
| Login button | `.btn_login > span:nth-child(1)` | Submit login |
| Card number dropdown | `[id="CrdNbr"]` | Select card |
| Start date selectors | `[id="start_year"]`, `[id="start_month"]`, `[id="start_date"]` | Date range start |
| End date selectors | `[id="end_year"]`, `[id="end_month"]`, `[id="end_date"]` | Date range end |
| Search button | `[id="btn_search"]` | Execute search |
| Load more button | `[id="btn_plus"]` | Expand results |
| Transaction table | `[id="listTable"]` | Main data table |

## Automation Sequence

```
1. Launch browser → Create profile
2. Navigate to NH Card login page
3. Wait 3s → Click username field
4. Wait 3s → Fill username
5. Wait 3s → Click password field
6. Wait 1.7s → Fill password
7. Click login button
8. Wait 2.3s → Handle banner controls
9. Close popup(s)
10. Wait 3s → Click through navigation
11. Select card from dropdown (multiple clicks)
12. Wait 3s → Set start date (yesterday)
13. Wait 3s → Set end date (today)
14. Click search button (twice)
15. Click "Load More" button (twice)
16. Capture table data
17. Wait 3s → Close browser
```

## Reference Notes

This script serves as a reference implementation for NH Card transaction automation. It demonstrates:
- Persistent browser context setup
- Multi-step login and navigation flow
- Dynamic date selection logic
- Table data capture with detailed schema documentation
- Human-like interaction timing patterns

---

# Migration Plan: Playwright Test → NH Bank Automator Architecture

## Overview

This plan outlines how to migrate the inline Playwright test script into the established NH Bank automation architecture pattern used by `NHBankAutomator.js`.

## Current Architecture Comparison

### Playwright Test Script (Current)
```
✗ Single inline script file
✗ Hardcoded selectors throughout code
✗ Linear action sequence
✗ No class structure
✗ Manual error handling
✗ Fixed timeouts
✗ Comments as documentation
✗ No data extraction utilities
```

### NH Bank Automator (Target Pattern)
```
✓ Class-based architecture (extends BaseBankAutomator)
✓ Separate config file with organized XPaths
✓ Modular methods (login, getAccounts, getTransactions)
✓ Structured logging with bank prefix
✓ Robust error handling with fallbacks
✓ Configurable timeouts and delays
✓ Data extraction utilities
✓ Excel generation from structured data
✓ Session management (keep-alive)
✓ Virtual/Windows keyboard support
```

## Migration Steps

### Step 1: Create NHCardAutomator Class Structure

**File:** `src/main/financehub/banks/nhcard/NHCardAutomator.js`

```javascript
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NHCARD_CONFIG } = require('./config');

class NHCardAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    const config = {
      ...NHCARD_CONFIG,
      headless: options.headless ?? NHCARD_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? NHCARD_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || path.join(process.cwd(), 'output', 'nhcard');
  }

  // Methods will be implemented in following steps
}
```

**Benefit:** Inherits browser setup, logging, error handling from `BaseBankAutomator`

### Step 2: Extract Selectors to Config File

**File:** `src/main/financehub/banks/nhcard/config.js`

Map all selectors from the Playwright script:

```javascript
const NHCARD_CONFIG = {
  bank: {
    id: 'nhcard',
    name: 'NH Card',
    nameKo: 'NH카드',
    loginUrl: 'https://card.nonghyup.com/servlet/IpCo9151I.act',
    category: 'card',
    color: '#00B140',
    icon: '💳',
    supportsAutomation: true,
  },

  targetUrl: 'https://card.nonghyup.com/servlet/IpCo9151I.act',

  xpaths: {
    // Login elements (from script lines 50-57)
    idInput: '//input[@id="loginUserId"]',
    passwordInput: '//input[@id="loginUserPwd"]',
    loginButton: '//*[contains(@class, "btn_login")]',

    // Banner/popup controls (from script lines 59-64)
    bannerStopButton: '//button[contains(text(), "배너 자동롤링 멈춤")]',
    popupClose200: '//button[@id="btnPopClose_200"]',
    popupCloseButton: '//button[contains(text(), "현재 창 닫기")]',

    // Navigation (from script lines 67-69)
    myMenuLink: '//a[contains(text(), "마이")]',
    transactionHistoryLink: '//a/span',

    // Card selection (from script lines 71-76)
    cardDropdown: '//select[@id="CrdNbr"]',

    // Date selectors (from script lines 78-101)
    startYearSelect: '//select[@id="start_year"]',
    startMonthSelect: '//select[@id="start_month"]',
    startDaySelect: '//select[@id="start_date"]',
    endYearSelect: '//select[@id="end_year"]',
    endMonthSelect: '//select[@id="end_month"]',
    endDaySelect: '//select[@id="end_date"]',

    // Search controls (from script lines 103-115)
    searchButton: '//button[@id="btn_search"]',
    // "다음 내역" (Next History) button - expands list to show more transactions
    loadMoreButton: '//button[@id="btn_plus"]',  // Same as: //button[contains(text(), "다음 내역")]

    // Data tables (from script lines 122-241)
    cardSelectorTable: '/html/body/div/div[2]/div/form/table',
    summaryTable: '/html/body/div/div[2]/div/div[4]/div/table',
    transactionTable: '//*[@id="listTable"]',
  },

  timeouts: {
    pageLoad: 30000,
    click: 10000,
    waitForSelector: 10000,
    elementWait: 10000,
  },

  delays: {
    betweenActions: 1000,
    afterLogin: 2345,
    afterPopup: 3000,
    afterNavigation: 3000,
    afterDateSelect: 1200,
  },
};
```

**Benefit:** Centralized configuration makes maintenance easier, selectors can be updated without touching logic

### Step 3: Implement Login Method

Transform script lines 48-57 into structured method:

```javascript
async login(credentials, proxyUrl) {
  const { userId, password } = credentials;
  const proxy = this.buildProxyOption(proxyUrl);

  try {
    // Step 1: Create browser (inherited from BaseBankAutomator)
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

    // Step 3: Fill login credentials
    this.log('Clicking on user ID field...');
    await this.page.locator(this.config.xpaths.idInput).click();
    await this.page.waitForTimeout(3000);

    this.log('Entering user ID...');
    await this.fillInputField(
      this.page,
      this.config.xpaths.idInput,
      userId,
      'User ID'
    );

    await this.page.waitForTimeout(3000);

    this.log('Entering password...');
    await this.page.locator(this.config.xpaths.passwordInput).click();
    await this.page.waitForTimeout(1749);

    await this.page.fill(this.config.xpaths.passwordInput, password);

    // Step 4: Click login button
    this.log('Clicking login button...');
    await this.clickButton(
      this.page,
      this.config.xpaths.loginButton,
      'Login'
    );

    await this.page.waitForTimeout(this.config.delays.afterLogin);

    // Step 5: Handle post-login popups
    await this.handlePostLoginPopups();

    // Step 6: Navigate to transaction history
    await this.navigateToTransactionHistory();

    return {
      success: true,
      isLoggedIn: true,
    };

  } catch (error) {
    this.error('Login automation failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

**Reference:** Lines 48-57 from Playwright test → Structured login method
**Benefit:** Reusable, testable, with proper error handling

### Step 4: Implement Post-Login Navigation

Transform script lines 59-70 into modular methods:

```javascript
/**
 * Handles popups and banners after login
 * Reference: Playwright test lines 59-66
 */
async handlePostLoginPopups() {
  try {
    this.log('Handling post-login popups...');

    // Stop banner auto-rolling
    try {
      await this.page.locator(this.config.xpaths.bannerStopButton).click();
      this.log('Stopped banner auto-rolling');
    } catch (e) {
      this.log('Banner stop button not found, continuing...');
    }

    // Close popup 200
    try {
      await this.page.locator(this.config.xpaths.popupClose200).click();
      await this.page.waitForTimeout(3000);
      this.log('Closed popup 200');
    } catch (e) {
      this.log('Popup 200 not found, continuing...');
    }

    // Close additional popups
    try {
      const closeButtons = this.page.locator(this.config.xpaths.popupCloseButton);
      const count = await closeButtons.count();
      if (count > 0) {
        await closeButtons.nth(4).click();
        this.log('Closed additional popup');
      }
    } catch (e) {
      this.log('No additional popups found');
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

  // Click "My" menu
  await this.page.locator(this.config.xpaths.myMenuLink).nth(0).click();
  await this.page.waitForTimeout(3000);

  // Click transaction history link
  await this.page.locator(this.config.xpaths.transactionHistoryLink).click();
  await this.page.waitForTimeout(3000);

  this.log('Successfully navigated to transaction history');
}
```

**Reference:** Lines 59-70 from Playwright test → Modular navigation methods
**Benefit:** Separate concerns, easier to debug specific steps

### Step 5: Implement Date Selection

Transform script lines 78-102 into reusable method:

```javascript
/**
 * Sets date range for transaction query
 * Reference: Playwright test lines 78-102
 * @param {string} startDate - Start date (YYYYMMDD or Date object)
 * @param {string} endDate - End date (YYYYMMDD or Date object)
 */
async setDateRange(startDate, endDate) {
  this.log('Setting date range...');

  // Parse start date
  const start = this.parseDate(startDate);
  this.log(`Setting start date: ${start.year}-${start.month}-${start.day}`);

  await this.page.selectOption(this.config.xpaths.startYearSelect, start.year);
  await this.page.waitForTimeout(1200);

  await this.page.selectOption(this.config.xpaths.startMonthSelect, start.month);
  await this.page.waitForTimeout(800);

  await this.page.selectOption(this.config.xpaths.startDaySelect, start.day);
  await this.page.waitForTimeout(3000);

  // Parse end date
  const end = this.parseDate(endDate);
  this.log(`Setting end date: ${end.year}-${end.month}-${end.day}`);

  await this.page.selectOption(this.config.xpaths.endYearSelect, end.year);
  await this.page.waitForTimeout(1200);

  await this.page.selectOption(this.config.xpaths.endMonthSelect, end.month);
  await this.page.waitForTimeout(800);

  await this.page.selectOption(this.config.xpaths.endDaySelect, end.day);
  await this.page.waitForTimeout(3000);

  this.log('Date range set successfully');
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
```

**Reference:** Lines 78-102 from Playwright test → Flexible date range method
**Benefit:** Supports multiple date formats, reusable across different queries

### Step 6: Implement Card Selection

Transform script lines 71-76:

```javascript
/**
 * Selects a specific card from dropdown
 * Reference: Playwright test lines 71-76
 * @param {string} [cardNumber] - Optional card number to select
 */
async selectCard(cardNumber = null) {
  this.log('Selecting card...');

  const cardDropdown = this.page.locator(this.config.xpaths.cardDropdown);

  // Multiple clicks might be needed to activate dropdown
  await cardDropdown.click();
  await this.page.waitForTimeout(2312);

  if (cardNumber) {
    // Select specific card by number
    await this.page.selectOption(this.config.xpaths.cardDropdown, {
      label: new RegExp(cardNumber)
    });
  } else {
    // Just activate the dropdown (first card is default)
    await cardDropdown.click();
    await cardDropdown.click();
    await this.page.waitForTimeout(1364);
    await cardDropdown.click();
  }

  await this.page.waitForTimeout(3000);
  this.log('Card selected');
}
```

**Reference:** Lines 71-76 from Playwright test → Card selection method
**Benefit:** Handles both default and specific card selection

### Step 7: Implement Transaction Fetching

Transform script lines 103-115 and table capture:

```javascript
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

    // Step 3: Search
    this.log('Clicking search button...');
    await this.page.click(this.config.xpaths.searchButton);
    await this.page.waitForTimeout(3000);

    // May need to click search twice (as shown in test)
    await this.page.click(this.config.xpaths.searchButton);
    await this.page.waitForTimeout(3000);

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

/**
 * Clicks "다음 내역" (Next History) button until all transactions are loaded
 * Reference: Playwright test lines 113-115
 *
 * Important: The button with ID "btn_plus" and text "다음 내역" expands the list
 * to show more transactions. It adds more rows to the same table (not pagination).
 * When data exceeds the initial load limit, this button must be clicked repeatedly
 * until all transactions are displayed.
 */
async loadAllTransactions() {
  this.log('Loading all transactions...');

  let totalExpansions = 0;
  const maxClicks = 50; // Safety limit (some accounts may have many transactions)

  while (totalExpansions < maxClicks) {
    try {
      // Click "다음 내역" (btn_plus) button
      const loadMoreButton = this.page.locator(this.config.xpaths.loadMoreButton);
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
          await this.page.waitForTimeout(3000);
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
```

**Reference:** Lines 103-115 from Playwright test → Transaction fetching with pagination
**Benefit:** Handles pagination automatically, extracts complete dataset

### Step 8: Implement Data Extraction

Transform table capture comments (lines 117-241) into extraction logic:

```javascript
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
      const totalMatch = summaryText.match(/(\d+)건/g);
      if (totalMatch && totalMatch.length >= 3) {
        data.summary.totalCount = parseInt(totalMatch[0]) || 0;
        data.summary.normalCount = parseInt(totalMatch[1]) || 0;
        data.summary.cancelledCount = parseInt(totalMatch[2]) || 0;
      }
    }

    // Extract transactions (Table 3: Main transaction table)
    // Reference: Test lines 151-177
    const transactionTable = document.querySelector('#listTable');

    if (transactionTable) {
      // Extract headers
      const headerCells = transactionTable.querySelectorAll('thead th');
      headerCells.forEach((th, index) => {
        if (index > 0) { // Skip first column (hidden data)
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
    }

    return data;
  }, bankName);

  this.log(`Extracted ${extractedData.transactions.length} transactions`);
  this.log(`Summary: ${extractedData.summary.totalCount} total, ${extractedData.summary.normalCount} normal, ${extractedData.summary.cancelledCount} cancelled`);

  return extractedData;
}
```

**Reference:** Lines 117-241 from Playwright test (table structure comments) → Structured data extraction
**Benefit:** Converts HTML tables into structured JSON, ready for Excel generation

### Step 9: Session Management

Inherit from `BaseBankAutomator`:

```javascript
// Session management is inherited from BaseBankAutomator
// No need to implement - automatically available

// Usage after successful login:
this.startSessionKeepAlive(); // Automatically extends session every 5 minutes
```

**Benefit:** Automatic session keep-alive prevents timeouts during long operations

### Step 10: Error Handling & Logging

Leverage inherited utilities:

```javascript
// Logging (inherited)
this.log('Info message');    // [NHCARD] Info message
this.warn('Warning');         // [NHCARD] Warning
this.error('Error occurred'); // [NHCARD] Error occurred

// Error handling with fallbacks (inherited)
await this.clickButton(page, xpath, 'Button Name');
// Automatically tries: normal click → force click → JavaScript click

await this.fillInputField(page, xpath, value, 'Field Name');
// Automatically tries: fill → type → frame search
```

**Benefit:** Consistent error handling and logging across all methods

## Comparison: Before & After

### Before (Playwright Test Script)

```javascript
// Hardcoded action at line 50
await page.locator('[id="loginUserId"]').click();
await page.waitForTimeout(3000);
await page.fill('[id="loginUserId"]', '//blured username');
```

**Issues:**
- ✗ Hardcoded selectors
- ✗ Fixed delays
- ✗ No error handling
- ✗ No logging
- ✗ Not reusable

### After (NH Card Automator)

```javascript
// Structured, configurable, with error handling
this.log('Entering user ID...');
await this.fillInputField(
  this.page,
  this.config.xpaths.idInput,  // From config file
  userId,                       // From parameters
  'User ID'                     // For logging
);
```

**Benefits:**
- ✓ Configurable selectors
- ✓ Inherited error handling with fallbacks
- ✓ Structured logging
- ✓ Reusable method
- ✓ Consistent with other bank automators

## Files to Create

```
src/main/financehub/banks/nhcard/
├── NHCardAutomator.js          # Main automator class
├── config.js                    # Configuration and XPaths
├── virtualKeyboard.js           # Virtual keyboard handler (if needed)
└── README.md                    # Bank-specific documentation
```

## Testing Strategy

1. **Unit test login method** with mock credentials
2. **Test popup handling** with various popup scenarios
3. **Test date range setting** with different date formats
4. **Test transaction extraction** with sample HTML
5. **Integration test** full flow end-to-end
6. **Compare output** with original Playwright test results

## Migration Benefits Summary

| Aspect | Playwright Test | NH Card Automator | Improvement |
|--------|----------------|-------------------|-------------|
| **Structure** | Single file, inline | Class-based, modular | ✓ Maintainable |
| **Selectors** | Hardcoded | Config file | ✓ Centralized |
| **Error Handling** | None | Multiple fallbacks | ✓ Robust |
| **Logging** | Console.log | Structured logging | ✓ Debuggable |
| **Reusability** | Copy-paste | Importable class | ✓ DRY |
| **Testing** | Manual | Unit testable | ✓ Testable |
| **Session Management** | None | Auto keep-alive | ✓ Reliable |
| **Data Output** | Comments | Excel files | ✓ Usable |
| **Code Lines** | ~253 lines | ~800 lines | ✓ Feature-rich |
| **Extensibility** | Difficult | Easy | ✓ Scalable |

## Next Steps

1. Create `nhcard` directory structure
2. Implement `config.js` with all XPaths
3. Create `NHCardAutomator` class skeleton
4. Migrate login method (Step 3)
5. Migrate navigation methods (Step 4)
6. Migrate transaction fetching (Step 7-8)
7. Test each method incrementally
8. Compare with original Playwright test results
9. Add error handling improvements
10. Document bank-specific quirks
