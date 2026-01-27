# KB Card Implementation Guide

## Overview
This document explains how to implement KB Card (KB국민카드) automation for the FinanceHub system using the recorded browser actions from the browser-recorder-test sessions.

## Recorded Actions

Two automated test recordings have been captured:
- `KBCard-getallcards.spec.js` - Login and retrieve all cards
- `KBCard-alltransactions.spec.js` - Login and retrieve transaction history

## Current Status

**Location**: `src/main/financehub/cards/kb-card/`

**Current State**:
- ✅ Config file exists (`config.js`)
- ✅ Base automator class structure exists (`KBCardAutomator.js`)
- ❌ Automation not implemented (all methods throw errors)
- ❌ `supportsAutomation` is set to `false`

## Implementation Plan

### 1. Login Flow

**Recorded Actions** (from both spec files):

```javascript
// Step 1: Navigate to main page
await page.goto('https://biz.kbcard.com/CXORMPIC0001.cms');
await page.waitForTimeout(3000);

// Step 2: Click corporate/business login radio button
await page.locator('[id="loginGubun02"]').click();
await page.waitForTimeout(3000);

// Step 3: Enter user ID
await page.locator('[id="기업인터넷서비스로그인ID"]').click();
await page.fill('[id="기업인터넷서비스로그인ID"]', '');

// Step 4: Enter password
await page.locator('[id="loginPwdBiz"]').click();

// Step 5: Click login button
await page.locator('[id="doBizIdLogin"]').click();
await page.waitForTimeout(3000);
```

**Implementation in KBCardAutomator.js**:

```javascript
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
    await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(3000);

    // Step 3: Select business login type
    this.log('Selecting business login...');
    await this.clickElement(this.config.xpaths.loginTypeRadio);
    await this.page.waitForTimeout(3000);

    // Step 4: Enter user ID
    this.log('Entering user ID...');
    await this.clickElement(this.config.xpaths.idInput);
    await this.page.fill(this.config.xpaths.idInput.css, userId);

    // Step 5: Enter password
    this.log('Entering password...');
    await this.clickElement(this.config.xpaths.passwordInput);
    await this.page.fill(this.config.xpaths.passwordInput.css, password);
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
  }
}
```

### 2. Get All Cards Flow

**Recorded Actions** (from `KBCard-getallcards.spec.js`):

```javascript
// Navigate to card inquiry page
await page.locator('a:has-text("보유카드조회")').click();
await page.waitForTimeout(3000);

// Click search button
await page.locator('button:has-text("조회")').click();

// Check a specific card (if needed)
await page.locator('[id="chkCardList1"]').click();
```

**Data Extraction** (from Table 3 in recording):

The main card table is located at:
- **XPath**: `/html/body/div/div[3]/div/div[2]/div/div/div[3]/table`
- **CSS Selector**: `div.wideTblarea > div.tblArea > table.tblH`

**Headers**:
- 선택 (Select)
- 부서번호 (Department Number)
- 부서명 (Department Name)
- 카드번호 (Card Number)
- 성명 (Name / English Name)
- 닉네임 (Nickname)
- 제휴카드종류 (Card Type)
- 카드별 잔여한도(원) (Remaining Limit)
- 입력일 (Input Date)
- 교부일 (Issue Date)
- 만료일 (Expiry Date)
- 결제기관 (Payment Institution)
- 결제계좌 (Payment Account)
- 결제일 (Payment Day)
- 직전카드번호 (Previous Card Number)

**Implementation**:

```javascript
async getCards() {
  if (!this.page) throw new Error('Browser page not initialized');

  try {
    this.log('Navigating to card inquiry page...');

    // Navigate to card ownership inquiry
    await this.clickElement(this.config.xpaths.cardOwnershipLink);
    await this.page.waitForTimeout(3000);

    // Click search button
    await this.clickElement(this.config.xpaths.cardSearchButton);
    await this.page.waitForTimeout(3000);

    // Extract cards from table
    this.log('Extracting cards from table...');
    const cards = await this.page.evaluate(() => {
      const table = document.querySelector('div.wideTblarea > div.tblArea > table.tblH');
      if (!table) {
        console.log('[getCards] Card table not found');
        return [];
      }

      const rows = table.querySelectorAll('tbody tr');
      const extracted = [];

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 15) {
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
```

### 3. Get Transactions Flow

**Recorded Actions** (from `KBCard-alltransactions.spec.js`):

