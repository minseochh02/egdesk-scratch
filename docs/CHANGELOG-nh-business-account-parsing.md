# NH Business Bank - Account Parsing Implementation

## Date: 2026-01-16

## Summary
Implemented multi-tab account extraction for NH Business Bank (법인) that automatically clicks through all account category tabs and parses account information from each.

## Challenge

NH Business Bank organizes accounts into separate tabs:
- 출금계좌 (Withdrawal accounts)
- 예금/신탁계좌 (Deposit/Trust accounts)
- 펀드계좌 (Fund accounts)
- 외화예금계좌 (Foreign currency accounts)

Each tab contains a table (`#tb0101`) with accounts of that category. The table uses `rowspan=2` structure where each account spans 2 rows.

## Implementation

### Method: `getAccounts()`

Located in `src/main/financehub/banks/nh-business/NHBusinessBankAutomator.js`

**Workflow:**
```javascript
1. Define tabs to check (4 tabs)
2. For each tab:
   a. Click tab link (e.g., a[href="#cont1_1"])
   b. Wait for content to load (1000ms)
   c. Execute page.evaluate() to extract accounts
   d. Parse table rows in pairs (rowspan=2)
   e. Extract: number, type, balance, alias, last date
   f. Add to allAccounts array
3. Return standardized account format
```

### Tab Configuration

Added to `config.js`:
```javascript
xpaths: {
  // Account tabs
  withdrawalAccountsTab: 'a[href="#cont1_1"]',
  depositAccountsTab: 'a[href="#cont1_2"]',
  fundAccountsTab: 'a[href="#cont1_3"]',
  foreignCurrencyTab: 'a[href="#cont1_5"]',
  accountTable: '#tb0101',
}
```

### Extraction Logic

**Table Parsing:**
```javascript
const rows = table.querySelectorAll('tbody tr');

// Process rows in pairs (each account = 2 rows)
for (let i = 0; i < rows.length; i += 2) {
  const row1 = rows[i];      // Main account data
  const row2 = rows[i + 1];  // Last transaction date

  const cells = row1.querySelectorAll('td');

  // cells[0]: Row number (skip)
  // cells[1]: 예금종류 (Account type)
  // cells[2]: 계좌번호 (Account number)
  // cells[3]: 별명 (Alias)
  // cells[4]: 현재잔액 (Balance) - contains hidden input + balance div
  // cells[5]: 거래 구분 (Transaction actions - skip)
  // cells[6]: (in row2) 최종거래일 (Last transaction date)

  const accountType = cells[1]?.textContent.trim();
  const accountNumber = cells[2]?.textContent.trim();
  const alias = cells[3]?.textContent.trim();

  // Balance from div.text-price
  const balanceDiv = cells[4]?.querySelector('.text-price');
  const balanceText = balanceDiv?.textContent.trim(); // "7,153,138 원"
  const balance = parseInt(balanceText.replace(/[^0-9]/g, '')); // 7153138

  // Raw account number from hidden input
  const hiddenInput = cells[4]?.querySelector('input[type="hidden"][id^="now_acno"]');
  const rawAccountNumber = hiddenInput?.value; // "3010281754941"

  // Last transaction date from row2
  const lastDateSpan = row2?.querySelector('span[id^="last_date"]');
  const lastDate = lastDateSpan?.textContent.trim(); // "2026/01/16"
}
```

### Output Format

**Standardized Account Object:**
```javascript
{
  accountNumber: "301-0281-7549-41",     // User-friendly format
  accountName: "보통예금",                // Account type as name
  bankId: "nh-business",                 // Always nh-business
  balance: 7153138,                      // Integer (won)
  currency: "KRW",                       // Always KRW
  lastUpdated: "2026/01/16",             // Last transaction date
  metadata: {                            // Additional info
    accountType: "보통예금",
    alias: "",                           // User nickname (can be empty)
    tabCategory: "출금계좌",              // Which tab it came from
    rawAccountNumber: "3010281754941"   // No dashes (for API calls)
  }
}
```

## Tab Iteration Details

### Tab 1: 출금계좌 (Already active on page load)
- Click: `a[href="#cont1_1"]`
- Typical accounts: 보통예금, 당좌예금
- Most commonly used for transactions

### Tab 2: 예금/신탁계좌
- Click: `a[href="#cont1_2"]`
- Uses `data-tap="navigate('ICAIP0301R', {menu_id: 'ICZZ10010102'})"`
- Typical accounts: 정기예금, 적금, 신탁상품

### Tab 3: 펀드계좌
- Click: `a[href="#cont1_3"]`
- Uses `data-tap="navigate('ICAIP0104R')"`
- Typical accounts: 펀드상품

