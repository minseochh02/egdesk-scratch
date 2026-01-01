import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './TransactionsPage.css';

// ============================================
// Types (matching financehub.ts schema)
// ============================================

interface Transaction {
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

interface BankAccount {
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

interface BankInfo {
  id: string;
  name: string;
  nameKo: string;
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

interface TransactionFilters {
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

interface TransactionStats {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  netChange: number;
}

type SortField = 'date' | 'amount' | 'balance' | 'description';
type SortDirection = 'asc' | 'desc';

// ============================================
// Electron IPC Interface
// ============================================

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electron: {
      financeHubDb: {
        getAllBanks: () => Promise<{ success: boolean; data?: BankInfo[]; error?: string }>;
        getAllAccounts: () => Promise<{ success: boolean; data?: BankAccount[]; error?: string }>;
        getAccountsByBank: (bankId: string) => Promise<{ success: boolean; data?: BankAccount[]; error?: string }>;
        queryTransactions: (options: any) => Promise<{ success: boolean; data?: Transaction[]; error?: string }>;
        getTransactionStats: (options: any) => Promise<{ success: boolean; data?: TransactionStats; error?: string }>;
        getMonthlySummary: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getOverallStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getRecentSyncOperations: (limit: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        upsertAccount: (data: any) => Promise<{ success: boolean; data?: BankAccount; error?: string }>;
        importTransactions: (bankId: string, accountData: any, transactionsData: any[], syncMetadata: any) => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      // Other electron APIs...
      [key: string]: any;
    };
  }
}

// ============================================
// Fallback Bank Info (used if DB banks not loaded)
// ============================================

const DEFAULT_BANK_INFO: Record<string, BankInfo> = {
  shinhan: { id: 'shinhan', name: 'Shinhan Bank', nameKo: '신한은행', color: '#0046FF', icon: '🏦', supportsAutomation: true },
  kookmin: { id: 'kookmin', name: 'KB Kookmin Bank', nameKo: 'KB국민은행', color: '#FFBC00', icon: '⭐', supportsAutomation: false },
  woori: { id: 'woori', name: 'Woori Bank', nameKo: '우리은행', color: '#0072BC', icon: '🏛️', supportsAutomation: false },
  hana: { id: 'hana', name: 'Hana Bank', nameKo: '하나은행', color: '#009775', icon: '🌿', supportsAutomation: false },
  nh: { id: 'nh', name: 'NH Bank', nameKo: 'NH농협은행', color: '#00B140', icon: '🌾', supportsAutomation: false },
  ibk: { id: 'ibk', name: 'IBK Bank', nameKo: 'IBK기업은행', color: '#004A98', icon: '🏢', supportsAutomation: false },
  kakao: { id: 'kakao', name: 'Kakao Bank', nameKo: '카카오뱅크', color: '#FFEB00', icon: '💬', supportsAutomation: false },
  toss: { id: 'toss', name: 'Toss Bank', nameKo: '토스뱅크', color: '#0064FF', icon: '💸', supportsAutomation: false },
};

const TRANSACTION_CATEGORIES = [
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

// ============================================
// Helper Functions
// ============================================

const formatAccountNumber = (num: string | undefined | null): string => {
  if (!num) return '';
  if (num.includes('-') || num.length < 10) return num;
  return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
};

const formatCurrency = (amount: number): string => {
  return `₩${amount.toLocaleString()}`;
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/-/g, '');
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}.${normalized.slice(4, 6)}.${normalized.slice(6, 8)}`;
  }
  return dateStr;
};

const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/[.-]/g, '');
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  return dateStr;
};

const getDefaultDateRange = () => {
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  
  return {
    startDate: threeMonthsAgo.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  };
};

// Helper to get bank info (from loaded banks or fallback)
const getBankInfo = (bankId: string, banksMap: Record<string, BankInfo>): BankInfo => {
  return banksMap[bankId] || DEFAULT_BANK_INFO[bankId] || {
    id: bankId,
    name: bankId,
    nameKo: bankId,
    color: '#666666',
    icon: '🏦',
    supportsAutomation: false,
  };
};

// ============================================
// Main Component
// ============================================

const TransactionsPage: React.FC = () => {
  // === State ===
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Record<string, BankInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filters
  const defaultDates = getDefaultDateRange();
  const [filters, setFilters] = useState<TransactionFilters>({
    bankId: 'all',
    accountId: 'all',
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    type: 'all',
    minAmount: '',
    maxAmount: '',
    searchText: '',
    category: 'all',
  });
  
  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // ============================================
  // Data Loading - Using SQLite via IPC
  // ============================================

  // Load banks from SQLite
  const loadBanks = useCallback(async () => {
    try {
      const result = await window.electron.financeHubDb.getAllBanks();
      if (result.success && result.data) {
        const banksMap: Record<string, BankInfo> = {};
        result.data.forEach(bank => {
          banksMap[bank.id] = bank;
        });
        setBanks(banksMap);
      }
    } catch (err) {
      console.error('[TransactionsPage] Failed to load banks:', err);
      // Use default bank info as fallback
      setBanks(DEFAULT_BANK_INFO);
    }
  }, []);

  // Load accounts from SQLite
  const loadAccounts = useCallback(async () => {
    try {
      const result = await window.electron.financeHubDb.getAllAccounts();
      if (result.success && result.data) {
        setAccounts(result.data);
      }
    } catch (err) {
      console.error('[TransactionsPage] Failed to load accounts:', err);
    }
  }, []);

  // Load transactions from SQLite with filters
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query options matching FinanceHubDbManager.queryTransactions()
      const queryOptions: {
        accountId?: string;
        bankId?: string;
        startDate?: string;
        endDate?: string;
        category?: string;
        minAmount?: number;
        maxAmount?: number;
        searchText?: string;
        limit: number;
        offset: number;
        orderBy: 'date' | 'amount' | 'balance';
        orderDir: 'asc' | 'desc';
      } = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        orderBy: sortField === 'description' ? 'date' : sortField,
        orderDir: sortDirection,
      };
      
      // Apply filters
      if (filters.bankId !== 'all') {
        queryOptions.bankId = filters.bankId;
      }
      if (filters.accountId !== 'all') {
        queryOptions.accountId = filters.accountId;
      }
      if (filters.startDate) {
        // Convert YYYY-MM-DD to YYYYMMDD for SQLite query
        queryOptions.startDate = filters.startDate.replace(/-/g, '');
      }
      if (filters.endDate) {
        queryOptions.endDate = filters.endDate.replace(/-/g, '');
      }
      if (filters.searchText) {
        queryOptions.searchText = filters.searchText;
      }
      if (filters.category !== 'all') {
        queryOptions.category = filters.category;
      }
      if (filters.minAmount) {
        queryOptions.minAmount = parseInt(filters.minAmount, 10);
      }
      if (filters.maxAmount) {
        queryOptions.maxAmount = parseInt(filters.maxAmount, 10);
      }
      
      console.log('[TransactionsPage] Querying transactions with options:', queryOptions);
      
      const result = await window.electron.financeHubDb.queryTransactions(queryOptions);
      
      if (result.success) {
        let txList = result.data || [];
        
        // Client-side filter for deposit/withdrawal type (not supported in backend query)
        if (filters.type === 'deposit') {
          txList = txList.filter((tx: Transaction) => tx.deposit > 0);
        } else if (filters.type === 'withdrawal') {
          txList = txList.filter((tx: Transaction) => tx.withdrawal > 0);
        }
        
        setTransactions(txList);
        setTotalCount(txList.length);
        
        console.log(`[TransactionsPage] Loaded ${txList.length} transactions`);
      } else {
        setError(result.error || 'Failed to load transactions');
        console.error('[TransactionsPage] Query failed:', result.error);
      }
      
      // Load stats with same filters
      const statsOptions: {
        bankId?: string;
        accountId?: string;
        startDate?: string;
        endDate?: string;
      } = {};
      
      if (filters.bankId !== 'all') statsOptions.bankId = filters.bankId;
      if (filters.accountId !== 'all') statsOptions.accountId = filters.accountId;
      if (filters.startDate) statsOptions.startDate = filters.startDate.replace(/-/g, '');
      if (filters.endDate) statsOptions.endDate = filters.endDate.replace(/-/g, '');
      
      const statsResult = await window.electron.financeHubDb.getTransactionStats(statsOptions);
      
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (err) {
      console.error('[TransactionsPage] Failed to load transactions:', err);
      setError('거래내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortField, sortDirection, filters]);

  // Initial data load
  useEffect(() => {
    loadBanks();
    loadAccounts();
  }, [loadBanks, loadAccounts]);

  // Reload transactions when filters/pagination/sort changes
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // ============================================
  // Handlers
  // ============================================

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    const defaultDates = getDefaultDateRange();
    setFilters({
      bankId: 'all',
      accountId: 'all',
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate,
      type: 'all',
      minAmount: '',
      maxAmount: '',
      searchText: '',
      category: 'all',
    });
    setCurrentPage(1);
  };

  const handleExportCSV = async () => {
    try {
      // Fetch all transactions for export (no pagination)
      const queryOptions: any = {
        limit: 10000,
        offset: 0,
        orderBy: sortField,
        orderDir: sortDirection,
      };
      
      if (filters.bankId !== 'all') queryOptions.bankId = filters.bankId;
      if (filters.accountId !== 'all') queryOptions.accountId = filters.accountId;
      if (filters.startDate) queryOptions.startDate = filters.startDate.replace(/-/g, '');
      if (filters.endDate) queryOptions.endDate = filters.endDate.replace(/-/g, '');
      
      const result = await window.electron.financeHubDb.queryTransactions(queryOptions);
      
      if (result.success && result.data) {
        const csv = generateCSV(result.data);
        downloadCSV(csv, `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      }
    } catch (err) {
      console.error('[TransactionsPage] Export failed:', err);
      alert('내보내기 실패');
    }
  };

