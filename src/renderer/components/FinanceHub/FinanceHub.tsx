// ============================================
// Finance Hub - Main Component (Refactored)
// Korean Banking Automation Dashboard
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import './FinanceHub.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSync, 
  faTimes, 
  faBank, 
  faChartLine, 
  faPlus, 
  faWallet,
  faLink,
  faUnlink,
  faExchangeAlt,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faSpinner,
  faTrash
} from '@fortawesome/free-solid-svg-icons';

// Hooks
import { useTransactions } from '../../hooks/useTransactions';
import { FullDiskAccessWarning } from '../../hooks/useFullDiskAccess';

// Shared Components
import { TransactionTable, TransactionStats, TaxInvoiceTable, TaxInvoiceFilters, TaxInvoiceStats } from './shared';
import type { TaxInvoiceFiltersType, TaxInvoiceStatsData } from './shared';
import TaxInvoicesPage from './TaxInvoicesPage';
import { SchedulerSettings } from './SchedulerSettings';

// Types & Utils
import {
  BankConfig,
  ConnectedBank,
  BankCredentials,
  CardConfig,
  ConnectedCard,
  CardCredentials,
  DbStats,
  SyncOperation,
  KOREAN_BANKS,
  KOREAN_CARD_COMPANIES,
  CATEGORY_LABELS,
  CARD_CATEGORY_LABELS,
} from './types';
import { formatAccountNumber, formatCurrency, getBankInfo } from './utils';
import { GOOGLE_OAUTH_SCOPES_STRING } from '../../constants/googleScopes';

// Sub-component
import TransactionsPage from './TransactionsPage';

// ============================================
// Main Component
// ============================================

