import React, { useState, useEffect, useCallback } from 'react';
import './FinanceHub.css';

// ============================================
// Types
// ============================================

interface BankConfig {
  id: string;
  name: string;
  nameKo: string;
  loginUrl: string;
  category: 'major' | 'regional' | 'special' | 'internet';
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

interface AccountInfo {
  accountNumber: string;
  accountName: string;
  bankId: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}

interface ConnectedBank {
  bankId: string;
  accountNumber?: string;
  alias?: string;
  lastSync?: Date;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  accounts?: AccountInfo[];
}

interface Transaction {
  id: string;
  date: string;
  time: string;
  type: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  branch: string;
  accountId: string;
}

interface TransactionStats {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  avgDeposit: number;
  avgWithdrawal: number;
}

interface MonthlySummary {
  yearMonth: string;
  depositCount: number;
  withdrawalCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netChange: number;
}

interface SyncOperation {
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

interface BankCredentials {
  bankId: string;
  userId: string;
  password: string;
}

// ============================================
// Bank Configuration
// ============================================

const KOREAN_BANKS: BankConfig[] = [
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
    supportsAutomation: false,
  },
  {
    id: 'woori',
    name: 'Woori Bank',
    nameKo: '우리은행',
    loginUrl: 'https://svc.wooribank.com/svc/Dream?withyou=PSTAX0069',
    category: 'major',
    color: '#0072BC',
    icon: '🏛️',
    supportsAutomation: false,
  },
  {
    id: 'hana',
    name: 'Hana Bank',
    nameKo: '하나은행',
    loginUrl: 'https://www.kebhana.com/',
    category: 'major',
    color: '#009775',
    icon: '🌿',
    supportsAutomation: false,
  },
  // ... (keep other banks as in your original file)
];

// ============================================
// Main Component
// ============================================

const FinanceHub: React.FC = () => {
  // === State ===
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankConfig | null>(null);
  const [credentials, setCredentials] = useState<BankCredentials>({
    bankId: '',
    userId: '',
    password: '',
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState<string | null>(null);
  const [connectionProgress, setConnectionProgress] = useState<string>('');
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLoading, setDebugLoading] = useState<string | null>(null);

  // === NEW: SQLite-backed state ===
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionStats, setTransactionStats] = useState<TransactionStats | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [recentSyncOps, setRecentSyncOps] = useState<SyncOperation[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isSyncingTransactions, setIsSyncingTransactions] = useState(false);
  const [dbStats, setDbStats] = useState<{
    totalAccounts: number;
    totalTransactions: number;
    totalSyncOperations: number;
    lastSyncAt: string | null;
  } | null>(null);

  // Calculate totals
  const totalAccounts = connectedBanks.reduce(
    (sum, bank) => sum + (bank.accounts?.length || 0),
    0
  );

  const filteredBanks = KOREAN_BANKS.filter((bank) => {
    const matchesCategory = selectedCategory === 'all' || bank.category === selectedCategory;
    const matchesSearch =
      bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bank.nameKo.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const categoryLabels: Record<string, string> = {
    all: '전체',
    major: '시중은행',
    special: '특수은행',
    regional: '지방은행',
    internet: '인터넷전문은행',
  };

  // ============================================
  // NEW: Load data from SQLite on mount
  // ============================================

  useEffect(() => {
    loadDatabaseStats();
    loadRecentSyncOperations();
  }, []);

  const loadDatabaseStats = async () => {
    try {
      const result = await window.electron.shinhanDb.getOverallStats();
      if (result.success) {
        setDbStats(result.data);
      }
    } catch (error) {
      console.error('[FinanceHub] Failed to load DB stats:', error);
    }
  };

  const loadRecentSyncOperations = async () => {
    try {
      const result = await window.electron.shinhanDb.getRecentSyncOperations(10);
      if (result.success) {
        setRecentSyncOps(result.data || []);
      }
    } catch (error) {
      console.error('[FinanceHub] Failed to load sync operations:', error);
    }
  };

  // ============================================
  // NEW: Load transactions for selected account
  // ============================================

  const loadTransactionsForAccount = useCallback(async (accountId: string) => {
    setIsLoadingTransactions(true);
    setSelectedAccountId(accountId);

    try {
      // Load transactions
      const txResult = await window.electron.shinhanDb.getTransactionsByAccount(accountId, 100);
      if (txResult.success) {
        setTransactions(txResult.data || []);
      }

      // Load stats
      const statsResult = await window.electron.shinhanDb.getTransactionStats(accountId);
      if (statsResult.success) {
        setTransactionStats(statsResult.data || null);
      }

      // Load monthly summary
      const summaryResult = await window.electron.shinhanDb.getMonthlySummary(accountId);
      if (summaryResult.success) {
        setMonthlySummary(summaryResult.data || []);
      }
    } catch (error) {
      console.error('[FinanceHub] Failed to load transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  // ============================================
  // NEW: Sync transactions and save to SQLite
  // ============================================

  const handleSyncAndSaveTransactions = async (bankId: string, accountNumber: string) => {
    setIsSyncingTransactions(true);

    try {
      // Calculate date range (last 3 months)
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(today.getMonth() - 3);

      const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
      const startDate = formatDate(threeMonthsAgo);
      const endDate = formatDate(today);

      console.log(`[FinanceHub] Syncing transactions for ${accountNumber}: ${startDate} ~ ${endDate}`);

      // Fetch transactions from bank
      const result = await window.electron.financeHub.getTransactions(
        bankId,
        accountNumber,
        startDate,
        endDate,
        true // Enable parsing
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch transactions');
      }

      // Get account metadata from the connected bank
      const connectedBank = connectedBanks.find(b => b.bankId === bankId);
      const accountInfo = connectedBank?.accounts?.find(a => a.accountNumber === accountNumber);

      // Prepare data for SQLite import
      const accountData = {
        accountNumber: accountNumber,
        accountName: accountInfo?.accountName || '계좌',
        customerName: connectedBank?.alias || '',
        balance: result.metadata?.balance || accountInfo?.balance || 0,
        availableBalance: result.metadata?.availableBalance || 0,
        openDate: result.metadata?.openDate || '',
      };

      const transactionsData = (result.transactions || []).map((tx: any) => ({
        date: tx.date,
        time: tx.time || '',
        type: tx.type || '',
        withdrawal: tx.withdrawal || 0,
        deposit: tx.deposit || 0,
        description: tx.description || '',
        balance: tx.balance || 0,
        branch: tx.branch || '',
      }));

      const syncMetadata = {
        queryPeriodStart: startDate,
        queryPeriodEnd: endDate,
        excelFilePath: result.file || result.filename,
      };

      // Import to SQLite
      const importResult = await window.electron.shinhanDb.importTransactions(
        accountData,
        transactionsData,
        syncMetadata
      );

      if (importResult.success) {
        const { importedCount, skippedCount, account } = importResult.data;
        
        console.log(`[FinanceHub] Import complete: ${importedCount} new, ${skippedCount} duplicates skipped`);

        // Refresh data
        await loadDatabaseStats();
        await loadRecentSyncOperations();
        
        // Load transactions for this account
        await loadTransactionsForAccount(account.id);

        // Update connected bank's lastSync
        setConnectedBanks(prev => prev.map(b => 
          b.bankId === bankId 
            ? { ...b, lastSync: new Date() }
            : b
        ));

        alert(
          `✅ 거래내역 동기화 완료!\n\n` +
          `• 새로 추가: ${importedCount}건\n` +
          `• 중복 건너뜀: ${skippedCount}건\n` +
          `• 기간: ${startDate} ~ ${endDate}`
        );
      } else {
        throw new Error(importResult.error);
      }
    } catch (error) {
      console.error('[FinanceHub] Sync error:', error);
      alert(`거래내역 동기화 실패: ${error}`);
    } finally {
      setIsSyncingTransactions(false);
    }
  };

  // ============================================
  // Existing handlers (keep your original implementations)
  // ============================================

  useEffect(() => {
    const checkExistingConnections = async () => {
      try {
        // 1. Load saved accounts from SQLite (persisted)
        const savedResult = await window.electron.shinhanDb.getAllAccounts();
        let savedBanks: ConnectedBank[] = [];
        
        if (savedResult.success && savedResult.data) {
          // Group accounts by bank (currently assuming all are Shinhan for now, but good to be generic)
          // SQLite accounts don't strictly store bankId, but we know they are Shinhan
          const shinhanAccounts = savedResult.data.map((acc: any) => ({
            accountNumber: acc.accountNumber,
            accountName: acc.accountName,
            bankId: 'shinhan',
            balance: acc.balance,
            currency: 'KRW',
            lastUpdated: acc.lastSyncedAt
          }));

          if (shinhanAccounts.length > 0) {
            savedBanks.push({
              bankId: 'shinhan',
              status: 'disconnected',
              alias: savedResult.data[0].customerName, // Use first account's customer name
              lastSync: new Date(savedResult.data[0].lastSyncedAt),
              accounts: shinhanAccounts
            });
          }
        }

        // 2. Check active sessions
        const connectedBanksList = await window.electron.financeHub.getConnectedBanks();
        
        // 3. Merge active sessions with saved banks
        const mergedBanks = savedBanks.map(bank => {
          const isActive = connectedBanksList.find((s: any) => s.bankId === bank.bankId);
          if (isActive) {
            return { ...bank, status: 'connected' as const, alias: isActive.userName || bank.alias };
          }
          return bank;
        });

        // Add any active sessions that weren't in saved store
        if (connectedBanksList && connectedBanksList.length > 0) {
          connectedBanksList.forEach((active: any) => {
            if (!mergedBanks.find(b => b.bankId === active.bankId)) {
              mergedBanks.push({
                bankId: active.bankId,
                status: 'connected',
                alias: active.userName || undefined,
                lastSync: new Date(),
                accounts: []
              });
            }
          });
        }
        
        setConnectedBanks(mergedBanks);
      } catch (error) {
        console.error('[FinanceHub] Failed to check existing connections:', error);
      }
    };

    checkExistingConnections();
  }, []);

  const handleFetchAccounts = useCallback(async (bankId: string) => {
    console.log(`[FinanceHub] Fetching accounts for ${bankId}...`);
    setIsFetchingAccounts(bankId);

    try {
      const result = await window.electron.financeHub.getAccounts(bankId);

      if (result.success && result.accounts) {
        setConnectedBanks((prev) =>
          prev.map((bank) =>
            bank.bankId === bankId
              ? {
                  ...bank,
                  accounts: result.accounts,
                  lastSync: new Date(),
                  status: 'connected' as const,
                }
              : bank
          )
        );
        console.log(`[FinanceHub] Fetched ${result.accounts.length} accounts for ${bankId}`);
      } else {
        console.error(`[FinanceHub] Failed to fetch accounts:`, result.error);
        alert(`계좌 정보 불러오기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[FinanceHub] Fetch accounts error:', error);
      alert('계좌 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsFetchingAccounts(null);
    }
  }, []);

  const handleSelectBank = async (bank: BankConfig) => {
    if (!bank.supportsAutomation) {
      alert(
        `${bank.nameKo}은(는) 현재 자동화를 지원하지 않습니다.\n\n` +
          (bank.category === 'internet'
            ? '인터넷전문은행은 모바일 앱 전용으로, PC 자동화가 불가능합니다.'
            : '곧 지원될 예정입니다.')
      );
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
        });
        setSaveCredentials(true);
      } else {
        setCredentials({ bankId: bank.id, userId: '', password: '' });
        setSaveCredentials(true);
      }
    } catch (error) {
      console.error('[FinanceHub] Failed to load saved credentials:', error);
      setCredentials({ bankId: bank.id, userId: '', password: '' });
    }
  };

  const handleBackToList = () => {
    setSelectedBank(null);
    setCredentials({ bankId: '', userId: '', password: '' });
    setConnectionProgress('');
  };

  const handleConnect = async () => {
    if (!selectedBank || !credentials.userId || !credentials.password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setIsConnecting(true);
    setConnectionProgress('로그인 중...');

    try {
      console.log(`[FinanceHub] Connecting to ${selectedBank.nameKo}...`);
      setConnectionProgress('은행에 로그인하는 중...');
      
      const result = await window.electron.financeHub.loginAndGetAccounts(selectedBank.id, {
        userId: credentials.userId,
        password: credentials.password,
      });

      if (result.success && result.isLoggedIn) {
        setConnectionProgress('계좌 정보를 불러왔습니다!');

        if (saveCredentials) {
          try {
            await window.electron.financeHub.saveCredentials(selectedBank.id, {
              bankId: selectedBank.id,
              userId: credentials.userId,
              password: credentials.password,
            });
          } catch (saveError) {
            console.warn('[FinanceHub] Failed to save credentials:', saveError);
          }
        }

        const newConnection: ConnectedBank = {
          bankId: selectedBank.id,
          status: 'connected',
          alias: result.userName || undefined,
          lastSync: new Date(),
          accounts: result.accounts || [],
        };

        // Save accounts to SQLite
        if (result.accounts && result.accounts.length > 0) {
          try {
            for (const acc of result.accounts) {
              await window.electron.shinhanDb.upsertAccount({
                accountNumber: acc.accountNumber,
                accountName: acc.accountName,
                customerName: result.userName || '사용자',
                balance: acc.balance,
                availableBalance: acc.balance, // Assuming same for now if not provided
                openDate: '' // Not provided in simple account list
              });
            }
            // Refresh stats after saving
            loadDatabaseStats();
          } catch (err) {
            console.error('[FinanceHub] Failed to save accounts to SQLite:', err);
          }
        }

        const existingIndex = connectedBanks.findIndex((b) => b.bankId === selectedBank.id);
        if (existingIndex >= 0) {
          setConnectedBanks((prev) =>
            prev.map((b, i) => (i === existingIndex ? newConnection : b))
          );
        } else {
          setConnectedBanks((prev) => [...prev, newConnection]);
        }

        alert(
          `${selectedBank.nameKo}${result.userName ? ` (${result.userName}님)` : ''} 연결에 성공했습니다!\n\n` +
          `${result.accounts?.length || 0}개의 계좌를 찾았습니다.`
        );

        handleCloseModal();
      } else {
        console.error(`[FinanceHub] Login failed:`, result.error);
        setConnectionProgress('');
        alert(`${selectedBank.nameKo} 연결 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[FinanceHub] Login error:', error);
      setConnectionProgress('');
      alert('은행 연결 중 오류가 발생했습니다.');
    } finally {
      setIsConnecting(false);
      setConnectionProgress('');
    }
  };

  const handleDisconnect = async (bankId: string) => {
    const bank = getBankById(bankId);
    const confirmed = window.confirm(
      `${bank?.nameKo || bankId} 연결을 해제하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      await window.electron.financeHub.disconnect(bankId);
      setConnectedBanks((prev) => prev.filter((b) => b.bankId !== bankId));
      console.log(`[FinanceHub] Disconnected from ${bankId}`);
    } catch (error) {
      console.error('[FinanceHub] Disconnect error:', error);
    }
  };

  const handleCloseModal = () => {
    setShowBankSelector(false);
    setSelectedBank(null);
    setCredentials({ bankId: '', userId: '', password: '' });
    setConnectionProgress('');
  };

  const getBankById = (id: string): BankConfig | undefined => {
    return KOREAN_BANKS.find((bank) => bank.id === id);
  };

  const formatAccountNumber = (num: string): string => {
    if (num.includes('-') || num.length < 10) return num;
    return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
  };

  const formatCurrency = (amount: number): string => {
    return `₩${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    // Handle YYYY-MM-DD or YYYYMMDD formats
    const normalized = dateStr.replace(/-/g, '');
    if (normalized.length === 8) {
      return `${normalized.slice(0, 4)}.${normalized.slice(4, 6)}.${normalized.slice(6, 8)}`;
    }
    return dateStr;
  };

  // ============================================
  // Debug handlers (keep your existing ones)
  // ============================================

  const handleDebugOpenBrowser = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    setDebugLoading('browser');
    try {
      const result = await window.electron.financeHub.openBrowser(bankId);
      if (result.success) {
        alert(`✅ ${bank.nameKo} 브라우저가 열렸습니다!`);
      } else {
        alert(`❌ 브라우저 열기 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };

  const handleDebugLoginOnly = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    setDebugLoading('login');
    try {
      const result = await window.electron.financeHub.getSavedCredentials(bankId);
      if (!result.success || !result.credentials) {
        alert('저장된 인증 정보가 없습니다.');
        return;
      }

      const loginResult = await window.electron.financeHub.login(bankId, {
        userId: result.credentials.userId,
        password: result.credentials.password,
      });

      if (loginResult.success) {
        alert(`✅ ${bank.nameKo} 로그인 성공!`);
        setConnectedBanks((prev) =>
          prev.map((b) =>
            b.bankId === bankId
              ? { ...b, status: 'connected' as const, lastSync: new Date() }
              : b
          )
        );
      } else {
        alert(`❌ 로그인 실패: ${loginResult.error}`);
      }
    } catch (error) {
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };

  const handleDebugGetAccountsOnly = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    setDebugLoading('accounts');
    try {
      const result = await window.electron.financeHub.getAccounts(bankId);

      if (result.success && result.accounts) {
        setConnectedBanks((prev) => {
          const existingIndex = prev.findIndex((b) => b.bankId === bankId);
          if (existingIndex >= 0) {
            return prev.map((b, i) =>
              i === existingIndex
                ? { ...b, accounts: result.accounts, lastSync: new Date(), status: 'connected' as const }
                : b
            );
          } else {
            return [...prev, { bankId, status: 'connected' as const, lastSync: new Date(), accounts: result.accounts }];
          }
        });
        
        alert(
          `✅ ${result.accounts.length}개의 계좌를 찾았습니다:\n` +
          result.accounts.map((a: AccountInfo) => `• ${a.accountNumber} (${formatCurrency(a.balance)})`).join('\n')
        );
      } else {
        alert(`❌ 계좌 조회 실패: ${result.error}`);
      }
    } catch (error) {
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };

  const handleDebugFullFlow = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    setDebugLoading('full');
    try {
      const result = await window.electron.financeHub.getSavedCredentials(bankId);
      if (!result.success || !result.credentials) {
        alert('저장된 인증 정보가 없습니다.');
        return;
      }

      const fullResult = await window.electron.financeHub.loginAndGetAccounts(bankId, {
        userId: result.credentials.userId,
        password: result.credentials.password,
      });

      if (fullResult.success && fullResult.isLoggedIn) {
        setConnectedBanks((prev) =>
          prev.map((b) =>
            b.bankId === bankId
              ? { ...b, accounts: fullResult.accounts || [], alias: fullResult.userName, lastSync: new Date(), status: 'connected' as const }
              : b
          )
        );
        alert(`✅ 전체 플로우 성공!\n- 사용자: ${fullResult.userName}\n- 계좌 수: ${fullResult.accounts?.length || 0}`);
      } else {
        alert(`❌ 실패: ${fullResult.error}`);
      }
    } catch (error) {
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="finance-hub">
      {/* Animated Background */}
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
          <p className="finance-hub__tagline">
            여러 은행에 따로 로그인할 필요 없이, 모든 계좌와 지출 내역을 한 곳에서 확인하세요
          </p>
        </div>
        <div className="finance-hub__header-stats">
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">
              {connectedBanks.filter((b) => b.status === 'connected').length}
            </span>
            <span className="finance-hub__stat-label">연결된 은행</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{totalAccounts}</span>
            <span className="finance-hub__stat-label">계좌 수</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">
              {dbStats?.totalTransactions || 0}
            </span>
            <span className="finance-hub__stat-label">저장된 거래</span>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="finance-hub__debug-panel finance-hub__debug-panel--header">
          <button
            className="finance-hub__debug-toggle"
            onClick={() => setShowDebugPanel(!showDebugPanel)}
          >
            🔧 Debug Tools {showDebugPanel ? '▼' : '▶'}
          </button>
          
          {showDebugPanel && (
            <div className="finance-hub__debug-actions">
              <p className="finance-hub__debug-description">
                테스트용 디버그 버튼들입니다. 각 단계를 개별적으로 실행할 수 있습니다.
              </p>
              
              <div className="finance-hub__debug-bank-selector">
                <label>테스트할 은행:</label>
                <select
                  className="finance-hub__debug-select"
                  defaultValue={connectedBanks[0]?.bankId || 'shinhan'}
                  onChange={(e) => {
                    (window as any).__debugSelectedBank = e.target.value;
                  }}
                >
                  {connectedBanks.length > 0 ? (
                    connectedBanks.map((conn) => {
                      const bank = getBankById(conn.bankId);
                      return (
                        <option key={conn.bankId} value={conn.bankId}>
                          {bank?.icon} {bank?.nameKo || conn.bankId}
                        </option>
                      );
                    })
                  ) : (
                    KOREAN_BANKS.filter(b => b.supportsAutomation).map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.icon} {bank.nameKo}
                      </option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="finance-hub__debug-buttons">
                <button
                  className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline"
                  onClick={() => handleDebugOpenBrowser((window as any).__debugSelectedBank || 'shinhan')}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'browser' ? '열기 중...' : '🌐 브라우저 열기'}
                </button>

                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => handleDebugLoginOnly((window as any).__debugSelectedBank || 'shinhan')}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'login' ? '로그인 중...' : '🔐 로그인만 실행'}
                </button>
                
                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => handleDebugGetAccountsOnly((window as any).__debugSelectedBank || 'shinhan')}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'accounts' ? '조회 중...' : '📋 계좌만 조회'}
                </button>
                
                <button
                  className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary"
                  onClick={() => handleDebugFullFlow((window as any).__debugSelectedBank || 'shinhan')}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'full' ? '실행 중...' : '🚀 전체 플로우 실행'}
                </button>
              </div>

              {/* Database Stats */}
              {dbStats && (
                <div className="finance-hub__debug-stats">
                  <h4>📊 데이터베이스 현황</h4>
                  <div className="finance-hub__debug-stats-grid">
                    <span>계좌: {dbStats.totalAccounts}개</span>
                    <span>거래내역: {dbStats.totalTransactions}건</span>
                    <span>동기화: {dbStats.totalSyncOperations}회</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="finance-hub__main">
        {/* Connected Banks Section */}
        <section className="finance-hub__section">
          <div className="finance-hub__section-header">
            <h2>
              <span className="finance-hub__section-icon">🔗</span>
              연결된 계좌
            </h2>
            <button
              className="finance-hub__btn finance-hub__btn--primary"
              onClick={() => setShowBankSelector(true)}
            >
              <span>+</span> 은행 연결하기
            </button>
          </div>

          {connectedBanks.length === 0 ? (
            <div className="finance-hub__empty-state">
              <div className="finance-hub__empty-icon">🏦</div>
              <h3>연결된 은행이 없습니다</h3>
              <p>은행을 연결하면 모든 거래 내역을 자동으로 불러옵니다</p>
              <button
                className="finance-hub__btn finance-hub__btn--primary"
                onClick={() => setShowBankSelector(true)}
              >
                첫 번째 은행 연결하기
              </button>
            </div>
          ) : (
            <div className="finance-hub__connected-banks">
              {connectedBanks.map((connection) => {
                const bank = getBankById(connection.bankId);
                if (!bank) return null;
                return (
                  <div
                    key={connection.bankId}
                    className="finance-hub__bank-card"
                    style={{ '--bank-color': bank.color } as React.CSSProperties}
                  >
                    <div className="finance-hub__bank-card-header">
                      <span className="finance-hub__bank-icon">{bank.icon}</span>
                      <div className="finance-hub__bank-info">
                        <h4>{bank.nameKo}</h4>
                        <span className="finance-hub__bank-name-en">
                          {connection.alias ? `${connection.alias}님` : bank.name}
                        </span>
                      </div>
                      <span className={`finance-hub__status finance-hub__status--${connection.status}`}>
                        {connection.status === 'connected' && '연결됨'}
                        {connection.status === 'pending' && '연결중...'}
                        {connection.status === 'error' && '오류'}
                        {connection.status === 'disconnected' && '연결 끊김'}
                      </span>
                    </div>

                    {/* Account List with Sync Button */}
                    {connection.accounts && connection.accounts.length > 0 && (
                      <div className="finance-hub__accounts-list">
                        {connection.accounts.map((account, idx) => (
                          <div key={idx} className="finance-hub__account-item">
                            <div className="finance-hub__account-info">
                              <span className="finance-hub__account-number">
                                {formatAccountNumber(account.accountNumber)}
                              </span>
                              <span className="finance-hub__account-name">
                                {account.accountName || '계좌'}
                              </span>
                            </div>
                            <div className="finance-hub__account-actions">
                              {account.balance > 0 && (
                                <span className="finance-hub__account-balance">
                                  {formatCurrency(account.balance)}
                                </span>
                              )}
                              {/* NEW: Sync to SQLite button */}
                              <button
                                className="finance-hub__btn finance-hub__btn--small finance-hub__btn--sync"
                                onClick={() => handleSyncAndSaveTransactions(connection.bankId, account.accountNumber)}
                                disabled={isSyncingTransactions}
                                title="거래내역 동기화 및 저장"
                              >
                                {isSyncingTransactions ? '⏳' : '🔄'} 동기화
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="finance-hub__bank-card-footer">
                      <span>
                        {connection.lastSync
                          ? `마지막 동기화: ${connection.lastSync.toLocaleString('ko-KR')}`
                          : '동기화 안됨'}
                      </span>
                      <div className="finance-hub__bank-actions">
                        <button
                          className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline"
                          onClick={() => handleFetchAccounts(connection.bankId)}
                          disabled={isFetchingAccounts === connection.bankId}
                        >
                          {isFetchingAccounts === connection.bankId ? '조회 중...' : '계좌 조회'}
                        </button>
                        <button
                          className="finance-hub__btn finance-hub__btn--small finance-hub__btn--danger"
                          onClick={() => handleDisconnect(connection.bankId)}
                        >
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

        {/* NEW: Transactions Section with SQLite Data */}
        <section className="finance-hub__section">
          <div className="finance-hub__section-header">
            <h2>
              <span className="finance-hub__section-icon">📊</span>
              최근 거래 내역
            </h2>
            {selectedAccountId && (
              <button
                className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline"
                onClick={() => {
                  setSelectedAccountId(null);
                  setTransactions([]);
                  setTransactionStats(null);
                }}
              >
                전체 보기
              </button>
            )}
          </div>

          {/* Transaction Stats */}
          {transactionStats && (
            <div className="finance-hub__transaction-stats">
              <div className="finance-hub__stat-card finance-hub__stat-card--deposit">
                <span className="finance-hub__stat-card-label">총 입금</span>
                <span className="finance-hub__stat-card-value">
                  {formatCurrency(transactionStats.totalDeposits)}
                </span>
                <span className="finance-hub__stat-card-count">
                  {transactionStats.depositCount}건
                </span>
              </div>
              <div className="finance-hub__stat-card finance-hub__stat-card--withdrawal">
                <span className="finance-hub__stat-card-label">총 출금</span>
                <span className="finance-hub__stat-card-value">
                  {formatCurrency(transactionStats.totalWithdrawals)}
                </span>
                <span className="finance-hub__stat-card-count">
                  {transactionStats.withdrawalCount}건
                </span>
              </div>
              <div className="finance-hub__stat-card">
                <span className="finance-hub__stat-card-label">순 변동</span>
                <span className={`finance-hub__stat-card-value ${
                  transactionStats.totalDeposits - transactionStats.totalWithdrawals >= 0 
                    ? 'finance-hub__stat-card-value--positive' 
                    : 'finance-hub__stat-card-value--negative'
                }`}>
                  {formatCurrency(transactionStats.totalDeposits - transactionStats.totalWithdrawals)}
                </span>
              </div>
            </div>
          )}

          {/* Transaction List */}
          {isLoadingTransactions ? (
            <div className="finance-hub__loading">
              <span className="finance-hub__spinner"></span>
              거래내역 불러오는 중...
            </div>
          ) : transactions.length === 0 ? (
            <div className="finance-hub__empty-state finance-hub__empty-state--small">
              <div className="finance-hub__empty-icon">📋</div>
              <p>
                {selectedAccountId 
                  ? '이 계좌의 저장된 거래내역이 없습니다.'
                  : '계좌를 선택하고 "동기화" 버튼을 눌러 거래내역을 저장하세요.'}
              </p>
            </div>
          ) : (
            <div className="finance-hub__transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>시간</th>
                    <th>적요</th>
                    <th>내용</th>
                    <th className="finance-hub__cell--right">출금</th>
                    <th className="finance-hub__cell--right">입금</th>
                    <th className="finance-hub__cell--right">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 50).map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>{tx.time}</td>
                      <td>{tx.type}</td>
                      <td>{tx.description}</td>
                      <td className="finance-hub__cell--right finance-hub__cell--withdrawal">
                        {tx.withdrawal > 0 ? formatCurrency(tx.withdrawal) : '-'}
                      </td>
                      <td className="finance-hub__cell--right finance-hub__cell--deposit">
                        {tx.deposit > 0 ? formatCurrency(tx.deposit) : '-'}
                      </td>
                      <td className="finance-hub__cell--right">
                        {formatCurrency(tx.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 50 && (
                <div className="finance-hub__transactions-more">
                  ...외 {transactions.length - 50}건
                </div>
              )}
            </div>
          )}
        </section>

        {/* NEW: Monthly Summary */}
        {monthlySummary.length > 0 && (
          <section className="finance-hub__section">
            <div className="finance-hub__section-header">
              <h2>
                <span className="finance-hub__section-icon">📅</span>
                월별 요약
              </h2>
            </div>
            <div className="finance-hub__monthly-summary">
              {monthlySummary.slice(0, 6).map((month) => (
                <div key={month.yearMonth} className="finance-hub__monthly-card">
                  <h4>{month.yearMonth}</h4>
                  <div className="finance-hub__monthly-stats">
                    <div className="finance-hub__monthly-stat finance-hub__monthly-stat--deposit">
                      <span>입금</span>
                      <strong>{formatCurrency(month.totalDeposits)}</strong>
                      <small>{month.depositCount}건</small>
                    </div>
                    <div className="finance-hub__monthly-stat finance-hub__monthly-stat--withdrawal">
                      <span>출금</span>
                      <strong>{formatCurrency(month.totalWithdrawals)}</strong>
                      <small>{month.withdrawalCount}건</small>
                    </div>
                    <div className={`finance-hub__monthly-stat ${
                      month.netChange >= 0 
                        ? 'finance-hub__monthly-stat--positive' 
                        : 'finance-hub__monthly-stat--negative'
                    }`}>
                      <span>순변동</span>
                      <strong>{formatCurrency(month.netChange)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Sync Operations */}
        {recentSyncOps.length > 0 && (
          <section className="finance-hub__section">
            <div className="finance-hub__section-header">
              <h2>
                <span className="finance-hub__section-icon">🔄</span>
                최근 동기화 기록
              </h2>
            </div>
            <div className="finance-hub__sync-history">
              {recentSyncOps.slice(0, 5).map((op) => (
                <div key={op.id} className={`finance-hub__sync-item finance-hub__sync-item--${op.status}`}>
                  <div className="finance-hub__sync-info">
                    <span className="finance-hub__sync-account">
                      {formatAccountNumber(op.accountNumber)}
                    </span>
                    <span className="finance-hub__sync-date">
                      {new Date(op.startedAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="finance-hub__sync-stats">
                    <span>{op.totalCount}건</span>
                    <span className="finance-hub__sync-deposit">+{formatCurrency(op.totalDeposits)}</span>
                    <span className="finance-hub__sync-withdrawal">-{formatCurrency(op.totalWithdrawals)}</span>
                  </div>
                  <span className={`finance-hub__sync-status finance-hub__sync-status--${op.status}`}>
                    {op.status === 'completed' ? '✓' : op.status === 'failed' ? '✗' : '⏳'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Insights Section */}
        <section className="finance-hub__section finance-hub__section--full">
          <div className="finance-hub__section-header">
            <h2>
              <span className="finance-hub__section-icon">🤖</span>
              AI 재무 분석
            </h2>
          </div>

          <div className="finance-hub__insights">
            <div className="finance-hub__insight-card">
              <div className="finance-hub__insight-icon">📈</div>
              <h4>지출 분석</h4>
              <p>AI가 자동으로 거래를 분류하고 지출 패턴을 분석합니다</p>
            </div>
            <div className="finance-hub__insight-card">
              <div className="finance-hub__insight-icon">🎯</div>
              <h4>예산 추천</h4>
              <p>과거 데이터를 기반으로 최적의 예산 계획을 제안합니다</p>
            </div>
            <div className="finance-hub__insight-card">
              <div className="finance-hub__insight-icon">⚠️</div>
              <h4>이상 거래 감지</h4>
              <p>비정상적인 거래 패턴을 실시간으로 감지합니다</p>
            </div>
            <div className="finance-hub__insight-card">
              <div className="finance-hub__insight-icon">📑</div>
              <h4>세금 보고서</h4>
              <p>연말정산 및 세금 신고용 보고서를 자동 생성합니다</p>
            </div>
          </div>
        </section>
      </main>

      {/* Bank Selector Modal - Keep your existing modal code */}
      {showBankSelector && (
        <div className="finance-hub__modal-overlay" onClick={handleCloseModal}>
          <div className="finance-hub__modal" onClick={(e) => e.stopPropagation()}>
            <div className="finance-hub__modal-header">
              {selectedBank ? (
                <>
                  <button className="finance-hub__back-btn" onClick={handleBackToList}>
                    ← 뒤로
                  </button>
                  <h2>{selectedBank.nameKo} 로그인</h2>
                </>
              ) : (
                <h2>은행 선택</h2>
              )}
              <button className="finance-hub__modal-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            {selectedBank ? (
              <div className="finance-hub__login-form">
                <div className="finance-hub__login-bank-info">
                  <span
                    className="finance-hub__login-bank-icon"
                    style={{ background: selectedBank.color }}
                  >
                    {selectedBank.icon}
                  </span>
                  <div>
                    <h3>{selectedBank.nameKo}</h3>
                    <span>{selectedBank.name}</span>
                  </div>
                </div>

                <div className="finance-hub__login-fields">
                  <div className="finance-hub__input-group">
                    <label htmlFor="userId">아이디</label>
                    <input
                      type="text"
                      id="userId"
                      placeholder="인터넷뱅킹 아이디 입력"
                      value={credentials.userId}
                      onChange={(e) => setCredentials({ ...credentials, userId: e.target.value })}
                      className="finance-hub__input"
                      autoComplete="username"
                      disabled={isConnecting}
                    />
                  </div>
                  <div className="finance-hub__input-group">
                    <label htmlFor="password">비밀번호</label>
                    <input
                      type="password"
                      id="password"
                      placeholder="인터넷뱅킹 비밀번호 입력"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      className="finance-hub__input"
                      autoComplete="current-password"
                      disabled={isConnecting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isConnecting) handleConnect();
                      }}
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
                      아이디 및 비밀번호 저장
                    </label>
                  </div>
                </div>

                {connectionProgress && (
                  <div className="finance-hub__connection-progress">
                    <span className="finance-hub__spinner"></span>
                    <span>{connectionProgress}</span>
                  </div>
                )}

                <div className="finance-hub__login-notice">
                  <div className="finance-hub__notice-icon">🔒</div>
                  <div>
                    <strong>안전한 연결</strong>
                    <p>입력하신 정보는 암호화되어 전송되며, 서버에 저장되지 않습니다.</p>
                  </div>
                </div>

                <button
                  className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full"
                  onClick={handleConnect}
                  disabled={isConnecting || !credentials.userId || !credentials.password}
                >
                  {isConnecting ? (
                    <>
                      <span className="finance-hub__spinner"></span>
                      연결 중...
                    </>
                  ) : (
                    '은행 연결하기'
                  )}
                </button>
              </div>
            ) : (
              <>
                <div className="finance-hub__modal-filters">
                  <input
                    type="text"
                    placeholder="은행 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="finance-hub__search-input"
                  />
                  <div className="finance-hub__category-tabs">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <button
                        key={key}
                        className={`finance-hub__category-tab ${
                          selectedCategory === key ? 'finance-hub__category-tab--active' : ''
                        }`}
                        onClick={() => setSelectedCategory(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="finance-hub__bank-list">
                  {filteredBanks.map((bank) => {
                    const isConnected = connectedBanks.some(
                      (b) => b.bankId === bank.id && b.status === 'connected'
                    );
                    return (
                      <div
                        key={bank.id}
                        className={`finance-hub__bank-item ${
                          !bank.supportsAutomation ? 'finance-hub__bank-item--disabled' : ''
                        } ${isConnected ? 'finance-hub__bank-item--connected' : ''}`}
                        style={{ '--bank-color': bank.color } as React.CSSProperties}
                        onClick={() => handleSelectBank(bank)}
                      >
                        <span className="finance-hub__bank-item-icon">{bank.icon}</span>
                        <div className="finance-hub__bank-item-info">
                          <h4>{bank.nameKo}</h4>
                          <span>{bank.name}</span>
                        </div>
                        {isConnected && (
                          <span className="finance-hub__bank-badge finance-hub__bank-badge--connected">
                            연결됨
                          </span>
                        )}
                        {!bank.supportsAutomation && (
                          <span className="finance-hub__bank-badge">
                            {bank.category === 'internet' ? '모바일 전용' : '준비 중'}
                          </span>
                        )}
                        <span className="finance-hub__bank-arrow">→</span>
                      </div>
                    );
                  })}
                </div>

                <div className="finance-hub__modal-footer">
                  <p className="finance-hub__modal-note">
                    💡 현재 신한은행만 자동화가 지원됩니다. 다른 은행은 곧 추가될 예정입니다.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceHub;