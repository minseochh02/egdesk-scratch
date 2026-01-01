// ============================================
// TransactionsPage - Full Transactions View (Refactored)
// Now receives data and callbacks via props from parent
// ============================================

import React, { useState } from 'react';
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
import { formatCurrency, formatDate, formatAccountNumber, getBankInfo, downloadCSV } from './utils';

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
}) => {
  // Local UI State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Handlers
  const handleFilterChange = (key: keyof Filters, value: string) => {
    onFilterChange({ [key]: value });
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('내보낼 거래내역이 없습니다.');
      return;
    }
    
    const headers = ['날짜', '시간', '은행', '계좌', '적요', '내용', '출금', '입금', '잔액', '지점'];
    const rows = transactions.map(tx => {
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
    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(csv, `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
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
        <td className="txp-table__cell txp-table__cell--type">{tx.type || '-'}</td>
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
            전체 거래내역
          </h1>
          <p className="txp-header__subtitle">모든 은행 계좌의 거래내역을 한 곳에서 확인하세요</p>
        </div>
        <div className="txp-header__actions">
          <button className="txp-btn txp-btn--outline" onClick={() => setShowFilters(!showFilters)}>
            🔍 {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button className="txp-btn txp-btn--outline" onClick={handleExportCSV}>📥 CSV 내보내기</button>
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
          accounts={accounts}
          onFilterChange={handleFilterChange}
          onResetFilters={onResetFilters}
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
        ) : transactions.length === 0 ? (
          <div className="txp-empty">
            <span className="txp-empty__icon">📋</span>
            <h3 className="txp-empty__title">거래내역이 없습니다</h3>
            <p className="txp-empty__text">선택한 조건에 맞는 거래내역이 없습니다.<br />필터를 조정하거나 계좌를 동기화해 주세요.</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="txp-table-container">
            <table className="txp-table">
              <thead className="txp-table__head">
                <tr>
                  <th className="txp-table__header txp-table__header--sortable" onClick={() => onSort('date')}>날짜 {renderSortIcon('date')}</th>
                  <th className="txp-table__header">은행</th>
                  <th className="txp-table__header">계좌</th>
                  <th className="txp-table__header">적요</th>
                  <th className="txp-table__header txp-table__header--sortable" onClick={() => onSort('description')}>내용 {renderSortIcon('description')}</th>
                  <th className="txp-table__header txp-table__header--sortable txp-table__header--right" onClick={() => onSort('amount')}>금액 {renderSortIcon('amount')}</th>
                  <th className="txp-table__header txp-table__header--sortable txp-table__header--right" onClick={() => onSort('balance')}>잔액 {renderSortIcon('balance')}</th>
                </tr>
              </thead>
              <tbody className="txp-table__body">{transactions.map(renderTransactionRow)}</tbody>
            </table>
          </div>
        ) : (
          <div className="txp-cards">{transactions.map(renderTransactionCard)}</div>
        )}

        {/* Pagination */}
        {transactions.length > 0 && pagination.totalPages > 1 && (
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
                      <div className="txp-detail__type-badge">{isDeposit ? '입금' : '출금'}</div>
                    </div>
                    
                    <div className="txp-detail__rows">
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">일시</span>
                        <span className="txp-detail__value">{formatDate(tx.date)} {tx.time}</span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">은행</span>
                        <span className="txp-detail__value">{bank.icon} {bank.nameKo}</span>
                      </div>
                      <div className="txp-detail__row">
                        <span className="txp-detail__label">계좌</span>
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
