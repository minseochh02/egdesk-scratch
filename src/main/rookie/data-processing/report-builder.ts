/**
 * Report Builder Module
 * Creates final Excel reports with formatting
 */

import ExcelJS from 'exceljs';
import { Dataset } from './data-transformer';

export interface ReportOptions {
  sheetName: string;
  title?: string;
  includeHeader: boolean;
  numberFormat?: string;
}

/**
 * Create Excel report from dataset
 */
export async function createReport(
  dataset: Dataset,
  outputPath: string,
  options: Partial<ReportOptions> = {}
): Promise<string> {
  console.log('[Report Builder] Creating report...');
  console.log('  - Output:', outputPath);
  console.log('  - Rows:', dataset.rows.length);
  console.log('  - Columns:', dataset.columns.length);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName || 'Report');

  // Add title row if provided
  let startRow = 1;
  if (options.title) {
    worksheet.getCell(1, 1).value = options.title;
    worksheet.getCell(1, 1).font = { size: 14, bold: true };
    startRow = 2;
  }

  // Add header row
  if (options.includeHeader !== false) {
    dataset.columns.forEach((col, idx) => {
      const cell = worksheet.getCell(startRow, idx + 1);
      cell.value = col;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    startRow++;
  }

  // Add data rows
  dataset.rows.forEach((row, rowIdx) => {
    dataset.columns.forEach((col, colIdx) => {
      const cell = worksheet.getCell(startRow + rowIdx, colIdx + 1);
      cell.value = row[col];

      // Apply number format if value is numeric
      if (typeof row[col] === 'number' && options.numberFormat) {
        cell.numFmt = options.numberFormat;
      }

      // Add borders
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column) {
      column.width = 15;
    }
  });

  await workbook.xlsx.writeFile(outputPath);
  console.log('[Report Builder] ✓ Report saved to:', outputPath);

  return outputPath;
}

/**
 * Add summary row (e.g., Total, D/M계)
 */
export async function addSummaryRow(
  filePath: string,
  summaryType: 'sum' | 'zero',
  rowLabel: string
): Promise<void> {
  console.log('[Report Builder] Adding summary row:', rowLabel);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return;

  const lastDataRow = worksheet.rowCount;
  const summaryRowNumber = lastDataRow + 1;

  // Add label in first column
  worksheet.getCell(summaryRowNumber, 1).value = rowLabel;
  worksheet.getCell(summaryRowNumber, 1).font = { bold: true };

  // Calculate or set values for other columns
  const columnCount = worksheet.columnCount;

  for (let col = 2; col <= columnCount; col++) {
    const cell = worksheet.getCell(summaryRowNumber, col);

    if (summaryType === 'sum') {
      // Sum all values in this column (skip header)
      let sum = 0;
      for (let row = 2; row < lastDataRow; row++) {
        const value = worksheet.getCell(row, col).value;
        if (typeof value === 'number') {
          sum += value;
        }
      }
      cell.value = sum;
    } else if (summaryType === 'zero') {
      cell.value = 0;
    }

    cell.font = { bold: true };
    cell.border = {
      top: { style: 'double' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  await workbook.xlsx.writeFile(filePath);
  console.log('[Report Builder] ✓ Summary row added');
}

/**
 * Apply number formatting to columns
 */
export async function applyFormatting(
  filePath: string,
  columnFormats: Record<string, string>
): Promise<void> {
  console.log('[Report Builder] Applying formatting...');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return;

  // Get header row to find column indices
  const headerRow = worksheet.getRow(1);
  const columnMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const columnName = cell.text;
    if (columnName) {
      columnMap[columnName] = colNumber;
    }
  });

  // Apply formats
  for (const [columnName, format] of Object.entries(columnFormats)) {
    const colNumber = columnMap[columnName];
    if (colNumber) {
      worksheet.getColumn(colNumber).eachCell((cell, rowNumber) => {
        if (rowNumber > 1 && typeof cell.value === 'number') {
          cell.numFmt = format;
        }
      });
      console.log(`[Report Builder]   ✓ Applied format to "${columnName}": ${format}`);
    }
  }

  await workbook.xlsx.writeFile(filePath);
  console.log('[Report Builder] ✓ Formatting applied');
}
