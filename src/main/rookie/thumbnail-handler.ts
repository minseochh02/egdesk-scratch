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

      // Convert sheet to HTML (preserves merged cells!)
      const html = XLSX.utils.sheet_to_html(worksheet, {
        id: `excel-sheet-${sheetName.replace(/\s+/g, '-')}`,
        editable: false,
        header: '',  // No wrapper HTML
        footer: '',
      });

      // Get sheet metadata
      const range = worksheet['!ref'] || 'A1';
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
