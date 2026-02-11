import React, { useState, useEffect } from 'react';
import { UserTable, useUserData, QueryOptions } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';

interface TableViewerProps {
  table: UserTable;
  onBack: () => void;
}

export const TableViewer: React.FC<TableViewerProps> = ({ table, onBack }) => {
  const { queryTable, searchTable } = useUserData();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;

      if (searchQuery.trim()) {
        // Search mode
        result = await searchTable(table.id, searchQuery, limit);
        setPage(0); // Reset to first page in search mode
      } else {
        // Query mode with pagination and sorting
        const options: QueryOptions = {
          limit,
          offset: page * limit,
        };

        if (sortColumn) {
          options.orderBy = sortColumn;
          options.orderDirection = sortDirection;
        }

        result = await queryTable(table.id, options);
      }

      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table.id, page, searchQuery, sortColumn, sortDirection]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchData();
  };

  const handleSort = (column: string, direction: 'ASC' | 'DESC') => {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(0); // Reset to first page when sorting
  };

  const totalPages = Math.ceil(total / limit);
  const canGoPrevious = page > 0;
  const canGoNext = page < totalPages - 1;

  return (
    <div className="table-viewer">
      <div className="table-viewer-header">
        <div className="table-viewer-title">
          <button className="btn-icon" onClick={onBack} title="Back to tables">
            ⬅️
          </button>
          <div>
            <h2>{table.displayName}</h2>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {table.tableName} • {total.toLocaleString()} rows • {table.columnCount ?? 0} columns
            </div>
          </div>
        </div>

        {table.description && (
          <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
            {table.description}
          </div>
        )}

        <div className="table-viewer-controls">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <input
              type="text"
              className="table-viewer-search"
              placeholder="Search across all columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              🔍 Search
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                ✕ Clear
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="table-viewer-body">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <DataTable
            columns={table.schema.map((col) => ({
              name: col.name,
              type: col.type,
            }))}
            rows={rows}
            maxHeight="calc(100vh - 300px)"
            onSort={handleSort}
          />
        )}
      </div>

      <div className="table-viewer-footer">
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total.toLocaleString()} rows
        </div>

        <div className="table-viewer-pagination">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(0)}
            disabled={!canGoPrevious}
          >
            ⏮️ First
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page - 1)}
            disabled={!canGoPrevious}
          >
            ⬅️ Previous
          </button>
          <div className="table-viewer-page-info">
            Page {page + 1} of {totalPages}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page + 1)}
            disabled={!canGoNext}
          >
            Next ➡️
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={!canGoNext}
          >
            Last ⏭️
          </button>
        </div>
      </div>
    </div>
  );
};
