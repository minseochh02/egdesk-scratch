/**
 * DesktopDownloadsSyncWizard
 *
 * Wizard for setting up auto-sync for desktop recorder downloads.
 * Mirrors the BrowserDownloadsSyncWizard flow but for desktop recordings.
 */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faDesktop, faFileExcel, faFolderOpen, faPlus, faSync, faTable, faTimes } from '@fortawesome/free-solid-svg-icons';
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
      <div className="import-wizard-dialog desktop-sync-wizard-dialog">
        {/* Header */}
        <div className="import-wizard-header">
          <h2><FontAwesomeIcon icon={faDesktop} /> Sync Desktop Downloads</h2>
          <button className="btn-icon" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="import-wizard-steps desktop-sync-wizard-steps">
          <div className={`import-wizard-step ${desktopStep === 'folder-selection' ? 'active' : 'completed'}`}>
            <div className="import-wizard-step-number">1</div>
            <div className="import-wizard-step-label">Select Recording</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div className={`import-wizard-step ${desktopStep === 'file-selection' ? 'active' : desktopStep === 'import-mode' ? 'completed' : ''}`}>
            <div className="import-wizard-step-number">2</div>
            <div className="import-wizard-step-label">Select File</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div className={`import-wizard-step ${desktopStep === 'import-mode' ? 'active' : ''}`}>
            <div className="import-wizard-step-number">3</div>
            <div className="import-wizard-step-label">Import Mode</div>
          </div>
        </div>

        {/* Body */}
        <div className="import-wizard-body">
          {error && (
            <div className="error-message desktop-sync-inline-error">
              {error}
            </div>
          )}

          {/* Step 1: Folder Selection */}
          {desktopStep === 'folder-selection' && (
            <div>
              <div className="desktop-sync-step-header">
                <h3>Step 1: Select Desktop Recording</h3>
                <p className="desktop-sync-step-subtitle">
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
                  <div className="empty-state-icon"><FontAwesomeIcon icon={faDesktop} /></div>
                  <h3>No Desktop Recordings Found</h3>
                  <p>
                    Desktop recordings with downloads will appear here. Record a desktop session with file downloads to get started.
                  </p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {folders.map((folder) => (
                    <div
                      key={folder.path}
                      className="desktop-sync-select-card"
                      onClick={() => handleFolderSelect(folder)}
                    >
                      <div className="desktop-sync-select-row">
                        <div className="desktop-sync-select-icon"><FontAwesomeIcon icon={faDesktop} /></div>
                        <div className="desktop-sync-select-info">
                          <h4 className="desktop-sync-select-title">
                            {folder.scriptName}
                          </h4>
                          <p className="desktop-sync-select-subtitle">
                            {folder.folderName}
                          </p>
                          <div className="desktop-sync-select-meta">
                            <span><FontAwesomeIcon icon={faFileExcel} /> {folder.excelFileCount} Excel/CSV files</span>
                            <span><FontAwesomeIcon icon={faFolderOpen} /> {folder.fileCount} total files</span>
                            <span>{formatFileSize(folder.size)}</span>
                            <span>{formatDate(folder.lastModified)}</span>
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
              <div className="desktop-sync-step-header">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDesktopStep('folder-selection');
                    setSelectedFolder(null);
                    setFiles([]);
                  }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> Back to Folder Selection
                </button>
                <h3>Step 2: Select Excel/CSV File</h3>
                <p className="desktop-sync-step-subtitle">
                  From: {selectedFolder.scriptName}
                </p>
              </div>

              {files.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><FontAwesomeIcon icon={faFileExcel} /></div>
                  <h3>No Excel/CSV Files Found</h3>
                  <p>This recording folder doesn't contain any Excel or CSV files.</p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className="desktop-sync-select-card"
                      onClick={() => handleFileSelect(file)}
                    >
                      <div className="desktop-sync-select-row">
                        <div className="desktop-sync-select-icon"><FontAwesomeIcon icon={faTable} /></div>
                        <div className="desktop-sync-select-info">
                          <h4 className="desktop-sync-select-title">
                            {file.name}
                          </h4>
                          <div className="desktop-sync-select-meta">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modified)}</span>
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
              <div className="desktop-sync-step-header">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setDesktopStep('file-selection');
                    setSelectedFile(null);
                  }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> Back to File Selection
                </button>
                <h3>Step 3: Choose Import Mode</h3>
                <p className="desktop-sync-step-subtitle">
                  File: {selectedFile.name}
                </p>
              </div>

              <div className="desktop-sync-mode-grid">
                {/* Create New Table */}
                <div
                  className="desktop-sync-mode-card"
                  onClick={() => handleImportModeSelect('import')}
                >
                  <div className="desktop-sync-mode-icon"><FontAwesomeIcon icon={faPlus} /></div>
                  <h4 className="desktop-sync-mode-title">
                    Create New Table
                  </h4>
                  <p className="desktop-sync-mode-desc">
                    Import this file as a new database table
                  </p>
                </div>

                {/* Sync to Existing Table */}
                <div
                  className="desktop-sync-mode-card"
                  onClick={() => {
                    // Show table selector
                    const table = prompt('Enter target table ID (temporary - will add UI):');
                    if (table) {
                      const selectedTable = userTables.find(t => t.id === table || t.displayName === table);
                      handleImportModeSelect('upload', selectedTable);
                    }
                  }}
                >
                  <div className="desktop-sync-mode-icon"><FontAwesomeIcon icon={faSync} /></div>
                  <h4 className="desktop-sync-mode-title">
                    Sync to Existing Table
                  </h4>
                  <p className="desktop-sync-mode-desc">
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
