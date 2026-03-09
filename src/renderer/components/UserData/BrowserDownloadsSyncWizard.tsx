import React, { useState, useEffect } from 'react';
import { UserTable, useUserData } from '../../hooks/useUserData';
import { ExcelDataWizard } from './wizards/ExcelDataWizard';

interface BrowserDownloadsSyncWizardProps {
  onClose: () => void;
  onComplete: () => void;
  editingConfig?: any; // Sync configuration being edited
}

type Phase = 'browser-select' | 'excel-wizard';
type BrowserStep = 'folder-selection' | 'file-selection' | 'import-mode' | 'existing-table-selection';

interface BrowserDownloadFolder {
  scriptName: string;
  folderName: string;
  path: string;
  fileCount: number;
  excelFileCount: number;
  lastModified: Date;
  size: number;
}

interface BrowserDownloadFile {
  name: string;
  path: string;
  scriptFolder: string;
  size: number;
  modified: Date;
}

/**
 * BrowserDownloadsSyncWizard - Orchestrator that handles browser-specific steps
 * then delegates to ExcelDataWizard
 */
export const BrowserDownloadsSyncWizard: React.FC<BrowserDownloadsSyncWizardProps> = ({ onClose, onComplete, editingConfig }) => {
  const { tables } = useUserData();

  // If editing an existing config, start directly in excel-wizard phase
  const [phase, setPhase] = useState<Phase>(editingConfig ? 'excel-wizard' : 'browser-select');
  const [browserStep, setBrowserStep] = useState<BrowserStep>('folder-selection');

  // Browser-specific state
  const [downloadFolders, setDownloadFolders] = useState<BrowserDownloadFolder[]>([]);
  const [downloadFiles, setDownloadFiles] = useState<BrowserDownloadFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<BrowserDownloadFolder | null>(
    editingConfig ? {
      scriptName: editingConfig.scriptName,
      folderName: editingConfig.folderName,
      path: editingConfig.scriptFolderPath,
      fileCount: 0,
      excelFileCount: 0,
      lastModified: new Date(),
      size: 0,
    } : null
  );
  const [selectedFile, setSelectedFile] = useState<BrowserDownloadFile | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(!editingConfig);
  const [error, setError] = useState<string | null>(null);

  // Import configuration
  const [importMode, setImportMode] = useState<'import' | 'upload' | null>(editingConfig ? 'upload' : null);
  const [targetTable, setTargetTable] = useState<UserTable | null>(() => {
    if (editingConfig) {
      return tables.find(t => t.id === editingConfig.targetTableId) || null;
    }
    return null;
  });

  useEffect(() => {
    // Only load folders if not in edit mode
    if (!editingConfig) {
      loadBrowserDownloadFolders();
    }
  }, [editingConfig]);

  const loadBrowserDownloadFolders = async () => {
    try {
      setLoadingFiles(true);
      const result = await (window as any).electron.debug.getBrowserDownloadFolders();

      if (result.success) {
        setDownloadFolders(result.folders || []);
      } else {
        setError(result.error || 'Failed to load browser download folders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load browser download folders');
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadFolderFiles = async (folder: BrowserDownloadFolder) => {
    try {
      setLoadingFiles(true);
      const result = await (window as any).electron.debug.getFolderFiles(folder.path);

      if (result.success) {
        const excelFiles = result.files.filter((file: BrowserDownloadFile) =>
          /\.(xlsx?|xlsm|xls)$/i.test(file.name)
        );
        setDownloadFiles(excelFiles);
      } else {
        setError(result.error || 'Failed to load folder files');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFolderSelect = async (folder: BrowserDownloadFolder) => {
    setError(null);
    setSelectedFolder(folder);
    await loadFolderFiles(folder);
    setBrowserStep('file-selection');
  };

  const handleFileSelect = (file: BrowserDownloadFile) => {
    setError(null);
    setSelectedFile(file);
    setBrowserStep('import-mode');
  };

  const handleImportModeSelect = (mode: 'create-new' | 'sync-existing') => {
    setError(null);
    if (mode === 'create-new') {
      setImportMode('import');
      setPhase('excel-wizard');
    } else {
      setBrowserStep('existing-table-selection');
    }
  };

  const handleTableSelect = (table: UserTable) => {
    setTargetTable(table);
    setImportMode('upload');
    setPhase('excel-wizard');
  };

  const handleBack = () => {
    if (browserStep === 'file-selection') {
      setBrowserStep('folder-selection');
      setSelectedFolder(null);
      setDownloadFiles([]);
    } else if (browserStep === 'import-mode') {
      setBrowserStep('file-selection');
      setSelectedFile(null);
    } else if (browserStep === 'existing-table-selection') {
      setBrowserStep('import-mode');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Phase 2: Delegate to ExcelDataWizard
  if (phase === 'excel-wizard' && importMode && selectedFolder && (selectedFile || editingConfig)) {
    return (
      <ExcelDataWizard
        mode={importMode}
        preSelectedFile={selectedFile?.path}
        targetTable={targetTable || undefined}
        onClose={onClose}
        onComplete={onComplete}
        isBrowserSync={true}
        scriptFolderPath={selectedFolder.path}
        scriptName={selectedFolder.scriptName}
        folderName={selectedFolder.folderName}
        editingConfig={editingConfig}
      />
    );
  }

  // Phase 1: Browser-specific selection steps
  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog">
        <div className="import-wizard-header">
          <h2>🔄 Sync Browser Downloads to SQL</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="import-wizard-steps">
          <div className={`import-wizard-step ${browserStep === 'folder-selection' ? 'active' : 'completed'}`}>
            <div className="import-wizard-step-number">1</div>
            <div className="import-wizard-step-label">Select Automation</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div className={`import-wizard-step ${browserStep === 'file-selection' ? 'active' : browserStep === 'import-mode' || browserStep === 'existing-table-selection' ? 'completed' : ''}`}>
            <div className="import-wizard-step-number">2</div>
            <div className="import-wizard-step-label">Select File</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div className={`import-wizard-step ${browserStep === 'import-mode' || browserStep === 'existing-table-selection' ? 'active' : ''}`}>
            <div className="import-wizard-step-number">3</div>
            <div className="import-wizard-step-label">Configure Import</div>
          </div>
        </div>

        <div className="import-wizard-body">
          {browserStep === 'folder-selection' && (
            <div>
              {loadingFiles ? (
                <div className="progress-section">
                  <div className="progress-spinner"></div>
                  <p className="progress-message">Loading browser automation folders...</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0' }}>🤖 Browser Automation Scripts</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                        Select a browser automation to import its downloaded Excel files
                      </p>
                    </div>
                    <button onClick={loadBrowserDownloadFolders} className="btn btn-sm btn-secondary">
                      🔄 Refresh
                    </button>
                  </div>

                  {downloadFolders.length === 0 ? (
                    <div className="file-selection-zone" style={{ cursor: 'default' }}>
                      <div className="file-selection-icon">📭</div>
                      <h3>No browser automations found</h3>
                      <p>Browser Recorder hasn't downloaded any files yet</p>
                    </div>
                  ) : (
                    <div className="browser-downloads-list">
                      {downloadFolders.map((folder, idx) => (
                        <div
                          key={idx}
                          className="browser-download-folder-card"
                          onClick={() => handleFolderSelect(folder)}
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
                </>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
          )}

          {browserStep === 'file-selection' && (
            <div>
              {loadingFiles ? (
                <div className="progress-section">
                  <div className="progress-spinner"></div>
                  <p className="progress-message">Loading folder files...</p>
                </div>
              ) : (
                <>
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
                          onClick={() => handleFileSelect(file)}
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
                </>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
          )}

          {browserStep === 'import-mode' && (
            <div>
              <h3 style={{ marginTop: 0 }}>Choose Import Mode</h3>
              <p style={{ color: '#666', marginBottom: '24px' }}>
                Selected file: <strong>{selectedFile?.name}</strong>
              </p>

              <div className="import-mode-selection">
                <div className="import-mode-card" onClick={() => handleImportModeSelect('create-new')}>
                  <div className="import-mode-icon">✨</div>
                  <h4>Create New Table</h4>
                  <p>Create a new database table from this Excel file</p>
                  <ul style={{ textAlign: 'left', fontSize: '13px', color: '#666', paddingLeft: '20px' }}>
                    <li>Map Excel columns to new table columns</li>
                    <li>Merge multiple columns if needed</li>
                    <li>Auto-detect data types</li>
                  </ul>
                </div>

                <div className="import-mode-card" onClick={() => handleImportModeSelect('sync-existing')}>
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
          )}

          {browserStep === 'existing-table-selection' && (
            <div>
              <h3 style={{ marginTop: 0 }}>Select Existing Table</h3>
              <p style={{ color: '#666', marginBottom: '24px' }}>
                Choose which table to sync <strong>{selectedFile?.name}</strong> to
              </p>

              {tables.length === 0 ? (
                <div className="file-selection-zone" style={{ cursor: 'default' }}>
                  <div className="file-selection-icon">📭</div>
                  <h3>No tables available</h3>
                  <p>Create a new table instead</p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className="browser-download-folder-card"
                      onClick={() => handleTableSelect(table)}
                    >
                      <div className="browser-download-folder-icon">🗂️</div>
                      <div className="browser-download-folder-info">
                        <div className="browser-download-folder-name">{table.displayName}</div>
                        <div className="browser-download-folder-meta">
                          {table.tableName} • {table.rowCount} rows • {table.columnCount} columns
                        </div>
                      </div>
                      <div className="browser-download-folder-action">Select →</div>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="error-message">{error}</div>}
            </div>
          )}
        </div>

        <div className="import-wizard-footer">
          {browserStep !== 'folder-selection' && (
            <button className="btn btn-secondary" onClick={handleBack}>
              ⬅️ Back
            </button>
          )}
          {browserStep === 'folder-selection' && (
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
