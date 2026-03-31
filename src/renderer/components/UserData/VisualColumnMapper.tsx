import React, { useState, useEffect } from 'react';

/**
 * Format date value for display
 * Converts various date formats to YYYY-MM-DD
 */
const formatDateForDisplay = (value: any): string => {
  if (!value) return value;

  // If already a Date object, format it
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If it's a number, check for YYYYMMDD format (e.g., 20250101)
  if (typeof value === 'number' && Number.isInteger(value)) {
    const valueStr = String(value);
    if (valueStr.length === 8 && value >= 19000101 && value <= 21991231) {
      const year = valueStr.substring(0, 4);
      const month = valueStr.substring(4, 6);
      const day = valueStr.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a string, check for YYYYMMDD format
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Handle YYYYMMDD format (e.g., "20250101")
    if (/^\d{8}$/.test(trimmed)) {
      const year = trimmed.substring(0, 4);
      const month = trimmed.substring(4, 6);
      const day = trimmed.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  }

  // Return as-is for other formats
  return value;
};

interface ColumnMapping {
  excelName: string;
  sqlName: string;
  type: string;
  excelType: string; // Excel column type for formatting display
  included: boolean;
}

interface VisualColumnMapperProps {
  excelColumns: Array<{ name: string; type: string }>;
  sampleRows: any[];
  targetTable?: { schema: Array<{ name: string; type: string }> }; // For upload mode: map to existing table
  onMappingComplete: (mappings: Record<string, string>, mergeConfig: Record<string, { sources: string[]; separator: string }>) => void;
  onBack: () => void;
}

export const VisualColumnMapper: React.FC<VisualColumnMapperProps> = ({
  excelColumns,
  sampleRows,
  targetTable,
  onMappingComplete,
  onBack,
}) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    if (targetTable) {
      // UPLOAD MODE: Map Excel columns to existing table columns
      console.log('🔄 VisualColumnMapper: Upload mode - mapping to existing table');
      console.log('   Target table columns:', targetTable.schema.map(c => c.name));
      console.log('   Excel columns:', excelColumns.map(c => c.name));

      // Try to auto-match columns by name similarity
      const initialMappings = excelColumns.map((excelCol) => {
        // Find exact match in target table (case-insensitive)
        const exactMatch = targetTable.schema.find(
          tableCol => tableCol.name.toLowerCase() === excelCol.name.toLowerCase()
        );

        // Find partial match (contains)
        const partialMatch = !exactMatch ? targetTable.schema.find(
          tableCol => tableCol.name.toLowerCase().includes(excelCol.name.toLowerCase()) ||
                      excelCol.name.toLowerCase().includes(tableCol.name.toLowerCase())
        ) : null;

        // Special matching for split columns (e.g., "월_일" → "일자", "월_일_번호" → "일자_번호")
        // If the Excel column ends with "_번호", look for a table column with same ending AND matching type (INTEGER)
        // If the Excel column is DATE type, look for a DATE column in the table
        let typeBasedMatch = null;
        if (!exactMatch && !partialMatch) {
          if (excelCol.name.endsWith('_번호') && excelCol.type === 'INTEGER') {
            // Look for INTEGER column ending with "_번호"
            typeBasedMatch = targetTable.schema.find(
              tableCol => tableCol.type === 'INTEGER' && tableCol.name.endsWith('_번호')
            );
          } else if (excelCol.type === 'DATE') {
            // Look for DATE column (but not imported_at)
            typeBasedMatch = targetTable.schema.find(
              tableCol => tableCol.type === 'DATE' && tableCol.name !== 'imported_at'
            );
          }
        }

        const matchedColumn = exactMatch || partialMatch || typeBasedMatch;

        // In upload mode: if we can't find a match in the target table, exclude this column by default
        // (User can manually include it and select a target column if needed)
        if (!matchedColumn) {
          // Get first available non-id column as default
          const firstAvailableColumn = targetTable.schema.find(col => col.name !== 'id' && col.name !== 'imported_at');
          return {
            excelName: excelCol.name,
            sqlName: firstAvailableColumn ? firstAvailableColumn.name : excelCol.name,
            type: firstAvailableColumn ? firstAvailableColumn.type : excelCol.type,
            excelType: excelCol.type, // Preserve Excel type for display formatting
            included: false, // Exclude unmapped columns by default
          };
        }

        // Debug log for 일자 column
        if (excelCol.name === '일자') {
          console.log(`🔍 VisualColumnMapper: Mapping 일자 column`, {
            excelName: excelCol.name,
            excelType: excelCol.type,
            matchedSqlName: matchedColumn.name,
            matchedType: matchedColumn.type,
          });
        }

        return {
          excelName: excelCol.name,
          sqlName: matchedColumn.name,
          type: matchedColumn.type,
          excelType: excelCol.type, // Preserve Excel type for display formatting
          included: true,
        };
      });

      console.log('   Auto-matched mappings:', initialMappings.map(m => `${m.excelName} → ${m.sqlName}`));
      setMappings(initialMappings);
    } else {
      // IMPORT MODE: Initialize with exact Excel names (no sanitization yet)
      const initialMappings = excelColumns.map((col) => {
        console.log(`🔍 VisualColumnMapper: Setting up column "${col.name}" with type: ${col.type}`);
        return {
          excelName: col.name,
          sqlName: col.name, // Start with exact same name
          type: col.type,
          excelType: col.type,
          included: true,
        };
      });
      setMappings(initialMappings);
    }
  }, [excelColumns, targetTable]);

  const handleSqlNameChange = (index: number, newName: string) => {
    const updated = [...mappings];
    updated[index].sqlName = newName;
    setMappings(updated);
  };

  const handleTypeChange = (index: number, newType: string) => {
    const updated = [...mappings];
    updated[index].type = newType;
    setMappings(updated);
  };

  const handleIncludeToggle = (index: number) => {
    const updated = [...mappings];
    updated[index].included = !updated[index].included;
    setMappings(updated);
  };

  const findDuplicates = (): string[] => {
    const includedNames = mappings.filter((m) => m.included).map((m) => m.sqlName);
    const counts = includedNames.reduce((acc: Record<string, number>, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).filter((key) => counts[key] > 1);
  };

  const handleAutoFix = () => {
    const updated = [...mappings];
    const sqlNameCounts: Record<string, number> = {};

    updated.forEach((mapping) => {
      if (!mapping.included) return;

      const baseName = mapping.sqlName;
      if (!sqlNameCounts[baseName]) {
        sqlNameCounts[baseName] = 0;
      } else {
        sqlNameCounts[baseName]++;
        mapping.sqlName = `${baseName}_${sqlNameCounts[baseName]}`;
      }
    });

    setMappings(updated);
  };

  const handleComplete = () => {
    const duplicates = findDuplicates();
    if (duplicates.length > 0) {
      alert(`Duplicate SQL column names found: ${duplicates.join(', ')}\n\nPlease rename or use Auto-Fix.`);
      return;
    }

    // Build final mapping
    const finalMappings: Record<string, string> = {};
    mappings.forEach((mapping) => {
      if (mapping.included) {
        finalMappings[mapping.excelName] = mapping.sqlName;
      }
    });

    // No merge config needed for this simpler design
    onMappingComplete(finalMappings, {});
  };

  const duplicates = findDuplicates();
  const hasDuplicates = duplicates.length > 0;
  const includedCount = mappings.filter((m) => m.included).length;

  return (
    <div className="visual-column-mapper">
      <div className="visual-mapper-header">
        <h3>Column Mapping</h3>
        <p style={{ color: '#666', fontSize: '14px', margin: '8px 0' }}>
          {targetTable
            ? 'Map your Excel columns to the target table columns. Use the dropdown to select which table column each Excel column should map to.'
            : 'Review and edit the SQL column names. They start with the exact same names as your Excel headers.'
          }
        </p>
        <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          💡 <strong>Tip:</strong> {targetTable
            ? 'Select the matching table column from the dropdown, or uncheck to exclude columns.'
            : 'Edit the "SQL Name" row to rename columns. Uncheck to exclude columns from import.'
          }
        </div>
      </div>

      {hasDuplicates && (
        <div className="error-message" style={{ marginTop: '16px' }}>
          ⚠️ Duplicate SQL column names: <strong>{duplicates.join(', ')}</strong>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAutoFix}
            style={{ marginLeft: '12px' }}
          >
            🔧 Auto-Fix
          </button>
        </div>
      )}

      <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', fontSize: '13px' }}>
        <strong>{includedCount}</strong> of <strong>{mappings.length}</strong> columns will be imported
      </div>

      <div style={{ marginTop: '24px', overflow: 'auto', border: '2px solid #2196F3', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ width: '40px', padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'center' }}>
                Include
              </th>
              {mappings.map((mapping, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '12px 8px',
                    borderBottom: '2px solid #ddd',
                    borderRight: idx < mappings.length - 1 ? '1px solid #ddd' : 'none',
                    textAlign: 'center',
                    minWidth: '150px',
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={mapping.included}
                      onChange={() => handleIncludeToggle(idx)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>
                </th>
              ))}
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd', fontSize: '11px', color: '#999' }}>
                Excel
              </th>
              {mappings.map((mapping, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #ddd',
                    borderRight: idx < mappings.length - 1 ? '1px solid #ddd' : 'none',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#333',
                    background: mapping.included ? '#fff' : '#f5f5f5',
                    opacity: mapping.included ? 1 : 0.5,
                  }}
                >
                  {mapping.excelName}
                </th>
              ))}
            </tr>
            <tr style={{ background: '#e3f2fd' }}>
              <th style={{ padding: '8px', borderBottom: '2px solid #2196F3', fontSize: '11px', color: '#1976d2', fontWeight: 600 }}>
                SQL
              </th>
              {mappings.map((mapping, idx) => {
                const isDuplicate = mapping.included && duplicates.includes(mapping.sqlName);
                return (
                  <th
                    key={idx}
                    style={{
                      padding: '8px',
                      borderBottom: '2px solid #2196F3',
                      borderRight: idx < mappings.length - 1 ? '1px solid #ddd' : 'none',
                      textAlign: 'center',
                      background: mapping.included ? (isDuplicate ? '#ffebee' : '#fff') : '#f5f5f5',
                      opacity: mapping.included ? 1 : 0.5,
                    }}
                  >
                    {mapping.included ? (
                      targetTable ? (
                        // Upload mode: dropdown of target table columns
                        <select
                          value={mapping.sqlName}
                          onChange={(e) => handleSqlNameChange(idx, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 8px',
                            border: isDuplicate ? '2px solid #f44336' : '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '13px',
                            background: '#fff',
                          }}
                        >
                          {targetTable.schema.filter(col => col.name !== 'id').map(col => (
                            <option key={col.name} value={col.name}>
                              {col.name} ({col.type})
                            </option>
                          ))}
                        </select>
                      ) : (
                        // Import mode: text input
                        <input
                          type="text"
                          value={mapping.sqlName}
                          onChange={(e) => handleSqlNameChange(idx, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: isDuplicate ? '2px solid #f44336' : '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: "'Courier New', monospace",
                            textAlign: 'center',
                            background: isDuplicate ? '#ffebee' : 'white',
                          }}
                        />
                      )
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#999' }}>—</span>
                    )}
                  </th>
                );
              })}
            </tr>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '8px', borderBottom: '1px solid #ddd', fontSize: '11px', color: '#999' }}>
                Type
              </th>
              {mappings.map((mapping, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #ddd',
                    borderRight: idx < mappings.length - 1 ? '1px solid #ddd' : 'none',
                    textAlign: 'center',
                    background: mapping.included ? '#fff' : '#f5f5f5',
                    opacity: mapping.included ? 1 : 0.5,
                  }}
                >
                  {mapping.included ? (
                    <select
                      value={mapping.type}
                      onChange={(e) => handleTypeChange(idx, e.target.value)}
                      style={{
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}
                    >
                      <option value="TEXT">TEXT</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="REAL">REAL</option>
                      <option value="DATE">DATE</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#999' }}>—</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.slice(0, 3).map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', fontSize: '11px', color: '#999', textAlign: 'center' }}>
                  Row {rowIdx + 1}
                </td>
                {mappings.map((mapping, colIdx) => (
                  <td
                    key={colIdx}
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid #f0f0f0',
                      borderRight: colIdx < mappings.length - 1 ? '1px solid #f0f0f0' : 'none',
                      fontSize: '12px',
                      color: '#666',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      background: mapping.included ? 'white' : '#f9f9f9',
                      opacity: mapping.included ? 1 : 0.5,
                    }}
                  >
                    {row[mapping.excelName] !== null && row[mapping.excelName] !== undefined
                      ? mapping.excelType === 'DATE'
                        ? formatDateForDisplay(row[mapping.excelName])
                        : String(row[mapping.excelName])
                      : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="column-mapper-footer" style={{ marginTop: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ⬅️ Back
        </button>
        <button className="btn btn-primary" onClick={handleComplete} disabled={hasDuplicates || includedCount === 0}>
          {hasDuplicates ? '⚠️ Fix Duplicates' : 'Continue ➡️'}
        </button>
      </div>
    </div>
  );
};
