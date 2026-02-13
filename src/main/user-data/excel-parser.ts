import ExcelJS from 'exceljs';
import path from 'path';
import {
  ParsedExcelData,
  ColumnType,
} from './types';

/**
 * Excel Parser
 *
 * Parses Excel files and auto-detects schema from data
 */

/**
 * Sanitize table name for SQL safety
 */
export function sanitizeTableName(fileName: string): string {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  // Remove special characters, keep alphanumeric and underscores
  return nameWithoutExt.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Sanitize column name for SQL safety
 */
export function sanitizeColumnName(header: string): string {
  // Remove special characters, keep alphanumeric and underscores
  let sanitized = String(header).replace(/[^a-zA-Z0-9_가-힣]/g, '_').toLowerCase();

  // Ensure it doesn't start with a number
  if (/^\d/.test(sanitized)) {
    sanitized = 'col_' + sanitized;
  }

  // If empty, use a default
  if (!sanitized || sanitized === '_') {
    sanitized = 'column';
  }

  return sanitized;
}

/**
 * Detect column type from sample data
 */
export function detectColumnType(values: any[]): ColumnType {
  // Filter out null and undefined values
  const validValues = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (validValues.length === 0) {
    return 'TEXT'; // Default to TEXT if no valid values
  }

  let allInteger = true;
  let allNumeric = true;
  let allDate = true;
  let hasDateObjects = 0;
  let hasDateStrings = 0;

  for (const value of validValues) {
    // Check if it's a Date object (Excel dates)
    if (value instanceof Date) {
      allNumeric = false;
      allInteger = false;
      hasDateObjects++;
      // Date objects are dates!
      continue;
    }
    
    // Check if it's a number
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        allInteger = false;
      }
      allDate = false;
    } else if (typeof value === 'string') {
      // Try to parse as number (for numeric columns)
      const num = parseFloat(value.replace(/,/g, ''));
      if (!isNaN(num)) {
        if (!Number.isInteger(num)) {
          allInteger = false;
        }
        // If it looks like a number, it's probably not a date
        allDate = false;
      } else {
        allNumeric = false;
        allInteger = false;
      }

      // Try to parse as date (common formats: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, etc.)
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,          // YYYY-MM-DD
        /^\d{4}\/\d{2}\/\d{2}$/,        // YYYY/MM/DD
        /^\d{2}-\d{2}-\d{4}$/,          // DD-MM-YYYY
        /^\d{2}\/\d{2}\/\d{4}$/,        // DD/MM/YYYY
        /^\d{8}$/,                       // YYYYMMDD
      ];
      
      const looksLikeDate = datePatterns.some(pattern => pattern.test(value.trim()));
      if (looksLikeDate) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          hasDateStrings++;
        } else {
          allDate = false;
        }
      } else {
        allDate = false;
      }
    } else {
      allNumeric = false;
      allInteger = false;
      allDate = false;
    }
  }

  // Determine type based on analysis
  // If we have ANY Date objects or date strings, it's a DATE column
  if (hasDateObjects > 0 || hasDateStrings > 0) {
    return 'DATE';
  }
  
  if (allDate) return 'DATE';
  if (allInteger) return 'INTEGER';
  if (allNumeric) return 'REAL';
  return 'TEXT';
}

/**
 * Check if a row is likely a summary/total row
 */
function isSummaryRow(rowData: any): boolean {
  const summaryKeywords = ['total', 'grand total', 'sum', 'average', '합계', '총합계', '소계', '평균'];
  
  // Check values in the row
  const values = Object.values(rowData);
  
  // Check first few columns usually containing the label
  // Also check if multiple columns have the same summary value (like "총합계" in the error report)
  let summaryKeywordCount = 0;

  for (const val of values) {
    if (typeof val === 'string') {
      const lowerVal = val.toLowerCase().trim();
      // Exact match or starts with keyword (e.g. "Total Sales")
      if (summaryKeywords.some(k => lowerVal === k || lowerVal.startsWith(k))) {
        summaryKeywordCount++;
      }
    }
  }

  // If we found keywords, it's likely a summary row
  // The user reported "총합계" in multiple columns, so checking for count > 0 is probably safe enough for the first column
  // But let's be slightly more specific: usually the summary label is in the first few non-null columns
  
  const firstNonNull = values.find(v => v !== null && v !== undefined && v !== '');
  if (typeof firstNonNull === 'string') {
     const lowerVal = firstNonNull.toLowerCase().trim();
     if (summaryKeywords.some(k => lowerVal === k || lowerVal.startsWith(k))) {
       return true;
     }
  }

  // Also catch the specific case where "총합계" appears (user reported it in '일자' column which might not be the first)
  if (values.some(v => typeof v === 'string' && (v === '총합계' || v === '합계'))) {
    return true;
  }

  return false;
}

