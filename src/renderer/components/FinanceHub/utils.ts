// ============================================
// Finance Hub - Utility Functions
// ============================================

import { BankInfo, DEFAULT_BANK_INFO } from './types';

// ============================================
// Formatting Functions
// ============================================

/**
 * Format account number with dashes
 * e.g., "1234567890" -> "123-456-7890"
 */
export const formatAccountNumber = (num: string | undefined | null): string => {
  if (!num) return '';
  if (num.includes('-') || num.length < 10) return num;
  return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
};

/**
 * Format currency with Korean Won symbol
 * e.g., 1000000 -> "₩1,000,000"
 */
export const formatCurrency = (amount: number): string => {
  return `₩${amount.toLocaleString()}`;
};

/**
 * Format date string to Korean date format
 * e.g., "20240115" -> "2024.01.15"
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/-/g, '');
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}.${normalized.slice(4, 6)}.${normalized.slice(6, 8)}`;
  }
  return dateStr;
};

/**
 * Format date string for HTML date input
 * e.g., "20240115" -> "2024-01-15"
 */
export const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/[.-]/g, '');
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return dateStr;
};

/**
 * Convert date to YYYYMMDD format for SQLite queries
 */
export const formatDateForQuery = (dateStr: string): string => {
  return dateStr.replace(/-/g, '');
};

/**
 * Format datetime for display
 */
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// Date Range Functions
// ============================================

/**
 * Get default date range (last 3 months)
 */
export const getDefaultDateRange = () => {
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  
  return {
    startDate: threeMonthsAgo.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  };
};

/**
 * Get date range for a specific period
 */
export const getDateRangeForPeriod = (period: '1week' | '1month' | '3months' | '6months' | '1year') => {
  const today = new Date();
  const startDate = new Date();
  
  switch (period) {
    case '1week':
      startDate.setDate(today.getDate() - 7);
      break;
    case '1month':
      startDate.setMonth(today.getMonth() - 1);
      break;
    case '3months':
      startDate.setMonth(today.getMonth() - 3);
      break;
    case '6months':
      startDate.setMonth(today.getMonth() - 6);
      break;
    case '1year':
      startDate.setFullYear(today.getFullYear() - 1);
      break;
  }
  
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  };
};

// ============================================
// Bank Info Functions
// ============================================

/**
 * Get bank info by ID with fallback
 */
export const getBankInfo = (
  bankId: string,
  banksMap: Record<string, BankInfo> = {}
): BankInfo => {
  // Map nh-business to nh for display purposes
  const lookupId = bankId === 'nh-business' ? 'nh' : bankId;

  return banksMap[lookupId] || DEFAULT_BANK_INFO[lookupId] || {
    id: bankId,
    name: bankId,
    nameKo: bankId,
    color: '#666666',
    icon: '🏦',
    supportsAutomation: false,
  };
};

// ============================================
// CSV Export Functions
// ============================================

/**
 * Generate CSV content from transactions
 */
export const generateTransactionCSV = (
  transactions: Array<{
    date: string;
    time: string | null;
    bankId: string;
    type: string | null;
    description: string | null;
    withdrawal: number;
    deposit: number;
    balance: number;
    branch: string | null;
  }>,
  banks: Record<string, BankInfo>,
  accounts: Array<{ id: string; accountNumber: string }>,
  getAccountId: (tx: any) => string
): string => {
  const headers = ['날짜', '시간', '은행', '계좌', '적요', '내용', '출금', '입금', '잔액', '지점'];
  
  const rows = transactions.map(tx => {
    const bank = getBankInfo(tx.bankId, banks);
    const account = accounts.find(a => a.id === getAccountId(tx));
    
    return [
      formatDate(tx.date),
      tx.time || '',
      bank.nameKo,
      account?.accountNumber || '',
      tx.type || '',
      tx.description || '',
      tx.withdrawal > 0 ? tx.withdrawal.toString() : '',
      tx.deposit > 0 ? tx.deposit.toString() : '',
      tx.balance.toString(),
      tx.branch || '',
    ].map(cell => `"${cell}"`).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (content: string, filename: string): void => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================
// Validation Functions
// ============================================

/**
 * Check if a string is a valid date
 */
export const isValidDate = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Check if amount is valid
 */
export const isValidAmount = (amount: string): boolean => {
  if (!amount) return true; // Empty is valid (means no filter)
  const num = parseInt(amount, 10);
  return !isNaN(num) && num >= 0;
};