```javascript
// Navigate to transaction approval inquiry
await page.locator('button:has-text("승인내역조회")').click();
await page.waitForTimeout(3000);

// Set start date
await page.locator('[id="조회시작일"]').click();
await page.fill('[id="조회시작일"]', '20251227');
await page.waitForTimeout(3000);

// Set end date
await page.locator('[id="조회종료일"]').click();
await page.fill('[id="조회종료일"]', '20260127');
await page.waitForTimeout(3000);

// Click search button
await page.locator('button:has-text("조회") >> nth=1').click();
await page.waitForTimeout(3000);

// Pagination - click through pages
await page.locator('a:has-text("2") >> nth=11').click();
await page.locator('a:has-text("3") >> nth=14').click();
await page.locator('a:has-text("4") >> nth=10').click();
```

**Data Extraction** (from Table 5 in recording):

The main transaction table is located at:
- **XPath**: `//*[@id="dtailTable"]`
- **CSS Selector**: `[id="dtailTable"]`

**Headers**:
- 선택/전체선택 (Select/Select All)
- 승인일 (Approval Date)
- 부서번호 (Department Number)
- 카드번호 (Card Number)
- 닉네임 (Nickname)
- 가맹점명 (Merchant Name)
- 결제방법 (Payment Method)
- 승인금액 (Approval Amount)
- 승인구분 (Approval Type)
- 승인번호 (Approval Number)
- 과세유형 (Tax Type)
- 가맹점번호 (Merchant Number)
- 대표자성명 (Representative Name)
- 가맹점주소 (Merchant Address)

**Implementation**:

```javascript
async getTransactions(cardNumber, startDate, endDate) {
  if (!this.page) throw new Error('Browser page not initialized');

  try {
    this.log('Fetching transactions...');

    // Navigate to approval history page
    await this.navigateToTransactionHistory();

    // Set date range
    this.log('Setting date range...');
    await this.clickElement(this.config.xpaths.startDateInput);
    await this.page.fill(this.config.xpaths.startDateInput.css, startDate);
    await this.page.waitForTimeout(3000);

    await this.clickElement(this.config.xpaths.endDateInput);
    await this.page.fill(this.config.xpaths.endDateInput.css, endDate);
    await this.page.waitForTimeout(3000);

    // Click search button
    this.log('Clicking search button...');
    await this.clickElement(this.config.xpaths.transactionSearchButton);
    await this.page.waitForTimeout(3000);

    // Load all pages
    await this.loadAllTransactionPages();

    // Extract data
    const extractedData = await this.extractKBCardTransactions();

    // Create Excel file
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

async navigateToTransactionHistory() {
  this.log('Navigating to transaction history...');
  await this.clickElement(this.config.xpaths.approvalHistoryButton);
  await this.page.waitForTimeout(3000);
}

async loadAllTransactionPages() {
  this.log('Loading all transaction pages...');

  let currentPage = 1;
  const maxPages = 50; // Safety limit

  while (currentPage < maxPages) {
    try {
      // Check if next page exists
      const nextPageSelector = `a:has-text("${currentPage + 1}")`;
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
    this.log(`Loading complete: ${currentPage} total pages`);
  }
}

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
```

### 4. Update Configuration

**Update `config.js`**:

```javascript
const KB_CARD_INFO = {
  id: 'kb-card',
  name: 'KB Card',
  nameKo: 'KB국민카드',
  loginUrl: 'https://biz.kbcard.com/CXORMPIC0001.cms',
  category: 'major',
  color: '#FFBC00',
  icon: '💳',
  supportsAutomation: true, // Changed to true
};

const KB_CARD_XPATHS = {
  // Login elements
  loginTypeRadio: {
    css: '[id="loginGubun02"]',
    xpath: '//*[@id="loginGubun02"]'
  },
  idInput: {
    css: '[id="기업인터넷서비스로그인ID"]',
    xpath: '//*[@id="기업인터넷서비스로그인ID"]'
  },
  passwordInput: {
    css: '[id="loginPwdBiz"]',
    xpath: '//*[@id="loginPwdBiz"]'
  },
  loginButton: {
    css: '[id="doBizIdLogin"]',
    xpath: '//*[@id="doBizIdLogin"]'
  },

  // Card inquiry
  cardOwnershipLink: {
    css: 'a:has-text("보유카드조회")',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[1]/div[2]/div[1]/a[2]'
  },
  cardSearchButton: {
    css: 'button:has-text("조회")',
    xpath: '//*[@id="searchForm"]/div[1]/div[2]/button[1]'
  },

  // Transaction inquiry
  approvalHistoryButton: {
    css: 'button:has-text("승인내역조회")',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/dl[2]/dd[4]/button[1]'
  },
  startDateInput: {
    css: '[id="조회시작일"]',
    xpath: '//*[@id="조회시작일"]'
  },
  endDateInput: {
    css: '[id="조회종료일"]',
    xpath: '//*[@id="조회종료일"]'
  },
  transactionSearchButton: {
    css: 'button:has-text("조회") >> nth=1',
    xpath: '//*[@id="searchForm"]/div[1]/button[1]'
  },

  // Data tables
  cardTable: {
    css: 'div.wideTblarea > div.tblArea > table.tblH',
    xpath: '/html/body/div/div[3]/div/div[2]/div/div/div[3]/table'
  },
  transactionTable: {
    css: '[id="dtailTable"]',
    xpath: '//*[@id="dtailTable"]'
  },

  // Session management
  extendSessionButton: '//a[@id="sessionExtend"] | //a[contains(@href, "extendSession")]',
};

const KB_CARD_CONFIG = {
  card: KB_CARD_INFO,
  targetUrl: 'https://biz.kbcard.com/CXORMPIC0001.cms',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: 'Default',
  xpaths: KB_CARD_XPATHS,
  timeouts: KB_CARD_TIMEOUTS,
  delays: KB_CARD_DELAYS,
  useWindowsKeyboard: false, // KB Card uses regular input fields
  windowsInputMethod: 'fill',
  useEnhancedIdInput: false,
  debug: false,
};
```

