// ============================================================================
// LOTTE CARD MODULE
// ============================================================================

const { LotteCardAutomator, createLotteCardAutomator, runLotteCardAutomation } = require('./LotteCardAutomator');
const { LOTTE_CARD_INFO, LOTTE_CARD_CONFIG } = require('./config');

module.exports = {
  LotteCardAutomator,
  createLotteCardAutomator,
  runLotteCardAutomation,
  LOTTE_CARD_INFO,
  LOTTE_CARD_CONFIG,
};
