import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faFolderOpen,
  faPlus,
  faSync,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { UserTable } from '../../hooks/useUserData';

export interface SyncSourceItem {
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  fileCount: number;
  excelFileCount: number;
  lastModified: Date;
  size: number;
  metadata?: Record<string, string>;
}

export interface SyncFileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: Date;
}

interface SourceFileSyncWizardProps {
  title: string;
  sourceLabel: string;
  sourceEmptyTitle: string;
  sourceEmptyMessage: string;
  sourceIcon: IconDefinition;
  scriptNameLabel: string;
  loadSources: () => Promise<SyncSourceItem[]>;
  loadFiles: (source: SyncSourceItem) => Promise<SyncFileItem[]>;
  userTables: UserTable[];
  onClose: () => void;
  onStart: (params: {
    mode: 'import' | 'upload';
    selectedSource: SyncSourceItem;
    selectedFile: SyncFileItem;
    targetTable?: UserTable;
  }) => void;
  initialSourcePath?: string;
  initialFilePath?: string;
}

type Step = 'source-selection' | 'file-selection' | 'mode-selection' | 'existing-table-selection';

export const SourceFileSyncWizard: React.FC<SourceFileSyncWizardProps> = ({
  title,
  sourceLabel,
  sourceEmptyTitle,
  sourceEmptyMessage,
  sourceIcon,
  scriptNameLabel,
  loadSources,
  loadFiles,
  userTables,
  onClose,
  onStart,
  initialSourcePath,
  initialFilePath,
}) => {
  const [step, setStep] = useState<Step>('source-selection');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SyncSourceItem[]>([]);
  const [files, setFiles] = useState<SyncFileItem[]>([]);
  const [selectedSource, setSelectedSource] = useState<SyncSourceItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<SyncFileItem | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()),
    [sources]
  );

  const loadAllSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSources = await loadSources();
      setSources(loadedSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${sourceLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSourceFiles = async (source: SyncSourceItem) => {
    try {
      setLoading(true);
      setError(null);
      const loadedFiles = await loadFiles(source);
      setFiles(loadedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSources();
  }, []);

  useEffect(() => {
    const autoSelect = async () => {
      if (!initialSourcePath || sources.length === 0) return;
      const match = sources.find((source) => source.path === initialSourcePath);
      if (!match) return;
      setSelectedSource(match);
      await loadSourceFiles(match);
      setStep('file-selection');
    };
    autoSelect();
  }, [initialSourcePath, sources]);

  useEffect(() => {
    if (!initialFilePath || files.length === 0 || !selectedSource) return;
    const match = files.find((file) => file.path === initialFilePath);
    if (!match) return;
    setSelectedFile(match);
    setStep('mode-selection');
  }, [initialFilePath, files, selectedSource]);

  const handleSourceSelect = async (source: SyncSourceItem) => {
    setSelectedSource(source);
    await loadSourceFiles(source);
    setStep('file-selection');
  };

  const handleFileSelect = (file: SyncFileItem) => {
    setSelectedFile(file);
    setStep('mode-selection');
  };

  const handleBack = () => {
    if (step === 'file-selection') {
      setSelectedSource(null);
      setFiles([]);
      setStep('source-selection');
      return;
    }
    if (step === 'mode-selection') {
      setSelectedFile(null);
      setStep('file-selection');
      return;
    }
    if (step === 'existing-table-selection') {
      setStep('mode-selection');
    }
  };

  const launchWizard = (mode: 'import' | 'upload', targetTable?: UserTable) => {
    if (!selectedSource || !selectedFile) return;
    onStart({
      mode,
      selectedSource,
      selectedFile,
      targetTable,
    });
  };

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog desktop-sync-wizard-dialog source-sync-wizard-dialog">
        <div className="import-wizard-header">
          <h2><FontAwesomeIcon icon={sourceIcon} /> {title}</h2>
          <button className="btn-icon" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="import-wizard-steps desktop-sync-wizard-steps">
          <div className={`import-wizard-step ${step === 'source-selection' ? 'active' : 'completed'}`}>
            <div className="import-wizard-step-number">1</div>
            <div className="import-wizard-step-label">Select {sourceLabel}</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div
            className={`import-wizard-step ${
              step === 'file-selection'
                ? 'active'
                : step === 'mode-selection' || step === 'existing-table-selection'
                  ? 'completed'
                  : ''
            }`}
          >
            <div className="import-wizard-step-number">2</div>
            <div className="import-wizard-step-label">Select File</div>
          </div>
          <div className="import-wizard-step-separator" />
          <div className={`import-wizard-step ${step === 'mode-selection' || step === 'existing-table-selection' ? 'active' : ''}`}>
            <div className="import-wizard-step-number">3</div>
            <div className="import-wizard-step-label">Import Mode</div>
          </div>
        </div>

        <div className="import-wizard-body">
          {error && <div className="error-message desktop-sync-inline-error">{error}</div>}

          {step === 'source-selection' && (
            <div>
              {loading ? (
                <div className="progress-section">
                  <div className="progress-spinner"></div>
                  <p>Loading {sourceLabel.toLowerCase()}...</p>
                </div>
              ) : sortedSources.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><FontAwesomeIcon icon={sourceIcon} /></div>
                  <h3>{sourceEmptyTitle}</h3>
                  <p>{sourceEmptyMessage}</p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {sortedSources.map((source) => (
                    <div
                      key={source.id}
                      className="desktop-sync-select-card"
                      onClick={() => handleSourceSelect(source)}
                    >
                      <div className="desktop-sync-select-row">
                        <div className="desktop-sync-select-icon"><FontAwesomeIcon icon={sourceIcon} /></div>
                        <div className="desktop-sync-select-info">
                          <h4 className="desktop-sync-select-title">{source.title}</h4>
                          <p className="desktop-sync-select-subtitle">
                            {scriptNameLabel}: {source.subtitle || source.path}
                          </p>
                          <div className="desktop-sync-select-meta">
                            <span><FontAwesomeIcon icon={faFolderOpen} /> {source.excelFileCount} Excel/CSV files</span>
                            <span><FontAwesomeIcon icon={faFolderOpen} /> {source.fileCount} total files</span>
                            <span>{formatFileSize(source.size)}</span>
                            <span>{new Date(source.lastModified).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'file-selection' && selectedSource && (
            <div>
              {loading ? (
                <div className="progress-section">
                  <div className="progress-spinner"></div>
                  <p>Loading files...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><FontAwesomeIcon icon={faFolderOpen} /></div>
                  <h3>No Excel/CSV Files Found</h3>
                  <p>This source has no Excel or CSV files.</p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="desktop-sync-select-card"
                      onClick={() => handleFileSelect(file)}
                    >
                      <div className="desktop-sync-select-row">
                        <div className="desktop-sync-select-icon"><FontAwesomeIcon icon={faSync} /></div>
                        <div className="desktop-sync-select-info">
                          <h4 className="desktop-sync-select-title">{file.name}</h4>
                          <div className="desktop-sync-select-meta">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{new Date(file.modified).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'mode-selection' && selectedFile && (
            <div>
              <h3 style={{ marginTop: 0 }}>Choose Import Mode</h3>
              <p style={{ color: '#666', marginBottom: '24px' }}>
                File: <strong>{selectedFile.name}</strong>
              </p>
              <div className="desktop-sync-mode-grid">
                <div className="desktop-sync-mode-card" onClick={() => launchWizard('import')}>
                  <div className="desktop-sync-mode-icon"><FontAwesomeIcon icon={faPlus} /></div>
                  <h4 className="desktop-sync-mode-title">Create New Table</h4>
                  <p className="desktop-sync-mode-desc">Import this file as a new database table.</p>
                </div>

                <div className="desktop-sync-mode-card" onClick={() => setStep('existing-table-selection')}>
                  <div className="desktop-sync-mode-icon"><FontAwesomeIcon icon={faSync} /></div>
                  <h4 className="desktop-sync-mode-title">Sync to Existing Table</h4>
                  <p className="desktop-sync-mode-desc">Upload data to an existing table.</p>
                </div>
              </div>
            </div>
          )}

          {step === 'existing-table-selection' && (
            <div>
              <h3 style={{ marginTop: 0 }}>Select Existing Table</h3>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Choose a target table for <strong>{selectedFile?.name}</strong>.
              </p>
              {userTables.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><FontAwesomeIcon icon={faSync} /></div>
                  <h3>No tables available</h3>
                  <p>Create a new table instead.</p>
                </div>
              ) : (
                <div className="browser-downloads-list">
                  {userTables.map((table) => (
                    <div
                      key={table.id}
                      className="desktop-sync-select-card"
                      onClick={() => launchWizard('upload', table)}
                    >
                      <div className="desktop-sync-select-row">
                        <div className="desktop-sync-select-icon"><FontAwesomeIcon icon={faSync} /></div>
                        <div className="desktop-sync-select-info">
                          <h4 className="desktop-sync-select-title">{table.displayName}</h4>
                          <p className="desktop-sync-select-subtitle">{table.tableName}</p>
                          <div className="desktop-sync-select-meta">
                            <span>{table.rowCount.toLocaleString()} rows</span>
                            <span>{table.columnCount} columns</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="import-wizard-footer">
          {step === 'source-selection' ? (
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          ) : (
            <button className="btn btn-secondary" onClick={handleBack}>
              <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
