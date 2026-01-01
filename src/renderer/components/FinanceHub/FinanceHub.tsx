import React, { useState, useEffect, useCallback } from 'react';
import './FinanceHub.css';

// Korean Bank Configuration with login URLs
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
  date: Date;
  description: string;
  amount: number;
  balance: number;
  bankId: string;
  category?: string;
}

interface BankCredentials {
  bankId: string;
  userId: string;
  password: string;
}

const KOREAN_BANKS: BankConfig[] = [
  // Major Commercial Banks (시중은행)
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
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'woori',
    name: 'Woori Bank',
    nameKo: '우리은행',
    loginUrl: 'https://svc.wooribank.com/svc/Dream?withyou=PSTAX0069',
    category: 'major',
    color: '#0072BC',
    icon: '🏛️',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'hana',
    name: 'Hana Bank',
    nameKo: '하나은행',
    loginUrl: 'https://www.kebhana.com/',
    category: 'major',
    color: '#009775',
    icon: '🌿',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'nonghyup',
    name: 'NH NongHyup Bank',
    nameKo: 'NH농협은행',
    loginUrl: 'https://banking.nonghyup.com/nhbank.html',
    category: 'special',
    color: '#00A651',
    icon: '🌾',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'ibk',
    name: 'IBK Industrial Bank',
    nameKo: 'IBK기업은행',
    loginUrl: 'https://www.ibk.co.kr/',
    category: 'special',
    color: '#003478',
    icon: '🏭',
    supportsAutomation: false, // Not implemented yet
  },
  // Internet-Only Banks (인터넷전문은행)
  {
    id: 'kakaobank',
    name: 'Kakao Bank',
    nameKo: '카카오뱅크',
    loginUrl: 'https://www.kakaobank.com/',
    category: 'internet',
    color: '#FFEB00',
    icon: '💬',
    supportsAutomation: false, // Mobile-only
  },
  {
    id: 'kbank',
    name: 'K Bank',
    nameKo: '케이뱅크',
    loginUrl: 'https://www.kbanknow.com/',
    category: 'internet',
    color: '#FF6B35',
    icon: '📱',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'tossbank',
    name: 'Toss Bank',
    nameKo: '토스뱅크',
    loginUrl: 'https://www.tossbank.com/',
    category: 'internet',
    color: '#0064FF',
    icon: '💸',
    supportsAutomation: false, // Mobile-only
  },
  // Special Banks (특수은행)
  {
    id: 'kdb',
    name: 'KDB Industrial Bank',
    nameKo: 'KDB산업은행',
    loginUrl: 'https://www.kdb.co.kr/',
    category: 'special',
    color: '#1A237E',
    icon: '🏗️',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'suhyup',
    name: 'Sh Suhyup Bank',
    nameKo: 'Sh수협은행',
    loginUrl: 'https://www.suhyup-bank.com/',
    category: 'special',
    color: '#00BCD4',
    icon: '🐟',
    supportsAutomation: false, // Not implemented yet
  },
  // Regional Banks (지방은행)
  {
    id: 'dgb',
    name: 'DGB Daegu Bank',
    nameKo: 'DGB대구은행',
    loginUrl: 'https://www.dgb.co.kr/',
    category: 'regional',
    color: '#E31937',
    icon: '🏔️',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'bnk_busan',
    name: 'BNK Busan Bank',
    nameKo: 'BNK부산은행',
    loginUrl: 'https://www.busanbank.co.kr/',
    category: 'regional',
    color: '#0072CE',
    icon: '⚓',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'kwangju',
    name: 'Kwangju Bank',
    nameKo: '광주은행',
    loginUrl: 'https://www.kjbank.com/',
    category: 'regional',
    color: '#00A9E0',
    icon: '🌸',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'jeonbuk',
    name: 'Jeonbuk Bank',
    nameKo: '전북은행',
    loginUrl: 'https://www.jbbank.co.kr/',
    category: 'regional',
    color: '#003DA5',
    icon: '🎋',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'jeju',
    name: 'Jeju Bank',
    nameKo: '제주은행',
    loginUrl: 'https://www.jejubank.co.kr/',
    category: 'regional',
    color: '#FF6F00',
    icon: '🍊',
    supportsAutomation: false, // Not implemented yet
  },
  // Foreign Banks (외국계은행)
  {
    id: 'sc',
    name: 'SC First Bank',
    nameKo: 'SC제일은행',
    loginUrl: 'https://www.standardchartered.co.kr/',
    category: 'major',
    color: '#007A3D',
    icon: '🌐',
    supportsAutomation: false, // Not implemented yet
  },
  {
    id: 'imbank',
    name: 'iM Bank',
    nameKo: 'iM뱅크',
    loginUrl: 'https://banking.imbank.co.kr/',
    category: 'regional',
    color: '#E4002B',
    icon: '📲',
    supportsAutomation: false, // Not implemented yet
  },
];

