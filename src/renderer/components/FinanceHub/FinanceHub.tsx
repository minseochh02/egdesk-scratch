import React, { useState } from 'react';
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
    id: 'nonghyup',
    name: 'NH NongHyup Bank',
    nameKo: 'NH농협은행',
    loginUrl: 'https://banking.nonghyup.com/nhbank.html',
    category: 'special',
    color: '#00A651',
    icon: '🌾',
    supportsAutomation: true,
  },
  {
    id: 'ibk',
    name: 'IBK Industrial Bank',
    nameKo: 'IBK기업은행',
    loginUrl: 'https://www.ibk.co.kr/',
    category: 'special',
    color: '#003478',
    icon: '🏭',
    supportsAutomation: true,
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
    supportsAutomation: true,
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
    supportsAutomation: true,
  },
  {
    id: 'suhyup',
    name: 'Sh Suhyup Bank',
    nameKo: 'Sh수협은행',
    loginUrl: 'https://www.suhyup-bank.com/',
    category: 'special',
    color: '#00BCD4',
    icon: '🐟',
    supportsAutomation: true,
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
    supportsAutomation: true,
  },
  {
    id: 'bnk_busan',
    name: 'BNK Busan Bank',
    nameKo: 'BNK부산은행',
    loginUrl: 'https://www.busanbank.co.kr/',
    category: 'regional',
    color: '#0072CE',
    icon: '⚓',
    supportsAutomation: true,
  },
  {
    id: 'kwangju',
    name: 'Kwangju Bank',
    nameKo: '광주은행',
    loginUrl: 'https://www.kjbank.com/',
    category: 'regional',
    color: '#00A9E0',
    icon: '🌸',
    supportsAutomation: true,
  },
  {
    id: 'jeonbuk',
    name: 'Jeonbuk Bank',
    nameKo: '전북은행',
    loginUrl: 'https://www.jbbank.co.kr/',
    category: 'regional',
    color: '#003DA5',
    icon: '🎋',
    supportsAutomation: true,
  },
  {
    id: 'jeju',
    name: 'Jeju Bank',
    nameKo: '제주은행',
    loginUrl: 'https://www.jejubank.co.kr/',
    category: 'regional',
    color: '#FF6F00',
    icon: '🍊',
    supportsAutomation: true,
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
    supportsAutomation: true,
  },
  {
    id: 'imbank',
    name: 'iM Bank',
    nameKo: 'iM뱅크',
    loginUrl: 'https://banking.imbank.co.kr/',
    category: 'regional',
    color: '#E4002B',
    icon: '📲',
    supportsAutomation: true,
  },
];

