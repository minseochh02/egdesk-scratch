/**
 * User Data Types
 *
 * TypeScript interfaces for user-created database tables and operations
 *
 * NOTE: All user tables automatically include an auto-incrementing 'id' column
 * as the first column (INTEGER PRIMARY KEY AUTOINCREMENT)
 */

/**
 * Column data types supported
 */
export type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'DATE';

/**
 * Column schema definition
 */
export interface ColumnSchema {
  name: string;
  type: ColumnType;
  notNull?: boolean;
  defaultValue?: string | number | null;
  isUniqueKey?: boolean; // Mark if this column is part of the unique key
}

/**
 * User table metadata
 */
export interface UserTable {
  id: string;
  tableName: string;
  displayName: string;
  description?: string;
  createdFromFile?: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
  schemaJson: string; // JSON array of ColumnSchema
  uniqueKeyColumns?: string; // JSON array of column names that form unique key
  duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range'; // How to handle duplicates
}

/**
 * Parsed user table with schema
 */
export interface UserTableWithSchema extends Omit<UserTable, 'schemaJson'> {
  schema: ColumnSchema[];
}

/**
 * Import operation status
 */
export type ImportOperationStatus = 'running' | 'completed' | 'failed';

/**
 * Import operation tracking
 */
export interface ImportOperation {
  id: string;
  tableId: string;
  fileName: string;
  status: ImportOperationStatus;
  startedAt: string;
  completedAt?: string;
  rowsImported: number;
  rowsSkipped: number;
  errorMessage?: string;
}

/**
 * Data for creating an import operation
 */
export interface CreateImportOperationData {
  tableId: string;
  fileName: string;
}

/**
 * Results from completing an import operation
 */
export interface ImportResults {
  rowsImported: number;
  rowsSkipped: number;
  errorMessage?: string;
}

/**
 * Results from inserting rows
 */
export interface InsertResult {
  inserted: number;
  skipped: number;
  duplicates: number; // Number of duplicates skipped/updated
  errors: string[];
}

/**
 * Query options for data retrieval
 */
export interface QueryOptions {
  filters?: Record<string, string>; // column: value (supports operators like >30, <100)
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  searchQuery?: string; // For full-text search
  searchColumns?: string[]; // Columns to search in
}

/**
 * Query result with pagination info
 */
export interface QueryResult {
  rows: any[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Aggregation functions
 */
export type AggregationFunction = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';

/**
 * Aggregation options
 */
export interface AggregationOptions {
  column: string;
  function: AggregationFunction;
  filters?: Record<string, string>;
  groupBy?: string;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  value: number;
  groupedResults?: Array<{ group: string; value: number }>;
}

/**
 * Suggestion to split a column into multiple columns
 */
export interface ColumnSplitSuggestion {
  originalColumn: string;
  suggestedColumns: Array<{
    name: string;
    type: ColumnType;
  }>;
  pattern: 'date-with-number'; // Can extend with more patterns later
}

/**
 * Detected data island within a spreadsheet
 */
export interface DataIsland {
  title: string; // e.g., "3. 자금의 증가" or "회사명 : (주)영일오엔씨 / 2026/01/01 ~ 2026/01/31 / 계정별원장 / 1023(현금 시재금-창원)"
  titleRowIndex: number; // 0-based row index of title
  headerRowIndex: number; // 0-based row index of headers
  dataStartIndex: number; // 0-based row index where data starts
  dataEndIndex: number; // 0-based row index where data ends (exclusive)
  headers: string[];
  rows: any[];
  detectedTypes: ColumnType[];
  rowCount: number;
  splitSuggestions?: ColumnSplitSuggestion[]; // Suggested column splits
  metadata?: {
    company?: string; // e.g., "(주)영일오엔씨"
    dateRange?: string; // e.g., "2026/01/01 ~ 2026/01/31"
    accountCode?: string; // e.g., "1023"
    accountName?: string; // e.g., "현금 시재금-창원"
    rawTitle: string; // Full title text
  };
}

/**
 * Result from merging multiple islands into one dataset
 */
export interface MergedIslandsResult {
  headers: string[];
  rows: any[];
  detectedTypes: ColumnType[];
  mergedIslandCount: number;
  islandTitles: string[];
}

/**
 * Parsed Excel file data
 */
export interface ParsedExcelData {
  sheets: Array<{
    name: string;
    headers: string[];
    rows: any[];
    detectedTypes: ColumnType[];
    splitSuggestions?: ColumnSplitSuggestion[]; // Suggested column splits
    detectedIslands?: DataIsland[]; // Detected data islands
  }>;
  selectedSheet: number;
  suggestedTableName: string;
}

/**
 * Excel import configuration
 */
export interface ExcelImportConfig {
  filePath: string;
  sheetIndex: number;
  tableName: string;
  displayName: string;
  description?: string;
  columnMappings?: Record<string, string>; // originalName: newName
  columnTypes?: Record<string, ColumnType>; // columnName: type
  mergeConfig?: Record<string, { sources: string[]; separator: string }>; // dbColumnName: { sources, separator }
  appliedSplits?: Array<{ originalColumn: string; dateColumn: string; numberColumn: string }>; // Applied column splits
  headerRow?: number; // Which row contains headers (1-based)
  skipRows?: number; // How many rows to skip at the top
  skipBottomRows?: number; // How many rows to skip at the bottom (totals)
  uniqueKeyColumns?: string[]; // Columns that form the unique key
  duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range'; // How to handle duplicates
  addTimestamp?: boolean; // Whether to add imported_at timestamp column
}
