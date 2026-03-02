import React from 'react';
import { BaseStepProps } from '../types';
import { DataTable } from '../../shared/DataTable';

/**
 * PreviewStep - Shows data preview before import/upload
 * 95% duplicate code elimination from ImportWizard and ExcelUploadDialog
 * Mode-aware summary header
 */
export const PreviewStep: React.FC<BaseStepProps> = ({
  mode,
  targetTable,
  wizardState,
  error,
}) => {
  const {
    parsedData,
    selectedSheet,
    columnMappings,
    mergeConfig,
    tableName,
    displayName,
  } = wizardState;

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

  const summaryLabel = mode === 'import' ? 'Import Summary' : 'Upload Summary';
  const tableDisplayName = mode === 'import' ? displayName : targetTable?.displayName;
  const tableNameValue = mode === 'import' ? tableName : targetTable?.tableName;
  const tableLabel = mode === 'import' ? 'Table' : 'Target Table';

  return (
    <div className="preview-section">
      <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>{summaryLabel}</h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          <strong>{tableLabel}:</strong> {tableDisplayName} ({tableNameValue})<br />
          <strong>Total Rows:</strong> {currentSheet.rows.length.toLocaleString()}<br />
          <strong>{mode === 'import' ? 'Columns' : 'Mapped Columns'}:</strong> {uniqueDbColumns.length}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div>
        <h3>Data Preview (First 10 rows)</h3>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
          {currentSheet.rows.length} total rows • {uniqueDbColumns.length} database columns
        </p>
        {mode === 'import' && (
          <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
            <strong>Note:</strong> An auto-incrementing 'id' column will be added as the first column
          </div>
        )}
        {mergeConfig && Object.keys(mergeConfig).length > 0 && (
          <div style={{ background: '#fff3e0', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
            <strong>{mode === 'import' ? '🔀 ' : ''}Merged Columns:</strong>
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
