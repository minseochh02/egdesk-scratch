import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import {
  ParsedExcelData,
  ColumnType,
  ColumnSplitSuggestion,
  DataIsland,
  MergedIslandsResult,
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
export function detectColumnType(values: any[], columnName?: string): ColumnType {
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
  let hasNonDateDashes = false; // Track if we see dashes that aren't part of dates

  // Date patterns for validation
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,          // YYYY-MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/,        // YYYY/MM/DD
    /^\d{2}-\d{2}-\d{4}$/,          // DD-MM-YYYY
    /^\d{2}\/\d{2}\/\d{4}$/,        // DD/MM/YYYY
    /^\d{2}\/\d{2}\/\d{2}$/,        // YY/MM/DD or DD/MM/YY
    /^\d{8}$/,                       // YYYYMMDD
    // Date patterns with suffixes (e.g., "26/02/02-1", "2024/01/15-2")
    /^\d{2}\/\d{2}\/\d{2}-\d+$/,    // YY/MM/DD-N
    /^\d{4}\/\d{2}\/\d{2}-\d+$/,    // YYYY/MM/DD-N
    /^\d{2}\/\d{2}\/\d{4}-\d+$/,    // DD/MM/YYYY-N
    /^\d{4}-\d{2}-\d{2}-\d+$/,      // YYYY-MM-DD-N
  ];

  for (const value of validValues) {
    // Check if it's a Date object (Excel dates)
    if (value instanceof Date) {
      allNumeric = false;
      allInteger = false;
      hasDateObjects++;
      continue;
    }

    // Check if it's a number
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        allInteger = false;
      }
      allDate = false;
    } else if (typeof value === 'string') {
      const trimmedValue = value.trim();

      // FIRST: Check for dashes that are NOT part of date patterns
      // Examples: "123-45-67890", "ABC-DEF", etc.
      if (trimmedValue.includes('-')) {
        const looksLikeDate = datePatterns.some(pattern => pattern.test(trimmedValue));
        if (!looksLikeDate) {
          // Contains dash but not a date → it's TEXT (like business numbers)
          hasNonDateDashes = true;
          allNumeric = false;
          allInteger = false;
          allDate = false;
          continue;
        }
      }

      // SECOND: Check if it's a date pattern
      const looksLikeDate = datePatterns.some(pattern => pattern.test(trimmedValue));
      if (looksLikeDate) {
        // Strip suffix if present (e.g., "26/02/02-1" → "26/02/02")
        // Only match suffixes on slash-delimited dates, not ISO format (YYYY-MM-DD)
        let dateStr = trimmedValue;
        const suffixMatch = trimmedValue.match(/^(.+\/\d{2,4})-\d+$/);
        if (suffixMatch) {
          dateStr = suffixMatch[1];
        }

        // Try to parse the date
        // Handle YY/MM/DD format (assume 20YY for years 00-99)
        let date: Date | null = null;

        if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
          // YY/MM/DD format - parse manually
          const parts = dateStr.split('/');
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);

          // Assume 20YY for years 00-99
          const fullYear = year < 100 ? 2000 + year : year;
          date = new Date(fullYear, month - 1, day);
        } else {
          // Standard date formats
          date = new Date(dateStr);
        }

        if (date && !isNaN(date.getTime())) {
          hasDateStrings++;
          allNumeric = false;
          allInteger = false;
        } else {
          allDate = false;
        }
        continue;
      }

      // THIRD: Try to parse as number (handle commas for numeric columns)
      // Remove commas: "1,234,567" → "1234567"
      const withoutCommas = trimmedValue.replace(/,/g, '');
      const num = parseFloat(withoutCommas);

      if (!isNaN(num) && /^-?[\d,]+(\.\d+)?$/.test(trimmedValue)) {
        // It's a valid number (possibly with commas)
        if (!Number.isInteger(num)) {
          allInteger = false;
        }
        allDate = false;
      } else {
        // Can't parse as number
        allNumeric = false;
        allInteger = false;
        allDate = false;
      }
    } else {
      allNumeric = false;
      allInteger = false;
      allDate = false;
    }
  }

  // Determine type based on analysis
  // If we found dashes that aren't dates (like "123-45-67890"), it's TEXT
  if (hasNonDateDashes) {
    return 'TEXT';
  }

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
 * Quick check if data looks like a pivot table (for use during parsing)
 * Checks if first 1-2 columns have many empty cells with data in other columns
 */
