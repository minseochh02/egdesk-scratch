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

    // IMMEDIATE O3 DEBUG - before any processing
    console.log('\n========== IMMEDIATE O3 DEBUG ==========');
    const o3 = worksheet.getCell(3, 15); // Row 3, Col 15 = O3
    const o2 = worksheet.getCell(2, 15); // O2 (above)
    const o4 = worksheet.getCell(4, 15); // O4 (below)
    const n3 = worksheet.getCell(3, 14); // N3 (left)
    const p3 = worksheet.getCell(3, 16); // P3 (right)

    console.log('O3:', {
      address: o3.address,
      value: o3.value,
      border: o3.border,
      isMerged: o3.isMerged,
    });
    console.log('O2 (above):', {
      address: o2.address,
      value: o2.value,
      border: o2.border,
    });
    console.log('N3 (left):', {
      address: n3.address,
      value: n3.value,
      border: n3.border,
    });
    console.log('P3 (right):', {
      address: p3.address,
      value: p3.value,
      border: p3.border,
    });
    console.log('========================================\n');

    console.log('[Corner Detection] Starting full sheet scan...');
    let cellsScanned = 0;
    let o3Scanned = false;

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

        // Track if we scanned O3
        if (cell.address === 'O3') {
          o3Scanned = true;

          const cellO2 = worksheet.getCell(2, 15);
          const cellN3 = worksheet.getCell(3, 14);
          const cellP3 = worksheet.getCell(3, 16);

          console.log('\n[DEBUG] === O3 IN-SCAN CHECK ===');
          console.log('O3 reached in scan!');
          console.log('O3 value:', cell.value);
          console.log('O3 border:', cell.border);
          console.log('O3 isMerged:', cell.isMerged);
          console.log('Will skip (no border)?:', !cell.border);

          if (cell.border) {
            console.log('Checking TOP-LEFT conditions:');
            console.log('  - O3 has top border:', hasBorder(3, 15, 'top'));
            console.log('  - O3 has left border:', hasBorder(3, 15, 'left'));
            console.log('  - O2 (above) hasNoBorders:', hasNoBorders(2, 15));
            console.log('  - N3 (left) hasNoBorders:', hasNoBorders(3, 14));
            console.log('O2 border:', cellO2.border);
            console.log('N3 border:', cellN3.border);
          }
          console.log('=== END O3 IN-SCAN ===\n');
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
    console.log(`  - O3 was scanned: ${o3Scanned}`);
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

    return tables;
  } catch (error: any) {
    console.error('[Corner Detection] Error:', error);
    return tables;
  }
}

/**
 * Convert column number to Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
 */
function columnNumberToLetter(col: number): string {
  let letter = '';
  let temp = col;

  while (temp > 0) {
    const remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - 1) / 26);
  }

  return letter;
}

/**
 * Generate Excel-style cell address (e.g., "A1", "B5", "AA10")
 */
function getCellAddress(row: number, col: number): string {
  return `${columnNumberToLetter(col)}${row}`;
}

/**
 * Extract cell value properly, handling formulas, rich text, and objects
 * Use cell.text which is the formatted display value (same as console.log shows)
 */
function extractCellValue(cell: any): string {
  try {
    // ExcelJS cell.text gives the formatted display value
    // Wrap in try-catch because MergeValue.toString() can throw on null
    if (cell.text !== undefined && cell.text !== null && cell.text !== '') {
      return String(cell.text);
    }
  } catch (error) {
    // cell.text failed, fall through to value extraction
  }

  // Fallback to cell.value if text failed
  const value = cell.value;
  if (!value) return '';

  // If value is primitive, return it
  if (typeof value !== 'object') {
    return String(value);
  }

  // Handle object values
  if ('result' in value && value.result !== null && value.result !== undefined) {
    return String(value.result);
  }
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((rt: any) => rt.text).join('');
  }
  if ('text' in value && value.text !== null) {
    return String(value.text);
  }
  if ('hyperlink' in value && value.hyperlink !== null) {
    return String(value.hyperlink);
  }

  // Don't show [object Object] for shared formulas or unknown types
  return '';
}

/**
 * Generate semantic HTML using detected table boundaries
 * Detected tables → <table> elements
 * Other content → <div> with grid CSS
 */
