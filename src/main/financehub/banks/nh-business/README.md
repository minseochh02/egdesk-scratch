# NH Business Bank Automator (NH농협은행 법인)

Certificate-based automation for NH Agricultural Bank Corporate Internet Banking.

## Overview

This automator handles the complete login and navigation workflow for NH Business Bank (법인 인터넷뱅킹), including:
- ✅ Certificate selection
- ✅ Virtual keyboard password entry (basic implementation)
- ✅ Post-login navigation
- ✅ Date range selection
- ✅ Transaction query with pagination

## Files

```
nh-business/
├── config.js                         # Bank configuration & selectors
├── NHBusinessBankAutomator.js        # Main automator class
├── index.js                          # Module exports
├── test.js                           # Test script
└── README.md                         # This file
```

## Workflow (from spec file)

Based on `output/nh-business-account.spec.js`, the automation follows this flow:

### 1. Initial Navigation
```javascript
await page.goto('https://ibz.nonghyup.com/servlet/ICCNP1000S.view');
await page.waitForTimeout(3000);
```

### 2. Handle Confirmation Popup
```javascript
await page.locator('a:has-text("확인")').click();
```

### 3. Certificate Authentication
```javascript
// Open certificate list
await page.locator('.txt > span:nth-child(2)').click();

// Select certificate
await page.locator('[id="id=cn%3DCrossCertCA4%2Cou%3DAccreditedCA%2Co%3DCrossCert%2Cc%3DKR&sn=01AF1D0A"]').click();

// Open virtual keyboard
await page.locator('[id="ini_cert_pwd"]').click();
await page.locator('[id="ini_cert_pwd_tk_btn_initech"]').click();

// Enter password (11 clicks on virtual keyboard)
for (let i = 0; i < 11; i++) {
  await page.locator('[id="ini_cert_pwd_imgTwin"]').click();
}

// Submit certificate
await page.locator('[id="INI_certSubmit"]').click();
```

### 4. Post-Login Navigation
```javascript
// Close modal
await page.locator('.ic-size > svg:nth-child(1)').click();

// Navigate to transaction history
await page.locator('a:has-text("입출금거래내역조회(당일)")').click();
```

### 5. Date Selection (30 days ago to today)
```javascript
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() - 30);
const year = targetDate.getFullYear().toString();
const month = (targetDate.getMonth() + 1).toString();
const day = targetDate.getDate().toString();

await page.selectOption('[id="start_year"]', year);
await page.selectOption('[id="start_month"]', month);
await page.selectOption('[id="start_date"]', day);

// Same for end date (today)
```

### 6. Query & Pagination
```javascript
// Execute search
await page.locator('button:has-text("조회")').click();

// Load additional pages (up to 5 times)
for (let i = 0; i < 5; i++) {
  await page.locator('button:has-text("다음내역")').click();
}
```

## Usage

```javascript
const { createNHBusinessAutomator } = require('./banks/nh-business');

const automator = createNHBusinessAutomator({
  headless: false,
});

const result = await automator.login({
  certificatePassword: 'your-cert-password',
});
```

## Implementation Status

### ✅ Completed
- [x] Browser setup with persistent context
- [x] Certificate selection workflow
- [x] **Virtual keyboard password entry with Gemini AI** ✨ NEW
  - [x] Screenshot capture of INItech keyboard
  - [x] Gemini Vision analysis for key detection
  - [x] Character-to-coordinate mapping
  - [x] Automated password typing via mouse clicks
- [x] Post-login navigation
- [x] Date range selection (dynamic 30 days)
- [x] Transaction query execution
- [x] Pagination handling (up to 5 pages)
- [x] Human-like delays throughout

