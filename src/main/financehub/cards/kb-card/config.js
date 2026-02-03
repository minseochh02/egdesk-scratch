// ============================================================================
// KB CARD CONFIGURATION
// ============================================================================

const KB_CARD_INFO = {
  id: 'kb-card',
  name: 'KB Card',
  nameKo: 'KB국민카드',
  loginUrl: 'https://biz.kbcard.com/CXORMPIC0001.cms',
  category: 'major',
  color: '#FFBC00',
  icon: '💳',
  supportsAutomation: true,
};

const KB_CARD_XPATHS = {
  // Login elements
  loginTypeRadio: {
    css: '[id="loginGubun02"]',
    xpath: '//*[@id="loginGubun02"]'
  },
  idInput: {
    css: '[id="기업인터넷서비스로그인ID"]',
    xpath: '/html/body/div[1]/div[3]/div[1]/div[2]/form[2]/div[3]/div[1]/div[1]/div/div[1]/input'
  },
  passwordInput: {
    css: '[id="loginPwdBiz"]',
    xpath: '/html/body/div[1]/div[3]/div[1]/div[2]/form[2]/div[3]/div[1]/div[1]/div/div[2]/input[1]'
  },
  loginButton: {
    css: '[id="doBizIdLogin"]',
    xpath: '//*[@id="doBizIdLogin"]'
  },

  // Card inquiry
  cardOwnershipLink: {
    css: 'a:has-text("보유카드조회")',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[1]/div[2]/div[1]/a[2]'
  },
  cardSearchButton: {
    css: 'button:has-text("조회")',
    xpath: '//*[@id="searchForm"]/div[1]/div[2]/button[1]'
  },

  // Transaction inquiry
  approvalHistoryButton: {
    css: 'button:has-text("승인내역조회")',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/dl[2]/dd[4]/button[1]'
  },
  startDateInput: {
    css: '[id="조회시작일"]',
    xpath: '//*[@id="조회시작일"]'
  },
  endDateInput: {
    css: '[id="조회종료일"]',
    xpath: '//*[@id="조회종료일"]'
  },
  transactionSearchButton: {
    css: 'button:has-text("조회") >> nth=1',
    xpath: '//*[@id="searchForm"]/div[1]/button[1]'
  },

  // Data tables
  cardTable: {
    css: 'div.wideTblarea > div.tblArea > table.tblH',
    xpath: '/html/body/div/div[3]/div/div[2]/div/div/div[3]/table'
  },
  transactionTable: {
    css: '[id="dtailTable"]',
    xpath: '//*[@id="dtailTable"]'
  },

  // Session management
  extendSessionButton: '//a[@id="sessionExtend"] | //a[contains(@href, "extendSession")]',
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
  betweenActions: 1000,
  afterLogin: 3000,
  afterNavigation: 3000,
  afterSearch: 3000,
  afterPageLoad: 3000,
};

const KB_CARD_CONFIG = {
  card: KB_CARD_INFO,
  targetUrl: 'https://biz.kbcard.com/CXORMPIC0001.cms',
  undesiredHostnames: [],
  headless: false,
  chromeProfile: null,
  disableCache: true,
  xpaths: KB_CARD_XPATHS,
  timeouts: KB_CARD_TIMEOUTS,
  delays: KB_CARD_DELAYS,
  useWindowsKeyboard: false,
  windowsInputMethod: 'fill',
  useEnhancedIdInput: false,
  debug: false,
};

module.exports = {
  KB_CARD_INFO,
  KB_CARD_XPATHS,
  KB_CARD_TIMEOUTS,
  KB_CARD_DELAYS,
  KB_CARD_CONFIG,
};
