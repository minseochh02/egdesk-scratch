// ============================================================================
// SAMSUNG CARD CONFIGURATION
// ============================================================================

const SAMSUNG_CARD_INFO = {
  id: 'samsung-card',
  name: 'Samsung Card',
  nameKo: '삼성카드',
  loginUrl: 'https://www.samsungcard.com/',
  category: 'major',
  color: '#1428A0',
  icon: '💳',
  supportsAutomation: false, // TODO: Set to true when automation is implemented
};

const SAMSUNG_CARD_XPATHS = {
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

const SAMSUNG_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

const SAMSUNG_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

const SAMSUNG_CARD_CONFIG = {
  card: SAMSUNG_CARD_INFO,
  targetUrl: 'https://www.samsungcard.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: SAMSUNG_CARD_XPATHS,
  timeouts: SAMSUNG_CARD_TIMEOUTS,
  delays: SAMSUNG_CARD_DELAYS,
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  SAMSUNG_CARD_INFO,
  SAMSUNG_CARD_XPATHS,
  SAMSUNG_CARD_TIMEOUTS,
  SAMSUNG_CARD_DELAYS,
  SAMSUNG_CARD_CONFIG,
};
