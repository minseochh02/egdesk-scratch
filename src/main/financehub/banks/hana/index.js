const { HanaBankAutomator, createHanaAutomator } = require('./HanaBankAutomator');
const { HANA_BANK_INFO, HANA_CONFIG } = require('./config');

module.exports = {
  HanaBankAutomator,
  createHanaAutomator,
  HANA_BANK_INFO,
  HANA_CONFIG,
  bankInfo: HANA_BANK_INFO,
};
