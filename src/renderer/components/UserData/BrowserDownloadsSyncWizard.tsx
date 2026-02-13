import React, { useState, useEffect } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';
import { VisualColumnMapper } from './VisualColumnMapper';
import { ExistingTableMapper } from './ExistingTableMapper';
import { DuplicateDetectionSettings } from './DuplicateDetectionSettings';

interface BrowserDownloadsSyncWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'folder-selection' | 'file-selection' | 'parse-config' | 'import-mode' | 'column-mapping' | 'existing-table-mapping' | 'duplicate-detection' | 'preview' | 'importing' | 'complete';
type ImportMode = 'create-new' | 'sync-existing' | null;

interface BrowserDownloadFolder {
  scriptName: string; // Human-readable script name
  folderName: string; // Actual folder name
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

export const BrowserDownloadsSyncWizard: React.FC<BrowserDownloadsSyncWizardProps> = ({ onClose, onComplete }) => {
  const { tables, parseExcel, importExcel, validateTableName, syncToExistingTable } = useUserData();

  const [currentStep, setCurrentStep] = useState<WizardStep>('folder-selection');
  const [downloadFolders, setDownloadFolders] = useState<BrowserDownloadFolder[]>([]);
  const [downloadFiles, setDownloadFiles] = useState<BrowserDownloadFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<BrowserDownloadFolder | null>(null);
  const [selectedFile, setSelectedFile] = useState<BrowserDownloadFile | null>(null);
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [skipBottomRows, setSkipBottomRows] = useState<number>(0);
  const [deleteAfterImport, setDeleteAfterImport] = useState<boolean>(false);
  const [archiveAfterImport, setArchiveAfterImport] = useState<boolean>(true);
  const [importMode, setImportMode] = useState<ImportMode>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [columnMappings, setColumnMappings] = useState<Record<string, string> | null>(null);
  const [mergeConfig, setMergeConfig] = useState<Record<string, { sources: string[]; separator: string }> | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [existingTableColumnMappings, setExistingTableColumnMappings] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    rowsImported: number;
    rowsSkipped: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [saveAsConfiguration, setSaveAsConfiguration] = useState<boolean>(true);
  const [enableAutoSync, setEnableAutoSync] = useState<boolean>(false);
  const [duplicateDetectionSettings, setDuplicateDetectionSettings] = useState<{
    uniqueKeyColumns: string[];
    duplicateAction: 'skip' | 'update' | 'allow';
  }>({
    uniqueKeyColumns: [],
    duplicateAction: 'skip',
  });

  useEffect(() => {
    loadBrowserDownloadFolders();
  }, []);

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
        // Filter only Excel files
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
    try {
      setError(null);
      setSelectedFolder(folder);
      
      // Check if a configuration already exists for this folder
      try {
        const existingConfig = await (window as any).electron.invoke('sync-config:get-by-folder', folder.path);
        if (existingConfig.data) {
          // Show a notification that a configuration exists
          setError(`ℹ️ A sync configuration already exists for "${folder.scriptName}". You can manage it in the Configurations page.`);
        }
      } catch (err) {
        console.warn('Error checking existing config:', err);
        // Continue anyway
      }
      
      await loadFolderFiles(folder);
      setCurrentStep('file-selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder files');
    }
  };

