# Card Transaction Sync Analysis

**Date:** 2026-01-20
**Purpose:** Analyze data structure differences between bank and card transactions, and design sync strategy

---

## Table of Contents

1. [Current Database Schema (Banks)](#current-database-schema-banks)
2. [Card Transaction Data Structure](#card-transaction-data-structure)
3. [Key Differences](#key-differences)
4. [Data Mapping Strategy](#data-mapping-strategy)
5. [Implementation Options](#implementation-options)
6. [Recommended Approach](#recommended-approach)
7. [Migration Plan](#migration-plan)

---

## Current Database Schema (Banks)

### Transactions Table

**File:** `src/main/sqlite/financehub.ts` (Lines 157-178)

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,          -- References accounts.id
  bank_id TEXT NOT NULL,             -- 'shinhan', 'nh', 'kookmin', etc.
  date TEXT NOT NULL,                -- YYYY-MM-DD format
  time TEXT,                         -- HH:MM:SS format
  type TEXT,                         -- Bank-specific transaction type
  category TEXT,                     -- AI categorization (food, transport, etc.)
  withdrawal INTEGER DEFAULT 0,      -- Amount withdrawn
  deposit INTEGER DEFAULT 0,         -- Amount deposited
  description TEXT,                  -- Transaction description
  memo TEXT,                         -- User notes
  balance INTEGER DEFAULT 0,         -- Balance after transaction
  branch TEXT,                       -- Bank branch
  counterparty TEXT,                 -- Sender/receiver
  transaction_id TEXT,               -- Bank's transaction ID
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,                     -- JSON for extra data

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_id) REFERENCES banks(id)
)
```

### Key Fields for Bank Transactions

| Field | Type | Example | Required |
|-------|------|---------|----------|
| `account_id` | TEXT | UUID | ✅ Yes |
| `bank_id` | TEXT | 'shinhan' | ✅ Yes |
| `date` | TEXT | '2026-01-19' | ✅ Yes |
| `time` | TEXT | '14:46:51' | Optional |
| `withdrawal` | INTEGER | 3500 | ✅ Yes |
| `deposit` | INTEGER | 0 | ✅ Yes |
| `balance` | INTEGER | 125000 | ✅ Yes |
| `description` | TEXT | '컴포즈커피' | Optional |
| `branch` | TEXT | '강남지점' | Optional |

---

## Card Transaction Data Structure

### NH Card Extracted Data

**File:** `src/main/financehub/cards/nh-card/NHCardAutomator.js` (Lines 644-741)

```javascript
{
  metadata: {
    cardNumber: '',
    bankName: 'NH농협카드'
  },
  summary: {
    totalCount: 31,
    normalCount: 30,
    cancelledCount: 1
  },
  transactions: [
    {
      // Column 2: Card number
      cardNumber: '마스터 771',

      // Column 3: Transaction date/time
      dateTime: '2026/01/19 14:46:51',

      // Column 4: Approval number
      approvalNumber: '55192909',

      // Column 5: Transaction amount
      amount: '3500',  // String, not integer

      // Column 6: Merchant name
      merchantName: '컴포즈커피군포첨단산업단지점',

      // Column 7: Transaction method
      transactionMethod: '예금인출',

      // Column 8: Installment period
      installmentPeriod: '',

      // Column 9: Cancellation status
      cancellationStatus: '',

      // Column 10: Detail link
      detailLink: '매출전표영수증',

      // Hidden XML data
      xmlData: '<data><이용카드>...</data>'
    }
  ],
  headers: ['카드 번호', '거래 일자', '승인 번호', '거래 금액', ...]
}
```

### Sample Card Transaction (From Playwright Test)

**From:** `scripts/playwright-test-2026-01-19T09-45-22-783Z.spec.js` (Lines 156-161)

```
Card: 마스터 771
Date: 2026/01/19 14:46:51
Approval: 55192909
Amount: 3,500원
Merchant: 컴포즈커피군포첨단산업단지점
Method: 예금인출 (Debit Withdrawal)
```

**Hidden XML Data:**
```xml
<data>
  <이용카드><![CDATA[M771]]></이용카드>
  <이용일시><![CDATA[2026/01/19 14:46:51]]></이용일시>
  <승인번호><![CDATA[55192909]]></승인번호>
  <공급금액><![CDATA[3182]]></공급금액>
  <부가세><![CDATA[318]]></부가세>
  <봉사료><![CDATA[0]]></봉사료>
  <보증금><![CDATA[0]]></보증금>
  <이용금액><![CDATA[3500]]></이용금액>
  <가맹점명><![CDATA[컴포즈커피군포첨단산업단지점]]></가맹점명>
  <매출종류><![CDATA[예금인출]]></매출종류>
  <할부기간><![CDATA[]]></할부기간>
  <접수월일><![CDATA[]]></접수월일>
  <취소여부><![CDATA[]]></취소여부>
  <결제일><![CDATA[]]></결제일>
</data>
```

---

## Key Differences

### Structure Differences

| Aspect | Bank Transactions | Card Transactions | Issue |
|--------|------------------|-------------------|-------|
| **Account Reference** | `account_id` (UUID) | `cardNumber` (masked) | ⚠️ Different identifier |
| **Date Format** | Separate `date` + `time` | Combined `dateTime` | ⚠️ Needs splitting |
| **Amount Type** | Single `withdrawal` OR `deposit` | Single `amount` (always withdrawal) | ⚠️ Cards are always withdrawals |
| **Balance** | `balance` field | ❌ No balance field | ⚠️ Cards don't track balance |
| **Transaction Type** | `type` (transfer, payment, etc.) | `transactionMethod` (예금인출, etc.) | ⚠️ Different terminology |
| **Description** | `description` | `merchantName` | ✅ Can map directly |
| **Branch** | `branch` | ❌ Not applicable | ⚠️ Cards don't have branches |
| **Unique ID** | `transaction_id` | `approvalNumber` | ✅ Can map |

### Data Type Differences

| Field | Bank | Card | Transformation Needed |
|-------|------|------|----------------------|
| **Date/Time** | `date: '2026-01-19'`<br>`time: '14:46:51'` | `dateTime: '2026/01/19 14:46:51'` | ✅ Split and format |
| **Amount** | `withdrawal: 3500`<br>`deposit: 0` | `amount: '3500'` | ✅ Parse to int, set as withdrawal |
| **Balance** | `balance: 125000` | ❌ N/A | ⚠️ Set to 0 or null |
| **Account ID** | UUID from DB | Card number | ⚠️ Need card-account mapping |

### Card-Specific Fields (Not in Bank Schema)

| Field | Example | Can Store In |
|-------|---------|--------------|
| `approvalNumber` | '55192909' | `transaction_id` ✅ |
| `merchantName` | '컴포즈커피군포첨단산업단지점' | `description` ✅ |
| `transactionMethod` | '예금인출' | `type` ✅ |
| `installmentPeriod` | '3개월' | `metadata` JSON ✅ |
| `cancellationStatus` | '취소' | `metadata` JSON ✅ |
| `cardNumber` | '마스터 771' | `metadata` JSON ✅ |
| `xmlData` | `<data>...</data>` | `metadata` JSON ✅ |

---

## Data Mapping Strategy

### Transformation Function

```javascript
/**
 * Transform card transaction to bank transaction format
 * @param {Object} cardTx - Card transaction from NH Card
 * @param {string} accountId - Account UUID from database
 * @param {string} cardCompanyId - Card company ID ('nh-card')
 * @returns {Object} Transaction in bank format
 */
function transformCardTransaction(cardTx, accountId, cardCompanyId) {
  // Split dateTime: "2026/01/19 14:46:51" → date + time
  const [datePart, timePart] = cardTx.dateTime.split(' ');
  const date = datePart.replace(/\//g, '-'); // 2026/01/19 → 2026-01-19
  const time = timePart || null; // 14:46:51

  // Parse amount (string to integer)
  const amount = parseInt(cardTx.amount) || 0;

  // Card transactions are always withdrawals (spending)
  const withdrawal = amount;
  const deposit = 0;

  // Use merchant name as description
  const description = cardTx.merchantName || '';

  // Store card-specific fields in metadata
  const metadata = {
    cardNumber: cardTx.cardNumber,
    approvalNumber: cardTx.approvalNumber,
    transactionMethod: cardTx.transactionMethod,
    installmentPeriod: cardTx.installmentPeriod,
    cancellationStatus: cardTx.cancellationStatus,
    detailLink: cardTx.detailLink,
    xmlData: cardTx.xmlData,
    // Parsed XML fields (if we parse it)
    supplyAmount: null,  // 공급금액
    vat: null,           // 부가세
    serviceCharge: null, // 봉사료
    deposit: null,       // 보증금
  };

  return {
    accountId: accountId,              // UUID from cards table
    bankId: cardCompanyId,            // 'nh-card'
    date: date,                       // '2026-01-19'
    time: time,                       // '14:46:51'
    type: cardTx.transactionMethod,   // '예금인출'
    category: null,                   // AI categorization (future)
    withdrawal: withdrawal,           // 3500
    deposit: deposit,                 // 0 (cards don't have deposits)
    description: description,         // '컴포즈커피군포첨단산업단지점'
    memo: null,                       // User notes (empty initially)
    balance: 0,                       // Cards don't track balance
    branch: null,                     // Cards don't have branches
    counterparty: description,        // Use merchant name
    transactionId: cardTx.approvalNumber, // '55192909'
    metadata: JSON.stringify(metadata)
  };
}
```

### Example Transformation

**Input (Card Transaction):**
```javascript
{
  cardNumber: '마스터 771',
  dateTime: '2026/01/19 14:46:51',
  approvalNumber: '55192909',
  amount: '3500',
  merchantName: '컴포즈커피군포첨단산업단지점',
  transactionMethod: '예금인출',
  installmentPeriod: '',
  cancellationStatus: '',
  detailLink: '매출전표영수증',
  xmlData: '<data>...</data>'
}
```

**Output (Bank Transaction Format):**
```javascript
{
  accountId: 'uuid-card-account-123',
  bankId: 'nh-card',
  date: '2026-01-19',
  time: '14:46:51',
  type: '예금인출',
  category: null,
  withdrawal: 3500,
  deposit: 0,
  description: '컴포즈커피군포첨단산업단지점',
  memo: null,
  balance: 0,
  branch: null,
  counterparty: '컴포즈커피군포첨단산업단지점',
  transactionId: '55192909',
  metadata: '{"cardNumber":"마스터 771","approvalNumber":"55192909",...}'
}
```

---

## Implementation Options

### Option 1: Reuse Existing Transactions Table ⭐ (Recommended)

**Approach:** Store card transactions in the same `transactions` table as bank transactions

**Pros:**
- ✅ Single unified view of all transactions
- ✅ No schema changes needed
- ✅ Existing UI already shows transactions
- ✅ AI categorization works on all data
- ✅ Search/filter works across banks and cards

**Cons:**
- ⚠️ Card-specific fields stored in metadata JSON
- ⚠️ Balance always 0 for card transactions
- ⚠️ Need card "accounts" (virtual accounts per card)

**Required:**
- Create "card accounts" in `accounts` table
- Transform card data to match bank transaction format
- Update `importTransactions()` to handle cards

### Option 2: Separate Card Transactions Table

**Approach:** Create new `card_transactions` table with card-specific schema

**Pros:**
- ✅ Card-specific fields are native columns
- ✅ No forced mapping to bank structure
- ✅ Cleaner separation of concerns

**Cons:**
- ❌ Need new table schema
- ❌ Duplicate a lot of transaction logic
- ❌ UI needs to query two tables
- ❌ AI categorization needs to work on both tables
- ❌ Search/filter more complex
- ❌ More maintenance overhead

**Schema:**
```sql
CREATE TABLE card_transactions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,             -- References cards.id
  card_company_id TEXT NOT NULL,     -- 'nh-card', 'shinhan-card', etc.
  date_time TEXT NOT NULL,           -- Combined: '2026/01/19 14:46:51'
  approval_number TEXT,              -- '55192909'
  amount INTEGER NOT NULL,           -- Always positive (spending)
  merchant_name TEXT,                -- '컴포즈커피군포첨단산업단지점'
  transaction_method TEXT,           -- '예금인출'
  installment_period TEXT,           -- '3개월', ''
  cancellation_status TEXT,          -- '취소', ''
  card_number TEXT,                  -- '마스터 771'
  xml_data TEXT,                     -- Full XML for reference
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### Option 3: Hybrid - Cards as Special Banks

**Approach:** Treat card companies as special "banks" in the system

**Pros:**
- ✅ Minimal code changes
- ✅ Reuse all existing logic
- ✅ Unified transaction view

**Cons:**
- ⚠️ Conceptually weird (cards aren't banks)
- ⚠️ UI might confuse users
- ⚠️ Some bank-specific features don't apply

---

## Recommended Approach

### ⭐ Option 1: Reuse Transactions Table

**Why:**
- Simplest implementation
- Leverages existing infrastructure
- Provides unified financial view
- No schema changes required

**Implementation Steps:**

1. Create virtual "card accounts" in `accounts` table
2. Transform card data when syncing
3. Store card-specific fields in `metadata` JSON
4. Update UI to distinguish bank vs card transactions

---

## Migration Plan

### Step 1: Create Card Account Support

**Modify:** `accounts` table to support cards

**Current Schema:**
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  customer_name TEXT,
  balance INTEGER DEFAULT 0,
  ...
)
```

**New Support:**
- `bank_id` can now be a card company ID like `'nh-card'`
- `account_number` will be the card number (masked)
- `account_name` will be the card name

**Example Card "Account":**
```sql
INSERT INTO accounts (
  id, bank_id, account_number, account_name, customer_name, balance
) VALUES (
  'card-uuid-123',
  'nh-card',                              -- Card company ID
  '5461-11**-****-9550',                  -- Masked card number
  '국민내일배움카드(체크)',                -- Card name
  '차민수',                                -- User name
  0                                       -- Cards don't track balance
);
```

### Step 2: Create Transformation Function

**File:** `src/main/financehub/utils/cardTransactionMapper.js` (NEW)

```javascript
/**
 * Parse card dateTime to separate date and time
 * @param {string} dateTime - '2026/01/19 14:46:51'
 * @returns {{date: string, time: string}}
 */
function parseCardDateTime(dateTime) {
  const [datePart, timePart] = dateTime.split(' ');
  const date = datePart.replace(/\//g, '-'); // 2026/01/19 → 2026-01-19
  const time = timePart || null;
  return { date, time };
}

/**
 * Transform card transaction to bank transaction format
 */
function transformCardTransaction(cardTx, cardAccountId, cardCompanyId) {
  const { date, time } = parseCardDateTime(cardTx.dateTime);
  const amount = parseInt(cardTx.amount) || 0;

  // Handle cancellations/refunds
  const isCancelled = cardTx.cancellationStatus === '취소' ||
                     cardTx.cancellationStatus.includes('취소') ||
                     cardTx.cancellationStatus.length > 0; // Any value means cancelled

  // Cancelled transactions are refunds (deposits), normal transactions are withdrawals
  const withdrawal = isCancelled ? 0 : amount;
  const deposit = isCancelled ? amount : 0;

  return {
    date: date,
    time: time,
    type: cardTx.transactionMethod,
    withdrawal: withdrawal,       // 0 if cancelled
    deposit: deposit,             // amount if cancelled (refund)
    description: cardTx.merchantName,
    balance: 0,                   // Cards don't track running balance
    branch: null,                 // N/A for cards
    counterparty: cardTx.merchantName,
    transactionId: cardTx.approvalNumber,
    metadata: {
      cardNumber: cardTx.cardNumber,
      approvalNumber: cardTx.approvalNumber,
      transactionMethod: cardTx.transactionMethod,
      installmentPeriod: cardTx.installmentPeriod,
      cancellationStatus: cardTx.cancellationStatus,
      isCancelled: isCancelled,  // Flag for easy filtering
      detailLink: cardTx.detailLink,
      xmlData: cardTx.xmlData,
      // Mark as card transaction for UI filtering
      isCardTransaction: true,
      cardCompanyId: cardCompanyId
    }
  };
}

module.exports = {
  parseCardDateTime,
  transformCardTransaction,
};
```

### Step 3: Update Import Logic

**Modify:** `src/main/sqlite/financehub.ts` - `importTransactions()` method

**Current:**
```javascript
importTransactions(bankId, accountData, transactionsData, syncMetadata)
```

**Updated:**
```javascript
importTransactions(bankId, accountData, transactionsData, syncMetadata, isCard = false)
```

**New Logic:**
```javascript
async importTransactions(bankId, accountData, transactionsData, syncMetadata, isCard = false) {
  // 1. Upsert account (works for both banks and cards)
  const accountId = await this.upsertAccount({
    bankId: bankId,  // Could be 'nh' or 'nh-card'
    accountNumber: accountData.accountNumber,  // Account number or card number
    accountName: accountData.accountName,      // Account name or card name
    customerName: accountData.customerName,
    balance: accountData.balance || 0,
    // Card accounts will have balance = 0
  });

  // 2. Transform transactions if this is a card
  let transformedTransactions = transactionsData;
  if (isCard) {
    const { transformCardTransaction } = require('../financehub/utils/cardTransactionMapper');
    transformedTransactions = transactionsData.map(tx =>
      transformCardTransaction(tx, accountId, bankId)
    );
  }

  // 3. Insert transactions (same logic for both)
  for (const tx of transformedTransactions) {
    // ... existing insert logic ...
  }
}
```

### Step 4: Update Frontend Sync Handler

**Modify:** `src/renderer/components/FinanceHub/FinanceHub.tsx`

**Current (Lines 417-447):**
```typescript
const handleSyncCardTransactions = async (cardCompanyId, cardNumber, period) => {
  const result = await window.electron.financeHub.card.getTransactions(...);

  // TODO: Save to database
  alert(`✅ 거래내역 조회 완료!`);
}
```

**Updated:**
```typescript
const handleSyncCardTransactions = async (cardCompanyId, cardNumber, period) => {
  setIsSyncingCard(cardNumber);
  try {
    const { startDate, endDate } = getDateRange(period);

    // Fetch card transactions
    const result = await window.electron.financeHub.card.getTransactions(
      cardCompanyId,
      cardNumber,
      startDate,
      endDate
    );

    if (!result.success) throw new Error(result.error);

    // Prepare account data (card as "account")
    const cardConnection = connectedCards.find(c => c.cardCompanyId === cardCompanyId);
    const cardInfo = cardConnection?.cards?.find(c => c.cardNumber === cardNumber);

    const accountData = {
      accountNumber: cardNumber,
      accountName: cardInfo?.cardName || '카드',
      customerName: cardConnection?.alias || '',
      balance: 0,  // Cards don't track balance
    };

    // Transform transactions
    const transactionsData = (result.extractedData?.transactions || []).map(tx => ({
      dateTime: tx.dateTime,
      amount: tx.amount,
      merchantName: tx.merchantName,
      approvalNumber: tx.approvalNumber,
      transactionMethod: tx.transactionMethod,
      installmentPeriod: tx.installmentPeriod,
      cancellationStatus: tx.cancellationStatus,
      cardNumber: tx.cardNumber,
      xmlData: tx.xmlData,
    }));

    const syncMetadata = {
      queryPeriodStart: startDate,
      queryPeriodEnd: endDate,
      excelFilePath: result.extractedData?.filename || '',
    };

    // Import to database (with isCard flag)
    const importResult = await window.electron.financeHubDb.importTransactions(
      cardCompanyId,
      accountData,
      transactionsData,
      syncMetadata,
      true  // ← isCard flag
    );

    if (importResult.success) {
      const { inserted, skipped } = importResult.data;
      await Promise.all([
        loadDatabaseStats(),
        loadRecentSyncOperations(),
        refreshAll()
      ]);

      alert(`✅ 카드 거래내역 동기화 완료!\n\n• 새로 추가: ${inserted}건\n• 중복 건너뜀: ${skipped}건`);
    }
  } catch (error) {
    alert(`카드 거래내역 동기화 실패: ${error?.message}`);
  } finally {
    setIsSyncingCard(null);
  }
}
```

### Step 5: Update Backend IPC Handler

**Modify:** `src/main/main.ts` - Add new IPC handler

```typescript
ipcMain.handle('sqlite-financehub-import-card-transactions', async (_event, {
  cardCompanyId,
  accountData,
  transactionsData,
  syncMetadata
}) => {
  try {
    const db = getSQLiteDatabase('financehub');
    if (!db) throw new Error('Database not initialized');

    // Call importTransactions with isCard = true
    const result = await db.importTransactions(
      cardCompanyId,
      accountData,
      transactionsData,
      syncMetadata,
      true  // isCard flag
    );

    return result;
  } catch (error) {
    console.error('[FINANCEHUB-DB] Import card transactions failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});
```

---

## Challenges & Solutions

### Challenge 1: Card Numbers as Account IDs

**Problem:** Cards use masked numbers like `"5461-11**-****-9550"`, not UUIDs

**Solution:** Create account entries for each card in `accounts` table
- Use UUID as primary key
- Store masked card number in `account_number` field
- Link transactions via UUID

### Challenge 2: No Balance Tracking

**Problem:** Cards don't have running balance like bank accounts

**Solution:** Set `balance = 0` for all card transactions
- Doesn't affect deposit/withdrawal tracking
- UI can hide balance column for card transactions
- Or show "N/A" for cards

### Challenge 3: All Transactions are Withdrawals (Except Cancellations)

**Problem:** Card transactions are always spending, never deposits (except refunds/cancellations)

**Card Transaction Types:**
1. **Normal transactions** - `cancellationStatus = ''` → withdrawal
2. **Cancelled transactions** - `cancellationStatus = '취소'` → deposit (refund)
3. **Refunds** - Same as cancellations

**Solution:**

**Option A: Cancelled = Deposit (Recommended)**
```javascript
const isCancelled = cardTx.cancellationStatus === '취소' ||
                   cardTx.cancellationStatus.includes('취소');

if (isCancelled) {
  withdrawal = 0;
  deposit = amount;  // Refund shown as deposit
} else {
  withdrawal = amount;
  deposit = 0;
}
```

**Option B: Cancelled = Negative Withdrawal**
```javascript
const isCancelled = cardTx.cancellationStatus === '취소';
const amount = parseInt(cardTx.amount) || 0;

withdrawal = isCancelled ? -amount : amount;  // Negative for cancellations
deposit = 0;
```

**Option C: Mark and Exclude**
```javascript
// Skip cancelled transactions entirely
if (cardTx.cancellationStatus === '취소') {
  return null;  // Don't import
}
```

**Recommended: Option A** - Treat cancellations as deposits (refunds) so they show correctly in UI and statistics

### Challenge 4: DateTime Parsing

**Problem:** Cards use `"2026/01/19 14:46:51"` format, DB needs separate fields

**Solution:** Split on space:
```javascript
const [date, time] = dateTime.split(' ');
const formattedDate = date.replace(/\//g, '-');
```

### Challenge 5: Card-Specific Metadata

**Problem:** Cards have unique fields (approval number, installments, XML data)

**Solution:** Store in `metadata` JSON column:
```json
{
  "cardNumber": "마스터 771",
  "approvalNumber": "55192909",
  "installmentPeriod": "3개월",
  "cancellationStatus": "",
  "xmlData": "<data>...</data>",
  "isCardTransaction": true
}
```

### Challenge 6: Cancellation Status Handling

**Problem:** Card transactions have `취소 여부` (cancellation status) field - how to represent in DB?

**From Playwright Test (Line 145):**
```
Summary: 31건 total, 30건 normal, 1건 cancelled
```

**Cancellation Types:**
- Empty string `''` = Normal transaction
- `'취소'` = Cancelled/refunded transaction
- Other values = Various cancellation states

**How Cancelled Transactions Work:**
1. **Original purchase:** 3,500원 at "컴포즈커피" → Shown in history
2. **User cancels** → Same transaction row updated with `취소 여부: '취소'`
3. **Amount is refunded** → Money comes back to customer

**Recommended Handling:**

**In Database:**
```javascript
if (cancellationStatus === '취소' || cancellationStatus.length > 0) {
  // Treat as deposit (refund)
  withdrawal = 0;
  deposit = amount;
  type = '취소 - ' + transactionMethod;  // "취소 - 예금인출"
} else {
  // Normal spending
  withdrawal = amount;
  deposit = 0;
  type = transactionMethod;
}
```

**In UI:**
- Cancelled transactions show as green (deposit/refund)
- Normal transactions show as red (withdrawal/spending)
- Description prefixed with "취소 -" for cancelled ones

**In Statistics:**
- Summary shows: 총 31건 (정상 30건, 취소 1건)
- Total spending = withdrawals - deposits (cancellations)
- Net spending accounts for refunds automatically

**Example:**
```javascript
// Normal transaction
{
  date: '2026-01-19',
  withdrawal: 3500,
  deposit: 0,
  description: '컴포즈커피',
  type: '예금인출',
  metadata: { cancellationStatus: '' }
}

// Cancelled transaction (refund)
{
  date: '2026-01-19',
  withdrawal: 0,
  deposit: 3500,  // ← Refund shown as deposit!
  description: '컴포즈커피',
  type: '취소 - 예금인출',
  metadata: { cancellationStatus: '취소', isCancelled: true }
}
```

### Challenge 7: Duplicate Detection

**Problem:** How to identify duplicate card transactions?

**Solution:** Use unique composite key:
- `account_id` (card account UUID)
- `date` (2026-01-19)
- `time` (14:46:51)
- `transactionId` (approval number: 55192909)
- `amount` (3500)

Existing unique index already handles this:
```sql
CREATE UNIQUE INDEX idx_transactions_unique
  ON transactions(account_id, date, time, withdrawal, deposit, balance);
```

---

## UI Display Strategy

### Unified Transaction View

**In "전체 거래내역" page:**

| Date | Time | Type | Account | Description | Withdrawal | Deposit | Balance |
|------|------|------|---------|-------------|-----------|---------|---------|
| 2026-01-19 | 14:46:51 | 💳 카드 | 마스터 771 | 컴포즈커피군포첨단산업단지점 | 3,500원 | - | - |
| 2026-01-19 | 12:30:00 | 🏦 은행 | 302-1429-5472-31 | 급여입금 | - | 2,000,000원 | 2,125,000원 |
| 2026-01-18 | 09:15:22 | 💳 카드 | 라이언 771 | 스타벅스 | 5,200원 | - | - |

**Visual Indicators:**
- 💳 Icon for card transactions
- 🏦 Icon for bank transactions
- Balance column shows "-" for cards
- Type column shows transaction method

### Filter Options

Add filter for transaction source:
```typescript
filters: {
  source: 'all' | 'banks' | 'cards',  // ← New filter
  bankId: string,
  accountId: string,
  ...
}
```

---

## Code Files to Create/Modify

### New Files

1. ✅ **`src/main/financehub/utils/cardTransactionMapper.js`**
   - `transformCardTransaction()`
   - `parseCardDateTime()`
   - `parseCardXMLData()` (optional)

### Modified Files

2. ✅ **`src/main/sqlite/financehub.ts`**
   - Update `importTransactions()` to accept `isCard` flag
   - Add card transaction transformation logic

3. ✅ **`src/main/main.ts`**
   - Add IPC handler for card transaction import

4. ✅ **`src/main/preload.ts`**
   - Expose card transaction import to renderer

5. ✅ **`src/renderer/components/FinanceHub/FinanceHub.tsx`**
   - Update `handleSyncCardTransactions()` to save to DB
   - Already done - just needs backend wiring

6. ✅ **`src/renderer/components/FinanceHub/TransactionsPage.tsx`**
   - Add visual indicators for card vs bank transactions
   - Add source filter (banks/cards/all)

---

## Sample Sync Flow

### Complete Flow: Card Connection → Transaction Sync

```
1. User connects NH Card
   ↓
2. NHCardAutomator.login() executes
   ↓
3. NHCardAutomator.getCards() extracts card list
   ↓
4. UI shows cards: [5461-11**-****-9550, 6243-62**-****-2820, ...]
   ↓
5. User clicks sync button on a card
   ↓
6. Selects period (1개월, 3개월, etc.)
   ↓
7. Frontend: handleSyncCardTransactions() called
   ↓
8. Backend: NHCardAutomator.getTransactions(cardNumber, startDate, endDate)
   ↓
9. Automator: selectCard() → setDateRange() → search() → loadAll()
   ↓
10. Automator: extractNHCardTransactions() returns:
    {
      metadata: { cardNumber, bankName },
      summary: { totalCount, normalCount, cancelledCount },
      transactions: [{ cardNumber, dateTime, amount, merchantName, ... }]
    }
   ↓
11. Frontend: Receives extraction result
   ↓
12. Frontend: Transforms to account data:
    {
      accountNumber: '5461-11**-****-9550',
      accountName: '국민내일배움카드',
      customerName: '차민수',
      balance: 0
    }
   ↓
13. Frontend: Calls importTransactions(cardCompanyId, accountData, txData, metadata, true)
   ↓
14. Backend DB: Creates/updates card account
   ↓
15. Backend DB: Transforms card transactions to bank format
   ↓
16. Backend DB: Inserts transactions with duplicate checking
   ↓
17. Frontend: Shows success: "✅ 새로 추가: 25건, 중복 건너뜀: 6건"
   ↓
18. UI refreshes: Transactions appear in "전체 거래내역"
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ NH Card Website (card.nonghyup.com)                         │
│                                                              │
│ <select id="CrdNbr">                                        │
│   <option>5461-11**-****-9550 국민내일배움카드</option>      │
│   <option>6243-62**-****-2820 라이언 치즈 체크카드</option>  │
│ </select>                                                    │
│                                                              │
│ <table id="listTable">                                      │
│   <tr>                                                       │
│     <td>마스터 771</td>                                       │
│     <td>2026/01/19 14:46:51</td>                            │
│     <td>55192909</td>                                        │
│     <td>3,500원</td>                                         │
│     <td>컴포즈커피군포첨단산업단지점</td>                      │
│   </tr>                                                      │
│ </table>                                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    NHCardAutomator
                    extractNHCardTransactions()
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Extracted Card Data                                         │
│                                                              │
│ {                                                            │
│   transactions: [{                                           │
│     cardNumber: '마스터 771',                                │
│     dateTime: '2026/01/19 14:46:51',                        │
│     amount: '3500',                                          │
│     merchantName: '컴포즈커피군포첨단산업단지점',             │
│     approvalNumber: '55192909',                              │
│     ...                                                      │
│   }]                                                         │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    transformCardTransaction()
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Bank Transaction Format                                     │
│                                                              │
│ {                                                            │
│   date: '2026-01-19',                                        │
│   time: '14:46:51',                                          │
│   withdrawal: 3500,                                          │
│   deposit: 0,                                                │
│   description: '컴포즈커피군포첨단산업단지점',                │
│   transactionId: '55192909',                                 │
│   balance: 0,                                                │
│   metadata: '{"cardNumber":"마스터 771",...}'                │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    SQLite Database
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ accounts table:                                              │
│   id: 'uuid-card-123'                                        │
│   bank_id: 'nh-card'                                         │
│   account_number: '5461-11**-****-9550'                      │
│   account_name: '국민내일배움카드'                            │
│   balance: 0                                                 │
│                                                              │
│ transactions table:                                          │
│   id: 'tx-uuid-456'                                          │
│   account_id: 'uuid-card-123'                                │
│   bank_id: 'nh-card'                                         │
│   date: '2026-01-19'                                         │
│   time: '14:46:51'                                           │
│   withdrawal: 3500                                           │
│   deposit: 0                                                 │
│   description: '컴포즈커피군포첨단산업단지점'                 │
│   transaction_id: '55192909'                                 │
│   metadata: '{"cardNumber":"마스터 771",...}'                │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

```javascript
describe('cardTransactionMapper', () => {
  it('should parse card dateTime correctly', () => {
    const result = parseCardDateTime('2026/01/19 14:46:51');
    expect(result.date).toBe('2026-01-19');
    expect(result.time).toBe('14:46:51');
  });

  it('should transform card transaction to bank format', () => {
    const cardTx = {
      dateTime: '2026/01/19 14:46:51',
      amount: '3500',
      merchantName: '컴포즈커피',
      approvalNumber: '55192909',
      // ...
    };

    const result = transformCardTransaction(cardTx, 'account-uuid', 'nh-card');

    expect(result.date).toBe('2026-01-19');
    expect(result.withdrawal).toBe(3500);
    expect(result.deposit).toBe(0);
    expect(result.description).toBe('컴포즈커피');
  });
});
```

### Integration Tests

1. Connect NH Card
2. Sync transactions for 1 month
3. Verify transactions appear in database
4. Verify duplicate detection works
5. Verify card transactions show in "전체 거래내역"

---

## Summary

### Data Structure Comparison

**Banks:** `deposit/withdrawal` split, `balance` tracking, `branch`, separate `date`/`time`
**Cards:** Single `amount` (withdrawal), no balance, `merchantName`, combined `dateTime`

### Recommended Solution

✅ **Reuse existing transactions table**
✅ **Store cards as special "accounts"**
✅ **Transform card data on import**
✅ **Store card-specific fields in metadata JSON**

### Benefits

- Unified transaction view (banks + cards together)
- No schema changes required
- Leverages existing infrastructure
- Simple to implement

### Next Steps

1. Create `cardTransactionMapper.js` utility
2. Update `importTransactions()` to handle cards
3. Update frontend sync handler to save to DB
4. Add visual indicators in transaction list
5. Test end-to-end sync flow

---

## Conclusion

Card transactions can be seamlessly integrated into the existing database structure by treating cards as special "accounts" and transforming the card-specific data format into the bank transaction format. The main differences (combined dateTime, no balance, always withdrawal) are easily handled through transformation, and card-specific metadata can be preserved in the JSON metadata column.

**Estimated Effort:** 2-3 hours to implement full card transaction syncing with database integration.
