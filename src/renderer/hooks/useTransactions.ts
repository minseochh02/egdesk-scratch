// ============================================
// useTransactions Hook
// Centralized state management for Finance Hub transactions
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Transaction,
  TransactionFilters,
  TransactionStats,
  MonthlySummary,
  PaginationState,
  SortState,
  BankAccount,
  BankInfo,
  DEFAULT_BANK_INFO,
} from '../components/FinanceHub/types';
import { getDefaultDateRange, formatDateForQuery } from '../components/FinanceHub/utils';

// ============================================
// Default Values
// ============================================

const DEFAULT_FILTERS: TransactionFilters = {
  bankId: 'all',
  accountId: 'all',
  ...getDefaultDateRange(),
  type: 'all',
  minAmount: '',
  maxAmount: '',
  searchText: '',
  category: 'all',
};

const DEFAULT_PAGINATION: PaginationState = {
  currentPage: 1,
  pageSize: 50,
  totalCount: 0,
  totalPages: 0,
};

const DEFAULT_SORT: SortState = {
  field: 'date',
  direction: 'desc',
};

// ============================================
// Hook Return Type
// ============================================

export interface UseTransactionsReturn {
  // Data
  bankTransactions: Transaction[];
  cardTransactions: Transaction[];
  recentTransactions: Transaction[];
  stats: TransactionStats | null; // Overall stats for dashboard
  bankStats: TransactionStats | null;
  cardStats: TransactionStats | null;
  monthlySummary: MonthlySummary[];
  accounts: BankAccount[];
  banks: Record<string, BankInfo>;

  // State
  bankFilters: TransactionFilters;
  cardFilters: TransactionFilters;
  pagination: PaginationState;
  sort: SortState;
  isBankLoading: boolean;
  isCardLoading: boolean;
  isLoadingRecent: boolean;
  isSyncing: string | null;
  error: string | null;

  // Filter Actions
  setBankFilters: (filters: Partial<TransactionFilters>) => void;
  setCardFilters: (filters: Partial<TransactionFilters>) => void;
  resetBankFilters: () => void;
  resetCardFilters: () => void;

  // Pagination Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Sort Actions
  toggleSort: (field: SortState['field']) => void;

