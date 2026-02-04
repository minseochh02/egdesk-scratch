/**
 * Thumbnail Handler for Rookie
 *
 * Processes Excel files for AI analysis and thumbnail generation:
 * 1. Reads ALL sheets from Excel file
 * 2. Converts each sheet to HTML (preserves merged cells, structure)
 * 3. Saves HTML outputs for AI consumption
 * 4. Generates thumbnail image from first sheet
 */

import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

export interface ExcelSheetData {
  sheetName: string;
  html: string;
  range: string;  // e.g., "A1:Z100"
  merges?: XLSX.Range[];  // Merged cell information
}

export interface ExcelProcessResult {
  sheets: ExcelSheetData[];  // All sheets as HTML
  firstSheetHtml: string;  // First sheet for thumbnail
  sheetNames: string[];
  filePath: string;
  timestamp: number;
}

export interface ThumbnailOptions {
  saveHtml?: boolean;  // Save HTML files to disk
  outputDir?: string;  // Where to save HTML files
}

/**
 * Detect table corners by border + empty neighbor logic
 *
 * TOP-LEFT corner:
 *   - Cell has top border AND left border
 *   - Cell ABOVE is empty (no value)
 *   - Cell to LEFT is empty (no value)
 */
export async function detectTablesByEmptyGaps(
  fileBuffer: Buffer
): Promise<Array<{
  name: string;
  range: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}>> {
  const tables: Array<any> = [];
  const corners = {
    topLeft: [] as Array<{ row: number; col: number; address: string; value: any }>,
    topRight: [] as Array<{ row: number; col: number; address: string; value: any }>,
    bottomLeft: [] as Array<{ row: number; col: number; address: string; value: any }>,
    bottomRight: [] as Array<{ row: number; col: number; address: string; value: any }>,
  };

  try {
    console.log('[Corner Detection] Finding table corners (border + empty neighbor)...');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[0];
    console.log('[Corner Detection] Worksheet:', worksheet.name);

    // IMMEDIATE A3 DEBUG - before any processing
    console.log('\n========== IMMEDIATE A3 DEBUG ==========');
    const a3 = worksheet.getCell(3, 1); // Row 3, Col 1 = A3
    const a2 = worksheet.getCell(2, 1); // A2 (above)
    const a4 = worksheet.getCell(4, 1); // A4 (below)
    const b3 = worksheet.getCell(3, 2); // B3 (right)

    console.log('A3:', {
      address: a3.address,
      value: a3.value,
      border: a3.border,
      isMerged: a3.isMerged,
    });
    console.log('A2 (above):', {
      address: a2.address,
      value: a2.value,
      border: a2.border,
    });
    console.log('A4 (below):', {
      address: a4.address,
      value: a4.value,
      border: a4.border,
    });
    console.log('B3 (right):', {
      address: b3.address,
      value: b3.value,
      border: b3.border,
    });
    console.log('========================================\n');

    console.log('[Corner Detection] Starting full sheet scan...');
    let cellsScanned = 0;
    let a3Scanned = false;

    // Helper: check if cell has NO borders (data doesn't matter!)
    const hasNoBorders = (row: number, col: number): boolean => {
      try {
        const cell = worksheet.getCell(row, col);
        const border = cell.border;

        // Cell has no borders if border object doesn't exist OR all sides are 'none'
        return !border || (
          (!border.top || border.top.style === 'none') &&
          (!border.bottom || border.bottom.style === 'none') &&
          (!border.left || border.left.style === 'none') &&
          (!border.right || border.right.style === 'none')
        );
      } catch {
        return true; // Out of bounds = no borders
      }
    };

    // Helper: get merge range if cell is merged
    const getMergeRange = (row: number, col: number): { top: number; left: number; bottom: number; right: number } | null => {
      try {
        const cell = worksheet.getCell(row, col);
        if (cell.isMerged) {
          // Get the master cell
          const master = cell.master || cell;
          // ExcelJS merge format: "A1:D1"
          const mergeAddr = master.address;
          // Need to check worksheet merges
          const merges = worksheet.model.merges || [];
          for (const merge of merges) {
            // merge format in ExcelJS: "A1:D1" string
            if (typeof merge === 'string') {
              const [start, end] = merge.split(':');
              const startCell = worksheet.getCell(start);
              const endCell = worksheet.getCell(end);

              // Check if our cell is in this merge
              if (startCell.row <= row && row <= endCell.row &&
                  startCell.col <= col && col <= endCell.col) {
                return {
                  top: startCell.row,
                  left: startCell.col,
                  bottom: endCell.row,
                  right: endCell.col,
                };
              }
            }
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    // Helper: check if cell has border on a side (merge-aware)
    const hasBorder = (row: number, col: number, side: string): boolean => {
      try {
        const cell = worksheet.getCell(row, col);
        const border = cell.border;
        if (!border || !border[side]) return false;
        const style = border[side].style;
        return style && style !== 'none';
      } catch {
        return false;
      }
    };

    // Scan all cells for corners (merge-aware)
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cellsScanned++;

        // Track if we scanned A3
        if (cell.address === 'A3') {
          a3Scanned = true;
        }

        // DEBUG: Detailed A3 logging
        if (cell.address === 'A3') {
          const cellA2 = worksheet.getCell(2, 1);
          console.log('\n[DEBUG] === A3 DETAILED CHECK ===');
          console.log('A3 value:', cell.value);
          console.log('A3 border:', cell.border);
          console.log('A3 isMerged:', cell.isMerged);
          console.log('---');
          console.log('A2 value:', cellA2.value);
          console.log('A2 border:', cellA2.border);
          console.log('A2 hasNoBorders result:', hasNoBorders(2, 1));
          console.log('---');
          console.log('Will A3 be skipped? (no border):', !cell.border);
          console.log('=== END A3 DEBUG ===\n');
        }

        // Don't skip empty cells - check for borders instead!
        const border = cell.border;
        if (!border) return; // Skip cells with NO borders at all

        // Get merge range if this cell is merged
        const mergeRange = getMergeRange(rowNumber, colNumber);

        // Determine actual boundaries (accounting for merges)
        const actualTop = mergeRange ? mergeRange.top : rowNumber;
        const actualBottom = mergeRange ? mergeRange.bottom : rowNumber;
        const actualLeft = mergeRange ? mergeRange.left : colNumber;
        const actualRight = mergeRange ? mergeRange.right : colNumber;

        // TOP-LEFT corner: has top+left borders, cells outside have NO borders (data irrelevant)
        if (rowNumber === actualTop && colNumber === actualLeft) {
          const aboveHasNoBorders = actualTop === 1 || hasNoBorders(actualTop - 1, actualLeft);  // Row 1 = sheet edge
          const leftHasNoBorders = actualLeft === 1 || hasNoBorders(actualTop, actualLeft - 1);  // Col 1 = sheet edge

          if (
            hasBorder(actualTop, actualLeft, 'top') &&
            hasBorder(actualTop, actualLeft, 'left') &&
            aboveHasNoBorders &&
            leftHasNoBorders
          ) {
            corners.topLeft.push({
              row: actualTop,
              col: actualLeft,
              address: cell.address,
              value: cell.value,
            });
            console.log(`[Corner Detection] 📍 TOP-LEFT: ${cell.address} = "${cell.value}"${mergeRange ? ' (merged)' : ''}`);
          }
        }

        // TOP-RIGHT corner: has top+right borders, cells outside have NO borders (data irrelevant)
        if (rowNumber === actualTop && colNumber === actualRight) {
          const aboveHasNoBorders = actualTop === 1 || hasNoBorders(actualTop - 1, actualRight);
          const rightHasNoBorders = actualRight === worksheet.columnCount || hasNoBorders(actualTop, actualRight + 1);

          if (
            hasBorder(actualTop, actualRight, 'top') &&
            hasBorder(actualTop, actualRight, 'right') &&
            aboveHasNoBorders &&
            rightHasNoBorders
          ) {
            corners.topRight.push({
              row: actualTop,
              col: actualRight,
              address: worksheet.getCell(actualTop, actualRight).address,
              value: cell.value,
            });
            console.log(`[Corner Detection] 📍 TOP-RIGHT: ${worksheet.getCell(actualTop, actualRight).address} = "${cell.value}"${mergeRange ? ' (merged)' : ''}`);
          }
        }

        // BOTTOM-LEFT corner: has bottom+left borders, cells outside have NO borders (data irrelevant)
        if (rowNumber === actualBottom && colNumber === actualLeft) {
          const belowHasNoBorders = actualBottom === worksheet.rowCount || hasNoBorders(actualBottom + 1, actualLeft);
          const leftHasNoBorders = actualLeft === 1 || hasNoBorders(actualBottom, actualLeft - 1);

          if (
            hasBorder(actualBottom, actualLeft, 'bottom') &&
            hasBorder(actualBottom, actualLeft, 'left') &&
            belowHasNoBorders &&
            leftHasNoBorders
          ) {
            corners.bottomLeft.push({
              row: actualBottom,
              col: actualLeft,
              address: worksheet.getCell(actualBottom, actualLeft).address,
              value: cell.value,
            });
            console.log(`[Corner Detection] 📍 BOTTOM-LEFT: ${worksheet.getCell(actualBottom, actualLeft).address} = "${cell.value}"${mergeRange ? ' (merged)' : ''}`);
          }
        }

        // BOTTOM-RIGHT corner: has bottom+right borders, cells outside have NO borders (data irrelevant)
        if (rowNumber === actualBottom && colNumber === actualRight) {
          const belowHasNoBorders = actualBottom === worksheet.rowCount || hasNoBorders(actualBottom + 1, actualRight);
          const rightHasNoBorders = actualRight === worksheet.columnCount || hasNoBorders(actualBottom, actualRight + 1);

          if (
            hasBorder(actualBottom, actualRight, 'bottom') &&
            hasBorder(actualBottom, actualRight, 'right') &&
            belowHasNoBorders &&
            rightHasNoBorders
          ) {
            corners.bottomRight.push({
              row: actualBottom,
              col: actualRight,
              address: worksheet.getCell(actualBottom, actualRight).address,
              value: cell.value,
            });
            console.log(`[Corner Detection] 📍 BOTTOM-RIGHT: ${worksheet.getCell(actualBottom, actualRight).address} = "${cell.value}"${mergeRange ? ' (merged)' : ''}`);
          }
        }
      });
    });

    console.log('[Corner Detection] Summary:');
    console.log(`  - Cells scanned: ${cellsScanned}`);
    console.log(`  - A3 was scanned: ${a3Scanned}`);
    console.log(`  - TOP-LEFT corners: ${corners.topLeft.length}`);
    console.log(`  - TOP-RIGHT corners: ${corners.topRight.length}`);
    console.log(`  - BOTTOM-LEFT corners: ${corners.bottomLeft.length}`);
    console.log(`  - BOTTOM-RIGHT corners: ${corners.bottomRight.length}`);

    // Match corners to form complete tables
    // Each table should have: 1 top-left, 1 top-right, 1 bottom-left, 1 bottom-right
    for (const topLeft of corners.topLeft) {
      // Find matching top-right (same row, col > topLeft.col)
      const topRight = corners.topRight.find(
        (tr) => tr.row === topLeft.row && tr.col > topLeft.col
      );

      // Find matching bottom-left (same col, row > topLeft.row)
      const bottomLeft = corners.bottomLeft.find(
        (bl) => bl.col === topLeft.col && bl.row > topLeft.row
      );

      // Find matching bottom-right (row matches bottom-left, col matches top-right)
      const bottomRight = corners.bottomRight.find(
        (br) => bottomLeft && topRight && br.row === bottomLeft.row && br.col === topRight.col
      );

      if (topRight && bottomLeft && bottomRight) {
        const table = {
          name: `Table: ${topLeft.value}`,
          range: `${topLeft.address}:${bottomRight.address}`,
          rowStart: topLeft.row,
          rowEnd: bottomRight.row,
          colStart: topLeft.col,
          colEnd: bottomRight.col,
        };
        tables.push(table);
        console.log(`[Corner Detection] ✅ Matched table: ${table.name} (${table.range})`);
      }
    }

    console.log(`[Corner Detection] ✅ Detected ${tables.length} complete tables`);

  } catch (error: any) {
    console.error('[Corner Detection] Error:', error);
  }

  return tables;
}

