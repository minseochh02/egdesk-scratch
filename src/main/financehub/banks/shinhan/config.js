// ============================================================================
// SHINHAN BANK CONFIGURATION
// ============================================================================

/**
 * @type {import('../../types').BankConfig}
 */
const SHINHAN_BANK_INFO = {
  id: 'shinhan',
  name: 'Shinhan Bank',
  nameKo: '신한은행',
  loginUrl: 'https://bank.shinhan.com/?cr=252400000000',
  category: 'major',
  color: '#0046FF',
  icon: '🏦',
  supportsAutomation: true,
};

/**
 * @type {import('../../types').BankXPaths}
 */
const SHINHAN_XPATHS = {
  // Login form inputs
  idInput: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[5]/div[3]/div[3]/div[1]/div/input',
  passwordInput: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[5]/div[3]/div[3]/div[1]/div/div/input[1]',
  loginButton: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[5]/div[3]/div[3]/div[1]/div/a',
  
  // Virtual keyboard - LOWER (default state, lowercase)
  keyboardLower: '//div[@id="비밀번호_layoutLower"]',
  keyboardLowerAlt: '//div[contains(@id, "_layoutLower") and contains(@class, "transkey_lower")]',
  keyboardLowerClass: '//div[contains(@class, "transkey_lower")]',
  
  // Virtual keyboard - UPPER (shifted state, uppercase)
  keyboardUpper: '//div[@id="비밀번호_layoutUpper"]',
  keyboardUpperAlt: '//div[contains(@id, "_layoutUpper") and contains(@class, "transkey_upper")]',
  keyboardUpperClass: '//div[contains(@class, "transkey_upper")]',
  
  // Security popup
  securityPopup: '//div[@id="wq_uuid_28" and contains(@class, "layerContent")]',
  securityPopupClose: '//a[@id="no_install" and contains(@class, "btnTyGray02")]',
  securityPopupAlt: '//div[contains(@class, "layerContent") and contains(., "보안프로그램")]',
  securityPopupCloseAlt: '//a[contains(text(), "설치하지 않음")]',
  
  // Login status indicators
  userProfileGroup: '//div[@id="grp_user" and contains(@class, "user")]',
  userNameText: '//strong[@id="txt_name"]',
  
  // Login warning popups
  idLoginConfirm: '//a[@id="btn_alertLayer_yes" and contains(text(), "확인")]',
  
  // Session management
  timerGroup: '//div[@id="grp_timer" and contains(@class, "time")]',
  extendSessionButton: '//div[@id="grp_timer"]//a[contains(text(), "연장")]',

  // Transaction inquiry
  inquiryUrl: 'https://bank.shinhan.com/index.jsp#010101100010',
  inquiryButton: '//*[@id="btn_inquiry"]',
  accountDropdown: '//*[@id="sbx_accno_input_0"]',
  startDateInput: '//*[@id="wfr_searchCalendar_ica_fr_input"]',
  fileSaveButton: '//a[@id="wfr_grd_inq_btngrp_div_btn_downFile"]',
  popupIframePattern: 'CO00012RP',
  selectAllCheckboxPattern: 'cbx_columnAll_input',
  excelSaveButtonPattern: 'btn_saveXls',
  accountRow: '//div[contains(@class, "account_info")]', // This is a guess, I'll need to refine this based on the provided text
  accountList: '//ul[contains(@class, "account_list")]',
};

/**
 * @type {import('../../types').BankTimeouts}
 */
const SHINHAN_TIMEOUTS = {
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
const SHINHAN_DELAYS = {
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
const SHINHAN_CONFIG = {
  bank: SHINHAN_BANK_INFO,
  targetUrl: 'https://www.shinhan.com/hpe/index.jsp#252400000000',
  undesiredHostnames: ['wooribank.com', 'www.wooribank.com'],
  headless: false,
  chromeProfile: null,
  xpaths: SHINHAN_XPATHS,
  timeouts: SHINHAN_TIMEOUTS,
  delays: SHINHAN_DELAYS,
};

module.exports = {
  SHINHAN_BANK_INFO,
  SHINHAN_XPATHS,
  SHINHAN_TIMEOUTS,
  SHINHAN_DELAYS,
  SHINHAN_CONFIG,
};
