const { IbkBankAutomator, createIbkAutomator } = require('./IbkBankAutomator');
const { IBK_BANK_INFO, IBK_CONFIG } = require('./config');

module.exports = {
  IbkBankAutomator,
  createIbkAutomator,
  IBK_BANK_INFO,
  IBK_CONFIG,
  bankInfo: IBK_BANK_INFO,
};
