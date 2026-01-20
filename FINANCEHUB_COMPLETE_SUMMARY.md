# Finance Hub - Complete System Summary

## Overview

Finance Hub is a comprehensive **Korean Bank & Card Automation Framework** that provides automated login, transaction history retrieval, and data synchronization for multiple Korean financial institutions. The system uses Playwright for browser automation, Gemini Vision AI for virtual keyboard handling, and SQLite for data persistence.

## System Architecture

### Location
`src/main/financehub/`

### Key Components

```
financehub/
├── index.js                    # Main entry point & bank registry
├── README.md                   # Framework documentation
├── bank-automator.js           # Standalone bank automation runner
├── core/                       # Base classes
│   ├── BaseBankAutomator.js    # Abstract base for all bank automators
│   └── BaseCardAutomator.js    # Abstract base for all card automators
├── banks/                      # Bank implementations
│   ├── shinhan/                # Shinhan Bank (신한은행)
│   ├── kookmin/                # KB Kookmin Bank (KB국민은행)
│   ├── nh/                     # NH Bank Personal (NH농협은행)
│   └── nh-business/            # NH Bank Business (NH농협은행 법인)
├── cards/                      # Card company implementations
│   ├── shinhan-card/           # 신한카드
│   ├── samsung-card/           # 삼성카드
│   ├── hyundai-card/           # 현대카드
│   ├── kb-card/                # KB국민카드
│   ├── lotte-card/             # 롯데카드
│   └── hana-card/              # 하나카드
├── utils/                      # Shared utilities
│   ├── ai-keyboard-analyzer.js # Gemini Vision keyboard detection
│   ├── bilingual-keyboard-parser.js # Korean/English key mapping
│   ├── keyboard-visualization.js # Debug visualization generator
│   ├── api-keys.js             # API key management
│   └── transactionParser.js    # Transaction parsing utilities
├── scheduler/                  # Scheduled task management
│   ├── FinanceHubScheduler.ts  # Job scheduler
│   └── scheduler-ipc-handler.ts # IPC communication
└── types/                      # TypeScript type definitions
    └── index.ts                # All type definitions
```

---

## 1. Core Architecture

### BaseBankAutomator (395 lines)

**Purpose**: Abstract base class providing common functionality for all bank automators.

**Key Features**:
- Browser setup and configuration (Chromium/Chrome)
- Proxy support with authentication
- Persistent context management
- Route interception for unwanted redirects
- Logging with bank-specific prefixes
- Input field handling with frame fallbacks
- Button clicking with multiple fallback strategies

**Critical Methods**:

| Method | Description |
|--------|-------------|
| `createBrowser(proxy)` | Launches Chrome with persistent context and security flags |
| `setupBrowserContext(context, page)` | Configures routing and navigation interception |
| `fillInputField(page, xpath, value, fieldName)` | Fills input with fallback to frames |
| `clickButton(page, xpath, buttonName)` | Clicks with force/JS fallbacks |
| `getElementBox(pageOrFrame, selector)` | Gets element bounding box for screenshots |
| `handleSecurityPopup(page)` | **Abstract** - Override in subclasses |
| `handleVirtualKeyboard(page, password)` | **Abstract** - Override in subclasses |
| `login(credentials, proxyUrl)` | **Abstract** - MUST implement in subclasses |

**Browser Configuration**:
```javascript
{
  headless: false,
  channel: 'chrome',
  locale: 'ko-KR',
  viewport: { width: 1280, height: 1024 },
  permissions: ['clipboard-read', 'clipboard-write'],
  args: [
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    // Disable private network access preflight checks
  ]
}
```

### BaseCardAutomator (172 lines)

**Purpose**: Extends `BaseBankAutomator` with card-specific functionality.

**Additional Features**:
- Card number formatting/masking (`1234-****-****-5678`)
- Card type detection (credit/debit/check)
- Card list retrieval
- Transaction history by date range

**Abstract Methods**:
- `getCards()` - Must return array of card objects
- `getTransactions(cardNumber, startDate, endDate)` - Must return transaction data
- `loginAndGetCards(credentials, proxyUrl)` - Combined login + card retrieval

---

## 2. Supported Banks

### Bank Registry (from index.js)

| Bank ID | Name (Korean) | Status | Features |
|---------|---------------|--------|----------|
| `shinhan` | 신한은행 (Shinhan) | ✅ **Implemented** | Virtual keyboard, AI analysis, transaction history |
| `kookmin` | KB국민은행 (KB Kookmin) | ✅ **Implemented** | Virtual keyboard support |
| `nh` | NH농협은행 (NH Personal) | ✅ **Implemented** | Virtual keyboard, transaction history |
| `nh-business` | NH농협은행 법인 (NH Business) | ✅ **Implemented** | Certificate-based auth, INItech keyboard |

