import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faDatabase, faTable, faRefresh, faTimes } from '../../utils/fontAwesomeIcons';
import './SQLDataViewer.css';

interface SQLDataViewerProps {
  spreadsheetId: string;
  onClose?: () => void;
}

interface ImportedTable {
  tableName: string;
  originalSheetName?: string;
  rowCount: number;
  columnCount: number;
  lastImported: string;
}

interface TableData {
  columns: string[];
  headersMapping?: Record<string, string>;
  rows: any[];
  totalCount: number;
}

const SQLDataViewer: React.FC<SQLDataViewerProps> = ({ spreadsheetId, onClose }) => {
  const [tables, setTables] = useState<ImportedTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

  // Load imported tables
  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electron.sheets.getImportedTables(spreadsheetId);
      
      if (result.success && result.tables) {
        setTables(result.tables);
        // Auto-select first table if available
        if (result.tables.length > 0 && !selectedTable) {
          setSelectedTable(result.tables[0].tableName);
        }
      } else {
        setError(result.error || 'Failed to load tables');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Load table data
  const loadTableData = async (tableName: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (currentPage - 1) * rowsPerPage;
      const result = await window.electron.sheets.queryImportedTable({ 
        tableName, 
        limit: rowsPerPage, 
        offset 
      });
      
      if (result.success) {
        setTableData({
          columns: result.columns,
          headersMapping: result.headersMapping,
          rows: result.rows,
          totalCount: result.totalCount
        });
      } else {
        setError(result.error || 'Failed to load table data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [spreadsheetId]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable, currentPage]);

  const totalPages = tableData ? Math.ceil(tableData.totalCount / rowsPerPage) : 0;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="sql-data-viewer">
      <div className="sql-viewer-header">
        <h3>
          <FontAwesomeIcon icon={faDatabase} /> Imported SQL Data
        </h3>
        <div className="header-actions">
          <button className="refresh-button" onClick={loadTables} disabled={loading}>
            <FontAwesomeIcon icon={faRefresh} spin={loading} />
          </button>
          {onClose && (
            <button className="close-button" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="sql-error">
          Error: {error}
        </div>
      )}

      <div className="sql-viewer-content">
        {/* Tables List */}
        <div className="tables-sidebar">
          <h4>Tables</h4>
          {loading && tables.length === 0 ? (
            <div className="loading-indicator">
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          ) : tables.length === 0 ? (
            <div className="no-tables">No imported tables</div>
          ) : (
            <ul className="tables-list">
              {tables.map(table => (
                <li 
                  key={table.tableName} 
                  className={selectedTable === table.tableName ? 'selected' : ''}
                  onClick={() => {
                    setSelectedTable(table.tableName);
                    setCurrentPage(1);
                  }}
                >
                  <FontAwesomeIcon icon={faTable} />
                  <div className="table-info">
                    <div className="table-name">{table.originalSheetName || table.tableName}</div>
                    <div className="table-stats">
                      {table.rowCount} rows • {table.columnCount} cols
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Table Data */}
        <div className="table-content">
          {selectedTable && tableData ? (
            <>
              <div className="table-header">
                <h4>{selectedTable}</h4>
                <div className="pagination">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
              
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {tableData.columns.map(col => (
                        <th key={col}>
                          {tableData.headersMapping?.[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, idx) => (
                      <tr key={idx}>
                        {tableData.columns.map(col => (
                          <td key={col}>{formatValue(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="no-selection">
              {loading ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                'Select a table to view data'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SQLDataViewer;