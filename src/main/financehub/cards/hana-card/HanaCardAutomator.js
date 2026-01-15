// ============================================================================
// HANA CARD AUTOMATOR
// ============================================================================

const { BaseCardAutomator } = require('../../core');
const { HANA_CARD_CONFIG } = require('./config');

class HanaCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...HANA_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    throw new Error('Hana Card automation is not yet implemented');
  }

  async getCards() {
    throw new Error('Hana Card automation is not yet implemented');
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('Hana Card automation is not yet implemented');
  }
}

function createHanaCardAutomator(options = {}) {
  return new HanaCardAutomator(options);
}

async function runHanaCardAutomation(credentials) {
  const automator = createHanaCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  HanaCardAutomator,
  createHanaCardAutomator,
  runHanaCardAutomation,
};