export async function generateSemanticHTML(
  fileBuffer: Buffer,
  detectedTables: Array<{
    name: string;
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  }>
): Promise<string> {
  try {
    console.log('[Semantic HTML] Generating semantic HTML for', detectedTables.length, 'tables');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];

    // Track which cells belong to detected tables
    const tableCellMap = new Map<string, number>(); // "row,col" → tableIndex

    for (let tableIdx = 0; tableIdx < detectedTables.length; tableIdx++) {
      const table = detectedTables[tableIdx];
      for (let r = table.rowStart; r <= table.rowEnd; r++) {
        for (let c = table.colStart; c <= table.colEnd; c++) {
          tableCellMap.set(`${r},${c}`, tableIdx);
        }
      }
    }

    // Get dimensions
    const dimensions = worksheet.dimensions;
    if (!dimensions) {
      throw new Error('No worksheet dimensions');
    }

    const maxRow = dimensions.bottom;
    const maxCol = dimensions.right;

    console.log('[Semantic HTML] Using CSS Grid layout to preserve exact positioning...');
    console.log('[Semantic HTML] Grid size:', maxRow, 'rows x', maxCol, 'columns');

    // Use CSS Grid to position everything at exact coordinates
    let html = `<div class="excel-document" style="display: grid; grid-template-rows: repeat(${maxRow}, auto); grid-template-columns: repeat(${maxCol}, auto); gap: 0;">\n`;

    // Render each detected table as a grid item
    for (const table of detectedTables) {
      const rowSpan = table.rowEnd - table.rowStart + 1;
      const colSpan = table.colEnd - table.colStart + 1;

      html += `  <div class="table-region" style="grid-row: ${table.rowStart} / span ${rowSpan}; grid-column: ${table.colStart} / span ${colSpan};">\n`;

      if (table.name && !table.name.includes('null') && !table.name.startsWith('Table: Table')) {
        html += `    <div class="table-title">${table.name}</div>\n`;
      }

      html += `    <table class="detected-table">\n`;

        // Render table rows
        const processedCells = new Set<string>();

        for (let r = table.rowStart; r <= table.rowEnd; r++) {
          html += '      <tr>\n';

          for (let c = table.colStart; c <= table.colEnd; c++) {
            const cellKey = `${r},${c}`;

            if (processedCells.has(cellKey)) {
              continue;
            }

            const cell = worksheet.getCell(r, c);
            const value = extractCellValue(cell);

            let colspan = 1;
            let rowspan = 1;

            // Check for merges
            if (cell.isMerged) {
              const master = cell.master || cell;
              const merges = worksheet.model.merges || [];

              for (const merge of merges) {
                if (typeof merge === 'string') {
                  const [start, end] = merge.split(':');
                  const startCell = worksheet.getCell(start);
                  const endCell = worksheet.getCell(end);

                  if (
                    startCell.row <= r && r <= endCell.row &&
                    startCell.col <= c && c <= endCell.col
                  ) {
                    if (startCell.row === r && startCell.col === c) {
                      colspan = endCell.col - startCell.col + 1;
                      rowspan = endCell.row - startCell.row + 1;

                      for (let mr = startCell.row; mr <= endCell.row; mr++) {
                        for (let mc = startCell.col; mc <= endCell.col; mc++) {
                          processedCells.add(`${mr},${mc}`);
                        }
                      }
                    } else {
                      processedCells.add(cellKey);
                      continue;
                    }
                    break;
                  }
                }
              }
            } else {
              processedCells.add(cellKey);
            }

            let tdAttrs = '';
            if (colspan > 1) tdAttrs += ` colspan="${colspan}"`;
            if (rowspan > 1) tdAttrs += ` rowspan="${rowspan}"`;

            // Add cell ID (e.g., "A1", "B5")
            const cellId = getCellAddress(r, c);
            tdAttrs += ` id="${cellId}" data-cell="${cellId}"`;

            html += `        <td${tdAttrs}>${value || ''}</td>\n`;
          }

          html += '      </tr>\n';
        }

        html += '    </table>\n';
        html += '  </div>\n\n';
    }

    html += '</div>';

    console.log('[Semantic HTML] Complete - preserved exact row order');

    return html;
  } catch (error: any) {
    console.error('[Semantic HTML] Error:', error);
    throw error;
  }
}

