import React, { useState } from 'react';
import { useUserData, UserTable } from '../../hooks/useUserData';
import { DataTable } from './shared/DataTable';
import { VisualColumnMapper } from './VisualColumnMapper';
import { ExistingTableMapper } from './ExistingTableMapper';

interface SyncWizardProps {
  selectedFilePath: string;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep =
  | 'mode-selection'
  | 'column-mapping-new'
  | 'preview-new'
  | 'table-selection'
  | 'column-mapping-existing'
  | 'preview-existing'
  | 'syncing'
  | 'complete';

type SyncMode = 'create-new' | 'sync-existing' | null;

export const SyncWizard: React.FC<SyncWizardProps> = ({
  selectedFilePath,
  onClose,
  onComplete,
}) => {
  const { parseExcel, importExcel, syncToExistingTable, tables } = useUserData();

  const [currentStep, setCurrentStep] = useState<WizardStep>('mode-selection');
  const [syncMode, setSyncMode] = useState<SyncMode>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [columnMappings, setColumnMappings] = useState<Record<string, string> | null>(null);
  const [mergeConfig, setMergeConfig] = useState<Record<string, { sources: string[]; separator: string }> | null>(null);
  const [selectedTable, setSelectedTable] = useState<UserTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    rowsImported: number;
    rowsSkipped: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Parse the file on mount
  React.useEffect(() => {
    const loadFile = async () => {
      try {
        const parsed = await parseExcel(selectedFilePath);
        setParsedData(parsed);
        setTableName(parsed.suggestedTableName);
        setDisplayName(parsed.suggestedTableName.replace(/_/g, ' '));
        setSelectedSheet(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      }
    };
    loadFile();
  }, [selectedFilePath, parseExcel]);

  const handleModeSelection = (mode: SyncMode) => {
    setSyncMode(mode);
    if (mode === 'create-new') {
      setCurrentStep('column-mapping-new');
    } else if (mode === 'sync-existing') {
      setCurrentStep('table-selection');
    }
  };

  const handleColumnMappingComplete = (
    mappings: Record<string, string>,
    mergeConfiguration: Record<string, { sources: string[]; separator: string }>
  ) => {
    setColumnMappings(mappings);
    setMergeConfig(mergeConfiguration);
    
    if (syncMode === 'create-new') {
      setCurrentStep('preview-new');
    } else {
      setCurrentStep('preview-existing');
    }
  };

  const handleTableSelection = (table: UserTable) => {
    setSelectedTable(table);
    setCurrentStep('column-mapping-existing');
  };

  const handleBack = () => {
    if (currentStep === 'column-mapping-new' || currentStep === 'table-selection') {
      setCurrentStep('mode-selection');
      setSyncMode(null);
    } else if (currentStep === 'preview-new') {
      setCurrentStep('column-mapping-new');
    } else if (currentStep === 'column-mapping-existing') {
      setCurrentStep('table-selection');
    } else if (currentStep === 'preview-existing') {
      setCurrentStep('column-mapping-existing');
    }
  };

  const handleSync = async () => {
    setCurrentStep('syncing');
    setIsSyncing(true);
    setSyncError(null);

    try {
      if (syncMode === 'create-new') {
        // Create new table (same as import)
        const result = await importExcel({
          filePath: selectedFilePath,
          sheetIndex: selectedSheet,
          tableName,
          displayName,
          description: description.trim() || undefined,
          columnMappings: columnMappings || undefined,
          mergeConfig: mergeConfig || undefined,
        });

        setSyncProgress({
          rowsImported: result.importOperation.rowsImported,
          rowsSkipped: result.importOperation.rowsSkipped,
        });
      } else if (syncMode === 'sync-existing' && selectedTable) {
        // Sync to existing table
        const result = await syncToExistingTable({
          filePath: selectedFilePath,
          sheetIndex: selectedSheet,
          tableId: selectedTable.id,
          columnMappings: columnMappings || undefined,
          mergeConfig: mergeConfig || undefined,
        });

        setSyncProgress({
          rowsImported: result.rowsImported,
          rowsSkipped: result.rowsSkipped,
        });
      }

      setCurrentStep('complete');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
      setCurrentStep('complete');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinish = () => {
    onComplete();
    onClose();
  };

  const renderModeSelection = () => {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Selected File</h3>
          <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
            📄 {selectedFilePath.split('/').pop()}
          </div>
        </div>

        <h3>How would you like to sync this data?</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>Choose how to import the Excel data into your database</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
          <div
            onClick={() => handleModeSelection('create-new')}
            style={{
              border: '2px solid #ddd',
              borderRadius: '8px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2196f3';
              e.currentTarget.style.background = '#f5f9ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#ddd';
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>➕</div>
            <h4 style={{ margin: '0 0 8px 0' }}>Create New Table</h4>
            <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
              Import data into a brand new database table
            </p>
          </div>

          <div
            onClick={() => handleModeSelection('sync-existing')}
            style={{
              border: '2px solid #ddd',
              borderRadius: '8px',
              padding: '24px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4caf50';
              e.currentTarget.style.background = '#f5fdf5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#ddd';
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
            <h4 style={{ margin: '0 0 8px 0' }}>Sync to Existing Table</h4>
            <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
              Append data to an existing database table
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTableSelection = () => {
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>Select Existing Table</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Choose which table to sync this data into
        </p>

        {tables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p>No existing tables found</p>
            <button
              className="btn btn-secondary"
              onClick={() => handleModeSelection('create-new')}
            >
              Create New Table Instead
            </button>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '16px' }}>
            {tables.map((table) => (
              <div
                key={table.id}
                onClick={() => handleTableSelection(table)}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4caf50';
                  e.currentTarget.style.background = '#f5fdf5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#ddd';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  {table.displayName}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  {table.description || 'No description'}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {table.rowCount.toLocaleString()} rows • {table.columnCount} columns
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderColumnMapping = () => {
    if (!parsedData) return null;

    const currentSheet = parsedData.sheets[selectedSheet];

    if (syncMode === 'create-new') {
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
    } else if (syncMode === 'sync-existing' && selectedTable) {
      return (
        <ExistingTableMapper
          excelColumns={currentSheet.headers.map((header: string, idx: number) => ({
            name: header,
            type: currentSheet.detectedTypes[idx],
          }))}
          sampleRows={currentSheet.rows.slice(0, 3)}
          targetTable={selectedTable}
          onMappingComplete={handleColumnMappingComplete}
          onBack={handleBack}
        />
      );
    }

    return null;
  };

  const renderPreview = () => {
    if (!parsedData || !columnMappings) return null;

    const currentSheet = parsedData.sheets[selectedSheet];
    const previewRows = currentSheet.rows.slice(0, 10);

    if (syncMode === 'create-new') {
      // Same as ImportWizard preview
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
        return { name: dbColumnName, type: 'TEXT' as const };
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

          {error && <div className="error-message">{error}</div>}

          <div>
            <h3>Data Preview (First 10 rows)</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
              {currentSheet.rows.length} total rows • {uniqueDbColumns.length} database columns
            </p>
            <DataTable columns={mappedColumns} rows={mappedPreviewRows} maxHeight="400px" />
          </div>
        </div>
      );
    } else if (syncMode === 'sync-existing' && selectedTable) {
      // Preview for syncing to existing table
      const mappedPreviewRows = previewRows.map((row: any) => {
        const mappedRow: any = {};
        Object.entries(columnMappings).forEach(([excelCol, dbCol]) => {
          mappedRow[dbCol] = row[excelCol];
        });
        return mappedRow;
      });

      return (
        <div className="preview-section">
          <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Syncing to: {selectedTable.displayName}</h4>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Current table has {selectedTable.rowCount.toLocaleString()} rows. New data will be appended.
            </div>
          </div>

          <h3>Data Preview (First 10 rows to be added)</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            {currentSheet.rows.length} total rows will be added
          </p>
          <DataTable
            columns={selectedTable.schema.filter(col => col.name !== 'id').map(col => ({ name: col.name, type: col.type }))}
            rows={mappedPreviewRows}
            maxHeight="400px"
          />
        </div>
      );
    }

    return null;
  };

  const renderSyncing = () => {
    return (
      <div className="progress-section">
        <div className="progress-spinner"></div>
        <p className="progress-message">Syncing data...</p>
        <p style={{ color: '#999', fontSize: '14px' }}>Please wait while we process your Excel file</p>
      </div>
    );
  };

  const renderComplete = () => {
    const isSuccess = !syncError;

    return (
      <div className="completion-section">
        <div className={`completion-icon ${isSuccess ? 'success' : 'error'}`}>
          {isSuccess ? '✅' : '❌'}
        </div>
        <h2 className="completion-title">
          {isSuccess ? 'Sync Complete!' : 'Sync Failed'}
        </h2>
        <p className="completion-message">
          {isSuccess
            ? syncMode === 'create-new'
              ? 'Your data has been imported into a new table'
              : 'Your data has been synced to the existing table'
            : syncError || 'An error occurred during sync'}
        </p>

        {isSuccess && syncProgress && (
          <div className="completion-stats">
            <div>
              <div className="progress-stat-value">{syncProgress.rowsImported.toLocaleString()}</div>
              <div className="progress-stat-label">Rows Added</div>
            </div>
            {syncProgress.rowsSkipped > 0 && (
              <div>
                <div className="progress-stat-value" style={{ color: '#ff9800' }}>
                  {syncProgress.rowsSkipped.toLocaleString()}
                </div>
                <div className="progress-stat-label">Rows Skipped</div>
              </div>
            )}
          </div>
        )}

        {!isSuccess && (
          <button className="btn btn-secondary" onClick={() => setCurrentStep('mode-selection')}>
            ⬅️ Go Back
          </button>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'mode-selection':
        return renderModeSelection();
      case 'column-mapping-new':
      case 'column-mapping-existing':
        return renderColumnMapping();
      case 'table-selection':
        return renderTableSelection();
      case 'preview-new':
      case 'preview-existing':
        return renderPreview();
      case 'syncing':
        return renderSyncing();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 'preview-new') {
      return tableName.trim() && displayName.trim() && columnMappings !== null;
    }
    if (currentStep === 'preview-existing') {
      return columnMappings !== null;
    }
    return false;
  };

  const showNextButton = currentStep === 'preview-new' || currentStep === 'preview-existing';
  const showBackButton =
    currentStep === 'column-mapping-new' ||
    currentStep === 'table-selection' ||
    currentStep === 'column-mapping-existing' ||
    currentStep === 'preview-new' ||
    currentStep === 'preview-existing';

  return (
    <div className="import-wizard">
      <div className="import-wizard-dialog" style={{ maxWidth: '900px' }}>
        <div className="import-wizard-header">
          <h2>🔄 Sync Browser Download to SQL</h2>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-wizard-body">{renderStepContent()}</div>

        <div className="import-wizard-footer">
          <div>
            {showBackButton && (
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
            ) : showNextButton ? (
              <button
                className="btn btn-primary"
                onClick={handleSync}
                disabled={!canProceed() || isSyncing}
              >
                {syncMode === 'create-new' ? '📥 Create & Import' : '🔄 Sync to Table'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
