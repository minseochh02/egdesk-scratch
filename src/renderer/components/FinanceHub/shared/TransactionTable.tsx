// ============================================
// TransactionTable - Reusable Transaction Table Component
// ============================================

import React from 'react';
import { Transaction, BankInfo, BankAccount, SortState } from '../types';
import { formatAccountNumber, formatCurrency, formatDate, getBankInfo } from '../utils';
import './TransactionTable.css';

// ============================================
// Types
// ============================================

interface TransactionTableProps {
  transactions: Transaction[];
  banks: Record<string, BankInfo>;
  accounts: BankAccount[];
  onRowClick?: (tx: Transaction) => void;
  onSort?: (field: SortState['field']) => void;
  sortField?: SortState['field'];
  sortDirection?: SortState['direction'];
  compact?: boolean;
  maxRows?: number;
  showMoreLink?: boolean;
  onShowMore?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

// ============================================
// Component
// ============================================

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  banks,
  accounts,
  onRowClick,
  onSort,
  sortField,
  sortDirection,
  compact = false,
  maxRows,
  showMoreLink = false,
  onShowMore,
  isLoading = false,
  emptyMessage = '표시할 거래내역이 없습니다.',
}) => {
  const displayTransactions = maxRows ? transactions.slice(0, maxRows) : transactions;
  const hasMore = maxRows && transactions.length > maxRows;
  
  const getAccountInfo = (accountId: string): BankAccount | undefined => {
    return accounts.find(a => a.id === accountId);
  };
  
  const renderSortIcon = (field: SortState['field']) => {
    if (!onSort) return null;
    const isActive = sortField === field;
    return (
      <span className={`tx-table__sort-icon ${isActive ? 'tx-table__sort-icon--active' : ''}`}>
        {isActive ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };
  
  const handleHeaderClick = (field: SortState['field']) => {
    if (onSort) onSort(field);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="tx-table__loading">
        <span className="tx-table__spinner"></span>
        <span>거래내역 불러오는 중...</span>
      </div>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="tx-table__empty">
        <div className="tx-table__empty-icon">📋</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`tx-table ${compact ? 'tx-table--compact' : ''}`}>
      <div className="tx-table__container">
        <table className="tx-table__table">
          <thead className="tx-table__head">
            <tr>
              <th 
                className={`tx-table__header ${onSort ? 'tx-table__header--sortable' : ''}`}
                onClick={() => handleHeaderClick('date')}
              >
                날짜 {renderSortIcon('date')}
              </th>
              {!compact && <th className="tx-table__header">시간</th>}
              {!compact && <th className="tx-table__header">은행</th>}
              <th className="tx-table__header">적요</th>
              <th 
                className={`tx-table__header ${onSort ? 'tx-table__header--sortable' : ''}`}
                onClick={() => handleHeaderClick('description')}
              >
                내용 {renderSortIcon('description')}
              </th>
              <th className="tx-table__header tx-table__header--right tx-table__header--withdrawal">출금</th>
              <th className="tx-table__header tx-table__header--right tx-table__header--deposit">입금</th>
              <th 
                className={`tx-table__header tx-table__header--right ${onSort ? 'tx-table__header--sortable' : ''}`}
                onClick={() => handleHeaderClick('balance')}
              >
                잔액 {renderSortIcon('balance')}
              </th>
            </tr>
          </thead>
          <tbody className="tx-table__body">
            {displayTransactions.map((tx) => {
              const bank = getBankInfo(tx.bankId, banks);
              const account = getAccountInfo(tx.accountId);
              const isDeposit = tx.deposit > 0;
              
              return (
                <tr 
                  key={tx.id}
                  className={`tx-table__row ${onRowClick ? 'tx-table__row--clickable' : ''}`}
                  onClick={() => onRowClick?.(tx)}
                >
                  <td className="tx-table__cell tx-table__cell--date">
                    <div className="tx-table__date">
                      <span className="tx-table__date-day">{formatDate(tx.date)}</span>
                      {compact && tx.time && (
                        <span className="tx-table__date-time">{tx.time}</span>
                      )}
                    </div>
                  </td>
                  {!compact && (
                    <td className="tx-table__cell tx-table__cell--time">
                      {tx.time || '-'}
                    </td>
                  )}
                  {!compact && (
                    <td className="tx-table__cell tx-table__cell--bank">
                      <div 
                        className="tx-table__bank-badge"
                        style={{ '--bank-color': bank.color } as React.CSSProperties}
                      >
                        <span className="tx-table__bank-icon">{bank.icon}</span>
                        <span className="tx-table__bank-name">{bank.nameKo}</span>
                      </div>
                    </td>
                  )}
                  <td className="tx-table__cell tx-table__cell--type">
                    <span className="tx-table__type-text" title={tx.type || '-'}>
                      {tx.type || '-'}
                    </span>
                  </td>
                  <td className="tx-table__cell tx-table__cell--description">
                    <div className="tx-table__description">
                      <span className="tx-table__description-text">
                        {tx.description || '-'}
                      </span>
                      {tx.counterparty && (
                        <span className="tx-table__description-counterparty">
                          {tx.counterparty}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="tx-table__cell tx-table__cell--amount tx-table__cell--withdrawal">
                    {tx.withdrawal > 0 ? formatCurrency(tx.withdrawal) : '-'}
                  </td>
                  <td className="tx-table__cell tx-table__cell--amount tx-table__cell--deposit">
                    {tx.deposit > 0 ? formatCurrency(tx.deposit) : '-'}
                  </td>
                  <td className="tx-table__cell tx-table__cell--balance">
                    {formatCurrency(tx.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Show more link */}
      {(hasMore || showMoreLink) && (
        <div 
          className="tx-table__more"
          onClick={onShowMore}
        >
          {hasMore 
            ? `+${transactions.length - (maxRows || 0)}건 더 보기 →`
            : '전체 거래내역 보기 →'
          }
        </div>
      )}
    </div>
  );
};

export default TransactionTable;