function isPivotTableQuickCheck(recentRows: any[], headers: string[]): boolean {
  if (recentRows.length < 3 || headers.length < 2) {
    return false;
  }

  // Check first 1-2 columns for empty cells
  const maxCategoryColumns = Math.min(2, headers.length - 1);

  for (let numCategoryCols = 1; numCategoryCols <= maxCategoryColumns; numCategoryCols++) {
    let emptyCount = 0;
    let subtotalCount = 0;

    for (const row of recentRows) {
      // Count empty cells in category columns
      for (let col = 0; col < numCategoryCols; col++) {
        const header = headers[col];
        const value = row[header];
        if (value === null || value === undefined || value === '') {
          emptyCount++;
          break; // Count once per row
        }
      }

      // Count subtotal rows
      const firstColValue = row[headers[0]];
      if (typeof firstColValue === 'string' && firstColValue.trim().endsWith(' 계')) {
        subtotalCount++;
      }
    }

    const emptyRatio = emptyCount / recentRows.length;

    // Quick heuristic: 30%+ empty + subtotals = likely pivot table
    if (emptyRatio >= 0.3 && subtotalCount >= 1) {
      return true;
    }
  }

  return false;
}

/**
 * Detect if rows have pivot table structure (hierarchical with empty cells for grouping)
 * Returns the number of category columns (usually 1-2) or 0 if not a pivot table
 */
function detectPivotTableStructure(rows: any[], headers: string[]): number {
  if (rows.length < 3 || headers.length < 2) {
    return 0; // Not enough data to determine
  }

  // Check first 1-2 columns for pivot table characteristics
  const maxCategoryColumns = Math.min(2, headers.length - 1);

  for (let numCategoryCols = 1; numCategoryCols <= maxCategoryColumns; numCategoryCols++) {
    let emptyCount = 0;
    let subtotalCount = 0;
    let hasDataInOtherColumns = true;

    // Analyze the first numCategoryCols columns
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Count empty cells in category columns
      let hasEmptyInCategoryCol = false;
      for (let col = 0; col < numCategoryCols; col++) {
        const header = headers[col];
        const value = row[header];
        if (value === null || value === undefined || value === '') {
          hasEmptyInCategoryCol = true;
          emptyCount++;
        }
      }

      // Check if row has data in value columns (beyond category columns)
      if (hasEmptyInCategoryCol) {
        let hasData = false;
        for (let col = numCategoryCols; col < headers.length; col++) {
          const header = headers[col];
          const value = row[header];
          if (value !== null && value !== undefined && value !== '') {
            hasData = true;
            break;
          }
        }
        if (!hasData) {
          hasDataInOtherColumns = false;
        }
      }

      // Count subtotal rows (rows ending with " 계")
      const firstColValue = row[headers[0]];
      if (typeof firstColValue === 'string' && firstColValue.trim().endsWith(' 계')) {
        subtotalCount++;
      }
    }

    // Pivot table characteristics:
    // 1. Has empty cells in category columns (at least 20% of rows)
    // 2. Has subtotal rows (at least 1)
    // 3. Empty category cells still have data in other columns
    const emptyRatio = emptyCount / (rows.length * numCategoryCols);

    if (emptyRatio >= 0.2 && subtotalCount >= 1 && hasDataInOtherColumns) {
      console.log(`📊 Detected pivot table structure with ${numCategoryCols} category column(s)`);
      console.log(`   Empty cells: ${emptyCount} (${(emptyRatio * 100).toFixed(1)}%)`);
      console.log(`   Subtotal rows: ${subtotalCount}`);
      return numCategoryCols;
    }
  }

  return 0; // Not a pivot table
}

/**
 * Forward-fill empty cells in category columns (for pivot tables)
 * Fills empty cells with the most recent non-empty value from above
 */
function forwardFillCategoryColumns(rows: any[], headers: string[], numCategoryColumns: number): any[] {
  if (numCategoryColumns === 0 || rows.length === 0) {
    return rows;
  }

  console.log(`🔄 Forward-filling ${numCategoryColumns} category column(s)`);

  const filledRows = [];
  const lastValues: string[] = new Array(numCategoryColumns).fill('');

  for (let i = 0; i < rows.length; i++) {
    const row = { ...rows[i] };

    // Check if this is a subtotal row (ends with " 계")
    const firstColValue = row[headers[0]];
    const isSubtotal = typeof firstColValue === 'string' && firstColValue.trim().endsWith(' 계');

    // Forward-fill each category column
    for (let col = 0; col < numCategoryColumns; col++) {
      const header = headers[col];
      const value = row[header];

      if (value === null || value === undefined || value === '') {
        // Empty cell - use last value (unless it's a subtotal row)
        if (!isSubtotal && lastValues[col]) {
          row[header] = lastValues[col];
        }
      } else {
        // Non-empty cell - update last value
        lastValues[col] = String(value).trim();
      }
    }

    // Reset tracking after subtotal rows
    if (isSubtotal) {
      lastValues.fill('');
    }

    filledRows.push(row);
  }

  console.log(`   ✅ Forward-fill complete for ${filledRows.length} rows`);
  return filledRows;
}

/**
 * Detect noise rows that should be filtered out from islands
 * Examples:
 * - "이월잔액" (carried forward balance) rows
 * - Timestamp rows like "2026/02/27 오후 7:02:42"
 */
