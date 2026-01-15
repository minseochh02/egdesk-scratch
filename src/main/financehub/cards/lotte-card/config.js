// ============================================================================
// LOTTE CARD CONFIGURATION
// ============================================================================

const LOTTE_CARD_INFO = {
  id: 'lotte-card',
  name: 'Lotte Card',
  nameKo: '롯데카드',
  loginUrl: 'https://www.lottecard.co.kr/',
  category: 'major',
  color: '#ED1C24',
  icon: '💳',
  supportsAutomation: false,
};

const LOTTE_CARD_XPATHS = {
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

const LOTTE_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

const LOTTE_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

const LOTTE_CARD_CONFIG = {
  card: LOTTE_CARD_INFO,
  targetUrl: 'https://www.lottecard.co.kr/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: LOTTE_CARD_XPATHS,
  timeouts: LOTTE_CARD_TIMEOUTS,
  delays: LOTTE_CARD_DELAYS,
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  LOTTE_CARD_INFO,
  LOTTE_CARD_XPATHS,
  LOTTE_CARD_TIMEOUTS,
  LOTTE_CARD_DELAYS,
  LOTTE_CARD_CONFIG,
};
