const SHINHAN_CARD_INFO = {
  id: 'shinhan-card',
  name: 'Shinhan Card',
  nameKo: '신한카드',
  loginUrl: 'https://www.shinhancard.com/cconts/html/main.html',
  supportsAutomation: true,
  requiresExcelDownload: true,
};

const SHINHAN_CARD_XPATHS = {
  // Login Section
  idInput: {
    css: '[id="memid"]',
    xpath: '//*[@id="memid"]',
  },
  passwordInput: {
    css: '[id="pwd"]',
    xpath: '//*[@id="pwd"]',
  },
  loginButton: {
    css: '[id="loginC"]',
    xpath: '//*[@id="loginC"]',
  },

  // Card Discovery Section
  myCardsLink: {
    css: 'a:has-text("보유카드")',
    xpath: '//*[@id="contents"]/div[2]/div[1]/div[1]/div[2]/div[2]/h3[1]/a[1]',
  },
  searchTargetRadio: {
    css: 'label > span:nth-child(2)',
    xpath: '//*[@id="searchOpt1"]/ol[1]/li[1]/div[1]/label[2]/span[1]',
  },
  searchTargetInput: {
    css: '[name="searchTarget"]',
    xpath: '//*[@id="searchOpt1"]/ol[1]/li[1]/div[1]/label[2]/input[1]',
  },
  cardSearchButton: {
    css: 'a:has-text("조회")',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[2]/a[1]',
  },
  cardListContainer: {
    css: '#CRP21120PH01_detail_list',
    xpath: '//*[@id="CRP21120PH01_detail_list"]',
  },

  // Transaction Navigation Section
  sitemapButton: {
    css: 'button:has-text("사이트맵 열기")',
    xpath: '//*[@id="header"]/div[2]/div[1]/div[1]/div[2]/button[2]',
  },
  transactionHistoryLink: {
    css: 'a:has-text("이용내역조회")',
    xpath: '//*[@id="site_menu1"]/div[1]/ol[1]/li[2]/ul[1]/li[1]/a[1]',
  },
  datepickerCloseButton: {
    css: 'button:has-text("닫기")',
    xpath: '//*[@id="ui-datepicker-div"]/div[2]/button[2]',
  },

  // Search Criteria Section
  listRadioLabel: {
    css: 'label > span:nth-child(2)',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[1]/label[1]/span[1]',
  },
  listRadioInput: {
    css: 'label:nth-child(1) > input[name="listRadio1"]',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[1]/label[1]/input[1]',
  },
  searchGubunLabel: {
    css: 'label > span:nth-child(2)',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[2]/form[1]/div[4]/div[1]/ul[1]/li[1]/div[1]/div[1]/label[1]/span[1]',
  },
  searchGubunInput: {
    css: 'label:nth-child(1) > input[name="searchGubun"]',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[2]/form[1]/div[4]/div[1]/ul[1]/li[1]/div[1]/div[1]/label[1]/input[1]',
  },
  searchAreaLabel: {
    css: 'label > span:nth-child(2)',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[2]/form[1]/div[4]/div[1]/ul[1]/li[4]/div[1]/div[1]/label[1]/span[1]',
  },
  searchAreaInput: {
    css: 'label:nth-child(1) > input[name="searchArea"]',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[2]/form[1]/div[4]/div[1]/ul[1]/li[4]/div[1]/div[1]/label[1]/input[1]',
  },
  searchPeriodInput: {
    css: '[name="searchPeriod"]',
    xpath: '//input[@name="searchPeriod"]',
  },
  termDropdown: {
    css: '[id="selTerm"]',
    xpath: '//*[@id="selTerm"]',
  },
  startDateInput: {
    css: '[id="joStIl"]',
    xpath: '//*[@id="joStIl"]',
  },
  endDateInput: {
    css: '[id="joEdIl"]',
    xpath: '//*[@id="joEdIl"]',
  },
  searchButton: {
    css: '.button > span:nth-child(1)',
    xpath: '//*[@id="contents"]/div[1]/div[2]/div[2]/div[3]/a[1]/span[1]',
  },
  downloadButton: {
    css: '.button > span:nth-child(1)',
    xpath: '//*[@id="contents"]/div[1]/div[4]/div[1]/div[1]/button[1]/span[1]',
  },
  downloadConfirmButton: {
    css: 'button:has-text("예")',
    xpath: '//*[@id="pop_confirm"]/article[1]/div[1]/div[2]/button[2]',
  },
};

const SHINHAN_CARD_TIMEOUTS = {
  pageLoad: 30000,
  elementWait: 10000,
  downloadWait: 60000,
  navigationWait: 15000,
};

const SHINHAN_CARD_DELAYS = {
  afterLogin: 3000,
  afterNavigation: 3000,
  afterSearch: 3000,
  betweenActions: 1000,
  afterDownload: 3000,
};

const SHINHAN_CARD_CONFIG = {
  xpaths: SHINHAN_CARD_XPATHS,
  timeouts: SHINHAN_CARD_TIMEOUTS,
  delays: SHINHAN_CARD_DELAYS,
};

module.exports = {
  SHINHAN_CARD_INFO,
  SHINHAN_CARD_XPATHS,
  SHINHAN_CARD_TIMEOUTS,
  SHINHAN_CARD_DELAYS,
  SHINHAN_CARD_CONFIG,
};