interface ConnectedBank {
  bankId: string;
  accountNumber?: string;
  alias?: string;
  lastSync?: Date;
  status: 'connected' | 'pending' | 'error';
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

const FinanceHub: React.FC = () => {
  const [connectedBanks, setConnectedBanks] = useState<ConnectedBank[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankConfig | null>(null);
  const [credentials, setCredentials] = useState<BankCredentials>({
    bankId: '',
    userId: '',
    password: '',
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);

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

  const handleFetchAccounts = async (bankId: string) => {
    // This assumes we have credentials stored or prompted
    // For now, we'll just log that we're fetching
    console.log(`Fetching accounts for ${bankId}...`);
    setIsFetchingAccounts(true);
    try {
      // In a real scenario, you'd retrieve stored credentials
      // For this demo, we'll prompt if they aren't there
      const result = await window.electron.financeHub.getAccounts(bankId, credentials);
      if (result.success) {
        setAccounts(result.accounts || []);
        alert('계좌 정보를 성공적으로 불러왔습니다.');
      } else {
        alert(`계좌 정보 불러오기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Fetch accounts error:', error);
    } finally {
      setIsFetchingAccounts(false);
    }
  };

  const handleSelectBank = (bank: BankConfig) => {
    if (!bank.supportsAutomation) {
      alert(`${bank.nameKo}은(는) 모바일 전용 은행으로, 현재 PC 자동화를 지원하지 않습니다.`);
      return;
    }
    
    setSelectedBank(bank);
    setCredentials({
      bankId: bank.id,
      userId: '',
      password: '',
    });
  };

  const handleBackToList = () => {
    setSelectedBank(null);
    setCredentials({ bankId: '', userId: '', password: '' });
  };

  const handleConnect = async () => {
    if (!selectedBank || !credentials.userId || !credentials.password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setIsConnecting(true);

    try {
      // Use the exposed IPC handler
      console.log(`[FinanceHub] Connecting to ${selectedBank.nameKo} via IPC...`);
      
      const result = await window.electron.financeHub.login(selectedBank.id, {
        userId: credentials.userId,
        password: credentials.password
      });

      if (result.success) {
        setConnectedBanks([
          ...connectedBanks,
          {
            bankId: selectedBank.id,
            status: 'connected',
            alias: result.userName || undefined,
            lastSync: new Date(),
          },
        ]);
        alert(`${selectedBank.nameKo}${result.userName ? ` (${result.userName}님)` : ''} 연결에 성공했습니다.`);
      } else {
        alert(`${selectedBank.nameKo} 연결 실패: ${result.error || '알 수 없는 오류'}`);
        setConnectedBanks([
          ...connectedBanks,
          {
            bankId: selectedBank.id,
            status: 'error',
            lastSync: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('[FinanceHub] Login IPC error:', error);
      alert('은행 연결 중 오류가 발생했습니다.');
    } finally {
      setIsConnecting(false);
      setSelectedBank(null);
      setCredentials({ bankId: '', userId: '', password: '' });
      setShowBankSelector(false);
    }
  };

  const handleCloseModal = () => {
    setShowBankSelector(false);
    setSelectedBank(null);
    setCredentials({ bankId: '', userId: '', password: '' });
  };

  const getBankById = (id: string): BankConfig | undefined => {
    return KOREAN_BANKS.find((bank) => bank.id === id);
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
            <span className="finance-hub__stat-value">{connectedBanks.length}</span>
            <span className="finance-hub__stat-label">연결된 은행</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{transactions.length}</span>
            <span className="finance-hub__stat-label">거래 내역</span>
          </div>
          <div className="finance-hub__stat">
            <span className="finance-hub__stat-value">{KOREAN_BANKS.length}</span>
            <span className="finance-hub__stat-label">지원 은행</span>
          </div>
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
                    className="finance-hub__bank-card finance-hub__bank-card--connected"
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
                      </span>
                    </div>
                     {connection.lastSync && (
                       <div className="finance-hub__bank-card-footer">
                         <span>마지막 동기화: {connection.lastSync.toLocaleString('ko-KR')}</span>
                         <button 
                           className="finance-hub__btn finance-hub__btn--small" 
                           onClick={() => handleFetchAccounts(connection.bankId)}
                           disabled={isFetchingAccounts}
                         >
                           {isFetchingAccounts ? '불러오는 중...' : '계좌 조회'}
                         </button>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           )}
         </section>

         {/* Accounts Section (New) */}
         {accounts.length > 0 && (
           <section className="finance-hub__section">
             <div className="finance-hub__section-header">
               <h2>
                 <span className="finance-hub__section-icon">🏦</span>
                 조회된 계좌 목록
               </h2>
             </div>
             <div className="finance-hub__accounts-list">
               {accounts.map((acc, idx) => (
                 <div key={idx} className="finance-hub__account-item">
                   <div className="finance-hub__account-info">
                     <span className="finance-hub__account-number">{acc.accountNumber}</span>
                     <span className="finance-hub__account-name">{acc.accountName}</span>
                   </div>
                 </div>
               ))}
             </div>
           </section>
         )}

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
              <button
                className="finance-hub__modal-close"
                onClick={handleCloseModal}
              >
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
                    />
                  </div>
                </div>

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
                  {filteredBanks.map((bank) => (
                    <div
                      key={bank.id}
                      className={`finance-hub__bank-item ${
                        !bank.supportsAutomation ? 'finance-hub__bank-item--disabled' : ''
                      }`}
                      style={{ '--bank-color': bank.color } as React.CSSProperties}
                      onClick={() => handleSelectBank(bank)}
                    >
                      <span className="finance-hub__bank-item-icon">{bank.icon}</span>
                      <div className="finance-hub__bank-item-info">
                        <h4>{bank.nameKo}</h4>
                        <span>{bank.name}</span>
                      </div>
                      {!bank.supportsAutomation && (
                        <span className="finance-hub__bank-badge">모바일 전용</span>
                      )}
                      <span className="finance-hub__bank-arrow">→</span>
                    </div>
                  ))}
                </div>

                <div className="finance-hub__modal-footer">
                  <p className="finance-hub__modal-note">
                    💡 PC 인터넷뱅킹을 지원하는 은행만 자동화가 가능합니다
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