### Tab 4: 외화예금계좌
- Click: `a[href="#cont1_5"]`
- Uses `data-tap="navigate('ICAIP0107R', {menu_id: 'ICZZ10010108'})"`
- Typical accounts: USD, EUR, JPY 예금

## Robustness Features

### 1. Tab Click Error Handling
```javascript
try {
  const tabLink = this.page.locator(tab.selector);
  if (await tabLink.isVisible({ timeout: 3000 })) {
    await tabLink.click();
    await this.page.waitForTimeout(1000);
  } else {
    this.log(`Tab ${tab.name} not visible, skipping...`);
    continue;
  }
} catch (e) {
  this.log(`Failed to click tab ${tab.name}, skipping:`, e.message);
  continue; // Skip to next tab
}
```

### 2. Empty Tab Handling
If a tab has no accounts, the table might be empty or not exist:
```javascript
const table = document.querySelector('#tb0101');
if (!table) {
  console.log(`No table found in ${tabName} tab`);
  return accounts; // Return empty array
}
```

### 3. Malformed Row Handling
If a row is missing cells or has unexpected structure:
```javascript
if (cells.length < 5) continue; // Skip malformed rows

try {
  // Extract account data
} catch (err) {
  console.error('Error parsing account row:', err);
  // Continue to next row
}
```

## Testing

### Test with Multiple Account Types

**Expected output:**
```bash
[NH-BUSINESS] Parsing accounts from all tabs...
[NH-BUSINESS] Checking tab: 출금계좌...
[NH-BUSINESS] Found 2 accounts in 출금계좌 tab
[NH-BUSINESS] Checking tab: 예금/신탁계좌...
[NH-BUSINESS] Found 1 accounts in 예금/신탁계좌 tab
[NH-BUSINESS] Checking tab: 펀드계좌...
[NH-BUSINESS] Found 0 accounts in 펀드계좌 tab
[NH-BUSINESS] Checking tab: 외화예금계좌...
[NH-BUSINESS] Found 0 accounts in 외화예금계좌 tab
[NH-BUSINESS] Total accounts found: 3
```

### Verify in UI

After successful connection, the Finance Hub dashboard should show:
```
┌─────────────────────────────────────────┐
│ 🌾 NH농협은행                            │
│ 🏢 법인                                  │
│ 연결됨                                   │
│                                          │
│ ├─ 301-0281-7549-41 (보통예금)           │
│ │  ₩7,153,138                            │
│ │                                        │
│ ├─ 302-1234-5678-90 (정기예금)           │
│ │  ₩50,000,000                           │
│ │                                        │
│ └─ 351-9876-5432-10 (외화예금)           │
│    ₩12,500,000                           │
└─────────────────────────────────────────┘
```

## Files Modified

1. ✅ `src/main/financehub/banks/nh-business/NHBusinessBankAutomator.js`
   - Implemented `getAccounts()` method
   - Added multi-tab iteration logic
   - Added table parsing with rowspan=2 handling

2. ✅ `src/main/financehub/banks/nh-business/config.js`
   - Added account tab selectors
   - Added account table selector

3. ✅ `src/main/financehub/banks/nh-business/README.md`
   - Documented account parsing implementation
   - Added examples and error handling details

4. ✅ `CHANGELOG-nh-business-account-parsing.md` - This file

## Integration with Finance Hub

The parsed accounts will automatically be:
1. **Displayed** in the Finance Hub dashboard under "NH농협은행 법인"
2. **Saved** to the database via `financeHubDb.upsertAccount()`
3. **Available** for transaction sync operations

### Account Card Display

Each account will show:
- **Account number** (formatted with dashes)
- **Account type** as the account name
- **Balance** in KRW
- **Sync button** to fetch transactions
- **Tab category** in metadata (for internal tracking)

## Edge Cases Handled

✅ **Empty tabs** - Skipped gracefully, no errors
✅ **Missing alias** - Uses empty string
✅ **Malformed balance** - Defaults to 0
✅ **Tab click failure** - Logs error, continues to next tab
✅ **Missing table** - Returns empty array for that tab
✅ **Row parsing error** - Skips row, continues parsing

## Next Steps

1. ✅ Account parsing - DONE
2. ⏳ Transaction extraction - Parse transaction table after query
3. ⏳ Excel/CSV export - Export transaction data
4. ⏳ Certificate selection - Allow user to choose certificate
5. ⏳ Session management - Keep-alive functionality

## Performance

**Account parsing timing:**
- Tab 1 (출금계좌): ~1 second
- Tab 2 (예금/신탁): ~1 second
- Tab 3 (펀드): ~1 second
- Tab 4 (외화예금): ~1 second
- **Total: ~4 seconds** for all tabs

The parsing happens once per connection and is cached for the session.
