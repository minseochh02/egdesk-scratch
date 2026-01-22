// ============================================
// DataTable - Generic Reusable Table Component
// ============================================

import React from 'react';
import './DataTable.css';

// ============================================
// Types
// ============================================

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (item: T, index: number) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  className?: string;
  compact?: boolean;
  maxHeight?: string;
  stickyHeader?: boolean;
  rowClassName?: (item: T, index: number) => string;
  getRowKey?: (item: T, index: number) => string;
}

// ============================================
// Component
// ============================================

function DataTable<T>({
  data,
  columns,
  onRowClick,
  onSort,
  sortKey,
  sortDirection = 'desc',
  isLoading = false,
  emptyMessage = '표시할 데이터가 없습니다.',
  emptyIcon = '📋',
  className = '',
  compact = false,
  maxHeight,
  stickyHeader = false,
  rowClassName,
  getRowKey,
}: DataTableProps<T>) {
  const renderSortIcon = (columnKey: string, sortable?: boolean) => {
    if (!onSort || !sortable) return null;
    const isActive = sortKey === columnKey;
    return (
      <span className={`data-table__sort-icon ${isActive ? 'data-table__sort-icon--active' : ''}`}>
        {isActive ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    );
  };

  const handleHeaderClick = (columnKey: string, sortable?: boolean) => {
    if (onSort && sortable) {
      onSort(columnKey);
    }
  };

  const handleRowClick = (item: T, index: number) => {
    if (onRowClick) {
      onRowClick(item, index);
    }
  };

  const getDefaultRowKey = (item: T, index: number): string => {
    if (getRowKey) {
      return getRowKey(item, index);
    }
    // Try to use 'id' property if it exists
    if (item && typeof item === 'object' && 'id' in item) {
      return String(item.id);
    }
    return String(index);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="data-table__loading">
        <span className="data-table__spinner"></span>
        <span>데이터 불러오는 중...</span>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="data-table__empty">
        <div className="data-table__empty-icon">{emptyIcon}</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`data-table ${compact ? 'data-table--compact' : ''} ${className}`}
      style={{ maxHeight }}
    >
      <div className="data-table__container">
        <table className="data-table__table">
          <thead className={`data-table__head ${stickyHeader ? 'data-table__head--sticky' : ''}`}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    data-table__header
                    ${column.sortable && onSort ? 'data-table__header--sortable' : ''}
                    ${column.align ? `data-table__header--${column.align}` : ''}
                    ${column.className || ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => handleHeaderClick(column.key, column.sortable)}
                >
                  {column.header} {renderSortIcon(column.key, column.sortable)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="data-table__body">
            {data.map((item, index) => {
              const computedRowClassName = rowClassName ? rowClassName(item, index) : '';
              return (
                <tr
                  key={getDefaultRowKey(item, index)}
                  className={`
                    data-table__row
                    ${onRowClick ? 'data-table__row--clickable' : ''}
                    ${computedRowClassName}
                  `}
                  onClick={() => handleRowClick(item, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        data-table__cell
                        ${column.align ? `data-table__cell--${column.align}` : ''}
                        ${column.className || ''}
                      `}
                    >
                      {column.render(item, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
