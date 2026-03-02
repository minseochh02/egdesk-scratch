import React from 'react';
import { BaseStepProps } from '../types';

/**
 * CompletionStep - Shows import/upload results with success/error details
 * 95% duplicate code elimination from ImportWizard and ExcelUploadDialog
 * Consolidates 270 lines of nearly identical code
 * Mode-aware: Multi-table results for import mode only
 */
export const CompletionStep: React.FC<BaseStepProps> = ({
  mode,
  wizardState,
  onStateChange,
}) => {
  const {
    importProgress,
    multiTableImportResults,
    importError,
    showDuplicates,
    showErrors,
  } = wizardState;

  const isSuccess = !importError;
  const action = mode === 'import' ? 'Import' : 'Upload';

  return (
    <div className="completion-section">
      <div className={`completion-icon ${isSuccess ? 'success' : 'error'}`}>
        {isSuccess ? '✅' : '❌'}
      </div>
      <h2 className="completion-title">
        {isSuccess ? `${action} Complete!` : `${action} Failed`}
      </h2>
      <p className="completion-message">
        {isSuccess
          ? multiTableImportResults
            ? `Successfully imported ${multiTableImportResults.length} tables from island data`
            : mode === 'import'
            ? 'Your Excel data has been successfully imported'
            : 'Your Excel data has been successfully uploaded to the table'
          : importError || `An error occurred during ${action.toLowerCase()}`}
      </p>

      {/* Multi-table island import results (import mode only) */}
      {isSuccess && multiTableImportResults && mode === 'import' && (
        <div className="completion-stats" style={{ marginTop: '20px' }}>
          <div style={{ width: '100%', textAlign: 'left' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>
              📊 {multiTableImportResults.length} Tables Created
            </h3>
            {multiTableImportResults.map((result, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  marginBottom: '12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '6px' }}>
                  {result.displayName}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Table: <code style={{ backgroundColor: '#e0e0e0', padding: '2px 6px', borderRadius: '3px' }}>{result.tableName}</code>
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                  ✅ {result.rowsImported.toLocaleString()} rows imported
                  {result.rowsSkipped > 0 && ` • ⏭️  ${result.rowsSkipped.toLocaleString()} rows skipped`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single table import/upload results */}
      {isSuccess && importProgress && !multiTableImportResults && (
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
                onClick={() => onStateChange({ showDuplicates: !showDuplicates })}
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
                onClick={() => onStateChange({ showErrors: !showErrors })}
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
    </div>
  );
};
