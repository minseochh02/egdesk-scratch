// ============================================
// TaxInvoiceFilters - Tax Invoice Filters Component
// ============================================

import React from 'react';
import { getDateRangeForPeriod } from '../utils';
import './TaxInvoiceFilters.css';

// ============================================
// Types
// ============================================

export interface TaxInvoiceFilters {
  businessNumber: string;
  searchText: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  classification: string;
  companyName: string; // 공급받는자 or 공급자 depending on invoice type
}

interface ConnectedBusiness {
  businessNumber: string;
  businessName: string;
}

interface TaxInvoice {
  공급자상호?: string;
  공급받는자상호?: string;
}

interface TaxInvoiceFiltersProps {
  filters: TaxInvoiceFilters;
  businesses: ConnectedBusiness[];
  invoices: TaxInvoice[];
  invoiceType: 'sales' | 'purchase' | 'tax-exempt-sales' | 'tax-exempt-purchase' | 'cash-receipt';
  onFilterChange: (key: keyof TaxInvoiceFilters, value: string) => void;
  onResetFilters: () => void;
  showQuickDates?: boolean;
}

// ============================================
// Component
// ============================================

const TaxInvoiceFiltersComponent: React.FC<TaxInvoiceFiltersProps> = ({
  filters,
  businesses,
  invoices,
  invoiceType,
  onFilterChange,
  onResetFilters,
  showQuickDates = true,
}) => {
  const handleQuickDateClick = (period: '1week' | '1month' | '3months' | '6months' | '1year') => {
    const { startDate, endDate } = getDateRangeForPeriod(period);
    onFilterChange('startDate', startDate);
    onFilterChange('endDate', endDate);
  };

  // Get unique company names based on invoice type
  const uniqueCompanyNames = React.useMemo(() => {
    const isSalesLike = invoiceType === 'sales' || invoiceType === 'tax-exempt-sales';
    const field = isSalesLike ? '공급받는자상호' : '공급자상호';
    const names = new Set<string>();

    invoices.forEach(invoice => {
      const name = invoice[field];
      if (name && name.trim()) {
        names.add(name.trim());
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [invoices, invoiceType]);

  const companyFilterLabel =
    invoiceType === 'sales' || invoiceType === 'tax-exempt-sales' ? '공급받는자' : '공급자';

  return (
    <div className="tax-filters">
      <div className="tax-filters__row">
        {/* Search */}
        <div className="tax-filters__group tax-filters__group--search">
          <label className="tax-filters__label">검색</label>
          <input
            type="text"
            className="tax-filters__input"
            placeholder="상호명, 품목명, 승인번호 검색..."
            value={filters.searchText}
            onChange={(e) => onFilterChange('searchText', e.target.value)}
          />
        </div>

        {/* Business Filter */}
        {businesses.length > 1 && (
          <div className="tax-filters__group">
            <label className="tax-filters__label">사업자</label>
            <select
              className="tax-filters__select"
              value={filters.businessNumber}
              onChange={(e) => onFilterChange('businessNumber', e.target.value)}
            >
              <option value="all">전체 사업자</option>
              {businesses.map(business => (
                <option key={business.businessNumber} value={business.businessNumber}>
                  {business.businessName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Company Name Filter (공급받는자/공급자) */}
        {uniqueCompanyNames.length > 0 && (
          <div className="tax-filters__group">
            <label className="tax-filters__label">{companyFilterLabel}</label>
            <select
              className="tax-filters__select"
              value={filters.companyName}
              onChange={(e) => onFilterChange('companyName', e.target.value)}
            >
              <option value="all">전체</option>
              {uniqueCompanyNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Classification Filter */}
        <div className="tax-filters__group">
          <label className="tax-filters__label">분류</label>
          <select
            className="tax-filters__select"
            value={filters.classification}
            onChange={(e) => onFilterChange('classification', e.target.value)}
          >
            <option value="all">전체</option>
            <option value="정발행">정발행</option>
            <option value="역발행">역발행</option>
            <option value="위수탁발행">위수탁발행</option>
            <option value="수정발행">수정발행</option>
          </select>
        </div>
      </div>

      <div className="tax-filters__row">
        {/* Date Range */}
        <div className="tax-filters__group">
          <label className="tax-filters__label">시작일</label>
          <input
            type="date"
            className="tax-filters__input"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="tax-filters__group">
          <label className="tax-filters__label">종료일</label>
          <input
            type="date"
            className="tax-filters__input"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
          />
        </div>

        {/* Amount Range */}
        <div className="tax-filters__group">
          <label className="tax-filters__label">최소 금액</label>
          <input
            type="number"
            className="tax-filters__input"
            placeholder="0"
            value={filters.minAmount}
            onChange={(e) => onFilterChange('minAmount', e.target.value)}
          />
        </div>

        <div className="tax-filters__group">
          <label className="tax-filters__label">최대 금액</label>
          <input
            type="number"
            className="tax-filters__input"
            placeholder="무제한"
            value={filters.maxAmount}
            onChange={(e) => onFilterChange('maxAmount', e.target.value)}
          />
        </div>

        {/* Reset Button */}
        <div className="tax-filters__group tax-filters__group--actions">
          <button
            className="tax-filters__btn tax-filters__btn--reset"
            onClick={onResetFilters}
          >
            🔄 필터 초기화
          </button>
        </div>
      </div>

      {/* Quick Date Filters */}
      {showQuickDates && (
        <div className="tax-filters__quick-dates">
          <span className="tax-filters__quick-label">빠른 선택:</span>
          <button
            className="tax-filters__quick-btn"
            onClick={() => handleQuickDateClick('1month')}
          >
            1개월
          </button>
          <button
            className="tax-filters__quick-btn"
            onClick={() => handleQuickDateClick('3months')}
          >
            3개월
          </button>
          <button
            className="tax-filters__quick-btn"
            onClick={() => handleQuickDateClick('6months')}
          >
            6개월
          </button>
          <button
            className="tax-filters__quick-btn"
            onClick={() => handleQuickDateClick('1year')}
          >
            1년
          </button>
        </div>
      )}
    </div>
  );
};

export default TaxInvoiceFiltersComponent;