/**
 * Trim trailing empty rows from worksheet
 * Keeps empty rows in the middle (for island table separation)
 * Only removes continuous empty rows at the end
 */
export function trimTrailingEmptyRows(worksheet: XLSX.WorkSheet): void {
  if (!worksheet['!ref']) {
    return;
  }

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  let lastDataRow = range.s.r; // Start with first row

  // Scan from bottom up to find last row with any data
  for (let row = range.e.r; row >= range.s.r; row--) {
    let hasData = false;

    // Check all columns in this row
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];

      // Cell has data if it exists and has a value (not just formatting)
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      lastDataRow = row;
      break;
    }
  }

  // Add small margin (2 rows) for safety
  const newEndRow = Math.min(lastDataRow + 2, range.e.r);

  // Update range if we found trailing empties
  if (newEndRow < range.e.r) {
    const originalRows = range.e.r - range.s.r + 1;
    const newRows = newEndRow - range.s.r + 1;
    const trimmedRows = originalRows - newRows;

    worksheet['!ref'] = XLSX.utils.encode_range({
      s: range.s,
      e: { r: newEndRow, c: range.e.c },
    });

    console.log(
      `[ThumbnailHandler] Trimmed ${trimmedRows} trailing empty rows (${originalRows} → ${newRows} rows)`
    );
  }
}

