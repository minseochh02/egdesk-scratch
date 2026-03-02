import React from 'react';
import { BaseStepProps } from '../types';

/**
 * ParseConfigStep - Configure Excel parsing options (header row, skip bottom rows)
 * 100% duplicate code elimination from ImportWizard and ExcelUploadDialog
 */
export const ParseConfigStep: React.FC<BaseStepProps> = ({
  wizardState,
  onStateChange,
  error,
}) => {
  const { selectedFile, headerRow, skipBottomRows } = wizardState;

  return (
    <div>
      <div style={{ background: '#fff3e0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>📋 {selectedFile?.split(/[\\/]/).pop()}</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Configure how to read this Excel file
        </p>
      </div>

      <h3 style={{ marginTop: 0 }}>Excel Parsing Options</h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Excel files can have different structures. Configure where your data actually starts and ends.
      </p>

      <div className="form-group">
        <label>
          <strong>Header Row Number</strong>
          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>
            Which row contains the column headers?
          </span>
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={headerRow}
          onChange={(e) => onStateChange({ headerRow: parseInt(e.target.value) || 1 })}
          placeholder="1"
          style={{ maxWidth: '120px' }}
        />
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#999' }}>
          <strong>Examples:</strong>
          <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
            <li>Row 1 = Headers in first row (default)</li>
            <li>Row 2 = Skip title, headers in second row</li>
            <li>Row 3 = Skip title and blank row, headers in third row</li>
          </ul>
        </div>
      </div>

      <div className="form-group">
        <label>
          <strong>Skip Bottom Rows</strong>
          <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>
            How many rows at the bottom to skip (totals, footers)?
          </span>
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={skipBottomRows}
          onChange={(e) => onStateChange({ skipBottomRows: parseInt(e.target.value) || 0 })}
          placeholder="0"
          style={{ maxWidth: '120px' }}
        />
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#999' }}>
          <strong>Examples:</strong>
          <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
            <li>0 = Include all rows (default)</li>
            <li>1 = Skip last row (e.g., "Total: 1,234")</li>
            <li>2 = Skip last 2 rows (e.g., subtotals + grand total)</li>
          </ul>
        </div>
      </div>

      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginTop: '24px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>📊 Preview Configuration</h4>
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
          <strong>Reading from:</strong> Row {headerRow} (headers) → Row {headerRow + 1} (data starts)<br />
          <strong>Excluding:</strong> {skipBottomRows === 0 ? 'No rows' : `Last ${skipBottomRows} row${skipBottomRows > 1 ? 's' : ''}`}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