function isNoiseRow(rowData: any, headers: string[]): boolean {
  const values = Object.values(rowData);
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');

  // Check if row is mostly empty (less than 2 non-empty values)
  if (nonEmptyValues.length < 2) {
    return true;
  }

  // Check for "이월잔액" (carried forward balance)
  // Look for it in ANY column, and check if first column (date column) is empty
  const firstCol = rowData[headers[0]];
  const firstColEmpty = !firstCol || (typeof firstCol === 'string' && firstCol.trim() === '');

  // Check if any value is exactly "이월잔액" (standalone, not part of other text)
  const hasCarriedBalance = values.some(v =>
    v && typeof v === 'string' && v.trim() === '이월잔액'
  );

  // If first column (usually date) is empty AND we have "이월잔액", it's a noise row
  if (firstColEmpty && hasCarriedBalance) {
    return true;
  }

  // Check for timestamp pattern in first column with mostly empty rest
  // Pattern: "2026/02/27 오후 7:02:42" or similar date/time strings
  const firstValue = rowData[headers[0]];
  if (firstValue && typeof firstValue === 'string') {
    const trimmed = firstValue.trim();
    // Check if it looks like a timestamp: contains date and time components
    const hasTimestamp = /\d{4}\/\d{1,2}\/\d{1,2}.*(?:오전|오후|\d{1,2}:\d{2})/.test(trimmed);

    // And check if rest of columns are mostly empty (less than 2 other values)
    const otherValues = values.slice(1).filter(v => v !== null && v !== undefined && v !== '');

    if (hasTimestamp && otherValues.length < 2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a row is likely a summary/total row that should be skipped
 * Now primarily uses merged cell detection as the most reliable indicator
 *
 * Note: Pivot table subtotal rows (e.g., "미수금 계") are NOT considered skip-worthy
 * because they're part of the hierarchical data structure
 */
function isSummaryRow(rowData: any, rowIndex?: number, merges?: any[], isPivotTable: boolean = false): boolean {
  // For pivot tables, don't skip subtotal rows (they're part of the data hierarchy)
  // This check must come BEFORE merged cell detection
  if (isPivotTable) {
    // Only skip grand total rows like "총합계", "합계" (standalone)
    const values = Object.values(rowData);
    const firstNonNull = values.find(v => v !== null && v !== undefined && v !== '');

    if (typeof firstNonNull === 'string') {
      const trimmedVal = firstNonNull.trim();
      // Only skip if it's EXACTLY a grand total keyword (not "Category 계")
      if (trimmedVal === '총합계' || trimmedVal === '합계' || trimmedVal === '소계' ||
          trimmedVal === 'Total' || trimmedVal === 'Grand Total') {
        return true;
      }
    }

    return false; // Keep subtotal rows in pivot tables (even if they have merged cells)
  }

  // Non-pivot tables: Check for merged cells (most reliable indicator)
  if (rowIndex !== undefined && merges !== undefined) {
    if (rowHasMergedCells(rowIndex, merges)) {
      return true;
    }
  }

  // Non-pivot table: Original behavior - skip all summary rows
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
    return detectColumnType(values, header);
  });
}

/**
 * Check if column name suggests it's a date column
 */
function isDateColumnName(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  const dateKeywords = [
    'date', 'day', 'time', 'datetime',
    '일자', '날짜', '일시', '시간', '거래일', '발생일', '등록일', '작성일',
    '월_일', // month_day format (sanitized)
    '월/일', // month/day format (original)
    '월', // month (Korean)
  ];

  // Check if it includes any keyword
  const hasKeyword = dateKeywords.some(keyword => lowerName.includes(keyword));

  if (hasKeyword) {
    console.log(`✓ Column "${columnName}" recognized as date column`);
  }

  return hasKeyword;
}

/**
 * Detect if a column contains "date + number" pattern (e.g., "2026/02/20 -8")
 * Returns split suggestion if pattern is detected
 *
 * Detects based on actual data values, regardless of column name
 */
export function detectDateWithNumberPattern(
  columnName: string,
  values: any[]
): ColumnSplitSuggestion | null {
  const validValues = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (validValues.length === 0) {
    return null;
  }

  // Pattern: Date + optional space + optional minus + number
  // Examples: "2026/02/20 -8", "2024-01-15 3", "2026/01/29-7", "26/02/02-1"
  // Note: Space is optional, we capture the minus sign but will parse as positive number
  // Support both YYYY and YY year formats
  const dateWithNumberPattern4Digit = /^(\d{4}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/; // YYYY-MM-DD-N
  const dateWithNumberPattern2Digit = /^(\d{2}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;  // YY-MM-DD-N

  let matchCount = 0;
  let totalNonEmpty = 0;

  // Debug: Show first 5 values for testing
  const sampleValues = validValues.slice(0, 5);
  console.log(`🔍 Checking column "${columnName}" for split pattern. Sample values:`, sampleValues);

  for (const value of validValues) {
    if (typeof value === 'string') {
      totalNonEmpty++;
      const trimmed = value.trim();
      const matches4 = dateWithNumberPattern4Digit.test(trimmed);
      const matches2 = dateWithNumberPattern2Digit.test(trimmed);

      if (matches4 || matches2) {
        matchCount++;
        if (matchCount <= 3) {
          // Debug first 3 matches
          console.log(`   ✓ "${trimmed}" → Match (4-digit: ${matches4}, 2-digit: ${matches2})`);
        }
      } else if (totalNonEmpty <= 5) {
        // Debug first 5 non-matches
        console.log(`   ✗ "${trimmed}" → No match (4-digit: ${matches4}, 2-digit: ${matches2})`);
      }
    }
  }

  console.log(`📊 Pattern check results: ${matchCount}/${totalNonEmpty} values matched (${((matchCount/totalNonEmpty)*100).toFixed(1)}%)`);


  // If 80%+ of non-empty values match the pattern, suggest split
  if (totalNonEmpty > 0 && matchCount / totalNonEmpty >= 0.8) {
    console.log(`💡 Column "${columnName}" matches date-with-number pattern (${matchCount}/${totalNonEmpty} rows)`);
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
 * Parse metadata from island title with "회사명 : ..." format
 * Example: "회사명 : (주)영일오엔씨 / 2026/01/01 ~ 2026/01/31 / 계정별원장 / 1023(현금 시재금-창원)"
 */
function parseIslandMetadata(title: string): DataIsland['metadata'] | undefined {
  // Pattern: "회사명 : company / dateRange / reportType / accountCode(accountName)"
  const companyMatch = title.match(/회사명\s*:\s*([^/]+)/);
  if (!companyMatch) return undefined;

  const parts = title.split('/').map(p => p.trim());

  // Extract company (first part after "회사명 :")
  const company = companyMatch[1].trim();

  // Extract date range (second part, usually contains ~)
  let dateRange: string | undefined;
  const dateRangePart = parts.find(p => p.includes('~'));
  if (dateRangePart) {
    dateRange = dateRangePart.trim();
  }

  // Extract account code and name from last part
  // Pattern: "1023(현금 시재금-창원)" or "1023 현금 시재금-창원"
  let accountCode: string | undefined;
  let accountName: string | undefined;
  const lastPart = parts[parts.length - 1];

  // Try pattern with parentheses: "1023(현금 시재금-창원)"
  const accountMatch = lastPart.match(/(\d+)\s*\(([^)]+)\)/);
  if (accountMatch) {
    accountCode = accountMatch[1];
    accountName = accountMatch[2];
  } else {
    // Try pattern without parentheses: "1023 현금 시재금-창원"
    const accountMatch2 = lastPart.match(/(\d+)\s+(.+)/);
    if (accountMatch2) {
      accountCode = accountMatch2[1];
      accountName = accountMatch2[2];
    }
  }

  return {
    company,
    dateRange,
    accountCode,
    accountName,
    rawTitle: title,
  };
}

/**
 * Detect data islands in a spreadsheet
 * Islands are separate tables within one sheet, identified by:
 * - Title pattern: "number space dot text" (e.g., "3. 자금의 증가")
 *   OR "회사명 : ..." (e.g., "회사명 : (주)영일오엔씨 / 2026/01/01 ~ 2026/01/31 / 계정별원장 / 1023(현금 시재금-창원)")
 * - Headers on the next non-empty row
 * - Data rows until summary row (합계, 소계, etc.)
 */
export function detectDataIslands(
  allRows: any[][],
  rawData: any[][],
  merges: any[] | undefined,
  skipRows: number = 0
): DataIsland[] {
  const islands: DataIsland[] = [];

  // Title patterns:
  // 1. "3. 자금의 증가" - number + space + dot + space + text
  // 2. "회사명 : (주)영일오엔씨 / ..." - company name format
  const titlePatterns = [
    /^\d+\s+\.\s+(.+)$/,
    /^회사명\s*:\s*(.+)$/,
  ];

  let i = skipRows;
  while (i < allRows.length) {
    const row = allRows[i];
    if (!row || row.length === 0) {
      i++;
      continue;
    }

    // Check if first cell matches any title pattern
    const firstCell = row[0];
    if (typeof firstCell === 'string') {
      const trimmedCell = firstCell.trim();
      let titleMatch = null;
      let matchedPattern = null;

      // Try each pattern
      for (const pattern of titlePatterns) {
        const match = trimmedCell.match(pattern);
        if (match) {
          titleMatch = match;
          matchedPattern = pattern;
          break;
        }
      }

      if (titleMatch) {
        const title = trimmedCell;
        const titleRowIndex = i;

        // Try to parse metadata (for "회사명 : ..." format)
        const metadata = parseIslandMetadata(title);

        console.log(`🏝️  Found island title at row ${titleRowIndex + 1}: "${title}"`);

        // Find header row (next non-empty row)
        let headerRowIndex = -1;
        for (let j = i + 1; j < allRows.length; j++) {
          const headerRow = allRows[j];
          if (headerRow && headerRow.some((cell: any) => cell !== null && cell !== undefined && cell !== '')) {
            headerRowIndex = j;
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.log(`   ⚠️  No headers found for island "${title}"`);
          i++;
          continue;
        }

        // Extract headers
        const headerValues = allRows[headerRowIndex];
        const headers = headerValues.map((h: any, idx: number) => {
          const headerValue = h !== null && h !== undefined ? String(h).trim() : `Column${idx + 1}`;
          return sanitizeColumnName(headerValue);
        });

        // Handle duplicate headers
        const uniqueHeaders: string[] = [];
        const headerCounts: Record<string, number> = {};
        headers.forEach((header: string) => {
          if (headerCounts[header]) {
            headerCounts[header]++;
            uniqueHeaders.push(`${header}${headerCounts[header]}`);
          } else {
            headerCounts[header] = 1;
            uniqueHeaders.push(header);
          }
        });

        // Find data rows (until summary row)
        const dataStartIndex = headerRowIndex + 1;
        let dataEndIndex = dataStartIndex;
        const islandRows: any[] = [];
        let islandIsPivotTable = false; // Will be determined after collecting some rows

        for (let j = dataStartIndex; j < allRows.length; j++) {
          const dataRow = allRows[j];
          const rawRow = rawData[j] || [];

          // Build row object
          const rowData: any = {};
          uniqueHeaders.forEach((header, idx) => {
            const cellValue = dataRow[idx];
            const rawValue = rawRow[idx];

            // Prefer raw value if it's a Date object
            if (rawValue instanceof Date) {
              rowData[header] = rawValue;
            } else if (cellValue === null || cellValue === undefined) {
              rowData[header] = null;
            } else {
              rowData[header] = cellValue;
            }
          });

          // Check if row has data
          const hasData = Object.values(rowData).some(
            (v) => v !== null && v !== undefined && v !== ''
          );

          if (!hasData) {
            // Empty row might signal end of island
            dataEndIndex = j;
            break;
          }

          // Check if it's a noise row (이월잔액, timestamps, etc.)
          if (isNoiseRow(rowData, uniqueHeaders)) {
            console.log(`   🗑️  Skipping noise row at ${j + 1}:`, Object.values(rowData).slice(0, 3));
            continue; // Skip this row, don't add to island
          }

          // Early pivot table detection: if we see a subtotal row (ending with " 계")
          // that's a strong indicator of pivot table structure
          const firstColValue = rowData[uniqueHeaders[0]];
          const isSubtotalRow = typeof firstColValue === 'string' && firstColValue.trim().endsWith(' 계');

          if (!islandIsPivotTable && isSubtotalRow) {
            // This is a subtotal row, which means this island is likely a pivot table
            islandIsPivotTable = true;
            console.log(`   📊 Island "${title}" appears to be a pivot table (detected subtotal row)`);
          }

          // Skip subtotal rows (they have merged cells and are summary rows)
          if (isSubtotalRow) {
            console.log(`   ⏭️  Skipping subtotal row at ${j + 1}: "${firstColValue}"`);
            continue; // Skip this row, don't add to island
          }

          // Skip rows with merged cells (summary/subtotal rows)
          if (merges && rowHasMergedCells(j, merges)) {
            console.log(`   ⏭️  Skipping merged cell row at ${j + 1}`);
            continue; // Skip this row, don't add to island
          }

          // Quick pivot table check after collecting ~10 rows (if not already detected)
          if (!islandIsPivotTable && islandRows.length === 10) {
            islandIsPivotTable = isPivotTableQuickCheck(islandRows, uniqueHeaders);
            if (islandIsPivotTable) {
              console.log(`   📊 Island "${title}" appears to be a pivot table`);
            }
          }

          // Check if it's a summary row (grand total like "합계", "총합계")
          if (isSummaryRow(rowData, j, merges, islandIsPivotTable)) {
            console.log(`   📊 Found grand total row at ${j + 1} for island "${title}"`);
            dataEndIndex = j;
            break;
          }

          // Check if next row is a new island title
          const nextRow = allRows[j + 1];
          if (nextRow && nextRow[0] && typeof nextRow[0] === 'string') {
            const nextCellTrimmed = nextRow[0].trim();
            const isNextTitle = titlePatterns.some(pattern => pattern.test(nextCellTrimmed));
            if (isNextTitle) {
              console.log(`   🏝️  Next island detected at row ${j + 2}`);
              dataEndIndex = j + 1;
              break;
            }
          }

          islandRows.push(rowData);
        }

        // Only add island if it has data
        if (islandRows.length > 0) {
          // Detect and handle pivot table structure for this island
          const numCategoryColumns = detectPivotTableStructure(islandRows, uniqueHeaders);
          if (numCategoryColumns > 0) {
            console.log(`   📊 Island "${title}" is a pivot table with ${numCategoryColumns} category column(s)`);
            islandRows = forwardFillCategoryColumns(islandRows, uniqueHeaders, numCategoryColumns);
          }

          const detectedTypes = detectColumnTypes(islandRows, uniqueHeaders);
          const splitSuggestions = detectSplitSuggestions(islandRows, uniqueHeaders);

          if (splitSuggestions.length > 0) {
            console.log(`   💡 Island "${title}" has ${splitSuggestions.length} column split suggestion(s):`);
            splitSuggestions.forEach((suggestion) => {
              console.log(`      "${suggestion.originalColumn}" → [${suggestion.suggestedColumns.map(c => `"${c.name}" (${c.type})`).join(', ')}]`);
            });
          }

          const island: DataIsland = {
            title,
            titleRowIndex,
            headerRowIndex,
            dataStartIndex,
            dataEndIndex,
            headers: uniqueHeaders,
            rows: islandRows,
            detectedTypes,
            rowCount: islandRows.length,
            splitSuggestions: splitSuggestions.length > 0 ? splitSuggestions : undefined,
          };

          // Add metadata if available
          if (metadata) {
            island.metadata = metadata;
            console.log(`   📋 Metadata extracted: company=${metadata.company}, account=${metadata.accountCode}`);
          }

          islands.push(island);

          console.log(`   ✅ Island "${title}": ${islandRows.length} rows, ${uniqueHeaders.length} columns`);
        }

        // Continue from where this island ended
        i = dataEndIndex;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return islands;
}

/**
 * Merge multiple islands with identical structure into a single dataset
 * Optionally adds metadata columns from island titles
 */
export function mergeIslands(
  islands: DataIsland[],
  options?: {
    addMetadataColumns?: boolean; // Add columns for island metadata
    addIslandIndex?: boolean; // Add "island_number" column
  }
): MergedIslandsResult {
  if (islands.length === 0) {
    throw new Error('Cannot merge empty islands array');
  }

  console.log(`🔀 Merging ${islands.length} islands...`);

  // Validate: all islands must have identical headers
  const firstHeaders = islands[0].headers;
  const headerMismatch = islands.find(
    (island, idx) => {
      if (island.headers.length !== firstHeaders.length) {
        console.error(`Island ${idx} has ${island.headers.length} columns, expected ${firstHeaders.length}`);
        return true;
      }
      const mismatch = island.headers.some((h, i) => h !== firstHeaders[i]);
      if (mismatch) {
        console.error(`Island ${idx} has different header names:`, island.headers);
      }
      return mismatch;
    }
  );

  if (headerMismatch) {
    throw new Error(
      'Cannot merge islands with different header structures. All islands must have identical column names and order.'
    );
  }

  // Prepare merged headers (original + metadata columns if requested)
  let mergedHeaders = [...firstHeaders];
  const metadataColumnNames: string[] = [];

  if (options?.addMetadataColumns) {
    // Check if any island has metadata
    const hasMetadata = islands.some(island => island.metadata);

    if (hasMetadata) {
      metadataColumnNames.push('회사명', '기간', '계정코드_메타', '계정명_메타');
      mergedHeaders = [...mergedHeaders, ...metadataColumnNames];
      console.log(`   📋 Adding metadata columns: ${metadataColumnNames.join(', ')}`);
    }
  }

  if (options?.addIslandIndex) {
    mergedHeaders.push('island_number');
    console.log(`   📊 Adding island_number column`);
  }

  // Merge all rows
  const mergedRows: any[] = [];
  const islandTitles: string[] = [];

  islands.forEach((island, islandIndex) => {
    islandTitles.push(island.title);

    island.rows.forEach(row => {
      const mergedRow = { ...row };

      // Add metadata columns if requested
      if (options?.addMetadataColumns && metadataColumnNames.length > 0) {
        if (island.metadata) {
          mergedRow['회사명'] = island.metadata.company || null;
          mergedRow['기간'] = island.metadata.dateRange || null;
          mergedRow['계정코드_메타'] = island.metadata.accountCode || null;
          mergedRow['계정명_메타'] = island.metadata.accountName || null;
        } else {
          // No metadata available for this island
          mergedRow['회사명'] = null;
          mergedRow['기간'] = null;
          mergedRow['계정코드_메타'] = null;
          mergedRow['계정명_메타'] = null;
        }
      }

      // Add island index if requested
      if (options?.addIslandIndex) {
        mergedRow['island_number'] = islandIndex + 1;
      }

      mergedRows.push(mergedRow);
    });

    console.log(`   ✅ Merged island ${islandIndex + 1}/${islands.length}: "${island.title}" (${island.rows.length} rows)`);
  });

  // Detect column types for merged dataset
  // Use the most permissive type if columns have different types across islands
  const detectedTypes: ColumnType[] = [];

  for (let colIdx = 0; colIdx < firstHeaders.length; colIdx++) {
    const columnName = firstHeaders[colIdx];
    const typesAcrossIslands = islands.map(island => island.detectedTypes[colIdx]);

    // If all types are the same, use that type
    const allSameType = typesAcrossIslands.every(t => t === typesAcrossIslands[0]);
    if (allSameType) {
      detectedTypes.push(typesAcrossIslands[0]);
    } else {
      // Use TEXT as the most permissive type
      console.log(`   ⚠️  Column "${columnName}" has mixed types across islands, using TEXT`);
      detectedTypes.push('TEXT');
    }
  }

  // Add types for metadata columns
  if (options?.addMetadataColumns && metadataColumnNames.length > 0) {
    detectedTypes.push('TEXT', 'TEXT', 'TEXT', 'TEXT'); // 회사명, 기간, 계정코드, 계정명
  }

  if (options?.addIslandIndex) {
    detectedTypes.push('INTEGER'); // island_number
  }

  console.log(`✅ Merged ${islands.length} islands: ${mergedRows.length} total rows, ${mergedHeaders.length} columns`);

  return {
    headers: mergedHeaders,
    rows: mergedRows,
    detectedTypes,
    mergedIslandCount: islands.length,
    islandTitles,
  };
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
    let isPivotTable = false; // Will be determined after collecting some rows

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
        // Quick pivot table check after collecting ~15 rows
        if (rows.length === 15) {
          isPivotTable = isPivotTableQuickCheck(rows, headers);
          if (isPivotTable) {
            console.log('📊 Quick check: This appears to be a pivot table - keeping subtotal rows');
          }
        }

        // Skip summary rows (totals, etc.)
        // Pass row index and merge info for merged cell detection
        // For pivot tables, keep subtotal rows (they're part of the hierarchy)
        if (!isSummaryRow(rowData, i, merges, isPivotTable)) {
          rows.push(rowData);
        } else {
          console.log(`⏭️  Skipping summary row ${i + 1}:`, Object.values(rowData).slice(0, 3).join(' | '));
        }
      }
    }

    if (headers.length > 0 && rows.length > 0) {
      // Detect and handle pivot table structure
      const numCategoryColumns = detectPivotTableStructure(rows, headers);
      if (numCategoryColumns > 0) {
        rows = forwardFillCategoryColumns(rows, headers, numCategoryColumns);
      }

      const detectedTypes = detectColumnTypes(rows, headers);
      const splitSuggestions = detectSplitSuggestions(rows, headers);

      if (splitSuggestions.length > 0) {
        console.log(`💡 Found ${splitSuggestions.length} column split suggestion(s):`);
        splitSuggestions.forEach((suggestion) => {
          console.log(`   "${suggestion.originalColumn}" → [${suggestion.suggestedColumns.map(c => `"${c.name}" (${c.type})`).join(', ')}]`);
        });
      }

      // Detect data islands
      const detectedIslands = detectDataIslands(allRows, rawData, merges, skipRows);

      if (detectedIslands.length > 0) {
        console.log(`🏝️  Found ${detectedIslands.length} data island(s) in sheet "${sheetName}"`);
        detectedIslands.forEach((island) => {
          console.log(`   "${island.title}": ${island.rowCount} rows`);
        });
      }

      // Calculate skipped row numbers for display
      const skippedBottomRowNumbers: number[] = [];
      if (skipBottomRows > 0) {
        for (let i = dataEndIndex; i < totalRows; i++) {
          skippedBottomRowNumbers.push(i + 1); // Convert to 1-based
        }
      }

      sheets.push({
        name: sheetName,
        headers,
        rows,
        detectedTypes,
        splitSuggestions: splitSuggestions.length > 0 ? splitSuggestions : undefined,
        detectedIslands: detectedIslands.length > 0 ? detectedIslands : undefined,
        // Row processing metadata
        originalRowCount: totalRows,
        headerRowNumber: headerRow,
        skippedBottomRowNumbers: skippedBottomRowNumbers.length > 0 ? skippedBottomRowNumbers : undefined,
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

  // Pattern for splitting - ignores minus sign, captures only the digits
  // Space is optional to handle both "2026/01/30 -5" and "2026/01/29-7"
  // Support both YYYY and YY year formats
  const dateWithNumberPattern4Digit = /^(\d{4}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/; // YYYY-MM-DD-N
  const dateWithNumberPattern2Digit = /^(\d{2}[-/]\d{2}[-/]\d{2})\s*-?(\d+)$/;  // YY-MM-DD-N

  // Create new headers (replace original with two new columns)
  const newHeaders = [...sheetData.headers];
  console.log(`\n🔍 ===== COLUMN SPLIT DEBUG =====`);
  console.log(`🔍 Original headers (${sheetData.headers.length}):`, JSON.stringify(sheetData.headers));
  console.log(`   Splitting column "${originalColumn}" at index ${originalIndex}`);
  console.log(`   New column names: date="${newColumnNames.date}", number="${newColumnNames.number}"`);
  newHeaders.splice(originalIndex, 1, newColumnNames.date, newColumnNames.number);
  console.log(`🔍 New headers after split (${newHeaders.length}):`, JSON.stringify(newHeaders));
  console.log(`   Difference: ${newHeaders.length} - ${sheetData.headers.length} = ${newHeaders.length - sheetData.headers.length} (should be +1)`);

  // Create new rows with split data
  let splitSuccessCount = 0;
  let splitFailCount = 0;

  const newRows = sheetData.rows.map((row, idx) => {
    const originalValue = row[originalColumn];

    // Calculate split values
    let dateValue: any;
    let numberValue: any;

    if (typeof originalValue === 'string') {
      const trimmed = originalValue.trim();
      // Try 4-digit year pattern first, then 2-digit
      let match = trimmed.match(dateWithNumberPattern4Digit);
      let matchType = '4-digit';

      if (!match) {
        match = trimmed.match(dateWithNumberPattern2Digit);
        matchType = '2-digit';
      }

      if (match) {
        // Successfully split - parse as positive number
        dateValue = match[1]; // Date part
        numberValue = parseInt(match[2], 10); // Number part (always positive)
        splitSuccessCount++;

        // Debug first few splits
        if (idx < 3) {
          console.log(`✂️  Split row ${idx}: "${trimmed}" → date:"${match[1]}", number:${match[2]} (${matchType})`);
        }
      } else {
        // Fallback if pattern doesn't match
        dateValue = originalValue;
        numberValue = null;
        splitFailCount++;

        // Debug first few failures
        if (idx < 3) {
          console.log(`✗ Split failed row ${idx}: "${trimmed}" → No match`);
        }
      }
    } else {
      // Non-string value, keep as-is in date column
      dateValue = originalValue;
      numberValue = null;
      splitFailCount++;
    }

    // Rebuild row in the correct column order based on newHeaders
    const newRow: Record<string, any> = {};
    newHeaders.forEach((header) => {
      if (header === newColumnNames.date) {
        newRow[header] = dateValue;
        if (idx === 0) console.log(`     → Header "${header}" matched date column, adding dateValue`);
      } else if (header === newColumnNames.number) {
        newRow[header] = numberValue;
        if (idx === 0) console.log(`     → Header "${header}" matched number column, adding numberValue`);
      } else if (header !== originalColumn) {
        newRow[header] = row[header];
        if (idx === 0) {
          const valueExists = header in row;
          console.log(`     → Header "${header}" is other column, copying from row. Value exists: ${valueExists}, value: ${valueExists ? JSON.stringify(row[header]) : 'N/A'}`);
        }
      } else {
        if (idx === 0) console.log(`     → Header "${header}" === originalColumn "${originalColumn}", SKIPPING (should not happen!)`);
      }
    });

    // Debug first row
    if (idx === 0) {
      console.log(`\n🔍 ROW TRANSFORMATION (first row):`);
      console.log(`   Original row keys (${Object.keys(row).length}):`, JSON.stringify(Object.keys(row)));
      console.log(`   New row keys (${Object.keys(newRow).length}):`, JSON.stringify(Object.keys(newRow)));
      console.log(`   Difference: ${Object.keys(newRow).length} - ${Object.keys(row).length} = ${Object.keys(newRow).length - Object.keys(row).length} (should be +1)`);

      // Check which columns are in newHeaders but not in newRow
      const missingInNewRow = newHeaders.filter(h => !(h in newRow));
      if (missingInNewRow.length > 0) {
        console.log(`   ⚠️  WARNING: Headers in newHeaders but NOT in newRow:`, JSON.stringify(missingInNewRow));
      }

      // Check which columns are in original row but not in newRow
      const missingFromOriginal = Object.keys(row).filter(k => !(k in newRow) && k !== originalColumn);
      if (missingFromOriginal.length > 0) {
        console.log(`   ⚠️  WARNING: Columns in original row but NOT in newRow (excluding "${originalColumn}"):`, JSON.stringify(missingFromOriginal));
      }

      console.log(`🔍 ===== END SPLIT DEBUG =====\n`);
    }

    return newRow;
  });

  console.log(`✂️  Split complete: ${splitSuccessCount} success, ${splitFailCount} failed`);

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
