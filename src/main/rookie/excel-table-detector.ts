/**
 * Excel Table Boundary Detector
 *
 * AI-powered detection of actual data table boundaries in Excel files.
 * Handles real-world Excel files with title rows, empty rows, summary rows, etc.
 */

import ExcelJS from 'exceljs';
import { generateWithRookieAI } from './rookie-ai-handler';

export interface TableBoundaries {
  headerRow: number;           // Row number with column headers (1-indexed)
  dataStartRow: number;        // First row of actual data (1-indexed)
  dataEndRow: number;          // Last row of actual data (1-indexed)
  dataColumns: string[];       // Column letters with data: ["A", "B", "C"]
  titleRows: number[];         // Rows above header (title, subtitle, etc.)
  summaryRows: number[];       // Rows below data (totals, notes)
  confidence: number;          // Confidence score 0-1
}

interface WorksheetSample {
  firstRows: any[][];
  lastRows: any[][];
  totalRows: number;
  totalColumns: number;
}

/**
 * Main function: Detect table boundaries in an Excel worksheet
 */
export async function detectTableBoundaries(
  worksheet: ExcelJS.Worksheet,
  apiKey?: string
): Promise<TableBoundaries> {
  console.log('[TableDetector] Starting boundary detection...');
  console.log('  Worksheet:', worksheet.name);
  console.log('  Total rows:', worksheet.rowCount);
  console.log('  Total columns:', worksheet.columnCount);

  // Sample first and last rows
  const sample = sampleWorksheet(worksheet);

  // Call AI to identify boundaries
  const boundaries = await aiDetectBoundaries(sample, apiKey);

  // Validate boundaries
  validateBoundaries(boundaries, worksheet);

  console.log('[TableDetector] Detected boundaries:');
  console.log('  Header row:', boundaries.headerRow);
  console.log('  Data range:', `${boundaries.dataStartRow}-${boundaries.dataEndRow}`);
  console.log('  Data columns:', boundaries.dataColumns.join(', '));
  console.log('  Confidence:', boundaries.confidence);

  return boundaries;
}

/**
 * Sample first and last rows from worksheet
 */
function sampleWorksheet(worksheet: ExcelJS.Worksheet): WorksheetSample {
  const totalRows = worksheet.rowCount;
  const totalColumns = worksheet.columnCount;
  const firstRows: any[][] = [];
  const lastRows: any[][] = [];

  const sampleSize = 5;

  // Get first 5 rows (or fewer if file is small)
  for (let i = 1; i <= Math.min(sampleSize, totalRows); i++) {
    const row = worksheet.getRow(i);
    const rowValues: any[] = [];

    // Get all column values
    for (let col = 1; col <= totalColumns; col++) {
      const cell = row.getCell(col);
      rowValues.push(formatCellValue(cell));
    }

    firstRows.push(rowValues);
  }

  // Get last 5 rows (or fewer if file is small)
  const lastRowStart = Math.max(1, totalRows - sampleSize + 1);
  for (let i = lastRowStart; i <= totalRows; i++) {
    const row = worksheet.getRow(i);
    const rowValues: any[] = [];

    for (let col = 1; col <= totalColumns; col++) {
      const cell = row.getCell(col);
      rowValues.push(formatCellValue(cell));
    }

    lastRows.push(rowValues);
  }

  console.log('[TableDetector] Sampled worksheet:');
  console.log('  First rows:', firstRows.length);
  console.log('  Last rows:', lastRows.length);

  return {
    firstRows,
    lastRows,
    totalRows,
    totalColumns,
  };
}

/**
 * Format cell value for AI analysis
 */
function formatCellValue(cell: ExcelJS.Cell): any {
  const value = cell.value;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  // Handle formula result
  if (typeof value === 'object' && 'result' in value) {
    return value.result;
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt: any) => rt.text).join('');
  }

  // Return as-is
  return value;
}

/**
 * Call AI to detect table boundaries from sample data
 */
