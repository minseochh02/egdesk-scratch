// ============================================================================
// SHINHAN CARD CONFIGURATION
// ============================================================================

/**
 * @type {import('../../types').CardConfig}
 */
const SHINHAN_CARD_INFO = {
  id: 'shinhan-card',
  name: 'Shinhan Card',
  nameKo: '신한카드',
  loginUrl: 'https://www.shinhancard.com/',
  category: 'major',
  color: '#0046FF',
  icon: '💳',
  supportsAutomation: false, // TODO: Set to true when automation is implemented
};

/**
 * @type {import('../../types').CardXPaths}
 */
const SHINHAN_CARD_XPATHS = {
  // Login form inputs
  idInput: '', // TODO: Fill in XPath
  passwordInput: '', // TODO: Fill in XPath
  loginButton: '', // TODO: Fill in XPath

  // Virtual keyboard
  keyboardLower: '',
  keyboardUpper: '',

  // Security popup
  securityPopup: '',
  securityPopupClose: '',

  // Login status indicators
  userNameText: '',

  // Transaction inquiry
  inquiryUrl: '',
  inquiryButton: '',
  startDateInput: '',
  endDateInput: '',
};

/**
 * @type {import('../../types').CardTimeouts}
 */
const SHINHAN_CARD_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

/**
 * @type {import('../../types').CardDelays}
 */
const SHINHAN_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

/**
 * @type {import('../../types').CardAutomationConfig}
 */
const SHINHAN_CARD_CONFIG = {
  card: SHINHAN_CARD_INFO,
  targetUrl: 'https://www.shinhancard.com/',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  xpaths: SHINHAN_CARD_XPATHS,
  timeouts: SHINHAN_CARD_TIMEOUTS,
  delays: SHINHAN_CARD_DELAYS,

  // Windows keyboard input settings
  useWindowsKeyboard: true,
  windowsInputMethod: 'auto',

  // Enhanced ID input settings
  useEnhancedIdInput: true,
  debug: false,
};

module.exports = {
  SHINHAN_CARD_INFO,
  SHINHAN_CARD_XPATHS,
  SHINHAN_CARD_TIMEOUTS,
  SHINHAN_CARD_DELAYS,
  SHINHAN_CARD_CONFIG,
};