### Shinhan Bank Implementation

**File**: `banks/shinhan/ShinhanBankAutomator.js`

**Key Features**:
1. **AI-Powered Virtual Keyboard**:
   - Captures LOWER and UPPER keyboard states
   - Uses Gemini Vision to detect all keys
   - Builds bilingual character map (Korean/English)
   - Handles shift key for uppercase/symbols
   - Precise mouse clicking at key centers

2. **Dual Keyboard Analysis**:
   - Takes screenshots of both keyboard states
   - Analyzes with Gemini Vision API
   - Finds shift key automatically
   - Builds combined keyboard JSON

3. **Security Popup Handling**:
   - Detects security program installation prompts
   - Handles ID login warning alerts
   - Auto-dismisses interruptions

4. **Transaction History**:
   - Excel file download support
   - Date range queries
   - Multi-account support
   - Transaction parsing utilities

**Workflow**:
```
1. Navigate to login page
2. Fill user ID (with enhanced ID input handling)
3. Analyze virtual keyboard (LOWER)
4. Click SHIFT, capture UPPER keyboard
5. Build bilingual character map
6. Type password using AI-detected keys
7. Handle security popups
8. Verify login success
9. Extract transaction history (optional)
```

### NH Business Bank Implementation

**File**: `banks/nh-business/NHBusinessBankAutomator.js`

**Key Features**:
1. **Certificate-Based Authentication**:
   - Uses Windows certificate store
   - Handles INItech security module
   - Certificate password entry via virtual keyboard

2. **INItech Virtual Keyboard**:
   - Analyzes base and shifted layouts
   - Handles special characters
   - Similar to NH personal account keyboard

3. **Business Account Features**:
   - Corporate login flow
   - Multi-account transaction retrieval
   - Excel export with account details
   - Balance parsing and validation

**Workflow**:
```
1. Navigate to business banking portal
2. Wait for certificate selection dialog
3. Select certificate (automated)
4. Analyze INItech virtual keyboard
5. Enter certificate password via virtual clicks
6. Handle post-login navigation
7. Extract business account data
```

---

## 3. Virtual Keyboard System

### AI Keyboard Analyzer (`utils/ai-keyboard-analyzer.js`)

**Purpose**: Uses Gemini Vision AI to detect and map virtual keyboard keys.

**Process**:
1. **Screenshot Capture**: Takes image of virtual keyboard
2. **Gemini Analysis**: Sends to Gemini 3 Pro Preview with segmentation prompt
3. **Key Detection**: Receives JSON with all key positions and labels
4. **Coordinate Mapping**: Converts normalized coords (0-1000) to absolute pixels
5. **Character Mapping**: Builds lookup table for typing

**Gemini Prompt Structure**:
```
Analyze this virtual keyboard image. Detect ALL keys visible.

For each key return:
1. Key label/character (including Korean like ㅏ, ㅓ, ㄱ, ㄴ)
2. Bounding box as [ymin, xmin, ymax, xmax] normalized 0-1000

Return JSON:
{
  "keys": [
    { "label": "a / ㅏ", "box_2d": [100, 50, 150, 100] },
    { "label": "shift", "box_2d": [200, 50, 250, 150] }
  ]
}
```

**Response Processing**:
- Converts box_2d to absolute coordinates
- Calculates center point for clicking
- Stores both normalized and absolute bounds
- Builds character → position lookup map

### Bilingual Keyboard Parser (`utils/bilingual-keyboard-parser.js`)

**Purpose**: Parses dual-character keys (Korean/English) and builds typing maps.

**Key Functions**:

| Function | Description |
|----------|-------------|
| `parseBilingualKey(label)` | Extracts English/Korean chars from "a / ㅏ" |
| `buildBilingualKeyboardJSON(base, shifted)` | Combines LOWER and UPPER keyboards |
| `exportKeyboardJSON(keys, path, shifted)` | Saves keyboard layout as JSON |

**Character Map Structure**:
```javascript
{
  "a": {
    character: "a",
    keyId: "key_0",
    label: "a / ㅏ",
    position: { x: 245, y: 387 },
    requiresShift: false,
    type: "english"
  },
  "A": {
    character: "A",
    keyId: "key_0",
    label: "A / ㅏ",
    position: { x: 245, y: 387 },
    requiresShift: true,
    type: "english"
  },
  "ㅏ": {
    character: "ㅏ",
    keyId: "key_0",
    label: "a / ㅏ",
    position: { x: 245, y: 387 },
    requiresShift: false,
    type: "korean"
  }
}
```

