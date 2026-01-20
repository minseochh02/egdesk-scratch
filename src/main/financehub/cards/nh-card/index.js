// ============================================================================
// NH CARD MODULE
// ============================================================================

const { NHCardAutomator, createNHCardAutomator, runNHCardAutomation } = require('./NHCardAutomator');
const { NH_CARD_INFO, NH_CARD_CONFIG } = require('./config');

module.exports = {
  NHCardAutomator,
  createNHCardAutomator,
  runNHCardAutomation,
  NH_CARD_INFO,
  NH_CARD_CONFIG,
};
