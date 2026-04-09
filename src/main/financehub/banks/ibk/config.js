// IBK 기업은행 (kiup.ibk.co.kr) — see scripts/bank-excel-download-automation/ibk.spec.js

const IBK_BANK_INFO = {
  id: 'ibk',
  name: 'IBK Bank',
  nameKo: 'IBK기업은행',
  loginUrl: 'https://www.ibk.co.kr/',
  category: 'special',
  color: '#004A98',
  icon: '🏢',
  supportsAutomation: true,
};

const IBK_XPATHS = {
  entryUrl: 'https://kiup.ibk.co.kr/uib/jsp/index.jsp',
  mainFrameName: 'mainframe',
  securityPopup: '//div[contains(@class, "layer") and contains(., "보안")]',
};

const IBK_TIMEOUTS = {
  elementWait: 10000,
  pageLoad: 3000,
};

const IBK_DELAYS = {
  click: 200,
};

const IBK_CONFIG = {
  bank: IBK_BANK_INFO,
  targetUrl: 'https://www.ibk.co.kr/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: IBK_XPATHS,
  timeouts: IBK_TIMEOUTS,
  delays: IBK_DELAYS,
};

module.exports = {
  IBK_BANK_INFO,
  IBK_XPATHS,
  IBK_CONFIG,
};