### Keyboard Visualization (`utils/keyboard-visualization.js`)

**Purpose**: Generates interactive HTML visualization for debugging.

**Output**: `keyboard-visualization-{timestamp}.html`
- Shows keyboard layout with bounding boxes
- Color-coded by key type (English/Korean/Special/Shift)
- Displays character mappings
- Includes metadata (total keys, languages, etc.)

---

## 4. Card Company Support

### Supported Card Companies

All 6 major Korean card companies have **placeholder implementations**:

| Card ID | Name | Korean | Status |
|---------|------|--------|--------|
| `shinhan-card` | Shinhan Card | 신한카드 | 🚧 Not Implemented |
| `samsung-card` | Samsung Card | 삼성카드 | 🚧 Not Implemented |
| `hyundai-card` | Hyundai Card | 현대카드 | 🚧 Not Implemented |
| `kb-card` | KB Card | KB국민카드 | 🚧 Not Implemented |
| `lotte-card` | Lotte Card | 롯데카드 | 🚧 Not Implemented |
| `hana-card` | Hana Card | 하나카드 | 🚧 Not Implemented |

### Card Automator Structure

Each card company follows this pattern:

```javascript
class [Card]Automator extends BaseCardAutomator {
  async login(credentials, proxyUrl) {
    // Login implementation
  }

  async getCards() {
    // Return array of card objects
  }

  async getTransactions(cardNumber, startDate, endDate) {
    // Return transaction data
  }
}
```

**Card Registry** (`cards/index.js`):
```javascript
const CARDS = {
  'shinhan-card': {
    config: shinhanCard.SHINHAN_CARD_INFO,
    Automator: shinhanCard.ShinhanCardAutomator,
    create: (options) => new ShinhanCardAutomator(options),
    run: async (credentials, proxyUrl) => { /* ... */ }
  },
  // ... other cards
};
```

---

## 5. Type System

### Location
`types/index.ts` (380 lines)

### Key Type Categories

#### 1. Bank Configuration Types
- `BankConfig`: Bank metadata (id, name, loginUrl, color, icon)
- `BankCredentials`: userId + password
- `BankXPaths`: XPath selectors for all page elements
- `BankTimeouts`: Timing configurations
- `BankDelays`: Delay configurations
- `BankAutomationConfig`: Complete bank configuration

#### 2. Keyboard Types
- `KeyPosition`: { x, y } coordinates
- `KeyBounds`: { x, y, width, height } bounding box
- `KeyboardKey`: Complete key data with position, bounds, label
- `CharacterMap`: Character → key mapping for typing
- `ShiftKeyInfo`: Shift key metadata
- `KeyboardJSON`: Full keyboard layout with metadata

#### 3. AI Analysis Types
- `SegmentationMask`: AI detection results
- `KeyboardAnalysisResult`: Complete keyboard analysis
- `ShiftedKeyboardResult`: Shifted keyboard data

#### 4. Typing Result Types
- `FailedChar`: Failed character with reason
- `TypedCharDetail`: Detailed typing log per character
- `TypingResult`: Complete typing summary

#### 5. Automation Result Types
- `AutomationResult`: Login result with status, user info, errors
- `TransactionHistoryResult`: Transaction query results
- `AllTransactionHistoryResult`: Multi-account query results

#### 6. Browser Types
- `BrowserSetupResult`: Browser and context objects
- `ProxyConfig`: Proxy server configuration

---

## 6. Utilities

### API Keys Manager (`utils/api-keys.js`)

**Purpose**: Centralized API key retrieval from environment variables or Electron Store.

**Key Function**:
```javascript
getGeminiApiKey() {
  // 1. Try environment variable: process.env.GEMINI_API_KEY
  // 2. Try Electron Store: ai-keys array
  // 3. Prefer 'egdesk' named key
  // 4. Fall back to any active Google key
  // 5. Return null if not found
}
```

### Transaction Parser (`utils/transactionParser.js`)

**Purpose**: Parses transaction data from Excel files and web pages.

**Key Functions**:
- `parseTransactionExcel(filePath)` - Parses downloaded Excel files
- `extractTransactionsFromPage(page)` - Scrapes transactions from web page
- `createExcelFromData(data, outputPath)` - Creates standardized Excel export