  const generateCSV = (data: Transaction[]): string => {
    const headers = ['날짜', '시간', '은행', '계좌', '적요', '내용', '출금', '입금', '잔액', '지점'];
    const rows = data.map(tx => {
      const bank = getBankInfo(tx.bankId, banks);
      const account = accounts.find(a => a.id === tx.accountId);
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

  const downloadCSV = (content: string, filename: string) => {
    const BOM = '\uFEFF';
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
  // Computed Values
  // ============================================

  const filteredAccounts = useMemo(() => {
    if (filters.bankId === 'all') return accounts;
    return accounts.filter(a => a.bankId === filters.bankId);
  }, [accounts, filters.bankId]);

  const uniqueBanks = useMemo(() => {
    // Get unique bank IDs from accounts that have data
    const bankIds = [...new Set(accounts.map(a => a.bankId))];
    // Return bank info for each, using loaded banks or fallback
    return bankIds.map(id => getBankInfo(id, banks));
  }, [accounts, banks]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // ============================================
  // Render Helpers
  // ============================================

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="txp-sort-icon">↕</span>;
    return <span className="txp-sort-icon txp-sort-icon--active">
      {sortDirection === 'asc' ? '↑' : '↓'}
    </span>;
  };

  const renderTransactionRow = (tx: Transaction) => {
    const bank = getBankInfo(tx.bankId, banks);
    const account = accounts.find(a => a.id === tx.accountId);
    const isDeposit = tx.deposit > 0;
    const amount = isDeposit ? tx.deposit : tx.withdrawal;
    
    return (
      <tr 
        key={tx.id} 
        className="txp-table__row"
        onClick={() => setSelectedTransaction(tx)}
      >
        <td className="txp-table__cell txp-table__cell--date">
          <div className="txp-date">
            <span className="txp-date__day">{formatDate(tx.date)}</span>
            {tx.time && <span className="txp-date__time">{tx.time}</span>}
          </div>
        </td>
        <td className="txp-table__cell txp-table__cell--bank">
          <div className="txp-bank-badge" style={{ '--bank-color': bank.color } as React.CSSProperties}>
            <span className="txp-bank-badge__icon">{bank.icon}</span>
            <span className="txp-bank-badge__name">{bank.nameKo}</span>
          </div>
        </td>
        <td className="txp-table__cell txp-table__cell--account">
          <span className="txp-account-number">
            {formatAccountNumber(account?.accountNumber)}
          </span>
        </td>
        <td className="txp-table__cell txp-table__cell--type">
          {tx.type || '-'}
        </td>
        <td className="txp-table__cell txp-table__cell--description">
          <div className="txp-description">
            <span className="txp-description__text">{tx.description || '-'}</span>
            {tx.counterparty && (
              <span className="txp-description__counterparty">{tx.counterparty}</span>
            )}
          </div>
        </td>
        <td className={`txp-table__cell txp-table__cell--amount ${isDeposit ? 'txp-table__cell--deposit' : 'txp-table__cell--withdrawal'}`}>
          <span className="txp-amount">
            {isDeposit ? '+' : '-'}{formatCurrency(amount)}
          </span>
        </td>
        <td className="txp-table__cell txp-table__cell--balance">
          {formatCurrency(tx.balance)}
        </td>
      </tr>
    );
  };

  const renderTransactionCard = (tx: Transaction) => {
    const bank = getBankInfo(tx.bankId, banks);
    const account = accounts.find(a => a.id === tx.accountId);
    const isDeposit = tx.deposit > 0;
    const amount = isDeposit ? tx.deposit : tx.withdrawal;
    
    return (
      <div 
        key={tx.id} 
        className="txp-card"
        onClick={() => setSelectedTransaction(tx)}
        style={{ '--bank-color': bank.color } as React.CSSProperties}
      >
        <div className="txp-card__header">
          <div className="txp-card__bank">
            <span className="txp-card__bank-icon">{bank.icon}</span>
            <span className="txp-card__bank-name">{bank.nameKo}</span>
          </div>
          <div className="txp-card__date">
            {formatDate(tx.date)} {tx.time || ''}
          </div>
        </div>
        <div className="txp-card__body">
          <div className="txp-card__description">
            <span className="txp-card__type">{tx.type || '-'}</span>
            <span className="txp-card__text">{tx.description || '-'}</span>
          </div>
          <div className={`txp-card__amount ${isDeposit ? 'txp-card__amount--deposit' : 'txp-card__amount--withdrawal'}`}>
            {isDeposit ? '+' : '-'}{formatCurrency(amount)}
          </div>
        </div>
        <div className="txp-card__footer">
          <span className="txp-card__account">
            {formatAccountNumber(account?.accountNumber)}
          </span>
          <span className="txp-card__balance">
            잔액: {formatCurrency(tx.balance)}
          </span>
        </div>
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="txp">
      {/* Header */}
      <header className="txp-header">
        <div className="txp-header__content">
          <h1 className="txp-header__title">
            <span className="txp-header__icon">📊</span>
            전체 거래내역
          </h1>
          <p className="txp-header__subtitle">
            모든 은행 계좌의 거래내역을 한 곳에서 확인하세요
          </p>
        </div>
        <div className="txp-header__actions">
          <button
            className="txp-btn txp-btn--outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            🔍 {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button
            className="txp-btn txp-btn--outline"
            onClick={handleExportCSV}
          >
            📥 CSV 내보내기
          </button>
          <div className="txp-view-toggle">
            <button
              className={`txp-view-toggle__btn ${viewMode === 'table' ? 'txp-view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title="테이블 보기"
            >
              📋
            </button>
            <button
              className={`txp-view-toggle__btn ${viewMode === 'cards' ? 'txp-view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="카드 보기"
            >
              🃏
            </button>
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      {stats && (
        <div className="txp-stats">
          <div className="txp-stats__card">
            <span className="txp-stats__label">총 거래</span>
            <span className="txp-stats__value">{stats.totalTransactions.toLocaleString()}건</span>
          </div>
          <div className="txp-stats__card txp-stats__card--deposit">
            <span className="txp-stats__label">총 입금</span>
            <span className="txp-stats__value">{formatCurrency(stats.totalDeposits)}</span>
            <span className="txp-stats__count">{stats.depositCount}건</span>
          </div>
          <div className="txp-stats__card txp-stats__card--withdrawal">
            <span className="txp-stats__label">총 출금</span>
            <span className="txp-stats__value">{formatCurrency(stats.totalWithdrawals)}</span>
            <span className="txp-stats__count">{stats.withdrawalCount}건</span>
          </div>
          <div className={`txp-stats__card ${stats.netChange >= 0 ? 'txp-stats__card--positive' : 'txp-stats__card--negative'}`}>
            <span className="txp-stats__label">순 변동</span>
            <span className="txp-stats__value">{formatCurrency(stats.netChange)}</span>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="txp-filters">
          <div className="txp-filters__row">
            {/* Search */}
            <div className="txp-filters__group txp-filters__group--search">
              <label className="txp-filters__label">검색</label>
              <input
                type="text"
                className="txp-filters__input"
                placeholder="거래내용, 상대방 검색..."
                value={filters.searchText}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
              />
            </div>

            {/* Bank Filter */}
            <div className="txp-filters__group">
              <label className="txp-filters__label">은행</label>
              <select
                className="txp-filters__select"
                value={filters.bankId}
                onChange={(e) => {
                  handleFilterChange('bankId', e.target.value);
                  handleFilterChange('accountId', 'all');
                }}
              >
                <option value="all">전체 은행</option>
                {uniqueBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.icon} {bank.nameKo}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Filter */}
            <div className="txp-filters__group">
              <label className="txp-filters__label">계좌</label>
              <select
                className="txp-filters__select"
                value={filters.accountId}
                onChange={(e) => handleFilterChange('accountId', e.target.value)}
              >
                <option value="all">전체 계좌</option>
                {filteredAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {formatAccountNumber(account.accountNumber)}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type */}
            <div className="txp-filters__group">
              <label className="txp-filters__label">거래유형</label>
              <select
                className="txp-filters__select"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value as 'all' | 'deposit' | 'withdrawal')}
              >
                <option value="all">전체</option>
                <option value="deposit">입금</option>
                <option value="withdrawal">출금</option>
              </select>
            </div>
          </div>

          <div className="txp-filters__row">
            {/* Date Range */}
            <div className="txp-filters__group">
              <label className="txp-filters__label">시작일</label>
              <input
                type="date"
                className="txp-filters__input"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div className="txp-filters__group">
              <label className="txp-filters__label">종료일</label>
              <input
                type="date"
                className="txp-filters__input"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            {/* Amount Range */}
            <div className="txp-filters__group">
              <label className="txp-filters__label">최소 금액</label>
              <input
                type="number"
                className="txp-filters__input"
                placeholder="0"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              />
            </div>

            <div className="txp-filters__group">
              <label className="txp-filters__label">최대 금액</label>
              <input
                type="number"
                className="txp-filters__input"
                placeholder="무제한"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
              />
            </div>

            {/* Reset Button */}
            <div className="txp-filters__group txp-filters__group--actions">
              <button
                className="txp-btn txp-btn--secondary"
                onClick={handleResetFilters}
              >
                🔄 필터 초기화
              </button>
            </div>
          </div>

          {/* Quick Date Filters */}
          <div className="txp-filters__quick-dates">
            <span className="txp-filters__quick-label">빠른 선택:</span>
            <button
              className="txp-filters__quick-btn"
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 7);
                handleFilterChange('startDate', weekAgo.toISOString().slice(0, 10));
                handleFilterChange('endDate', today.toISOString().slice(0, 10));
              }}
            >
              1주일
            </button>
            <button
              className="txp-filters__quick-btn"
              onClick={() => {
                const today = new Date();
                const monthAgo = new Date();
                monthAgo.setMonth(today.getMonth() - 1);
                handleFilterChange('startDate', monthAgo.toISOString().slice(0, 10));
                handleFilterChange('endDate', today.toISOString().slice(0, 10));
              }}
            >
              1개월
            </button>
            <button
              className="txp-filters__quick-btn"
              onClick={() => {
                const today = new Date();
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                handleFilterChange('startDate', threeMonthsAgo.toISOString().slice(0, 10));
                handleFilterChange('endDate', today.toISOString().slice(0, 10));
              }}
            >
              3개월
            </button>
            <button
              className="txp-filters__quick-btn"
              onClick={() => {
                const today = new Date();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(today.getMonth() - 6);
                handleFilterChange('startDate', sixMonthsAgo.toISOString().slice(0, 10));
                handleFilterChange('endDate', today.toISOString().slice(0, 10));
              }}
            >
              6개월
            </button>
            <button
              className="txp-filters__quick-btn"
              onClick={() => {
                const today = new Date();
                const yearAgo = new Date();
                yearAgo.setFullYear(today.getFullYear() - 1);
                handleFilterChange('startDate', yearAgo.toISOString().slice(0, 10));
                handleFilterChange('endDate', today.toISOString().slice(0, 10));
              }}
            >
              1년
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="txp-content">
        {isLoading ? (
          <div className="txp-loading">
            <div className="txp-loading__spinner"></div>
            <span>거래내역 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="txp-error">
            <span className="txp-error__icon">⚠️</span>
            <span className="txp-error__text">{error}</span>
            <button className="txp-btn txp-btn--primary" onClick={loadTransactions}>
              다시 시도
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="txp-empty">
            <span className="txp-empty__icon">📋</span>
            <h3 className="txp-empty__title">거래내역이 없습니다</h3>
            <p className="txp-empty__text">
              선택한 조건에 맞는 거래내역이 없습니다.
              <br />
              필터를 조정하거나 계좌를 동기화해 주세요.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="txp-table-container">
            <table className="txp-table">
              <thead className="txp-table__head">
                <tr>
                  <th 
                    className="txp-table__header txp-table__header--sortable"
                    onClick={() => handleSort('date')}
                  >
                    날짜 {renderSortIcon('date')}
                  </th>
                  <th className="txp-table__header">은행</th>
                  <th className="txp-table__header">계좌</th>
                  <th className="txp-table__header">적요</th>
                  <th 
                    className="txp-table__header txp-table__header--sortable"
                    onClick={() => handleSort('description')}
                  >
                    내용 {renderSortIcon('description')}
                  </th>
                  <th 
                    className="txp-table__header txp-table__header--sortable txp-table__header--right"
                    onClick={() => handleSort('amount')}
                  >
                    금액 {renderSortIcon('amount')}
                  </th>
                  <th 
                    className="txp-table__header txp-table__header--sortable txp-table__header--right"
                    onClick={() => handleSort('balance')}
                  >
                    잔액 {renderSortIcon('balance')}
                  </th>
                </tr>
              </thead>
              <tbody className="txp-table__body">
                {transactions.map(renderTransactionRow)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="txp-cards">
            {transactions.map(renderTransactionCard)}
          </div>
        )}

        {/* Pagination */}
        {transactions.length > 0 && totalPages > 1 && (
          <div className="txp-pagination">
            <button
              className="txp-pagination__btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              «
            </button>
            <button
              className="txp-pagination__btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            <span className="txp-pagination__info">
              {currentPage} / {totalPages} 페이지
            </span>
            <button
              className="txp-pagination__btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
            <button
              className="txp-pagination__btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              »
            </button>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="txp-modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="txp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="txp-modal__header">
              <h2 className="txp-modal__title">거래 상세</h2>
              <button 
                className="txp-modal__close"
                onClick={() => setSelectedTransaction(null)}
              >
                ✕
              </button>
            </div>
            <div className="txp-modal__content">
              {(() => {
                const tx = selectedTransaction;
                const bank = getBankInfo(tx.bankId, banks);
                const account = accounts.find(a => a.id === tx.accountId);
                const isDeposit = tx.deposit > 0;
                const amount = isDeposit ? tx.deposit : tx.withdrawal;
                
                return (
                  <>
                    <div className="txp-detail__amount-section">
                      <div className={`txp-detail__amount ${isDeposit ? 'txp-detail__amount--deposit' : 'txp-detail__amount--withdrawal'}`}>
                        {isDeposit ? '+' : '-'}{formatCurrency(amount)}
                      </div>
                      <div className="txp-detail__type-badge">
                        {isDeposit ? '입금' : '출금'}
                      </div>
                    </div>
                    
                    <div className="txp-detail__rows">
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">일시</span>
                        <span className="txp-detail__value">
                          {formatDate(tx.date)} {tx.time}
                        </span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">은행</span>
                        <span className="txp-detail__value">
                          {bank.icon} {bank.nameKo}
                        </span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">계좌</span>
                        <span className="txp-detail__value">
                          {formatAccountNumber(account?.accountNumber)}
                          {account?.accountName && ` (${account.accountName})`}
                        </span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">적요</span>
                        <span className="txp-detail__value">{tx.type || '-'}</span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">내용</span>
                        <span className="txp-detail__value">{tx.description || '-'}</span>
                      </div>
                      {tx.counterparty && (
                        <div className="txp-detail__row">
                          <span className="txp-detail__label">상대방</span>
                          <span className="txp-detail__value">{tx.counterparty}</span>
                        </div>
                      )}
                      {tx.branch && (
                        <div className="txp-detail__row">
                          <span className="txp-detail__label">거래점</span>
                          <span className="txp-detail__value">{tx.branch}</span>
                        </div>
                      )}
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">거래 후 잔액</span>
                        <span className="txp-detail__value txp-detail__value--highlight">
                          {formatCurrency(tx.balance)}
                        </span>
                      </div>
                      {tx.memo && (
                        <div className="txp-detail__row">
                          <span className="txp-detail__label">메모</span>
                          <span className="txp-detail__value">{tx.memo}</span>
                        </div>
                      )}
                      {tx.category && (
                        <div className="txp-detail__row">
                          <span className="txp-detail__label">카테고리</span>
                          <span className="txp-detail__value">
                            {TRANSACTION_CATEGORIES.find(c => c.id === tx.category)?.label || tx.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;