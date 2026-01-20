// ============================================================================
// NH CARD CONFIGURATION
// ============================================================================

/**
 * NH Card Information
 */
const NH_CARD_INFO = {
  id: 'nh-card',
  name: 'NH Card',
  nameKo: 'NH농협카드',
  loginUrl: 'https://card.nonghyup.com/servlet/IpCo9151I.act',
  category: 'major',
  color: '#00B140',
  icon: '💳',
  supportsAutomation: true,
};

/**
 * NH Card Automation Configuration
 */
const NH_CARD_CONFIG = {
  // Bank information
  bank: NH_CARD_INFO,

  // Main URL
  targetUrl: 'https://card.nonghyup.com/servlet/IpCo9151I.act',

  // Chrome settings
  headless: false,
  chromeProfile: 'Default',

  // XPath selectors (from Playwright test analysis)
  xpaths: {
    // Login elements (from script lines 50-57)
    idInput: '//input[@id="loginUserId"]',
    passwordInput: '//input[@id="loginUserPwd"]',
    // Original test: .btn_login > span:nth-child(1)
    loginButton: '//*[contains(@class, "btn_login")]//span[1]',

    // Banner/popup controls (from script lines 59-64)
    // These are optional popups - may not always appear
    bannerStopButton: '//button[contains(text(), "배너 자동롤링 멈춤")]',
    bannerStartButton: '//button[contains(text(), "배너 자동롤링 시작")]',
    popupClose200: '//button[@id="btnPopClose_200"]',
    // Original test: .pop_wrap > div:nth-child(2)
    popupWrapper: '//div[contains(@class, "pop_wrap")]/div[2]',
    // Original test uses nth(4) - this will be handled in code
    popupCloseButton: '//button[contains(text(), "현재 창 닫기")]',

    // Navigation (from script lines 67-69)
    // Original test: a:has-text("마이") >> nth=0 - we'll use first() in code
    myMenuLink: '//a[contains(text(), "마이")]',
    // Original test: a > span:nth-child(1) - too generic, using more specific selector
    transactionHistoryLink: '//div[@id="new_gnb"]//a[contains(., "카드이용내역")]//span | //a[contains(., "카드이용내역")]//span[1]',

    // Card selection (from script lines 71-76)
    cardDropdown: '//select[@id="CrdNbr"]',

    // Date selectors (from script lines 78-101)
    startYearSelect: '//select[@id="start_year"]',
    startMonthSelect: '//select[@id="start_month"]',
    startDaySelect: '//select[@id="start_date"]',
    endYearSelect: '//select[@id="end_year"]',
    endMonthSelect: '//select[@id="end_month"]',
    endDaySelect: '//select[@id="end_date"]',

    // Search controls (from script lines 103-115)
    searchButton: '/html/body/div[1]/div[2]/div/form/div/span/a',
    // "다음 내역" (Next History) button - expands list to show more transactions
    loadMoreButton: '/html/body/div[1]/div[2]/div/div[4]/div[1]/div[4]/div/span/a',

    // Data tables (from script lines 122-241)
    cardSelectorTable: '/html/body/div/div[2]/div/form/table',
    summaryTable: '/html/body/div/div[2]/div/div[4]/div/table',
    transactionTable: '/html/body/div[1]/div[2]/div/div[4]/div[1]/div[3]/table',

    // Session management
    // Element: <a href="javascript:continueSession();" id="headerContinued"><span>연장</span></a>
    extendSessionButton: '//a[@id="headerContinued"] | //a[contains(@href, "continueSession")] | //a[contains(@class, "time") and .//span[contains(text(), "연장")]]',
  },

  // Timing configurations
  timeouts: {
    pageLoad: 30000,
    click: 10000,
    type: 5000,
    waitForSelector: 10000,
    elementWait: 10000,
    scrollWait: 500,
  },

  delays: {
    betweenActions: 1000,
    afterLogin: 2345,
    afterPopup: 3000,
    afterNavigation: 3000,
    afterDateSelect: 1200,
    afterCardSelect: 2312,
    afterSearch: 3000,
    afterLoadMore: 3000,
  },

  // NH Card does not use virtual keyboard for passwords
  useWindowsKeyboard: false,  // NH Card uses regular input fields
  windowsInputMethod: 'fill', // Use standard fill method
};

module.exports = {
  NH_CARD_INFO,
  NH_CARD_CONFIG,
};