/**
 * Detect column types from rows
 */
export function detectColumnTypes(rows: any[], headers: string[]): ColumnType[] {
  // Check all rows for accurate detection to avoid type mismatches
  // Performance impact is negligible compared to Excel parsing time
  const sampleRows = rows;

  return headers.map((header) => {
    const values = sampleRows.map((row) => row[header]);
    return detectColumnType(values);
  });
}

/**
 * Parse Excel file and extract data with schema detection
 */
export async function parseExcelFile(
  filePath: string,
  options?: {
    headerRow?: number; // Which row contains headers (1-based, default: 1)
    skipRows?: number; // How many rows to skip at the top (default: 0)
    skipBottomRows?: number; // How many rows to skip at the bottom (default: 0)
  }
): Promise<ParsedExcelData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const headerRow = options?.headerRow || 1;
  const skipRows = options?.skipRows || 0;
  const skipBottomRows = options?.skipBottomRows || 0;

  const sheets: ParsedExcelData['sheets'] = [];

  workbook.eachSheet((worksheet, sheetId) => {
    const allRows: any[][] = [];
    let headers: string[] = [];
    let totalRows = 0;

    // First pass: collect all rows
    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      // ExcelJS includes a null at index 0, so we slice it
      allRows.push(values.slice(1));
      totalRows = rowNumber;
    });

    // Calculate which rows to use
    const headerRowIndex = headerRow - 1; // Convert to 0-based
    const dataStartIndex = headerRowIndex + 1;
    const dataEndIndex = totalRows - skipBottomRows;

    // Extract headers from specified row
    if (headerRowIndex < allRows.length) {
      const headerValues = allRows[headerRowIndex];
      headers = headerValues.map((h, idx) => {
        const headerValue = h !== null && h !== undefined ? String(h).trim() : `Column${idx + 1}`;
        return sanitizeColumnName(headerValue);
      });
    }

    // Extract data rows (skip top rows and bottom rows)
    const rows: any[] = [];
    for (let i = dataStartIndex; i < dataEndIndex && i < allRows.length; i++) {
      const rowData: any = {};
      const values = allRows[i];

      headers.forEach((header, idx) => {
        const cellValue = values[idx];

        // Handle different cell value types
        if (cellValue === null || cellValue === undefined) {
          rowData[header] = null;
        } else if (cellValue instanceof Date) {
          // Keep as Date object for detection - will be converted during insert
          rowData[header] = cellValue;
        } else if (typeof cellValue === 'object' && 'result' in cellValue) {
          // Handle formula cells
          rowData[header] = cellValue.result;
        } else {
          rowData[header] = cellValue;
        }
      });

      // Only include rows that have at least one non-null value
      const hasData = Object.values(rowData).some(
        (v) => v !== null && v !== undefined && v !== ''
      );
      
      if (hasData) {
        // Skip summary rows (totals, etc.)
        if (!isSummaryRow(rowData)) {
          rows.push(rowData);
        }
      }
    }

    if (headers.length > 0 && rows.length > 0) {
      const detectedTypes = detectColumnTypes(rows, headers);

      sheets.push({
        name: worksheet.name,
        headers,
        rows,
        detectedTypes,
      });
    }
  });

  if (sheets.length === 0) {
    throw new Error('No valid sheets found in Excel file');
  }

  const fileName = path.basename(filePath);
  const suggestedTableName = sanitizeTableName(fileName);

  return {
    sheets,
    selectedSheet: 0, // Default to first sheet
    suggestedTableName,
  };
}

/**
 * Convert parsed data to row format for database insertion
 */
export function convertToRowFormat(sheetData: ParsedExcelData['sheets'][0]): any[] {
  return sheetData.rows;
}

/**
 * Get preview data (first N rows)
 */
export function getPreviewData(
  sheetData: ParsedExcelData['sheets'][0],
  limit: number = 10
): any[] {
  return sheetData.rows.slice(0, limit);
}

/**
 * Validate Excel file before parsing
 */
export function validateExcelFile(filePath: string): { valid: boolean; error?: string } {
  const ext = path.extname(filePath).toLowerCase();

  if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
    return {
      valid: false,
      error: 'Invalid file format. Only .xlsx, .xls, and .xlsm files are supported.',
    };
  }

  return { valid: true };
}

/**
 * Get sheet names from Excel file
 */
export async function getSheetNames(filePath: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheetNames: string[] = [];
  workbook.eachSheet((worksheet) => {
    sheetNames.push(worksheet.name);
  });

  return sheetNames;
}
