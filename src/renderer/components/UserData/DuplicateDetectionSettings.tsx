import React, { useState, useEffect } from 'react';
import './UserData.css';

interface DuplicateDetectionSettingsProps {
  schema: Array<{ name: string; type: string }>;
  initialUniqueColumns?: string[];
  initialDuplicateAction?: 'skip' | 'update' | 'allow';
  onSettingsChange: (settings: {
    uniqueKeyColumns: string[];
    duplicateAction: 'skip' | 'update' | 'allow';
  }) => void;
}

/**
 * Component for configuring duplicate detection settings
 * Allows users to:
 * 1. Enable/disable duplicate detection
 * 2. Select which columns form the unique key
 * 3. Choose how to handle duplicates (skip/update/allow)
 */
export function DuplicateDetectionSettings({
  schema,
  initialUniqueColumns = [],
  initialDuplicateAction = 'skip',
  onSettingsChange,
}: DuplicateDetectionSettingsProps) {
  const [enabled, setEnabled] = useState(initialUniqueColumns.length > 0);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(initialUniqueColumns)
  );
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'allow'>(
    initialDuplicateAction
  );

  // Filter out ID column (auto-generated)
  const availableColumns = schema.filter(col => col.name !== 'id');

  // Notify parent of changes
  useEffect(() => {
    if (enabled && selectedColumns.size > 0) {
      onSettingsChange({
        uniqueKeyColumns: Array.from(selectedColumns),
        duplicateAction,
      });
    } else {
      onSettingsChange({
        uniqueKeyColumns: [],
        duplicateAction: 'skip',
      });
    }
  }, [enabled, selectedColumns, duplicateAction, onSettingsChange]);

  const toggleColumn = (columnName: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(columnName)) {
      newSelected.delete(columnName);
    } else {
      newSelected.add(columnName);
    }
    setSelectedColumns(newSelected);
  };

  const selectSuggestedColumns = () => {
    const suggested = new Set<string>();

    // Priority 1: DATE columns
    const dateColumns = availableColumns.filter(
      col => col.type === 'DATE' || /date|날짜|일자|거래일/i.test(col.name)
    );
    dateColumns.forEach(col => suggested.add(col.name));

    // Priority 2: Amount columns
    const amountColumns = availableColumns.filter(
      col =>
        (col.type === 'INTEGER' || col.type === 'REAL') &&
        /amount|금액|가격|price|cost|원/i.test(col.name)
    );
    if (amountColumns.length > 0) {
      suggested.add(amountColumns[0].name);
    }

    // Priority 3: Description/Merchant columns
    const descColumns = availableColumns.filter(
      col =>
        col.type === 'TEXT' &&
        /desc|description|merchant|가맹점|상호|판매처|거래처|품목명/i.test(col.name)
    );
    if (descColumns.length > 0) {
      suggested.add(descColumns[0].name);
    }

    setSelectedColumns(suggested);
    if (suggested.size > 0) {
      setEnabled(true);
    }
  };

  const selectAllColumns = () => {
    const allColumns = new Set(availableColumns.map(col => col.name));
    setSelectedColumns(allColumns);
    setEnabled(true);
  };

  const clearAllColumns = () => {
    setSelectedColumns(new Set());
  };

  return (
    <div className="duplicate-detection-settings">
      <div className="setting-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="checkbox"
            id="enable-duplicate-detection"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label
            htmlFor="enable-duplicate-detection"
            style={{ fontWeight: 600, fontSize: '15px', cursor: 'pointer', margin: 0 }}
          >
            🔍 Enable Duplicate Detection
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={selectSuggestedColumns}
            className="btn-secondary"
            style={{ fontSize: '13px', padding: '6px 12px' }}
            title="Auto-select recommended columns"
          >
            ⚡ Use Suggested
          </button>
          <button
            type="button"
            onClick={selectAllColumns}
            className="btn-secondary"
            style={{ fontSize: '13px', padding: '6px 12px' }}
            title="Select all columns (strict matching)"
          >
            ☑️ Select All
          </button>
          {selectedColumns.size > 0 && (
            <button
              type="button"
              onClick={clearAllColumns}
              className="btn-secondary"
              style={{ fontSize: '13px', padding: '6px 12px' }}
              title="Clear all selections"
            >
              ✖️ Clear
            </button>
          )}
        </div>
      </div>

      {enabled && (
        <>
          <div className="setting-section">
            <label className="setting-label">
              <strong>Select Unique Key Columns</strong>
              <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>
                (Choose columns that together make each row unique)
              </span>
            </label>

            <div className="column-selector">
              {availableColumns.map((col, idx) => (
                <div
                  key={`${col.name}-${idx}`}
                  className={`column-chip ${selectedColumns.has(col.name) ? 'selected' : ''}`}
                  onClick={() => toggleColumn(col.name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(col.name)}
                    onChange={() => {}}
                    style={{ marginRight: '8px' }}
                  />
                  <span className="column-name">{col.name}</span>
                  <span className="column-type">{col.type}</span>
                </div>
              ))}
            </div>

            {selectedColumns.size === 0 && (
              <div className="warning-message">
                ⚠️ Please select at least one column to enable duplicate detection
              </div>
            )}

            {selectedColumns.size > 0 && (
              <div className="selected-summary">
                <strong>Selected Unique Key:</strong>{' '}
                <code>{Array.from(selectedColumns).join(' + ')}</code>
              </div>
            )}
          </div>

          <div className="setting-section">
            <label className="setting-label">
              <strong>Duplicate Handling</strong>
            </label>

            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="duplicate-action"
                  value="skip"
                  checked={duplicateAction === 'skip'}
                  onChange={(e) => setDuplicateAction(e.target.value as any)}
                />
                <div className="radio-content">
                  <div className="radio-title">⏭️ Skip duplicates (Recommended)</div>
                  <div className="radio-description">
                    Don't insert duplicate rows. Saves space and prevents redundant data.
                  </div>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="duplicate-action"
                  value="update"
                  checked={duplicateAction === 'update'}
                  onChange={(e) => setDuplicateAction(e.target.value as any)}
                />
                <div className="radio-content">
                  <div className="radio-title">🔄 Update duplicates</div>
                  <div className="radio-description">
                    Update existing rows with new data. Best for tracking status changes.
                  </div>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="duplicate-action"
                  value="allow"
                  checked={duplicateAction === 'allow'}
                  onChange={(e) => setDuplicateAction(e.target.value as any)}
                />
                <div className="radio-content">
                  <div className="radio-title">✅ Allow duplicates</div>
                  <div className="radio-description">
                    Insert all rows, even duplicates. For event logs or audit trails.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="info-box">
            <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
              <strong>💡 Tips:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>
                  <strong>Date + Amount + Merchant:</strong> Great for financial transactions
                </li>
                <li>
                  <strong>Date + Product + Store:</strong> Perfect for sales data
                </li>
                <li>
                  <strong>Select All:</strong> Strict matching - row must match ALL columns to be duplicate
                </li>
                <li>
                  <strong>More columns = More strict:</strong> Balance accuracy with practicality
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
