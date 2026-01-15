// ============================================================================
// SHINHAN CARD MODULE
// ============================================================================

const { ShinhanCardAutomator, createShinhanCardAutomator, runShinhanCardAutomation } = require('./ShinhanCardAutomator');
const { SHINHAN_CARD_INFO, SHINHAN_CARD_CONFIG } = require('./config');

module.exports = {
  ShinhanCardAutomator,
  createShinhanCardAutomator,
  runShinhanCardAutomation,
  SHINHAN_CARD_INFO,
  SHINHAN_CARD_CONFIG,
};
