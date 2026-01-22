// ============================================
// TaxInvoicesPage - Full Tax Invoices View
// ============================================

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faClock } from '@fortawesome/free-solid-svg-icons';
import './TaxInvoicesPage.css';

// Shared Components
import { TaxInvoiceTable, TaxInvoiceFilters, TaxInvoiceStats } from './shared';
import type { TaxInvoice, TaxInvoiceFiltersType, TaxInvoiceStatsData } from './shared';

// ============================================
// Props Interface
// ============================================

interface ConnectedBusiness {
  businessNumber: string;
  businessName: string;
  salesCount: number;
  purchaseCount: number;
}

interface TaxInvoicesPageProps {
  invoices: TaxInvoice[]; // Filtered and sorted invoices for display
  allInvoices: TaxInvoice[]; // All invoices for building filter options
  invoiceType: 'sales' | 'purchase';
  stats: TaxInvoiceStatsData;
  filters: TaxInvoiceFiltersType;
  isLoading: boolean;
  businesses: ConnectedBusiness[];
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  onInvoiceTypeChange: (type: 'sales' | 'purchase') => void;
  onFilterChange: (key: keyof TaxInvoiceFiltersType, value: string) => void;
  onResetFilters: () => void;
  onSort: (key: string) => void;
  onCollectAll?: () => void;
  onExport?: () => void;
}

// ============================================
// Component
// ============================================

const TaxInvoicesPage: React.FC<TaxInvoicesPageProps> = ({
  invoices,
  allInvoices,
  invoiceType,
  stats,
  filters,
  isLoading,
  businesses,
  sortKey,
  sortDirection,
  onInvoiceTypeChange,
  onFilterChange,
  onResetFilters,
  onSort,
  onCollectAll,
  onExport,
}) => {
  // Local UI State
  const [showFilters, setShowFilters] = useState(false);

  // Calculate total counts
  const totalSalesCount = businesses.reduce((sum, b) => sum + (b.salesCount || 0), 0);
  const totalPurchaseCount = businesses.reduce((sum, b) => sum + (b.purchaseCount || 0), 0);

  return (
    <div className="tip">
      {/* Header */}
      <header className="tip-header">
        <div className="tip-header__content">
          <h1 className="tip-header__title">
            <span className="tip-header__icon">📋</span>
            전자세금계산서
          </h1>
          <p className="tip-header__subtitle">
            전자세금계산서 목록을 확인하고 관리하세요
          </p>
        </div>
        <div className="tip-header__actions">
          <button
            className="tip-btn tip-btn--outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            🔍 {showFilters ? '필터 숨기기' : '필터 보기'}
          </button>
          <button
            className="tip-btn tip-btn--outline"
            onClick={onExport}
            disabled={!onExport}
          >
            📊 엑셀로 내보내기
          </button>
          <button
            className="tip-btn tip-btn--outline"
            onClick={onCollectAll}
            disabled={!onCollectAll}
          >
            <FontAwesomeIcon icon={faSync} /> 전체 수집
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      {invoices.length > 0 && <TaxInvoiceStats stats={stats} />}

      {/* Filters Panel */}
      {showFilters && (
        <TaxInvoiceFilters
          filters={filters}
          businesses={businesses}
          invoices={allInvoices}
          invoiceType={invoiceType}
          onFilterChange={onFilterChange}
          onResetFilters={onResetFilters}
        />
      )}

      {/* Invoice Type Tabs */}
      <div className="tip-invoice-type-tabs">
        <button
          className={`tip-invoice-type-tab ${invoiceType === 'sales' ? 'tip-invoice-type-tab--active' : ''}`}
          onClick={() => onInvoiceTypeChange('sales')}
        >
          <span className="tip-invoice-type-tab__icon">📤</span>
          <span className="tip-invoice-type-tab__label">매출</span>
          <span className="tip-invoice-type-tab__count">{totalSalesCount}건</span>
        </button>
        <button
          className={`tip-invoice-type-tab ${invoiceType === 'purchase' ? 'tip-invoice-type-tab--active' : ''}`}
          onClick={() => onInvoiceTypeChange('purchase')}
        >
          <span className="tip-invoice-type-tab__icon">📥</span>
          <span className="tip-invoice-type-tab__label">매입</span>
          <span className="tip-invoice-type-tab__count">{totalPurchaseCount}건</span>
        </button>
      </div>

      {/* Tax Invoice Table */}
      {invoices.length === 0 && !isLoading ? (
        <div className="tip-empty">
          <div className="tip-empty__icon">🧾</div>
          <h3>수집된 {invoiceType === 'sales' ? '매출' : '매입'} 세금계산서가 없습니다</h3>
          <p>세금 관리 탭에서 사업자를 연결하고 수집하면 전자세금계산서 목록이 표시됩니다</p>
        </div>
      ) : (
        <TaxInvoiceTable
          invoices={invoices}
          invoiceType={invoiceType}
          onSort={onSort}
          sortKey={sortKey}
          sortDirection={sortDirection}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default TaxInvoicesPage;
