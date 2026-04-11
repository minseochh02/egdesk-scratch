import React from 'react';
import { BaseStepProps } from '../types';
import { DataTable } from '../../shared/DataTable';

/**
 * Format date value for preview display
 * Converts various date formats to YYYY-MM-DD
 */
const formatDateForPreview = (value: any): string => {
  if (!value) return value;

  // If already a Date object, format it
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If it's a number, check for YYYYMMDD format (e.g., 20250101)
  if (typeof value === 'number' && Number.isInteger(value)) {
    const valueStr = String(value);
    if (valueStr.length === 8 && value >= 19000101 && value <= 21991231) {
      const year = valueStr.substring(0, 4);
      const month = valueStr.substring(4, 6);
      const day = valueStr.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a string, check for YYYYMMDD format
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Handle YYYYMMDD format (e.g., "20250101")
    if (/^\d{8}$/.test(trimmed)) {
      const year = trimmed.substring(0, 4);
      const month = trimmed.substring(4, 6);
      const day = trimmed.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
  }

  // Return as-is for other formats
  return value;
};

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
    columnTypes,
    mergeConfig,
    tableName,
    displayName,
  } = wizardState;

  if (!parsedData || !columnMappings) return null;

  const currentSheet = parsedData.sheets[selectedSheet];
  const previewRows = currentSheet.rows.slice(0, 10);

  // Get unique DB column names
  const uniqueDbColumns = Array.from(new Set(Object.values(columnMappings)));

  // Build columns array with unique SQL names (needed for type lookup)
  const mappedColumns = uniqueDbColumns.map((dbColumnName) => {
    // Find the source Excel column name for this DB column
    const sourceExcelColumn = Object.entries(columnMappings).find(
      ([_, sqlName]) => sqlName === dbColumnName
    );
    const excelColumnName = sourceExcelColumn ? sourceExcelColumn[0] : null;

    // PRIORITY 1: Use user-modified column types from VisualColumnMapper
    // columnTypes is keyed by Excel column name
    if (columnTypes && excelColumnName && columnTypes[excelColumnName]) {
      console.log(`🎯 PreviewStep: Using user-modified type for "${dbColumnName}" (from Excel "${excelColumnName}"): ${columnTypes[excelColumnName]}`);
      return {
        name: dbColumnName,
        type: columnTypes[excelColumnName],
      };
    }

    // PRIORITY 2: In upload mode, use the target table's schema type
    if (mode === 'upload' && targetTable) {
      const targetColumn = targetTable.schema.find(col => col.name === dbColumnName);
      if (targetColumn) {
        // Debug logging
        if (dbColumnName === '일자') {
          console.log(`🔍 PreviewStep (upload mode): Using target table type for "${dbColumnName}":`, {
            dbColumnName,
            targetType: targetColumn.type,
          });
        }

        return {
          name: dbColumnName,
          type: targetColumn.type,
        };
      }
    }

    // PRIORITY 3: For import mode OR if no match found in target table, use Excel detected type
    if (excelColumnName) {
      const originalIndex = currentSheet.headers.indexOf(excelColumnName);
      const detectedType = currentSheet.detectedTypes[originalIndex];

      // Debug logging
      if (dbColumnName === '일자' || excelColumnName === '일자') {
        console.log(`🔍 PreviewStep column mapping for 일자:`, {
          mode,
          dbColumnName,
          originalName: excelColumnName,
          originalIndex,
          detectedType,
          allHeaders: currentSheet.headers,
          allTypes: currentSheet.detectedTypes,
        });
      }

      return {
        name: dbColumnName,
        type: detectedType,
      };
    }

    return { name: dbColumnName, type: 'TEXT' };
  });

  // Map preview rows to use SQL column names with merge support and date formatting
  const mappedPreviewRows = previewRows.map((row: any, rowIndex: number) => {
    const mappedRow: any = {};

    uniqueDbColumns.forEach((dbColumnName) => {
      // Find the column type
      const columnInfo = mappedColumns.find(col => col.name === dbColumnName);
      const columnType = columnInfo?.type;

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
          let value = row[originalName];

          // Format DATE columns for preview
          if (columnType === 'DATE' && value !== null && value !== undefined) {
            // Log first row for debugging
            if (rowIndex === 0) {
              console.log(`📅 PreviewStep: Formatting DATE column "${dbColumnName}" from "${value}"`, { type: typeof value, columnType });
            }
            const formatted = formatDateForPreview(value);
            if (rowIndex === 0) {
              console.log(`   → Formatted to: "${formatted}"`);
            }
            value = formatted;
          }

          mappedRow[dbColumnName] = value;
        }
      }
    });

    return mappedRow;
  });

  const summaryLabel = mode === 'import' ? 'Import Summary' : 'Upload Summary';
  const tableDisplayName = mode === 'import' ? displayName : targetTable?.displayName;
  const tableNameValue = mode === 'import' ? tableName : targetTable?.tableName;
  const tableLabel = mode === 'import' ? 'Table' : 'Target Table';

  return (
    <div className="preview-section">
      <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>{summaryLabel}</h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <strong>{tableLabel}:</strong> {tableDisplayName} ({tableNameValue})<br />
          {currentSheet.originalRowCount && (
            <>
              <strong>Original File:</strong> {currentSheet.originalRowCount.toLocaleString()} total rows
              {currentSheet.headerRowNumber && ` (headers in row ${currentSheet.headerRowNumber})`}
              <br />
            </>
          )}
          {currentSheet.skippedBottomRowNumbers && currentSheet.skippedBottomRowNumbers.length > 0 && (
            <>
              <strong style={{ color: '#f57c00' }}>Skipped Bottom Rows:</strong>{' '}
              <span style={{ color: '#f57c00' }}>
                {currentSheet.skippedBottomRowNumbers.length === 1
                  ? `Row ${currentSheet.skippedBottomRowNumbers[0]}`
                  : currentSheet.skippedBottomRowNumbers.length <= 5
                  ? `Rows ${currentSheet.skippedBottomRowNumbers.join(', ')}`
                  : `Rows ${currentSheet.skippedBottomRowNumbers[0]}-${currentSheet.skippedBottomRowNumbers[currentSheet.skippedBottomRowNumbers.length - 1]} (${currentSheet.skippedBottomRowNumbers.length} rows)`
                }
              </span>
              <br />
            </>
          )}
          <strong>Data Rows to Import:</strong> {currentSheet.rows.length.toLocaleString()}<br />
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
