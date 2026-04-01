import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronLeft, faChevronRight, faRobot, faSearch, faTimes, faUpload } from '@fortawesome/free-solid-svg-icons';
import { UserTable, useUserData, QueryOptions } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';
import { ExcelUploadDialog } from './ExcelUploadDialog';
import { VectorEmbeddingDialog } from './VectorEmbeddingDialog';
import { VectorStatsPanel } from './VectorStatsPanel';

interface TableViewerProps {
  table: UserTable;
  onBack: () => void;
}

export const TableViewer: React.FC<TableViewerProps> = ({ table, onBack }) => {
  const {
    queryTable,
    searchTable,
    embedTableColumns,
    vectorSearchTable,
    getEmbeddingStats,
    deleteEmbeddings,
    getEmbeddedColumns,
  } = useUserData();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEmbeddingDialog, setShowEmbeddingDialog] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [vectorThreshold, setVectorThreshold] = useState(0.7);
  const [statsKey, setStatsKey] = useState(0); // Force stats panel refresh

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;

      if (searchQuery.trim()) {
        if (searchMode === 'semantic') {
          // Semantic search mode
          result = await vectorSearchTable(table.id, searchQuery, {
            limit,
            threshold: vectorThreshold,
          });
          setPage(0); // Reset to first page in search mode
        } else {
          // Keyword search mode
          result = await searchTable(table.id, searchQuery, limit);
          setPage(0); // Reset to first page in search mode
        }
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
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [table.id, page, searchQuery, sortColumn, sortDirection, searchMode, vectorThreshold]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchData();
  };

  const handleSort = (column: string, direction: 'ASC' | 'DESC') => {
    setSortColumn(column);
    setSortDirection(direction);
    setPage(0); // Reset to first page when sorting
  };

  const handleUploadComplete = () => {
    fetchData(); // Refresh the table data after upload
  };

  const handleEmbeddingComplete = () => {
    setStatsKey((prev) => prev + 1); // Force stats panel refresh
    fetchData(); // Refresh table data
  };

  const handleEmbeddingsDeleted = () => {
    setStatsKey((prev) => prev + 1); // Force stats panel refresh
    setSearchMode('keyword'); // Reset to keyword search
    fetchData(); // Refresh table data
  };

  const totalPages = Math.ceil(total / limit);
  const canGoPrevious = page > 0;
  const canGoNext = page < totalPages - 1;

  return (
    <div className="table-viewer">
      <div className="table-viewer-header">
        <div className="table-viewer-title">
          <button className="btn-icon" onClick={onBack} title="Back to tables">
            <FontAwesomeIcon icon={faArrowLeft} />
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

        <VectorStatsPanel
          key={statsKey}
          tableId={table.id}
          getEmbeddingStats={getEmbeddingStats}
          deleteEmbeddings={deleteEmbeddings}
          onEmbeddingsDeleted={handleEmbeddingsDeleted}
        />

        <div className="table-viewer-controls">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <input
              type="text"
              className="table-viewer-search"
              placeholder={
                searchMode === 'semantic'
                  ? 'Semantic search (e.g., "find gaming laptops")...'
                  : 'Search across all columns...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-compact">
              <FontAwesomeIcon icon={faSearch} /> Search
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                <FontAwesomeIcon icon={faTimes} /> Clear
              </button>
            )}
          </form>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => setShowEmbeddingDialog(true)}
            style={{ marginLeft: '8px' }}
          >
            <FontAwesomeIcon icon={faRobot} /> Embed Table
          </button>
          <button
            className="btn btn-primary btn-compact"
            onClick={() => setShowUploadDialog(true)}
            style={{ marginLeft: '8px' }}
          >
            <FontAwesomeIcon icon={faUpload} /> Upload Excel
          </button>
        </div>

        {searchQuery && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Search Mode:</label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="searchMode"
                  value="keyword"
                  checked={searchMode === 'keyword'}
                  onChange={() => setSearchMode('keyword')}
                  style={{ marginRight: '4px' }}
                />
                Keyword
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="searchMode"
                  value="semantic"
                  checked={searchMode === 'semantic'}
                  onChange={() => setSearchMode('semantic')}
                  style={{ marginRight: '4px' }}
                />
                Semantic
              </label>
            </div>

            {searchMode === 'semantic' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>
                  Similarity Threshold:
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={vectorThreshold}
                  onChange={(e) => setVectorThreshold(parseFloat(e.target.value))}
                  style={{ flex: 1, maxWidth: '200px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 500, minWidth: '40px' }}>
                  {vectorThreshold.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="table-viewer-body" style={{ position: 'relative' }}>
        {initialLoad && loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            {loading && !initialLoad && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
              </div>
            )}
            <DataTable
              columns={
                searchMode === 'semantic' && searchQuery
                  ? [
                      { name: '_similarity', type: 'REAL' as const },
                      { name: '_matchedColumns', type: 'TEXT' as const },
                      ...table.schema.map((col) => ({
                        name: col.name,
                        type: col.type,
                      })),
                    ]
                  : table.schema.map((col) => ({
                      name: col.name,
                      type: col.type,
                    }))
              }
              rows={rows}
              maxHeight="calc(100vh - 300px)"
              onSort={handleSort}
            />
          </>
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
            First
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page - 1)}
            disabled={!canGoPrevious}
          >
            <FontAwesomeIcon icon={faChevronLeft} /> Previous
          </button>
          <div className="table-viewer-page-info">
            Page {page + 1} of {totalPages}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(page + 1)}
            disabled={!canGoNext}
          >
            Next <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={!canGoNext}
          >
            Last
          </button>
        </div>
      </div>

      {showUploadDialog && (
        <ExcelUploadDialog
          table={table}
          onClose={() => setShowUploadDialog(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {showEmbeddingDialog && (
        <VectorEmbeddingDialog
          table={table}
          onClose={() => setShowEmbeddingDialog(false)}
          onComplete={handleEmbeddingComplete}
          embedTableColumns={embedTableColumns}
          getEmbeddedColumns={getEmbeddedColumns}
        />
      )}
    </div>
  );
};
