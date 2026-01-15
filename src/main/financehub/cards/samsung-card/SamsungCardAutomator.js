// ============================================================================
// SAMSUNG CARD AUTOMATOR
// ============================================================================

const { BaseCardAutomator } = require('../../core');
const { SAMSUNG_CARD_CONFIG } = require('./config');

class SamsungCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...SAMSUNG_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    throw new Error('Samsung Card automation is not yet implemented');
  }

  async getCards() {
    throw new Error('Samsung Card automation is not yet implemented');
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('Samsung Card automation is not yet implemented');
  }
}

function createSamsungCardAutomator(options = {}) {
  return new SamsungCardAutomator(options);
}

async function runSamsungCardAutomation(credentials) {
  const automator = createSamsungCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  SamsungCardAutomator,
  createSamsungCardAutomator,
  runSamsungCardAutomation,
};
