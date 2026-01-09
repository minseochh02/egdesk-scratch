// ============================================================================
// NH BANK CONFIGURATION
// ============================================================================

/**
 * NH Bank Information
 */
const NH_BANK_INFO = {
  id: 'nh',
  name: 'NH Bank',
  nameKo: 'NH농협은행',
  loginUrl: 'https://banking.nonghyup.com/servlet/IPAIP0011R.view',
  category: 'special',
  color: '#00B140',
  icon: '🌾',
  supportsAutomation: true,
};

/**
 * NH Bank Automation Configuration
 */
const NH_CONFIG = {
  // Bank information
  bank: NH_BANK_INFO,
  
  // Main URL
  targetUrl: 'https://banking.nonghyup.com/servlet/IPAIP0011R.view',
  
  // Chrome settings
  headless: false,
  chromeProfile: 'Default',
  
  // XPath selectors
  xpaths: {
    // Login page elements
    loginUrl: 'https://banking.nonghyup.com/servlet/IPAIP0011R.view',
    idInput: '//input[@id="loginUserId"]',
    passwordInput: '//input[@id="loginUserPwd"]',
    loginButton: '/html/body/div[8]/div[2]/form/div[2]/div[1]/div[2]/div[3]/div/div[1]/a',
    
    // Virtual keyboard
    lowerKeyboardButton: '//img[@id="imgTwinLower"]',
    upperKeyboardButton: '//img[@id="imgTwinUpper"]',
    lowerKeyboard: '/html/body/div[8]/div[2]/form/div[2]/div[1]/div[2]/div[3]/div/div[1]/div[2]/div/div/div[1]/img',
    upperKeyboard: '/html/body/div[8]/div[2]/form/div[2]/div[1]/div[2]/div[3]/div/div[1]/div[2]/div/div/div[2]/img',
    virtualKeyboardContainer: '/html/body/div[8]/div[2]/form/div[2]/div[1]/div[2]/div[3]/div/div[1]/div[2]/div/div',
    
    // Post-login navigation
    eNonghyupMemberText: '//p[@class="tit" and contains(., "e농협회원(ID/PW방식)")]',
    eNonghyupContinueButton: '/html/body/div[8]/div[2]/div/div[2]/div/div/a',
    menuButton: '/html/body/div[8]/div[2]/div[2]/div[3]/div[2]/div[1]/div[2]/div[3]/div/div/table/tbody/tr/td[5]/span[1]/button',
    transactionMenuItem: '/html/body/div[8]/div[2]/div[2]/div[3]/div[2]/div[1]/div[2]/div[3]/div/div/table/tbody/tr/td[5]/div[1]/ul/li[2]/a',
    
    // Account inquiry page
    inquiryUrl: 'https://banking.nonghyup.com/servlet/IPAIP0071I.view',
    accountDropdown: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[1]/td/span[1]/select',
    // Date selectors - NH uses dropdown selects for dates
    startYearSelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[1]/select[1]',
    startMonthSelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[1]/select[2]',
    startDaySelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[1]/select[3]',
    endYearSelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[2]/select[1]',
    endMonthSelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[2]/select[2]',
    endDaySelect: '/html/body/div[8]/div[2]/div[2]/form/table/tbody/tr[2]/td/span[2]/select[3]',
    // Quick date buttons
    dateButton1Month: '//button[@id="dat_30"]',
    dateButton3Months: '//button[@id="dat_90"]',
    dateButton1Year: '//button[@id="dat_365"]',
    inquiryButton: '/html/body/div[8]/div[2]/div[2]/form/div[2]/span/a',
    
    // Session management
    extendSessionButton: '//a[contains(@href, "continueLogin") and .//span[contains(text(), "연장")]] | //button[contains(text(), "연장")]',
    
    // User profile (for login verification)
    userProfileGroup: '//div[@id="header_logout"]',
    userNameText: '//div[@id="header_logout"]//em[@class="name"]',
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
    betweenActions: 500,
    mouseMove: 300,
    keyPress: 200,
    keyboardUpdate: 1000,
  },
};

module.exports = {
  NH_BANK_INFO,
  NH_CONFIG,
};