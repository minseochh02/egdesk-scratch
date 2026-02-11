import React, { useState, useEffect } from 'react';

interface ColumnMapping {
  originalName: string;
  sanitizedName: string;
  sqlName: string;
  type: string;
  included: boolean;
  hasConflict: boolean;
  conflictWith?: string[];
}

interface ColumnMapperProps {
  excelColumns: Array<{ name: string; type: string }>;
  onMappingComplete: (mappings: Record<string, string>) => void;
  onBack: () => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  excelColumns,
  onMappingComplete,
  onBack,
}) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [hasConflicts, setHasConflicts] = useState(false);

  // Initialize mappings
  useEffect(() => {
    const initialMappings = excelColumns.map((col, index) => {
      const sanitized = sanitizeColumnName(col.name);
      return {
        originalName: col.name,
        sanitizedName: sanitized,
        sqlName: sanitized,
        type: col.type,
        included: true,
        hasConflict: false,
        conflictWith: [],
      };
    });

    // Detect conflicts
    const sqlNames = initialMappings.map((m) => m.sqlName);
    const conflicts = findDuplicates(sqlNames);

    initialMappings.forEach((mapping) => {
      if (conflicts.includes(mapping.sqlName)) {
        mapping.hasConflict = true;
        mapping.conflictWith = initialMappings
          .filter((m) => m.sqlName === mapping.sqlName && m.originalName !== mapping.originalName)
          .map((m) => m.originalName);
      }
    });

    setMappings(initialMappings);
    setHasConflicts(conflicts.length > 0);
  }, [excelColumns]);

  const sanitizeColumnName = (name: string): string => {
    if (!name || name.trim() === '') {
      return 'column';
    }
    // Remove special characters, keep alphanumeric and underscores
    let sanitized = String(name)
      .replace(/[^a-zA-Z0-9_가-힣]/g, '_')
      .toLowerCase();

    // Ensure it doesn't start with a number
    if (/^\d/.test(sanitized)) {
      sanitized = 'col_' + sanitized;
    }

    return sanitized || 'column';
  };

  const findDuplicates = (arr: string[]): string[] => {
    const counts = arr.reduce((acc: Record<string, number>, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(counts).filter((key) => counts[key] > 1);
  };

  const handleSqlNameChange = (index: number, newName: string) => {
    const updated = [...mappings];
    updated[index].sqlName = newName;

    // Re-detect conflicts
    const sqlNames = updated.filter((m) => m.included).map((m) => m.sqlName);
    const conflicts = findDuplicates(sqlNames);

    updated.forEach((mapping) => {
      if (mapping.included) {
        if (conflicts.includes(mapping.sqlName)) {
          mapping.hasConflict = true;
          mapping.conflictWith = updated
            .filter((m) => m.included && m.sqlName === mapping.sqlName && m.originalName !== mapping.originalName)
            .map((m) => m.originalName);
        } else {
          mapping.hasConflict = false;
          mapping.conflictWith = [];
        }
      } else {
        mapping.hasConflict = false;
        mapping.conflictWith = [];
      }
    });

    setMappings(updated);
    setHasConflicts(conflicts.length > 0);
  };

  const handleIncludeToggle = (index: number) => {
    const updated = [...mappings];
    updated[index].included = !updated[index].included;

    // Re-detect conflicts for included columns only
    const sqlNames = updated.filter((m) => m.included).map((m) => m.sqlName);
    const conflicts = findDuplicates(sqlNames);

    updated.forEach((mapping) => {
      if (mapping.included) {
        if (conflicts.includes(mapping.sqlName)) {
          mapping.hasConflict = true;
          mapping.conflictWith = updated
            .filter((m) => m.included && m.sqlName === mapping.sqlName && m.originalName !== mapping.originalName)
            .map((m) => m.originalName);
        } else {
          mapping.hasConflict = false;
          mapping.conflictWith = [];
        }
      } else {
        mapping.hasConflict = false;
        mapping.conflictWith = [];
      }
    });

    setMappings(updated);
    setHasConflicts(conflicts.length > 0);
  };

  const handleAutoResolve = () => {
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

    // Re-detect conflicts (should be none now)
    const sqlNames = updated.filter((m) => m.included).map((m) => m.sqlName);
    const conflicts = findDuplicates(sqlNames);

    updated.forEach((mapping) => {
      mapping.hasConflict = false;
      mapping.conflictWith = [];
    });

    setMappings(updated);
    setHasConflicts(false);
  };

  const handleComplete = () => {
    if (hasConflicts) {
      alert('Please resolve all column name conflicts before continuing');
      return;
    }

    // Build final mapping: originalName -> sqlName (only for included columns)
    const finalMapping: Record<string, string> = {};
    mappings.forEach((mapping) => {
      if (mapping.included) {
        finalMapping[mapping.originalName] = mapping.sqlName;
      }
    });

    onMappingComplete(finalMapping);
  };

  const includedCount = mappings.filter((m) => m.included).length;

  return (
    <div className="column-mapper">
      <div className="column-mapper-header">
        <h3>Column Mapping</h3>
        <p style={{ color: '#666', fontSize: '14px', margin: '8px 0 0 0' }}>
          Map Excel columns to database columns. Resolve any conflicts before continuing.
        </p>
        <div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '6px', marginTop: '12px', fontSize: '13px' }}>
          💡 <strong>Note:</strong> An auto-incrementing <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>id</code> column will be automatically added as the first column in your table.
        </div>
      </div>

      {hasConflicts && (
        <div className="error-message" style={{ marginBottom: '16px' }}>
          ⚠️ Duplicate column names detected! Rename columns or use Auto-Resolve to fix conflicts.
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleAutoResolve}
            style={{ marginLeft: '12px' }}
          >
            🔧 Auto-Resolve
          </button>
        </div>
      )}

      <div className="column-mapper-stats" style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '6px' }}>
        <strong>{includedCount}</strong> of <strong>{mappings.length}</strong> columns will be imported
      </div>

      <div className="column-mapper-table-wrapper">
        <table className="column-mapper-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Include</th>
              <th style={{ width: '30%' }}>Excel Column</th>
              <th style={{ width: '50px', textAlign: 'center' }}>→</th>
              <th style={{ width: '30%' }}>Database Column</th>
              <th style={{ width: '15%' }}>Type</th>
              <th style={{ width: '20%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr
                key={index}
                className={mapping.hasConflict ? 'conflict-row' : mapping.included ? '' : 'excluded-row'}
              >
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={mapping.included}
                    onChange={() => handleIncludeToggle(index)}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500 }}>{mapping.originalName}</span>
                    {mapping.originalName !== mapping.sanitizedName && (
                      <span style={{ fontSize: '11px', color: '#999' }}>
                        (sanitized from: {mapping.originalName})
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: 'center', fontSize: '20px', color: '#4CAF50' }}>
                  {mapping.included ? '→' : '✕'}
                </td>
                <td>
                  {mapping.included ? (
                    <input
                      type="text"
                      value={mapping.sqlName}
                      onChange={(e) => handleSqlNameChange(index, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: mapping.hasConflict ? '2px solid #f44336' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontFamily: "'Courier New', monospace",
                      }}
                    />
                  ) : (
                    <span style={{ color: '#999', fontStyle: 'italic' }}>Excluded</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      padding: '4px 8px',
                      background: '#e3f2fd',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#1976d2',
                    }}
                  >
                    {mapping.type}
                  </span>
                </td>
                <td>
                  {mapping.hasConflict ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#f44336', fontWeight: 600 }}>⚠️ Conflict</span>
                      {mapping.conflictWith && mapping.conflictWith.length > 0 && (
                        <span
                          style={{ fontSize: '11px', color: '#999' }}
                          title={`Conflicts with: ${mapping.conflictWith.join(', ')}`}
                        >
                          ({mapping.conflictWith.length})
                        </span>
                      )}
                    </div>
                  ) : mapping.included ? (
                    <span style={{ color: '#4CAF50', fontWeight: 600 }}>✓ Ready</span>
                  ) : (
                    <span style={{ color: '#999' }}>Excluded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="column-mapper-footer">
        <button className="btn btn-secondary" onClick={onBack}>
          ⬅️ Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleComplete}
          disabled={hasConflicts || includedCount === 0}
        >
          {hasConflicts ? '⚠️ Resolve Conflicts' : 'Continue ➡️'}
        </button>
      </div>
    </div>
  );
};
