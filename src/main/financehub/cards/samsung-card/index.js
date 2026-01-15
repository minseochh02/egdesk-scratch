// ============================================================================
// SAMSUNG CARD MODULE
// ============================================================================

const { SamsungCardAutomator, createSamsungCardAutomator, runSamsungCardAutomation } = require('./SamsungCardAutomator');
const { SAMSUNG_CARD_INFO, SAMSUNG_CARD_CONFIG } = require('./config');

module.exports = {
  SamsungCardAutomator,
  createSamsungCardAutomator,
  runSamsungCardAutomation,
  SAMSUNG_CARD_INFO,
  SAMSUNG_CARD_CONFIG,
};
