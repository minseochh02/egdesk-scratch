import React from 'react';
import { BaseStepProps } from '../types';

interface FileSelectionStepProps extends BaseStepProps {
  onFileSelect: () => void;
}

/**
 * FileSelectionStep - File selection interface
 * 90% duplicate code elimination from ImportWizard and ExcelUploadDialog
 * Mode-aware: Shows target table context for upload mode
 */
export const FileSelectionStep: React.FC<FileSelectionStepProps> = ({
  mode,
  targetTable,
  wizardState,
  error,
  onFileSelect,
}) => {
  const { selectedFile, parsedData } = wizardState;

  return (
    <div>
      {mode === 'upload' && targetTable && (
        <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 4px 0' }}>Uploading to: {targetTable.displayName}</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Table: {targetTable.tableName} • {targetTable.columnCount} columns
          </p>
        </div>
      )}

      <div
        className="file-selection-zone"
        onClick={onFileSelect}
      >
        <div className="file-selection-icon">📁</div>
        <h3>Select an Excel or CSV File</h3>
        <p>Click to browse for .xlsx, .xls, .xlsm, or .csv files</p>
      </div>

      {selectedFile && parsedData && (
        <div className="selected-file-info">
          <strong>📄 Selected File:</strong> {selectedFile}
          <br />
          <strong>📊 Sheets Found:</strong> {parsedData.sheets.length}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
