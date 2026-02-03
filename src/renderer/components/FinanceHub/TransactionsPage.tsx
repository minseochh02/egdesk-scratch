// ============================================
// TransactionsPage - Full Transactions View (Refactored)
// Now receives data and callbacks via props from parent
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import './TransactionsPage.css';

// Shared Components
import { TransactionStats, TransactionFilters } from './shared';

// Types & Utils
import {
  Transaction,
  TransactionFilters as Filters,
  TransactionStats as Stats,
  PaginationState,
  SortState,
  BankInfo,
  BankAccount,
  TRANSACTION_CATEGORIES,
} from './types';
import { formatCurrency, formatDate, formatAccountNumber, getBankInfo } from './utils';
import { GOOGLE_OAUTH_SCOPES_STRING } from '../../constants/googleScopes';
import { exportCardTransactions } from '../../utils/cardExportService';

// ============================================
// Props Interface
// ============================================

interface TransactionsPageProps {
  transactions: Transaction[];
  stats: Stats | null;
  filters: Filters;
  pagination: PaginationState;
  sort: SortState;
  isLoading: boolean;
  error: string | null;
  banks: Record<string, BankInfo>;
  accounts: BankAccount[];
  onFilterChange: (filters: Partial<Filters>) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onSort: (field: SortState['field']) => void;
  loadTransactions: () => Promise<void>;
  loadAllTransactions: () => Promise<Transaction[]>;
  transactionType: 'bank' | 'card';
}

// ============================================
// Component
// ============================================

