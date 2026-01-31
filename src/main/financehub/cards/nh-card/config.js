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
  loginUrl: 'https://nhbizcard.nonghyup.com/iccn0000i.act',
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
  targetUrl: 'https://nhbizcard.nonghyup.com/iccn0000i.act',

  // Chrome settings
  headless: false,
  chromeProfile: 'Default',

  // XPath selectors (from recorded browser actions)
  xpaths: {
    // Login elements
    loginLink: {
      css: 'a:has-text("로그인")',
      xpath: '//*[@id="wrapper"]/header[1]/div[1]/div[1]/div[2]/ul[1]/li[1]/a[1]'
    },
    loginTabFirst: {
      css: 'ul > li:nth-child(1)',
      xpath: '//*[@id="signForm"]/div[1]/div[2]/div[6]/div[1]/ul[1]/li[1]'
    },
    loginTabSpan: {
      css: 'a > span:nth-child(2)',
      xpath: '/html/body/div[3]/div[3]/form/div[2]/div[2]/div[6]/div/ul/li[1]/a/span'
    },
    idInput: {
      css: '[id="usrid"]',
      xpath: '//*[@id="usrid"]'
    },
    passwordInput: {
      css: '[id="io_pw30"]',
      xpath: '//*[@id="io_pw30"]'
    },
    loginButton: {
      css: 'button:has-text("로그인") >> nth=0',
      xpath: '//*[@id="login-form_1"]/button[1]'
    },

    // Card Management Navigation (카드신청/관리 → 카드발급내역)
    cardManagementMenu: {
      css: 'body > div:nth-child(2) > header > div:nth-child(3) > nav > ul > li:nth-child(2) > a',
      xpath: '/html/body/div[2]/header/div[3]/nav/ul[1]/li[2]/a'
    },
    cardIssuanceHistoryLink: {
      css: 'a:has-text("카드발급내역") >> nth=0',
      xpath: '//*[@id="gnb"]/ul[1]/li[2]/div[1]/div[2]/ul[1]/li[5]/ul[1]/li[4]/a[1]'
    },

    // Transaction Navigation (조회/결제 → 승인내역)
    inquiryPaymentMenu: {
      css: 'a:has-text("조회/결제")',
      xpath: '//*[@id="gnb"]/ul[1]/li[1]/a[1]'
    },
    approvalHistoryLink: {
      css: 'a:has-text("승인내역") >> nth=0',
      xpath: '//*[@id="gnb"]/ul[1]/li[1]/div[1]/div[2]/ul[1]/li[2]/ul[1]/li[2]/a[1]'
    },

    // Search controls
    searchGubunRadio: {
      css: '[id="rdoSchGubun2"]',
      xpath: '/html/body/div[3]/div[3]/div[1]/form/section/div[2]/div[2]/ul/li[2]/input'
    },
    cardSearchButton: {
      css: '[id="btnSubmit"] > span:nth-child(1)',
      xpath: '/html/body/div[3]/div[3]/div[1]/form/section/div[3]/button'
    },
    transactionSearchButton: {
      css: '.btn-primary > span:nth-child(1)',
      xpath: '//*[@id="form01"]/div[5]/button[1]/span[1]'
    },
    loadMoreButton: {
      css: 'button:has-text("더보기")',
      xpath: '//*[@id="formResult"]/div[2]/div[1]/div[2]/button[1]'
    },

    // Data tables
    cardResultTable: {
      css: '[id="resultTable"]',
      xpath: '//*[@id="resultTable"]'
    },
    transactionTable: {
      css: 'div.table-wrap > div.nh-table-wrapper > table.table',
      xpath: '/html/body/div[3]/div[3]/div[2]/section/div[3]/div[2]/table'
    },
    summaryTable: {
      css: 'section.result-wrap > div.table-area > table.customer-list',
      xpath: '/html/body/div[3]/div[3]/div[2]/section/div[2]/table'
    },

    // Session management
    extendSessionButton: '//a[@id="headerContinued"] | //a[contains(@href, "continueSession")]',
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