const FinanceHub: React.FC = () => {
  // ============================================
  // Transactions Hook (Centralized State)
  // ============================================
  
  const {
    recentTransactions,
    bankTransactions,
    cardTransactions,
    stats,
    bankStats,
    cardStats,
    monthlySummary,
    accounts,
    banks,
    bankFilters,
    cardFilters,
    pagination,
    sort,
    isBankLoading,
    isCardLoading,
    isLoadingRecent,
    isSyncing,
    error,
    setBankFilters,
    setCardFilters,
    resetBankFilters,
    resetCardFilters,
    setPage,
    toggleSort,
    loadBankTransactions,
    loadCardTransactions,
    loadBanksAndAccounts,
    loadAllTransactions,
    refreshAll,
    setIsSyncing,
  } = useTransactions();

  // ============================================
  // Local State
  // ============================================
  
  const [currentView, setCurrentView] = useState<'account-management' | 'bank-transactions' | 'card-transactions' | 'tax-invoices' | 'tax-management'>('account-management');
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankConfig | null>(null);
  const [bankAuthMethod, setBankAuthMethod] = useState<'certificate' | 'id' | null>(null);
  const [credentials, setCredentials] = useState<BankCredentials>({ bankId: '', userId: '', password: '', certificatePassword: '', accountType: 'personal' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState<string | null>(null);
  const [connectionProgress, setConnectionProgress] = useState<string>('');
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [manualPasswordMode, setManualPasswordMode] = useState(false);
  const [showManualPasswordContinue, setShowManualPasswordContinue] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLoading, setDebugLoading] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [recentSyncOps, setRecentSyncOps] = useState<SyncOperation[]>([]);
  const [showSyncOptions, setShowSyncOptions] = useState<string | null>(null); // accountNumber that's showing options
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // Card-related state
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectedCardCategory, setSelectedCardCategory] = useState<string>('all');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardConfig | null>(null);
  const [cardAuthMethod, setCardAuthMethod] = useState<'certificate' | 'id' | null>(null);
  const [cardCredentials, setCardCredentials] = useState<CardCredentials>({ cardCompanyId: '', userId: '', password: '', accountType: 'personal' });
  const [isConnectingCard, setIsConnectingCard] = useState(false);
  const [cardConnectionProgress, setCardConnectionProgress] = useState<string>('');
  const [saveCardCredentials, setSaveCardCredentials] = useState(true);
  const [isSyncingCard, setIsSyncingCard] = useState<string | null>(null);
  const [showCardSyncOptions, setShowCardSyncOptions] = useState<string | null>(null); // cardNumber showing options

  // Hometax-related state
  const [connectedBusinesses, setConnectedBusinesses] = useState<any[]>([]);
  const [showHometaxModal, setShowHometaxModal] = useState(false);
  const [hometaxAuthMethod, setHometaxAuthMethod] = useState<'certificate' | 'id' | null>(null);
  const [availableCertificates, setAvailableCertificates] = useState<any[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);
  const [savedCertificates, setSavedCertificates] = useState<Record<string, any>>({});
  const [hometaxCredentials, setHometaxCredentials] = useState({
    businessNumber: '',
    certificatePassword: '',
    userId: '',
    password: ''
  });
  const [isConnectingHometax, setIsConnectingHometax] = useState(false);
  const [hometaxConnectionProgress, setHometaxConnectionProgress] = useState<string>('');
  const [saveHometaxCredentials, setSaveHometaxCredentials] = useState(true);

  // Tax invoice list state
  const [taxInvoiceType, setTaxInvoiceType] = useState<'sales' | 'purchase' | 'cash-receipt'>('sales');
  const [taxInvoices, setTaxInvoices] = useState<any[]>([]);
  const [isLoadingTaxInvoices, setIsLoadingTaxInvoices] = useState(false);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState<string>('all');
  const [taxInvoiceSort, setTaxInvoiceSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '작성일자', direction: 'desc' });
  const [showTaxFilters, setShowTaxFilters] = useState(false);
  const [taxSalesSpreadsheetUrl, setTaxSalesSpreadsheetUrl] = useState<string | null>(null);
  const [taxPurchaseSpreadsheetUrl, setTaxPurchaseSpreadsheetUrl] = useState<string | null>(null);
  const [cashReceiptSpreadsheetUrl, setCashReceiptSpreadsheetUrl] = useState<string | null>(null);
  const [taxInvoiceFilters, setTaxInvoiceFilters] = useState<TaxInvoiceFiltersType>({
    businessNumber: 'all',
    searchText: '',
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    endDate: new Date().toISOString().split('T')[0], // Today
    minAmount: '',
    maxAmount: '',
    classification: 'all',
    companyName: 'all',
  });

  // Tax invoice Google auth state
  const [showTaxGoogleAuth, setShowTaxGoogleAuth] = useState(false);
  const [signingInTaxGoogle, setSigningInTaxGoogle] = useState(false);

  // Arduino port settings state
  const [arduinoPort, setArduinoPort] = useState<string>('COM3');
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);
  const [isDetectingArduino, setIsDetectingArduino] = useState(false);
  const [arduinoStatus, setArduinoStatus] = useState<'unknown' | 'detected' | 'not-found'>('unknown');

  // ============================================
  // Computed Values
  // ============================================

  const totalAccounts = connectedBanks.reduce((sum, bank) => sum + (bank.accounts?.length || 0), 0);
  const totalCards = connectedCards.reduce((sum, cardCompany) => sum + (cardCompany.cards?.length || 0), 0);

  const filteredBanks = KOREAN_BANKS.filter((bank) => {
    const matchesCategory = selectedCategory === 'all' || bank.category === selectedCategory;
    const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) || bank.nameKo.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const filteredCards = KOREAN_CARD_COMPANIES.filter((card) => {
    const matchesCategory = selectedCardCategory === 'all' || card.category === selectedCardCategory;
    const matchesSearch = card.name.toLowerCase().includes(cardSearchQuery.toLowerCase()) || card.nameKo.includes(cardSearchQuery);
    return matchesCategory && matchesSearch;
  });

  // Filter and sort tax invoices
  const filteredAndSortedTaxInvoices = React.useMemo(() => {
    let filtered = [...taxInvoices];

    // Apply filters
    if (taxInvoiceFilters.businessNumber !== 'all') {
      filtered = filtered.filter(inv => inv.business_number === taxInvoiceFilters.businessNumber);
    }

    if (taxInvoiceFilters.searchText) {
      const search = taxInvoiceFilters.searchText.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.공급자상호?.toLowerCase().includes(search) ||
        inv.공급받는자상호?.toLowerCase().includes(search) ||
        inv.품목명?.toLowerCase().includes(search) ||
        inv.승인번호?.toLowerCase().includes(search)
      );
    }

    if (taxInvoiceFilters.startDate) {
      filtered = filtered.filter(inv => inv.작성일자 >= taxInvoiceFilters.startDate);
    }

    if (taxInvoiceFilters.endDate) {
      filtered = filtered.filter(inv => inv.작성일자 <= taxInvoiceFilters.endDate);
    }

    if (taxInvoiceFilters.minAmount) {
      const min = parseInt(taxInvoiceFilters.minAmount);
      filtered = filtered.filter(inv => inv.합계금액 >= min);
    }

    if (taxInvoiceFilters.maxAmount) {
      const max = parseInt(taxInvoiceFilters.maxAmount);
      filtered = filtered.filter(inv => inv.합계금액 <= max);
    }

    if (taxInvoiceFilters.classification !== 'all') {
      filtered = filtered.filter(inv => inv.전자세금계산서분류 === taxInvoiceFilters.classification);
    }

    if (taxInvoiceFilters.companyName !== 'all') {
      const field = taxInvoiceType === 'sales' ? '공급받는자상호' : '공급자상호';
      filtered = filtered.filter(inv => inv[field] === taxInvoiceFilters.companyName);
    }

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      const key = taxInvoiceSort.key;
      const direction = taxInvoiceSort.direction === 'asc' ? 1 : -1;

      const aVal = a[key];
      const bVal = b[key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, 'ko-KR') * direction;
      }

      return 0;
    });

    return sorted;
  }, [taxInvoices, taxInvoiceFilters, taxInvoiceSort, taxInvoiceType]);

  // Calculate tax invoice stats
  const taxInvoiceStats: TaxInvoiceStatsData = React.useMemo(() => {
    return {
      totalInvoices: filteredAndSortedTaxInvoices.length,
      totalSupplyAmount: filteredAndSortedTaxInvoices.reduce((sum, inv) => sum + (inv.공급가액 || 0), 0),
      totalTaxAmount: filteredAndSortedTaxInvoices.reduce((sum, inv) => sum + (inv.세액 || 0), 0),
      totalAmount: filteredAndSortedTaxInvoices.reduce((sum, inv) => sum + (inv.합계금액 || 0), 0),
    };
  }, [filteredAndSortedTaxInvoices]);

  // ============================================
  // Database Stats Loading
  // ============================================

  const loadDatabaseStats = async () => {
    try {
      const result = await window.electron.financeHubDb.getOverallStats();
      if (result.success) setDbStats(result.data);
    } catch (error) {
      console.error('[FinanceHub] Failed to load DB stats:', error);
    }
  };

  const loadRecentSyncOperations = async () => {
    try {
      const result = await window.electron.financeHubDb.getRecentSyncOperations(10);
      if (result.success) setRecentSyncOps(result.data || []);
    } catch (error) {
      console.error('[FinanceHub] Failed to load sync operations:', error);
    }
  };

  // ============================================
  // Initial Load
  // ============================================

  useEffect(() => {
    loadDatabaseStats();
    loadRecentSyncOperations();
    checkExistingConnections();
    checkExistingCardConnections();
    loadConnectedBusinesses();
  }, []);

  // Manual password mode listener
  useEffect(() => {
    const cleanupShow = window.electron.financeHub.manualPassword.onShowContinue(() => {
      console.log('[Manual Password] Show continue modal');
      setShowManualPasswordContinue(true);
    });

    const cleanupHide = window.electron.financeHub.manualPassword.onHideContinue(() => {
      console.log('[Manual Password] Hide continue modal');
      setShowManualPasswordContinue(false);
    });

    return () => {
      cleanupShow();
      cleanupHide();
    };
  }, []);

  // Load Arduino port on mount
  useEffect(() => {
    loadArduinoPort();
  }, []);

  // Arduino Port Functions
  const loadArduinoPort = async () => {
    try {
      const result = await window.electron.financeHub.arduino.getPort();
      if (result.success) {
        setArduinoPort(result.port);
        setArduinoStatus(result.autoDetected ? 'detected' : 'unknown');
      }
    } catch (error) {
      console.error('Error loading Arduino port:', error);
    }
  };

  const detectArduinoPort = async () => {
    setIsDetectingArduino(true);
    try {
      const result = await window.electron.financeHub.arduino.getPort();
      if (result.success) {
        setArduinoPort(result.port);
        setArduinoStatus(result.autoDetected ? 'detected' : 'not-found');
        if (!result.autoDetected) {
          // Also list all available ports for manual selection
          const portsResult = await window.electron.financeHub.arduino.listPorts();
          if (portsResult.success) {
            setAvailablePorts(portsResult.ports);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting Arduino port:', error);
      setArduinoStatus('not-found');
    } finally {
      setIsDetectingArduino(false);
    }
  };

  const updateArduinoPort = async (port: string) => {
    try {
      const result = await window.electron.financeHub.arduino.setPort(port);
      if (result.success) {
        setArduinoPort(port);
        setArduinoStatus('unknown');
      }
    } catch (error) {
      console.error('Error updating Arduino port:', error);
    }
  };

  const loadConnectedBusinesses = async () => {
    try {
      const allSavedCerts = await window.electron.hometax.getAllSavedCertificates();
      if (allSavedCerts.success && allSavedCerts.data) {
        const businesses = await Promise.all(
          Object.entries(allSavedCerts.data).map(async ([businessNumber, certData]: [string, any]) => {
            // Get actual counts from database
            const salesResult = await window.electron.hometax.getInvoices({
              businessNumber,
              invoiceType: 'sales'
            });
            const purchaseResult = await window.electron.hometax.getInvoices({
              businessNumber,
              invoiceType: 'purchase'
            });
            const cashReceiptsResult = await window.electron.hometax.getCashReceipts({
              businessNumber
            });

            return {
              businessNumber,
              businessName: certData.businessName || businessNumber,
              representativeName: certData.representativeName,
              businessType: certData.businessType,
              status: 'connected',
              lastSync: certData.savedAt ? new Date(certData.savedAt) : undefined,
              salesCount: salesResult.success ? (salesResult.total || 0) : 0,
              purchaseCount: purchaseResult.success ? (purchaseResult.total || 0) : 0,
              cashReceiptCount: cashReceiptsResult.success ? (cashReceiptsResult.total || 0) : 0,
              소유자명: certData.소유자명,
              용도: certData.용도,
              발급기관: certData.발급기관,
              만료일: certData.만료일
            };
          })
        );
        setConnectedBusinesses(businesses);
      }
    } catch (error) {
      console.error('[FinanceHub] Error loading connected businesses:', error);
    }
  };

  const checkExistingConnections = async () => {
    try {
      const savedResult = await window.electron.financeHubDb.getAllAccounts();
      let savedBanks: ConnectedBank[] = [];

      if (savedResult.success && savedResult.data && savedResult.data.length > 0) {
        // Group accounts by bankId
        const accountsByBank = savedResult.data.reduce((acc: any, account: any) => {
          const bankId = account.bankId;
          if (!acc[bankId]) {
            acc[bankId] = [];
          }
          acc[bankId].push({
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            bankId: account.bankId,
            balance: account.balance,
            currency: account.currency || 'KRW',
            lastUpdated: account.lastSyncedAt
          });
          return acc;
        }, {});

        // Create ConnectedBank entries for each bank
        for (const [bankId, accounts] of Object.entries(accountsByBank)) {
          const firstAccount = savedResult.data.find((acc: any) => acc.bankId === bankId);

          // Data Migration: Set accountType to 'personal' for legacy accounts
          let accountType: 'personal' | 'corporate' = 'personal';
          try {
            const credResult = await window.electron.financeHub.getSavedCredentials(bankId);
            if (credResult.success && credResult.credentials?.accountType) {
              accountType = credResult.credentials.accountType;
            }
          } catch (error) {
            console.log(`[Migration] Using default accountType 'personal' for ${bankId}`);
          }

          savedBanks.push({
            bankId: bankId,
            status: 'disconnected',
            alias: firstAccount?.customerName || '',
            lastSync: firstAccount?.lastSyncedAt ? new Date(firstAccount.lastSyncedAt) : new Date(),
            accounts: accounts as any[],
            accountType: accountType // Migration: defaults to 'personal'
          });
        }
      }

      const connectedBanksList = await window.electron.financeHub.getConnectedBanks();

      const mergedBanks = savedBanks.map(bank => {
        const isActive = connectedBanksList?.find((s: any) => s.bankId === bank.bankId);
        return isActive ? { ...bank, status: 'connected' as const, alias: isActive.userName || bank.alias } : bank;
      });

      if (connectedBanksList && connectedBanksList.length > 0) {
        connectedBanksList.forEach((active: any) => {
          if (!mergedBanks.find(b => b.bankId === active.bankId)) {
            // Migration: New active connection defaults to 'personal'
            mergedBanks.push({
              bankId: active.bankId,
              status: 'connected',
              alias: active.userName,
              lastSync: new Date(),
              accounts: [],
              accountType: 'personal'
            });
          }
        });
      }

      setConnectedBanks(mergedBanks);
    } catch (error) {
      console.error('[FinanceHub] Failed to check existing connections:', error);
    }
  };

  const checkExistingCardConnections = async () => {
    try {
      const savedResult = await window.electron.financeHubDb.getAllAccounts();
      let savedCards: ConnectedCard[] = [];

      if (savedResult.success && savedResult.data && savedResult.data.length > 0) {
        // Get list of valid card company IDs
        const cardCompanyIds = KOREAN_CARD_COMPANIES.map(card => card.id);

        // Filter for card accounts only (where bankId is a card company)
        const cardAccounts = savedResult.data.filter((account: any) =>
          cardCompanyIds.includes(account.bankId)
        );

        if (cardAccounts.length > 0) {
          // Group cards by cardCompanyId
          const cardsByCompany = cardAccounts.reduce((acc: any, account: any) => {
            const cardCompanyId = account.bankId; // For cards, bankId is the card company ID
            if (!acc[cardCompanyId]) {
              acc[cardCompanyId] = [];
            }
            acc[cardCompanyId].push({
              cardNumber: account.accountNumber,
              cardName: account.accountName,
              cardCompanyId: account.bankId,
              balance: account.balance,
              lastUpdated: account.lastSyncedAt
            });
            return acc;
          }, {});

          // Create ConnectedCard entries for each card company
          for (const [cardCompanyId, cards] of Object.entries(cardsByCompany)) {
            const firstCard = cardAccounts.find((acc: any) => acc.bankId === cardCompanyId);

            // Get accountType from saved credentials
            let accountType: 'personal' | 'corporate' = 'personal';
            try {
              const credResult = await window.electron.financeHub.getSavedCredentials(cardCompanyId);
              if (credResult.success && credResult.credentials?.accountType) {
                accountType = credResult.credentials.accountType;
              }
              // Migration: BC Card and Shinhan Card should always be corporate
              if ((cardCompanyId === 'bc-card' || cardCompanyId === 'shinhan-card') && accountType === 'personal') {
                console.log(`[Card Migration] Migrating ${cardCompanyId} from personal to corporate`);
                accountType = 'corporate';
                // Update saved credentials if they exist
                if (credResult.success && credResult.credentials) {
                  await window.electron.financeHub.saveCredentials(cardCompanyId, {
                    ...credResult.credentials,
                    accountType: 'corporate'
                  });
                }
              }
            } catch (error) {
              console.log(`[Card Load] Using default accountType 'personal' for ${cardCompanyId}`);
              // BC Card and Shinhan Card default to corporate even on error
              if (cardCompanyId === 'bc-card' || cardCompanyId === 'shinhan-card') {
                accountType = 'corporate';
              }
            }

            savedCards.push({
              cardCompanyId: cardCompanyId,
              status: 'disconnected',
              alias: firstCard?.customerName || '',
              lastSync: firstCard?.lastSyncedAt ? new Date(firstCard.lastSyncedAt) : new Date(),
              cards: cards as any[],
              accountType: accountType
            });
          }

          console.log(`[FinanceHub] Loaded ${savedCards.length} card companies with ${cardAccounts.length} total cards from database`);
        }
      }

      // Check for active card connections (currently open browser sessions)
      // Note: getConnectedBanks only returns bank connections, not cards
      // For cards, we rely on saved data from database only

      setConnectedCards(savedCards);
    } catch (error) {
      console.error('[FinanceHub] Failed to check existing card connections:', error);
    }
  };

  // ============================================
  // Bank Connection Handlers
  // ============================================

  const getBankConfigById = (id: string): BankConfig | undefined => {
    // Map nh-business to nh for display purposes (same bank, different auth method)
    const lookupId = id === 'nh-business' ? 'nh' : id;
    return KOREAN_BANKS.find(bank => bank.id === lookupId);
  };
  const getCardConfigById = (id: string): CardConfig | undefined => KOREAN_CARD_COMPANIES.find(card => card.id === id);

  // Function to reload connected banks
  const loadConnectedBanks = async () => {
    await checkExistingConnections();
  };

  // Function to reload connected cards
  const loadConnectedCards = async () => {
    await checkExistingCardConnections();
  };

  const handleReconnect = async (bankId: string) => {
    const bank = getBankConfigById(bankId);
    try {
      setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'pending' as const } : b));
      const credResult = await window.electron.financeHub.getSavedCredentials(bankId);
      
      if (!credResult.success || !credResult.credentials) {
        setSelectedBank(bank || null);
        setShowBankSelector(true);
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'disconnected' as const } : b));
        return;
      }

      const loginResult = await window.electron.financeHub.loginAndGetAccounts(bankId, { userId: credResult.credentials.userId, password: credResult.credentials.password });

      if (loginResult.success && loginResult.isLoggedIn) {
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? {
          ...b,
          status: 'connected' as const,
          alias: loginResult.userName || b.alias,
          accounts: loginResult.accounts || b.accounts,
          lastSync: new Date(),
          accountType: credResult.credentials.accountType || b.accountType || 'personal'
        } : b));
        alert(`✅ ${bank?.nameKo || bankId} 재연결 성공!`);
      } else {
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'error' as const } : b));
        alert(`${bank?.nameKo || bankId} 재연결 실패: ${loginResult.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[FinanceHub] Reconnect error:', error);
      setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'error' as const } : b));
      alert(`재연결 중 오류가 발생했습니다: ${error}`);
    }
  };

  // ============================================
  // Sync Transactions Handler
  // ============================================

  // Date range helper
  const getDateRange = (period: 'day' | 'week' | 'month' | '3months' | '6months' | 'year') => {
    const today = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(today.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(today.getMonth() - 6);
        break;
      case 'year':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
    }
    
    const formatDateStr = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
    return {
      startDate: formatDateStr(startDate),
      endDate: formatDateStr(today)
    };
  };

  // ============================================
  // Auto-Update Spreadsheet Helper
  // ============================================

  const autoUpdateSpreadsheet = async (transactionType: 'bank' | 'card') => {
    try {
      const spreadsheetKey = transactionType === 'bank' ? 'bank-spreadsheet' : 'card-spreadsheet';
      const persistentResult = await window.electron.financeHub.getPersistentSpreadsheet(spreadsheetKey);

      if (!persistentResult.success || !persistentResult.persistentSpreadsheet?.spreadsheetId) {
        // No persistent spreadsheet exists, skip auto-update
        return { updated: false };
      }

      const spreadsheetId = persistentResult.persistentSpreadsheet.spreadsheetId;

      // Load all transactions for this type
      const transactionsResult = await window.electron.financeHubDb.queryTransactions({
        limit: 100000, // Load all
      });

      if (!transactionsResult.success || !transactionsResult.data) {
        throw new Error('Failed to load transactions');
      }

      const allTransactions = transactionsResult.data;

      // Filter by transaction type
      const filteredTransactions = allTransactions.filter((tx: any) => {
        const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : tx.metadata;
        const isCardTx = metadata?.isCardTransaction === true;
        return transactionType === 'card' ? isCardTx : !isCardTx;
      });

      // Get banks and accounts data
      const banksResult = await window.electron.financeHubDb.getAllBanks();
      const accountsResult = await window.electron.financeHubDb.getAllAccounts();

      const banks = (banksResult.data || []).reduce((acc: any, bank: any) => {
        acc[bank.id] = bank;
        return acc;
      }, {});

      const accounts = accountsResult.data || [];

      // Update the spreadsheet
      await (window as any).electron.sheets.getOrCreateTransactionsSpreadsheet({
        transactions: filteredTransactions,
        banks,
        accounts,
        persistentSpreadsheetId: spreadsheetId,
      });

      return { updated: true, count: filteredTransactions.length };
    } catch (error) {
      console.error('[AutoUpdate] Failed to update spreadsheet:', error);
      return { updated: false, error };
    }
  };

  // ============================================
  // Auto-Cleanup Downloaded Files
  // ============================================

  const cleanupDownloadedFiles = async (bankOrCardId: string) => {
    try {
      const result = await (window as any).electron.financeHub.cleanupDownloadedFiles(bankOrCardId);
      if (result.success) {
        console.log(`[Cleanup] Deleted ${result.deletedCount} files for ${bankOrCardId}`);
        return { cleaned: true, count: result.deletedCount };
      }
      return { cleaned: false };
    } catch (error) {
      console.error('[Cleanup] Failed to cleanup files:', error);
      return { cleaned: false, error };
    }
  };

  const handleSyncAndSaveTransactions = async (bankId: string, accountNumber: string, period: 'day' | 'week' | 'month' | '3months' | '6months' | 'year' = '3months') => {
    setIsSyncing(accountNumber);
    try {
      const connection = connectedBanks.find(b => b.bankId === bankId);
      
      if (!connection || connection.status === 'disconnected' || connection.status === 'error') {
        const credResult = await window.electron.financeHub.getSavedCredentials(bankId);
        if (!credResult.success || !credResult.credentials) {
          alert(`세션이 만료되었습니다. 저장된 인증 정보가 없습니다.`);
          return;
        }

        const loginResult = await window.electron.financeHub.login(bankId, { userId: credResult.credentials.userId, password: credResult.credentials.password });
        if (!loginResult.success || !loginResult.isLoggedIn) {
          alert(`자동 재연결 실패: ${loginResult.error}`);
          return;
        }
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? {
          ...b,
          status: 'connected' as const,
          alias: loginResult.userName || b.alias,
          lastSync: new Date(),
          accountType: credResult.credentials.accountType || b.accountType || 'personal'
        } : b));
      }

      const { startDate, endDate } = getDateRange(period);
      const result = await window.electron.financeHub.getTransactions(bankId, accountNumber, startDate, endDate, true);
      if (!result.success) throw new Error(result.error || 'Failed to fetch transactions');

      const connectedBank = connectedBanks.find(b => b.bankId === bankId);
      const accountInfo = connectedBank?.accounts?.find(a => a.accountNumber === accountNumber);

      const accountData = {
        accountNumber,
        accountName: accountInfo?.accountName || '계좌',
        customerName: connectedBank?.alias || '',
        balance: result.metadata?.balance || accountInfo?.balance || 0,
        availableBalance: result.metadata?.availableBalance || 0,
        openDate: result.metadata?.openDate || '',
      };

      const transactionsData = (result.transactions || []).map((tx: any) => ({
        date: tx.date ? tx.date.replace(/[-.]/g, '') : '',
        time: tx.time || '',
        type: tx.type || '',
        withdrawal: tx.withdrawal || 0,
        deposit: tx.deposit || 0,
        description: tx.description || '',
        balance: tx.balance || 0,
        branch: tx.branch || '',
      }));

      const syncMetadata = { queryPeriodStart: startDate, queryPeriodEnd: endDate, excelFilePath: result.file || result.filename };
      const importResult = await window.electron.financeHubDb.importTransactions(bankId, accountData, transactionsData, syncMetadata);

      if (importResult.success) {
        const { inserted, skipped } = importResult.data;
        await Promise.all([loadDatabaseStats(), loadRecentSyncOperations(), refreshAll()]);
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'connected' as const, lastSync: new Date() } : b));

        // Auto-update spreadsheet if it exists
        const spreadsheetUpdate = await autoUpdateSpreadsheet('bank');
        let spreadsheetMsg = spreadsheetUpdate.updated
          ? '\n\n📊 스프레드시트 자동 업데이트 완료!'
          : '';

        // Cleanup downloaded files after successful spreadsheet update
        if (spreadsheetUpdate.updated) {
          const cleanup = await cleanupDownloadedFiles(bankId);
          if (cleanup.cleaned && cleanup.count > 0) {
            spreadsheetMsg += `\n🗑️ 다운로드 파일 ${cleanup.count}개 정리 완료`;
          }
        }

        alert(`✅ 거래내역 동기화 완료!\n\n• 새로 추가: ${inserted}건\n• 중복 건너뜀: ${skipped}건${spreadsheetMsg}`);
      } else {
        throw new Error(importResult.error);
      }
    } catch (error: any) {
      console.error('[FinanceHub] Sync error:', error);
      alert(`거래내역 동기화 실패: ${error?.message || error}`);
    } finally {
      setIsSyncing(null);
    }
  };

  // ============================================
  // Card Sync Handler
  // ============================================

  const handleSyncCardTransactions = async (cardCompanyId: string, cardNumber: string, period: 'day' | 'week' | 'month' | '3months' | '6months' | 'year' = '3months') => {
    // For Shinhan Card and BC Card, use connection ID as sync state (fetches all cards at once)
    const syncStateKey = (cardCompanyId === 'bc-card' || cardCompanyId === 'shinhan-card') ? cardCompanyId : cardNumber;
    setIsSyncingCard(syncStateKey);
    try {
      // Shinhan Card has strict ~7 day limit, limit to week max
      // BC Card has strict 30-day limit, so use day-based calculation instead of month-based
      let dateRange;
      if (cardCompanyId === 'shinhan-card') {
        // Shinhan Card: Max 7 days
        if (!['day', 'week'].includes(period)) {
          alert('신한카드는 최대 7일까지만 조회 가능합니다.');
          return;
        }
        dateRange = getDateRange(period);
      } else if (cardCompanyId === 'bc-card' && period === 'month') {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 30); // Exactly 30 days
        const formatDateStr = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
        dateRange = { startDate: formatDateStr(start), endDate: formatDateStr(today) };
      } else {
        dateRange = getDateRange(period);
      }

      const { startDate, endDate } = dateRange;

      const result = await window.electron.financeHub.card.getTransactions(
        cardCompanyId,
        cardNumber, // For Shinhan Card, this is ignored - fetches all cards
        startDate,
        endDate
      );

      if (!result.success || !result.transactions) {
        throw new Error(result.error || '거래내역 조회 실패');
      }

      // Card transactions data
      const transactionsData = result.transactions[0]?.extractedData?.transactions || [];

      if (transactionsData.length === 0) {
        alert('조회된 거래내역이 없습니다.');
        return;
      }

      const cardConnection = connectedCards.find(c => c.cardCompanyId === cardCompanyId);

      // For Shinhan Card, transactions are for ALL cards - group by card and import separately
      if (cardCompanyId === 'shinhan-card') {
        console.log('[Shinhan Card] Processing transactions for all cards...');

        // Group transactions by card number (이용카드 or cardUsed column)
        const transactionsByCard = new Map();

        transactionsData.forEach((tx: any) => {
          const txCardNumber = tx['이용카드'] || tx.cardUsed || 'unknown';
          if (!transactionsByCard.has(txCardNumber)) {
            transactionsByCard.set(txCardNumber, []);
          }
          transactionsByCard.get(txCardNumber).push(tx);
        });

        console.log(`[Shinhan Card] Found transactions for ${transactionsByCard.size} different cards`);
        console.log('[Shinhan Card] Card numbers:', Array.from(transactionsByCard.keys()));

        let totalInserted = 0;
        let totalSkipped = 0;

        // Import transactions for each card separately
        for (const [txCardNumber, cardTransactions] of transactionsByCard.entries()) {
          const cardInfo = cardConnection?.cards?.find(c => c.cardNumber.includes(txCardNumber) || txCardNumber.includes(c.cardNumber));

          const accountData = {
            accountNumber: txCardNumber,
            accountName: cardInfo?.cardName || `신한카드 ${txCardNumber}`,
            customerName: cardConnection?.alias || '',
            balance: 0,
          };

          console.log(`[Shinhan Card] Importing ${cardTransactions.length} transactions for card ${txCardNumber}`);
          console.log('[Shinhan Card] Account data:', accountData);
          console.log('[Shinhan Card] Sample transaction:', cardTransactions[0]);

          const syncMetadata = {
            queryPeriodStart: startDate,
            queryPeriodEnd: endDate,
            excelFilePath: result.transactions[0]?.path || '',
          };

          const importResult = await window.electron.financeHubDb.importTransactions(
            cardCompanyId,
            accountData,
            cardTransactions,
            syncMetadata,
            true  // isCard flag
          );

          console.log(`[Shinhan Card] Import result for ${txCardNumber}:`, importResult);

          if (importResult.success) {
            totalInserted += importResult.data.inserted || 0;
            totalSkipped += importResult.data.skipped || 0;
          }
        }

        await Promise.all([
          loadDatabaseStats(),
          loadRecentSyncOperations(),
          refreshAll()
        ]);

        setConnectedCards(prev => prev.map(c =>
          c.cardCompanyId === cardCompanyId ? { ...c, lastSync: new Date() } : c
        ));

        // Auto-update spreadsheet if it exists
        const spreadsheetUpdate = await autoUpdateSpreadsheet('card');
        let spreadsheetMsg = spreadsheetUpdate.updated
          ? '\n\n📊 스프레드시트 자동 업데이트 완료!'
          : '';

        // Cleanup downloaded files after successful spreadsheet update
        if (spreadsheetUpdate.updated) {
          const cleanup = await cleanupDownloadedFiles(cardCompanyId);
          if (cleanup.cleaned && cleanup.count > 0) {
            spreadsheetMsg += `\n🗑️ 다운로드 파일 ${cleanup.count}개 정리 완료`;
          }
        }

        alert(`✅ 전체 카드 거래내역 동기화 완료!\n\n• 새로 추가: ${totalInserted}건\n• 중복 건너뜀: ${totalSkipped}건\n• 카드 수: ${transactionsByCard.size}개\n\n※ 신한카드는 모든 카드의 거래내역을 한번에 조회합니다${spreadsheetMsg}`);

      } else {
        // Other cards: import normally with single card number
        const cardInfo = cardConnection?.cards?.find(c => c.cardNumber === cardNumber);

        const accountData = {
          accountNumber: cardNumber,
          accountName: cardInfo?.cardName || '카드',
          customerName: cardConnection?.alias || '',
          balance: 0,
        };

        const syncMetadata = {
          queryPeriodStart: startDate,
          queryPeriodEnd: endDate,
          excelFilePath: result.transactions[0]?.path || '',
        };

        const importResult = await window.electron.financeHubDb.importTransactions(
          cardCompanyId,
          accountData,
          transactionsData,
          syncMetadata,
          true  // isCard flag
        );

        if (importResult.success) {
          const { inserted, skipped } = importResult.data;
          await Promise.all([
            loadDatabaseStats(),
            loadRecentSyncOperations(),
            refreshAll()
          ]);

          setConnectedCards(prev => prev.map(c =>
            c.cardCompanyId === cardCompanyId ? { ...c, lastSync: new Date() } : c
          ));

          // Auto-update spreadsheet if it exists
          const spreadsheetUpdate = await autoUpdateSpreadsheet('card');
          let spreadsheetMsg = spreadsheetUpdate.updated
            ? '\n\n📊 스프레드시트 자동 업데이트 완료!'
            : '';

          // Cleanup downloaded files after successful spreadsheet update
          if (spreadsheetUpdate.updated) {
            const cleanup = await cleanupDownloadedFiles(cardCompanyId);
            if (cleanup.cleaned && cleanup.count > 0) {
              spreadsheetMsg += `\n🗑️ 다운로드 파일 ${cleanup.count}개 정리 완료`;
            }
          }

          alert(`✅ 카드 거래내역 동기화 완료!\n\n• 새로 추가: ${inserted}건\n• 중복 건너뜀: ${skipped}건${spreadsheetMsg}`);
        } else {
          throw new Error(importResult.error || '데이터베이스 저장 실패');
        }
      }
    } catch (error: any) {
      console.error('[FinanceHub] Card sync error:', error);
      alert(`카드 거래내역 동기화 실패: ${error?.message || error}`);
    } finally {
      setIsSyncingCard(null);
    }
  };

  // ============================================
  // Card Connection Handlers
  // ============================================

  const handleSelectCard = (card: CardConfig) => {
    if (!card.supportsAutomation) {
      alert(`${card.nameKo}은(는) 현재 자동화를 지원하지 않습니다.`);
      return;
    }
    setSelectedCard(card);
    // BC Card, Shinhan Card, NH Card, KB Card, and Hana Card are corporate only, others default to personal
    const accountType = (card.id === 'bc-card' || card.id === 'shinhan-card' || card.id === 'nh-card' || card.id === 'kb-card' || card.id === 'hana-card') ? 'corporate' : 'personal';
    setCardCredentials({ cardCompanyId: card.id, userId: '', password: '', accountType });
  };

  const handleConnectCard = async () => {
    if (!selectedCard || !cardCredentials.userId || !cardCredentials.password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setIsConnectingCard(true);
    setCardConnectionProgress('로그인 중...');
    try {
      const result = await window.electron.financeHub.card.loginAndGetCards(selectedCard.id, {
        userId: cardCredentials.userId,
        password: cardCredentials.password,
        accountType: cardCredentials.accountType || 'personal'
      }, undefined, manualPasswordMode);

      if (result.success && result.isLoggedIn) {
        setCardConnectionProgress('카드 정보를 불러왔습니다!');

        // Save credentials if requested
        if (saveCardCredentials) {
          await window.electron.financeHub.saveCredentials(selectedCard.id, cardCredentials);
        }

        const newConnection: ConnectedCard = {
          cardCompanyId: selectedCard.id,
          status: 'connected',
          alias: result.userName || undefined,
          lastSync: new Date(),
          cards: result.cards || [],
          accountType: cardCredentials.accountType || 'personal'
        };

        // Save cards to database as "accounts"
        if (result.cards && result.cards.length > 0) {
          for (const card of result.cards) {
            await window.electron.financeHubDb.upsertAccount({
              bankId: selectedCard.id,
              accountNumber: card.cardNumber,
              accountName: card.cardName || '카드',
              customerName: result.userName || '사용자',
              balance: 0, // Cards don't track balance
              availableBalance: 0,
              openDate: ''
            });
          }
          loadDatabaseStats();
          loadBanksAndAccounts();
          // Reload card connections from database
          await loadConnectedCards();
        }

        // Track connection
        const existingIndex = connectedCards.findIndex(c => c.cardCompanyId === selectedCard.id);
        if (existingIndex >= 0) {
          setConnectedCards(prev => prev.map((c, i) => i === existingIndex ? newConnection : c));
        } else {
          setConnectedCards(prev => [...prev, newConnection]);
        }

        alert(`${selectedCard.nameKo} 연결 성공! ${result.cards?.length || 0}개의 카드를 찾았습니다.`);
        handleCloseCardModal();
      } else {
        setCardConnectionProgress('');
        alert(`${selectedCard.nameKo} 연결 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      setCardConnectionProgress('');
      alert('카드사 연결 중 오류가 발생했습니다.');
    } finally {
      setIsConnectingCard(false);
      setCardConnectionProgress('');
    }
  };

  const handleReconnectCard = async (cardCompanyId: string) => {
    const card = getCardConfigById(cardCompanyId);
    try {
      setConnectedCards(prev => prev.map(c => c.cardCompanyId === cardCompanyId ? { ...c, status: 'pending' as const } : c));
      const credResult = await window.electron.financeHub.getSavedCredentials(cardCompanyId);

      if (!credResult.success || !credResult.credentials) {
        setSelectedCard(card || null);
        setShowCardSelector(true);
        setConnectedCards(prev => prev.map(c => c.cardCompanyId === cardCompanyId ? { ...c, status: 'disconnected' as const } : c));
        return;
      }

      const loginResult = await window.electron.financeHub.card.loginAndGetCards(cardCompanyId, {
        userId: credResult.credentials.userId,
        password: credResult.credentials.password,
        accountType: credResult.credentials.accountType || 'personal'
      }, undefined, manualPasswordMode);

      if (loginResult.success && loginResult.isLoggedIn) {
        // Save cards to database as "accounts"
        if (loginResult.cards && loginResult.cards.length > 0) {
          for (const cardItem of loginResult.cards) {
            await window.electron.financeHubDb.upsertAccount({
              bankId: cardCompanyId,
              accountNumber: cardItem.cardNumber,
              accountName: cardItem.cardName || '카드',
              customerName: loginResult.userName || '사용자',
              balance: 0, // Cards don't track balance
              availableBalance: 0,
              openDate: ''
            });
          }
          loadDatabaseStats();
          loadBanksAndAccounts();
          // Reload card connections from database
          await loadConnectedCards();
        }

        setConnectedCards(prev => prev.map(c => c.cardCompanyId === cardCompanyId ? {
          ...c,
          status: 'connected' as const,
          alias: loginResult.userName || c.alias,
          cards: loginResult.cards || c.cards,
          lastSync: new Date(),
          accountType: credResult.credentials.accountType || c.accountType || 'personal'
        } : c));
        alert(`✅ ${card?.nameKo || cardCompanyId} 재연결 성공!`);
      } else {
        setConnectedCards(prev => prev.map(c => c.cardCompanyId === cardCompanyId ? { ...c, status: 'error' as const } : c));
        alert(`${card?.nameKo || cardCompanyId} 재연결 실패: ${loginResult.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[FinanceHub] Reconnect card error:', error);
      setConnectedCards(prev => prev.map(c => c.cardCompanyId === cardCompanyId ? { ...c, status: 'error' as const } : c));
      alert(`재연결 중 오류가 발생했습니다: ${error}`);
    }
  };

  const handleDisconnectCard = async (cardCompanyId: string) => {
    const card = getCardConfigById(cardCompanyId);
    if (!window.confirm(`${card?.nameKo || cardCompanyId} 연결을 해제하시겠습니까?`)) return;
    try {
      await window.electron.financeHub.card.disconnect(cardCompanyId);
      setConnectedCards(prev => prev.filter(c => c.cardCompanyId !== cardCompanyId));
    } catch (error) {
      console.error('[FinanceHub] Disconnect card error:', error);
    }
  };

  const handleCloseCardModal = () => {
    setShowCardSelector(false);
    setSelectedCard(null);
    setCardAuthMethod(null);
    setCardCredentials({ cardCompanyId: '', userId: '', password: '', accountType: 'personal' });
    setCardConnectionProgress('');
    setManualPasswordMode(false);
  };

  const handleBackToCardList = () => {
    setSelectedCard(null);
    setManualPasswordMode(false);
    setCardAuthMethod(null);
    setCardCredentials({ cardCompanyId: '', userId: '', password: '', accountType: 'personal' });
    setCardConnectionProgress('');
  };

  const handleSelectBankAuthMethod = (method: 'certificate' | 'id') => {
    setBankAuthMethod(method);
  };

  const handleSelectCardAuthMethod = (method: 'certificate' | 'id') => {
    setCardAuthMethod(method);
  };

  // ============================================
  // Hometax Connection Handlers
  // ============================================

  const handleSelectAuthMethod = async (method: 'certificate' | 'id') => {
    setHometaxAuthMethod(method);

    if (method === 'certificate') {
      setIsConnectingHometax(true);
      setHometaxConnectionProgress('브라우저를 시작하는 중...');

      try {
        const result = await window.electron.hometax.fetchCertificates();

        if (result.success && result.certificates) {
          setAvailableCertificates(result.certificates);

          // Load all saved certificates to check which ones were previously used
          const savedCertsMap: Record<string, any> = {};
          for (const cert of result.certificates) {
            // Try to find saved data by matching certificate details
            // We'll need to get all saved certificates
            // For now, we can check if xpath matches
            try {
              const allSaved = await window.electron.hometax.getAllSavedCertificates();
              if (allSaved.success && allSaved.data) {
                Object.entries(allSaved.data).forEach(([businessNum, savedCert]: [string, any]) => {
                  if (savedCert.xpath === cert.xpath) {
                    savedCertsMap[cert.xpath] = savedCert;
                  }
                });
              }
            } catch (err) {
              console.log('Could not load saved certificates:', err);
            }
          }
          setSavedCertificates(savedCertsMap);

          setHometaxConnectionProgress('');
        } else {
          setHometaxConnectionProgress('');
          alert(`인증서 조회 실패: ${result.error || '알 수 없는 오류'}`);
          setHometaxAuthMethod(null);
        }
      } catch (error: any) {
        console.error('[FinanceHub] Error fetching certificates:', error);
        setHometaxConnectionProgress('');
        alert(`인증서 조회 중 오류 발생: ${error?.message || error}`);
        setHometaxAuthMethod(null);
      } finally {
        setIsConnectingHometax(false);
      }
    }
  };

  const handleSelectCertificate = (cert: any) => {
    setSelectedCertificate(cert);

    // Auto-fill password if this certificate was previously saved
    const savedCert = savedCertificates[cert.xpath];
    if (savedCert?.certificatePassword) {
      setHometaxCredentials(prev => ({
        ...prev,
        certificatePassword: savedCert.certificatePassword
      }));
      console.log('[FinanceHub] Auto-filled saved password for certificate');
    }
  };

  const handleDisconnectBusiness = async (businessNumber: string, businessName: string) => {
    if (!window.confirm(`${businessName} (${businessNumber}) 연결을 해제하시겠습니까?\n\n저장된 인증서 정보와 인증서 비밀번호가 삭제됩니다.`)) {
      return;
    }

    try {
      // Remove saved certificate and credentials
      await window.electron.hometax.removeCredentials(businessNumber);

      // Reload the list
      await loadConnectedBusinesses();

      alert('✅ 사업자 연결이 해제되었습니다.');
    } catch (error) {
      console.error('[FinanceHub] Error disconnecting business:', error);
      alert('연결 해제 중 오류가 발생했습니다.');
    }
  };

  const loadTaxInvoices = async () => {
    setIsLoadingTaxInvoices(true);
    try {
      if (taxInvoiceType === 'cash-receipt') {
        // Load cash receipts
        const result = await window.electron.hometax.getCashReceipts({
          businessNumber: selectedBusinessFilter === 'all' ? undefined : selectedBusinessFilter
        });

        if (result.success && result.data) {
          // Transform cash receipts to match display structure
          const transformedReceipts = result.data.map((receipt: any) => ({
            ...receipt,
            _isCashReceipt: true,
            // Date/ID fields
            작성일자: receipt.매출일시 ? receipt.매출일시.split(' ')[0] : '',
            승인번호: receipt.승인번호 || '',
            // Amount fields
            공급가액: receipt.공급가액 || 0,
            세액: receipt.부가세 || 0,
            합계금액: receipt.총금액 || 0,
            // Company/Item fields (required by table)
            공급자상호: '(현금영수증)',
            공급받는자상호: receipt.용도구분 || receipt.거래구분 || '',
            품목명: receipt.발행구분 || '현금결제',
            // Classification
            전자세금계산서분류: '현금영수증',
            전자세금계산서종류: receipt.거래구분 || '',
            발급유형: receipt.발행구분 || '',
            비고: receipt.비고 || ''
          }));
          setTaxInvoices(transformedReceipts);
        } else {
          setTaxInvoices([]);
        }
      } else {
        // Load tax invoices (sales or purchase)
        const result = await window.electron.hometax.getInvoices({
          businessNumber: selectedBusinessFilter === 'all' ? undefined : selectedBusinessFilter,
          invoiceType: taxInvoiceType
        });

        if (result.success) {
          setTaxInvoices(result.data || []);
        }
      }
    } catch (error) {
      console.error('[FinanceHub] Error loading tax invoices:', error);
    } finally {
      setIsLoadingTaxInvoices(false);
    }
  };

  // Helper function to export invoices for a specific type (without alerts or opening tabs)
  const exportInvoicesForType = async (businessNumber: string, invoiceType: 'sales' | 'purchase') => {
    try {
      // Fetch invoices for this type
      const invoicesResult = await window.electron.hometax.getInvoices({
        businessNumber,
        invoiceType
      });

      if (!invoicesResult.success || !invoicesResult.data || invoicesResult.data.length === 0) {
        console.log(`[FinanceHub] No ${invoiceType} invoices to export for ${businessNumber}`);
        return;
      }

      // Get existing spreadsheet URL
      const urlResult = await window.electron.hometax.getSpreadsheetUrl(businessNumber, invoiceType);
      const existingUrl = urlResult.success && urlResult.url ? urlResult.url : undefined;

      console.log(`[FinanceHub] Exporting ${invoicesResult.data.length} ${invoiceType} invoices (existing URL: ${existingUrl ? 'yes' : 'no'})`);

      // Export to spreadsheet
      const exportResult = await window.electron.sheets.exportTaxInvoicesToSpreadsheet({
        invoices: invoicesResult.data,
        invoiceType,
        existingSpreadsheetUrl: existingUrl,
      });

      if (exportResult.success && exportResult.spreadsheetUrl) {
        // Update the saved spreadsheet URL in state
        if (invoiceType === 'sales') {
          setTaxSalesSpreadsheetUrl(exportResult.spreadsheetUrl);
        } else {
          setTaxPurchaseSpreadsheetUrl(exportResult.spreadsheetUrl);
        }

        // Save URL to database
        await window.electron.hometax.saveSpreadsheetUrl(businessNumber, invoiceType, exportResult.spreadsheetUrl);
        console.log(`[FinanceHub] ✅ Auto-exported ${invoiceType} invoices to spreadsheet: ${exportResult.spreadsheetUrl}`);
      } else {
        console.error(`[FinanceHub] Failed to export ${invoiceType} invoices:`, exportResult.error);
      }
    } catch (error) {
      console.error(`[FinanceHub] Error exporting ${invoiceType} invoices:`, error);
    }
  };

  // Helper function to export cash receipts (without alerts or opening tabs)
  const exportCashReceiptsForBusiness = async (businessNumber: string) => {
    try {
      // Fetch cash receipts
      const receiptsResult = await window.electron.hometax.getCashReceipts({
        businessNumber
      });

      if (!receiptsResult.success || !receiptsResult.data || receiptsResult.data.length === 0) {
        console.log(`[FinanceHub] No cash receipts to export for ${businessNumber}`);
        return;
      }

      // Get existing spreadsheet URL from database (not from state)
      const urlResult = await window.electron.hometax.getCashReceiptSpreadsheetUrl(businessNumber);
      const existingUrl = urlResult.success && urlResult.url ? urlResult.url : undefined;

      console.log(`[FinanceHub] Exporting ${receiptsResult.data.length} cash receipts (existing URL: ${existingUrl ? 'yes' : 'no'})`);

      // Export to spreadsheet
      const exportResult = await window.electron.sheets.exportCashReceiptsToSpreadsheet({
        receipts: receiptsResult.data,
        existingSpreadsheetUrl: existingUrl,
      });

      if (exportResult.success && exportResult.spreadsheetUrl) {
        // Update the saved spreadsheet URL in state
        setCashReceiptSpreadsheetUrl(exportResult.spreadsheetUrl);

        // Save URL to database
        await window.electron.hometax.saveCashReceiptSpreadsheetUrl(businessNumber, exportResult.spreadsheetUrl);

        console.log(`[FinanceHub] ✅ Auto-exported cash receipts to spreadsheet: ${exportResult.spreadsheetUrl}`);
      } else {
        console.error(`[FinanceHub] Failed to export cash receipts:`, exportResult.error);
      }
    } catch (error) {
      console.error(`[FinanceHub] Error exporting cash receipts:`, error);
    }
  };

  const handleCollectTaxInvoices = async (businessNumber: string) => {
    try {
      // Get saved certificate data for this business
      const savedCert = await window.electron.hometax.getSelectedCertificate(businessNumber);

      if (!savedCert.success || !savedCert.data) {
        alert('저장된 인증서 정보가 없습니다. 다시 연결해주세요.');
        return;
      }

      // Call backend to collect tax invoices
      const result = await window.electron.hometax.collectInvoices(
        savedCert.data,
        savedCert.data.certificatePassword
      );

      if (result.success) {
        // Reload data
        await loadConnectedBusinesses();
        await loadTaxInvoices();

        // Auto-export to spreadsheets (sales, purchase, and cash receipts)
        console.log('[FinanceHub] Auto-exporting to spreadsheets...');
        await exportInvoicesForType(businessNumber, 'sales');
        await exportInvoicesForType(businessNumber, 'purchase');
        await exportCashReceiptsForBusiness(businessNumber);
      } else {
        alert(`❌ 수집 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('[FinanceHub] Error collecting tax invoices:', error);
      alert(`수집 중 오류 발생: ${error?.message || error}`);
    }
  };

  const handleTaxInvoiceTabChange = async (type: 'sales' | 'purchase') => {
    setTaxInvoiceType(type);
    // Reset company name filter when switching between sales/purchase
    setTaxInvoiceFilters(prev => ({
      ...prev,
      companyName: 'all'
    }));
    // Load saved spreadsheet URL for this invoice type
    await loadTaxSpreadsheetUrl(type);
  };

  // Load saved spreadsheet URL for the current business and invoice type
  const loadTaxSpreadsheetUrl = async (invoiceType: 'sales' | 'purchase') => {
    if (filteredAndSortedTaxInvoices.length === 0) return;

    const businessNumber = filteredAndSortedTaxInvoices[0].business_number;
    if (!businessNumber) return;

    try {
      const result = await window.electron.hometax.getSpreadsheetUrl(businessNumber, invoiceType);
      if (result.success && result.spreadsheetUrl) {
        if (invoiceType === 'sales') {
          setTaxSalesSpreadsheetUrl(result.spreadsheetUrl);
        } else {
          setTaxPurchaseSpreadsheetUrl(result.spreadsheetUrl);
        }
      }
    } catch (error) {
      console.error('Error loading tax spreadsheet URL:', error);
    }
  };

  const handleTaxInvoiceSort = (key: string) => {
    setTaxInvoiceSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleTaxInvoiceFilterChange = (key: keyof TaxInvoiceFiltersType, value: string) => {
    setTaxInvoiceFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetTaxInvoiceFilters = () => {
    setTaxInvoiceFilters({
      businessNumber: 'all',
      searchText: '',
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      minAmount: '',
      maxAmount: '',
      classification: 'all',
      companyName: 'all',
    });
  };

  const handleExportTaxInvoices = async () => {
    try {
      // Get the existing spreadsheet URL for this invoice type
      let existingUrl: string | null | undefined;
      if (taxInvoiceType === 'sales') {
        existingUrl = taxSalesSpreadsheetUrl;
      } else if (taxInvoiceType === 'purchase') {
        existingUrl = taxPurchaseSpreadsheetUrl;
      } else {
        existingUrl = cashReceiptSpreadsheetUrl;
      }

      let result: any;

      // Use different export function for cash receipts
      if (taxInvoiceType === 'cash-receipt') {
        result = await window.electron.sheets.exportCashReceiptsToSpreadsheet({
          receipts: filteredAndSortedTaxInvoices,
          existingSpreadsheetUrl: existingUrl || undefined,
        });
      } else {
        result = await window.electron.sheets.exportTaxInvoicesToSpreadsheet({
          invoices: filteredAndSortedTaxInvoices,
          invoiceType: taxInvoiceType,
          existingSpreadsheetUrl: existingUrl || undefined,
        });
      }

      if (result.success) {
        // Update the saved spreadsheet URL
        if (taxInvoiceType === 'sales') {
          setTaxSalesSpreadsheetUrl(result.spreadsheetUrl);
        } else if (taxInvoiceType === 'purchase') {
          setTaxPurchaseSpreadsheetUrl(result.spreadsheetUrl);
        } else {
          setCashReceiptSpreadsheetUrl(result.spreadsheetUrl);
        }

        // Open the spreadsheet in a new browser tab
        window.open(result.spreadsheetUrl, '_blank');
      } else {
        const errorMsg = result.error || '알 수 없는 오류';

        // Check if it's an authentication error
        if (errorMsg.toLowerCase().includes('auth') ||
            errorMsg.toLowerCase().includes('token') ||
            errorMsg.toLowerCase().includes('permission') ||
            errorMsg.toLowerCase().includes('sign in with google')) {
          setShowTaxGoogleAuth(true);
          // Don't show alert for auth errors, just show the Google login UI
        } else {
          alert(`❌ 스프레드시트 내보내기 실패: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Error exporting tax invoices:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';

      // Check if it's an authentication error
      if (errorMsg.toLowerCase().includes('auth') ||
          errorMsg.toLowerCase().includes('token') ||
          errorMsg.toLowerCase().includes('permission') ||
          errorMsg.toLowerCase().includes('sign in with google')) {
        setShowTaxGoogleAuth(true);
        // Don't show alert for auth errors, just show the Google login UI
      } else {
        alert(`스프레드시트 내보내기 중 오류 발생: ${errorMsg}`);
      }
    }
  };

  const handleClearTaxSpreadsheet = async () => {
    const typeLabel = taxInvoiceType === 'sales' ? '매출' : taxInvoiceType === 'purchase' ? '매입' : '현금영수증';
    if (confirm(`기존 ${typeLabel} 스프레드시트 연결을 해제하고 다음에 새로운 스프레드시트를 생성하시겠습니까?`)) {
      if (taxInvoiceType === 'sales') {
        setTaxSalesSpreadsheetUrl(null);
      } else if (taxInvoiceType === 'purchase') {
        setTaxPurchaseSpreadsheetUrl(null);
      } else {
        setCashReceiptSpreadsheetUrl(null);
      }

      // Clear from database
      if (filteredAndSortedTaxInvoices.length > 0) {
        const businessNumber = filteredAndSortedTaxInvoices[0].business_number;
        if (businessNumber && taxInvoiceType !== 'cash-receipt') {
          try {
            await window.electron.hometax.saveSpreadsheetUrl(businessNumber, taxInvoiceType, '');
          } catch (error) {
            console.error('Error clearing tax spreadsheet URL:', error);
          }
        }
        // TODO: Add saveCashReceiptSpreadsheetUrl to IPC if needed
      }

      alert('스프레드시트 연결이 해제되었습니다. 다음번에 새로운 스프레드시트가 생성됩니다.');
    }
  };

  const handleTaxGoogleSignIn = async () => {
    setSigningInTaxGoogle(true);

    try {
      // Use the same Google OAuth flow with proper scopes
      const result = await window.electron.auth.signInWithGoogle(GOOGLE_OAUTH_SCOPES_STRING);

      if (result.success && result.session) {
        console.log('Google sign-in successful:', result.session.user.email);
        setShowTaxGoogleAuth(false);
        // Automatically retry the export
        setTimeout(() => {
          handleExportTaxInvoices();
        }, 1000);
      } else {
        console.error('Google sign-in failed:', result);
        throw new Error(result.error || 'Failed to sign in with Google');
      }
    } catch (err) {
      console.error('Error signing in with Google:', err);
      // Don't show alert for OAuth errors - user might have just cancelled the window
      // Keep the Google login UI visible so they can try again
    } finally {
      setSigningInTaxGoogle(false);
    }
  };

  const handleCloseTaxGoogleAuth = () => {
    setShowTaxGoogleAuth(false);
  };

  const handleDropTaxData = async () => {
    if (!confirm('⚠️ 모든 세금계산서 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const result = await window.electron.hometax.dropAllData();

      if (result.success) {
        alert('✅ 모든 세금계산서 데이터가 삭제되었습니다.');
        loadTaxInvoices();
      } else {
        alert(`❌ 데이터 삭제 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Error dropping tax data:', error);
      alert(`❌ 데이터 삭제 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // Load tax invoices when filters change
  useEffect(() => {
    if (currentView === 'tax-invoices') {
      loadTaxInvoices();
    }
  }, [taxInvoiceType, selectedBusinessFilter, currentView]);

  // Load saved spreadsheet URL when tax invoices change
  useEffect(() => {
    if (filteredAndSortedTaxInvoices.length > 0) {
      loadTaxSpreadsheetUrl(taxInvoiceType);
    }
  }, [filteredAndSortedTaxInvoices, taxInvoiceType]);

  const handleConnectHometax = async () => {
    if (hometaxAuthMethod === 'certificate') {
      if (!selectedCertificate || !hometaxCredentials.certificatePassword) {
        alert('인증서를 선택하고 비밀번호를 입력해주세요.');
        return;
      }
    } else if (hometaxAuthMethod === 'id') {
      if (!hometaxCredentials.businessNumber || !hometaxCredentials.userId || !hometaxCredentials.password) {
        alert('사업자등록번호, 아이디, 비밀번호를 입력해주세요.');
        return;
      }
    }

    setIsConnectingHometax(true);
    setHometaxConnectionProgress('홈택스에 로그인 중...');

    try {
      // Call backend to complete login
      const result = await window.electron.hometax.connect(
        selectedCertificate,
        hometaxCredentials.certificatePassword
      );

      if (result.success) {
        setHometaxConnectionProgress('사업자 정보를 가져왔습니다!');

        const businessNumber = result.businessInfo?.businessNumber || hometaxCredentials.businessNumber;

        // Save credentials if requested
        if (saveHometaxCredentials) {
          await window.electron.hometax.saveCredentials(
            businessNumber,
            hometaxAuthMethod === 'certificate'
              ? { certificatePassword: hometaxCredentials.certificatePassword }
              : { userId: hometaxCredentials.userId, password: hometaxCredentials.password }
          );
        }

        // Save selected certificate info and password for future use (certificate auth only)
        if (hometaxAuthMethod === 'certificate' && selectedCertificate) {
          const certDataToSave = {
            xpath: selectedCertificate.xpath,
            소유자명: selectedCertificate.소유자명,
            용도: selectedCertificate.용도,
            발급기관: selectedCertificate.발급기관,
            만료일: selectedCertificate.만료일,
            businessName: result.businessInfo?.businessName,
            representativeName: result.businessInfo?.representativeName,
            businessType: result.businessInfo?.businessType,
            certificatePassword: saveHometaxCredentials ? hometaxCredentials.certificatePassword : undefined
          };
          await window.electron.hometax.saveSelectedCertificate(businessNumber, certDataToSave);
          console.log('[FinanceHub] Saved certificate info and password for business:', businessNumber);
        }

        // Show success message with business info
        const businessName = result.businessInfo?.businessName || businessNumber;
        const repName = result.businessInfo?.representativeName || '-';
        alert(`✅ 홈택스 연결 성공!\n\n사업자: ${businessName}\n대표자: ${repName}`);

        handleCloseHometaxModal();

        // Reload connected businesses list
        await loadConnectedBusinesses();
      } else {
        setHometaxConnectionProgress('');
        alert(`❌ 홈택스 연결 실패\n\n${result.error || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('[FinanceHub] Hometax connection error:', error);
      setHometaxConnectionProgress('');
      alert(`❌ 홈택스 연결 중 오류 발생\n\n${error?.message || error}`);
    } finally {
      setIsConnectingHometax(false);
      setHometaxConnectionProgress('');
    }
  };

  const handleCloseHometaxModal = () => {
    setShowHometaxModal(false);
    setHometaxAuthMethod(null);
    setAvailableCertificates([]);
    setSelectedCertificate(null);
    setHometaxCredentials({ businessNumber: '', certificatePassword: '', userId: '', password: '' });
    setHometaxConnectionProgress('');
  };

  // ============================================
  // Other Handlers
  // ============================================

  const handleFetchAccounts = useCallback(async (bankId: string) => {
    setIsFetchingAccounts(bankId);
    try {
      const result = await window.electron.financeHub.getAccounts(bankId);
      if (result.success && result.accounts) {
        setConnectedBanks(prev => prev.map(bank =>
          bank.bankId === bankId
            ? { ...bank, accounts: result.accounts, lastSync: new Date(), status: 'connected' as const }
            : bank
        ));
      } else {
        alert(`계좌 정보 불러오기 실패: ${result.error}`);
      }
    } catch (error) {
      alert('계좌 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingAccounts(null);
    }
  }, []);

  const handleSelectBank = async (bank: BankConfig) => {
    if (!bank.supportsAutomation) {
      alert(`${bank.nameKo}은(는) 현재 자동화를 지원하지 않습니다.`);
      return;
    }
    setSelectedBank(bank);
    try {
      const result = await window.electron.financeHub.getSavedCredentials(bank.id);
      if (result.success && result.credentials) {
        setCredentials({
          bankId: bank.id,
          userId: result.credentials.userId || '',
          password: result.credentials.password || '',
          certificatePassword: result.credentials.certificatePassword || '',
          accountType: result.credentials.accountType || 'personal'
        });
      } else {
        setCredentials({ bankId: bank.id, userId: '', password: '', certificatePassword: '', accountType: 'personal' });
      }
    } catch (error) {
      setCredentials({ bankId: bank.id, userId: '', password: '', certificatePassword: '', accountType: 'personal' });
    }
  };

  const handleConnect = async () => {
    // Validate based on account type
    if (credentials.accountType === 'corporate') {
      // Corporate accounts use certificate authentication
      if (!selectedBank || !credentials.certificatePassword) {
        alert('공동인증서 비밀번호를 입력해주세요.');
        return;
      }
    } else {
      // Personal accounts use userId + password
      if (!selectedBank || !credentials.userId || !credentials.password) {
        alert('아이디와 비밀번호를 입력해주세요.');
        return;
      }
    }

    setIsConnecting(true);
    setConnectionProgress('로그인 중...');
    try {
      // Determine the correct bank ID based on account type
      // For NH Bank, use 'nh-business' for corporate, 'nh' for personal
      let bankId = selectedBank.id;
      if (selectedBank.id === 'nh' && credentials.accountType === 'corporate') {
        bankId = 'nh-business';
      }

      // Pass credentials based on account type
      const loginCredentials = credentials.accountType === 'corporate'
        ? { certificatePassword: credentials.certificatePassword }
        : { userId: credentials.userId, password: credentials.password };

      const result = await window.electron.financeHub.loginAndGetAccounts(bankId, loginCredentials);
      if (result.success && result.isLoggedIn) {
        setConnectionProgress('계좌 정보를 불러왔습니다!');
        // Save credentials using the effective bankId (nh-business for corporate, nh for personal)
        if (saveCredentials) await window.electron.financeHub.saveCredentials(bankId, { ...credentials, bankId });

        const newConnection: ConnectedBank = {
          bankId: bankId, // Use effective bankId (nh-business or nh)
          status: 'connected',
          alias: result.userName || undefined,
          lastSync: new Date(),
          accounts: result.accounts || [],
          accountType: credentials.accountType || 'personal'
        };

        if (result.accounts && result.accounts.length > 0) {
          for (const acc of result.accounts) {
            // Use the effective bankId for all accounts
            const accountBankId = acc.bankId || bankId;
            await window.electron.financeHubDb.upsertAccount({ bankId: accountBankId, accountNumber: acc.accountNumber, accountName: acc.accountName, customerName: result.userName || '사용자', balance: acc.balance, availableBalance: acc.balance, openDate: '' });
          }
          loadDatabaseStats();
          loadBanksAndAccounts();
        }

        // Track connection using the effective bankId
        const existingIndex = connectedBanks.findIndex(b => b.bankId === bankId);
        if (existingIndex >= 0) {
          setConnectedBanks(prev => prev.map((b, i) => i === existingIndex ? newConnection : b));
        } else {
          setConnectedBanks(prev => [...prev, newConnection]);
        }
        alert(`${selectedBank.nameKo} 연결 성공! ${result.accounts?.length || 0}개의 계좌를 찾았습니다.`);
        handleCloseModal();
      } else {
        setConnectionProgress('');
        alert(`${selectedBank.nameKo} 연결 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      setConnectionProgress('');
      alert('은행 연결 중 오류가 발생했습니다.');
    } finally {
      setIsConnecting(false);
      setConnectionProgress('');
    }
  };

  const handleDisconnect = async (bankId: string) => {
    const bank = getBankConfigById(bankId);
    if (!window.confirm(`${bank?.nameKo || bankId} 연결을 해제하시겠습니까?`)) return;
    try {
      await window.electron.financeHub.disconnect(bankId);
      setConnectedBanks(prev => prev.filter(b => b.bankId !== bankId));
    } catch (error) {
      console.error('[FinanceHub] Disconnect error:', error);
    }
  };

  const handleDisconnectAccount = async (bankId: string, accountNumber: string) => {
    const bank = getBankConfigById(bankId);
    if (!window.confirm(`${bank?.nameKo || bankId}의 계좌 ${formatAccountNumber(accountNumber)}를 비활성화하시겠습니까?\n\n이 계좌의 동기화가 중단되지만, 기존 거래내역은 유지됩니다.`)) return;
    
    try {
      // Call API to disable the account
      const result = await window.electron.financeHubDb.updateAccountStatus(accountNumber, false);
      if (result.success) {
        // Update the UI - mark account as inactive
        await loadConnectedBanks();
        await loadBanksAndAccounts(); // Refresh accounts list
      }
    } catch (error) {
      console.error('[FinanceHub] Disconnect account error:', error);
      alert('계좌 비활성화 중 오류가 발생했습니다.');
    }
  };

  const handleReconnectAccount = async (bankId: string, accountNumber: string) => {
    const bank = getBankConfigById(bankId);
    if (!window.confirm(`${bank?.nameKo || bankId}의 계좌 ${formatAccountNumber(accountNumber)}를 다시 활성화하시겠습니까?`)) return;
    
    try {
      // Call API to enable the account
      const result = await window.electron.financeHubDb.updateAccountStatus(accountNumber, true);
      if (result.success) {
        // Update the UI - mark account as active
        await loadConnectedBanks();
        await loadBanksAndAccounts(); // Refresh accounts list
      }
    } catch (error) {
      console.error('[FinanceHub] Reconnect account error:', error);
      alert('계좌 활성화 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteAccount = async (bankId: string, accountNumber: string) => {
    const bank = getBankConfigById(bankId);
    if (!window.confirm(`⚠️ 주의: ${bank?.nameKo || bankId}의 계좌 ${formatAccountNumber(accountNumber)}를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 거래 내역이 삭제됩니다.\n\n정말로 삭제하시겠습니까?`)) return;
    
    try {
      // Call API to delete the account
      const result = await window.electron.financeHubDb.deleteAccount(accountNumber);
      if (result.success) {
        // Update the UI - remove account
        await loadConnectedBanks();
        await loadBanksAndAccounts(); // Refresh accounts list
        alert('✅ 계좌가 삭제되었습니다.');
      } else {
        alert(`❌ 계좌 삭제 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[FinanceHub] Delete account error:', error);
      alert('계좌 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleCloseModal = () => { setShowBankSelector(false); setSelectedBank(null); setBankAuthMethod(null); setCredentials({ bankId: '', userId: '', password: '', certificatePassword: '', accountType: 'personal' }); setConnectionProgress(''); };
  const handleBackToList = () => { setSelectedBank(null); setBankAuthMethod(null); setCredentials({ bankId: '', userId: '', password: '', certificatePassword: '', accountType: 'personal' }); setConnectionProgress(''); };

  // ============================================
  // Debug Handlers
  // ============================================

  const handleDebugOpenBrowser = async (bankId: string) => {
    setDebugLoading('browser');
    try {
      const result = await window.electron.financeHub.openBrowser(bankId);
      alert(result.success ? '✅ 브라우저가 열렸습니다!' : `❌ 실패: ${result.error}`);
    } catch (error) { alert(`오류: ${error}`); }
    finally { setDebugLoading(null); }
  };

  const handleDebugLoginOnly = async (bankId: string) => {
    setDebugLoading('login');
    try {
      const credResult = await window.electron.financeHub.getSavedCredentials(bankId);
      if (!credResult.success || !credResult.credentials) { alert('저장된 인증 정보가 없습니다.'); return; }
      const loginResult = await window.electron.financeHub.login(bankId, credResult.credentials);
      if (loginResult.success) {
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? {
          ...b,
          status: 'connected' as const,
          lastSync: new Date(),
          accountType: credResult.credentials.accountType || b.accountType || 'personal'
        } : b));
        alert('✅ 로그인 성공!');
      } else { alert(`❌ 로그인 실패: ${loginResult.error}`); }
    } catch (error) { alert(`오류: ${error}`); }
    finally { setDebugLoading(null); }
  };

  const handleDebugGetAccountsOnly = async (bankId: string) => {
    setDebugLoading('accounts');
    try {
      const result = await window.electron.financeHub.getAccounts(bankId);
      if (result.success && result.accounts) {
        setConnectedBanks(prev => {
          const idx = prev.findIndex(b => b.bankId === bankId);
          if (idx >= 0) return prev.map((b, i) => i === idx ? {
            ...b,
            accounts: result.accounts,
            lastSync: new Date(),
            status: 'connected' as const
          } : b);
          return [...prev, {
            bankId,
            status: 'connected' as const,
            lastSync: new Date(),
            accounts: result.accounts,
            accountType: 'personal'
          }];
        });
        alert(`✅ ${result.accounts.length}개의 계좌를 찾았습니다`);
      } else { alert(`❌ 계좌 조회 실패: ${result.error}`); }
    } catch (error) { alert(`오류: ${error}`); }
    finally { setDebugLoading(null); }
  };

  const handleDebugFullFlow = async (bankId: string) => {
    setDebugLoading('full');
    try {
      const credResult = await window.electron.financeHub.getSavedCredentials(bankId);
      if (!credResult.success || !credResult.credentials) { alert('저장된 인증 정보가 없습니다.'); return; }
      const result = await window.electron.financeHub.loginAndGetAccounts(bankId, credResult.credentials);
      if (result.success && result.isLoggedIn) {
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? {
          ...b,
          accounts: result.accounts || [],
          alias: result.userName,
          lastSync: new Date(),
          status: 'connected' as const,
          accountType: credResult.credentials.accountType || b.accountType || 'personal'
        } : b));
        alert(`✅ 전체 플로우 성공!\n- 사용자: ${result.userName}\n- 계좌 수: ${result.accounts?.length || 0}`);
      } else { alert(`❌ 실패: ${result.error}`); }
    } catch (error) { alert(`오류: ${error}`); }
    finally { setDebugLoading(null); }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="finance-hub">
      {/* Background */}
      <div className="finance-hub__bg">
        <div className="finance-hub__bg-gradient"></div>
        <div className="finance-hub__bg-grid"></div>
        <div className="finance-hub__bg-glow"></div>
      </div>

      {/* Header */}
      <header className="finance-hub__header">
        <div className="finance-hub__header-content">
          <div className="finance-hub__logo">
            <span className="finance-hub__logo-icon">₩</span>
            <div className="finance-hub__logo-text">
              <h1>Finance Hub</h1>
              <span className="finance-hub__logo-subtitle">금융 자동화 허브</span>
            </div>
          </div>
          <p className="finance-hub__tagline">여러 은행에 따로 로그인할 필요 없이, 모든 계좌와 지출 내역을 한 곳에서 확인하세요</p>

          {/* Full Disk Access Warning for macOS */}
          <FullDiskAccessWarning onRequestAccess={() => {
            // Optional: Show a message that the user needs to restart the app
            alert('Full Disk Access 설정을 변경한 후 앱을 재시작해주세요.');
          }} />

          <nav className="finance-hub__nav">
            <button className={`finance-hub__nav-item ${currentView === 'account-management' ? 'active' : ''}`} onClick={() => setCurrentView('account-management')}>계좌 관리</button>
            <button className={`finance-hub__nav-item ${currentView === 'bank-transactions' ? 'active' : ''}`} onClick={() => setCurrentView('bank-transactions')}>은행 전체 거래내역</button>
            <button className={`finance-hub__nav-item ${currentView === 'card-transactions' ? 'active' : ''}`} onClick={() => setCurrentView('card-transactions')}>카드 전체 거래 내역</button>
            <button className={`finance-hub__nav-item ${currentView === 'tax-management' ? 'active' : ''}`} onClick={() => setCurrentView('tax-management')}>세금 관리</button>
            <button className={`finance-hub__nav-item ${currentView === 'tax-invoices' ? 'active' : ''}`} onClick={() => setCurrentView('tax-invoices')}>전자세금계산서</button>
          </nav>
        </div>

        <div className="finance-hub__header-stats">
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{connectedBanks.filter(b => b.status === 'connected').length}</span>
            <span className="finance-hub__stat-label">연결된 은행</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{connectedCards.filter(c => c.status === 'connected').length}</span>
            <span className="finance-hub__stat-label">연결된 카드</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{totalAccounts}</span>
            <span className="finance-hub__stat-label">계좌 수</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{dbStats?.totalTransactions || 0}</span>
            <span className="finance-hub__stat-label">저장된 거래</span>
          </div>
        </div>

        {/* Debug Panel - Only visible in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="finance-hub__debug-panel finance-hub__debug-panel--header">
            <button className="finance-hub__debug-toggle" onClick={() => setShowDebugPanel(!showDebugPanel)}>🔧 Debug Tools {showDebugPanel ? '▼' : '▶'}</button>
            {showDebugPanel && (
              <div className="finance-hub__debug-actions">
                <p className="finance-hub__debug-description">테스트용 디버그 버튼들입니다.</p>
                <div className="finance-hub__debug-bank-selector">
                  <label>테스트할 은행:</label>
                  <select className="finance-hub__debug-select" defaultValue="shinhan" onChange={(e) => { (window as any).__debugSelectedBank = e.target.value; }}>
                    {KOREAN_BANKS.filter(b => b.supportsAutomation).map((bank) => (<option key={bank.id} value={bank.id}>{bank.icon} {bank.nameKo}</option>))}
                  </select>
                </div>
                <div className="finance-hub__debug-buttons">
                  <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline" onClick={() => handleDebugOpenBrowser((window as any).__debugSelectedBank || 'shinhan')} disabled={debugLoading !== null}>{debugLoading === 'browser' ? '열기 중...' : '🌐 브라우저 열기'}</button>
                  <button className="finance-hub__btn finance-hub__btn--small" onClick={() => handleDebugLoginOnly((window as any).__debugSelectedBank || 'shinhan')} disabled={debugLoading !== null}>{debugLoading === 'login' ? '로그인 중...' : '🔐 로그인만'}</button>
                  <button className="finance-hub__btn finance-hub__btn--small" onClick={() => handleDebugGetAccountsOnly((window as any).__debugSelectedBank || 'shinhan')} disabled={debugLoading !== null}>{debugLoading === 'accounts' ? '조회 중...' : '📋 계좌만 조회'}</button>
                  <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary" onClick={() => handleDebugFullFlow((window as any).__debugSelectedBank || 'shinhan')} disabled={debugLoading !== null}>{debugLoading === 'full' ? '실행 중...' : '🚀 전체 플로우'}</button>
                </div>
                {dbStats && (<div className="finance-hub__debug-stats"><h4><FontAwesomeIcon icon={faChartLine} /> 데이터베이스 현황</h4><div className="finance-hub__debug-stats-grid"><span>계좌: {dbStats.totalAccounts}개</span><span>거래내역: {dbStats.totalTransactions}건</span><span>동기화: {dbStats.totalSyncOperations}회</span></div></div>)}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="finance-hub__main">
        {currentView === 'account-management' ? (
          <>
            {/* Arduino Settings - Compact */}
            <div className="finance-hub__arduino-compact">
              <div className="finance-hub__arduino-row">
                <span className="finance-hub__arduino-label">🔌 Arduino: </span>
                <span className="finance-hub__arduino-port-compact">{arduinoPort}</span>
                {arduinoStatus === 'detected' && <span className="finance-hub__arduino-badge finance-hub__arduino-badge--success">✓</span>}
                <input
                  type="text"
                  value={arduinoPort}
                  onChange={(e) => setArduinoPort(e.target.value)}
                  placeholder="COM3"
                  className="finance-hub__arduino-input-compact"
                />
                <button className="finance-hub__arduino-btn-compact" onClick={() => updateArduinoPort(arduinoPort)}>저장</button>
                <button
                  className="finance-hub__arduino-btn-compact"
                  onClick={detectArduinoPort}
                  disabled={isDetectingArduino}
                >
                  {isDetectingArduino ? <FontAwesomeIcon icon={faSpinner} spin /> : '자동감지'}
                </button>
              </div>
            </div>

            {/* Connected Banks */}
            <section className="finance-hub__section">
              <div className="finance-hub__section-header">
                <h2><span className="finance-hub__section-icon">🔗</span> 연결된 계좌</h2>
                <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowBankSelector(true)}><span>+</span> 은행 연결하기</button>
              </div>
              {connectedBanks.length === 0 ? (
                <div className="finance-hub__empty-state">
                  <div className="finance-hub__empty-icon">🏦</div>
                  <h3>연결된 은행이 없습니다</h3>
                  <p>은행을 연결하면 모든 거래 내역을 자동으로 불러옵니다</p>
                  <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowBankSelector(true)}>첫 번째 은행 연결하기</button>
                </div>
              ) : (
                <div className="finance-hub__connected-banks">
                  {connectedBanks.map((connection) => {
                    const bank = getBankConfigById(connection.bankId);
                    if (!bank) return null;
                    return (
                      <div key={connection.bankId} className="finance-hub__bank-card" style={{ '--bank-color': bank.color } as React.CSSProperties}>
                        <div className="finance-hub__bank-card-header">
                          <span className="finance-hub__bank-icon">{bank.icon}</span>
                          <div className="finance-hub__bank-info">
                            <div className="finance-hub__bank-info-title">
                              <h4>{bank.nameKo}</h4>
                              {connection.accountType === 'personal' && (
                                <span className={`finance-hub__account-type-badge finance-hub__account-type-badge--${connection.accountType}`}>
                                  👤 개인
                                </span>
                              )}
                              {connection.accountType === 'corporate' && (
                                <span className={`finance-hub__account-type-badge finance-hub__account-type-badge--${connection.accountType}`}>
                                  🏢 법인
                                </span>
                              )}
                            </div>
                            <span className="finance-hub__bank-name-en">{connection.alias ? `${connection.alias}님` : bank.name}</span>
                          </div>
                          <span className={`finance-hub__status finance-hub__status--${connection.status}`}>
                            {connection.status === 'connected' && '연결됨'}{connection.status === 'pending' && '연결중...'}{connection.status === 'error' && '오류'}{connection.status === 'disconnected' && '연결 끊김'}
                          </span>
                        </div>
                        {connection.accounts && connection.accounts.length > 0 && (
                          <div className="finance-hub__accounts-list">
                            {connection.accounts.map((account, idx) => {
                              // Find if this account is active from the accounts data
                              const fullAccount = accounts.find(a => a.accountNumber === account.accountNumber);
                              const isActive = fullAccount?.isActive !== false; // Default to true if not found
                              
                              return (
                                <div key={idx} className={`finance-hub__account-item ${!isActive ? 'finance-hub__account-item--inactive' : ''}`}>
                                  <div className="finance-hub__account-info">
                                    <span className="finance-hub__account-number">{formatAccountNumber(account.accountNumber)}</span>
                                    <span className="finance-hub__account-name">
                                      {account.accountName || '계좌'} 
                                      {!isActive && <span className="finance-hub__inactive-badge">비활성</span>}
                                    </span>
                                  </div>
                                  <div className="finance-hub__account-actions">
                                    {account.balance > 0 && <span className="finance-hub__account-balance">{formatCurrency(account.balance)}</span>}
                                    {isActive ? (
                                      <>
                                        <div className="finance-hub__sync-dropdown">
                                          <button className="finance-hub__btn finance-hub__btn--icon" onClick={() => setShowSyncOptions(showSyncOptions === account.accountNumber ? null : account.accountNumber)} disabled={isSyncing !== null || connection.status === 'pending'} title="동기화">
                                            <FontAwesomeIcon icon={isSyncing === account.accountNumber ? faSpinner : faSync} spin={isSyncing === account.accountNumber} />
                                          </button>
                                          {showSyncOptions === account.accountNumber && !isSyncing && (
                                            <div className="finance-hub__sync-options">
                                              <button className="finance-hub__sync-option" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, 'day'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 1일
                                              </button>
                                              <button className="finance-hub__sync-option" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, 'week'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 1주일
                                              </button>
                                              <button className="finance-hub__sync-option" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, 'month'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 1개월
                                              </button>
                                              <button className="finance-hub__sync-option finance-hub__sync-option--default" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, '3months'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 3개월 (기본)
                                              </button>
                                              <button className="finance-hub__sync-option" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, '6months'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 6개월
                                              </button>
                                              <button className="finance-hub__sync-option" onClick={() => { handleSyncAndSaveTransactions(connection.bankId, account.accountNumber, 'year'); setShowSyncOptions(null); }}>
                                                <FontAwesomeIcon icon={faClock} /> 1년
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        <button className="finance-hub__btn finance-hub__btn--icon" onClick={() => handleDisconnectAccount(connection.bankId, account.accountNumber)} title="이 계좌 비활성화">
                                          <FontAwesomeIcon icon={faUnlink} />
                                        </button>
                                        {process.env.NODE_ENV === 'development' && showDebugPanel && (
                                          <button className="finance-hub__btn finance-hub__btn--icon finance-hub__btn--danger" onClick={() => handleDeleteAccount(connection.bankId, account.accountNumber)} title="계좌 삭제 (DEBUG)">
                                            <FontAwesomeIcon icon={faTrash} />
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary" onClick={() => handleReconnectAccount(connection.bankId, account.accountNumber)}>
                                        활성화
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="finance-hub__bank-card-footer">
                          <span>{connection.lastSync ? `마지막 동기화: ${connection.lastSync.toLocaleString('ko-KR')}` : '동기화 안됨'}</span>
                          <div className="finance-hub__bank-actions">
                            {(connection.status === 'disconnected' || connection.status === 'error') && <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary" onClick={() => handleReconnect(connection.bankId)}><FontAwesomeIcon icon={faSync} /> 재연결</button>}
                            {connection.status === 'connected' && <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline" onClick={() => handleFetchAccounts(connection.bankId)} disabled={isFetchingAccounts === connection.bankId}>{isFetchingAccounts === connection.bankId ? '조회 중...' : '계좌 조회'}</button>}
                            <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--danger" onClick={() => handleDisconnect(connection.bankId)}>연결 해제</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Connected Cards */}
            <section className="finance-hub__section">
              <div className="finance-hub__section-header">
                <h2><span className="finance-hub__section-icon">💳</span> 연결된 카드</h2>
                <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowCardSelector(true)}>
                  <span>+</span> 카드사 연결하기
                </button>
              </div>
              {connectedCards.length === 0 ? (
                <div className="finance-hub__empty-state">
                  <div className="finance-hub__empty-icon">💳</div>
                  <h3>연결된 카드가 없습니다</h3>
                  <p>카드사를 연결하면 모든 사용 내역을 자동으로 불러옵니다</p>
                  <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowCardSelector(true)}>
                    첫 번째 카드 연결하기
                  </button>
                </div>
              ) : (
                <div className="finance-hub__connected-banks">
                  {connectedCards.map((connection) => {
                    const card = getCardConfigById(connection.cardCompanyId);
                    if (!card) return null;
                    return (
                      <div key={connection.cardCompanyId} className="finance-hub__bank-card" style={{ '--bank-color': card.color } as React.CSSProperties}>
                        <div className="finance-hub__bank-card-header">
                          <span className="finance-hub__bank-icon">{card.icon}</span>
                          <div className="finance-hub__bank-info">
                            <div className="finance-hub__bank-info-title">
                              <h4>{card.nameKo}</h4>
                              {connection.accountType === 'personal' && (
                                <span className={`finance-hub__account-type-badge finance-hub__account-type-badge--${connection.accountType}`}>
                                  👤 개인
                                </span>
                              )}
                              {connection.accountType === 'corporate' && (
                                <span className={`finance-hub__account-type-badge finance-hub__account-type-badge--${connection.accountType}`}>
                                  🏢 법인
                                </span>
                              )}
                            </div>
                            <span className="finance-hub__bank-name-en">{connection.alias ? `${connection.alias}님` : card.name}</span>
                          </div>
                          <span className={`finance-hub__status finance-hub__status--${connection.status}`}>
                            {connection.status === 'connected' && '연결됨'}
                            {connection.status === 'pending' && '연결중...'}
                            {connection.status === 'error' && '오류'}
                            {connection.status === 'disconnected' && '연결 끊김'}
                          </span>
                        </div>
                        {(connection.cardCompanyId === 'bc-card' || connection.cardCompanyId === 'shinhan-card') && connection.cards && connection.cards.length > 0 && (
                          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <div style={{
                                padding: '6px 10px',
                                backgroundColor: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: '#856404',
                                flex: 1
                              }}>
                                <strong>⚠️ {connection.cardCompanyId === 'shinhan-card' ? '신한카드: 최대 7일' : 'BC카드: 최대 1개월'}</strong>, 모든 카드 일괄 동기화
                              </div>
                            </div>
                            <div className="finance-hub__sync-dropdown" style={{ display: 'inline-block' }}>
                              <button
                                className="finance-hub__btn finance-hub__btn--primary"
                                onClick={() => setShowCardSyncOptions(showCardSyncOptions === connection.cardCompanyId ? null : connection.cardCompanyId)}
                                disabled={isSyncingCard !== null || connection.status === 'pending'}
                                style={{ fontSize: '13px', padding: '6px 12px' }}
                              >
                                <FontAwesomeIcon icon={isSyncingCard === connection.cardCompanyId ? faSpinner : faSync} spin={isSyncingCard === connection.cardCompanyId} />
                                {' '}전체 동기화
                              </button>
                              {showCardSyncOptions === connection.cardCompanyId && !isSyncingCard && (
                                <div className="finance-hub__sync-options">
                                  <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, connection.cards[0].cardNumber, 'day'); setShowCardSyncOptions(null); }}>
                                    <FontAwesomeIcon icon={faClock} /> 1일
                                  </button>
                                  <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, connection.cards[0].cardNumber, 'week'); setShowCardSyncOptions(null); }}>
                                    <FontAwesomeIcon icon={faClock} /> 1주일 {connection.cardCompanyId === 'shinhan-card' && '(최대)'}
                                  </button>
                                  {connection.cardCompanyId !== 'shinhan-card' && (
                                    <button className="finance-hub__sync-option finance-hub__sync-option--default" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, connection.cards[0].cardNumber, 'month'); setShowCardSyncOptions(null); }}>
                                      <FontAwesomeIcon icon={faClock} /> 1개월 (최대)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {connection.cards && connection.cards.length > 0 && (
                          <div className="finance-hub__accounts-list">
                            {connection.cards.map((cardItem, idx) => (
                              <div key={idx} className="finance-hub__account-item">
                                <div className="finance-hub__account-info">
                                  <span className="finance-hub__account-number">{cardItem.cardNumber}</span>
                                  <span className="finance-hub__account-name">{cardItem.cardName || '카드'}</span>
                                </div>
                                <div className="finance-hub__account-actions">
                                  {cardItem.balance && cardItem.balance > 0 && (
                                    <span className="finance-hub__account-balance">{formatCurrency(cardItem.balance)}</span>
                                  )}
                                  {connection.cardCompanyId !== 'bc-card' && connection.cardCompanyId !== 'shinhan-card' && (
                                    <div className="finance-hub__sync-dropdown">
                                      <button
                                        className="finance-hub__btn finance-hub__btn--icon"
                                        onClick={() => setShowCardSyncOptions(showCardSyncOptions === cardItem.cardNumber ? null : cardItem.cardNumber)}
                                        disabled={isSyncingCard !== null || connection.status === 'pending'}
                                        title="동기화"
                                      >
                                        <FontAwesomeIcon icon={isSyncingCard === cardItem.cardNumber ? faSpinner : faSync} spin={isSyncingCard === cardItem.cardNumber} />
                                      </button>
                                      {showCardSyncOptions === cardItem.cardNumber && !isSyncingCard && (
                                        <div className="finance-hub__sync-options">
                                          <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, 'day'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 1일
                                          </button>
                                          <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, 'week'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 1주일
                                          </button>
                                          <button className="finance-hub__sync-option finance-hub__sync-option--default" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, 'month'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 1개월
                                          </button>
                                          <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, '3months'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 3개월
                                          </button>
                                          <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, '6months'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 6개월
                                          </button>
                                          <button className="finance-hub__sync-option" onClick={() => { handleSyncCardTransactions(connection.cardCompanyId, cardItem.cardNumber, 'year'); setShowCardSyncOptions(null); }}>
                                            <FontAwesomeIcon icon={faClock} /> 1년
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <button
                                    className="finance-hub__btn finance-hub__btn--icon"
                                    onClick={() => {
                                      if (window.confirm(`카드 ${cardItem.cardNumber}를 연결 해제하시겠습니까?`)) {
                                        // For now, just remove from UI
                                        setConnectedCards(prev => prev.map(c =>
                                          c.cardCompanyId === connection.cardCompanyId
                                            ? { ...c, cards: c.cards?.filter(card => card.cardNumber !== cardItem.cardNumber) }
                                            : c
                                        ));
                                      }
                                    }}
                                    title="이 카드 연결 해제"
                                  >
                                    <FontAwesomeIcon icon={faUnlink} />
                                  </button>
                                  {process.env.NODE_ENV === 'development' && showDebugPanel && (
                                    <button
                                      className="finance-hub__btn finance-hub__btn--icon finance-hub__btn--danger"
                                      onClick={() => {
                                        if (window.confirm(`⚠️ 주의: 카드 ${cardItem.cardNumber}를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 거래 내역이 삭제됩니다.\n\n정말로 삭제하시겠습니까?`)) {
                                          // TODO: Implement card deletion from database
                                          // For now, just remove from UI
                                          setConnectedCards(prev => prev.map(c =>
                                            c.cardCompanyId === connection.cardCompanyId
                                              ? { ...c, cards: c.cards?.filter(card => card.cardNumber !== cardItem.cardNumber) }
                                              : c
                                          ));
                                          alert('✅ 카드가 삭제되었습니다.');
                                        }
                                      }}
                                      title="카드 삭제 (DEBUG)"
                                    >
                                      <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="finance-hub__bank-card-footer">
                          <span>{connection.lastSync ? `마지막 동기화: ${connection.lastSync.toLocaleString('ko-KR')}` : '동기화 안됨'}</span>
                          <div className="finance-hub__bank-actions">
                            {(connection.status === 'disconnected' || connection.status === 'error') && (
                              <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary" onClick={() => handleReconnectCard(connection.cardCompanyId)}>
                                <FontAwesomeIcon icon={faSync} /> 재연결
                              </button>
                            )}
                            <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--danger" onClick={() => handleDisconnectCard(connection.cardCompanyId)}>
                              연결 해제
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recent Transactions - Using Shared Components */}
            <section className="finance-hub__section">
              <div className="finance-hub__section-header">
                <h2><span className="finance-hub__section-icon"><FontAwesomeIcon icon={faExchangeAlt} /></span> 최근 거래 내역</h2>
                <div className="finance-hub__section-actions">
                  <button 
                    className="finance-hub__btn finance-hub__btn--icon" 
                    onClick={() => setShowSchedulerModal(true)}
                    title="자동 동기화 설정"
                  >
                    <FontAwesomeIcon icon={faClock} />
                  </button>
                  <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline" onClick={() => setCurrentView('bank-transactions')}>전체 보기 →</button>
                </div>
              </div>
              {stats && <TransactionStats stats={stats} compact />}
              <TransactionTable transactions={recentTransactions} banks={banks} accounts={accounts} isLoading={isLoadingRecent} compact maxRows={10} onShowMore={() => setCurrentView('bank-transactions')} emptyMessage="계좌를 선택하고 '동기화' 버튼을 눌러 거래내역을 저장하세요." />
            </section>

            {/* Monthly Summary */}
            {monthlySummary.length > 0 && (
              <section className="finance-hub__section">
                <div className="finance-hub__section-header"><h2><span className="finance-hub__section-icon">📅</span> 월별 요약</h2></div>
                <div className="finance-hub__monthly-summary">
                  {monthlySummary.slice(0, 6).map((month) => (
                    <div key={month.yearMonth} className="finance-hub__monthly-card">
                      <h4>{month.yearMonth}</h4>
                      <div className="finance-hub__monthly-stats">
                        <div className="finance-hub__monthly-stat finance-hub__monthly-stat--deposit"><span>입금</span><strong>{formatCurrency(month.totalDeposits)}</strong><small>{month.depositCount}건</small></div>
                        <div className="finance-hub__monthly-stat finance-hub__monthly-stat--withdrawal"><span>출금</span><strong>{formatCurrency(month.totalWithdrawals)}</strong><small>{month.withdrawalCount}건</small></div>
                        <div className={`finance-hub__monthly-stat ${month.netChange >= 0 ? 'finance-hub__monthly-stat--positive' : 'finance-hub__monthly-stat--negative'}`}><span>순변동</span><strong>{formatCurrency(month.netChange)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Sync History */}
            {recentSyncOps.length > 0 && (
              <section className="finance-hub__section">
                <div className="finance-hub__section-header"><h2><span className="finance-hub__section-icon"><FontAwesomeIcon icon={faSync} /></span> 최근 동기화 기록</h2></div>
                <div className="finance-hub__sync-history">
                  {recentSyncOps.slice(0, 5).map((op) => (
                    <div key={op.id} className="finance-hub__sync-item">
                      <div className="finance-hub__sync-info"><span className="finance-hub__sync-account">{formatAccountNumber(op.accountNumber)}</span><span className="finance-hub__sync-date">{new Date(op.startedAt).toLocaleString('ko-KR')}</span></div>
                      <div className="finance-hub__sync-stats"><span>{op.totalCount}건</span><span className="finance-hub__sync-deposit">+{formatCurrency(op.totalDeposits)}</span><span className="finance-hub__sync-withdrawal">-{formatCurrency(op.totalWithdrawals)}</span></div>
                      <span className={`finance-hub__sync-status finance-hub__sync-status--${op.status}`}>{op.status === 'completed' ? '✓' : op.status === 'failed' ? '✗' : '⏳'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI Insights */}
            <section className="finance-hub__section finance-hub__section--full">
              <div className="finance-hub__section-header"><h2><span className="finance-hub__section-icon">🤖</span> AI 재무 분석</h2></div>
              <div className="finance-hub__insights">
                <div className="finance-hub__insight-card"><div className="finance-hub__insight-icon">📈</div><h4>지출 분석</h4><p>AI가 자동으로 거래를 분류하고 지출 패턴을 분석합니다</p></div>
                <div className="finance-hub__insight-card"><div className="finance-hub__insight-icon">🎯</div><h4>예산 추천</h4><p>과거 데이터를 기반으로 최적의 예산 계획을 제안합니다</p></div>
                <div className="finance-hub__insight-card"><div className="finance-hub__insight-icon">⚠️</div><h4>이상 거래 감지</h4><p>비정상적인 거래 패턴을 실시간으로 감지합니다</p></div>
                <div className="finance-hub__insight-card"><div className="finance-hub__insight-icon">📑</div><h4>세금 보고서</h4><p>연말정산 및 세금 신고용 보고서를 자동 생성합니다</p></div>
              </div>
            </section>
          </>
        ) : currentView === 'bank-transactions' ? (
          <div className="finance-hub__section finance-hub__section--full" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <TransactionsPage transactions={bankTransactions} stats={bankStats} filters={bankFilters} pagination={pagination} sort={sort} isLoading={isBankLoading} error={error} banks={banks} accounts={accounts} onFilterChange={setBankFilters} onResetFilters={resetBankFilters} onPageChange={setPage} onSort={toggleSort} loadTransactions={loadBankTransactions} loadAllTransactions={loadAllTransactions} transactionType="bank" />
          </div>
        ) : currentView === 'card-transactions' ? (
          <div className="finance-hub__section finance-hub__section--full" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <TransactionsPage transactions={cardTransactions} stats={cardStats} filters={cardFilters} pagination={pagination} sort={sort} isLoading={isCardLoading} error={error} banks={banks} accounts={accounts} onFilterChange={setCardFilters} onResetFilters={resetCardFilters} onPageChange={setPage} onSort={toggleSort} loadTransactions={loadCardTransactions} loadAllTransactions={loadAllTransactions} transactionType="card" />
          </div>
        ) : currentView === 'tax-invoices' ? (
          <div className="finance-hub__section finance-hub__section--full" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <TaxInvoicesPage
              invoices={filteredAndSortedTaxInvoices}
              allInvoices={taxInvoices}
              invoiceType={taxInvoiceType}
              stats={taxInvoiceStats}
              filters={taxInvoiceFilters}
              isLoading={isLoadingTaxInvoices}
              businesses={connectedBusinesses}
              sortKey={taxInvoiceSort.key}
              sortDirection={taxInvoiceSort.direction}
              showGoogleAuth={showTaxGoogleAuth}
              signingIn={signingInTaxGoogle}
              savedSpreadsheetUrl={
                taxInvoiceType === 'sales' ? taxSalesSpreadsheetUrl :
                taxInvoiceType === 'purchase' ? taxPurchaseSpreadsheetUrl :
                cashReceiptSpreadsheetUrl
              }
              onInvoiceTypeChange={handleTaxInvoiceTabChange}
              onFilterChange={handleTaxInvoiceFilterChange}
              onResetFilters={handleResetTaxInvoiceFilters}
              onSort={handleTaxInvoiceSort}
              onExport={handleExportTaxInvoices}
              onClearSpreadsheet={handleClearTaxSpreadsheet}
              onGoogleSignIn={handleTaxGoogleSignIn}
              onCloseGoogleAuth={handleCloseTaxGoogleAuth}
              onDropData={handleDropTaxData}
            />
          </div>
        ) : currentView === 'tax-management' ? (
          <div className="finance-hub__section finance-hub__section--full">
            <div className="finance-hub__tax-management">
              <header className="finance-hub__page-header">
                <h1 className="finance-hub__page-title">
                  <span className="finance-hub__page-icon">📊</span>
                  세금 관리
                </h1>
                <p className="finance-hub__page-subtitle">전자세금계산서를 자동으로 수집하고 관리하세요</p>
              </header>

              {/* Hometax Connection Section */}
              <section className="finance-hub__tax-section">
                <div className="finance-hub__section-header">
                  <h2><span className="finance-hub__section-icon">🏛️</span> 연결된 사업자</h2>
                  <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowHometaxModal(true)}>
                    <span>+</span> 사업자 추가하기
                  </button>
                </div>

                {connectedBusinesses.length === 0 ? (
                  /* Empty State - No Connected Businesses */
                  <div className="finance-hub__empty-state">
                    <div className="finance-hub__empty-icon">🏛️</div>
                    <h3>연결된 사업자가 없습니다</h3>
                    <p>사업자를 연결하면 전자세금계산서를 자동으로 수집합니다</p>
                    <button className="finance-hub__btn finance-hub__btn--primary" onClick={() => setShowHometaxModal(true)}>
                      첫 번째 사업자 연결하기
                    </button>
                  </div>
                ) : (
                  /* Connected Businesses */
                  <div className="finance-hub__connected-businesses">
                    {connectedBusinesses.map((business) => (
                      <div key={business.businessNumber} className="finance-hub__business-card" style={{ '--bank-color': '#00B140' } as React.CSSProperties}>
                        <div className="finance-hub__business-header">
                          <span className="finance-hub__business-icon">🏢</span>
                          <div className="finance-hub__business-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h4>{business.businessName}</h4>
                              {business.businessType && (
                                <span className="finance-hub__business-type">{business.businessType}</span>
                              )}
                            </div>
                            <span className="finance-hub__business-number">{business.businessNumber}</span>
                          </div>
                          <span className="finance-hub__status finance-hub__status--connected">연결됨</span>
                        </div>

                        <div className="finance-hub__business-stats">
                          <div className="finance-hub__business-stat">
                            <span className="finance-hub__business-stat-icon">📤</span>
                            <div className="finance-hub__business-stat-info">
                              <span className="finance-hub__business-stat-label">매출</span>
                              <span className="finance-hub__business-stat-value">{business.salesCount}건</span>
                            </div>
                          </div>
                          <div className="finance-hub__business-stat">
                            <span className="finance-hub__business-stat-icon">📥</span>
                            <div className="finance-hub__business-stat-info">
                              <span className="finance-hub__business-stat-label">매입</span>
                              <span className="finance-hub__business-stat-value">{business.purchaseCount}건</span>
                            </div>
                          </div>
                        </div>

                        <div className="finance-hub__business-footer">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--fh-text-muted)' }}>
                              인증서: {business.발급기관} (만료: {business.만료일})
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--fh-text-muted)' }}>
                              {business.lastSync ? `마지막 수집: ${business.lastSync.toLocaleString('ko-KR')}` : '동기화 안됨'}
                            </span>
                          </div>
                          <div className="finance-hub__business-actions">
                            <button
                              className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline"
                              onClick={() => handleCollectTaxInvoices(business.businessNumber)}
                            >
                              <FontAwesomeIcon icon={faSync} /> 지금 수집
                            </button>
                            <button
                              className="finance-hub__btn finance-hub__btn--small finance-hub__btn--danger"
                              onClick={() => handleDisconnectBusiness(business.businessNumber, business.businessName)}
                            >
                              연결 해제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Unimplemented features hidden - Coming Soon Notice */}
              <section className="finance-hub__tax-section" style={{ marginTop: '24px' }}>
                <div className="finance-hub__empty-state" style={{ padding: '40px 20px' }}>
                  <div className="finance-hub__empty-icon">🚧</div>
                  <h3>추가 기능 준비 중</h3>
                  <p>현금영수증, 부가세 신고, 연말정산 등 더 많은 세무 기능이 곧 추가됩니다</p>
                </div>
              </section>

            </div>
          </div>
        ) : null}
      </main>

      {/* Bank Selector Modal */}
      {showBankSelector && (
        <div className="finance-hub__modal-overlay" onClick={handleCloseModal}>
          <div className="finance-hub__modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              {selectedBank ? (<><button className="finance-hub__back-btn" onClick={handleBackToList}>← 뒤로</button><h2>{selectedBank.nameKo} 로그인</h2></>) : <h2>은행 선택</h2>}
              <button className="finance-hub__modal-close" onClick={handleCloseModal}>✕</button>
            </div>
            {selectedBank ? (
              <div className="finance-hub__login-form">
                <div className="finance-hub__login-bank-info">
                  <span className="finance-hub__login-bank-icon" style={{ background: selectedBank.color }}>{selectedBank.icon}</span>
                  <div><h3>{selectedBank.nameKo}</h3><span>{selectedBank.name}</span></div>
                </div>

                {/* Connection Progress */}
                {connectionProgress && (
                  <div className="finance-hub__connection-progress">
                    <span className="finance-hub__spinner"></span>
                    <span>{connectionProgress}</span>
                  </div>
                )}

                {/* Combined: Account Type Selection + Auth Method Selection */}
                {!connectionProgress && (
                  <div className="finance-hub__login-fields">
                    {/* Account Type Selector */}
                    <div className="finance-hub__input-group">
                      <label>계정 유형</label>
                      <div className="finance-hub__account-type-selector">
                        <button
                          type="button"
                          className={`finance-hub__account-type-btn ${credentials.accountType === 'personal' ? 'finance-hub__account-type-btn--active' : ''}`}
                          onClick={() => setCredentials({ ...credentials, accountType: 'personal' })}
                          disabled={isConnecting}
                        >
                          <span className="finance-hub__account-type-icon">👤</span>
                          <span>개인</span>
                        </button>
                        <button
                          type="button"
                          className={`finance-hub__account-type-btn ${credentials.accountType === 'corporate' ? 'finance-hub__account-type-btn--active' : ''}`}
                          onClick={() => setCredentials({ ...credentials, accountType: 'corporate' })}
                          disabled={isConnecting}
                        >
                          <span className="finance-hub__account-type-icon">🏢</span>
                          <span>법인</span>
                        </button>
                      </div>
                    </div>

                    {/* Auth Method Selector */}
                    <div className="finance-hub__auth-method-selector">
                      <h3 style={{ marginBottom: '16px', color: 'var(--fh-text-primary)', textAlign: 'center' }}>로그인 방식을 선택하세요</h3>
                      <button
                        className="finance-hub__auth-method-btn"
                        onClick={() => handleSelectBankAuthMethod('certificate')}
                        disabled={isConnecting}
                      >
                        <span className="finance-hub__auth-method-icon">🔐</span>
                        <div className="finance-hub__auth-method-info">
                          <h4>공동인증서</h4>
                          <p>공동인증서(구 공인인증서)로 로그인</p>
                        </div>
                      </button>
                      <button
                        className="finance-hub__auth-method-btn"
                        onClick={() => handleSelectBankAuthMethod('id')}
                        disabled={isConnecting}
                      >
                        <span className="finance-hub__auth-method-icon">👤</span>
                        <div className="finance-hub__auth-method-info">
                          <h4>아이디 로그인</h4>
                          <p>인터넷뱅킹 아이디와 비밀번호로 로그인</p>
                        </div>
                      </button>
                    </div>

                    {/* Credential Fields - Show after auth method is selected */}
                    {bankAuthMethod === 'certificate' && (
                      <>
                        <div className="finance-hub__login-notice" style={{ marginTop: '20px' }}>
                          <div className="finance-hub__notice-icon">{credentials.accountType === 'corporate' ? '🏢' : '👤'}</div>
                          <div>
                            <strong>{credentials.accountType === 'corporate' ? '법인' : '개인'} 인터넷뱅킹</strong>
                            <p>공동인증서(구 공인인증서)를 사용하여 인증합니다.</p>
                          </div>
                        </div>
                        <div className="finance-hub__input-group">
                          <label>공동인증서 비밀번호</label>
                          <input
                            type="password"
                            placeholder="공동인증서 비밀번호"
                            value={credentials.certificatePassword || ''}
                            onChange={(e) => setCredentials({ ...credentials, certificatePassword: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnecting}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !isConnecting) handleConnect(); }}
                          />
                        </div>
                        <div className="finance-hub__checkbox-group">
                          <label className="finance-hub__checkbox-label">
                            <input
                              type="checkbox"
                              checked={saveCredentials}
                              onChange={(e) => setSaveCredentials(e.target.checked)}
                              disabled={isConnecting}
                            />
                            인증서 비밀번호 저장 (암호화하여 안전하게 보관)
                          </label>
                        </div>
                        <button
                          className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                          onClick={handleConnect}
                          disabled={isConnecting || !credentials.certificatePassword}
                        >
                          {isConnecting ? <><span className="finance-hub__spinner"></span> 연결 중...</> : '은행 연결하기'}
                        </button>
                      </>
                    )}

                    {bankAuthMethod === 'id' && (
                      <>
                        <div className="finance-hub__input-group" style={{ marginTop: '20px' }}>
                          <label>아이디</label>
                          <input
                            type="text"
                            placeholder="인터넷뱅킹 아이디"
                            value={credentials.userId}
                            onChange={(e) => setCredentials({ ...credentials, userId: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnecting}
                          />
                        </div>
                        <div className="finance-hub__input-group">
                          <label>비밀번호</label>
                          <input
                            type="password"
                            placeholder="인터넷뱅킹 비밀번호"
                            value={credentials.password}
                            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnecting}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !isConnecting) handleConnect(); }}
                          />
                        </div>
                        <div className="finance-hub__checkbox-group">
                          <label className="finance-hub__checkbox-label">
                            <input
                              type="checkbox"
                              checked={saveCredentials}
                              onChange={(e) => setSaveCredentials(e.target.checked)}
                              disabled={isConnecting}
                            />
                            아이디 및 비밀번호 저장 (암호화하여 안전하게 보관)
                          </label>
                        </div>
                        <button
                          className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                          onClick={handleConnect}
                          disabled={isConnecting || !credentials.userId || !credentials.password}
                        >
                          {isConnecting ? <><span className="finance-hub__spinner"></span> 연결 중...</> : '은행 연결하기'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="finance-hub__modal-filters">
                  <input type="text" placeholder="은행 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="finance-hub__search-input" />
                  <div className="finance-hub__category-tabs">{Object.entries(CATEGORY_LABELS).map(([key, label]) => (<button key={key} className={`finance-hub__category-tab ${selectedCategory === key ? 'finance-hub__category-tab--active' : ''}`} onClick={() => setSelectedCategory(key)}>{label}</button>))}</div>
                </div>
                <div className="finance-hub__bank-list">
                  {filteredBanks.map((bank) => {
                    const isConnected = connectedBanks.some(b => b.bankId === bank.id && b.status === 'connected');
                    return (
                      <div key={bank.id} className={`finance-hub__bank-item ${!bank.supportsAutomation ? 'finance-hub__bank-item--disabled' : ''} ${isConnected ? 'finance-hub__bank-item--connected' : ''}`} style={{ '--bank-color': bank.color } as React.CSSProperties} onClick={() => handleSelectBank(bank)}>
                        <span className="finance-hub__bank-item-icon">{bank.icon}</span>
                        <div className="finance-hub__bank-item-info"><h4>{bank.nameKo}</h4><span>{bank.name}</span></div>
                        {isConnected && <span className="finance-hub__bank-badge finance-hub__bank-badge--connected">연결됨</span>}
                        {!bank.supportsAutomation && <span className="finance-hub__bank-badge">{bank.category === 'internet' ? '모바일 전용' : '준비 중'}</span>}
                        <span className="finance-hub__bank-arrow">→</span>
                      </div>
                    );
                  })}
                </div>
                <div className="finance-hub__modal-footer"><p className="finance-hub__modal-note">💡 현재 신한은행과 NH농협은행 자동화가 지원됩니다.</p></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scheduler Modal */}
      {showSchedulerModal && (
        <div className="finance-hub__modal-overlay" onClick={() => setShowSchedulerModal(false)}>
          <div className="finance-hub__modal finance-hub__modal--scheduler" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              <h2><FontAwesomeIcon icon={faClock} /> 자동 동기화 설정</h2>
              <button className="finance-hub__modal-close" onClick={() => setShowSchedulerModal(false)}>✕</button>
            </div>
            <div className="finance-hub__modal-body">
              <SchedulerSettings />
            </div>
          </div>
        </div>
      )}

      {/* Card Selector Modal */}
      {showCardSelector && (
        <div className="finance-hub__modal-overlay" onClick={handleCloseCardModal}>
          <div className="finance-hub__modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              {selectedCard ? (
                <>
                  <button className="finance-hub__back-btn" onClick={handleBackToCardList}>← 뒤로</button>
                  <h2>{selectedCard.nameKo} 로그인</h2>
                </>
              ) : (
                <h2>카드사 선택</h2>
              )}
              <button className="finance-hub__modal-close" onClick={handleCloseCardModal}>✕</button>
            </div>
            {selectedCard ? (
              <div className="finance-hub__login-form">
                <div className="finance-hub__login-bank-info">
                  <span className="finance-hub__login-bank-icon" style={{ background: selectedCard.color }}>{selectedCard.icon}</span>
                  <div>
                    <h3>{selectedCard.nameKo}</h3>
                    <span>{selectedCard.name}</span>
                  </div>
                </div>

                {/* Connection Progress */}
                {cardConnectionProgress && (
                  <div className="finance-hub__connection-progress">
                    <span className="finance-hub__spinner"></span>
                    <span>{cardConnectionProgress}</span>
                  </div>
                )}

                {/* Combined: Account Type Selection + Auth Method Selection */}
                {!cardConnectionProgress && (
                  <div className="finance-hub__login-fields">
                    {/* Account Type Selector */}
                    <div className="finance-hub__input-group">
                      <label>계정 유형</label>
                      <div className="finance-hub__account-type-selector">
                        <button
                          type="button"
                          className={`finance-hub__account-type-btn ${cardCredentials.accountType === 'personal' ? 'finance-hub__account-type-btn--active' : ''}`}
                          onClick={() => setCardCredentials({ ...cardCredentials, accountType: 'personal' })}
                          disabled={isConnectingCard || selectedCard?.id === 'bc-card' || selectedCard?.id === 'shinhan-card' || selectedCard?.id === 'nh-card' || selectedCard?.id === 'kb-card' || selectedCard?.id === 'hana-card'}
                          title={(selectedCard?.id === 'bc-card' || selectedCard?.id === 'shinhan-card' || selectedCard?.id === 'nh-card' || selectedCard?.id === 'kb-card' || selectedCard?.id === 'hana-card') ? '이 카드는 법인 전용입니다' : undefined}
                        >
                          <span className="finance-hub__account-type-icon">👤</span>
                          <span>개인</span>
                        </button>
                        <button
                          type="button"
                          className={`finance-hub__account-type-btn ${cardCredentials.accountType === 'corporate' ? 'finance-hub__account-type-btn--active' : ''}`}
                          onClick={() => setCardCredentials({ ...cardCredentials, accountType: 'corporate' })}
                          disabled={isConnectingCard || (selectedCard?.id !== 'bc-card' && selectedCard?.id !== 'shinhan-card' && selectedCard?.id !== 'nh-card' && selectedCard?.id !== 'kb-card' && selectedCard?.id !== 'hana-card')}
                          title={(selectedCard?.id !== 'bc-card' && selectedCard?.id !== 'shinhan-card' && selectedCard?.id !== 'nh-card' && selectedCard?.id !== 'kb-card' && selectedCard?.id !== 'hana-card') ? '법인 계정은 BC카드, 신한카드, NH농협카드, KB국민카드, 하나카드만 지원됩니다' : undefined}
                        >
                          <span className="finance-hub__account-type-icon">🏢</span>
                          <span>법인</span>
                        </button>
                      </div>
                    </div>

                    {/* Auth Method Selector */}
                    <div className="finance-hub__auth-method-selector">
                      <h3 style={{ marginBottom: '16px', color: 'var(--fh-text-primary)', textAlign: 'center' }}>로그인 방식을 선택하세요</h3>
                      <button
                        className="finance-hub__auth-method-btn"
                        onClick={() => handleSelectCardAuthMethod('certificate')}
                        disabled={isConnectingCard || (selectedCard?.id !== 'bc-card' && selectedCard?.id !== 'shinhan-card' && selectedCard?.id !== 'nh-card' && selectedCard?.id !== 'kb-card' && selectedCard?.id !== 'hana-card')}
                        style={(selectedCard?.id !== 'bc-card' && selectedCard?.id !== 'shinhan-card' && selectedCard?.id !== 'nh-card' && selectedCard?.id !== 'kb-card' && selectedCard?.id !== 'hana-card') ? { opacity: 0.5 } : {}}
                      >
                        <span className="finance-hub__auth-method-icon">🔐</span>
                        <div className="finance-hub__auth-method-info">
                          <h4>공동인증서</h4>
                          <p>공동인증서(구 공인인증서)로 로그인</p>
                          {(selectedCard?.id !== 'bc-card' && selectedCard?.id !== 'shinhan-card' && selectedCard?.id !== 'nh-card' && selectedCard?.id !== 'kb-card' && selectedCard?.id !== 'hana-card') && (
                            <small style={{ color: 'var(--fh-text-muted)', marginTop: '4px' }}>법인 계정은 BC카드, 신한카드, NH농협카드, KB국민카드, 하나카드만 지원</small>
                          )}
                        </div>
                      </button>
                      <button
                        className="finance-hub__auth-method-btn"
                        onClick={() => handleSelectCardAuthMethod('id')}
                        disabled={isConnectingCard}
                      >
                        <span className="finance-hub__auth-method-icon">👤</span>
                        <div className="finance-hub__auth-method-info">
                          <h4>아이디 로그인</h4>
                          <p>카드사 아이디와 비밀번호로 로그인</p>
                        </div>
                      </button>
                    </div>

                    {/* Credential Fields - Show after auth method is selected */}
                    {cardAuthMethod === 'certificate' && (
                      <>
                        <div className="finance-hub__login-notice" style={{ marginTop: '20px' }}>
                          <div className="finance-hub__notice-icon">{cardCredentials.accountType === 'corporate' ? '🏢' : '👤'}</div>
                          <div>
                            <strong>{cardCredentials.accountType === 'corporate' ? '법인' : '개인'} 카드</strong>
                            <p>공동인증서(구 공인인증서)를 사용하여 인증합니다.</p>
                          </div>
                        </div>
                        <div className="finance-hub__input-group">
                          <label>아이디</label>
                          <input
                            type="text"
                            placeholder="카드사 아이디"
                            value={cardCredentials.userId}
                            onChange={(e) => setCardCredentials({ ...cardCredentials, userId: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnectingCard}
                          />
                        </div>
                        <div className="finance-hub__input-group">
                          <label>비밀번호</label>
                          <input
                            type="password"
                            placeholder="카드사 비밀번호"
                            value={cardCredentials.password}
                            onChange={(e) => setCardCredentials({ ...cardCredentials, password: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnectingCard}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isConnectingCard) handleConnectCard();
                            }}
                          />
                        </div>
                        <div className="finance-hub__checkbox-group">
                          <label className="finance-hub__checkbox-label">
                            <input
                              type="checkbox"
                              checked={saveCardCredentials}
                              onChange={(e) => setSaveCardCredentials(e.target.checked)}
                              disabled={isConnectingCard}
                            />
                            로그인 정보 저장 (암호화하여 안전하게 보관)
                          </label>
                        </div>
                        {(selectedCard?.id === 'shinhan-card' || selectedCard?.id === 'nh-card' || selectedCard?.id === 'hana-card' || selectedCard?.id === 'kb-card') && (
                          <div className="finance-hub__checkbox-group">
                            <label className="finance-hub__checkbox-label" style={{ color: '#ff6b6b', fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                checked={manualPasswordMode}
                                onChange={(e) => setManualPasswordMode(e.target.checked)}
                                disabled={isConnectingCard}
                              />
                              🔧 디버그 모드 (수동 비밀번호 입력)
                            </label>
                            {manualPasswordMode && (
                              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px', marginLeft: '24px' }}>
                                Arduino HID 대신 브라우저에서 직접 비밀번호를 입력한 후 앱에서 "계속하기" 버튼을 클릭하세요
                              </p>
                            )}
                          </div>
                        )}
                        <button
                          className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                          onClick={handleConnectCard}
                          disabled={isConnectingCard || !cardCredentials.userId || !cardCredentials.password}
                        >
                          {isConnectingCard ? (
                            <>
                              <span className="finance-hub__spinner"></span> 연결 중...
                            </>
                          ) : (
                            '카드사 연결하기'
                          )}
                        </button>
                      </>
                    )}

                    {cardAuthMethod === 'id' && (
                      <>
                        <div className="finance-hub__input-group" style={{ marginTop: '20px' }}>
                          <label>아이디</label>
                          <input
                            type="text"
                            placeholder="카드사 아이디"
                            value={cardCredentials.userId}
                            onChange={(e) => setCardCredentials({ ...cardCredentials, userId: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnectingCard}
                          />
                        </div>
                        <div className="finance-hub__input-group">
                          <label>비밀번호</label>
                          <input
                            type="password"
                            placeholder="카드사 비밀번호"
                            value={cardCredentials.password}
                            onChange={(e) => setCardCredentials({ ...cardCredentials, password: e.target.value })}
                            className="finance-hub__input"
                            disabled={isConnectingCard}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isConnectingCard) handleConnectCard();
                            }}
                          />
                        </div>
                        <div className="finance-hub__checkbox-group">
                          <label className="finance-hub__checkbox-label">
                            <input
                              type="checkbox"
                              checked={saveCardCredentials}
                              onChange={(e) => setSaveCardCredentials(e.target.checked)}
                              disabled={isConnectingCard}
                            />
                            아이디 및 비밀번호 저장 (암호화하여 안전하게 보관)
                          </label>
                        </div>
                        {(selectedCard?.id === 'shinhan-card' || selectedCard?.id === 'nh-card' || selectedCard?.id === 'hana-card' || selectedCard?.id === 'kb-card') && (
                          <div className="finance-hub__checkbox-group">
                            <label className="finance-hub__checkbox-label" style={{ color: '#ff6b6b', fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                checked={manualPasswordMode}
                                onChange={(e) => setManualPasswordMode(e.target.checked)}
                                disabled={isConnectingCard}
                              />
                              🔧 디버그 모드 (수동 비밀번호 입력)
                            </label>
                            {manualPasswordMode && (
                              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px', marginLeft: '24px' }}>
                                Arduino HID 대신 브라우저에서 직접 비밀번호를 입력한 후 앱에서 "계속하기" 버튼을 클릭하세요
                              </p>
                            )}
                          </div>
                        )}
                        <button
                          className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                          onClick={handleConnectCard}
                          disabled={isConnectingCard || !cardCredentials.userId || !cardCredentials.password}
                        >
                          {isConnectingCard ? (
                            <>
                              <span className="finance-hub__spinner"></span> 연결 중...
                            </>
                          ) : (
                            '카드사 연결하기'
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="finance-hub__modal-filters">
                  <input
                    type="text"
                    placeholder="카드사 검색..."
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    className="finance-hub__search-input"
                  />
                  <div className="finance-hub__category-tabs">
                    {Object.entries(CARD_CATEGORY_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`finance-hub__category-tab ${selectedCardCategory === key ? 'finance-hub__category-tab--active' : ''}`}
                        onClick={() => setSelectedCardCategory(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="finance-hub__bank-list">
                  {filteredCards.map((card) => {
                    const isConnected = connectedCards.some(c => c.cardCompanyId === card.id && c.status === 'connected');
                    return (
                      <div
                        key={card.id}
                        className={`finance-hub__bank-item ${!card.supportsAutomation ? 'finance-hub__bank-item--disabled' : ''} ${isConnected ? 'finance-hub__bank-item--connected' : ''}`}
                        style={{ '--bank-color': card.color } as React.CSSProperties}
                        onClick={() => handleSelectCard(card)}
                      >
                        <span className="finance-hub__bank-item-icon">{card.icon}</span>
                        <div className="finance-hub__bank-item-info">
                          <h4>{card.nameKo}</h4>
                          <span>{card.name}</span>
                        </div>
                        {isConnected && <span className="finance-hub__bank-badge finance-hub__bank-badge--connected">연결됨</span>}
                        {!card.supportsAutomation && <span className="finance-hub__bank-badge">준비 중</span>}
                        <span className="finance-hub__bank-arrow">→</span>
                      </div>
                    );
                  })}
                </div>
                <div className="finance-hub__modal-footer">
                  <p className="finance-hub__modal-note">💡 현재 NH농협카드 자동화가 지원됩니다.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hometax Business Connection Modal */}
      {showHometaxModal && (
        <div className="finance-hub__modal-overlay" onClick={handleCloseHometaxModal}>
          <div className="finance-hub__modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              <h2>홈택스 사업자 연결</h2>
              <button className="finance-hub__modal-close" onClick={handleCloseHometaxModal}>✕</button>
            </div>

            <div className="finance-hub__login-form">
              {/* Hometax Info Banner */}
              <div className="finance-hub__login-bank-info" style={{ background: '#00B140' }}>
                <span className="finance-hub__login-bank-icon" style={{ background: '#00B140' }}>🏛️</span>
                <div>
                  <h3>국세청 홈택스</h3>
                  <span>National Tax Service Hometax</span>
                </div>
              </div>

              {/* Connection Progress */}
              {hometaxConnectionProgress && (
                <div className="finance-hub__connection-progress">
                  <span className="finance-hub__spinner"></span>
                  <span>{hometaxConnectionProgress}</span>
                </div>
              )}

              {/* Step 1: Select Authentication Method */}
              {!hometaxAuthMethod && !hometaxConnectionProgress && (
                <div className="finance-hub__auth-method-selector">
                  <h3 style={{ marginBottom: '16px', color: 'var(--fh-text-primary)', textAlign: 'center' }}>로그인 방식을 선택하세요</h3>
                  <button
                    className="finance-hub__auth-method-btn"
                    onClick={() => handleSelectAuthMethod('certificate')}
                    disabled={isConnectingHometax}
                  >
                    <span className="finance-hub__auth-method-icon">🔐</span>
                    <div className="finance-hub__auth-method-info">
                      <h4>공동인증서</h4>
                      <p>공동인증서(구 공인인증서)로 로그인</p>
                    </div>
                  </button>
                  <button
                    className="finance-hub__auth-method-btn"
                    onClick={() => handleSelectAuthMethod('id')}
                    disabled={isConnectingHometax}
                  >
                    <span className="finance-hub__auth-method-icon">👤</span>
                    <div className="finance-hub__auth-method-info">
                      <h4>아이디 로그인</h4>
                      <p>홈택스 아이디와 비밀번호로 로그인</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2a: Certificate Selection (after fetching) */}
              {hometaxAuthMethod === 'certificate' && availableCertificates.length > 0 && (
                <div className="finance-hub__login-fields">
                  <h3 style={{ marginBottom: '16px', color: 'var(--fh-text-primary)' }}>인증서를 선택하세요</h3>

                  {/* Certificate List */}
                  <div className="finance-hub__certificate-list">
                    {availableCertificates.map((cert, index) => {
                      const isSaved = !!savedCertificates[cert.xpath];
                      return (
                        <div
                          key={index}
                          className={`finance-hub__certificate-item ${selectedCertificate === cert ? 'finance-hub__certificate-item--selected' : ''}`}
                          onClick={() => handleSelectCertificate(cert)}
                        >
                          <div className="finance-hub__certificate-icon">🔐</div>
                          <div className="finance-hub__certificate-info">
                            <h4>
                              {cert.소유자명}
                              {isSaved && (
                                <span className="finance-hub__certificate-saved-badge">저장됨</span>
                              )}
                            </h4>
                            <div className="finance-hub__certificate-details">
                              <span>용도: {cert.용도}</span>
                              <span>발급: {cert.발급기관}</span>
                              <span>만료: {cert.만료일}</span>
                            </div>
                          </div>
                          {selectedCertificate === cert && (
                            <span className="finance-hub__certificate-check">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Certificate Password */}
                  {selectedCertificate && (
                    <>
                      <div className="finance-hub__input-group" style={{ marginTop: '20px' }}>
                        <label>공동인증서 비밀번호</label>
                        <input
                          type="password"
                          placeholder="인증서 비밀번호를 입력하세요"
                          value={hometaxCredentials.certificatePassword}
                          onChange={(e) => setHometaxCredentials({ ...hometaxCredentials, certificatePassword: e.target.value })}
                          className="finance-hub__input"
                          disabled={isConnectingHometax}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isConnectingHometax) handleConnectHometax();
                          }}
                        />
                      </div>

                      <div className="finance-hub__checkbox-group">
                        <label className="finance-hub__checkbox-label">
                          <input
                            type="checkbox"
                            checked={saveHometaxCredentials}
                            onChange={(e) => setSaveHometaxCredentials(e.target.checked)}
                            disabled={isConnectingHometax}
                          />
                          인증서 비밀번호 저장 (암호화하여 안전하게 보관)
                        </label>
                      </div>

                      <button
                        className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                        onClick={handleConnectHometax}
                        disabled={isConnectingHometax || !hometaxCredentials.certificatePassword}
                      >
                        {isConnectingHometax ? (
                          <>
                            <span className="finance-hub__spinner"></span> 로그인 중...
                          </>
                        ) : (
                          '홈택스 연결하기'
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Step 2b: ID/Password Login */}
              {hometaxAuthMethod === 'id' && (
                <div className="finance-hub__login-fields">
                  <div className="finance-hub__input-group">
                    <label>사업자등록번호</label>
                    <input
                      type="text"
                      placeholder="123-45-67890"
                      value={hometaxCredentials.businessNumber}
                      onChange={(e) => setHometaxCredentials({ ...hometaxCredentials, businessNumber: e.target.value })}
                      className="finance-hub__input"
                      disabled={isConnectingHometax}
                    />
                  </div>

                  <div className="finance-hub__input-group">
                    <label>홈택스 아이디</label>
                    <input
                      type="text"
                      placeholder="홈택스 아이디"
                      value={hometaxCredentials.userId}
                      onChange={(e) => setHometaxCredentials({ ...hometaxCredentials, userId: e.target.value })}
                      className="finance-hub__input"
                      disabled={isConnectingHometax}
                    />
                  </div>

                  <div className="finance-hub__input-group">
                    <label>비밀번호</label>
                    <input
                      type="password"
                      placeholder="홈택스 비밀번호"
                      value={hometaxCredentials.password}
                      onChange={(e) => setHometaxCredentials({ ...hometaxCredentials, password: e.target.value })}
                      className="finance-hub__input"
                      disabled={isConnectingHometax}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isConnectingHometax) handleConnectHometax();
                      }}
                    />
                  </div>

                  <div className="finance-hub__checkbox-group">
                    <label className="finance-hub__checkbox-label">
                      <input
                        type="checkbox"
                        checked={saveHometaxCredentials}
                        onChange={(e) => setSaveHometaxCredentials(e.target.checked)}
                        disabled={isConnectingHometax}
                      />
                      로그인 정보 저장 (암호화하여 안전하게 보관)
                    </label>
                  </div>

                  <button
                    className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                    onClick={handleConnectHometax}
                    disabled={isConnectingHometax || !hometaxCredentials.businessNumber || !hometaxCredentials.userId || !hometaxCredentials.password}
                  >
                    {isConnectingHometax ? (
                      <>
                        <span className="finance-hub__spinner"></span> 로그인 중...
                      </>
                    ) : (
                      '홈택스 연결하기'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Password Continue Modal */}
      {showManualPasswordContinue && (
        <div className="finance-hub__modal-overlay" style={{ zIndex: 10000 }}>
          <div className="finance-hub__modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              <h2>🔐 디버그 모드: 수동 비밀번호 입력</h2>
            </div>
            <div className="finance-hub__modal-body" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
                브라우저 창에서 비밀번호를 입력한 후<br />
                아래 버튼을 클릭하여 자동화를 계속하세요.
              </p>
              <button
                className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--large"
                onClick={() => {
                  console.log('[Manual Password] Continue button clicked');
                  try {
                    window.electron.financeHub.manualPassword.continue();
                    console.log('[Manual Password] Continue event sent');
                  } catch (error) {
                    console.error('[Manual Password] Error sending continue:', error);
                  }
                }}
                style={{ fontSize: '18px', padding: '15px 50px' }}
              >
                ✅ 계속하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceHub;
