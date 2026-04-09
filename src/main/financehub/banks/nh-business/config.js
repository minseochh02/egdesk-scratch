// ============================================================================
// NH BUSINESS BANK CONFIGURATION (법인)
// ============================================================================

/**
 * NH Business Bank Information
 */
const NH_BUSINESS_BANK_INFO = {
  id: 'nh-business',
  name: 'NH Business Bank',
  nameKo: 'NH농협은행 법인',
  loginUrl: 'https://ibz.nonghyup.com/servlet/ICCNP1000S.view',
  category: 'special',
  color: '#00B140',
  icon: '🏢',
  supportsAutomation: true,
};

/**
 * NH Business Bank Automation Configuration
 */
const NH_BUSINESS_CONFIG = {
  // Bank information
  bank: NH_BUSINESS_BANK_INFO,

  // Main URL (Corporate Internet Banking)
  targetUrl: 'https://ibz.nonghyup.com/servlet/ICCNP1000S.view',

  // Chrome settings
  headless: false,
  chromeProfile: 'Default',

  // Undesired hostnames (to redirect from)
  undesiredHostnames: [],

  // XPath selectors
  xpaths: {
    // Initial popup
    confirmPopupButton: 'a:has-text("확인")',

    // Certificate selection (INIpay in-page list — same as nhbank.spec.js)
    certificateListButton: '/html/body/div[7]/div[2]/form[2]/div/div[1]/a[2]/p/span', // 공동인증서 로그인 button
    /** Rows in the cert picker table; used to enumerate and click a chosen cert */
    certificateTableRow: 'div.cert-list table tbody tr',
    certificateItem: '[id="id=cn%3DCrossCertCA4%2Cou%3DAccreditedCA%2Co%3DCrossCert%2Cc%3DKR&sn=01AF1D0A"]',

    // Certificate password (INItech virtual keyboard)
    certPasswordInput: '[id="ini_cert_pwd"]',
    certPasswordKeyboardButton: '[id="ini_cert_pwd_tk_btn_initech"]',
    certPasswordKeyboardKey: '[id="ini_cert_pwd_imgTwin"]',
    certPasswordCloseKeyboard: '/html/body/div[19]/div[2]/div/div[1]/div[1]/div[2]/div[3]/div/h2', // Click h2 to close keyboard
    certSubmitButton: '[id="INI_certSubmit"]',

    // Post-login navigation
    closeModalButton: '.ic-size > svg:nth-child(1)',
    transactionMenuLink: 'a:has-text("입출금거래내역조회(당일)")',

    // Transaction inquiry page
    accountDropdown: '/html/body/div[9]/div[3]/div[2]/section/form/div/div[1]/table/tbody/tr[1]/td/div/div[1]/div/div/select',
    accountDropdownById: '[id="drw_acno"]', // Alternative selector

    // Date selectors
    startYearSelect: '[id="start_year"]',
    startMonthSelect: '[id="start_month"]',
    startDateSelect: '[id="start_date"]',
    endYearSelect: 'xpath=/html/body/div[9]/div[3]/div[2]/section/form/div/div[1]/table/tbody/tr[5]/td/div[2]/div[2]/div[3]/div/div[1]/select',
    endMonthSelect: 'xpath=/html/body/div[9]/div[3]/div[2]/section/form/div/div[1]/table/tbody/tr[5]/td/div[2]/div[2]/div[3]/div/div[2]/select',
    endDateSelect: 'xpath=/html/body/div[9]/div[3]/div[2]/section/form/div/div[1]/table/tbody/tr[5]/td/div[2]/div[2]/div[3]/div/div[3]/select',

    // Query button
    searchButton: 'a:has-text("조회")',

    // Pagination
    nextRecordsButton: 'button:has-text("다음내역")',

    // Account tabs
    withdrawalAccountsTab: 'a[href="#cont1_1"]',
    depositAccountsTab: 'a[href="#cont1_2"]',
    fundAccountsTab: 'a[href="#cont1_3"]',
    foreignCurrencyTab: 'a[href="#cont1_5"]',
    accountTable: '#tb0101',
  },

  // Timing configurations
  timeouts: {
    pageLoad: 30000,
    click: 10000,
    type: 5000,
    waitForSelector: 10000,
    elementWait: 10000,
    scrollWait: 500,
    frameSearch: 2000,
  },

  delays: {
    betweenActions: 1000,
    mouseMove: 300,
    keyPress: 200,
    keyboardUpdate: 1000,
    shiftActivate: 200,
    shiftDeactivate: 200,
    humanLike: 3000, // 3 second delays for human-like behavior
  },

  // Windows keyboard input settings
  useWindowsKeyboard: true,  // Set to false to force virtual keyboard on Windows
  windowsInputMethod: 'auto', // 'auto' tries all methods with fallbacks
};

module.exports = {
  NH_BUSINESS_BANK_INFO,
  NH_BUSINESS_CONFIG,
};
