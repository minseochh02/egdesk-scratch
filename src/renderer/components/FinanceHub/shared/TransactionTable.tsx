// ============================================
// TransactionTable - Reusable Transaction Table Component
// Refactored to use generic DataTable
// ============================================

import React from 'react';
import { Transaction, BankInfo, BankAccount, SortState } from '../types';
import { formatAccountNumber, formatCurrency, formatDate, getBankInfo } from '../utils';
import DataTable, { DataTableColumn } from './DataTable';
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

  // Define columns based on compact mode
  const columns: DataTableColumn<Transaction>[] = [
    {
      key: 'date',
      header: '날짜',
      sortable: true,
      width: '110px',
      render: (tx) => (
        <div className="tx-table__date">
          <span className="tx-table__date-day">{formatDate(tx.date)}</span>
          {compact && tx.time && (
            <span className="tx-table__date-time">{tx.time}</span>
          )}
        </div>
      ),
    },
  ];

  // Add time column if not compact
  if (!compact) {
    columns.push({
      key: 'time',
      header: '시간',
      sortable: false,
      width: '80px',
      className: 'tx-table__cell--time',
      render: (tx) => tx.time || '-',
    });
  }

  // Add bank column if not compact
  if (!compact) {
    columns.push({
      key: 'bank',
      header: '은행',
      sortable: false,
      width: '140px',
      className: 'tx-table__cell--bank',
      render: (tx) => {
        const bank = getBankInfo(tx.bankId, banks);
        return (
          <div
            className="tx-table__bank-badge"
            style={{ '--bank-color': bank.color } as React.CSSProperties}
          >
            <span className="tx-table__bank-icon">{bank.icon}</span>
            <span className="tx-table__bank-name">{bank.nameKo}</span>
          </div>
        );
      },
    });
  }

  // Add remaining columns
  columns.push(
    {
      key: 'type',
      header: '적요',
      sortable: false,
      width: '100px',
      className: 'tx-table__cell--type',
      render: (tx) => (
        <span className="tx-table__type-text" title={tx.type || '-'}>
          {tx.type || '-'}
        </span>
      ),
    },
    {
      key: 'description',
      header: '내용',
      sortable: true,
      render: (tx) => (
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
      ),
    },
    {
      key: 'withdrawal',
      header: '출금',
      sortable: false,
      align: 'right',
      width: '120px',
      className: 'tx-table__cell--withdrawal',
      render: (tx) => tx.withdrawal > 0 ? formatCurrency(tx.withdrawal) : '-',
    },
    {
      key: 'deposit',
      header: '입금',
      sortable: false,
      align: 'right',
      width: '120px',
      className: 'tx-table__cell--deposit',
      render: (tx) => tx.deposit > 0 ? formatCurrency(tx.deposit) : '-',
    },
    {
      key: 'balance',
      header: '잔액',
      sortable: true,
      align: 'right',
      width: '140px',
      className: 'tx-table__cell--balance',
      render: (tx) => formatCurrency(tx.balance),
    }
  );

  return (
    <>
      <DataTable
        data={displayTransactions}
        columns={columns}
        onRowClick={onRowClick}
        onSort={onSort}
        sortKey={sortField}
        sortDirection={sortDirection}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon="📋"
        className={`tx-table ${compact ? 'tx-table--compact' : ''}`}
        compact={compact}
        stickyHeader={false}
        getRowKey={(tx) => tx.id}
      />

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
    </>
  );
};

export default TransactionTable;
