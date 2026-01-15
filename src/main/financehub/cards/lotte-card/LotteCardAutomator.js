// ============================================================================
// LOTTE CARD AUTOMATOR
// ============================================================================

const { BaseCardAutomator } = require('../../core');
const { LOTTE_CARD_CONFIG } = require('./config');

class LotteCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...LOTTE_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    throw new Error('Lotte Card automation is not yet implemented');
  }

  async getCards() {
    throw new Error('Lotte Card automation is not yet implemented');
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('Lotte Card automation is not yet implemented');
  }
}

function createLotteCardAutomator(options = {}) {
  return new LotteCardAutomator(options);
}

async function runLotteCardAutomation(credentials) {
  const automator = createLotteCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  LotteCardAutomator,
  createLotteCardAutomator,
  runLotteCardAutomation,
};