const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  stats,
  filters,
  pagination,
  sort,
  isLoading,
  error,
  banks,
  accounts,
  onFilterChange,
  onResetFilters,
  onPageChange,
  onSort,
  loadTransactions,
  loadAllTransactions,
  transactionType,
}) => {
  // Local UI State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [hasPersistentSpreadsheet, setHasPersistentSpreadsheet] = useState(false);

  // Check persistent spreadsheet status on mount and when transaction type changes
  useEffect(() => {
    const checkPersistentSpreadsheet = async () => {
      try {
        const key = transactionType === 'bank' ? 'bank-spreadsheet' : 'card-spreadsheet';
        const result = await window.electron.financeHub.getPersistentSpreadsheet(key);
        setHasPersistentSpreadsheet(result.success && !!result.persistentSpreadsheet?.spreadsheetId);
      } catch (error) {
        console.error('Error checking persistent spreadsheet:', error);
      }
    };

    checkPersistentSpreadsheet();
  }, [transactionType]);

  // Load transactions when filters, pagination, or sort change
  useEffect(() => {
    loadTransactions();
  }, [filters, pagination.currentPage, pagination.pageSize, sort, loadTransactions]);

  // Transactions are already filtered by type in the hook, no need to filter here
  const filteredTransactions = transactions;

  // Helper function to check if a transaction is a card transaction
  const isCardTransaction = (tx: Transaction) => {
    return tx.bankId.endsWith('-card');
  };

  // Filter accounts based on transaction type
  const typeFilteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const isCardAccount = account.bankId.endsWith('-card');
      return transactionType === 'card' ? isCardAccount : !isCardAccount;
    });
  }, [accounts, transactionType]);

  // Handlers
  const handleFilterChange = (key: keyof Filters, value: string) => {
    onFilterChange({ [key]: value });
  };

  const handleOpenInSpreadsheet = async () => {
    try {
      // Load all transactions
      const allTransactions = await loadAllTransactions();

      // Filter transactions based on type (bank or card)
      const filteredAllTransactions = allTransactions.filter(tx =>
        transactionType === 'card' ? isCardTransaction(tx) : !isCardTransaction(tx)
      );

      if (filteredAllTransactions.length === 0) {
        const typeLabel = transactionType === 'bank' ? '은행' : '카드';
        alert(`내보낼 ${typeLabel} 거래내역이 없습니다.`);
        return;
      }

      // Get persistent spreadsheet info with type-specific key
      const spreadsheetKey = transactionType === 'bank' ? 'bank-spreadsheet' : 'card-spreadsheet';
      const persistentResult = await window.electron.financeHub.getPersistentSpreadsheet(spreadsheetKey);
      const persistentSpreadsheetId = persistentResult.success ? persistentResult.persistentSpreadsheet?.spreadsheetId : null;

      // Use the new get-or-create method with filtered transactions
      const result = await window.electron.sheets.getOrCreateTransactionsSpreadsheet({
        transactions: filteredAllTransactions,
        banks,
        accounts,
        persistentSpreadsheetId,
      });

      if (result.success) {
        // Save persistent spreadsheet info if it was created or updated
        if (result.wasCreated) {
          const typeLabel = transactionType === 'bank' ? '은행' : '카드';
          await window.electron.financeHub.savePersistentSpreadsheet({
            spreadsheetId: result.spreadsheetId,
            spreadsheetUrl: result.spreadsheetUrl,
            title: `EGDesk ${typeLabel} 내역`,
          }, spreadsheetKey);
          setHasPersistentSpreadsheet(true);
        }

        // Open the spreadsheet in a new browser tab
        window.open(result.spreadsheetUrl, '_blank');
      } else {
        // Check if it's an authentication error
        const errorMsg = result.error || '알 수 없는 오류';
        if (errorMsg.toLowerCase().includes('auth') || 
            errorMsg.toLowerCase().includes('token') || 
            errorMsg.toLowerCase().includes('permission') ||
            errorMsg.toLowerCase().includes('sign in with google')) {
          setShowGoogleAuth(true);
          // Don't show alert for auth errors, just show the Google login UI
        } else {
          alert('스프레드시트 생성 실패: ' + errorMsg);
        }
      }
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      
      // Check if it's an authentication error
      if (errorMsg.toLowerCase().includes('auth') || 
          errorMsg.toLowerCase().includes('token') || 
          errorMsg.toLowerCase().includes('permission') ||
          errorMsg.toLowerCase().includes('sign in with google')) {
        setShowGoogleAuth(true);
        // Don't show alert for auth errors, just show the Google login UI
      } else {
        alert('스프레드시트 생성 중 오류가 발생했습니다: ' + errorMsg);
      }
    }
  };

  const handleExportCardTransactions = async () => {
    try {
      // Use current filters to export
      await exportCardTransactions({
        accountId: filters.accountId,
        cardCompanyId: filters.bankId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        includeRefunds: true
      });
    } catch (error) {
      console.error('Card export failed:', error);
      // Error already shown by export service
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    
    try {
      // Use the same Google OAuth flow as MCP servers with proper scopes
      const result = await window.electron.auth.signInWithGoogle(GOOGLE_OAUTH_SCOPES_STRING);
      
      if (result.success && result.session) {
        console.log('Google sign-in successful:', result.session.user.email);
        setShowGoogleAuth(false);
        // Automatically retry the spreadsheet creation
        setTimeout(() => {
          handleOpenInSpreadsheet();
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
      setSigningIn(false);
    }
  };

  // Render Helpers
  const renderSortIcon = (field: SortState['field']) => {
    const isActive = sort.field === field;
    return (
      <span className={`txp-sort-icon ${isActive ? 'txp-sort-icon--active' : ''}`}>
        {isActive ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const renderTransactionRow = (tx: Transaction) => {
    const bank = getBankInfo(tx.bankId, banks);
    const account = accounts.find(a => a.id === tx.accountId);
    const isDeposit = tx.deposit > 0;
    const amount = isDeposit ? tx.deposit : tx.withdrawal;
    
    return (
      <tr key={tx.id} className="txp-table__row" onClick={() => setSelectedTransaction(tx)}>
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
          <span className="txp-account-number">{formatAccountNumber(account?.accountNumber)}</span>
        </td>
        <td className="txp-table__cell txp-table__cell--type">
          <span className="txp-type-text" title={tx.type || '-'}>
            {tx.type || '-'}
          </span>
        </td>
        <td className="txp-table__cell txp-table__cell--description">
          <div className="txp-description">
            <span className="txp-description__text">{tx.description || '-'}</span>
            {tx.counterparty && <span className="txp-description__counterparty">{tx.counterparty}</span>}
          </div>
        </td>
        <td className={`txp-table__cell txp-table__cell--amount ${isDeposit ? 'txp-table__cell--deposit' : 'txp-table__cell--withdrawal'}`}>
          <span className="txp-amount">{isDeposit ? '+' : '-'}{formatCurrency(amount)}</span>
        </td>
        <td className="txp-table__cell txp-table__cell--balance">{formatCurrency(tx.balance)}</td>
      </tr>
    );
  };

  const renderTransactionCard = (tx: Transaction) => {
    const bank = getBankInfo(tx.bankId, banks);
    const account = accounts.find(a => a.id === tx.accountId);
    const isDeposit = tx.deposit > 0;
    const amount = isDeposit ? tx.deposit : tx.withdrawal;
    
    return (
      <div key={tx.id} className="txp-card" onClick={() => setSelectedTransaction(tx)} style={{ '--bank-color': bank.color } as React.CSSProperties}>
        <div className="txp-card__header">
          <div className="txp-card__bank">
            <span className="txp-card__bank-icon">{bank.icon}</span>
            <span className="txp-card__bank-name">{bank.nameKo}</span>
          </div>
          <div className="txp-card__date">{formatDate(tx.date)} {tx.time || ''}</div>
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
          <span className="txp-card__account">{formatAccountNumber(account?.accountNumber)}</span>
          <span className="txp-card__balance">잔액: {formatCurrency(tx.balance)}</span>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className="txp">
      {/* Header */}
      <header className="txp-header">
        <div className="txp-header__content">
          <h1 className="txp-header__title">
            <span className="txp-header__icon">📊</span>
            {transactionType === 'bank' ? '은행 전체 거래내역' : '카드 전체 거래 내역'}
          </h1>
          <p className="txp-header__subtitle">
            {transactionType === 'bank'
              ? '모든 은행 계좌의 거래내역을 한 곳에서 확인하세요'
              : '모든 카드의 사용내역을 한 곳에서 확인하세요'}
          </p>
        </div>
        <div className="txp-header__actions">
          {showGoogleAuth && (
            <div className="txp-google-auth-container">
              <span className="txp-google-auth-message">스프레드시트 접근을 위해 Google 로그인이 필요합니다</span>
              <button 
                className="txp-btn txp-btn--google" 
                onClick={handleGoogleSignIn}
                disabled={signingIn}
              >
                {signingIn ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <>
                    <span className="txp-google-icon">G</span>
                    <span>Google 로그인</span>
                  </>
                )}
              </button>
              <button 
                className="txp-btn txp-btn--outline txp-btn--small" 
                onClick={() => setShowGoogleAuth(false)}
              >
                ✕
              </button>
            </div>
          )}
          <button className="txp-btn txp-btn--outline" onClick={() => setShowFilters(!showFilters)}>
            🔍 {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button className="txp-btn txp-btn--outline" onClick={handleOpenInSpreadsheet}>
            📊 스프레드시트에서 열기 {hasPersistentSpreadsheet && '(기존 시트 업데이트)'}
          </button>
          {transactionType === 'card' && (
            <button className="txp-btn txp-btn--primary" onClick={handleExportCardTransactions}>
              📥 카드 거래내역 엑셀 다운로드
            </button>
          )}
          {hasPersistentSpreadsheet && (
            <button className="txp-btn txp-btn--outline txp-btn--small" onClick={async () => {
              const typeLabel = transactionType === 'bank' ? '은행' : '카드';
              if (confirm(`기존 ${typeLabel} 스프레드시트 연결을 해제하고 다음에 새로운 스프레드시트를 생성하시겠습니까?`)) {
                const spreadsheetKey = transactionType === 'bank' ? 'bank-spreadsheet' : 'card-spreadsheet';
                await window.electron.financeHub.clearPersistentSpreadsheet(spreadsheetKey);
                setHasPersistentSpreadsheet(false);
                alert('스프레드시트 연결이 해제되었습니다. 다음번에 새로운 스프레드시트가 생성됩니다.');
              }
            }} title="기존 스프레드시트 연결 해제">🔄 새 시트</button>
          )}
          <div className="txp-view-toggle">
            <button className={`txp-view-toggle__btn ${viewMode === 'table' ? 'txp-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('table')} title="테이블 보기">📋</button>
            <button className={`txp-view-toggle__btn ${viewMode === 'cards' ? 'txp-view-toggle__btn--active' : ''}`} onClick={() => setViewMode('cards')} title="카드 보기">🃏</button>
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      {stats && <TransactionStats stats={stats} />}

      {/* Filters Panel */}
      {showFilters && (
        <TransactionFilters
          filters={filters}
          banks={banks}
          accounts={typeFilteredAccounts}
          onFilterChange={handleFilterChange}
          onResetFilters={onResetFilters}
          transactionType={transactionType}
        />
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
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="txp-empty">
            <span className="txp-empty__icon">📋</span>
            <h3 className="txp-empty__title">거래내역이 없습니다</h3>
            <p className="txp-empty__text">
              {transactionType === 'bank'
                ? '은행 거래내역이 없습니다.'
                : '카드 사용내역이 없습니다.'}
              <br />필터를 조정하거나 계좌를 동기화해 주세요.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="txp-table-container">
            <table className="txp-table">
              <thead className="txp-table__head">
                <tr>
                  <th className="txp-table__header txp-table__header--sortable" onClick={() => onSort('date')}>날짜 {renderSortIcon('date')}</th>
                  <th className="txp-table__header">{transactionType === 'bank' ? '은행' : '카드사'}</th>
                  <th className="txp-table__header">{transactionType === 'bank' ? '계좌' : '카드'}</th>
                  <th className="txp-table__header">적요</th>
                  <th className="txp-table__header txp-table__header--sortable" onClick={() => onSort('description')}>내용 {renderSortIcon('description')}</th>
                  <th className="txp-table__header txp-table__header--sortable txp-table__header--right" onClick={() => onSort('amount')}>금액 {renderSortIcon('amount')}</th>
                  <th className="txp-table__header txp-table__header--sortable txp-table__header--right" onClick={() => onSort('balance')}>잔액 {renderSortIcon('balance')}</th>
                </tr>
              </thead>
              <tbody className="txp-table__body">{filteredTransactions.map(renderTransactionRow)}</tbody>
            </table>
          </div>
        ) : (
          <div className="txp-cards">{filteredTransactions.map(renderTransactionCard)}</div>
        )}

        {/* Pagination */}
        {filteredTransactions.length > 0 && pagination.totalPages > 1 && (
          <div className="txp-pagination">
            <button className="txp-pagination__btn" onClick={() => onPageChange(1)} disabled={pagination.currentPage === 1}>«</button>
            <button className="txp-pagination__btn" onClick={() => onPageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}>‹</button>
            <span className="txp-pagination__info">{pagination.currentPage} / {pagination.totalPages} 페이지</span>
            <button className="txp-pagination__btn" onClick={() => onPageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}>›</button>
            <button className="txp-pagination__btn" onClick={() => onPageChange(pagination.totalPages)} disabled={pagination.currentPage === pagination.totalPages}>»</button>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="txp-modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="txp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="txp-modal__header">
              <h2 className="txp-modal__title">거래 상세</h2>
              <button className="txp-modal__close" onClick={() => setSelectedTransaction(null)}>✕</button>
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
                      <div className={`txp-detail__type-badge ${isDeposit ? 'txp-detail__type-badge--deposit' : 'txp-detail__type-badge--withdrawal'}`}>
                        {isDeposit ? '입금' : '출금'}
                      </div>
                    </div>
                    
                    <div className="txp-detail__rows">
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">일시</span>
                        <span className="txp-detail__value">{formatDate(tx.date)} {tx.time}</span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">{isCardTransaction(tx) ? '카드사' : '은행'}</span>
                        <span className="txp-detail__value">{bank.icon} {bank.nameKo}</span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">{isCardTransaction(tx) ? '카드' : '계좌'}</span>
                        <span className="txp-detail__value">{formatAccountNumber(account?.accountNumber)}{account?.accountName && ` (${account.accountName})`}</span>
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
                        <span className="txp-detail__value txp-detail__value--highlight">{formatCurrency(tx.balance)}</span>
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
                          <span className="txp-detail__value">{TRANSACTION_CATEGORIES.find(c => c.id === tx.category)?.label || tx.category}</span>
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