### ✅ Recently Completed
- [x] **Account Parsing** - Multi-tab account extraction ✨ NEW
  - [x] Click through all 4 account tabs
  - [x] Parse account table (#tb0101) in each tab
  - [x] Extract account number, type, balance, alias, last transaction date
  - [x] Support for: 출금계좌, 예금/신탁계좌, 펀드계좌, 외화예금계좌

### ❌ Not Yet Implemented
- [ ] **Transaction Data Extraction** - Only navigates, doesn't scrape data
- [ ] **Excel/CSV Export** - No data export functionality
- [ ] **Error Handling** - No try/catch or validation
- [ ] **Certificate Detection** - Hard-coded certificate ID
- [ ] **Session Management** - No keep-alive or extension

## Virtual Keyboard Implementation ✨

### How It Works

The NH Business Bank uses **INItech certificate authentication** with a randomized virtual keyboard. We've implemented AI-based keyboard detection:

**Workflow:**
1. **Open keyboard** → Click `[id="ini_cert_pwd_tk_btn_initech"]`
2. **Capture BASE** → Screenshot base keyboard layout
3. **Analyze BASE** → Gemini detects lowercase, numbers, base punctuation
4. **Find SHIFT** → Detect shift/특수 key in base layout
5. **Click SHIFT** → Activate shifted keyboard
6. **Capture SHIFTED** → Screenshot shifted keyboard layout
7. **Analyze SHIFTED** → Gemini detects uppercase, special characters
8. **Return to BASE** → Click shift again
9. **Build bilingual map** → Combine both layouts with shift flags
10. **Type password** → Auto-toggle shift as needed for each character

**Output Files:**
- `output/nh-business/nh-business-keyboard-base-TIMESTAMP.png` - Base keyboard screenshot
- `output/nh-business/nh-business-keyboard-shifted-TIMESTAMP.png` - Shifted keyboard screenshot
- `output/nh-business/nh-business-keyboard-layout-TIMESTAMP.json` - Combined bilingual mappings

**Example Bilingual Keyboard JSON:**
```json
{
  "characterMap": {
    "0": { "position": { "x": 123, "y": 456 }, "requiresShift": false },
    "1": { "position": { "x": 234, "y": 456 }, "requiresShift": false },
    "a": { "position": { "x": 345, "y": 567 }, "requiresShift": false },
    "A": { "position": { "x": 345, "y": 567 }, "requiresShift": true },
    "@": { "position": { "x": 456, "y": 678 }, "requiresShift": true },
    "!": { "position": { "x": 567, "y": 678 }, "requiresShift": true }
  },
  "shiftKey": { "position": { "x": 100, "y": 500 } },
  "baseKeys": ["0", "1", "2", "a", "b", "c", ...],
  "shiftedKeys": ["A", "B", "C", "@", "#", "!", ...]
}
```

## Account Parsing Implementation ✨

### Multi-Tab Account Extraction

NH Business Bank organizes accounts into 4 separate tabs. We now parse all tabs automatically:

**Tab Categories:**
1. **출금계좌** (Withdrawal accounts)
2. **예금/신탁계좌** (Deposit/Trust accounts)
3. **펀드계좌** (Fund accounts)
4. **외화예금계좌** (Foreign currency accounts)

### Extraction Workflow

```javascript
async getAccounts() {
  const allAccounts = [];

  // For each tab
  for (const tab of tabs) {
    // 1. Click tab link
    await page.locator('a[href="#cont1_1"]').click();
    await page.waitForTimeout(1000);

    // 2. Parse table #tb0101
    const accounts = await page.evaluate(() => {
      const table = document.querySelector('#tb0101');
      const rows = table.querySelectorAll('tbody tr');

      // Process rows in pairs (rowspan=2)
      for (let i = 0; i < rows.length; i += 2) {
        const row1 = rows[i];
        const row2 = rows[i + 1];

        // Extract from row1: type, number, alias, balance
        // Extract from row2: last transaction date

        accounts.push({
          accountNumber: "301-0281-7549-41",
          accountType: "보통예금",
          balance: 7153138,
          lastDate: "2026/01/16",
          tabCategory: "출금계좌"
        });
      }
    });

    allAccounts.push(...accounts);
  }

  return allAccounts;
}
```

### Extracted Data Fields

For each account:
```javascript
{
  accountNumber: "301-0281-7549-41",        // Formatted with dashes
  accountName: "보통예금",                   // Account type name
  bankId: "nh-business",
  balance: 7153138,                         // Parsed as integer
  currency: "KRW",
  lastUpdated: "2026/01/16",
  metadata: {
    accountType: "보통예금",                 // e.g., 보통예금, 정기예금, etc.
    alias: "",                              // User-defined nickname
    tabCategory: "출금계좌",                 // Which tab it came from
    rawAccountNumber: "3010281754941"       // No dashes (from hidden input)
  }
}
```

### Parsing Logic

**Table Structure:**
```html
<table id="tb0101">
  <tbody>
    <!-- Account 1 (2 rows due to rowspan) -->
    <tr>
      <td rowspan="2">1</td>                           <!-- Row number -->
      <td rowspan="2">보통예금</td>                     <!-- Account type -->
      <td rowspan="2">301-0281-7549-41</td>           <!-- Account number -->
      <td rowspan="2"></td>                           <!-- Alias -->
      <td>
        <input type="hidden" id="now_acno0" value="3010281754941">
        <div id="now_cash0" class="text-price">7,153,138 원</div>  <!-- Balance -->
      </td>
      <td rowspan="2">...</td>
      <td rowspan="2">...</td>
    </tr>
    <tr>
      <td><span id="last_date0">2026/01/16</span></td>  <!-- Last date -->
    </tr>

    <!-- Account 2 starts here -->
    <tr>...</tr>
    <tr>...</tr>
  </tbody>
</table>
```

**Row Processing:**
- Processes 2 rows at a time (i += 2)
- First row: account info, balance
- Second row: last transaction date

### Example Output

After login and calling `getAccounts()`:
```javascript
[
  {
    accountNumber: "301-0281-7549-41",
    accountName: "보통예금",
    bankId: "nh-business",
    balance: 7153138,
    currency: "KRW",
    lastUpdated: "2026/01/16",
    metadata: {
      accountType: "보통예금",
      alias: "",
      tabCategory: "출금계좌",
      rawAccountNumber: "3010281754941"
    }
  },
  {
    accountNumber: "351-1234-5678-90",
    accountName: "정기예금",
    bankId: "nh-business",
    balance: 50000000,
    currency: "KRW",
    lastUpdated: "2026/01/15",
    metadata: {
      accountType: "정기예금",
      alias: "비상금",
      tabCategory: "예금/신탁계좌",
      rawAccountNumber: "3511234567890"
    }
  }
]
```

### Error Handling

**If tab not visible:**
```javascript
this.log(`Tab ${tab.name} not visible, skipping...`);
continue; // Move to next tab
```

**If table not found:**
```javascript
if (!table) {
  console.log(`No table found in ${tabName} tab`);
  return accounts; // Return empty array for this tab
}
```

**If row parsing fails:**
```javascript
try {
  // Extract account data
} catch (err) {
  console.error('Error parsing account row:', err);
  // Skip this row, continue to next
}
```

## Next Steps

### Priority 1: Transaction Extraction
After successful navigation and query:
```javascript
// Extract from transaction table
const transactions = await page.evaluate(() => {
  const rows = document.querySelectorAll('table tbody tr');
  return Array.from(rows).map(row => ({
    date: row.querySelector('td:nth-child(1)').textContent,
    description: row.querySelector('td:nth-child(2)').textContent,
    withdrawal: row.querySelector('td:nth-child(3)').textContent,
    deposit: row.querySelector('td:nth-child(4)').textContent,
    balance: row.querySelector('td:nth-child(5)').textContent,
  }));
});
```

### Priority 2: Account Selection
```javascript
// Get account list from dropdown
const accounts = await page.evaluate(() => {
  const select = document.querySelector('[id="drw_acno"]');
  return Array.from(select.options).map(opt => ({
    value: opt.value,
    text: opt.textContent,
  }));
});

// Select specific account
await page.selectOption('[id="drw_acno"]', accountNumber);
```

## Testing

Run the test script:
```bash
node src/main/financehub/banks/nh-business/test.js
```

## Notes

- Based on recorded workflow from `output/nh-business-account.spec.js`
- Uses INItech certificate authentication system
- Virtual keyboard is randomized for security (needs special handling)
- Business accounts may have different structure than personal accounts
- Certificate password is separate from login password

## Differences from Personal Account

| Feature | Personal (개인) | Business (법인) |
|---------|----------------|----------------|
| URL | banking.nonghyup.com | **ibz.nonghyup.com** |
| Auth | Username + Password | **Certificate + Password** |
| Keyboard | NH Virtual Keyboard | **INItech Virtual Keyboard** |
| ID Input | Manual text entry | **Certificate selection** |

## Related Files

- `output/nh-business-account.spec.js` - Original recorded workflow
- `output/nh/nh-keyboard-*.png` - Keyboard screenshots (different system)
- `src/main/financehub/banks/nh/` - Personal account implementation (reference)
