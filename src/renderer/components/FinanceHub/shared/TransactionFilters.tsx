// ============================================
// TransactionFilters - Reusable Filters Panel Component
// ============================================

import React from 'react';
import { TransactionFilters as Filters, BankInfo, BankAccount } from '../types';
import { formatAccountNumber, getDateRangeForPeriod, getBankInfo } from '../utils';
import './TransactionFilters.css';

// ============================================
// Types
// ============================================

interface TransactionFiltersProps {
  filters: Filters;
  banks: Record<string, BankInfo>;
  accounts: BankAccount[];
  onFilterChange: (key: keyof Filters, value: string) => void;
  onResetFilters: () => void;
  showQuickDates?: boolean;
}

// ============================================
// Component
// ============================================

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  banks,
  accounts,
  onFilterChange,
  onResetFilters,
  showQuickDates = true,
}) => {
  // Get unique banks from accounts
  const uniqueBanks = React.useMemo(() => {
    const bankIds = [...new Set(accounts.map(a => a.bankId))];
    return bankIds.map(id => getBankInfo(id, banks));
  }, [accounts, banks]);

  // Get filtered accounts based on selected bank
  const filteredAccounts = React.useMemo(() => {
    if (filters.bankId === 'all') return accounts;
    return accounts.filter(a => a.bankId === filters.bankId);
  }, [accounts, filters.bankId]);

  const handleBankChange = (bankId: string) => {
    onFilterChange('bankId', bankId);
    // Reset account filter when bank changes
    if (bankId !== filters.bankId) {
      onFilterChange('accountId', 'all');
    }
  };

  const handleQuickDateClick = (period: '1week' | '1month' | '3months' | '6months' | '1year') => {
    const { startDate, endDate } = getDateRangeForPeriod(period);
    onFilterChange('startDate', startDate);
    onFilterChange('endDate', endDate);
  };

  return (
    <div className="tx-filters">
      <div className="tx-filters__row">
        {/* Search */}
        <div className="tx-filters__group tx-filters__group--search">
          <label className="tx-filters__label">검색</label>
          <input
            type="text"
            className="tx-filters__input"
            placeholder="거래내용, 상대방 검색..."
            value={filters.searchText}
            onChange={(e) => onFilterChange('searchText', e.target.value)}
          />
        </div>

        {/* Bank Filter */}
        <div className="tx-filters__group">
          <label className="tx-filters__label">은행</label>
          <select
            className="tx-filters__select"
            value={filters.bankId}
            onChange={(e) => handleBankChange(e.target.value)}
          >
            <option value="all">전체 은행</option>
            {uniqueBanks.map(bank => (
              <option key={bank.id} value={bank.id}>
                {bank.icon} {bank.nameKo}
              </option>
            ))}
          </select>
        </div>

        {/* Account Filter */}
        <div className="tx-filters__group">
          <label className="tx-filters__label">계좌</label>
          <select
            className="tx-filters__select"
            value={filters.accountId}
            onChange={(e) => onFilterChange('accountId', e.target.value)}
          >
            <option value="all">전체 계좌</option>
            {filteredAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {formatAccountNumber(account.accountNumber)}
              </option>
            ))}
          </select>
        </div>

        {/* Transaction Type */}
        <div className="tx-filters__group">
          <label className="tx-filters__label">거래유형</label>
          <select
            className="tx-filters__select"
            value={filters.type}
            onChange={(e) => onFilterChange('type', e.target.value as Filters['type'])}
          >
            <option value="all">전체</option>
            <option value="deposit">입금</option>
            <option value="withdrawal">출금</option>
          </select>
        </div>
      </div>

      <div className="tx-filters__row">
        {/* Date Range */}
        <div className="tx-filters__group">
          <label className="tx-filters__label">시작일</label>
          <input
            type="date"
            className="tx-filters__input"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="tx-filters__group">
          <label className="tx-filters__label">종료일</label>
          <input
            type="date"
            className="tx-filters__input"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
          />
        </div>

        {/* Amount Range */}
        <div className="tx-filters__group">
          <label className="tx-filters__label">최소 금액</label>
          <input
            type="number"
            className="tx-filters__input"
            placeholder="0"
            value={filters.minAmount}
            onChange={(e) => onFilterChange('minAmount', e.target.value)}
          />
        </div>

        <div className="tx-filters__group">
          <label className="tx-filters__label">최대 금액</label>
          <input
            type="number"
            className="tx-filters__input"
            placeholder="무제한"
            value={filters.maxAmount}
            onChange={(e) => onFilterChange('maxAmount', e.target.value)}
          />
        </div>

        {/* Reset Button */}
        <div className="tx-filters__group tx-filters__group--actions">
          <button
            className="tx-filters__btn tx-filters__btn--reset"
            onClick={onResetFilters}
          >
            🔄 필터 초기화
          </button>
        </div>
      </div>

      {/* Quick Date Filters */}
      {showQuickDates && (
        <div className="tx-filters__quick-dates">
          <span className="tx-filters__quick-label">빠른 선택:</span>
          <button
            className="tx-filters__quick-btn"
            onClick={() => handleQuickDateClick('1week')}
          >
            1주일
          </button>
          <button
            className="tx-filters__quick-btn"
            onClick={() => handleQuickDateClick('1month')}
          >
            1개월
          </button>
          <button
            className="tx-filters__quick-btn"
            onClick={() => handleQuickDateClick('3months')}
          >
            3개월
          </button>
          <button
            className="tx-filters__quick-btn"
            onClick={() => handleQuickDateClick('6months')}
          >
            6개월
          </button>
          <button
            className="tx-filters__quick-btn"
            onClick={() => handleQuickDateClick('1year')}
          >
            1년
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionFilters;
