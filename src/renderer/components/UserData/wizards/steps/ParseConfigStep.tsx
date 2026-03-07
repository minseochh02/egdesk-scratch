import React, { useState, useEffect } from 'react';
import { BaseStepProps } from '../types';
import { useUserData } from '../../../../hooks/useUserData';

/**
 * ParseConfigStep - Configure Excel parsing options (header row, skip bottom rows)
 * 100% duplicate code elimination from ImportWizard and ExcelUploadDialog
 */
export const ParseConfigStep: React.FC<BaseStepProps> = ({
  wizardState,
  onStateChange,
  error,
}) => {
  const { selectedFile, headerRow, skipBottomRows, parsedData, selectedSheet } = wizardState;
  const { getExcelRowsPreview } = useUserData();

  const [rowsPreview, setRowsPreview] = useState<{
    totalRows: number;
    sheetName: string;
    headerRow?: { rowNumber: number; content: any[]; rawRow: any[] };
    bottomRows?: Array<{ rowNumber: number; content: any[]; rawRow: any[] }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch preview rows when headerRow or skipBottomRows changes
  useEffect(() => {
    if (!selectedFile) {
      setRowsPreview(null);
      return;
    }

    const fetchPreviewRows = async () => {
      try {
        setLoadingPreview(true);
        const data = await getExcelRowsPreview(selectedFile, {
          sheetIndex: selectedSheet || 0,
          headerRow: headerRow,
          bottomRowCount: skipBottomRows > 0 ? skipBottomRows : undefined,
        });
        setRowsPreview(data);
      } catch (err) {
        console.error('Failed to fetch preview rows:', err);
        setRowsPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    };

    fetchPreviewRows();
  }, [selectedFile, headerRow, skipBottomRows, selectedSheet, getExcelRowsPreview]);

  // Calculate which rows will be skipped (if we have parsed data)
  const currentSheet = parsedData?.sheets?.[selectedSheet];
  const originalRowCount = currentSheet?.originalRowCount;
  let skippedRowsPreview = '';

  if (originalRowCount && skipBottomRows > 0) {
    const firstSkippedRow = originalRowCount - skipBottomRows + 1;
    const lastSkippedRow = originalRowCount;

    if (skipBottomRows === 1) {
      skippedRowsPreview = `row ${lastSkippedRow}`;
    } else if (skipBottomRows <= 5) {
      const rowNumbers = [];
      for (let i = firstSkippedRow; i <= lastSkippedRow; i++) {
        rowNumbers.push(i);
      }
      skippedRowsPreview = `rows ${rowNumbers.join(', ')}`;
    } else {
      skippedRowsPreview = `rows ${firstSkippedRow}-${lastSkippedRow}`;
    }
  }

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
          onChange={(e) => onStateChange({ headerRow: parseInt(e.target.value) || 1 })}
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
          onChange={(e) => onStateChange({ skipBottomRows: parseInt(e.target.value) || 0 })}
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
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          {rowsPreview && (
            <>
              <strong>File has:</strong> {rowsPreview.totalRows.toLocaleString()} total rows<br />
            </>
          )}
          <strong>Reading from:</strong> Row {headerRow} (headers) → Row {headerRow + 1} (data starts)<br />
          <strong>Excluding:</strong> {skipBottomRows === 0 ? 'No rows' : (
            <>
              <span style={{ color: '#f57c00' }}>
                {skippedRowsPreview ? (
                  <>Skipping {skippedRowsPreview}</>
                ) : (
                  <>Last {skipBottomRows} row{skipBottomRows > 1 ? 's' : ''}</>
                )}
              </span>
            </>
          )}
          {rowsPreview && skipBottomRows > 0 && (
            <>
              <br />
              <strong>Resulting data:</strong> {(rowsPreview.totalRows - headerRow - skipBottomRows).toLocaleString()} rows will be imported
            </>
          )}
        </div>
      </div>

      {/* Show preview of header row */}
      {loadingPreview ? (
        <div style={{ marginTop: '24px', padding: '20px', textAlign: 'center', color: '#999' }}>
          Loading preview...
        </div>
      ) : rowsPreview?.headerRow ? (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#2196f3' }}>
            📋 Header Row Preview
          </h4>
          <div style={{
            border: '2px solid #2196f3',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#e3f2fd'
          }}>
            <div style={{
              padding: '12px',
              background: '#2196f3',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600
            }}>
              Row {rowsPreview.headerRow.rowNumber} from "{rowsPreview.sheetName}" (selected as headers)
            </div>
            <div style={{
              padding: '12px',
              background: 'white',
              fontSize: '13px',
            }}>
              <div style={{
                color: '#666',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {rowsPreview.headerRow.content.length > 0 ? (
                  rowsPreview.headerRow.content.map((cell, idx) => (
                    <span key={idx}>
                      <strong style={{ color: '#2196f3' }}>
                        {cell instanceof Date
                          ? cell.toLocaleDateString()
                          : String(cell)}
                      </strong>
                      {idx < rowsPreview.headerRow.content.length - 1 ? ' | ' : ''}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>
                    (empty row - no headers found)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Show preview of rows that will be skipped */}
      {skipBottomRows > 0 && rowsPreview?.bottomRows && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#f57c00' }}>
            📋 Preview of Rows to be Skipped
          </h4>
          <div style={{
            border: '2px solid #f57c00',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#fff3e0'
          }}>
            <div style={{
              padding: '12px',
              background: '#f57c00',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600
            }}>
              Showing last {skipBottomRows} row{skipBottomRows > 1 ? 's' : ''} from "{rowsPreview.sheetName}"
              (Total: {rowsPreview.totalRows} rows in file)
            </div>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              background: 'white'
            }}>
              {rowsPreview.bottomRows.map((row) => (
                <div
                  key={row.rowNumber}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #ffe0b2',
                    fontSize: '13px',
                  }}
                >
                  <div style={{
                    fontWeight: 600,
                    color: '#f57c00',
                    marginBottom: '4px'
                  }}>
                    Row {row.rowNumber}
                  </div>
                  <div style={{
                    color: '#666',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {row.content.length > 0 ? (
                      row.content.map((cell, idx) => (
                        <span key={idx}>
                          {cell instanceof Date
                            ? cell.toLocaleDateString()
                            : String(cell)}
                          {idx < row.content.length - 1 ? ' | ' : ''}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999', fontStyle: 'italic' }}>
                        (empty row)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