  // Data Actions
  loadBankTransactions: () => Promise<void>;
  loadCardTransactions: () => Promise<void>;
  loadRecentTransactions: (limit?: number) => Promise<void>;
  loadAllTransactions: () => Promise<Transaction[]>;
  loadBanksAndAccounts: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Sync Actions
  setIsSyncing: (accountNumber: string | null) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useTransactions(): UseTransactionsReturn {
  // === Core Data State ===
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [cardTransactions, setCardTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null); // Overall stats for dashboard
  const [bankStats, setBankStats] = useState<TransactionStats | null>(null);
  const [cardStats, setCardStats] = useState<TransactionStats | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Record<string, BankInfo>>(DEFAULT_BANK_INFO);
  
  // === Filter & Pagination State ===
  const [bankFilters, setBankFiltersState] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [cardFilters, setCardFiltersState] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  
  // === Loading State ===
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // === Initialization Flag ===
  const [isInitialized, setIsInitialized] = useState(false);

  // ============================================
  // Load Banks and Accounts
  // ============================================
  
  const loadBanksAndAccounts = useCallback(async () => {
    try {
      const [banksResult, accountsResult] = await Promise.all([
        window.electron.financeHubDb.getAllBanks?.() || Promise.resolve({ success: false }),
        window.electron.financeHubDb.getAllAccounts(),
      ]);
      
      // Load banks
      if (banksResult.success && banksResult.data) {
        const banksMap: Record<string, BankInfo> = { ...DEFAULT_BANK_INFO };
        banksResult.data.forEach((bank: BankInfo) => {
          banksMap[bank.id] = bank;
        });
        setBanks(banksMap);
      }
      
      // Load accounts
      if (accountsResult.success && accountsResult.data) {
        setAccounts(accountsResult.data);
      }
    } catch (err) {
      console.error('[useTransactions] Failed to load banks/accounts:', err);
    }
  }, []);

  // ============================================
  // Load Recent Transactions (for Dashboard)
  // ============================================
  
  const loadRecentTransactions = useCallback(async (limit: number = 10) => {
    setIsLoadingRecent(true);
    
    try {
      const result = await window.electron.financeHubDb.queryTransactions({
        limit,
        offset: 0,
        orderBy: 'date',
        orderDir: 'desc',
      });
      
      if (result.success) {
        setRecentTransactions(result.data || []);
        console.log(`[useTransactions] Loaded ${result.data?.length || 0} recent transactions`);
      } else {
        console.error('[useTransactions] Failed to load recent transactions:', result.error);
      }
    } catch (err) {
      console.error('[useTransactions] Failed to load recent:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  // ============================================
  // Load All Transactions (for Export)
  // ============================================
  
  const loadAllTransactions = useCallback(async (): Promise<Transaction[]> => {
    try {
      console.log('[useTransactions] Loading all transactions for export...');
      
      const result = await window.electron.financeHubDb.queryTransactions({
        limit: 100000, // Large limit to get all transactions
        offset: 0,
        orderBy: 'date',
        orderDir: 'desc',
      });
      
      if (result.success) {
        const allTransactions = result.data || [];
        console.log(`[useTransactions] Loaded ${allTransactions.length} total transactions for export`);
        return allTransactions;
      } else {
        console.error('[useTransactions] Failed to load all transactions:', result.error);
        return [];
      }
    } catch (err) {
      console.error('[useTransactions] Failed to load all transactions:', err);
      return [];
    }
  }, []);

  // ============================================
  // Load Stats
  // ============================================
  
  const loadStats = useCallback(async (filterOverrides?: Partial<TransactionFilters>) => {
    try {
      const activeFilters = filterOverrides ? { ...DEFAULT_FILTERS, ...filterOverrides } : DEFAULT_FILTERS;
      const statsOptions: Record<string, any> = {};
      
      if (activeFilters.bankId !== 'all') statsOptions.bankId = activeFilters.bankId;
      if (activeFilters.accountId !== 'all') statsOptions.accountId = activeFilters.accountId;
      if (activeFilters.startDate) statsOptions.startDate = formatDateForQuery(activeFilters.startDate);
      if (activeFilters.endDate) statsOptions.endDate = formatDateForQuery(activeFilters.endDate);
      
      const [statsResult, summaryResult] = await Promise.all([
        window.electron.financeHubDb.getTransactionStats(statsOptions),
        window.electron.financeHubDb.getMonthlySummary(statsOptions),
      ]);
      
      if (statsResult.success && statsResult.data) {
        // Calculate netChange if not provided
        const data = statsResult.data;
        if (data.netChange === undefined) {
          data.netChange = data.totalDeposits - data.totalWithdrawals;
        }
        setStats(data);
      }
      
      if (summaryResult.success && summaryResult.data) {
        setMonthlySummary(summaryResult.data);
      }
    } catch (err) {
      console.error('[useTransactions] Failed to load stats:', err);
    }
  }, []);

  // ============================================
  // Load Bank Transactions
  // ============================================

  const loadBankTransactions = useCallback(async () => {
    setIsBankLoading(true);
    setError(null);

    try {
      // Build query options
      const queryOptions: Record<string, any> = {
        limit: pagination.pageSize,
        offset: (pagination.currentPage - 1) * pagination.pageSize,
        orderBy: sort.field === 'description' ? 'date' : sort.field,
        orderDir: sort.direction,
      };

      // Apply bank filters
      if (bankFilters.bankId !== 'all') queryOptions.bankId = bankFilters.bankId;
      if (bankFilters.accountId !== 'all') queryOptions.accountId = bankFilters.accountId;
      if (bankFilters.startDate) queryOptions.startDate = formatDateForQuery(bankFilters.startDate);
      if (bankFilters.endDate) queryOptions.endDate = formatDateForQuery(bankFilters.endDate);
      if (bankFilters.searchText) queryOptions.searchText = bankFilters.searchText;
      if (bankFilters.category !== 'all') queryOptions.category = bankFilters.category;
      if (bankFilters.minAmount) queryOptions.minAmount = parseInt(bankFilters.minAmount, 10);
      if (bankFilters.maxAmount) queryOptions.maxAmount = parseInt(bankFilters.maxAmount, 10);

      console.log('[useTransactions] Loading bank transactions with options:', queryOptions);

      const result = await window.electron.financeHubDb.queryTransactions(queryOptions);

      if (result.success) {
        let txList = result.data || [];

        // Client-side filter for deposit/withdrawal type
        if (bankFilters.type === 'deposit') {
          txList = txList.filter((tx: Transaction) => tx.deposit > 0);
        } else if (bankFilters.type === 'withdrawal') {
          txList = txList.filter((tx: Transaction) => tx.withdrawal > 0);
        }

        // Filter out card transactions
        txList = txList.filter((tx: Transaction) => !tx.bankId.endsWith('-card'));

        setBankTransactions(txList);

        // Update pagination
        setPagination(prev => ({
          ...prev,
          totalCount: txList.length,
          totalPages: Math.ceil(txList.length / prev.pageSize) || 1,
        }));

        console.log(`[useTransactions] Loaded ${txList.length} bank transactions`);
      } else {
        setError(result.error || '거래내역을 불러오는데 실패했습니다.');
        console.error('[useTransactions] Query failed:', result.error);
      }

      // Also load stats with same filters
      const statsOptions: Record<string, any> = {};
      if (bankFilters.bankId !== 'all') statsOptions.bankId = bankFilters.bankId;
      if (bankFilters.accountId !== 'all') statsOptions.accountId = bankFilters.accountId;
      if (bankFilters.startDate) statsOptions.startDate = formatDateForQuery(bankFilters.startDate);
      if (bankFilters.endDate) statsOptions.endDate = formatDateForQuery(bankFilters.endDate);

      const statsResult = await window.electron.financeHubDb.getTransactionStats(statsOptions);
      if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        if (data.netChange === undefined) {
          data.netChange = data.totalDeposits - data.totalWithdrawals;
        }
        setBankStats(data);
      }

    } catch (err) {
      console.error('[useTransactions] Load failed:', err);
      setError('거래내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsBankLoading(false);
    }
  }, [bankFilters, pagination.currentPage, pagination.pageSize, sort]);

  // ============================================
  // Load Card Transactions
  // ============================================

  const loadCardTransactions = useCallback(async () => {
    setIsCardLoading(true);
    setError(null);

    try {
      // Build query options
      const queryOptions: Record<string, any> = {
        limit: pagination.pageSize,
        offset: (pagination.currentPage - 1) * pagination.pageSize,
        orderBy: sort.field === 'description' ? 'date' : sort.field,
        orderDir: sort.direction,
      };

      // Apply card filters
      if (cardFilters.bankId !== 'all') queryOptions.bankId = cardFilters.bankId;
      if (cardFilters.accountId !== 'all') queryOptions.accountId = cardFilters.accountId;
      if (cardFilters.startDate) queryOptions.startDate = formatDateForQuery(cardFilters.startDate);
      if (cardFilters.endDate) queryOptions.endDate = formatDateForQuery(cardFilters.endDate);
      if (cardFilters.searchText) queryOptions.searchText = cardFilters.searchText;
      if (cardFilters.category !== 'all') queryOptions.category = cardFilters.category;
      if (cardFilters.minAmount) queryOptions.minAmount = parseInt(cardFilters.minAmount, 10);
      if (cardFilters.maxAmount) queryOptions.maxAmount = parseInt(cardFilters.maxAmount, 10);

      console.log('[useTransactions] Loading card transactions with options:', queryOptions);

      const result = await window.electron.financeHubDb.queryTransactions(queryOptions);

      if (result.success) {
        let txList = result.data || [];

        // Client-side filter for deposit/withdrawal type
        if (cardFilters.type === 'deposit') {
          txList = txList.filter((tx: Transaction) => tx.deposit > 0);
        } else if (cardFilters.type === 'withdrawal') {
          txList = txList.filter((tx: Transaction) => tx.withdrawal > 0);
        }

        // Filter to only card transactions
        txList = txList.filter((tx: Transaction) => tx.bankId.endsWith('-card'));

        setCardTransactions(txList);

        // Update pagination
        setPagination(prev => ({
          ...prev,
          totalCount: txList.length,
          totalPages: Math.ceil(txList.length / prev.pageSize) || 1,
        }));

        console.log(`[useTransactions] Loaded ${txList.length} card transactions`);
      } else {
        setError(result.error || '거래내역을 불러오는데 실패했습니다.');
        console.error('[useTransactions] Query failed:', result.error);
      }

      // Also load stats with same filters
      const statsOptions: Record<string, any> = {};
      if (cardFilters.bankId !== 'all') statsOptions.bankId = cardFilters.bankId;
      if (cardFilters.accountId !== 'all') statsOptions.accountId = cardFilters.accountId;
      if (cardFilters.startDate) statsOptions.startDate = formatDateForQuery(cardFilters.startDate);
      if (cardFilters.endDate) statsOptions.endDate = formatDateForQuery(cardFilters.endDate);

      const statsResult = await window.electron.financeHubDb.getTransactionStats(statsOptions);
      if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        if (data.netChange === undefined) {
          data.netChange = data.totalDeposits - data.totalWithdrawals;
        }
        setCardStats(data);
      }

    } catch (err) {
      console.error('[useTransactions] Load failed:', err);
      setError('거래내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsCardLoading(false);
    }
  }, [cardFilters, pagination.currentPage, pagination.pageSize, sort]);

  // ============================================
  // Filter Setters
  // ============================================

  const setBankFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setBankFiltersState(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
  }, []);

  const setCardFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setCardFiltersState(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
  }, []);

  const resetBankFilters = useCallback(() => {
    setBankFiltersState(DEFAULT_FILTERS);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  const resetCardFilters = useCallback(() => {
    setCardFiltersState(DEFAULT_FILTERS);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // ============================================
  // Pagination Setters
  // ============================================
  
  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ 
      ...prev, 
      currentPage: Math.max(1, Math.min(page, prev.totalPages || 1))
    }));
  }, []);
  
  const setPageSize = useCallback((size: number) => {
    setPagination(prev => ({ ...prev, pageSize: size, currentPage: 1 }));
  }, []);

  // ============================================
  // Sort Setters
  // ============================================
  
  const toggleSort = useCallback((field: SortState['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // ============================================
  // Refresh All Data
  // ============================================
  
  const refreshAll = useCallback(async () => {
    console.log('[useTransactions] Refreshing all data...');
    await Promise.all([
      loadBanksAndAccounts(),
      loadRecentTransactions(10),
      loadBankTransactions(),
      loadCardTransactions(),
    ]);
  }, [loadBanksAndAccounts, loadRecentTransactions, loadBankTransactions, loadCardTransactions]);

  // ============================================
  // Initial Load
  // ============================================
  
  useEffect(() => {
    if (!isInitialized) {
      console.log('[useTransactions] Initial load...');
      loadBanksAndAccounts();
      loadRecentTransactions(10);
      loadStats();
      setIsInitialized(true);
    }
  }, [isInitialized, loadBanksAndAccounts, loadRecentTransactions, loadStats]);

  // NOTE: Auto-reload removed to support separate bank/card filters
  // TransactionsPage components will call loadTransactions() when needed
  // with their own filter parameters

  // ============================================
  // Return Hook API
  // ============================================

  return {
    // Data
    bankTransactions,
    cardTransactions,
    recentTransactions,
    stats, // Overall stats for dashboard
    bankStats,
    cardStats,
    monthlySummary,
    accounts,
    banks,

    // State
    bankFilters,
    cardFilters,
    pagination,
    sort,
    isBankLoading,
    isCardLoading,
    isLoadingRecent,
    isSyncing,
    error,

    // Filter Actions
    setBankFilters,
    setCardFilters,
    resetBankFilters,
    resetCardFilters,

    // Pagination Actions
    setPage,
    setPageSize,

    // Sort Actions
    toggleSort,

    // Data Actions
    loadBankTransactions,
    loadCardTransactions,
    loadRecentTransactions,
    loadAllTransactions,
    loadBanksAndAccounts,
    refreshAll,

    // Sync Actions
    setIsSyncing,
  };
}

export default useTransactions;
