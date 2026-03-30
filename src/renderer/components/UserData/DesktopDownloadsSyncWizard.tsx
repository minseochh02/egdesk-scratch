/**
 * DesktopDownloadsSyncWizard
 *
 * Wizard for setting up auto-sync for desktop recorder downloads.
 * Mirrors the BrowserDownloadsSyncWizard flow but for desktop recordings.
 */

import React, { useState, useEffect } from 'react';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';
import { UserTable } from '../../hooks/useUserData';

interface DesktopRecordingFolder {
  scriptName: string;
  folderName: string;
  path: string;
  fileCount: number;
  excelFileCount: number;
  lastModified: Date;
  size: number;
}

interface DesktopDownloadFile {
  name: string;
  path: string;
  scriptFolder: string;
  size: number;
  modified: Date;
}

interface DesktopDownloadsSyncWizardProps {
  onClose: () => void;
  userTables: UserTable[];
  initialFolder?: string; // Optional: pre-select a folder
}

type DesktopStep = 'folder-selection' | 'file-selection' | 'import-mode';

export const DesktopDownloadsSyncWizard: React.FC<DesktopDownloadsSyncWizardProps> = ({
  onClose,
  userTables,
  initialFolder,
}) => {
  const [desktopStep, setDesktopStep] = useState<DesktopStep>('folder-selection');
  const [folders, setFolders] = useState<DesktopRecordingFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DesktopRecordingFolder | null>(null);
  const [files, setFiles] = useState<DesktopDownloadFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DesktopDownloadFile | null>(null);
  const [importMode, setImportMode] = useState<'import' | 'upload'>('import');
  const [targetTable, setTargetTable] = useState<UserTable | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDesktopRecordingFolders();
  }, []);

  const loadDesktopRecordingFolders = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await (window as any).electron.invoke('desktop-recorder:get-download-folders');

      if (result.success) {
        setFolders(result.folders || []);

        // If initialFolder provided, auto-select it
        if (initialFolder) {
          const folder = result.folders.find((f: DesktopRecordingFolder) => f.path === initialFolder);
          if (folder) {
            handleFolderSelect(folder);
          }
        }
      } else {
        setError(result.error || 'Failed to load desktop recording folders');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load desktop recording folders');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = async (folder: DesktopRecordingFolder) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedFolder(folder);

      const result = await (window as any).electron.invoke('desktop-recorder:get-folder-files', {
        folderPath: folder.path,
      });

      if (result.success) {
        const excelFiles = (result.files || []).filter((f: DesktopDownloadFile) =>
          /\.(xlsx|xls|xlsm|csv)$/i.test(f.name)
        );
        setFiles(excelFiles);
        setDesktopStep('file-selection');
      } else {
        setError(result.error || 'Failed to load files');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: DesktopDownloadFile) => {
    setSelectedFile(file);
    setDesktopStep('import-mode');
  };

  const handleImportModeSelect = (mode: 'import' | 'upload', table?: UserTable) => {
    setImportMode(mode);
    setTargetTable(table);
    // Wizard will open automatically when importMode is set
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  // If file selected and import mode chosen, show Excel wizard
  if (selectedFile && selectedFolder && (importMode === 'import' || (importMode === 'upload' && targetTable))) {
    return (
      <ExcelDataWizard
        mode={importMode}
        isBrowserSync={true} // Use same flag for desktop sync
        scriptFolderPath={selectedFolder.path}
        scriptName={selectedFolder.scriptName}
        folderName={selectedFolder.folderName}
        preSelectedFile={selectedFile.path}
        targetTable={targetTable}
        onClose={onClose}
        onComplete={onClose}
      />
    );
  }

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog" style={{ maxWidth: '800px' }}>
        {/* Header */}
        <div className="import-wizard-header">
          <h2>🖥️ Sync Desktop Downloads</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="import-wizard-body">
          {error && (
            <div className="error-message" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Step 1: Folder Selection */}
          {desktopStep === 'folder-selection' && (
            <div>
              <div className="step-header" style={{ marginBottom: '20px' }}>
                <h3>Step 1: Select Desktop Recording</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Choose a desktop recording folder that contains downloaded Excel/CSV files
                </p>
              </div>

              {loading ? (
                <div className="progress-section">
                  <div className="progress-spinner"></div>
                  <p>Loading desktop recordings...</p>
                </div>
              ) : folders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🖥️</div>
                  <h3>No Desktop Recordings Found</h3>
                  <p>
                    Desktop recordings with downloads will appear here. Record a desktop session with file downloads to get started.
                  </p>
                </div>
              ) : (
                <div className="folder-list">
                  {folders.map((folder) => (
                    <div
                      key={folder.path}
                      className="folder-card"
                      onClick={() => handleFolderSelect(folder)}
                      style={{
                        padding: '16px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#4a90e2';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ fontSize: '32px' }}>🖥️</div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                            {folder.scriptName}
                          </h4>
                          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
                            {folder.folderName}
                          </p>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                            <span>📥 {folder.excelFileCount} Excel/CSV files</span>
                            <span>📁 {folder.fileCount} total files</span>
                            <span>💾 {formatFileSize(folder.size)}</span>
                            <span>🕐 {formatDate(folder.lastModified)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: File Selection */}
          {desktopStep === 'file-selection' && selectedFolder && (
            <div>
              <div className="step-header" style={{ marginBottom: '20px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDesktopStep('folder-selection');
                    setSelectedFolder(null);
                    setFiles([]);
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  ← Back to Folder Selection
                </button>
                <h3>Step 2: Select Excel/CSV File</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  From: {selectedFolder.scriptName}
                </p>
              </div>

              {files.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📄</div>
                  <h3>No Excel/CSV Files Found</h3>
                  <p>This recording folder doesn't contain any Excel or CSV files.</p>
                </div>
              ) : (
                <div className="file-list">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className="file-card"
                      onClick={() => handleFileSelect(file)}
                      style={{
                        padding: '16px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#4a90e2';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '32px' }}>📊</div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600 }}>
                            {file.name}
                          </h4>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                            <span>💾 {formatFileSize(file.size)}</span>
                            <span>🕐 {formatDate(file.modified)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Import Mode Selection */}
          {desktopStep === 'import-mode' && selectedFile && (
            <div>
              <div className="step-header" style={{ marginBottom: '20px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDesktopStep('file-selection');
                    setSelectedFile(null);
                  }}
                  style={{ marginBottom: '12px' }}
                >
                  ← Back to File Selection
                </button>
                <h3>Step 3: Choose Import Mode</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  File: {selectedFile.name}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Create New Table */}
                <div
                  className="mode-card"
                  onClick={() => handleImportModeSelect('import')}
                  style={{
                    padding: '24px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#4a90e2';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>➕</div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                    Create New Table
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                    Import this file as a new database table
                  </p>
                </div>

                {/* Sync to Existing Table */}
                <div
                  className="mode-card"
                  onClick={() => {
                    // Show table selector
                    const table = prompt('Enter target table ID (temporary - will add UI):');
                    if (table) {
                      const selectedTable = userTables.find(t => t.id === table || t.displayName === table);
                      handleImportModeSelect('upload', selectedTable);
                    }
                  }}
                  style={{
                    padding: '24px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#4a90e2';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                    Sync to Existing Table
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                    Upload data to an existing table
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="import-wizard-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
