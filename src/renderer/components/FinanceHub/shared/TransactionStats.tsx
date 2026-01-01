// ============================================
// TransactionStats - Reusable Stats Display Component
// ============================================

import React from 'react';
import { TransactionStats as Stats } from '../types';
import { formatCurrency } from '../utils';
import './TransactionStats.css';

// ============================================
// Types
// ============================================

interface TransactionStatsProps {
  stats: Stats;
  compact?: boolean;
  showTransactionCount?: boolean;
}

// ============================================
// Component
// ============================================

const TransactionStats: React.FC<TransactionStatsProps> = ({ 
  stats, 
  compact = false,
  showTransactionCount = true,
}) => {
  const netChange = stats.netChange ?? (stats.totalDeposits - stats.totalWithdrawals);
  const isPositive = netChange >= 0;

  if (compact) {
    return (
      <div className="tx-stats tx-stats--compact">
        <div className="tx-stats__card tx-stats__card--deposit">
          <span className="tx-stats__label">총 입금</span>
          <span className="tx-stats__value tx-stats__value--positive">
            {formatCurrency(stats.totalDeposits)}
          </span>
          <span className="tx-stats__count">{stats.depositCount}건</span>
        </div>
        <div className="tx-stats__card tx-stats__card--withdrawal">
          <span className="tx-stats__label">총 출금</span>
          <span className="tx-stats__value">
            {formatCurrency(stats.totalWithdrawals)}
          </span>
          <span className="tx-stats__count">{stats.withdrawalCount}건</span>
        </div>
        <div className={`tx-stats__card ${isPositive ? 'tx-stats__card--positive' : 'tx-stats__card--negative'}`}>
          <span className="tx-stats__label">순 변동</span>
          <span className={`tx-stats__value ${isPositive ? 'tx-stats__value--positive' : 'tx-stats__value--negative'}`}>
            {isPositive ? '+' : ''}{formatCurrency(netChange)}
          </span>
        </div>
      </div>
    );
  }

  // Full stats view
  return (
    <div className="tx-stats tx-stats--full">
      {showTransactionCount && (
        <div className="tx-stats__card">
          <span className="tx-stats__label">총 거래</span>
          <span className="tx-stats__value">{stats.totalTransactions.toLocaleString()}건</span>
        </div>
      )}
      <div className="tx-stats__card tx-stats__card--deposit">
        <span className="tx-stats__label">총 입금</span>
        <span className="tx-stats__value tx-stats__value--positive">
          {formatCurrency(stats.totalDeposits)}
        </span>
        <span className="tx-stats__count">{stats.depositCount}건</span>
      </div>
      <div className="tx-stats__card tx-stats__card--withdrawal">
        <span className="tx-stats__label">총 출금</span>
        <span className="tx-stats__value">
          {formatCurrency(stats.totalWithdrawals)}
        </span>
        <span className="tx-stats__count">{stats.withdrawalCount}건</span>
      </div>
      <div className={`tx-stats__card ${isPositive ? 'tx-stats__card--positive' : 'tx-stats__card--negative'}`}>
        <span className="tx-stats__label">순 변동</span>
        <span className={`tx-stats__value ${isPositive ? 'tx-stats__value--positive' : 'tx-stats__value--negative'}`}>
          {isPositive ? '+' : ''}{formatCurrency(netChange)}
        </span>
      </div>
    </div>
  );
};

export default TransactionStats;
