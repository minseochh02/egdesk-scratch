// Woori 기업 (nbi.wooribank.com) — in-page cert module; see scripts/bank-excel-download-automation/woori.spec.js

const WOORI_BANK_INFO = {
  id: 'woori',
  name: 'Woori Bank',
  nameKo: '우리은행',
  loginUrl: 'https://svc.wooribank.com/svc/Dream?withyou=PSTAX0069',
  category: 'major',
  color: '#0072BC',
  icon: '🏛️',
  supportsAutomation: true,
};

const WOORI_XPATHS = {
  entryUrl: 'https://nbi.wooribank.com/nbi/woori?withyou=bi',
};

const WOORI_CONFIG = {
  bank: WOORI_BANK_INFO,
  targetUrl: 'https://www.wooribank.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: WOORI_XPATHS,
  timeouts: { pageLoad: 3000 },
  delays: {},
};

module.exports = {
  WOORI_BANK_INFO,
  WOORI_XPATHS,
  WOORI_CONFIG,
};
