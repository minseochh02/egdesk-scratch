// ============================================================================
// KOOKMIN BANK CONFIGURATION
// ============================================================================

/**
 * @type {import('../../types').BankConfig}
 */
const KOOKMIN_BANK_INFO = {
  id: 'kookmin',
  name: 'Kookmin Bank',
  nameKo: '국민은행',
  loginUrl: 'https://obank.kbstar.com/quics?page=C021255',
  category: 'major',
  color: '#FFBC00',
  icon: '🏦',
  supportsAutomation: true,
};

/**
 * @type {import('../../types').BankXPaths}
 */
const KOOKMIN_XPATHS = {
  // Login form inputs
  idInput: '//input[@id="user_id"]',
  passwordInput: '//input[@id="user_password"]',
  loginButton: '//button[@id="loginBtn"] | //a[@id="loginBtn"] | //button[contains(@class, "btn_login")]',
  
  // Virtual keyboard - LOWER (default state, lowercase)
  keyboardLower: '//div[@id="vk_layout_lower"] | //div[contains(@class, "keyboard_lower")]',
  keyboardLowerAlt: '//div[contains(@id, "_layoutLower")] | //div[contains(@class, "vk_lower")]',

  // Virtual keyboard - UPPER (shifted state, uppercase)
  keyboardUpper: '//div[@id="vk_layout_upper"] | //div[contains(@class, "keyboard_upper")]',
  keyboardUpperAlt: '//div[contains(@id, "_layoutUpper")] | //div[contains(@class, "vk_upper")]',

  // Virtual keyboard selectors (for base class)
  keyboardLowerSelectors: [
    '//div[@id="vk_layout_lower"]',
    '//div[contains(@class, "keyboard_lower")]',
    '//div[contains(@id, "_layoutLower")]',
    '//div[contains(@class, "vk_lower")]'
  ],
  keyboardUpperSelectors: [
    '//div[@id="vk_layout_upper"]',
    '//div[contains(@class, "keyboard_upper")]',
    '//div[contains(@id, "_layoutUpper")]',
    '//div[contains(@class, "vk_upper")]'
  ],
  
  // Security popup
  securityPopup: '//div[contains(@class, "layer") and contains(., "보안프로그램")]',
  securityPopupClose: '//a[contains(text(), "설치하지 않음")] | //button[contains(text(), "설치하지 않음")]',
  securityPopupAlt: '//div[contains(@class, "popup") and contains(., "보안")]',
  securityPopupCloseAlt: '//a[contains(@class, "close")] | //button[contains(@class, "close")]',
  
  // Login status indicators
  userProfileGroup: '//div[contains(@class, "user_info")] | //div[contains(@class, "login_info")]',
  userNameText: '//span[contains(@class, "user_name")] | //strong[contains(@class, "name")]',
  
  // Session management
  timerGroup: '//div[contains(@class, "timer")] | //div[contains(@class, "session")]',
  extendSessionButton: '//button[contains(text(), "연장")] | //a[contains(text(), "연장")]',

  // KB 기업 (obiz) — corporate certificate flow (see scripts/bank-excel-download-automation/kb.spec.js)
  bizMainUrl: 'https://obiz.kbstar.com/quics?page=C019320',
  bizTransactionFallbackUrl: 'https://obiz.kbstar.com/quics?page=C015668',
  bizTransactionAltUrl: 'https://obiz.kbstar.com/quics?page=C102210',

  // Transaction inquiry
  inquiryUrl: 'https://obank.kbstar.com/quics?page=C017213',
  inquiryButton: '//button[contains(text(), "조회")] | //a[contains(text(), "조회")]',
  accountDropdown: '//select[contains(@id, "account")] | //select[contains(@name, "account")]',
  startDateInput: '//input[contains(@id, "startDate")] | //input[contains(@name, "fromDate")]',
  endDateInput: '//input[contains(@id, "endDate")] | //input[contains(@name, "toDate")]',
  
  // Account list
  accountRow: '//tr[contains(@class, "account")] | //div[contains(@class, "account_item")]',
  accountList: '//table[contains(@class, "account")] | //ul[contains(@class, "account_list")]',
};

/**
 * @type {import('../../types').BankTimeouts}
 */
const KOOKMIN_TIMEOUTS = {
  elementWait: 10000,
  click: 5000,
  frameSearch: 3000,
  passwordWait: 30000,
  pageLoad: 3000,
  scrollWait: 500,
};

/**
 * @type {import('../../types').BankDelays}
 */
const KOOKMIN_DELAYS = {
  mouseMove: 100,
  click: 200,
  shiftActivate: 200,
  shiftDeactivate: 200,
  keyboardUpdate: 500,
  keyboardReturn: 300,
};

/**
 * @type {import('../../types').BankAutomationConfig}
 */
const KOOKMIN_CONFIG = {
  bank: KOOKMIN_BANK_INFO,
  targetUrl: 'https://www.kbstar.com/',
  undesiredHostnames: ['shinhan.com', 'www.shinhan.com', 'wooribank.com'],
  headless: false,
  chromeProfile: null,
  xpaths: KOOKMIN_XPATHS,
  timeouts: KOOKMIN_TIMEOUTS,
  delays: KOOKMIN_DELAYS,
};

module.exports = {
  KOOKMIN_BANK_INFO,
  KOOKMIN_XPATHS,
  KOOKMIN_TIMEOUTS,
  KOOKMIN_DELAYS,
  KOOKMIN_CONFIG,
};