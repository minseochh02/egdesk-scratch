import React, { useState } from 'react';

interface Column {
  name: string;
  type: string;
}

interface DataTableProps {
  columns: Column[];
  rows: any[];
  maxHeight?: string;
  onSort?: (column: string, direction: 'ASC' | 'DESC') => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  maxHeight = '500px',
  onSort,
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  const handleSort = (columnName: string) => {
    let newDirection: 'ASC' | 'DESC' = 'ASC';

    if (sortColumn === columnName) {
      // Toggle direction
      newDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
    }

    setSortColumn(columnName);
    setSortDirection(newDirection);

    if (onSort) {
      onSort(columnName, newDirection);
    }
  };

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  return (
    <div className="data-table-wrapper" style={{ maxHeight }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.name}
                onClick={() => handleSort(column.name)}
                title={`${column.name} (${column.type})`}
              >
                {column.name}
                {sortColumn === column.name && (
                  <span style={{ marginLeft: '4px' }}>
                    {sortDirection === 'ASC' ? '▲' : '▼'}
                  </span>
                )}
                <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                  {column.type}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                No data available
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column.name}`} title={formatCellValue(row[column.name])}>
                    {formatCellValue(row[column.name])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