**Transaction Data Structure**:
```javascript
{
  date: "2024-01-15",
  time: "14:30:00",
  description: "카드사용",
  withdrawal: 50000,
  deposit: 0,
  balance: 1500000,
  branch: "온라인",
  memo: "스타벅스 명동점"
}
```

---

## 7. Scheduler System

### FinanceHubScheduler (`scheduler/FinanceHubScheduler.ts`)

**Purpose**: Manages scheduled automation tasks for banks and cards.

**Features**:
- Cron-based job scheduling
- IPC communication with main process
- Job status tracking
- Error handling and retry logic

### Scheduler IPC Handler (`scheduler/scheduler-ipc-handler.ts`)

**Purpose**: Electron IPC handlers for scheduler control.

**Channels**:
- `financehub:schedule:create` - Create new scheduled job
- `financehub:schedule:list` - List all jobs
- `financehub:schedule:delete` - Delete job
- `financehub:schedule:run` - Run job immediately

---

## 8. Usage Patterns

### Basic Bank Automation

```javascript
const { createAutomator } = require('./financehub');

// Create automator instance
const automator = createAutomator('shinhan', {
  headless: false,
  outputDir: './output/shinhan'
});

// Login
const result = await automator.login({
  userId: 'your-user-id',
  password: 'your-password'
});

console.log('Login result:', result);
// { success: true, isLoggedIn: true, userName: "홍길동" }

// Cleanup
await automator.cleanup();
```

### Using Bank Registry

```javascript
const { BANKS } = require('./financehub');

// Direct bank access
const result = await BANKS.shinhan.run(
  null,          // username (not used)
  'password',    // password
  'user-id',     // user ID
  null           // proxy URL
);
```

### Transaction History Retrieval

```javascript
const { createAutomator } = require('./financehub');
const automator = createAutomator('shinhan');

// Login first
await automator.login(credentials);

// Get transaction history
const history = await automator.getTransactionHistory({
  yearsBack: 10,
  accountIndex: 0,
  outputPath: './transactions.xlsx'
});

console.log('Downloaded:', history.filePath);
```

### Card Automation (Future)

```javascript
const { cards } = require('./financehub');

// Create card automator
const cardAutomator = cards.createCardAutomator('shinhan-card');

// Login and get cards
const result = await cardAutomator.loginAndGetCards({
  userId: 'your-id',
  password: 'your-password'
});

console.log('Cards:', result.cards);
// [
//   { cardNumber: "1234-****-****-5678", cardName: "신한 Deep Dream" },
//   { cardNumber: "9876-****-****-4321", cardName: "신한 체크카드" }
// ]

// Get transactions
const transactions = await cardAutomator.getTransactions(
  '1234-****-****-5678',
  '20240101',
  '20240131'
);
```

---

## 9. Database Integration

**Note**: The Finance Hub automation framework integrates with the SQLite database schema defined in `src/main/sqlite/financehub.ts`.

### Integration Points

1. **After Login**: Account information is upserted to `accounts` table
2. **After Transaction Retrieval**: Transactions bulk inserted to `transactions` table
3. **Sync Tracking**: Each automation run creates a `sync_operation` record
4. **Deduplication**: UNIQUE index prevents duplicate transactions

### Example Integration

```javascript
const { FinanceHubDbManager } = require('../sqlite/financehub');
const { createAutomator } = require('./financehub');

// Database setup
const db = require('better-sqlite3')('financehub.db');
const dbManager = new FinanceHubDbManager(db);

// Automation
const automator = createAutomator('shinhan');
const loginResult = await automator.login(credentials);

// Get transactions
const history = await automator.getTransactionHistory({ yearsBack: 1 });
const transactions = parseTransactionExcel(history.filePath);

// Store in database
const importResult = dbManager.importTransactions(
  'shinhan',
  {
    accountNumber: '110-123-456789',
    accountName: '신한 주거래 우대',
    customerName: '홍길동',
    balance: 5000000
  },
  transactions,
  {
    queryPeriodStart: '2023-01-01',
    queryPeriodEnd: '2024-01-01',
    filePath: history.filePath
  }
);

console.log('Import result:', importResult);
// {
//   account: { id: "...", bankId: "shinhan", ... },
//   syncOperation: { id: "...", status: "completed", ... },
//   inserted: 1234,
//   skipped: 56
// }
```

---

## 10. Security Considerations

### Credential Handling
- **Never stores credentials** in plain text
- Passwords used only during automation session
- Supports encrypted credential storage in SQLite
- Environment variables for sensitive data