// OLD CODE REMOVED - using row-by-row approach now
/*
    // OLD: Generate all tables first, then non-table content
    for (let tableIdx = 0; tableIdx < detectedTables.length; tableIdx++) {
      const table = detectedTables[tableIdx];

      html += `  <div class="table-region" data-table-index="${tableIdx}">\n`;

      // Only show title if it's not null/empty/generic
      if (table.name && !table.name.includes('null') && !table.name.startsWith('Table: Table')) {
        html += `    <div class="table-title">${table.name}</div>\n`;
      }

      html += `    <table class="detected-table">\n`;

      // Track processed cells (for merged cell handling)
      const processedCells = new Set<string>();

      for (let r = table.rowStart; r <= table.rowEnd; r++) {
        html += '      <tr>\n';

        for (let c = table.colStart; c <= table.colEnd; c++) {
          const cellKey = `${r},${c}`;

          // Skip if already processed (part of a merge)
          if (processedCells.has(cellKey)) {
            continue;
          }

          const cell = worksheet.getCell(r, c);
          const value = extractCellValue(cell);

          let colspan = 1;
          let rowspan = 1;

          // Check if this cell is part of a merge
          if (cell.isMerged) {
            const master = cell.master || cell;

            // Find the merge range
            const merges = worksheet.model.merges || [];
            for (const merge of merges) {
              if (typeof merge === 'string') {
                const [start, end] = merge.split(':');
                const startCell = worksheet.getCell(start);
                const endCell = worksheet.getCell(end);

                // Check if our cell is in this merge
                if (
                  startCell.row <= r && r <= endCell.row &&
                  startCell.col <= c && c <= endCell.col
                ) {
                  if (startCell.row === r && startCell.col === c) {
                    // This is the master cell
                    colspan = endCell.col - startCell.col + 1;
                    rowspan = endCell.row - startCell.row + 1;

                    // Mark all cells in merge as processed
                    for (let mr = startCell.row; mr <= endCell.row; mr++) {
                      for (let mc = startCell.col; mc <= endCell.col; mc++) {
                        processedCells.add(`${mr},${mc}`);
                      }
                    }
                  } else {
                    // Not master, skip
                    processedCells.add(cellKey);
                    continue;
                  }
                  break;
                }
              }
            }
          } else {
            processedCells.add(cellKey);
          }

          // Build td attributes
          let tdAttrs = '';
          if (colspan > 1) tdAttrs += ` colspan="${colspan}"`;
          if (rowspan > 1) tdAttrs += ` rowspan="${rowspan}"`;

          html += `        <td${tdAttrs}>${value || ''}</td>\n`;
        }

        html += '      </tr>\n';
      }

      html += '    </table>\n';
      html += '  </div>\n\n';
    }

    // Generate non-table content as div grid
    console.log('[Semantic HTML] Generating non-table content...');

    // Build non-table content row by row
    const nonTableRows: Array<{ row: number; cells: Array<{ col: number; value: string; hasContent: boolean }> }> = [];

    // Use actual dimensions from worksheet
    const dimensions = worksheet.dimensions;
    if (!dimensions) {
      console.log('[Semantic HTML] No dimensions found, skipping non-table content');
    } else {
      const maxRow = dimensions.bottom;
      const maxCol = dimensions.right;

      console.log('[Semantic HTML] Scanning rows 1-', maxRow, ', cols 1-', maxCol);

      for (let r = 1; r <= maxRow; r++) {
        const rowCells: Array<{ col: number; value: string; hasContent: boolean }> = [];
        let rowHasNonTableContent = false;

        for (let c = 1; c <= maxCol; c++) {
          const cellKey = `${r},${c}`;

          // Skip if this cell belongs to a detected table
          if (tableCellMap.has(cellKey)) {
            continue;
          }

          const cell = worksheet.getCell(r, c);
          const value = extractCellValue(cell);
          const hasContent = !!value;

          if (hasContent) {
            rowHasNonTableContent = true;
          }

          rowCells.push({ col: c, value, hasContent });
        }

        // Only add row if it has at least one cell with content
        if (rowHasNonTableContent) {
          nonTableRows.push({ row: r, cells: rowCells });
        }
      }
    }

    if (nonTableRows.length > 0) {
      html += '  <div class="non-table-content">\n';
      html += '    <div class="section-title">Other Content (Headers, Notes, etc.)</div>\n';
      html += '    <div class="grid-layout">\n';

      for (const rowData of nonTableRows) {
        html += `      <div class="grid-row" data-row="${rowData.row}">\n`;
        for (const cellData of rowData.cells) {
          const cellClass = cellData.hasContent ? 'grid-cell has-content' : 'grid-cell empty';
          const displayValue = cellData.value || '';
          html += `        <div class="${cellClass}" data-col="${cellData.col}">${displayValue}</div>\n`;
        }
        html += '      </div>\n';
      }

      html += '    </div>\n';
      html += '  </div>\n';

      console.log('[Semantic HTML] Generated', nonTableRows.length, 'rows of non-table content');
    } else {
      console.log('[Semantic HTML] No non-table content found');
    }

    html += '</div>';

    console.log('[Semantic HTML] Complete:');
    console.log(`  - ${detectedTables.length} table elements`);
    console.log(`  - ${nonTableRows.length} rows of non-table content`);

    return html;
  } catch (error: any) {
    console.error('[Semantic HTML] Error:', error);
    throw error;
  }
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
