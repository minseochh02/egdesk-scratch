import fs from 'fs/promises';
import path from 'path';
import {
  ParsedExcelData,
  ColumnType,
  ColumnSplitSuggestion,
} from './types';
import {
  sanitizeTableName,
  sanitizeColumnName,
  detectColumnType,
  detectSplitSuggestions,
} from './excel-parser';

/**
 * CSV Parser
 *
 * Parses CSV files and auto-detects schema from data
 * Returns data in the same format as Excel parser for compatibility
 */

/**
 * CSV parsing options
 */
interface CSVParseOptions {
  delimiter?: string; // Default: auto-detect (comma, semicolon, tab)
  quote?: string; // Default: "
  escape?: string; // Default: "
  skipEmptyLines?: boolean; // Default: true
  trim?: boolean; // Default: true
}

/**
 * Auto-detect CSV delimiter by analyzing first few lines
 */
function detectDelimiter(lines: string[]): string {
  const delimiters = [',', ';', '\t', '|'];
  const scores: Record<string, number> = {};

  // Check first 5 lines (or fewer)
  const sampleLines = lines.slice(0, Math.min(5, lines.length));

  for (const delimiter of delimiters) {
    let counts: number[] = [];

    for (const line of sampleLines) {
      // Simple count - doesn't handle quotes yet
      const count = line.split(delimiter).length - 1;
      counts.push(count);
    }

    // Good delimiter should have:
    // 1. At least 1 occurrence per line
    // 2. Consistent count across lines
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length;

    if (avgCount > 0 && variance < 1) {
      scores[delimiter] = avgCount; // Higher score = more columns
    }
  }

  // Return delimiter with highest score (most columns with consistency)
  const bestDelimiter = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  if (bestDelimiter) {
    const delimiterName = {
      ',': 'comma',
      ';': 'semicolon',
      '\t': 'tab',
      '|': 'pipe',
    }[bestDelimiter[0]] || bestDelimiter[0];

    console.log(`📊 Auto-detected CSV delimiter: ${delimiterName} (${bestDelimiter[1].toFixed(1)} columns)`);
    return bestDelimiter[0];
  }

  // Default to comma
  console.log('📊 Using default delimiter: comma');
  return ',';
}

/**
 * Parse a single CSV line handling quotes and escapes
 */
function parseCSVLine(line: string, delimiter: string, quote: string, escape: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = i + 1 < line.length ? line[i + 1] : null;

    if (char === escape && nextChar === quote && inQuotes) {
      // Escaped quote inside quoted field
      currentValue += quote;
      i += 2;
    } else if (char === quote) {
      // Toggle quote state
      inQuotes = !inQuotes;
      i++;
    } else if (char === delimiter && !inQuotes) {
      // Field separator (not in quotes)
      values.push(currentValue);
      currentValue = '';
      i++;
    } else {
      // Regular character
      currentValue += char;
      i++;
    }
  }

  // Push last value
  values.push(currentValue);

  return values;
}

/**
 * Parse CSV content into rows
 */
function parseCSVContent(
  content: string,
  options: CSVParseOptions = {}
): string[][] {
  const {
    delimiter = ',',
    quote = '"',
    escape = '"',
    skipEmptyLines = true,
    trim = true,
  } = options;

  // Split into lines (handle both \r\n and \n)
  const lines = content.split(/\r?\n/);

  const rows: string[][] = [];

  for (const line of lines) {
    // Skip empty lines if requested
    if (skipEmptyLines && line.trim() === '') {
      continue;
    }

    // Parse the line
    const values = parseCSVLine(line, delimiter, quote, escape);

    // Trim values if requested
    const processedValues = trim ? values.map(v => v.trim()) : values;

    rows.push(processedValues);
  }

  return rows;
}

/**
 * Detect column types from CSV rows
 */
function detectColumnTypes(rows: any[], headers: string[]): ColumnType[] {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);
    const detectedType = detectColumnType(values, header);

    // Log detected type for date columns
    if (detectedType === 'DATE' || header.includes('일자') || header.includes('날짜')) {
      console.log(`📊 Column "${header}" detected as: ${detectedType}`, { sampleValues: values.slice(0, 3) });
    }

    return detectedType;
  });
}

/**
 * Parse CSV file and extract data with schema detection
 */