  const handleFileSelect = async (file: BrowserDownloadFile) => {
    try {
      setError(null);
      setSelectedFile(file);
      setCurrentStep('parse-config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const handleParseConfigComplete = async () => {
    try {
      setError(null);
      setLoadingFiles(true);

      // Parse the Excel file with configured options
      const parsed = await parseExcel(selectedFile!.path, {
        headerRow,
        skipBottomRows,
      });
      
      setParsedData(parsed);
      setTableName(parsed.suggestedTableName);
      setDisplayName(parsed.suggestedTableName.replace(/_/g, ' '));
      setSelectedSheet(0);

      setCurrentStep('import-mode');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleImportModeSelect = (mode: ImportMode) => {
    setImportMode(mode);
    
    if (mode === 'create-new') {
      setCurrentStep('column-mapping');
    } else if (mode === 'sync-existing') {
      setCurrentStep('existing-table-mapping');
    }
  };

  const handleColumnMappingComplete = (
    mappings: Record<string, string>,
    mergeConfiguration: Record<string, { sources: string[]; separator: string }>
  ) => {
    setColumnMappings(mappings);
    setMergeConfig(mergeConfiguration);
    setCurrentStep('duplicate-detection');
  };

  const handleExistingTableMappingComplete = (
    tableId: string,
    mappings: Record<string, string>
  ) => {
    setSelectedTableId(tableId);
    setExistingTableColumnMappings(mappings);
    setCurrentStep('duplicate-detection');
  };

  const handleBack = () => {
    if (currentStep === 'file-selection') {
      setCurrentStep('folder-selection');
      setSelectedFolder(null);
      setDownloadFiles([]);
    } else if (currentStep === 'parse-config') {
      setCurrentStep('file-selection');
      setSelectedFile(null);
    } else if (currentStep === 'import-mode') {
      setCurrentStep('parse-config');
      setParsedData(null);
      setImportMode(null);
    } else if (currentStep === 'column-mapping' || currentStep === 'existing-table-mapping') {
      setCurrentStep('import-mode');
      setColumnMappings(null);
      setExistingTableColumnMappings(null);
    } else if (currentStep === 'preview') {
      setCurrentStep('duplicate-detection');
    } else if (currentStep === 'duplicate-detection') {
      if (importMode === 'create-new') {
        setCurrentStep('column-mapping');
      } else {
        setCurrentStep('existing-table-mapping');
      }
    }
  };

  const handleNext = async () => {
    if (currentStep === 'preview') {
      try {
        setCurrentStep('importing');
        setIsImporting(true);
        setImportError(null);

        if (importMode === 'create-new') {
          // Validate inputs
          if (!tableName.trim() || !displayName.trim()) {
            throw new Error('Please enter table name and display name');
          }

          const validation = await validateTableName(tableName);
          if (!validation.available) {
            throw new Error(`Table name "${validation.sanitizedName}" is already in use.`);
          }

          const result = await importExcel({
            filePath: selectedFile!.path,
            sheetIndex: selectedSheet,
            tableName,
            displayName,
            description: description.trim() || undefined,
            columnMappings: columnMappings || undefined,
            mergeConfig: mergeConfig || undefined,
            headerRow,
            skipBottomRows,
            uniqueKeyColumns: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
              ? duplicateDetectionSettings.uniqueKeyColumns 
              : undefined,
            duplicateAction: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
              ? duplicateDetectionSettings.duplicateAction 
              : undefined,
          });

          setImportProgress({
            rowsImported: result.importOperation.rowsImported,
            rowsSkipped: result.importOperation.rowsSkipped,
          });
        } else if (importMode === 'sync-existing') {
          // Sync to existing table
          if (!selectedTableId || !existingTableColumnMappings) {
            throw new Error('Please select a table and map columns');
          }

          const result = await syncToExistingTable({
            filePath: selectedFile!.path,
            sheetIndex: selectedSheet,
            tableId: selectedTableId,
            columnMappings: existingTableColumnMappings,
            headerRow,
            skipBottomRows,
            uniqueKeyColumns: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
              ? duplicateDetectionSettings.uniqueKeyColumns 
              : undefined,
            duplicateAction: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
              ? duplicateDetectionSettings.duplicateAction 
              : undefined,
          });

          setImportProgress({
            rowsImported: result.rowsImported,
            rowsSkipped: result.rowsSkipped,
          });

          // Handle file after successful import
          if (deleteAfterImport) {
            await (window as any).electron.debug.deleteFile(selectedFile!.path);
          } else if (archiveAfterImport) {
            await (window as any).electron.debug.archiveFile(selectedFile!.path);
          }
        }

        // Save configuration if requested
        if (saveAsConfiguration && selectedFolder && (columnMappings || existingTableColumnMappings)) {
          try {
            const targetTableId = importMode === 'create-new' 
              ? result.table?.id 
              : selectedTableId;

            const mappings = importMode === 'create-new'
              ? columnMappings!
              : existingTableColumnMappings!;

            await (window as any).electron.invoke('sync-config:create', {
              scriptFolderPath: selectedFolder.path,
              scriptName: selectedFolder.scriptName,
              folderName: selectedFolder.folderName,
              targetTableId: targetTableId,
              headerRow,
              skipBottomRows,
              sheetIndex: selectedSheet,
              columnMappings: mappings,
              uniqueKeyColumns: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
                ? duplicateDetectionSettings.uniqueKeyColumns 
                : undefined,
              duplicateAction: duplicateDetectionSettings.uniqueKeyColumns.length > 0 
                ? duplicateDetectionSettings.duplicateAction 
                : undefined,
              fileAction: deleteAfterImport ? 'delete' : (archiveAfterImport ? 'archive' : 'keep'),
              autoSyncEnabled: enableAutoSync,
            });
          } catch (configError) {
            console.warn('Failed to save configuration:', configError);
            // Don't fail the import if configuration save fails
          }
        }

        setCurrentStep('complete');
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed');
        setCurrentStep('complete');
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleFinish = () => {
    onComplete();
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'folder-selection', label: 'Select Script' },
      { id: 'file-selection', label: 'Select File' },
      { id: 'parse-config', label: 'Configure' },
      { id: 'import-mode', label: 'Import Mode' },
      { id: 'mapping', label: 'Map Columns' },
      { id: 'preview', label: 'Preview' },
      { id: 'importing', label: 'Importing' },
      { id: 'complete', label: 'Complete' },
    ];

    const getCurrentStepIndex = () => {
      if (currentStep === 'folder-selection') return 0;
      if (currentStep === 'file-selection') return 1;
      if (currentStep === 'parse-config') return 2;
      if (currentStep === 'import-mode') return 3;
      if (currentStep === 'column-mapping' || currentStep === 'existing-table-mapping') return 4;
      if (currentStep === 'duplicate-detection') return 5;
      if (currentStep === 'preview') return 6;
      if (currentStep === 'importing') return 7;
      if (currentStep === 'complete') return 8;
      return 0;
    };

    const currentIndex = getCurrentStepIndex();

    return (
      <div className="import-wizard-steps">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className={`import-wizard-step ${
                index <= currentIndex ? (index === currentIndex ? 'active' : 'completed') : ''
              }`}
            >
              <div className="import-wizard-step-number">{index + 1}</div>
              <div className="import-wizard-step-label">{step.label}</div>
            </div>
            {index < steps.length - 1 && <div className="import-wizard-step-separator" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderFolderSelection = () => {
    if (loadingFiles) {
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
            onClick={loadBrowserDownloadFolders}
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

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  const renderFileSelection = () => {
    if (loadingFiles) {
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

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  const renderParseConfig = () => {
    return (
      <div>
        <div style={{ background: '#fff3e0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 4px 0' }}>📋 {selectedFile?.name}</h4>
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
            onChange={(e) => setHeaderRow(parseInt(e.target.value) || 1)}
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
            onChange={(e) => setSkipBottomRows(parseInt(e.target.value) || 0)}
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

        <div style={{ marginTop: '24px', padding: '16px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>🗂️ After Import</h4>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            What should happen to the Excel file after successful import?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="fileAction"
                checked={!deleteAfterImport && !archiveAfterImport}
                onChange={() => {
                  setDeleteAfterImport(false);
                  setArchiveAfterImport(false);
                }}
              />
              <div>
                <strong>Keep Original</strong>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                  Leave file in downloads folder (no action)
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="fileAction"
                checked={archiveAfterImport && !deleteAfterImport}
                onChange={() => {
                  setDeleteAfterImport(false);
                  setArchiveAfterImport(true);
                }}
              />
              <div>
                <strong>Move to "Processed" Folder</strong> <span style={{ color: '#4CAF50', fontSize: '12px' }}>← Recommended</span>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                  Keeps backup in script/processed/ folder
                </div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="fileAction"
                checked={deleteAfterImport}
                onChange={() => {
                  setDeleteAfterImport(true);
                  setArchiveAfterImport(false);
                }}
              />
              <div>
                <strong>Delete File</strong> <span style={{ color: '#f44336', fontSize: '12px' }}>⚠️ Permanent</span>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                  Removes file completely (cannot undo)
                </div>
              </div>
            </label>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  const renderImportMode = () => {
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>Choose Import Mode</h3>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          Selected file: <strong>{selectedFile?.name}</strong>
        </p>

        <div className="import-mode-selection">
          <div
            className="import-mode-card"
            onClick={() => handleImportModeSelect('create-new')}
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
            onClick={() => handleImportModeSelect('sync-existing')}
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

  const renderColumnMapping = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];

    return (
      <div>
        {parsedData.sheets.length > 1 && (
          <div className="form-group" style={{ marginBottom: '24px', maxWidth: '400px' }}>
            <label>Select Sheet</label>
            <select
              value={selectedSheet}
              onChange={(e) => {
                const newIndex = parseInt(e.target.value, 10);
                setSelectedSheet(newIndex);
                setColumnMappings(null);
                setMergeConfig(null);
              }}
            >
              {parsedData.sheets.map((sheet: any, index: number) => (
                <option key={index} value={index}>
                  {sheet.name} ({sheet.rows.length} rows)
                </option>
              ))}
            </select>
          </div>
        )}

        <VisualColumnMapper
          excelColumns={currentSheet.headers.map((header: string, idx: number) => ({
            name: header,
            type: currentSheet.detectedTypes[idx],
          }))}
          sampleRows={currentSheet.rows.slice(0, 3)}
          onMappingComplete={handleColumnMappingComplete}
          onBack={handleBack}
        />
      </div>
    );
  };

  const renderExistingTableMapping = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];

    return (
      <div>
        <ExistingTableMapper
          excelColumns={currentSheet.headers}
          excelTypes={currentSheet.detectedTypes}
          sampleRows={currentSheet.rows.slice(0, 3)}
          availableTables={tables}
          onMappingComplete={handleExistingTableMappingComplete}
          onBack={handleBack}
        />
      </div>
    );
  };

  const renderDuplicateDetection = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];
    const schema = currentSheet.headers.map((header: string, idx: number) => ({
      name: Object.values(columnMappings || existingTableColumnMappings || {})[idx] || header,
      type: currentSheet.detectedTypes[idx],
    }));

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Step 5: Duplicate Detection</h3>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Configure how to handle duplicate rows in future imports. This prevents the same data from being imported multiple times.
        </p>

        <DuplicateDetectionSettings
          schema={schema}
          initialUniqueColumns={duplicateDetectionSettings.uniqueKeyColumns}
          initialDuplicateAction={duplicateDetectionSettings.duplicateAction}
          onSettingsChange={setDuplicateDetectionSettings}
        />

        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleBack}>
            ⬅️ Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setCurrentStep('preview')}
          >
            Next: Review & Import →
          </button>
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];

    if (importMode === 'create-new') {
      if (!columnMappings) return null;

      const previewRows = currentSheet.rows.slice(0, 10);
      const uniqueDbColumns = Array.from(new Set(Object.values(columnMappings)));

      const mappedPreviewRows = previewRows.map((row: any) => {
        const mappedRow: any = {};

        uniqueDbColumns.forEach((dbColumnName) => {
          const mergeInfo = mergeConfig?.[dbColumnName];

          if (mergeInfo && mergeInfo.sources.length > 1) {
            const values = mergeInfo.sources
              .map((sourceName) => {
                const value = row[sourceName];
                return value !== null && value !== undefined ? String(value).trim() : '';
              })
              .filter((v) => v !== '');

            mappedRow[dbColumnName] = values.join(mergeInfo.separator);
          } else {
            const sourceExcelColumn = Object.entries(columnMappings).find(
              ([_, sqlName]) => sqlName === dbColumnName
            );

            if (sourceExcelColumn) {
              const [originalName] = sourceExcelColumn;
              mappedRow[dbColumnName] = row[originalName];
            }
          }
        });

        return mappedRow;
      });

      const mappedColumns = uniqueDbColumns.map((dbColumnName) => {
        const sourceExcelColumn = Object.entries(columnMappings).find(
          ([_, sqlName]) => sqlName === dbColumnName
        );

        if (sourceExcelColumn) {
          const [originalName] = sourceExcelColumn;
          const originalIndex = currentSheet.headers.indexOf(originalName);
          return {
            name: dbColumnName,
            type: currentSheet.detectedTypes[originalIndex],
          };
        }

        return { name: dbColumnName, type: 'TEXT' };
      });

      return (
        <div className="preview-section">
          <div className="preview-config">
            <h3 style={{ marginTop: 0 }}>Table Configuration</h3>

            <div className="form-group">
              <label>Table Name *</label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => {
                  let value = e.target.value;
                  value = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  if (/^\d/.test(value)) {
                    value = 'table_' + value;
                  }
                  setTableName(value);
                }}
                placeholder="e.g., sales_data"
              />
            </div>

            <div className="form-group">
              <label>Display Name *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Sales Data 2024"
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for this table..."
                rows={3}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #2196F3' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>💾 Save Configuration</h4>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={saveAsConfiguration}
                onChange={(e) => setSaveAsConfiguration(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <strong>Remember this configuration</strong>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  Save these settings so you can quickly re-import future files from "{selectedFolder?.scriptName}"
                </div>
              </div>
            </label>

            {saveAsConfiguration && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginLeft: '26px' }}>
                <input
                  type="checkbox"
                  checked={enableAutoSync}
                  onChange={(e) => setEnableAutoSync(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <strong>Enable Auto-Sync</strong> <span style={{ color: '#2196F3', fontSize: '12px' }}>✨ Phase 2</span>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Automatically import new files when they are downloaded (file watcher)
                  </div>
                </div>
              </label>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div>
            <h3>Data Preview (First 10 rows)</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
              {currentSheet.rows.length} total rows • {uniqueDbColumns.length} database columns
            </p>
            <DataTable
              columns={mappedColumns}
              rows={mappedPreviewRows}
              maxHeight="400px"
            />
          </div>
        </div>
      );
    } else if (importMode === 'sync-existing') {
      if (!selectedTableId || !existingTableColumnMappings) return null;

      const selectedTable = tables.find(t => t.id === selectedTableId);
      if (!selectedTable) return null;

      const previewRows = currentSheet.rows.slice(0, 10);
      const mappedPreviewRows = previewRows.map((row: any) => {
        const mappedRow: any = {};
        Object.entries(existingTableColumnMappings).forEach(([excelCol, tableCol]) => {
          mappedRow[tableCol] = row[excelCol];
        });
        return mappedRow;
      });

      return (
        <div className="preview-section">
          <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>📊 Syncing to: {selectedTable.displayName}</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
              Current rows: {selectedTable.rowCount} • Adding: {currentSheet.rows.length} rows
            </p>
          </div>

          <h3>Data Preview (First 10 rows to be added)</h3>
          <DataTable
            columns={selectedTable.schema.filter(col => col.name !== 'id')}
            rows={mappedPreviewRows}
            maxHeight="400px"
          />
        </div>
      );
    }

    return null;
  };

  const renderImporting = () => {
    return (
      <div className="progress-section">
        <div className="progress-spinner"></div>
        <p className="progress-message">
          {importMode === 'create-new' ? 'Creating table and importing data...' : 'Syncing data to existing table...'}
        </p>
      </div>
    );
  };

  const renderComplete = () => {
    const isSuccess = !importError;

    return (
      <div className="completion-section">
        <div className={`completion-icon ${isSuccess ? 'success' : 'error'}`}>
          {isSuccess ? '✅' : '❌'}
        </div>
        <h2 className="completion-title">
          {isSuccess ? 'Import Complete!' : 'Import Failed'}
        </h2>
        <p className="completion-message">
          {isSuccess
            ? importMode === 'create-new'
              ? 'New table created and data imported successfully'
              : 'Data synced to existing table successfully'
            : importError || 'An error occurred during import'}
        </p>

        {isSuccess && importProgress && (
          <div className="completion-stats">
            <div>
              <div className="progress-stat-value">{importProgress.rowsImported.toLocaleString()}</div>
              <div className="progress-stat-label">Rows Imported</div>
            </div>
            {importProgress.rowsSkipped > 0 && (
              <div>
                <div className="progress-stat-value" style={{ color: '#ff9800' }}>
                  {importProgress.rowsSkipped.toLocaleString()}
                </div>
                <div className="progress-stat-label">Rows Skipped</div>
              </div>
            )}
          </div>
        )}

        {!isSuccess && (
          <button className="btn btn-secondary" onClick={() => setCurrentStep('preview')}>
            ⬅️ Go Back
          </button>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'folder-selection':
        return renderFolderSelection();
      case 'file-selection':
        return renderFileSelection();
      case 'parse-config':
        return renderParseConfig();
      case 'import-mode':
        return renderImportMode();
      case 'column-mapping':
        return renderColumnMapping();
      case 'existing-table-mapping':
        return renderExistingTableMapping();
      case 'duplicate-detection':
        return renderDuplicateDetection();
      case 'preview':
        return renderPreview();
      case 'importing':
        return renderImporting();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 'preview') {
      if (importMode === 'create-new') {
        return tableName.trim() && displayName.trim() && columnMappings !== null;
      } else if (importMode === 'sync-existing') {
        return selectedTableId !== null && existingTableColumnMappings !== null;
      }
    }
    return false;
  };

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog">
        <div className="import-wizard-header">
          <h2>🔄 Sync Browser Downloads to SQL</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-wizard-body">
          {renderStepIndicator()}
          {renderStepContent()}
        </div>

        <div className="import-wizard-footer">
          <div>
            {(currentStep === 'file-selection' || currentStep === 'parse-config' || currentStep === 'import-mode' || currentStep === 'column-mapping' || currentStep === 'existing-table-mapping' || currentStep === 'duplicate-detection' || currentStep === 'preview') && (
              <button className="btn btn-secondary" onClick={handleBack}>
                ⬅️ Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStep === 'complete' ? (
              <button className="btn btn-primary" onClick={handleFinish}>
                ✅ Finish
              </button>
            ) : currentStep === 'parse-config' ? (
              <button
                className="btn btn-primary"
                onClick={handleParseConfigComplete}
                disabled={loadingFiles}
              >
                {loadingFiles ? 'Parsing...' : 'Next: Parse Excel →'}
              </button>
            ) : currentStep === 'preview' ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canProceed() || isImporting}
              >
                📥 {importMode === 'create-new' ? 'Create & Import' : 'Sync Data'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
