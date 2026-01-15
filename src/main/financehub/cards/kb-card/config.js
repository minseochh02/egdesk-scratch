// ============================================================================
// KB CARD CONFIGURATION
// ============================================================================

const KB_CARD_INFO = {
  id: 'kb-card',
  name: 'KB Card',
  nameKo: 'KB국민카드',
  loginUrl: 'https://www.kbcard.com/',
  category: 'major',
  color: '#FFBC00',
  icon: '💳',
  supportsAutomation: false,
};

const KB_CARD_XPATHS = {
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

const KB_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

const KB_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

const KB_CARD_CONFIG = {
  card: KB_CARD_INFO,
  targetUrl: 'https://www.kbcard.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: KB_CARD_XPATHS,
  timeouts: KB_CARD_TIMEOUTS,
  delays: KB_CARD_DELAYS,
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  KB_CARD_INFO,
  KB_CARD_XPATHS,
  KB_CARD_TIMEOUTS,
  KB_CARD_DELAYS,
  KB_CARD_CONFIG,
};
