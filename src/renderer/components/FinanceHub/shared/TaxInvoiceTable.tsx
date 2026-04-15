// ============================================
// TaxInvoiceTable - Tax Invoice Table Component
// ============================================

import React from 'react';
import DataTable, { DataTableColumn } from './DataTable';
import { formatCurrency } from '../utils';
import './TaxInvoiceTable.css';

// ============================================
// Types
// ============================================

export interface TaxInvoice {
  id: string | number;
  작성일자: string;
  승인번호: string;
  공급자상호: string;
  공급받는자상호: string;
  공급가액: number;
  세액: number;
  합계금액: number;
  품목명: string;
  전자세금계산서분류: string;
  전자세금계산서종류?: string;
  발급유형?: string;
  비고?: string;
}

interface TaxInvoiceTableProps {
  invoices: TaxInvoice[];
  invoiceType: 'sales' | 'purchase' | 'tax-exempt-sales' | 'tax-exempt-purchase' | 'cash-receipt';
  onRowClick?: (invoice: TaxInvoice) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

// ============================================
// Component
// ============================================

const TaxInvoiceTable: React.FC<TaxInvoiceTableProps> = ({
  invoices,
  invoiceType,
  onRowClick,
  onSort,
  sortKey,
  sortDirection,
  isLoading = false,
  emptyMessage,
  className = '',
}) => {
  const defaultEmptyMessage = `수집된 ${
    invoiceType === 'sales' ? '매출 세금계산서' :
    invoiceType === 'purchase' ? '매입 세금계산서' :
    invoiceType === 'tax-exempt-sales' ? '매출 면세계산서' :
    invoiceType === 'tax-exempt-purchase' ? '매입 면세계산서' :
    '현금영수증'
  }${invoiceType === 'cash-receipt' ? '이' : '가'} 없습니다`;

  const columns: DataTableColumn<TaxInvoice>[] = [
    {
      key: '작성일자',
      header: invoiceType === 'cash-receipt' ? '매출일시' : '작성일자',
      sortable: true,
      width: '110px',
      render: (invoice) => (
        <span className="tax-invoice-table__date">{invoice.작성일자}</span>
      ),
    },
    {
      key: '승인번호',
      header: '승인번호',
      sortable: false,
      width: '140px',
      render: (invoice) => (
        <span className="tax-invoice-table__approval-number">{invoice.승인번호}</span>
      ),
    },
    {
      key:
        invoiceType === 'sales' || invoiceType === 'tax-exempt-sales'
          ? '공급받는자상호'
          : invoiceType === 'purchase' || invoiceType === 'tax-exempt-purchase'
            ? '공급자상호'
            : '공급받는자상호',
      header:
        invoiceType === 'sales' || invoiceType === 'tax-exempt-sales'
          ? '공급받는자'
          : invoiceType === 'purchase' || invoiceType === 'tax-exempt-purchase'
            ? '공급자'
            : '용도',
      sortable: true,
      render: (invoice) => (
        <span className="tax-invoice-table__company">
          {invoiceType === 'sales' || invoiceType === 'tax-exempt-sales'
            ? invoice.공급받는자상호
            : invoiceType === 'purchase' || invoiceType === 'tax-exempt-purchase'
              ? invoice.공급자상호
              : invoice.공급받는자상호}
        </span>
      ),
    },
    {
      key: '공급가액',
      header: '공급가액',
      sortable: true,
      align: 'right',
      width: '130px',
      render: (invoice) => (
        <span className="tax-invoice-table__amount">{formatCurrency(invoice.공급가액)}</span>
      ),
    },
    {
      key: '세액',
      header: '세액',
      sortable: true,
      align: 'right',
      width: '110px',
      render: (invoice) => (
        <span className="tax-invoice-table__amount tax-invoice-table__amount--tax">
          {formatCurrency(invoice.세액)}
        </span>
      ),
    },
    {
      key: '합계금액',
      header: '합계금액',
      sortable: true,
      align: 'right',
      width: '140px',
      render: (invoice) => (
        <span className="tax-invoice-table__amount tax-invoice-table__amount--total">
          {formatCurrency(invoice.합계금액)}
        </span>
      ),
    },
    {
      key: '품목명',
      header: '품목명',
      sortable: false,
      render: (invoice) => (
        <span className="tax-invoice-table__item" title={invoice.품목명}>
          {invoice.품목명}
        </span>
      ),
    },
    {
      key: '전자세금계산서분류',
      header: '분류',
      sortable: false,
      width: '100px',
      render: (invoice) => (
        <span className="tax-invoice-table__category" title={invoice.전자세금계산서분류}>
          {invoice.전자세금계산서분류}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={invoices}
      columns={columns}
      onRowClick={onRowClick}
      onSort={onSort}
      sortKey={sortKey}
      sortDirection={sortDirection}
      isLoading={isLoading}
      emptyMessage={emptyMessage || defaultEmptyMessage}
      emptyIcon="🧾"
      className={`tax-invoice-table ${className}`}
      stickyHeader={true}
      getRowKey={(invoice) => String(invoice.id)}
    />
  );
};

export default TaxInvoiceTable;
