import React from 'react';
import { BaseStepProps, ImportMode } from '../types';

interface ImportModeSelectionStepProps extends BaseStepProps {
  onModeSelect: (mode: ImportMode) => void;
}

/**
 * ImportModeSelectionStep - Choose between creating new table or syncing to existing (browser-sync only)
 */
export const ImportModeSelectionStep: React.FC<ImportModeSelectionStepProps> = ({
  wizardState,
  error,
  onModeSelect,
}) => {
  const { selectedBrowserFile } = wizardState;

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Choose Import Mode</h3>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Selected file: <strong>{selectedBrowserFile?.name}</strong>
      </p>

      <div className="import-mode-selection">
        <div
          className="import-mode-card"
          onClick={() => onModeSelect('create-new')}
        >
          <div className="import-mode-icon">✨</div>
          <h4>Create New Table</h4>
          <p>Create a new database table from this Excel file</p>
          <ul style={{ textAlign: 'left', fontSize: '13px', color: '#666', paddingLeft: '20px' }}>
            <li>Map Excel columns to new table columns</li>
            <li>Merge multiple columns if needed</li>
            <li>Auto-detect data types</li>
          </ul>
        </div>

        <div
          className="import-mode-card"
          onClick={() => onModeSelect('sync-existing')}
        >
          <div className="import-mode-icon">🔄</div>
          <h4>Sync to Existing Table</h4>
          <p>Append this data to an existing database table</p>
          <ul style={{ textAlign: 'left', fontSize: '13px', color: '#666', paddingLeft: '20px' }}>
            <li>Select an existing table</li>
            <li>Map Excel columns to table columns</li>
            <li>Data will be appended to the table</li>
          </ul>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