const FinanceHub: React.FC = () => {
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions] = useState<Transaction[]>([]);
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

  // Calculate total accounts across all connected banks
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

  // Check for existing connections on mount
  useEffect(() => {
    const checkExistingConnections = async () => {
      try {
        const connectedBanksList = await window.electron.financeHub.getConnectedBanks();
        if (connectedBanksList && connectedBanksList.length > 0) {
          const updatedBanks: ConnectedBank[] = connectedBanksList.map((bank) => ({
            bankId: bank.bankId,
            status: bank.isLoggedIn ? 'connected' : 'disconnected',
            alias: bank.userName || undefined,
            lastSync: new Date(),
          }));
          setConnectedBanks(updatedBanks);
        }
      } catch (error) {
        console.error('[FinanceHub] Failed to check existing connections:', error);
      }
    };

    checkExistingConnections();
  }, []);

  // Fetch accounts for a connected bank
  const handleFetchAccounts = useCallback(async (bankId: string) => {
    console.log(`[FinanceHub] Fetching accounts for ${bankId}...`);
    setIsFetchingAccounts(bankId);

    try {
      const result = await window.electron.financeHub.getAccounts(bankId);

      if (result.success && result.accounts) {
        // Update the connected bank with fetched accounts
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
    
    // Load saved credentials if they exist
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
        setCredentials({
          bankId: bank.id,
          userId: '',
          password: '',
        });
        setSaveCredentials(true); // Default to true for next time
      }
    } catch (error) {
      console.error('[FinanceHub] Failed to load saved credentials:', error);
      setCredentials({
        bankId: bank.id,
        userId: '',
        password: '',
      });
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

      // Use loginAndGetAccounts to login and fetch accounts in one call
      setConnectionProgress('은행에 로그인하는 중...');
      const result = await window.electron.financeHub.loginAndGetAccounts(selectedBank.id, {
        userId: credentials.userId,
        password: credentials.password,
      });

      if (result.success && result.isLoggedIn) {
        setConnectionProgress('계좌 정보를 불러왔습니다!');

        // Save credentials if requested
        if (saveCredentials) {
          try {
            await window.electron.financeHub.saveCredentials(selectedBank.id, {
              bankId: selectedBank.id,
              userId: credentials.userId,
              password: credentials.password,
            });
            console.log(`[FinanceHub] Saved credentials for ${selectedBank.id}`);
          } catch (saveError) {
            console.warn('[FinanceHub] Failed to save credentials:', saveError);
          }
        } else {
          // Explicitly remove if user unchecked save
          try {
            await window.electron.financeHub.removeCredentials(selectedBank.id);
          } catch (removeError) {
            console.warn('[FinanceHub] Failed to remove credentials:', removeError);
          }
        }

        const newConnection: ConnectedBank = {
          bankId: selectedBank.id,
          status: 'connected',
          alias: result.userName || undefined,
          lastSync: new Date(),
          accounts: result.accounts || [],
        };

        // Check if already connected
        const existingIndex = connectedBanks.findIndex((b) => b.bankId === selectedBank.id);
        if (existingIndex >= 0) {
          // Update existing connection
          setConnectedBanks((prev) =>
            prev.map((b, i) => (i === existingIndex ? newConnection : b))
          );
        } else {
          // Add new connection
          setConnectedBanks((prev) => [...prev, newConnection]);
        }

        const accountsMessage =
          result.accounts && result.accounts.length > 0
            ? `\n\n${result.accounts.length}개의 계좌를 찾았습니다:\n` +
              result.accounts.map((a) => `• ${a.accountNumber}`).join('\n')
            : '';

        alert(
          `${selectedBank.nameKo}${result.userName ? ` (${result.userName}님)` : ''} 연결에 성공했습니다!${accountsMessage}`
        );

        // Close modal
        handleCloseModal();
      } else {
        console.error(`[FinanceHub] Login failed:`, result.error);
        setConnectionProgress('');

        // Add with error status
        setConnectedBanks((prev) => {
          const existingIndex = prev.findIndex((b) => b.bankId === selectedBank.id);
          if (existingIndex >= 0) {
            return prev.map((b, i) =>
              i === existingIndex
                ? { ...b, status: 'error' as const, lastSync: new Date() }
                : b
            );
          }
          return [
            ...prev,
            {
              bankId: selectedBank.id,
              status: 'error' as const,
              lastSync: new Date(),
            },
          ];
        });

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

  // Debug Functions
  const handleDebugOpenBrowser = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    setDebugLoading('browser');
    try {
      const result = await window.electron.financeHub.openBrowser(bankId);

      if (result.success) {
        alert(`✅ ${bank.nameKo} 브라우저가 열렸습니다!\n\n수동으로 로그인한 후 다른 버튼들을 사용하세요.`);
      } else {
        alert(`❌ 브라우저 열기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[Debug] Open browser error:', error);
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
        alert('저장된 인증 정보가 없습니다. 먼저 은행을 연결해주세요.');
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
      console.error('[Debug] Login error:', error);
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
            // Update existing
            return prev.map((b, i) =>
              i === existingIndex
                ? {
                    ...b,
                    accounts: result.accounts,
                    lastSync: new Date(),
                    status: 'connected' as const,
                  }
                : b
            );
          } else {
            // Add new connection for debug session
            return [
              ...prev,
              {
                bankId: bankId,
                status: 'connected' as const,
                lastSync: new Date(),
                accounts: result.accounts,
              },
            ];
          }
        });
        
        alert(
          `✅ ${result.accounts.length}개의 계좌를 찾았습니다:\n` +
            result.accounts.map((a) => `• ${a.accountNumber} (₩${a.balance.toLocaleString()})`).join('\n')
        );
      } else {
        alert(`❌ 계좌 조회 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[Debug] Get accounts error:', error);
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };


  const handleDebugGetTransactions = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    // Get the first account if available
    const connectedBank = connectedBanks.find(b => b.bankId === bankId);
    if (!connectedBank || !connectedBank.accounts || connectedBank.accounts.length === 0) {
      alert('먼저 계좌 조회를 실행하여 계좌 정보를 가져와주세요.');
      return;
    }

    const account = connectedBank.accounts[0]; // Use first account for testing
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    // Format YYYYMMDD
    const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = formatDate(oneMonthAgo);
    const endDate = formatDate(today);

    setDebugLoading('transactions');
    try {
      alert(`계좌 ${account.accountNumber}의 최근 1개월 거래내역을 조회합니다.`);
      const result = await window.electron.financeHub.getTransactions(
        bankId, 
        account.accountNumber,
        startDate,
        endDate
      );

      if (result.success) {
        alert(
          `✅ 거래내역 조회 성공!\n` +
          `기간: ${startDate} ~ ${endDate}\n` +
          `건수: ${result.transactions?.length || 0}건`
        );
        console.log('[Debug] Transactions:', result.transactions);
      } else {
        alert(`❌ 거래내역 조회 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[Debug] Get transactions error:', error);
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
    }
  };

  const handleDebugGetTransactionsWithParsing = async (bankId: string) => {
    const bank = getBankById(bankId);
    if (!bank) return;

    // Get the first account if available
    const connectedBank = connectedBanks.find(b => b.bankId === bankId);
    if (!connectedBank || !connectedBank.accounts || connectedBank.accounts.length === 0) {
      alert('먼저 계좌 조회를 실행하여 계좌 정보를 가져와주세요.');
      return;
    }

    const account = connectedBank.accounts[0]; // Use first account for testing
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    // Format YYYYMMDD
    const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = formatDate(oneMonthAgo);
    const endDate = formatDate(today);

    setDebugLoading('transactions-parse');
    try {
      alert(`계좌 ${account.accountNumber}의 최근 1개월 거래내역을 조회하고 엑셀 파싱을 시도합니다.`);
      const result = await window.electron.financeHub.getTransactions(
        bankId, 
        account.accountNumber,
        startDate,
        endDate,
        true // Enable parsing
      );

      if (result.success) {
        let message = `✅ 거래내역 조회 및 파싱 성공!\n` +
          `기간: ${startDate} ~ ${endDate}\n`;
          
        if (result.summary) {
          message += `입금: ${result.summary.depositCount}건 (₩${result.summary.totalDeposits.toLocaleString()})\n` +
                     `출금: ${result.summary.withdrawalCount}건 (₩${result.summary.totalWithdrawals.toLocaleString()})\n`;
        }
        
        message += `총 거래내역: ${result.transactions?.length || 0}건\n` +
                   `파일: ${result.filename || 'unknown'}`;
                   
        alert(message);
        console.log('[Debug] Parsed Result:', result);
      } else {
        alert(`❌ 거래내역 조회 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('[Debug] Get transactions error:', error);
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
              ? {
                  ...b,
                  accounts: fullResult.accounts || [],
                  alias: fullResult.userName,
                  lastSync: new Date(),
                  status: 'connected' as const,
                }
              : b
          )
        );
        alert(
          `✅ 전체 플로우 성공!\n` +
            `- 사용자: ${fullResult.userName}\n` +
            `- 계좌 수: ${fullResult.accounts?.length || 0}`
        );
      } else {
        alert(`❌ 실패: ${fullResult.error}`);
      }
    } catch (error) {
      console.error('[Debug] Full flow error:', error);
      alert(`오류 발생: ${error}`);
    } finally {
      setDebugLoading(null);
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
    // Already formatted or short numbers
    if (num.includes('-') || num.length < 10) return num;
    // Format as XXX-XXX-XXXXXX
    return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
  };

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
              {KOREAN_BANKS.filter((b) => b.supportsAutomation).length}
            </span>
            <span className="finance-hub__stat-label">지원 은행</span>
          </div>
        </div>

        {/* Debug Panel - Global (Always Available) */}
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
              
              {/* Bank selector for debug actions */}
              <div className="finance-hub__debug-bank-selector">
                <label>테스트할 은행:</label>
                <select
                  className="finance-hub__debug-select"
                  defaultValue={connectedBanks[0]?.bankId || 'shinhan'}
                  onChange={(e) => {
                    // Store selected bank for debug actions
                    const selectedBankId = e.target.value;
                    (window as any).__debugSelectedBank = selectedBankId;
                  }}
                  onFocus={(e) => {
                    // Initialize on first interaction if not set
                    if (!(window as any).__debugSelectedBank) {
                      (window as any).__debugSelectedBank = e.target.value;
                    }
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
                    // Show all supported banks when no connections
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
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugOpenBrowser(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'browser' ? '열기 중...' : '🌐 브라우저 열기'}
                </button>

                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugLoginOnly(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'login' ? '로그인 중...' : '🔐 로그인만 실행'}
                </button>
                
                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugGetAccountsOnly(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'accounts' ? '조회 중...' : '📋 계좌만 조회'}
                </button>
                
                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugGetTransactions(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'transactions' ? '조회 중...' : '📊 거래내역 조회'}
                </button>

                <button
                  className="finance-hub__btn finance-hub__btn--small"
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugGetTransactionsWithParsing(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'transactions-parse' ? '분석 중...' : '📑 거래내역 + 파싱'}
                </button>
                
                <button
                  className="finance-hub__btn finance-hub__btn--small finance-hub__btn--primary"
                  onClick={() => {
                    const bankId = (window as any).__debugSelectedBank || connectedBanks[0]?.bankId || 'shinhan';
                    handleDebugFullFlow(bankId);
                  }}
                  disabled={debugLoading !== null}
                >
                  {debugLoading === 'full' ? '실행 중...' : '🚀 전체 플로우 실행'}
                </button>
              </div>

              <div className="finance-hub__debug-tips">
                <small>
                  💡 <strong>사용 시나리오:</strong><br/>
                  <strong>Step 1:</strong> "브라우저 열기" → 은행 페이지가 열립니다<br/>
                  <strong>Step 2:</strong> 수동으로 로그인하세요<br/>
                  <strong>Step 3:</strong> "계좌만 조회" → 로그인된 세션에서 계좌 정보를 가져옵니다<br/>
                  <strong>Step 4:</strong> "거래내역 조회" → 첫 번째 계좌의 1개월 내역을 테스트합니다<br/><br/>
                  
                  또는:<br/>
                  • "로그인만 실행" → 저장된 인증 정보로 자동 로그인 테스트<br/>
                  • "전체 플로우 실행" → 로그인 + 계좌 조회 한번에 실행
                  {connectedBanks.length === 0 && (
                    <>
                      <br/><br/>
                      ⚠️ 연결된 은행이 없습니다. "로그인만 실행"은 저장된 인증 정보가 필요합니다.
                    </>
                  )}
                </small>
              </div>
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
              <div className="finance-hub__value-props">
                <div className="finance-hub__value-prop">
                  <span>✓</span> 여러 은행 잔액을 한눈에
                </div>
                <div className="finance-hub__value-prop">
                  <span>✓</span> 지출 패턴 자동 분석
                </div>
                <div className="finance-hub__value-prop">
                  <span>✓</span> 매번 로그인하는 번거로움 해소
                </div>
              </div>
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
                      <span
                        className={`finance-hub__status finance-hub__status--${connection.status}`}
                      >
                        {connection.status === 'connected' && '연결됨'}
                        {connection.status === 'pending' && '연결중...'}
                        {connection.status === 'error' && '오류'}
                        {connection.status === 'disconnected' && '연결 끊김'}
                      </span>
                    </div>

                    {/* Account List */}
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
                            {account.balance > 0 && (
                              <span className="finance-hub__account-balance">
                                ₩{account.balance.toLocaleString()}
                              </span>
                            )}
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
                          {isFetchingAccounts === connection.bankId
                            ? '조회 중...'
                            : '계좌 조회'}
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

        {/* Transactions Section */}
        <section className="finance-hub__section">
          <div className="finance-hub__section-header">
            <h2>
              <span className="finance-hub__section-icon">📊</span>
              최근 거래 내역
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="finance-hub__empty-state finance-hub__empty-state--small">
              <div className="finance-hub__empty-icon">📋</div>
              <p>은행을 연결하면 거래 내역이 자동으로 추출됩니다</p>
            </div>
          ) : (
            <div className="finance-hub__transactions">
              {/* Transaction list would go here */}
            </div>
          )}
        </section>

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

      {/* Bank Selector Modal */}
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
              /* Login Form */
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
                      onChange={(e) =>
                        setCredentials({ ...credentials, userId: e.target.value })
                      }
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
                      onChange={(e) =>
                        setCredentials({ ...credentials, password: e.target.value })
                      }
                      className="finance-hub__input"
                      autoComplete="current-password"
                      disabled={isConnecting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isConnecting) {
                          handleConnect();
                        }
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
                    <p>
                      입력하신 정보는 암호화되어 전송되며, 서버에 저장되지 않습니다.
                      자동화된 브라우저를 통해 안전하게 은행에 로그인합니다.
                    </p>
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
              /* Bank List */
              <>
                {/* Search & Filter */}
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

                {/* Bank List */}
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