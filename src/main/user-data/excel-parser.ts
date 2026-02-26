import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import {
  ParsedExcelData,
  ColumnType,
  ColumnSplitSuggestion,
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
 * Check if a row contains merged cells (0-based row index)
 */
function rowHasMergedCells(rowIndex: number, merges: any[] | undefined): boolean {
  if (!merges || merges.length === 0) {
    return false;
  }

  // Check if this row is part of any merge range
  return merges.some((merge) => {
    const startRow = merge.s.r;
    const endRow = merge.e.r;
    const startCol = merge.s.c;
    const endCol = merge.e.c;

    // Row has merged cells if:
    // 1. It's within the merge range
    // 2. The merge spans multiple columns (horizontal merge)
    return rowIndex >= startRow && rowIndex <= endRow && endCol > startCol;
  });
}

/**
 * Check if a row is likely a summary/total row
 * Now primarily uses merged cell detection as the most reliable indicator
 */
function isSummaryRow(rowData: any, rowIndex?: number, merges?: any[]): boolean {
  // Primary detection: Check for merged cells (most reliable)
  if (rowIndex !== undefined && merges !== undefined) {
    if (rowHasMergedCells(rowIndex, merges)) {
      return true;
    }
  }

  // Fallback: Keyword-based detection for cases without merged cells
  const summaryKeywords = ['total', 'grand total', 'sum', 'average', '합계', '총합계', '소계', '평균', '계'];

  // Check values in the row
  const values = Object.values(rowData);

  const firstNonNull = values.find(v => v !== null && v !== undefined && v !== '');
  if (typeof firstNonNull === 'string') {
     const trimmedVal = firstNonNull.trim();
     const lowerVal = trimmedVal.toLowerCase();

     // Check if it starts with keyword or ends with ' 계' (common Korean pattern)
     if (summaryKeywords.some(k => lowerVal === k || lowerVal.startsWith(k))) {
       return true;
     }

     // Check for Korean subtotal pattern: "회사명 계", "그룹명 계", etc.
     if (trimmedVal.endsWith(' 계')) {
       return true;
     }
  }

  // Also catch cases where summary keywords appear in any column
  if (values.some(v => typeof v === 'string' && (v === '총합계' || v === '합계' || v === '소계'))) {
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
 * Detect if a column contains "date + number" pattern (e.g., "2026/02/20 -8")
 * Returns split suggestion if pattern is detected
 */
export function detectDateWithNumberPattern(
  columnName: string,
  values: any[]
): ColumnSplitSuggestion | null {
  const validValues = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (validValues.length === 0) {
    return null;
  }

  // Pattern: Date + space + optional minus + number
  // Examples: "2026/02/20 -8", "2024-01-15 3", "2026/02/20 -9"
  const dateWithNumberPattern = /^(\d{4}[-/]\d{2}[-/]\d{2})\s+(-?\d+)$/;

  let matchCount = 0;
  let totalNonEmpty = 0;

  for (const value of validValues) {
    if (typeof value === 'string') {
      totalNonEmpty++;
      if (dateWithNumberPattern.test(value.trim())) {
        matchCount++;
      }
    }
  }

  // If 80%+ of non-empty values match the pattern, suggest split
  if (totalNonEmpty > 0 && matchCount / totalNonEmpty >= 0.8) {
    return {
      originalColumn: columnName,
      suggestedColumns: [
        {
          name: columnName, // Keep original name for date part
          type: 'DATE',
        },
        {
          name: `${columnName}_번호`, // Add "_번호" (number) suffix
          type: 'INTEGER',
        },
      ],
      pattern: 'date-with-number',
    };
  }

  return null;
}

/**
 * Detect split suggestions for all columns
 */
export function detectSplitSuggestions(
  rows: any[],
  headers: string[]
): ColumnSplitSuggestion[] {
  const suggestions: ColumnSplitSuggestion[] = [];

  headers.forEach((header) => {
    const values = rows.map((row) => row[header]);

    // Check for date-with-number pattern
    const dateNumberSuggestion = detectDateWithNumberPattern(header, values);
    if (dateNumberSuggestion) {
      suggestions.push(dateNumberSuggestion);
    }

    // Future: Add more pattern detections here
    // - Phone numbers (area code + number)
    // - Addresses (structured parts)
    // etc.
  });

  return suggestions;
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
  // Read file as buffer using fs, then pass to XLSX
  // This supports both .xls (binary) and .xlsx (ZIP) formats
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const headerRow = options?.headerRow || 1;
  const skipRows = options?.skipRows || 0;
  const skipBottomRows = options?.skipBottomRows || 0;

  const sheets: ParsedExcelData['sheets'] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];

    // Extract merge information from worksheet
    const merges = worksheet['!merges'];
    if (merges && merges.length > 0) {
      console.log(`📊 Found ${merges.length} merged cell range(s) in sheet "${sheetName}"`);
    }

    // Convert sheet to array of arrays (includes all rows)
    const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
      defval: null
    });

    let headers: string[] = [];
    const totalRows = allRows.length;

    // Calculate which rows to use
    const headerRowIndex = headerRow - 1; // Convert to 0-based
    const dataStartIndex = headerRowIndex + 1;
    const dataEndIndex = totalRows - skipBottomRows;

    // Extract headers from specified row
    if (headerRowIndex < allRows.length) {
      const headerValues = allRows[headerRowIndex];
      const rawHeaders = headerValues.map((h, idx) => {
        const headerValue = h !== null && h !== undefined ? String(h).trim() : `Column${idx + 1}`;
        return sanitizeColumnName(headerValue);
      });

      // Handle duplicate column names by adding suffixes
      headers = [];
      const headerCounts: Record<string, number> = {};

      rawHeaders.forEach((header) => {
        if (headerCounts[header]) {
          // This header already exists, add a suffix
          headerCounts[header]++;
          headers.push(`${header}${headerCounts[header]}`);
        } else {
          // First occurrence of this header
          headerCounts[header] = 1;
          headers.push(header);
        }
      });

      console.log('📝 Original headers:', headerValues.map(h => String(h).trim()));
      console.log('📝 Processed headers:', headers);
    }

    // Get raw worksheet data with dates preserved
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,  // Keep raw values including Date objects
      defval: null
    });

    // Extract data rows (skip top rows and bottom rows)
    const rows: any[] = [];
    for (let i = dataStartIndex; i < dataEndIndex && i < allRows.length; i++) {
      const rowData: any = {};
      const values = allRows[i];
      const rawValues = rawData[i] || [];

      headers.forEach((header, idx) => {
        const cellValue = values[idx];
        const rawValue = rawValues[idx];

        // Debug logging for date columns (first 3 rows only)
        if (i - dataStartIndex < 3 && header === '일자') {
          console.log(`🔍 Excel Parser - Row ${i - dataStartIndex}, Column "${header}":`, {
            value: cellValue,
            type: typeof cellValue,
            rawValue: rawValue,
            isDate: rawValue instanceof Date,
          });
        }

        // Prefer raw value if it's a Date object
        if (rawValue instanceof Date) {
          rowData[header] = rawValue;
        } else if (cellValue === null || cellValue === undefined) {
          rowData[header] = null;
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
        // Pass row index and merge info for merged cell detection
        if (!isSummaryRow(rowData, i, merges)) {
          rows.push(rowData);
        } else {
          console.log(`⏭️  Skipping summary row ${i + 1}:`, Object.values(rowData).slice(0, 3).join(' | '));
        }
      }
    }

    if (headers.length > 0 && rows.length > 0) {
      const detectedTypes = detectColumnTypes(rows, headers);
      const splitSuggestions = detectSplitSuggestions(rows, headers);

      if (splitSuggestions.length > 0) {
        console.log(`💡 Found ${splitSuggestions.length} column split suggestion(s):`);
        splitSuggestions.forEach((suggestion) => {
          console.log(`   "${suggestion.originalColumn}" → [${suggestion.suggestedColumns.map(c => `"${c.name}" (${c.type})`).join(', ')}]`);
        });
      }

      sheets.push({
        name: sheetName,
        headers,
        rows,
        detectedTypes,
        splitSuggestions: splitSuggestions.length > 0 ? splitSuggestions : undefined,
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
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames;
}

/**
 * Apply column split to parsed data
 * Splits a column with "date + number" pattern into separate date and number columns
 */
export function applySplitColumn(
  sheetData: ParsedExcelData['sheets'][0],
  originalColumn: string,
  newColumnNames: { date: string; number: string }
): ParsedExcelData['sheets'][0] {
  const originalIndex = sheetData.headers.indexOf(originalColumn);

  if (originalIndex === -1) {
    throw new Error(`Column "${originalColumn}" not found`);
  }

  // Pattern for splitting
  const dateWithNumberPattern = /^(\d{4}[-/]\d{2}[-/]\d{2})\s+(-?\d+)$/;

  // Create new headers (replace original with two new columns)
  const newHeaders = [...sheetData.headers];
  newHeaders.splice(originalIndex, 1, newColumnNames.date, newColumnNames.number);

  // Create new rows with split data
  const newRows = sheetData.rows.map((row) => {
    const newRow = { ...row };
    const originalValue = row[originalColumn];

    // Remove original column
    delete newRow[originalColumn];

    if (typeof originalValue === 'string') {
      const match = originalValue.trim().match(dateWithNumberPattern);

      if (match) {
        // Successfully split
        newRow[newColumnNames.date] = match[1]; // Date part
        newRow[newColumnNames.number] = parseInt(match[2], 10); // Number part
      } else {
        // Fallback if pattern doesn't match
        newRow[newColumnNames.date] = originalValue;
        newRow[newColumnNames.number] = null;
      }
    } else {
      // Non-string value, keep as-is in date column
      newRow[newColumnNames.date] = originalValue;
      newRow[newColumnNames.number] = null;
    }

    return newRow;
  });

  // Update detected types (replace original type with two new types)
  const newDetectedTypes = [...sheetData.detectedTypes];
  newDetectedTypes.splice(originalIndex, 1, 'DATE', 'INTEGER');

  return {
    ...sheetData,
    headers: newHeaders,
    rows: newRows,
    detectedTypes: newDetectedTypes,
  };
}
