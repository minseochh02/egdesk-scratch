// ============================================
// Finance Hub - Shared Types
// ============================================

// ============================================
// Bank Types
// ============================================

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

// ============================================
// Card Company Types
// ============================================

export interface CardConfig {
  id: string;
  name: string;
  nameKo: string;
  loginUrl: string;
  category: 'major' | 'telecom' | 'internet';
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

export interface CardInfo {
  cardNumber: string; // masked, e.g., "1234-****-****-5678"
  cardName: string;
  cardCompanyId: string;
  cardType?: 'credit' | 'debit' | 'check';
  balance?: number; // outstanding balance
  availableCredit?: number;
  lastUpdated?: string;
}

export interface ConnectedCard {
  cardCompanyId: string;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  alias?: string;
  lastSync?: Date;
  cards?: CardInfo[];
  accountType?: 'personal' | 'corporate';
}

export interface BankInfo {
  id: string;
  name: string;
  nameKo: string;
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

// ============================================
// Account Types
// ============================================

export interface AccountInfo {
  accountNumber: string;
  accountName: string;
  bankId: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface BankAccount {
  id: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
  customerName: string;
  balance: number;
  availableBalance: number;
  currency: string;
  accountType: string;
  openDate: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any> | null;
}

export interface ConnectedBank {
  bankId: string;
  accountNumber?: string;
  alias?: string;
  lastSync?: Date;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  accounts?: AccountInfo[];
  accountType?: 'personal' | 'corporate'; // 개인 or 법인
}

// ============================================
// Transaction Types
// ============================================

export interface Transaction {
  id: string;
  accountId: string;
  bankId: string;
  date: string;
  time: string | null;
  type: string | null;
  category: string | null;
  description: string | null;
  memo: string | null;
  withdrawal: number;
  deposit: number;
  balance: number;
  branch: string | null;
  counterparty: string | null;
  transactionId: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
}

export interface TransactionStats {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  netChange: number;
}

export interface MonthlySummary {
  yearMonth: string;
  depositCount: number;
  withdrawalCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netChange: number;
}

// ============================================
// Filter & Pagination Types
// ============================================

export interface TransactionFilters {
  bankId: string;
  accountId: string;
  startDate: string;
  endDate: string;
  type: 'all' | 'deposit' | 'withdrawal';
  minAmount: string;
  maxAmount: string;
  searchText: string;
  category: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SortState {
  field: 'date' | 'amount' | 'balance' | 'description';
  direction: 'asc' | 'desc';
}

// ============================================
// Sync Operation Types
// ============================================

export interface SyncOperation {
  id: string;
  accountId: string;
  accountNumber: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  totalCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  errorMessage?: string;
}

// ============================================
// Credential Types
// ============================================

export interface BankCredentials {
  bankId: string;
  userId: string;
  password: string;
  certificatePassword?: string; // 공동인증서 비밀번호 (for corporate accounts)
  accountType?: 'personal' | 'corporate'; // 개인 or 법인
}

export interface CardCredentials {
  cardCompanyId: string;
  userId: string;
  password: string;
  accountType?: 'personal' | 'corporate'; // 개인 or 법인
}

// ============================================
// Database Stats Types
// ============================================

export interface DbStats {
  totalAccounts: number;
  totalTransactions: number;
  totalSyncOperations: number;
  lastSyncAt: string | null;
}

// ============================================
// Constants
// ============================================

export const KOREAN_BANKS: BankConfig[] = [
  {
    id: 'shinhan',
    name: 'Shinhan Bank',
    nameKo: '신한은행',
    loginUrl: 'https://bank.shinhan.com/?cr=252400000000',
    category: 'major',
    color: '#0046FF',
    icon: '🏦',
    supportsAutomation: true,
  },
  {
    id: 'kookmin',
    name: 'KB Kookmin Bank',
    nameKo: 'KB국민은행',
    loginUrl: 'https://www.kbstar.com/',
    category: 'major',
    color: '#FFBC00',
    icon: '⭐',
    supportsAutomation: true,
  },
  {
    id: 'woori',
    name: 'Woori Bank',
    nameKo: '우리은행',
    loginUrl: 'https://svc.wooribank.com/svc/Dream?withyou=PSTAX0069',
    category: 'major',
    color: '#0072BC',
    icon: '🏛️',
    supportsAutomation: true,
  },
  {
    id: 'hana',
    name: 'Hana Bank',
    nameKo: '하나은행',
    loginUrl: 'https://www.kebhana.com/',
    category: 'major',
    color: '#009775',
    icon: '🌿',
    supportsAutomation: true,
  },
  {
    id: 'nh',
    name: 'NH Bank',
    nameKo: 'NH농협은행',
    loginUrl: 'https://banking.nonghyup.com/',
    category: 'special',
    color: '#00B140',
    icon: '🌾',
    supportsAutomation: true,
  },
  {
    id: 'ibk',
    name: 'IBK Bank',
    nameKo: 'IBK기업은행',
    loginUrl: 'https://www.ibk.co.kr/',
    category: 'special',
    color: '#004A98',
    icon: '🏢',
    supportsAutomation: true,
  },
  {
    id: 'kakao',
    name: 'Kakao Bank',
    nameKo: '카카오뱅크',
    loginUrl: '',
    category: 'internet',
    color: '#FFEB00',
    icon: '💬',
    supportsAutomation: false,
  },
  {
    id: 'toss',
    name: 'Toss Bank',
    nameKo: '토스뱅크',
    loginUrl: '',
    category: 'internet',
    color: '#0064FF',
    icon: '💸',
    supportsAutomation: false,
  },
];

export const DEFAULT_BANK_INFO: Record<string, BankInfo> = {
  shinhan: { id: 'shinhan', name: 'Shinhan Bank', nameKo: '신한은행', color: '#0046FF', icon: '🏦', supportsAutomation: true },
  kookmin: { id: 'kookmin', name: 'KB Kookmin Bank', nameKo: 'KB국민은행', color: '#FFBC00', icon: '⭐', supportsAutomation: true },
  woori: { id: 'woori', name: 'Woori Bank', nameKo: '우리은행', color: '#0072BC', icon: '🏛️', supportsAutomation: true },
  hana: { id: 'hana', name: 'Hana Bank', nameKo: '하나은행', color: '#009775', icon: '🌿', supportsAutomation: true },
  nh: { id: 'nh', name: 'NH Bank', nameKo: 'NH농협은행', color: '#00B140', icon: '🌾', supportsAutomation: true },
  'nh-business': { id: 'nh-business', name: 'NH Business Bank', nameKo: 'NH농협은행', color: '#00B140', icon: '🌾', supportsAutomation: true },
  ibk: { id: 'ibk', name: 'IBK Bank', nameKo: 'IBK기업은행', color: '#004A98', icon: '🏢', supportsAutomation: true },
  kakao: { id: 'kakao', name: 'Kakao Bank', nameKo: '카카오뱅크', color: '#FFEB00', icon: '💬', supportsAutomation: false },
  toss: { id: 'toss', name: 'Toss Bank', nameKo: '토스뱅크', color: '#0064FF', icon: '💸', supportsAutomation: false },
};

export const TRANSACTION_CATEGORIES = [
  { id: 'all', label: '전체', icon: '📋' },
  { id: 'salary', label: '급여', icon: '💰' },
  { id: 'transfer', label: '이체', icon: '↔️' },
  { id: 'payment', label: '결제', icon: '💳' },
  { id: 'utility', label: '공과금', icon: '🏠' },
  { id: 'food', label: '식비', icon: '🍽️' },
  { id: 'transport', label: '교통', icon: '🚗' },
  { id: 'shopping', label: '쇼핑', icon: '🛒' },
  { id: 'entertainment', label: '여가', icon: '🎮' },
  { id: 'healthcare', label: '의료', icon: '🏥' },
  { id: 'education', label: '교육', icon: '📚' },
  { id: 'other', label: '기타', icon: '📌' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  major: '시중은행',
  special: '특수은행',
  regional: '지방은행',
  internet: '인터넷전문은행',
};

export const KOREAN_CARD_COMPANIES: CardConfig[] = [
  {
    id: 'shinhan-card',
    name: 'Shinhan Card',
    nameKo: '신한카드',
    loginUrl: 'https://www.shinhancard.com/',
    category: 'major',
    color: '#0046FF',
    icon: '💳',
    supportsAutomation: true,
  },
  {
    id: 'kb-card',
    name: 'KB Card',
    nameKo: 'KB국민카드',
    loginUrl: 'https://biz.kbcard.com/CXORMPIC0001.cms',
    category: 'major',
    color: '#FFBC00',
    icon: '💳',
    supportsAutomation: true,
  },
  {
    id: 'samsung-card',
    name: 'Samsung Card',
    nameKo: '삼성카드',
    loginUrl: 'https://www.samsungcard.com/',
    category: 'major',
    color: '#1428A0',
    icon: '💳',
    supportsAutomation: false,
  },
  {
    id: 'hyundai-card',
    name: 'Hyundai Card',
    nameKo: '현대카드',
    loginUrl: 'https://www.hyundaicard.com/',
    category: 'major',
    color: '#000000',
    icon: '💳',
    supportsAutomation: false,
  },
  {
    id: 'lotte-card',
    name: 'Lotte Card',
    nameKo: '롯데카드',
    loginUrl: 'https://www.lottecard.co.kr/',
    category: 'major',
    color: '#ED1C24',
    icon: '💳',
    supportsAutomation: false,
  },
  {
    id: 'hana-card',
    name: 'Hana Card',
    nameKo: '하나카드',
    loginUrl: 'https://www.hanacard.co.kr/',
    category: 'major',
    color: '#009775',
    icon: '💳',
    supportsAutomation: true,
  },
  {
    id: 'bc-card',
    name: 'BC Card',
    nameKo: 'BC카드',
    loginUrl: 'https://wisebiz.bccard.com/app/corp/Intro.corp',
    category: 'major',
    color: '#E20613',
    icon: '💳',
    supportsAutomation: true,
  },
  {
    id: 'woori-card',
    name: 'Woori Card',
    nameKo: '우리카드',
    loginUrl: 'https://www.wooricard.com/',
    category: 'major',
    color: '#0072BC',
    icon: '💳',
    supportsAutomation: false,
  },
  {
    id: 'nh-card',
    name: 'NH Card',
    nameKo: 'NH농협카드',
    loginUrl: 'https://card.nonghyup.com/',
    category: 'major',
    color: '#00B140',
    icon: '💳',
    supportsAutomation: true,
  },
  {
    id: 'citi-card',
    name: 'Citi Card',
    nameKo: '씨티카드',
    loginUrl: 'https://www.citibank.co.kr/cards/',
    category: 'major',
    color: '#003A70',
    icon: '💳',
    supportsAutomation: false,
  },
];

export const CARD_CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  major: '주요 카드사',
  telecom: '통신사 카드',
  internet: '인터넷 카드',
};

export const DEFAULT_CARD_INFO: Record<string, CardInfo> = {
  'shinhan-card': { cardNumber: '', cardName: '신한카드', cardCompanyId: 'shinhan-card' },
  'kb-card': { cardNumber: '', cardName: 'KB국민카드', cardCompanyId: 'kb-card' },
  'samsung-card': { cardNumber: '', cardName: '삼성카드', cardCompanyId: 'samsung-card' },
  'hyundai-card': { cardNumber: '', cardName: '현대카드', cardCompanyId: 'hyundai-card' },
  'lotte-card': { cardNumber: '', cardName: '롯데카드', cardCompanyId: 'lotte-card' },
  'hana-card': { cardNumber: '', cardName: '하나카드', cardCompanyId: 'hana-card' },
  'bc-card': { cardNumber: '', cardName: 'BC카드', cardCompanyId: 'bc-card' },
  'woori-card': { cardNumber: '', cardName: '우리카드', cardCompanyId: 'woori-card' },
  'nh-card': { cardNumber: '', cardName: 'NH농협카드', cardCompanyId: 'nh-card' },
  'citi-card': { cardNumber: '', cardName: '씨티카드', cardCompanyId: 'citi-card' },
};
