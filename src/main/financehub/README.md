# Finance Hub - Korean Bank Automation Framework

은행 자동화 프레임워크 - Korean Bank Login Automation with Virtual Keyboard Support

## 📁 Project Structure

```
financehub/
├── index.js                    # Main entry point
├── types/
│   └── index.ts                # TypeScript type definitions
├── core/
│   ├── index.js
│   └── BaseBankAutomator.js    # Abstract base class for all bank automators
├── banks/
│   └── shinhan/                # Shinhan Bank implementation
│       ├── index.js            # Module exports
│       ├── config.js           # Bank-specific configuration
│       ├── ShinhanBankAutomator.js  # Main automator class
│       ├── securityPopup.js    # Security popup handler
│       └── virtualKeyboard.js  # Virtual keyboard handler
└── utils/
    ├── index.js
    ├── api-keys.js             # API key management
    ├── ai-keyboard-analyzer.js # Gemini Vision keyboard detection
    ├── bilingual-keyboard-parser.js  # Korean/English key parsing
    └── keyboard-visualization.js     # Debug visualization generator
```

## 🚀 Quick Start

### Basic Usage

```javascript
const { createAutomator } = require('./financehub');

// Create Shinhan Bank automator
const automator = createAutomator('shinhan', {
  headless: false,  // Set to true for production
});

// Login
const result = await automator.login({
  userId: 'your-user-id',
  password: 'your-password',
});

console.log('Login result:', result);
```

### Direct Bank Access

```javascript
const { shinhan } = require('./financehub');

// Using the convenience function
const result = await shinhan.runShinhanAutomation(
  null,           // username (not used)
  'password',     // password
  'user-id',      // user ID
  null            // proxy URL (optional)
);

// Or create an automator instance
const automator = shinhan.createShinhanAutomator({
  headless: false,
  outputDir: './output/shinhan',
});

const result = await automator.login({
  userId: 'your-user-id',
  password: 'your-password',
});
```

## 🏦 Supported Banks

| Bank | ID | Status | Virtual Keyboard |
|------|-----|--------|------------------|
| 신한은행 (Shinhan) | `shinhan` | ✅ Ready | ✅ AI-powered |
| KB국민은행 | `kb` | 🚧 Planned | - |
| 우리은행 | `woori` | 🚧 Planned | - |
| 하나은행 | `hana` | 🚧 Planned | - |

## 🔑 API Key Configuration

The virtual keyboard analysis requires a Gemini API key. Configure it in one of these ways:

### 1. Environment Variable
```bash
export GEMINI_API_KEY="your-api-key"
```

### 2. AI Keys Manager (Electron Store)
The framework automatically looks for keys stored in electron-store under `ai-keys`.

## 🎹 Virtual Keyboard Handling

The framework uses Gemini Vision AI to detect and interact with virtual keyboards:

1. **Screenshot Capture**: Takes screenshots of the keyboard in both LOWER (default) and UPPER (shifted) states
2. **AI Analysis**: Uses Gemini Vision to detect key positions and labels
3. **Bilingual Parsing**: Parses Korean/English dual-character keys (e.g., "a / ㅏ")
4. **Shift Handling**: Automatically handles shift key for uppercase letters and symbols
5. **Accurate Clicking**: Clicks at the precise center of each detected key

### Debug Output

The framework generates helpful debug files in the output directory:
- `shinhan-keyboard-LOWER-{timestamp}.png` - Lower keyboard screenshot
- `shinhan-keyboard-UPPER-{timestamp}.png` - Upper keyboard screenshot
- `keyboard-layout-{timestamp}.json` - Full keyboard mapping
- `keyboard-visualization-{timestamp}.html` - Interactive HTML visualization

## 🏗️ Adding New Banks

### 1. Create Bank Directory
```
financehub/banks/your-bank/
├── index.js
├── config.js
├── YourBankAutomator.js
├── securityPopup.js (optional)
└── virtualKeyboard.js (optional)
```

### 2. Define Configuration
```javascript
// config.js
const YOUR_BANK_CONFIG = {
  bank: {
    id: 'yourbank',
    name: 'Your Bank',
    nameKo: '은행이름',
    loginUrl: 'https://...',
    // ...
  },
  targetUrl: '...',
  xpaths: {
    idInput: '...',
    passwordInput: '...',
    loginButton: '...',
    // ...
  },
  timeouts: { /* ... */ },
  delays: { /* ... */ },
};
```

### 3. Extend BaseBankAutomator
```javascript
// YourBankAutomator.js
const { BaseBankAutomator } = require('../../core');
const { YOUR_BANK_CONFIG } = require('./config');

class YourBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    super({ ...YOUR_BANK_CONFIG, ...options });
  }

  async login(credentials, proxyUrl) {
    // Implement login logic
  }

  // Override if needed
  async handleSecurityPopup(page) { /* ... */ }
  async handleVirtualKeyboard(page, password) { /* ... */ }
}
```

### 4. Register in Main Index
```javascript
// financehub/index.js
const yourbank = require('./banks/your-bank');

const BANKS = {
  // ...existing banks
  yourbank: {
    config: yourbank.YOUR_BANK_INFO,
    Automator: yourbank.YourBankAutomator,
    create: yourbank.createYourBankAutomator,
    run: yourbank.runYourBankAutomation,
  },
};
```

## 📝 API Reference

### `createAutomator(bankId, options)`
Creates an automator instance for the specified bank.

**Parameters:**
- `bankId` (string): Bank identifier (e.g., 'shinhan')
- `options` (object): Configuration options
  - `headless` (boolean): Run browser in headless mode
  - `chromeProfile` (string): Path to Chrome profile directory
  - `outputDir` (string): Directory for debug output files

**Returns:** Bank automator instance

### `automator.login(credentials, proxyUrl)`
Performs login automation.

**Parameters:**
- `credentials` (object):
  - `userId` (string): User ID
  - `password` (string): Password
- `proxyUrl` (string, optional): Proxy server URL

**Returns:** Promise<AutomationResult>

### `getSupportedBanks()`
Returns list of all supported banks with their configurations.

## ⚠️ Security Notes

- Never commit credentials or API keys to version control
- Use environment variables or secure storage for sensitive data
- The framework does NOT store passwords - they are used only during the automation session
- Debug screenshots may contain sensitive information - handle them appropriately

## 📄 License

MIT
