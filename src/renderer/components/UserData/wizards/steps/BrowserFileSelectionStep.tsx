import React from 'react';
import { BaseStepProps } from '../types';

interface BrowserFileSelectionStepProps extends BaseStepProps {
  onFileSelect: (file: any) => void;
}

/**
 * BrowserFileSelectionStep - Select Excel file from browser automation folder (browser-sync only)
 */
export const BrowserFileSelectionStep: React.FC<BrowserFileSelectionStepProps> = ({
  wizardState,
  error,
  onFileSelect,
}) => {
  const { downloadFiles, selectedFolder, loadingBrowserFiles } = wizardState;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loadingBrowserFiles) {
    return (
      <div className="progress-section">
        <div className="progress-spinner"></div>
        <p className="progress-message">Loading folder files...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 4px 0' }}>🤖 {selectedFolder?.scriptName}</h4>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Select an Excel file from this automation's downloads
        </p>
      </div>

      {downloadFiles.length === 0 ? (
        <div className="file-selection-zone" style={{ cursor: 'default' }}>
          <div className="file-selection-icon">📭</div>
          <h3>No Excel files in this folder</h3>
          <p>This folder doesn't contain any Excel files yet</p>
        </div>
      ) : (
        <div className="browser-downloads-list">
          {downloadFiles.map((file, idx) => (
            <div
              key={idx}
              className="browser-download-file-card"
              onClick={() => onFileSelect(file)}
            >
              <div className="browser-download-file-icon">📄</div>
              <div className="browser-download-file-info">
                <div className="browser-download-file-name">{file.name}</div>
                <div className="browser-download-file-meta">
                  {formatFileSize(file.size)} • {new Date(file.modified).toLocaleString()}
                </div>
              </div>
              <div className="browser-download-file-action">Select →</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