/**
 * Process Excel file and convert ALL sheets to HTML
 * This preserves merged cells, formatting, and structure for AI analysis
 */
export async function processExcelFile(
  filePath: string,
  options: ThumbnailOptions = {}
): Promise<ExcelProcessResult> {
  const { saveHtml = false, outputDir } = options;

  try {
    console.log('[ThumbnailHandler] Processing Excel file:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file as buffer
    const buffer = fs.readFileSync(filePath);
    console.log('[ThumbnailHandler] File buffer loaded, size:', buffer.length, 'bytes');

    // Parse Excel workbook
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellStyles: true,  // Preserve styling
      cellNF: true,      // Preserve number formats
    });

    if (workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }

    console.log('[ThumbnailHandler] Found sheets:', workbook.SheetNames);

    // Process all sheets
    const sheets: ExcelSheetData[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      // Trim trailing empty rows (keeps island structure intact)
      const originalRange = worksheet['!ref'] || 'A1';
      trimTrailingEmptyRows(worksheet);
      const trimmedRange = worksheet['!ref'] || 'A1';

      // Convert sheet to HTML (preserves merged cells!)
      const html = XLSX.utils.sheet_to_html(worksheet, {
        id: `excel-sheet-${sheetName.replace(/\s+/g, '-')}`,
        editable: false,
        header: '',  // No wrapper HTML
        footer: '',
      });

      // Get sheet metadata
      const range = trimmedRange;
      const merges = worksheet['!merges'] || [];

      sheets.push({
        sheetName,
        html,
        range,
        merges,
      });

      console.log(`[ThumbnailHandler] Processed sheet "${sheetName}" (${range}), ${merges.length} merged cells`);
    }

    // Save HTML files if requested
    if (saveHtml && outputDir) {
      await saveHtmlFiles(filePath, sheets, outputDir);
    }

    return {
      sheets,
      firstSheetHtml: sheets[0].html,
      sheetNames: workbook.SheetNames,
      filePath,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error('[ThumbnailHandler] Error processing Excel file:', error);
    throw new Error(`Failed to process Excel file: ${error.message}`);
  }
}

