// ============================================================================
// SHINHAN BANK MODULE
// ============================================================================

const { ShinhanBankAutomator, createShinhanAutomator, runShinhanAutomation } = require('./ShinhanBankAutomator');
const { SHINHAN_BANK_INFO, SHINHAN_CONFIG } = require('./config');

module.exports = {
  ShinhanBankAutomator,
  createShinhanAutomator,
  runShinhanAutomation,
  SHINHAN_BANK_INFO,
  SHINHAN_CONFIG,
};

