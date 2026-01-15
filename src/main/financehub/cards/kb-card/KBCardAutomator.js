// ============================================================================
// KB CARD AUTOMATOR
// ============================================================================

const { BaseCardAutomator } = require('../../core');
const { KB_CARD_CONFIG } = require('./config');

class KBCardAutomator extends BaseCardAutomator {
  constructor(options = {}) {
    super({ ...KB_CARD_CONFIG, ...options });
  }

  async login(credentials) {
    throw new Error('KB Card automation is not yet implemented');
  }

  async getCards() {
    throw new Error('KB Card automation is not yet implemented');
  }

  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('KB Card automation is not yet implemented');
  }
}

function createKBCardAutomator(options = {}) {
  return new KBCardAutomator(options);
}

async function runKBCardAutomation(credentials) {
  const automator = createKBCardAutomator();
  try {
    return await automator.login(credentials);
  } finally {
    await automator.cleanup();
  }
}

module.exports = {
  KBCardAutomator,
  createKBCardAutomator,
  runKBCardAutomation,
};
