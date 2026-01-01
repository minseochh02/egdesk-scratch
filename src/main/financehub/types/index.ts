// ============================================================================
// FINANCE HUB - TYPE DEFINITIONS
// ============================================================================

import { Page, BrowserContext } from 'playwright';

// ============================================================================
// BANK CONFIGURATION TYPES
// ============================================================================

export interface BankConfig {
  id: string;
  name: string;
  nameKo: string;
  loginUrl: string;
  category: 'major' | 'regional' | 'special' | 'internet';
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

export interface BankCredentials {
  userId: string;
  password: string;
}

export interface BankXPaths {
  idInput: string;
  passwordInput: string;
  loginButton: string;
  keyboardLower?: string;
  keyboardLowerAlt?: string;
  keyboardLowerClass?: string;
  keyboardUpper?: string;
  keyboardUpperAlt?: string;
  keyboardUpperClass?: string;
  securityPopup?: string;
  securityPopupClose?: string;
  securityPopupAlt?: string;
  securityPopupCloseAlt?: string;
  
  // Transaction history XPaths
  accountSelector?: string;
  accountSelectorContainer?: string;
  accountSelectorAlt?: string;
  startDateInput?: string;
  startDateInputAlt?: string;
  startDateInputTitle?: string;
  endDateInput?: string;
  endDateInputAlt?: string;
  endDateInputTitle?: string;
  historyInquiryButton?: string;
  historyInquiryButtonAlt?: string;
  historyInquiryButtonClass?: string;
  fileSaveButton?: string;
  fileSaveButtonAlt?: string;
  fileSaveButtonText?: string;
  selectAllCheckbox?: string;
  selectAllCheckboxAlt?: string;
  selectAllCheckboxClass?: string;
  excelSaveButton?: string;
  excelSaveButtonAlt?: string;
  excelSaveButtonClass?: string;
  transactionTable?: string;
  transactionTableAlt?: string;
  transactionRow?: string;
  downloadDialog?: string;
  downloadCloseButton?: string;
}

export interface BankTimeouts {
  elementWait: number;
  click: number;
  frameSearch: number;
  passwordWait: number;
  pageLoad: number;
  scrollWait: number;
  downloadWait?: number;
  transactionLoad?: number;
}

export interface BankDelays {
  mouseMove: number;
  click: number;
  shiftActivate: number;
  shiftDeactivate: number;
  keyboardUpdate: number;
  keyboardReturn: number;
  betweenAccounts?: number;
  afterInquiry?: number;
}

export interface BankAutomationConfig {
  bank: BankConfig;
  targetUrl: string;
  undesiredHostnames: string[];
  headless: boolean;
  chromeProfile: string | null;
  xpaths: BankXPaths;
  timeouts: BankTimeouts;
  delays: BankDelays;
}

// ============================================================================
// KEYBOARD TYPES
// ============================================================================

export interface KeyPosition {
  x: number;
  y: number;
}

export interface KeyBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyboardKey {
  normalized: NormalizedBounds;
  position: KeyPosition;
  bounds: KeyBounds;
  label: string;
  mask?: string;
  aiBox: [number, number, number, number];
}

export interface KeyboardKeys {
  [keyLabel: string]: KeyboardKey;
}

export interface CharacterMapEntry {
  character: string;
  keyId: string;
  label: string;
  position: KeyPosition;
  requiresShift: boolean;
  type: 'english' | 'korean' | 'special';
}

export interface CharacterMap {
  [char: string]: CharacterMapEntry;
}

export interface ShiftKeyInfo {
  keyId: string;
  label: string;
  position: KeyPosition;
  bounds: KeyBounds;
}

export interface KeyboardJSON {
  metadata: {
    totalKeys: number;
    timestamp: string;
    languages: string[];
    hasShiftedLayout: boolean;
    englishKeys: number;
    koreanKeys: number;
    specialKeys: number;
    shiftRequiredKeys: number;
  };
  keys: Array<{
    id: string;
    label: string;
    position: KeyPosition;
    bounds: KeyBounds;
    normalized: NormalizedBounds;
    characters: {
      english: string[];
      korean: string[];
      special: string[];
    };
  }>;
  characterMap: CharacterMap;
  shiftKey: ShiftKeyInfo | null;
}

// ============================================================================
// AI ANALYSIS TYPES
// ============================================================================

export interface SegmentationMask {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  mask: string; // Base64 encoded mask
  label: string;
}

export interface KeyboardAnalysisResult {
  success: boolean;
  processed?: number;
  keyboardKeys?: KeyboardKeys;
  segmentationResults?: SegmentationMask[];
  shiftedKeyboard?: ShiftedKeyboardResult | null;
  error?: string;
}

export interface ShiftedKeyboardResult {
  success: boolean;
  screenshotPath: string | null;
  shiftKey?: {
    position: KeyPosition;
    bounds: KeyBounds;
    label: string;
  };
  error?: string;
}

// ============================================================================
// TYPING RESULT TYPES
// ============================================================================

export interface FailedChar {
  index: number;
  char: string;
  reason: string;
}

export interface TypedCharDetail {
  index: number;
  char: string;
  success: boolean;
  position?: KeyPosition;
  keyLabel?: string;
  type?: string;
  usedShift?: boolean;
  reason?: string;
}

export interface TypingResult {
  success: boolean;
  totalChars: number;
  typedChars: number;
  failedChars: FailedChar[];
  shiftClicks: number;
  details: TypedCharDetail[];
  error?: string;
}

// ============================================================================
// AUTOMATION RESULT TYPES
// ============================================================================

export interface AutomationResult {
  success: boolean;
  isLoggedIn?: boolean;
  userName?: string | null;
  error?: string;
  lowerScreenshotPath?: string | null;
  upperScreenshotPath?: string | null;
  keyboardAnalysis?: {
    success: boolean;
    lowerKeyboard?: KeyboardAnalysisResult;
    upperKeyboard?: KeyboardAnalysisResult | null;
    typingResult?: TypingResult;
  } | null;
}

// ============================================================================
// BROWSER TYPES
// ============================================================================

export interface BrowserSetupResult {
  browser: BrowserContext;
  context: BrowserContext;
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

// ============================================================================
// TRANSACTION HISTORY TYPES
// ============================================================================

export interface TransactionHistoryOptions {
  /** Number of years to go back (default: 10) */
  yearsBack?: number;
  /** Index of account to query (default: 0 for first) */
  accountIndex?: number;
  /** Custom output path for the Excel file */
  outputPath?: string | null;
}

export interface TransactionHistoryResult {
  success: boolean;
  /** Path to the downloaded Excel file */
  filePath?: string | null;
  /** Date range for the query */
  dateRange?: {
    from: string;
    to: string;
  };
  /** Number of years queried */
  yearsBack?: number;
  /** Account index that was queried */
  accountIndex?: number;
  /** Error message if failed */
  error?: string;
}

export interface AllTransactionHistoryResult {
  success: boolean;
  /** Total number of accounts found */
  totalAccounts?: number;
  /** Number of successful downloads */
  successfulDownloads?: number;
  /** Results for each account */
  results?: Array<TransactionHistoryResult & {
    accountNumber: string;
    accountName: string;
  }>;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// BANK AUTOMATOR INTERFACE
// ============================================================================

export interface IBankAutomator {
  readonly config: BankAutomationConfig;
  
  // Main automation method
  login(credentials: BankCredentials, proxyUrl?: string): Promise<AutomationResult>;
  
  // Optional methods that banks can override
  handleSecurityPopup?(page: Page): Promise<boolean>;
  handleVirtualKeyboard?(page: Page, password: string): Promise<TypingResult>;
  
  // Account methods
  getAccounts?(): Promise<AccountInfo[]>;
  
  // Transaction history methods
  getTransactionHistory?(options?: TransactionHistoryOptions): Promise<TransactionHistoryResult>;
  getAllTransactionHistory?(options?: TransactionHistoryOptions): Promise<AllTransactionHistoryResult>;
}

// ============================================================================
// TRANSACTION TYPES (for future use)
// ============================================================================

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  balance: number;
  bankId: string;
  category?: string;
  memo?: string;
}

export interface AccountInfo {
  accountNumber: string;
  accountName: string;
  bankId: string;
  balance: number;
  currency: string;
  lastUpdated: Date | string;
}

export interface ConnectedBank {
  bankId: string;
  accountNumber?: string;
  alias?: string;
  lastSync?: Date;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  accounts?: AccountInfo[];
}