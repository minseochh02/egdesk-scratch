// ============================================================================
// HANA CARD CONFIGURATION
// ============================================================================

const HANA_CARD_INFO = {
  id: 'hana-card',
  name: 'Hana Card',
  nameKo: '하나카드',
  loginUrl: 'https://www.hanacard.co.kr/',
  category: 'major',
  color: '#009775',
  icon: '💳',
  supportsAutomation: false,
};

const HANA_CARD_XPATHS = {
  idInput: '',
  passwordInput: '',
  loginButton: '',
  keyboardLower: '',
  keyboardUpper: '',
  securityPopup: '',
  securityPopupClose: '',
  userNameText: '',
  inquiryUrl: '',
  inquiryButton: '',
  startDateInput: '',
  endDateInput: '',
};

const HANA_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

const HANA_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

const HANA_CARD_CONFIG = {
  card: HANA_CARD_INFO,
  targetUrl: 'https://www.hanacard.co.kr/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: HANA_CARD_XPATHS,
  timeouts: HANA_CARD_TIMEOUTS,
  delays: HANA_CARD_DELAYS,
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  HANA_CARD_INFO,
  HANA_CARD_XPATHS,
  HANA_CARD_TIMEOUTS,
  HANA_CARD_DELAYS,
  HANA_CARD_CONFIG,
};
