import React, { useEffect } from 'react';
import { BaseStepProps } from '../types';

interface BrowserFolderSelectionStepProps extends BaseStepProps {
  onFolderSelect: (folder: any) => void;
  onRefresh: () => void;
}

/**
 * BrowserFolderSelectionStep - Select browser automation folder (browser-sync only)
 */
export const BrowserFolderSelectionStep: React.FC<BrowserFolderSelectionStepProps> = ({
  wizardState,
  error,
  onFolderSelect,
  onRefresh,
}) => {
  const { downloadFolders, loadingBrowserFiles } = wizardState;

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
        <p className="progress-message">Loading browser automation folders...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0' }}>🤖 Browser Automation Scripts</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Select a browser automation to import its downloaded Excel files
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="btn btn-sm btn-secondary"
        >
          🔄 Refresh
        </button>
      </div>

      {downloadFolders.length === 0 ? (
        <div className="file-selection-zone" style={{ cursor: 'default' }}>
          <div className="file-selection-icon">📭</div>
          <h3>No browser automations found</h3>
          <p>Browser Recorder hasn't downloaded any files yet</p>
          <p style={{ fontSize: '13px', color: '#999' }}>
            Run a browser automation that downloads files to get started
          </p>
        </div>
      ) : (
        <div className="browser-downloads-list">
          {downloadFolders.map((folder, idx) => (
            <div
              key={idx}
              className="browser-download-folder-card"
              onClick={() => onFolderSelect(folder)}
            >
              <div className="browser-download-folder-icon">🤖</div>
              <div className="browser-download-folder-info">
                <div className="browser-download-folder-name">{folder.scriptName}</div>
                <div className="browser-download-folder-meta">
                  {folder.excelFileCount} Excel file{folder.excelFileCount !== 1 ? 's' : ''} •
                  {folder.fileCount} total file{folder.fileCount !== 1 ? 's' : ''} •
                  {formatFileSize(folder.size)}
                </div>
                <div className="browser-download-folder-timestamp">
                  Last modified: {new Date(folder.lastModified).toLocaleString()}
                </div>
              </div>
              <div className="browser-download-folder-action">Connect →</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