### API Keys
- Gemini API keys stored in Electron Store (encrypted)
- Environment variable fallback
- Never committed to version control

### Browser Security
- Persistent Chrome profiles for session persistence
- Certificate-based authentication support
- Proxy support with authentication
- Clipboard permissions for OTP/2FA

### Debug Output
- Screenshots may contain sensitive info
- Excel files contain full transaction history
- Keyboard layouts exported as JSON
- Store debug files securely

---

## 11. Error Handling

### Retry Strategies
1. **Input Fields**: Frame fallback → Type fallback
2. **Buttons**: Force click → JavaScript click
3. **Keyboard Detection**: Multiple selector attempts
4. **API Calls**: Automatic retry with exponential backoff

### Common Failure Scenarios

| Scenario | Handling |
|----------|----------|
| Virtual keyboard not detected | Fallback to text input if available |
| Gemini API failure | Log error, suggest manual entry |
| Security popup unexpected | Continue with warning |
| Login failure | Return detailed error in result |
| Transaction download timeout | Extend timeout, retry |

---

## 12. Extension Guide

### Adding a New Bank

1. **Create directory**: `banks/new-bank/`
2. **Create config.js** with bank metadata and XPaths
3. **Extend BaseBankAutomator**:
   ```javascript
   class NewBankAutomator extends BaseBankAutomator {
     async login(credentials, proxyUrl) {
       // Implement login flow
     }
   }
   ```
4. **Implement virtual keyboard** if needed
5. **Implement security popup handler** if needed
6. **Register in index.js**:
   ```javascript
   const BANKS = {
     'new-bank': {
       config: newBank.NEW_BANK_INFO,
       Automator: newBank.NewBankAutomator,
       create: newBank.createNewBankAutomator,
       run: newBank.runNewBankAutomation
     }
   };
   ```

### Adding a New Card Company

1. **Create directory**: `cards/new-card/`
2. **Follow same pattern as banks**
3. **Extend BaseCardAutomator**
4. **Implement**: `login()`, `getCards()`, `getTransactions()`
5. **Register in cards/index.js**

---

## 13. Performance Optimizations

### Screenshot Optimization
- Only captures keyboard regions, not full page
- Reuses keyboard layout across password characters
- Caches shift key position

### Database Optimization
- Bulk insert transactions (single transaction)
- UNIQUE index for automatic deduplication
- Prepared statements for repeated queries

### Browser Optimization
- Persistent context (reuses profile)
- Route interception (blocks unwanted requests)
- Parallel page operations where possible

---

## 14. Testing & Debugging

### Debug Output Files

When running automations, check `output/{bank-id}/` for:

| File | Purpose |
|------|---------|
| `{bank}-keyboard-LOWER-{timestamp}.png` | Lower keyboard screenshot |
| `{bank}-keyboard-UPPER-{timestamp}.png` | Upper keyboard screenshot |
| `keyboard-layout-{timestamp}.json` | Keyboard key mappings |
| `keyboard-visualization-{timestamp}.html` | Interactive keyboard view |
| `transactions-{account}-{timestamp}.xlsx` | Downloaded transactions |

### Logging Levels
- `log()` - Normal operation info
- `warn()` - Non-critical issues
- `error()` - Critical failures

### Common Debug Steps
1. Check screenshot files for keyboard visibility
2. Review JSON layout for character mappings
3. Open HTML visualization to verify key positions
4. Check console logs for XPath selector issues

---

## 15. Dependencies

### Core Dependencies
- `playwright-core` - Browser automation
- `@google/genai` - Gemini Vision API
- `better-sqlite3` - Database (via parent module)

### Node.js Built-ins
- `fs` - File system operations
- `path` - Path manipulation
- `os` - Operating system utilities
- `crypto` - UUID generation

---

## Summary

Finance Hub is a production-ready automation framework for Korean financial institutions featuring:

✅ **4 Supported Banks**: Shinhan, KB Kookmin, NH Personal, NH Business
✅ **6 Card Companies**: Placeholder implementations ready for extension
✅ **AI-Powered Virtual Keyboards**: Gemini Vision for accurate key detection
✅ **Bilingual Support**: Korean/English dual-character keyboards
✅ **Transaction History**: Automated retrieval and parsing
✅ **Database Integration**: SQLite for data persistence
✅ **Extensible Architecture**: Easy to add new banks/cards
✅ **Security-First**: No credential storage, encrypted API keys
✅ **Debug-Friendly**: Comprehensive logging and visualization

The framework provides a solid foundation for automated financial data collection, synchronization, and management across multiple Korean financial institutions.
