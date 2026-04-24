import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faSearch, faFilter, faTrash, faFileInvoice } from '@fortawesome/free-solid-svg-icons';
import { DataTable } from './shared';
import { formatCurrency, formatDate } from './utils';
import './TaxBillsPage.css';

interface TaxBillsPageProps {
  documents: any[];
  isLoading: boolean;
  filters: {
    businessNumber: string;
    status: string;
    item_id: string;
    period_year: string;
  };
  businesses: any[];
  onFilterChange: (key: string, value: string) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
}

const TaxBillsPage: React.FC<TaxBillsPageProps> = ({
  documents,
  isLoading,
  filters,
  businesses,
  onFilterChange,
  onResetFilters,
  onRefresh
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const columns = [
    {
      key: 'due_date',
      header: '납부기한',
      render: (doc: any) => formatDate(doc.due_date),
      sortable: true,
      width: '120px'
    },
    {
      key: 'company_name',
      header: '사업자명',
      render: (doc: any) => (
        <div className="tax-bills__company">
          <span className="tax-bills__company-name">{doc.company_name}</span>
          <span className="tax-bills__biz-no">{doc.biz_reg_no}</span>
        </div>
      ),
      sortable: true
    },
    {
      key: 'item_name',
      header: '세목',
      render: (doc: any) => doc.item_name,
      sortable: true
    },
    {
      key: 'tax_period',
      header: '과세기간',
      render: (doc: any) => doc.tax_period,
      width: '100px'
    },
    {
      key: 'total_amount',
      header: '총 납부금액',
      render: (doc: any) => (
        <span className="tax-bills__amount">{formatCurrency(doc.total_amount)}</span>
      ),
      align: 'right' as const,
      sortable: true,
      width: '150px'
    },
    {
      key: 'status',
      header: '상태',
      render: (doc: any) => (
        <span className={`tax-bills__status tax-bills__status--${doc.status.toLowerCase()}`}>
          {doc.status === 'PAID' ? '완납' : 
           doc.status === 'OVERDUE' ? '체납' : 
           doc.status === 'CANCELLED' ? '결정취소' : '미납'}
        </span>
      ),
      width: '100px',
      align: 'center' as const
    },
    {
      key: 'actions',
      header: '조회',
      render: (doc: any) => (
        <button 
          className="tax-bills__view-btn"
          onClick={() => {
            if (doc.bill_html_path) {
              window.electron.shell.openPath(doc.bill_html_path);
            } else {
              alert('고지서 파일 경로가 없습니다.');
            }
          }}
          title="고지서 원본 보기"
        >
          <FontAwesomeIcon icon={faFileInvoice} />
        </button>
      ),
      width: '60px',
      align: 'center' as const
    }
  ];

  return (
    <div className="tax-bills">
      <header className="tax-bills__header">
        <div className="tax-bills__header-content">
          <h1 className="tax-bills__title">
            <span className="tax-bills__icon">📑</span>
            고지서 관리
          </h1>
          <p className="tax-bills__subtitle">
            Hometax에서 수집된 세금 고지서 내역을 확인하세요
          </p>
        </div>
        <div className="tax-bills__actions">
          <button 
            className={`tax-bills__btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FontAwesomeIcon icon={faFilter} /> 필터
          </button>
          <button className="tax-bills__btn tax-bills__btn--primary" onClick={onRefresh}>
            <FontAwesomeIcon icon={faSync} spin={isLoading} /> 새로고침
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="tax-bills__filters">
          <div className="tax-bills__filter-group">
            <label>사업자</label>
            <select 
              value={filters.businessNumber} 
              onChange={(e) => onFilterChange('businessNumber', e.target.value)}
            >
              <option value="all">전체</option>
              {businesses.map(b => (
                <option key={b.businessNumber} value={b.entity_id || b.businessNumber}>
                  {b.businessName}
                </option>
              ))}
            </select>
          </div>
          <div className="tax-bills__filter-group">
            <label>상태</label>
            <select 
              value={filters.status} 
              onChange={(e) => onFilterChange('status', e.target.value)}
            >
              <option value="all">전체</option>
              <option value="PENDING">미납</option>
              <option value="PAID">완납</option>
              <option value="OVERDUE">체납</option>
              <option value="CANCELLED">결정취소</option>
            </select>
          </div>
          <button className="tax-bills__filter-reset" onClick={onResetFilters}>
            초기화
          </button>
        </div>
      )}

      <div className="tax-bills__content">
        <DataTable
          data={documents}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="조회된 고지서가 없습니다."
          emptyIcon="📑"
        />
      </div>
    </div>
  );
};

export default TaxBillsPage;