async function aiDetectBoundaries(
  sample: WorksheetSample,
  apiKey?: string
): Promise<TableBoundaries> {
  console.log('[TableDetector] Calling AI for boundary analysis...');

  const prompt = `Analyze this Excel file structure and identify where the actual data table is located.

**FIRST 5 ROWS:**
${JSON.stringify(sample.firstRows, null, 2)}

**LAST 5 ROWS:**
${JSON.stringify(sample.lastRows, null, 2)}

**FILE METADATA:**
- Total rows: ${sample.totalRows}
- Total columns: ${sample.totalColumns}

**YOUR TASK:**
Identify the boundaries of the main data table in this Excel file.

**Look for:**
1. **Header row** - Which row contains column names/headers?
   - Usually has text labels, not numeric data
   - Often appears after title/subtitle rows
   - May have different formatting

2. **Data start row** - Which row is the first actual data row?
   - Usually the row immediately after the header
   - Contains actual data values, not labels

3. **Data end row** - Which row is the last actual data row?
   - Exclude summary rows (rows with "Total", "Sum", "Average", etc.)
   - Exclude notes or footer rows
   - Find the last row with actual data values

4. **Data columns** - Which columns contain actual data?
   - Exclude completely empty columns
   - Return column letters: ["A", "B", "C", ...]
   - Include all columns between the first and last data column

5. **Title rows** - Which rows appear before the header?
   - Company names, report titles, dates, etc.
   - Usually rows 1, 2, etc. before the header

6. **Summary rows** - Which rows appear after the data?
   - Totals, averages, notes, footer text
   - Usually at the end of the file

**IMPORTANT RULES:**
- Row numbers are 1-indexed (first row = 1, not 0)
- Header row must be BEFORE data start row
- Data start row must be AFTER header row
- Data end row must be >= data start row
- If you see title rows (like "Company Report"), the header is likely a few rows down
- If you see a row with "Total" or "합계" or similar, it's likely a summary row, not data
- Empty rows between title and header are common
- Confidence should be 0.8-1.0 for clear tables, 0.5-0.8 for ambiguous ones

**RESPONSE FORMAT:**
Return a JSON object with these exact fields:
{
  "headerRow": <number>,              // Row with column headers
  "dataStartRow": <number>,           // First data row
  "dataEndRow": <number>,             // Last data row (exclude summaries)
  "dataColumns": ["A", "B", "C", ...], // Columns with data
  "titleRows": [1, 2, ...],           // Rows above header
  "summaryRows": [51, 52, ...],       // Rows after data
  "confidence": <0.0-1.0>             // How confident you are
}`;

  // Response schema for structured output
  const responseSchema = {
    type: 'object',
    properties: {
      headerRow: {
        type: 'number',
        description: 'Row number containing column headers (1-indexed)',
      },
      dataStartRow: {
        type: 'number',
        description: 'First row of actual data (1-indexed)',
      },
      dataEndRow: {
        type: 'number',
        description: 'Last row of actual data, excluding summaries (1-indexed)',
      },
      dataColumns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Column letters containing data, e.g., ["A", "B", "C"]',
      },
      titleRows: {
        type: 'array',
        items: { type: 'number' },
        description: 'Row numbers of title/header rows above the data table',
      },
      summaryRows: {
        type: 'array',
        items: { type: 'number' },
        description: 'Row numbers of summary/footer rows below the data table',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0.0 to 1.0',
      },
    },
    required: ['headerRow', 'dataStartRow', 'dataEndRow', 'dataColumns', 'confidence'],
  };

  const result = await generateWithRookieAI({
    prompt: prompt + '\n\nReturn valid JSON with the exact fields described above.',
    apiKey,
    model: 'gemini-2.5-flash',
    temperature: 0,
    maxOutputTokens: 4096,
    // No responseSchema - using plain JSON parsing
  });

  // Parse JSON manually (no schema used)
  let boundaries: TableBoundaries;
  try {
    const jsonText = result.text.trim();
    const cleaned = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    boundaries = JSON.parse(cleaned) as TableBoundaries;
  } catch (parseError: any) {
    console.error('[TableDetector] Failed to parse JSON:', parseError);
    console.error('[TableDetector] AI response:', result.text);
    throw new Error(`Failed to parse table boundaries: ${parseError.message}`);
  }

  // Ensure arrays exist
  boundaries.titleRows = boundaries.titleRows || [];
  boundaries.summaryRows = boundaries.summaryRows || [];

  console.log('[TableDetector] AI detection complete');
  console.log('  Header row:', boundaries.headerRow);
  console.log('  Data range:', `${boundaries.dataStartRow}-${boundaries.dataEndRow}`);
  console.log('  Confidence:', boundaries.confidence);

  return boundaries;
}

/**
 * Validate detected boundaries
 */
function validateBoundaries(
  boundaries: TableBoundaries,
  worksheet: ExcelJS.Worksheet
): void {
  const totalRows = worksheet.rowCount;

  // Basic validation
  if (boundaries.headerRow < 1 || boundaries.headerRow > totalRows) {
    throw new Error(`Invalid headerRow: ${boundaries.headerRow} (must be 1-${totalRows})`);
  }

  if (boundaries.dataStartRow < 1 || boundaries.dataStartRow > totalRows) {
    throw new Error(`Invalid dataStartRow: ${boundaries.dataStartRow} (must be 1-${totalRows})`);
  }

  if (boundaries.dataEndRow < 1 || boundaries.dataEndRow > totalRows) {
    throw new Error(`Invalid dataEndRow: ${boundaries.dataEndRow} (must be 1-${totalRows})`);
  }

  if (boundaries.headerRow >= boundaries.dataStartRow) {
    throw new Error(`headerRow (${boundaries.headerRow}) must be before dataStartRow (${boundaries.dataStartRow})`);
  }

  if (boundaries.dataStartRow > boundaries.dataEndRow) {
    throw new Error(`dataStartRow (${boundaries.dataStartRow}) must be <= dataEndRow (${boundaries.dataEndRow})`);
  }

  if (!boundaries.dataColumns || boundaries.dataColumns.length === 0) {
    throw new Error('dataColumns cannot be empty');
  }

  console.log('[TableDetector] Boundaries validated successfully');
}

/**
 * Get column letter from column number (1-indexed)
 */
export function getColumnLetter(colNumber: number): string {
  let letter = '';
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colNumber = Math.floor((colNumber - 1) / 26);
  }
  return letter;
}

/**
 * Get column number from column letter
 */
export function getColumnNumber(letter: string): number {
  let number = 0;
  for (let i = 0; i < letter.length; i++) {
    number = number * 26 + (letter.charCodeAt(i) - 64);
  }
  return number;
}
