/**
 * BC Card Configuration
 *
 * Configuration for BC Card (wisebiz.bccard.com) automation
 * Based on bccard.spec.js test recording
 */

// BC Card metadata and base configuration
const BC_CARD_INFO = {
  id: 'bc-card',
  name: 'BC Card',
  nameKo: 'BC카드',
  loginUrl: 'https://wisebiz.bccard.com/app/corp/Intro.corp',
  supportsAutomation: true,
  requiresExcelDownload: true, // Key difference from other card automators
};

// XPath and CSS selectors from bccard.spec.js
const BC_CARD_XPATHS = {
  // Login selectors (lines 180-212)
  loginLink: {
    css: 'a:has-text("로그인") >> nth=0',
    xpath: '//*[@id="header"]/div[1]/div[2]/div[2]/ul[1]/li[1]/a[1]',
  },
  idInput: {
    css: '[id="loginId"]',
    xpath: '//*[@id="loginId"]',
  },
  passwordInput: {
    css: '[id="loginPw"]',
    xpath: '//*[@id="loginPw"]',
  },
  loginButton: {
    css: 'a:has-text("로그인") >> nth=5',
    xpath: '//*[@id="form1"]/fieldset[1]/div[1]/div[2]/a[1]',
  },

  // Navigation selectors (lines 216-228)
  cardUsageMenu: {
    css: 'a:has-text("카드이용조회")',
    xpath: '//*[@id="gnbNavi"]/div[1]/ul[1]/li[1]/span[1]/a[1]',
  },
  approvalHistorySubmenu: {
    css: 'a:has-text("승인내역조회") >> nth=0',
    xpath: '//*[@id="gnbNavi"]/div[1]/ul[1]/li[1]/div[1]/ul[1]/li[2]/a[1]',
  },

  // Search criteria selectors
  periodSpecificationLabel: {
    css: '#cardUseSearch > div.inputTable > fieldset > table > tbody > tr.notDayRefs > td > span:nth-child(5) > label',
    xpath: '/html/body/div[3]/div[2]/div/div/div[2]/div[2]/div[3]/div[1]/fieldset/table/tbody/tr[6]/td/span[5]/label',
  },
  fromDateInput: {
    css: '[id="fromDate"]',
    xpath: '/html/body/div[3]/div[2]/div/div/div[2]/div[2]/div[3]/div[1]/fieldset/table/tbody/tr[6]/td/div/input[1]',
  },
  toDateInput: {
    css: '[id="toDate"]',
    xpath: '/html/body/div[3]/div[2]/div/div/div[2]/div[2]/div[3]/div[1]/fieldset/table/tbody/tr[6]/td/div/input[2]',
  },
  searchButton: {
    css: 'a:has-text("조회") >> nth=21',
    xpath: '/html/body/div[3]/div[2]/div/div/div[2]/div[2]/div[3]/div[2]/a',
  },

  // Download selector (lines 331-335)
  excelDownloadButton: {
    css: '.btnIconType > span:nth-child(1)',
    xpath: '//*[@id="btnDown"]/a[1]/span[1]',
  },

  // Transaction table (line 308)
  transactionTable: {
    css: 'div > canvas > table',
    xpath: '/html/body/div[3]/div[2]/div/div/div[2]/div[2]/div[3]/div[5]/div/div[2]/canvas/table',
  },

  // Popup selectors (defensive - may not exist)
  popupClose: [
    '//button[contains(@class, "close")]',
    '//a[text()="닫기"]',
    '//button[text()="닫기"]',
    '//div[@class="popup"]//button',
  ],
};

// Timeouts for various operations
const BC_CARD_TIMEOUTS = {
  pageLoad: 60000,
  elementWait: 20000,
  downloadWait: 120000,
  navigationWait: 30000,
};

// Delays between actions (from test recording)
const BC_CARD_DELAYS = {
  afterLogin: 5000,        // Line 185, 213
  afterMenuClick: 3000,    // Between menu navigation
  afterNavigation: 5000,   // Lines 221, 228
  afterSearch: 5000,       // Line 252
  afterDownload: 5000,     // Line 326
  betweenActions: 2000,    // General delay between actions
};

// Transaction table column mapping (actual BC Card Excel format - 16 columns)
const BC_CARD_COLUMNS = {
  headquartersName: '본부명',
  departmentName: '부서명',
  cardNumber: '카드번호',
  cardType: '카드구분',
  cardHolder: '카드소지자',
  transactionBank: '거래은행',
  usageType: '사용구분',
  salesType: '매출종류',
  installmentPeriod: '할부기간',
  approvalDate: '승인일자',
  approvalTime: '승인시간',
  approvalNumber: '승인번호',
  merchantName: '가맹점명/국가명',
  approvalAmount: '승인금액',
  exchangeRate: '환율',
  foreignAmountKRW: '해외승인원화금액',
};

// Full configuration object
const BC_CARD_CONFIG = {
  ...BC_CARD_INFO,
  xpaths: BC_CARD_XPATHS,
  timeouts: BC_CARD_TIMEOUTS,
  delays: BC_CARD_DELAYS,
  columns: BC_CARD_COLUMNS,
};

module.exports = {
  BC_CARD_INFO,
  BC_CARD_XPATHS,
  BC_CARD_TIMEOUTS,
  BC_CARD_DELAYS,
  BC_CARD_COLUMNS,
  BC_CARD_CONFIG,
};
