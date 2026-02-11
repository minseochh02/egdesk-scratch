import React, { useState, useEffect } from 'react';
import { UserTable } from '../../hooks/useUserData';

interface ExistingTableMapperProps {
  excelColumns: string[];
  excelTypes: string[];
  sampleRows: any[];
  availableTables: UserTable[];
  onMappingComplete: (tableId: string, mappings: Record<string, string>) => void;
  onBack: () => void;
}

export const ExistingTableMapper: React.FC<ExistingTableMapperProps> = ({
  excelColumns,
  excelTypes,
  sampleRows,
  availableTables,
  onMappingComplete,
  onBack,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selectedTable = availableTables.find(t => t.id === selectedTableId);

  // Auto-map columns when table is selected
  useEffect(() => {
    if (selectedTable) {
      const autoMappings: Record<string, string> = {};
      
      // Filter out the 'id' column from table schema
      const tableColumns = selectedTable.schema.filter(col => col.name !== 'id');
      
      excelColumns.forEach((excelCol) => {
        const normalizedExcelCol = excelCol.toLowerCase().trim();
        
        // Try exact match first
        const exactMatch = tableColumns.find(
          tableCol => tableCol.name.toLowerCase() === normalizedExcelCol
        );
        
        if (exactMatch) {
          autoMappings[excelCol] = exactMatch.name;
        } else {
          // Try partial match
          const partialMatch = tableColumns.find(
            tableCol => 
              tableCol.name.toLowerCase().includes(normalizedExcelCol) ||
              normalizedExcelCol.includes(tableCol.name.toLowerCase())
          );
          
          if (partialMatch) {
            autoMappings[excelCol] = partialMatch.name;
          }
        }
      });
      
      setColumnMappings(autoMappings);
    }
  }, [selectedTableId, selectedTable, excelColumns]);

  const handleTableSelect = (tableId: string) => {
    setSelectedTableId(tableId);
    setError(null);
  };

  const handleMappingChange = (excelColumn: string, tableColumn: string) => {
    setColumnMappings(prev => {
      if (tableColumn === '') {
        const newMappings = { ...prev };
        delete newMappings[excelColumn];
        return newMappings;
      }
      return {
        ...prev,
        [excelColumn]: tableColumn,
      };
    });
  };

  const handleComplete = () => {
    if (!selectedTableId) {
      setError('Please select a table');
      return;
    }

    if (Object.keys(columnMappings).length === 0) {
      setError('Please map at least one column');
      return;
    }

    // Validate that we're not mapping multiple Excel columns to the same table column
    const tableColumnValues = Object.values(columnMappings);
    const duplicates = tableColumnValues.filter(
      (val, idx) => tableColumnValues.indexOf(val) !== idx
    );
    
    if (duplicates.length > 0) {
      setError(`Multiple Excel columns are mapped to the same table column: ${[...new Set(duplicates)].join(', ')}`);
      return;
    }

    onMappingComplete(selectedTableId, columnMappings);
  };

  if (!selectedTable) {
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>Select Target Table</h3>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Choose which existing table to sync this data into
        </p>

        {availableTables.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            color: '#666'
          }}>
            <p>No tables available. Please create a new table first.</p>
          </div>
        ) : (
          <div className="existing-tables-list">
            {availableTables.map((table) => (
              <div
                key={table.id}
                className="existing-table-card"
                onClick={() => handleTableSelect(table.id)}
              >
                <div className="existing-table-info">
                  <div className="existing-table-name">
                    📊 {table.displayName}
                  </div>
                  <div className="existing-table-meta">
                    {table.rowCount.toLocaleString()} rows • {table.columnCount} columns
                    {table.description && (
                      <span style={{ marginLeft: '8px', color: '#999' }}>
                        • {table.description}
                      </span>
                    )}
                  </div>
                  <div className="existing-table-schema">
                    {table.schema.filter(col => col.name !== 'id').map(col => (
                      <span key={col.name} className="schema-column-tag">
                        {col.name} ({col.type})
                      </span>
                    ))}
                  </div>
                </div>
                <div className="existing-table-action">Select →</div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}
      </div>
    );
  }

  const tableColumns = selectedTable.schema.filter(col => col.name !== 'id');
  const unmappedTableColumns = tableColumns.filter(
    col => !Object.values(columnMappings).includes(col.name)
  );
  const unmappedExcelColumns = excelColumns.filter(
    col => !columnMappings[col]
  );

  return (
    <div>
      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>
          Selected Table: {selectedTable.displayName}
        </h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          {selectedTable.rowCount.toLocaleString()} rows • {tableColumns.length} columns
        </p>
        <button
          onClick={() => setSelectedTableId(null)}
          className="btn btn-sm btn-secondary"
          style={{ marginTop: '12px' }}
        >
          ← Change Table
        </button>
      </div>

      <h3>Map Excel Columns to Table Columns</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Match your Excel columns to the existing table structure. Unmapped columns will be ignored.
      </p>

      <div className="column-mapping-container">
        <div className="column-mapping-grid">
          {excelColumns.map((excelCol, idx) => {
            const sampleValue = sampleRows[0]?.[excelCol];
            const mappedTo = columnMappings[excelCol];
            const matchedTableCol = tableColumns.find(tc => tc.name === mappedTo);

            return (
              <div key={excelCol} className="column-mapping-row">
                <div className="excel-column-info">
                  <div className="excel-column-name">
                    📄 {excelCol}
                  </div>
                  <div className="excel-column-meta">
                    Type: {excelTypes[idx]}
                    {sampleValue && (
                      <span style={{ marginLeft: '8px', color: '#999' }}>
                        • Sample: {String(sampleValue).substring(0, 30)}
                        {String(sampleValue).length > 30 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mapping-arrow">→</div>

                <div className="table-column-select">
                  <select
                    value={mappedTo || ''}
                    onChange={(e) => handleMappingChange(excelCol, e.target.value)}
                    className="column-select"
                  >
                    <option value="">Skip this column</option>
                    {tableColumns.map((tableCol) => (
                      <option
                        key={tableCol.name}
                        value={tableCol.name}
                        disabled={
                          Object.values(columnMappings).includes(tableCol.name) &&
                          columnMappings[excelCol] !== tableCol.name
                        }
                      >
                        {tableCol.name} ({tableCol.type})
                        {tableCol.notNull ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                  {matchedTableCol && (
                    <div className="type-match-indicator">
                      {excelTypes[idx] === matchedTableCol.type ? (
                        <span style={{ color: '#4caf50' }}>✓ Type match</span>
                      ) : (
                        <span style={{ color: '#ff9800' }}>⚠ Type mismatch</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
        {unmappedExcelColumns.length > 0 && (
          <div style={{ flex: 1, background: '#fff3e0', padding: '12px', borderRadius: '6px' }}>
            <strong>⚠ Unmapped Excel Columns ({unmappedExcelColumns.length}):</strong>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {unmappedExcelColumns.join(', ')}
            </div>
          </div>
        )}

        {unmappedTableColumns.length > 0 && (
          <div style={{ flex: 1, background: '#e3f2fd', padding: '12px', borderRadius: '6px' }}>
            <strong>ℹ Unmapped Table Columns ({unmappedTableColumns.length}):</strong>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {unmappedTableColumns.map(col => col.name).join(', ')}
              <br />
              <span style={{ color: '#666', fontSize: '12px' }}>
                These columns will use default/null values
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ⬅️ Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={Object.keys(columnMappings).length === 0}
        >
          Next: Preview →
        </button>
      </div>
    </div>
  );
};