### 5. Update FinanceHub UI

**Update `types.ts`**:

Change `supportsAutomation` for KB Card from `false` to `true`.

**Update `FinanceHub.tsx`**:

Add KB Card to the corporate-only card list (similar to BC Card, Shinhan Card, and NH Card):

```javascript
// Around line 776
const accountType = (
  card.id === 'bc-card' ||
  card.id === 'shinhan-card' ||
  card.id === 'nh-card' ||
  card.id === 'kb-card'
) ? 'corporate' : 'personal';
```

Update the account type selectors (around lines 2434 and 2444):

```javascript
// Personal button
disabled={
  isConnectingCard ||
  selectedCard?.id === 'bc-card' ||
  selectedCard?.id === 'shinhan-card' ||
  selectedCard?.id === 'nh-card' ||
  selectedCard?.id === 'kb-card'
}

// Corporate button
disabled={
  isConnectingCard || (
    selectedCard?.id !== 'bc-card' &&
    selectedCard?.id !== 'shinhan-card' &&
    selectedCard?.id !== 'nh-card' &&
    selectedCard?.id !== 'kb-card'
  )
}
```

Update the certificate authentication button (around line 2459):

```javascript
disabled={
  isConnectingCard || (
    selectedCard?.id !== 'bc-card' &&
    selectedCard?.id !== 'shinhan-card' &&
    selectedCard?.id !== 'nh-card' &&
    selectedCard?.id !== 'kb-card'
  )
}
```

## Implementation Checklist

- [ ] Update `config.js` with all XPath selectors
- [ ] Implement `login()` method in `KBCardAutomator.js`
- [ ] Implement `getCards()` method
- [ ] Implement `getTransactions()` method
- [ ] Add helper methods: `navigateToTransactionHistory()`, `loadAllTransactionPages()`, `extractKBCardTransactions()`
- [ ] Add `clickElement()` helper method (with CSS/XPath fallback)
- [ ] Update `KB_CARD_INFO.supportsAutomation` to `true`
- [ ] Update `types.ts` to mark KB Card as supporting automation
- [ ] Update `FinanceHub.tsx` to add KB Card to corporate-only list
- [ ] Test login flow
- [ ] Test card retrieval
- [ ] Test transaction retrieval with date ranges
- [ ] Test pagination for large transaction sets
- [ ] Add error handling for edge cases

## Key Features

1. **Corporate-Only Account**: KB Card business login is for corporate accounts only
2. **Regular Input Fields**: No virtual keyboard - uses standard input fields
3. **Date Range Support**: Transactions can be filtered by start/end dates (format: YYYYMMDD)
4. **Pagination**: Transaction results are paginated and need to be loaded page by page
5. **Rich Card Data**: Includes department info, payment accounts, remaining limits
6. **Detailed Transaction Data**: Includes merchant details, tax type, approval info

## Testing

After implementation, test with:

```javascript
// Test login
const result = await window.electron.financeHub.card.loginAndGetCards('kb-card', {
  userId: 'YOUR_USER_ID',
  password: 'YOUR_PASSWORD',
  accountType: 'corporate'
});

// Test transactions
const transactions = await window.electron.financeHub.card.getTransactions('kb-card', {
  cardNumber: 'CARD_NUMBER',
  startDate: '20251227',
  endDate: '20260127'
});
```

## References

- Recorded Actions: `output/browser-recorder-tests/KBCard-*.spec.js`
- NH Card Implementation: `src/main/financehub/cards/nh-card/NHCardAutomator.js`
- Base Automator: `src/main/financehub/core/BaseBankAutomator.js`