export async function parseCSVFile(
  filePath: string,
  options?: {
    delimiter?: string; // Auto-detect if not provided
    headerRow?: number; // Which row contains headers (1-based, default: 1)
    skipRows?: number; // How many rows to skip at the top (default: 0)
    skipBottomRows?: number; // How many rows to skip at the bottom (default: 0)
  }
): Promise<ParsedExcelData> {
  // Read file as string
  const content = await fs.readFile(filePath, 'utf-8');

  // Split into lines for delimiter detection
  const allLines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  // Auto-detect delimiter if not provided
  const delimiter = options?.delimiter || detectDelimiter(allLines);

  // Parse CSV content
  const allRows = parseCSVContent(content, {
    delimiter,
    skipEmptyLines: true,
    trim: true,
  });

  const headerRow = options?.headerRow || 1;
  const skipRows = options?.skipRows || 0;
  const skipBottomRows = options?.skipBottomRows || 0;

  const totalRows = allRows.length;
  const headerRowIndex = headerRow - 1; // Convert to 0-based
  const dataStartIndex = headerRowIndex + 1;
  const dataEndIndex = totalRows - skipBottomRows;

  // Extract headers from specified row
  let headers: string[] = [];

  if (headerRowIndex < allRows.length) {
    const headerValues = allRows[headerRowIndex];
    const rawHeaders = headerValues.map((h, idx) => {
      const headerValue = h && h.trim() ? h.trim() : `Column${idx + 1}`;
      return sanitizeColumnName(headerValue);
    });

    // Handle duplicate column names by adding suffixes
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

    console.log('📝 Original CSV headers:', headerValues);
    console.log('📝 Processed headers:', headers);
  }

  // Extract data rows (skip top rows and bottom rows)
  const rows: any[] = [];

  for (let i = dataStartIndex; i < dataEndIndex && i < allRows.length; i++) {
    const rowData: any = {};
    const values = allRows[i];

    headers.forEach((header, idx) => {
      const cellValue = values[idx];

      // Try to parse as number
      if (cellValue && cellValue.trim() !== '') {
        const trimmedValue = cellValue.trim();

        // Try to parse as number (handle commas)
        const withoutCommas = trimmedValue.replace(/,/g, '');
        const num = parseFloat(withoutCommas);

        if (!isNaN(num) && /^-?[\d,]+(\.\d+)?$/.test(trimmedValue)) {
          // It's a valid number
          rowData[header] = num;
        } else {
          // Keep as string
          rowData[header] = trimmedValue;
        }
      } else {
        rowData[header] = null;
      }
    });

    // Only include rows that have at least one non-null value
    const hasData = Object.values(rowData).some(
      (v) => v !== null && v !== undefined && v !== ''
    );

    if (hasData) {
      rows.push(rowData);
    }
  }

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('No valid data found in CSV file');
  }

  const detectedTypes = detectColumnTypes(rows, headers);
  const splitSuggestions = detectSplitSuggestions(rows, headers);

  if (splitSuggestions.length > 0) {
    console.log(`💡 Found ${splitSuggestions.length} column split suggestion(s):`);
    splitSuggestions.forEach((suggestion) => {
      console.log(`   "${suggestion.originalColumn}" → [${suggestion.suggestedColumns.map(c => `"${c.name}" (${c.type})`).join(', ')}]`);
    });
  }

  // Calculate skipped row numbers for display
  const skippedBottomRowNumbers: number[] = [];
  if (skipBottomRows > 0) {
    for (let i = dataEndIndex; i < totalRows; i++) {
      skippedBottomRowNumbers.push(i + 1); // Convert to 1-based
    }
  }

  const fileName = path.basename(filePath);
  const suggestedTableName = sanitizeTableName(fileName);

  // Return in same format as Excel parser for compatibility
  return {
    sheets: [
      {
        name: 'CSV Data',
        headers,
        rows,
        detectedTypes,
        splitSuggestions: splitSuggestions.length > 0 ? splitSuggestions : undefined,
        originalRowCount: totalRows,
        headerRowNumber: headerRow,
        skippedBottomRowNumbers: skippedBottomRowNumbers.length > 0 ? skippedBottomRowNumbers : undefined,
      },
    ],
    selectedSheet: 0,
    suggestedTableName,
  };
}

/**
 * Validate CSV file before parsing
 */
export function validateCSVFile(filePath: string): { valid: boolean; error?: string } {
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.csv') {
    return {
      valid: false,
      error: 'Invalid file format. Only .csv files are supported.',
    };
  }

  return { valid: true };
}
