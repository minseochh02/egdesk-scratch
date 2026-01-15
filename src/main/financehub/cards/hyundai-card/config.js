// ============================================================================
// HYUNDAI CARD CONFIGURATION
// ============================================================================

const HYUNDAI_CARD_INFO = {
  id: 'hyundai-card',
  name: 'Hyundai Card',
  nameKo: '현대카드',
  loginUrl: 'https://www.hyundaicard.com/',
  category: 'major',
  color: '#000000',
  icon: '💳',
  supportsAutomation: false,
};

const HYUNDAI_CARD_XPATHS = {
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

const HYUNDAI_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

const HYUNDAI_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

const HYUNDAI_CARD_CONFIG = {
  card: HYUNDAI_CARD_INFO,
  targetUrl: 'https://www.hyundaicard.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: HYUNDAI_CARD_XPATHS,
  timeouts: HYUNDAI_CARD_TIMEOUTS,
  delays: HYUNDAI_CARD_DELAYS,
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  HYUNDAI_CARD_INFO,
  HYUNDAI_CARD_XPATHS,
  HYUNDAI_CARD_TIMEOUTS,
  HYUNDAI_CARD_DELAYS,
  HYUNDAI_CARD_CONFIG,
};
