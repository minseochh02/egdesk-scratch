// ============================================================================
// HYUNDAI CARD AUTOMATOR
// ============================================================================

const { BaseCardAutomator } = require('../../core');
const { HYUNDAI_CARD_CONFIG } = require('./config');

class HyundaiCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...HYUNDAI_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    throw new Error('Hyundai Card automation is not yet implemented');
  }

  async getCards() {
    throw new Error('Hyundai Card automation is not yet implemented');
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('Hyundai Card automation is not yet implemented');
  }
}

function createHyundaiCardAutomator(options = {}) {
  return new HyundaiCardAutomator(options);
}

async function runHyundaiCardAutomation(credentials) {
  const automator = createHyundaiCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  HyundaiCardAutomator,
  createHyundaiCardAutomator,
  runHyundaiCardAutomation,
};
