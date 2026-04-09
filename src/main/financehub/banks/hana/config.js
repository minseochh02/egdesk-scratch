// Hana 기업 (biz.kebhana.com) — see scripts/bank-excel-download-automation/hana.spec.js

const HANA_BANK_INFO = {
  id: 'hana',
  name: 'Hana Bank',
  nameKo: '하나은행',
  loginUrl: 'https://www.kebhana.com/',
  category: 'major',
  color: '#009775',
  icon: '🌿',
  supportsAutomation: true,
};

const HANA_XPATHS = {
  entryUrl: 'https://biz.kebhana.com/index.jsp?pc',
  mainFrameName: 'hanaMainframe',
  certLoginButtonId: 'certLogin',
};

const HANA_TIMEOUTS = {
  elementWait: 10000,
  pageLoad: 3000,
};

const HANA_DELAYS = {
  click: 200,
};

const HANA_CONFIG = {
  bank: HANA_BANK_INFO,
  targetUrl: 'https://www.kebhana.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: HANA_XPATHS,
  timeouts: HANA_TIMEOUTS,
  delays: HANA_DELAYS,
};

module.exports = {
  HANA_BANK_INFO,
  HANA_XPATHS,
  HANA_CONFIG,
};
