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
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

// Hooks
import { useTransactions } from '../../hooks/useTransactions';
import { FullDiskAccessWarning } from '../../hooks/useFullDiskAccess';

// Shared Components
import { TransactionTable, TransactionStats } from './shared';
import { SchedulerSettings } from './SchedulerSettings';

// Types & Utils
import {
  BankConfig,
  ConnectedBank,
  BankCredentials,
  DbStats,
  SyncOperation,
  KOREAN_BANKS,
  CATEGORY_LABELS,
} from './types';
import { formatAccountNumber, formatCurrency, getBankInfo } from './utils';

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
    transactions,
    stats,
    monthlySummary,
    accounts,
    banks,
    filters,
    pagination,
    sort,
    isLoading,
    isLoadingRecent,
    isSyncing,
    error,
    setFilters,
    resetFilters,
    setPage,
    toggleSort,
    loadBanksAndAccounts,
    loadAllTransactions,
    refreshAll,
    setIsSyncing,
  } = useTransactions();

  // ============================================
  // Local State
  // ============================================
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions'>('dashboard');
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankConfig | null>(null);
  const [credentials, setCredentials] = useState<BankCredentials>({ bankId: '', userId: '', password: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState<string | null>(null);
  const [connectionProgress, setConnectionProgress] = useState<string>('');
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLoading, setDebugLoading] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [recentSyncOps, setRecentSyncOps] = useState<SyncOperation[]>([]);
  const [showSyncOptions, setShowSyncOptions] = useState<string | null>(null); // accountNumber that's showing options
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  // ============================================
  // Computed Values
  // ============================================

  const totalAccounts = connectedBanks.reduce((sum, bank) => sum + (bank.accounts?.length || 0), 0);

  const filteredBanks = KOREAN_BANKS.filter((bank) => {
    const matchesCategory = selectedCategory === 'all' || bank.category === selectedCategory;
    const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) || bank.nameKo.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

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
  }, []);

  const checkExistingConnections = async () => {
    try {
      const savedResult = await window.electron.financeHubDb.getAllAccounts();
      let savedBanks: ConnectedBank[] = [];
      
      if (savedResult.success && savedResult.data && savedResult.data.length > 0) {
        const shinhanAccounts = savedResult.data.map((acc: any) => ({
          accountNumber: acc.accountNumber,
          accountName: acc.accountName,
          bankId: 'shinhan',
          balance: acc.balance,
          currency: 'KRW',
          lastUpdated: acc.lastSyncedAt
        }));

        savedBanks.push({
          bankId: 'shinhan',
          status: 'disconnected',
          alias: savedResult.data[0].customerName,
          lastSync: new Date(savedResult.data[0].lastSyncedAt),
          accounts: shinhanAccounts
        });
      }

      const connectedBanksList = await window.electron.financeHub.getConnectedBanks();
      
      const mergedBanks = savedBanks.map(bank => {
        const isActive = connectedBanksList?.find((s: any) => s.bankId === bank.bankId);
        return isActive ? { ...bank, status: 'connected' as const, alias: isActive.userName || bank.alias } : bank;
      });

      if (connectedBanksList && connectedBanksList.length > 0) {
        connectedBanksList.forEach((active: any) => {
          if (!mergedBanks.find(b => b.bankId === active.bankId)) {
            mergedBanks.push({ bankId: active.bankId, status: 'connected', alias: active.userName, lastSync: new Date(), accounts: [] });
          }
        });
      }
      
      setConnectedBanks(mergedBanks);
    } catch (error) {
      console.error('[FinanceHub] Failed to check existing connections:', error);
    }
  };

  // ============================================
  // Bank Connection Handlers
  // ============================================

  const getBankConfigById = (id: string): BankConfig | undefined => KOREAN_BANKS.find(bank => bank.id === id);

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
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'connected' as const, alias: loginResult.userName || b.alias, accounts: loginResult.accounts || b.accounts, lastSync: new Date() } : b));
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
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'connected' as const, alias: loginResult.userName || b.alias, lastSync: new Date() } : b));
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
        alert(`✅ 거래내역 동기화 완료!\n\n• 새로 추가: ${inserted}건\n• 중복 건너뜀: ${skipped}건`);
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
  // Other Handlers
  // ============================================

  const handleFetchAccounts = useCallback(async (bankId: string) => {
    setIsFetchingAccounts(bankId);
    try {
      const result = await window.electron.financeHub.getAccounts(bankId);
      if (result.success && result.accounts) {
        setConnectedBanks(prev => prev.map(bank => bank.bankId === bankId ? { ...bank, accounts: result.accounts, lastSync: new Date(), status: 'connected' as const } : bank));
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
        setCredentials({ bankId: bank.id, userId: result.credentials.userId || '', password: result.credentials.password || '' });
      } else {
        setCredentials({ bankId: bank.id, userId: '', password: '' });
      }
    } catch (error) {
      setCredentials({ bankId: bank.id, userId: '', password: '' });
    }
  };

  const handleConnect = async () => {
    if (!selectedBank || !credentials.userId || !credentials.password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setIsConnecting(true);
    setConnectionProgress('로그인 중...');
    try {
      const result = await window.electron.financeHub.loginAndGetAccounts(selectedBank.id, { userId: credentials.userId, password: credentials.password });
      if (result.success && result.isLoggedIn) {
        setConnectionProgress('계좌 정보를 불러왔습니다!');
        if (saveCredentials) await window.electron.financeHub.saveCredentials(selectedBank.id, credentials);

        const newConnection: ConnectedBank = { bankId: selectedBank.id, status: 'connected', alias: result.userName || undefined, lastSync: new Date(), accounts: result.accounts || [] };

        if (result.accounts && result.accounts.length > 0) {
          for (const acc of result.accounts) {
            await window.electron.financeHubDb.upsertAccount({ bankId: selectedBank.id, accountNumber: acc.accountNumber, accountName: acc.accountName, customerName: result.userName || '사용자', balance: acc.balance, availableBalance: acc.balance, openDate: '' });
          }
          loadDatabaseStats();
          loadBanksAndAccounts();
        }

        const existingIndex = connectedBanks.findIndex(b => b.bankId === selectedBank.id);
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

  const handleCloseModal = () => { setShowBankSelector(false); setSelectedBank(null); setCredentials({ bankId: '', userId: '', password: '' }); setConnectionProgress(''); };
  const handleBackToList = () => { setSelectedBank(null); setCredentials({ bankId: '', userId: '', password: '' }); setConnectionProgress(''); };

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
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, status: 'connected' as const, lastSync: new Date() } : b));
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
          if (idx >= 0) return prev.map((b, i) => i === idx ? { ...b, accounts: result.accounts, lastSync: new Date(), status: 'connected' as const } : b);
          return [...prev, { bankId, status: 'connected' as const, lastSync: new Date(), accounts: result.accounts }];
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
        setConnectedBanks(prev => prev.map(b => b.bankId === bankId ? { ...b, accounts: result.accounts || [], alias: result.userName, lastSync: new Date(), status: 'connected' as const } : b));
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
            <button className={`finance-hub__nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>대시보드</button>
            <button className={`finance-hub__nav-item ${currentView === 'transactions' ? 'active' : ''}`} onClick={() => setCurrentView('transactions')}>전체 거래내역</button>
          </nav>
        </div>

        <div className="finance-hub__header-stats">
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{connectedBanks.filter(b => b.status === 'connected').length}</span>
            <span className="finance-hub__stat-label">연결된 은행</span>
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

        {/* Debug Panel */}
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
      </header>

      {/* Main Content */}
      <main className="finance-hub__main">
        {currentView === 'dashboard' ? (
          <>
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
                          <div className="finance-hub__bank-info"><h4>{bank.nameKo}</h4><span className="finance-hub__bank-name-en">{connection.alias ? `${connection.alias}님` : bank.name}</span></div>
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
                  <button className="finance-hub__btn finance-hub__btn--small finance-hub__btn--outline" onClick={() => setCurrentView('transactions')}>전체 보기 →</button>
                </div>
              </div>
              {stats && <TransactionStats stats={stats} compact />}
              <TransactionTable transactions={recentTransactions} banks={banks} accounts={accounts} isLoading={isLoadingRecent} compact maxRows={10} onShowMore={() => setCurrentView('transactions')} emptyMessage="계좌를 선택하고 '동기화' 버튼을 눌러 거래내역을 저장하세요." />
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
        ) : (
          <div className="finance-hub__section finance-hub__section--full" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <TransactionsPage transactions={transactions} stats={stats} filters={filters} pagination={pagination} sort={sort} isLoading={isLoading} error={error} banks={banks} accounts={accounts} onFilterChange={setFilters} onResetFilters={resetFilters} onPageChange={setPage} onSort={toggleSort} loadAllTransactions={loadAllTransactions} />
          </div>
        )}
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
                <div className="finance-hub__login-fields">
                  <div className="finance-hub__input-group"><label>아이디</label><input type="text" placeholder="인터넷뱅킹 아이디" value={credentials.userId} onChange={(e) => setCredentials({ ...credentials, userId: e.target.value })} className="finance-hub__input" disabled={isConnecting} /></div>
                  <div className="finance-hub__input-group"><label>비밀번호</label><input type="password" placeholder="인터넷뱅킹 비밀번호" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} className="finance-hub__input" disabled={isConnecting} onKeyDown={(e) => { if (e.key === 'Enter' && !isConnecting) handleConnect(); }} /></div>
                  <div className="finance-hub__checkbox-group"><label className="finance-hub__checkbox-label"><input type="checkbox" checked={saveCredentials} onChange={(e) => setSaveCredentials(e.target.checked)} disabled={isConnecting} /> 아이디 및 비밀번호 저장</label></div>
                </div>
                {connectionProgress && <div className="finance-hub__connection-progress"><span className="finance-hub__spinner"></span><span>{connectionProgress}</span></div>}
                <div className="finance-hub__login-notice"><div className="finance-hub__notice-icon">🔒</div><div><strong>안전한 연결</strong><p>입력하신 정보는 암호화되어 전송됩니다.</p></div></div>
                <button className="finance-hub__btn finance-hub__btn--primary finance-hub__btn--full" onClick={handleConnect} disabled={isConnecting || !credentials.userId || !credentials.password}>{isConnecting ? <><span className="finance-hub__spinner"></span> 연결 중...</> : '은행 연결하기'}</button>
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
                <div className="finance-hub__modal-footer"><p className="finance-hub__modal-note">💡 현재 신한은행만 자동화가 지원됩니다.</p></div>
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
    </div>
  );
};

export default FinanceHub;
