import React, { useState } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';
import { VisualColumnMapper } from './VisualColumnMapper';
import { DuplicateDetectionSettings } from './DuplicateDetectionSettings';

interface ImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'file-selection' | 'parse-config' | 'column-mapping' | 'duplicate-detection' | 'preview' | 'importing' | 'complete';

export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onComplete }) => {
  const { parseExcel, importExcel, selectExcelFile, validateTableName } = useUserData();

  const [currentStep, setCurrentStep] = useState<WizardStep>('file-selection');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [skipBottomRows, setSkipBottomRows] = useState<number>(0);
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [columnMappings, setColumnMappings] = useState<Record<string, string> | null>(null);
  const [mergeConfig, setMergeConfig] = useState<Record<string, { sources: string[]; separator: string }> | null>(null);
  const [duplicateDetectionSettings, setDuplicateDetectionSettings] = useState<{
    uniqueKeyColumns: string[];
    duplicateAction: 'skip' | 'update' | 'allow';
  }>({
    uniqueKeyColumns: [],
    duplicateAction: 'skip',
  });
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    rowsImported: number;
    rowsSkipped: number;
    duplicatesSkipped?: number;
    duplicateDetails?: Array<{ rowIndex: number; uniqueKeyValues: Record<string, any> }>;
    errorDetails?: Array<{ rowIndex: number; error: string; rowData?: Record<string, any> }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const handleFileSelect = async () => {
    try {
      setError(null);
      const filePath = await selectExcelFile();

      if (!filePath) return;

      setSelectedFile(filePath);
      setCurrentStep('parse-config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const handleParseConfigComplete = async () => {
    try {
      setError(null);
      
      // Parse the Excel file with configured options
      const parsed = await parseExcel(selectedFile!, {
        headerRow,
        skipBottomRows,
      });
      
      setParsedData(parsed);
      setTableName(parsed.suggestedTableName);
      setDisplayName(parsed.suggestedTableName.replace(/_/g, ' '));
      setSelectedSheet(0);

      setCurrentStep('column-mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
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

  const handleBack = () => {
    if (currentStep === 'parse-config') {
      setCurrentStep('file-selection');
      setSelectedFile(null);
    } else if (currentStep === 'column-mapping') {
      setCurrentStep('parse-config');
      setParsedData(null);
      setColumnMappings(null);
    } else if (currentStep === 'duplicate-detection') {
      setCurrentStep('column-mapping');
    } else if (currentStep === 'preview') {
      setCurrentStep('duplicate-detection');
    }
  };

  const handleNext = async () => {
    if (currentStep === 'duplicate-detection') {
      // Move to preview step
      setCurrentStep('preview');
      return;
    }

    if (currentStep === 'preview') {
      // Validate inputs
      if (!tableName.trim()) {
        setError('Please enter a table name');
        return;
      }

      if (!displayName.trim()) {
        setError('Please enter a display name');
        return;
      }

      // Validate table name availability
      try {
        const validation = await validateTableName(tableName);

        if (!validation.available) {
          setError(`Table name "${validation.sanitizedName}" is already in use. Please choose a different name.`);
          return;
        }

        // Start import
        setCurrentStep('importing');
        setIsImporting(true);
        setImportError(null);

        const result = await importExcel({
          filePath: selectedFile!,
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
          duplicatesSkipped: result.importOperation.duplicatesSkipped,
          duplicateDetails: result.importOperation.duplicateDetails,
          errorDetails: result.importOperation.errorDetails,
        });

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

  const renderStepIndicator = () => {
    const steps = [
      { id: 'file-selection', label: 'Select File' },
      { id: 'parse-config', label: 'Configure' },
      { id: 'column-mapping', label: 'Map Columns' },
      { id: 'duplicate-detection', label: 'Duplicates' },
      { id: 'preview', label: 'Preview' },
      { id: 'importing', label: 'Importing' },
      { id: 'complete', label: 'Complete' },
    ];

    const getCurrentStepIndex = () => {
      return steps.findIndex((s) => s.id === currentStep);
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

  const renderParseConfig = () => {
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

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  const renderDuplicateDetection = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];
    const schema = currentSheet.headers.map((header: string, idx: number) => ({
      name: Object.values(columnMappings || {})[idx] || header,
      type: currentSheet.detectedTypes[idx],
    }));

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Duplicate Detection</h3>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Configure how to handle duplicate rows in future imports. This prevents the same data from being imported multiple times.
        </p>

        <DuplicateDetectionSettings
          schema={schema}
          initialUniqueColumns={duplicateDetectionSettings.uniqueKeyColumns}
          initialDuplicateAction={duplicateDetectionSettings.duplicateAction}
          onSettingsChange={setDuplicateDetectionSettings}
        />
      </div>
    );
  };

  const renderFileSelection = () => {
    return (
      <div>
        <div
          className="file-selection-zone"
          onClick={handleFileSelect}
        >
          <div className="file-selection-icon">📁</div>
          <h3>Select an Excel File</h3>
          <p>Click to browse for .xlsx, .xls, or .xlsm files</p>
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

  const renderPreview = () => {
    if (!parsedData || !columnMappings) return null;

    const currentSheet = parsedData.sheets[selectedSheet];
    const previewRows = currentSheet.rows.slice(0, 10);

    // Get unique DB column names
    const uniqueDbColumns = Array.from(new Set(Object.values(columnMappings)));

    // Map preview rows to use SQL column names with merge support
    const mappedPreviewRows = previewRows.map((row: any) => {
      const mappedRow: any = {};

      uniqueDbColumns.forEach((dbColumnName) => {
        // Check if this DB column has a merge configuration
        const mergeInfo = mergeConfig?.[dbColumnName];

        if (mergeInfo && mergeInfo.sources.length > 1) {
          // Merge multiple Excel columns
          const values = mergeInfo.sources
            .map((sourceName) => {
              const value = row[sourceName];
              return value !== null && value !== undefined ? String(value).trim() : '';
            })
            .filter((v) => v !== '');

          mappedRow[dbColumnName] = values.join(mergeInfo.separator);
        } else {
          // Simple 1:1 mapping
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

    // Build columns array with unique SQL names
    const mappedColumns = uniqueDbColumns.map((dbColumnName) => {
      // Find a source column to get the type
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
                // Convert to lowercase and remove invalid characters
                value = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                // Ensure doesn't start with number
                if (/^\d/.test(value)) {
                  value = 'table_' + value;
                }
                setTableName(value);
              }}
              placeholder="e.g., sales_data"
            />
            <small style={{ color: '#999', fontSize: '12px' }}>
              Internal database table name (lowercase, alphanumeric and underscores only)
            </small>
          </div>

          <div className="form-group">
            <label>Display Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Sales Data 2024"
            />
            <small style={{ color: '#999', fontSize: '12px' }}>
              Human-readable name shown in the UI
            </small>
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

        {error && <div className="error-message">{error}</div>}

        <div>
          <h3>Data Preview (First 10 rows)</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            {currentSheet.rows.length} total rows • {uniqueDbColumns.length} database columns
          </p>
          <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
            <strong>Note:</strong> An auto-incrementing 'id' column will be added as the first column
          </div>
          {mergeConfig && Object.keys(mergeConfig).length > 0 && (
            <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
              <strong>🔀 Merged Columns:</strong>
              {Object.entries(mergeConfig).map(([dbCol, info]) => (
                <div key={dbCol} style={{ marginTop: '4px', fontSize: '13px' }}>
                  • <strong>{dbCol}</strong> ← {info.sources.join(` ${info.separator} `)}
                </div>
              ))}
            </div>
          )}
          <DataTable
            columns={mappedColumns}
            rows={mappedPreviewRows}
            maxHeight="400px"
          />
        </div>
      </div>
    );
  };

  const renderImporting = () => {
    return (
      <div className="progress-section">
        <div className="progress-spinner"></div>
        <p className="progress-message">Importing data...</p>
        <p style={{ color: '#999', fontSize: '14px' }}>Please wait while we process your Excel file</p>
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
            ? 'Your Excel data has been successfully imported'
            : importError || 'An error occurred during import'}
        </p>

        {isSuccess && importProgress && (
          <>
            <div className="completion-stats">
              <div>
                <div className="progress-stat-value">{importProgress.rowsImported.toLocaleString()}</div>
                <div className="progress-stat-label">Rows Imported</div>
              </div>
              {(importProgress.duplicatesSkipped || 0) > 0 && (
                <div>
                  <div className="progress-stat-value" style={{ color: '#f44336' }}>
                    {(importProgress.duplicatesSkipped || 0).toLocaleString()}
                  </div>
                  <div className="progress-stat-label">Duplicates Skipped</div>
                </div>
              )}
              {(importProgress.errorDetails?.length || 0) > 0 && (
                <div>
                  <div className="progress-stat-value" style={{ color: '#ff9800' }}>
                    {(importProgress.errorDetails?.length || 0).toLocaleString()}
                  </div>
                  <div className="progress-stat-label">Errors</div>
                </div>
              )}
            </div>

            {importProgress.duplicateDetails && importProgress.duplicateDetails.length > 0 && (
              <div style={{ marginTop: '20px', textAlign: 'left', width: '100%' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  style={{ marginBottom: '10px' }}
                >
                  {showDuplicates ? '▼' : '▶'} Show Duplicate Rows ({importProgress.duplicateDetails.length})
                </button>
                
                {showDuplicates && (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    {importProgress.duplicateDetails.map((dup, idx) => (
                      <div key={idx} style={{
                        padding: '8px',
                        marginBottom: '8px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#f44336' }}>
                          Row {dup.rowIndex + 2} {/* +2 because: +1 for 1-based indexing, +1 for header row */}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          <div style={{ marginBottom: '4px', fontStyle: 'italic' }}>
                            Duplicate key values:
                          </div>
                          {Object.entries(dup.uniqueKeyValues).map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {importProgress.errorDetails && importProgress.errorDetails.length > 0 && (
              <div style={{ marginTop: '20px', textAlign: 'left', width: '100%' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowErrors(!showErrors)}
                  style={{ marginBottom: '10px' }}
                >
                  {showErrors ? '▼' : '▶'} Show Error Rows ({importProgress.errorDetails.length})
                </button>
                
                {showErrors && (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    {importProgress.errorDetails.map((err, idx) => (
                      <div key={idx} style={{
                        padding: '8px',
                        marginBottom: '8px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ff9800' }}>
                          Row {err.rowIndex + 2}
                        </div>
                        <div style={{ fontSize: '13px', color: '#d32f2f', marginBottom: '8px' }}>
                          <strong>Error:</strong> {err.error}
                        </div>
                        {err.rowData && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            <div style={{ marginBottom: '4px', fontStyle: 'italic' }}>
                              Row data:
                            </div>
                            {Object.entries(err.rowData).slice(0, 5).map(([key, value]) => (
                              <div key={key}>
                                <strong>{key}:</strong> {String(value).substring(0, 50)}{String(value).length > 50 ? '...' : ''}
                              </div>
                            ))}
                            {Object.keys(err.rowData).length > 5 && (
                              <div style={{ fontStyle: 'italic', marginTop: '4px' }}>
                                ...and {Object.keys(err.rowData).length - 5} more columns
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isSuccess && (
          <button className="btn btn-secondary" onClick={() => setCurrentStep('preview')}>
            ⬅️ Go Back
          </button>
        )}
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
                setColumnMappings(null); // Reset mappings when sheet changes
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 'file-selection':
        return renderFileSelection();
      case 'parse-config':
        return renderParseConfig();
      case 'column-mapping':
        return renderColumnMapping();
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
    if (currentStep === 'file-selection') {
      // Logic handled by onClick in this step
      return false;
    }
    if (currentStep === 'parse-config') {
      return headerRow > 0;
    }
    if (currentStep === 'column-mapping') {
      return columnMappings !== null;
    }
    if (currentStep === 'duplicate-detection') {
       // Allow proceeding even if no duplicates selected (it's optional in settings)
       return true;
    }
    if (currentStep === 'preview') {
      return tableName.trim() && displayName.trim() && columnMappings !== null;
    }
    return false;
  };

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog">
        <div className="import-wizard-header">
          <h2>Import Excel Data</h2>
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
            {(currentStep === 'parse-config' || currentStep === 'duplicate-detection' || currentStep === 'preview') && (
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
              <button className="btn btn-primary" onClick={handleParseConfigComplete}>
                Next: Parse Excel →
              </button>
            ) : (currentStep !== 'importing' && currentStep !== 'column-mapping') && (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canProceed() || isImporting}
              >
                {currentStep === 'preview' ? '📥 Import' : 'Next ➡️'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
