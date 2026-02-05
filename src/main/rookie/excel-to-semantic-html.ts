/**
 * Generate semantic HTML with exact Excel layout
 * Uses CSS Grid to position tables and cells at exact row/col coordinates
 */

import * as ExcelJS from 'exceljs';

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
 * Extract cell display value
 */
function getCellText(cell: any): string {
  try {
    // Try cell.text first (formatted value)
    if (cell.text !== undefined && cell.text !== null && cell.text !== '') {
      return String(cell.text);
    }
  } catch {
    // cell.text failed for merged cells with null
  }

  const value = cell.value;
  if (!value) return '';
  if (typeof value !== 'object') return String(value);

  // Handle object values
  if ('result' in value && value.result) return String(value.result);
  if ('richText' in value) return value.richText.map((rt: any) => rt.text).join('');
  if ('text' in value && value.text) return String(value.text);

  return '';
}

export async function generateSemanticHTMLWithGrid(
  fileBuffer: Buffer,
  detectedTables: Array<{
    name: string;
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  }>
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];

  const dimensions = worksheet.dimensions;
  if (!dimensions) throw new Error('No dimensions');

  const maxRow = dimensions.bottom;
  const maxCol = dimensions.right;

  console.log('[Semantic HTML] Grid:', maxRow, 'rows x', maxCol, 'cols');

  let html = `<div class="excel-grid" style="display: grid; grid-template-rows: repeat(${maxRow}, auto); grid-template-columns: repeat(${maxCol}, minmax(80px, auto)); gap: 2px;">\n`;

  // Mark table cells
  const tableCells = new Set<string>();
  for (const table of detectedTables) {
    for (let r = table.rowStart; r <= table.rowEnd; r++) {
      for (let c = table.colStart; c <= table.colEnd; c++) {
        tableCells.add(`${r},${c}`);
      }
    }
  }

  // Render detected tables
  for (const table of detectedTables) {
    const rowSpan = table.rowEnd - table.rowStart + 1;
    const colSpan = table.colEnd - table.colStart + 1;

    html += `  <div class="table-wrapper" style="grid-row: ${table.rowStart} / span ${rowSpan}; grid-column: ${table.colStart} / span ${colSpan};">\n`;

    if (table.name && !table.name.includes('null')) {
      html += `    <div class="table-title">${table.name}</div>\n`;
    }

    html += `    <table class="detected-table">\n`;

    // Render table content
    const processed = new Set<string>();
    for (let r = table.rowStart; r <= table.rowEnd; r++) {
      html += '      <tr>\n';

      for (let c = table.colStart; c <= table.colEnd; c++) {
        const key = `${r},${c}`;
        if (processed.has(key)) continue;

        const cell = worksheet.getCell(r, c);
        const value = getCellText(cell);
        let colspan = 1;
        let rowspan = 1;

        // Handle merges
        if (cell.isMerged) {
          const merges = worksheet.model.merges || [];
          for (const merge of merges) {
            if (typeof merge === 'string') {
              const [start, end] = merge.split(':');
              const sCell = worksheet.getCell(start);
              const eCell = worksheet.getCell(end);

              if (sCell.row <= r && r <= eCell.row && sCell.col <= c && c <= eCell.col) {
                if (sCell.row === r && sCell.col === c) {
                  colspan = eCell.col - sCell.col + 1;
                  rowspan = eCell.row - sCell.row + 1;
                  for (let mr = sCell.row; mr <= eCell.row; mr++) {
                    for (let mc = sCell.col; mc <= eCell.col; mc++) {
                      processed.add(`${mr},${mc}`);
                    }
                  }
                } else {
                  processed.add(key);
                  continue;
                }
                break;
              }
            }
          }
        } else {
          processed.add(key);
        }

        let attrs = '';
        if (colspan > 1) attrs += ` colspan="${colspan}"`;
        if (rowspan > 1) attrs += ` rowspan="${rowspan}"`;

        // Add cell ID (e.g., "A1", "B5")
        const cellId = getCellAddress(r, c);
        attrs += ` id="${cellId}" data-cell="${cellId}"`;

        html += `        <td${attrs}>${value}</td>\n`;
      }

      html += '      </tr>\n';
    }

    html += '    </table>\n';
    html += '  </div>\n';
  }

  // Render non-table cells
  const processedGrid = new Set<string>();
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const key = `${r},${c}`;

      if (tableCells.has(key) || processedGrid.has(key)) {
        continue;
      }

      const cell = worksheet.getCell(r, c);
      const value = getCellText(cell);

      // Handle merged cells in grid
      let rowSpan = 1;
      let colSpan = 1;

      if (cell.isMerged) {
        const merges = worksheet.model.merges || [];
        for (const merge of merges) {
          if (typeof merge === 'string') {
            const [start, end] = merge.split(':');
            const sCell = worksheet.getCell(start);
            const eCell = worksheet.getCell(end);

            if (sCell.row <= r && r <= eCell.row && sCell.col <= c && c <= eCell.col) {
              if (sCell.row === r && sCell.col === c) {
                rowSpan = eCell.row - sCell.row + 1;
                colSpan = eCell.col - sCell.col + 1;
                for (let mr = sCell.row; mr <= eCell.row; mr++) {
                  for (let mc = sCell.col; mc <= eCell.col; mc++) {
                    processedGrid.add(`${mr},${mc}`);
                  }
                }
              } else {
                processedGrid.add(key);
                continue;
              }
              break;
            }
          }
        }
      } else {
        processedGrid.add(key);
      }

      // Only render if has value
      if (value) {
        const cellId = getCellAddress(r, c);
        const spanStyle = rowSpan > 1 || colSpan > 1
          ? ` style="grid-row: ${r} / span ${rowSpan}; grid-column: ${c} / span ${colSpan};"`
          : ` style="grid-row: ${r}; grid-column: ${c};"`;

        html += `  <div class="grid-cell" id="${cellId}" data-cell="${cellId}"${spanStyle}>${value}</div>\n`;
      }
    }
  }

  html += '</div>';

  console.log('[Semantic HTML] Generated with exact grid positioning');

  return html;
}
