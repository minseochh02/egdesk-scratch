import React, { useState } from 'react';
import { useUserData } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';
import { VisualColumnMapper } from './VisualColumnMapper';

interface ImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'file-selection' | 'column-mapping' | 'preview' | 'importing' | 'complete';

export const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onComplete }) => {
  const { parseExcel, importExcel, selectExcelFile, validateTableName } = useUserData();

  const [currentStep, setCurrentStep] = useState<WizardStep>('file-selection');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [columnMappings, setColumnMappings] = useState<Record<string, string> | null>(null);
  const [mergeConfig, setMergeConfig] = useState<Record<string, { sources: string[]; separator: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    rowsImported: number;
    rowsSkipped: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileSelect = async () => {
    try {
      setError(null);
      const filePath = await selectExcelFile();

      if (!filePath) return;

      setSelectedFile(filePath);

      // Parse the Excel file
      const parsed = await parseExcel(filePath);
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
    setCurrentStep('preview');
  };

  const handleBack = () => {
    if (currentStep === 'column-mapping') {
      setCurrentStep('file-selection');
      setSelectedFile(null);
      setParsedData(null);
      setColumnMappings(null);
    } else if (currentStep === 'preview') {
      setCurrentStep('column-mapping');
    }
  };

  const handleNext = async () => {
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
        });

        setImportProgress({
          rowsImported: result.importOperation.rowsImported,
          rowsSkipped: result.importOperation.rowsSkipped,
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
      { id: 'column-mapping', label: 'Map Columns' },
      { id: 'preview', label: 'Configure & Preview' },
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
      case 'column-mapping':
        return renderColumnMapping();
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
      return selectedFile && parsedData;
    }
    if (currentStep === 'column-mapping') {
      return columnMappings !== null;
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
            {(currentStep === 'preview' || currentStep === 'column-mapping') && (
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
            ) : currentStep === 'column-mapping' ? null : currentStep !== 'importing' && (
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
