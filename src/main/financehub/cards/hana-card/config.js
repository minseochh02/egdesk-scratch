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
  supportsAutomation: true,
};

const HANA_CARD_XPATHS = {
  // Initial popup (before login)
  initialPopup: '/html/body/div[1]/section/div/div',
  initialPopupClose: '/html/body/div[1]/section/div/button',

  // Post-login popup
  postLoginPopupClose: '/html/body/div[1]/section/div/button',

  // Navigation - Use text-based XPath or CSS for more reliable selection
  businessSelector: '//a[contains(text(), "기업")]', // 기업 selector using text
  loginButton: '/html/body/div[7]/header/div/nav[1]/ul[2]/li[1]/a', // Login button after 기업

  // Login form - Full XPaths (login form is in main page, not in hsci frame)
  idInput: '/html/body/div[2]/div[4]/div/div/div[6]/form/div/div/div/div[1]/div/div[1]/div/div[1]/div[1]/div/div[1]/input',
  passwordInput: '/html/body/div[2]/div[4]/div/div/div[6]/form/div/div/div/div[1]/div/div[1]/div/div[1]/div[2]/div/div[1]/input[1]',
  loginSubmitButton: '/html/body/div[2]/div[4]/div/div/div[6]/form/div/div/div/div[1]/div/div[1]/div/div[2]/div/ul/li/button',

  // Transaction-related selectors
  transactionButton: '/html/body/div[7]/div/article[1]/div[1]/div[2]/a[2]', // 승인내역
  organizationTree: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/article[1]/div[1]/div[1]/div[1]',
  cardTableContainer: '#simul > div.sch_tab > div.right > div',
  cardTableBody: '#commTab1',
  startDateInput: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/div/form/fieldset/ul[1]/li[4]/input[1]',
  endDateInput: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/div/form/fieldset/ul[1]/li[4]/input[2]',
  queryButton: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/div/form/fieldset/ul[2]/li/a',
  moreButton: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/article[3]/div/a',
  excelDownloadButton: '/html/body/div[2]/div[4]/div/div/div[2]/div/div/div/article[3]/div/div[1]/ul[2]/li[3]/a',

  // Legacy fields (kept for compatibility)
  keyboardLower: '',
  keyboardUpper: '',
  securityPopup: '',
  securityPopupClose: '',
  userNameText: '',
  inquiryUrl: '',
  inquiryButton: '',
};

const HANA_CARD_TIMEOUTS = {
  elementWait: 60000, // Increased from 10000 to 60000 for slower page loads
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 30000,
  scrollWait: 500,
  popupWait: 5000, // Wait time for initial popup
  downloadWait: 60000,
};

const HANA_CARD_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
  betweenActions: 1000,
  afterLogin: 3000,
  afterMenuClick: 1000,
  afterNavigation: 2000,
  afterSearch: 2000,
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
