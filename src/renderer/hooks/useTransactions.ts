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
  transactions: Transaction[];
  recentTransactions: Transaction[];
  stats: TransactionStats | null;
  monthlySummary: MonthlySummary[];
  accounts: BankAccount[];
  banks: Record<string, BankInfo>;
  
  // State
  filters: TransactionFilters;
  pagination: PaginationState;
  sort: SortState;
  isLoading: boolean;
  isLoadingRecent: boolean;
  isSyncing: string | null;
  error: string | null;
  
  // Filter Actions
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  
  // Pagination Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // Sort Actions
  toggleSort: (field: SortState['field']) => void;
  
  // Data Actions
  loadTransactions: () => Promise<void>;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Record<string, BankInfo>>(DEFAULT_BANK_INFO);
  
  // === Filter & Pagination State ===
  const [filters, setFiltersState] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  
  // === Loading State ===
  const [isLoading, setIsLoading] = useState(false);
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
      const activeFilters = { ...filters, ...filterOverrides };
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
  }, [filters]);

  // ============================================
  // Load Filtered Transactions (for Full View)
  // ============================================
  
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query options
      const queryOptions: Record<string, any> = {
        limit: pagination.pageSize,
        offset: (pagination.currentPage - 1) * pagination.pageSize,
        orderBy: sort.field === 'description' ? 'date' : sort.field,
        orderDir: sort.direction,
      };
      
      // Apply filters
      if (filters.bankId !== 'all') queryOptions.bankId = filters.bankId;
      if (filters.accountId !== 'all') queryOptions.accountId = filters.accountId;
      if (filters.startDate) queryOptions.startDate = formatDateForQuery(filters.startDate);
      if (filters.endDate) queryOptions.endDate = formatDateForQuery(filters.endDate);
      if (filters.searchText) queryOptions.searchText = filters.searchText;
      if (filters.category !== 'all') queryOptions.category = filters.category;
      if (filters.minAmount) queryOptions.minAmount = parseInt(filters.minAmount, 10);
      if (filters.maxAmount) queryOptions.maxAmount = parseInt(filters.maxAmount, 10);
      
      console.log('[useTransactions] Querying with options:', queryOptions);
      
      const result = await window.electron.financeHubDb.queryTransactions(queryOptions);
      
      if (result.success) {
        let txList = result.data || [];
        
        // Client-side filter for deposit/withdrawal type (if not supported in backend)
        if (filters.type === 'deposit') {
          txList = txList.filter((tx: Transaction) => tx.deposit > 0);
        } else if (filters.type === 'withdrawal') {
          txList = txList.filter((tx: Transaction) => tx.withdrawal > 0);
        }
        
        setTransactions(txList);
        
        // Update pagination
        setPagination(prev => ({
          ...prev,
          totalCount: txList.length,
          totalPages: Math.ceil(txList.length / prev.pageSize) || 1,
        }));
        
        console.log(`[useTransactions] Loaded ${txList.length} transactions`);
      } else {
        setError(result.error || '거래내역을 불러오는데 실패했습니다.');
        console.error('[useTransactions] Query failed:', result.error);
      }
      
      // Also load stats with same filters
      await loadStats();
      
    } catch (err) {
      console.error('[useTransactions] Load failed:', err);
      setError('거래내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.pageSize, sort, loadStats]);

  // ============================================
  // Filter Setters
  // ============================================
  
  const setFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
  }, []);
  
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
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
      loadTransactions(),
    ]);
  }, [loadBanksAndAccounts, loadRecentTransactions, loadTransactions]);

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

  // Reload transactions when filters/pagination/sort change (after initialization)
  useEffect(() => {
    if (isInitialized) {
      loadTransactions();
    }
  }, [isInitialized, filters, pagination.currentPage, pagination.pageSize, sort]);

  // ============================================
  // Return Hook API
  // ============================================
  
  return {
    // Data
    transactions,
    recentTransactions,
    stats,
    monthlySummary,
    accounts,
    banks,
    
    // State
    filters,
    pagination,
    sort,
    isLoading,
    isLoadingRecent,
    isSyncing,
    error,
    
    // Filter Actions
    setFilters,
    resetFilters,
    
    // Pagination Actions
    setPage,
    setPageSize,
    
    // Sort Actions
    toggleSort,
    
    // Data Actions
    loadTransactions,
    loadRecentTransactions,
    loadAllTransactions,
    loadBanksAndAccounts,
    refreshAll,
    
    // Sync Actions
    setIsSyncing,
  };
}

export default useTransactions;
