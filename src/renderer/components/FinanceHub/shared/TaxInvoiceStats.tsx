// ============================================
// TaxInvoiceStats - Tax Invoice Stats Display Component
// ============================================

import React from 'react';
import { formatCurrency } from '../utils';
import './TaxInvoiceStats.css';

// ============================================
// Types
// ============================================

export interface TaxInvoiceStatsData {
  totalInvoices: number;
  totalSupplyAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
}

interface TaxInvoiceStatsProps {
  stats: TaxInvoiceStatsData;
  compact?: boolean;
  showInvoiceCount?: boolean;
}

// ============================================
// Component
// ============================================

const TaxInvoiceStats: React.FC<TaxInvoiceStatsProps> = ({
  stats,
  compact = false,
  showInvoiceCount = true,
}) => {
  if (compact) {
    return (
      <div className="tax-stats tax-stats--compact">
        <div className="tax-stats__card">
          <span className="tax-stats__label">공급가액</span>
          <span className="tax-stats__value">
            {formatCurrency(stats.totalSupplyAmount)}
          </span>
        </div>
        <div className="tax-stats__card">
          <span className="tax-stats__label">세액</span>
          <span className="tax-stats__value tax-stats__value--tax">
            {formatCurrency(stats.totalTaxAmount)}
          </span>
        </div>
        <div className="tax-stats__card tax-stats__card--total">
          <span className="tax-stats__label">합계금액</span>
          <span className="tax-stats__value tax-stats__value--total">
            {formatCurrency(stats.totalAmount)}
          </span>
        </div>
      </div>
    );
  }

  // Full stats view
  return (
    <div className="tax-stats tax-stats--full">
      {showInvoiceCount && (
        <div className="tax-stats__card">
          <span className="tax-stats__icon">🧾</span>
          <div className="tax-stats__info">
            <span className="tax-stats__label">총 건수</span>
            <span className="tax-stats__value">{stats.totalInvoices.toLocaleString()}건</span>
          </div>
        </div>
      )}
      <div className="tax-stats__card">
        <span className="tax-stats__icon">💰</span>
        <div className="tax-stats__info">
          <span className="tax-stats__label">공급가액</span>
          <span className="tax-stats__value">
            {formatCurrency(stats.totalSupplyAmount)}
          </span>
        </div>
      </div>
      <div className="tax-stats__card">
        <span className="tax-stats__icon">📊</span>
        <div className="tax-stats__info">
          <span className="tax-stats__label">세액</span>
          <span className="tax-stats__value tax-stats__value--tax">
            {formatCurrency(stats.totalTaxAmount)}
          </span>
        </div>
      </div>
      <div className="tax-stats__card tax-stats__card--total">
        <span className="tax-stats__icon">✨</span>
        <div className="tax-stats__info">
          <span className="tax-stats__label">합계금액</span>
          <span className="tax-stats__value tax-stats__value--total">
            {formatCurrency(stats.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaxInvoiceStats;
