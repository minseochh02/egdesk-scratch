import React, { useState, useEffect } from 'react';

interface ColumnMapping {
  excelName: string;
  sqlName: string;
  type: string;
  included: boolean;
}

interface VisualColumnMapperProps {
  excelColumns: Array<{ name: string; type: string }>;
  sampleRows: any[];
  onMappingComplete: (mappings: Record<string, string>, mergeConfig: Record<string, { sources: string[]; separator: string }>) => void;
  onBack: () => void;
}

export const VisualColumnMapper: React.FC<VisualColumnMapperProps> = ({
  excelColumns,
  sampleRows,
  onMappingComplete,
  onBack,
}) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  useEffect(() => {
    // Initialize with exact Excel names (no sanitization yet)
    const initialMappings = excelColumns.map((col) => ({
      excelName: col.name,
      sqlName: col.name, // Start with exact same name
      type: col.type,
      included: true,
    }));
    setMappings(initialMappings);
  }, [excelColumns]);

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
          Review and edit the SQL column names. They start with the exact same names as your Excel headers.
        </p>
        <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          💡 <strong>Tip:</strong> Edit the "SQL Name" row to rename columns. Uncheck to exclude columns from import.
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
                      ? String(row[mapping.excelName])
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