/**
 * Save HTML files for all sheets
 */
async function saveHtmlFiles(
  excelFilePath: string,
  sheets: ExcelSheetData[],
  outputDir: string
): Promise<void> {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(excelFilePath, path.extname(excelFilePath));

    for (const sheet of sheets) {
      const sanitizedSheetName = sheet.sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const htmlFileName = `${baseName}_${sanitizedSheetName}.html`;
      const htmlFilePath = path.join(outputDir, htmlFileName);

      // Wrap HTML in a basic document structure
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${sheet.sheetName}</title>
  <style>
    table {
      border-collapse: collapse;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    td {
      border: 1px solid #ccc;
      padding: 4px 8px;
      white-space: nowrap;
    }
    td[colspan] {
      background: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>${sheet.sheetName}</h1>
  <div>Range: ${sheet.range}</div>
  <div>Merged cells: ${sheet.merges?.length || 0}</div>
  <hr>
  ${sheet.html}
</body>
</html>`;

      fs.writeFileSync(htmlFilePath, fullHtml, 'utf-8');
      console.log(`[ThumbnailHandler] Saved HTML: ${htmlFilePath}`);
    }
  } catch (error: any) {
    console.error('[ThumbnailHandler] Error saving HTML files:', error);
    throw error;
  }
}

/**
 * Wrap Excel HTML for thumbnail rendering
 * Takes the raw HTML from XLSX and adds styling for thumbnail generation
 */
export function wrapHtmlForThumbnail(html: string, sheetName: string): string {
  return `
    <div style="
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      width: 1000px;
      max-width: 1000px;
    ">
      <div style="
        font-size: 14px;
        font-weight: bold;
        color: #2E7D32;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #2E7D32;
      ">
        ${sheetName}
      </div>
      <style>
        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 10px;
        }
        td {
          border: 1px solid #ddd;
          padding: 4px 8px;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }
        td[colspan] {
          background: #e8f5e9;
          font-weight: bold;
          text-align: center;
          font-size: 11px;
        }
        tr:first-child td {
          background: #2E7D32;
          color: white;
          font-weight: 600;
        }
      </style>
      ${html}
    </div>
  `;
}

/**
 * LEGACY: Read Excel preview data (for backward compatibility)
 * Used by desktop-recorder-handlers.ts
 */
export interface ExcelPreviewData {
  headers: string[];
  rows: (string | number)[][];
  sheetName: string;
  totalRows: number;
  totalColumns: number;
}

export async function readExcelPreview(
  filePath: string,
  options: { maxRows?: number; maxColumns?: number; includeHeaders?: boolean } = {}
): Promise<ExcelPreviewData> {
  const { maxRows, maxColumns, includeHeaders = true } = options;

  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const allHeaders = data[0]?.map((cell) => String(cell || '')) || [];
  const headers = maxColumns ? allHeaders.slice(0, maxColumns) : allHeaders;

  const startRow = includeHeaders ? 1 : 0;
  const endRow = maxRows ? startRow + maxRows : data.length;
  const dataRows = data.slice(startRow, endRow).map((row) => {
    const fullRow = row.map((cell) => String(cell || ''));
    return maxColumns ? fullRow.slice(0, maxColumns) : fullRow;
  });

  return {
    headers,
    rows: dataRows,
    sheetName,
    totalRows: data.length,
    totalColumns: allHeaders.length,
  };
}

/**
 * LEGACY: Generate HTML from preview data (for backward compatibility)
 * Used by desktop-recorder-handlers.ts
 */
export function generateExcelHTML(previewData: ExcelPreviewData): string {
  const { headers, rows, totalRows, totalColumns } = previewData;
  const isPartial = rows.length < totalRows - 1 || headers.length < totalColumns;

  let html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; padding: 12px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 1000px;">
      <table style="border-collapse: collapse; width: 100%; font-size: 9px;">
        <thead><tr style="background: #2E7D32; color: white;">`;

  headers.forEach((header) => {
    html += `<th style="border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-weight: 600; white-space: nowrap; max-width: 150px;">${header}</th>`;
  });

  html += `</tr></thead><tbody>`;

  rows.forEach((row, rowIdx) => {
    const bgColor = rowIdx % 2 === 0 ? '#f9f9f9' : 'white';
    html += `<tr style="background: ${bgColor};">`;
    row.forEach((cell) => {
      html += `<td style="border: 1px solid #ddd; padding: 4px 6px; color: #333; white-space: nowrap; max-width: 150px;">${cell}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  if (isPartial) {
    const moreRows = totalRows - rows.length - 1;
    const moreCols = totalColumns - headers.length;
    html += `<div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px; text-align: center; color: #666; font-size: 10px; font-weight: 600;">`;
    if (moreRows > 0) html += `+ ${moreRows} more rows`;
    if (moreRows > 0 && moreCols > 0) html += ` · `;
    if (moreCols > 0) html += `${moreCols} more columns`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Get file info for display
 */
export function getExcelFileInfo(filePath: string): {
  name: string;
  size: number;
  extension: string;
} {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);

  return {
    name,
    size: stats.size,
    extension: ext,
  };
}

/**
 * Main function to generate Excel thumbnail
 * Returns HTML for the first sheet, ready for html2canvas conversion
 */
export async function generateExcelThumbnail(
  filePath: string,
  options?: {
    saveHtml?: boolean;
    htmlOutputDir?: string;
  }
): Promise<{
  success: boolean;
  html?: string;  // Wrapped HTML for thumbnail (first sheet)
  sheetName?: string;
  allSheets?: ExcelSheetData[];  // All sheets as HTML (for AI)
  message?: string;
}> {
  try {
    // Process Excel file (all sheets)
    const result = await processExcelFile(filePath, {
      saveHtml: options?.saveHtml,
      outputDir: options?.htmlOutputDir,
    });

    // Wrap first sheet HTML for thumbnail
    const wrappedHtml = wrapHtmlForThumbnail(
      result.firstSheetHtml,
      result.sheetNames[0]
    );

    return {
      success: true,
      html: wrappedHtml,
      sheetName: result.sheetNames[0],
      allSheets: result.sheets,  // Return all sheets for AI processing
    };
  } catch (error: any) {
    console.error('[ThumbnailHandler] Error generating thumbnail:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}
