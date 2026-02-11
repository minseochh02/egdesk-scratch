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
export type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

/**
 * Column schema definition
 */
export interface ColumnSchema {
  name: string;
  type: ColumnType;
  notNull?: boolean;
  defaultValue?: string | number | null;
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
 * Parsed Excel file data
 */
export interface ParsedExcelData {
  sheets: Array<{
    name: string;
    headers: string[];
    rows: any[];
    detectedTypes: ColumnType[];
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
  headerRow?: number; // Which row contains headers (1-based)
  skipRows?: number; // How many rows to skip at the top
  skipBottomRows?: number; // How many rows to skip at the bottom (totals)
}
