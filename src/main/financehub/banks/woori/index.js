const { WooriBankAutomator, createWooriAutomator } = require('./WooriBankAutomator');
const { WOORI_BANK_INFO, WOORI_CONFIG } = require('./config');

module.exports = {
  WooriBankAutomator,
  createWooriAutomator,
  WOORI_BANK_INFO,
  WOORI_CONFIG,
  bankInfo: WOORI_BANK_INFO,
};
