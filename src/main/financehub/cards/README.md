# Card Company Automation

This directory contains automation implementations for Korean card companies.

## Directory Structure

```
cards/
├── index.js                    # Main registry and exports
├── README.md                   # This file
├── shinhan-card/               # 신한카드
│   ├── index.js
│   ├── config.js
│   └── ShinhanCardAutomator.js
├── samsung-card/               # 삼성카드
│   ├── index.js
│   ├── config.js
│   └── SamsungCardAutomator.js
├── hyundai-card/               # 현대카드
│   ├── index.js
│   ├── config.js
│   └── HyundaiCardAutomator.js
├── kb-card/                    # KB국민카드
│   ├── index.js
│   ├── config.js
│   └── KBCardAutomator.js
├── lotte-card/                 # 롯데카드
│   ├── index.js
│   ├── config.js
│   └── LotteCardAutomator.js
└── hana-card/                  # 하나카드
    ├── index.js
    ├── config.js
    └── HanaCardAutomator.js
```

## Supported Card Companies

| Company | ID | Korean Name | Status |
|---------|-----|-------------|--------|
| Shinhan Card | `shinhan-card` | 신한카드 | 🚧 Not Implemented |
| Samsung Card | `samsung-card` | 삼성카드 | 🚧 Not Implemented |
| Hyundai Card | `hyundai-card` | 현대카드 | 🚧 Not Implemented |
| KB Card | `kb-card` | KB국민카드 | 🚧 Not Implemented |
| Lotte Card | `lotte-card` | 롯데카드 | 🚧 Not Implemented |
| Hana Card | `hana-card` | 하나카드 | 🚧 Not Implemented |

## Usage

### Basic Usage

```javascript
const { cards } = require('../financehub');

// Get all supported card companies
const supportedCards = cards.getSupportedCards();

// Create a card automator instance
const automator = cards.createCardAutomator('shinhan-card');

// Login
const result = await automator.login({
  userId: 'your-id',
  password: 'your-password',
  accountType: 'personal' // or 'corporate'
});

// Get cards
const cardList = await automator.getCards();

// Get transactions
const transactions = await automator.getTransactions(
  '1234-****-****-5678', // card number
  '20240101', // start date
  '20240131'  // end date
);

// Cleanup
await automator.cleanup();
```

### Using Registry

```javascript
const { cards } = require('../financehub');

// Access specific card company
const shinhanCard = cards.CARDS['shinhan-card'];

// Get configuration
const config = cards.getCardConfig('shinhan-card');

// Run automation
const result = await cards.CARDS['shinhan-card'].run({
  userId: 'your-id',
  password: 'your-password'
});
```

## Adding a New Card Company

To add a new card company:

1. **Create directory**: `mkdir cards/new-card/`

2. **Create config.js**:
```javascript
const NEW_CARD_INFO = {
  id: 'new-card',
  name: 'New Card',
  nameKo: '새카드',
  loginUrl: 'https://www.newcard.com/',
  category: 'major',
  color: '#FF0000',
  icon: '💳',
  supportsAutomation: false,
};

const NEW_CARD_CONFIG = {
  card: NEW_CARD_INFO,
  targetUrl: 'https://www.newcard.com/',
  xpaths: { /* ... */ },
  timeouts: { /* ... */ },
  delays: { /* ... */ },
};

module.exports = { NEW_CARD_INFO, NEW_CARD_CONFIG };
```

3. **Create Automator class**:
```javascript
const { BaseCardAutomator } = require('../../core');
const { NEW_CARD_CONFIG } = require('./config');

class NewCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...NEW_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    // Implement login logic
  }

  async getCards() {
    // Implement card retrieval
  }

  async getTransactions(cardNumber, startDate, endDate) {
    // Implement transaction retrieval
  }
}

module.exports = { NewCardAutomator };
```

4. **Create index.js**:
```javascript
const { NewCardAutomator } = require('./NewCardAutomator');
const { NEW_CARD_INFO, NEW_CARD_CONFIG } = require('./config');

module.exports = {
  NewCardAutomator,
  NEW_CARD_INFO,
  NEW_CARD_CONFIG,
};
```

5. **Register in cards/index.js**:
```javascript
const newCard = require('./new-card');

const CARDS = {
  // ... existing cards
  'new-card': {
    config: newCard.NEW_CARD_INFO,
    Automator: newCard.NewCardAutomator,
    // ...
  },
};
```

## Implementation Status

All card companies currently have placeholder implementations. To implement a card company:

1. Study the card company's website login flow
2. Identify XPath selectors for form elements
3. Handle virtual keyboards if present
4. Handle security popups if present
5. Implement transaction scraping logic
6. Test thoroughly
7. Update `supportsAutomation: true` in config

## Architecture

Card automators follow the same pattern as bank automators:

- **BaseCardAutomator**: Abstract base class with common functionality
- **Card-specific Automators**: Implement login, getCards, getTransactions
- **Configuration**: XPaths, timeouts, delays, etc.
- **Virtual Keyboards**: Handled per card company if needed
- **Security Popups**: Handled per card company if needed

## Notes

- Card transactions typically include: date, merchant, amount, category, approval status
- Unlike banks which have accounts, cards are identified by card numbers
- Some card companies may require additional authentication (OTP, SMS, etc.)
- Corporate cards may have different login flows than personal cards
