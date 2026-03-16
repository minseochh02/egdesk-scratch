import { ipcMain, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import os from 'os';
import * as XLSX from 'xlsx';
import { getSQLiteManager } from '../sqlite/manager';
import {
  parseExcelFile,
  validateExcelFile,
  validateFile,
  sanitizeTableName,
  sanitizeColumnName,
  mergeIslands,
} from './excel-parser';
import { parseCSVFile, validateCSVFile } from './csv-parser';
import { ExcelImportConfig, ColumnSchema, DataIsland } from './types';
import {
  autoDetectUniqueKeyColumns,
  getRecommendedDuplicateAction,
} from './duplicate-detection-helper';
import { GeminiEmbeddingService } from '../embeddings/gemini-embedding-service';

/**
 * User Data IPC Handlers
 *
 * Handles IPC communication for user data operations including Excel import
 */

import { registerUpdateTableDuplicateSettingsHandler } from './update-table-duplicate-settings-ipc';

/**
 * Convert absolute path to relative path with ~ for portability
 * @param absolutePath - Absolute file path
 * @returns Relative path with ~ (e.g., ~/Downloads/EGDesk-Browser/...)
 */
function makePathPortable(absolutePath: string): string {
  const homeDir = os.homedir();
  if (absolutePath.startsWith(homeDir)) {
    return absolutePath.replace(homeDir, '~');
  }
  return absolutePath;
}

/**
 * Expand ~ in path to OS-specific home directory
 * @param portablePath - Path with ~ (e.g., ~/Downloads/EGDesk-Browser/...)
 * @returns Absolute path for current OS and user
 */
function expandPortablePath(portablePath: string): string {
  if (portablePath.startsWith('~')) {
    const homeDir = os.homedir();
    return portablePath.replace('~', homeDir);
  }
  return portablePath;
}

/**
 * Register User Data IPC Handlers
 */
export function registerUserDataIPCHandlers(): void {
  // Register duplicate settings update handler
  registerUpdateTableDuplicateSettingsHandler();
  /**
   * Get specific rows from Excel file for preview
   */
  ipcMain.handle('user-data:get-excel-rows-preview', async (event, filePath: string, options: {
    sheetIndex?: number;
    headerRow?: number; // Get this specific row for header preview
    bottomRowCount?: number; // Get last N rows for skip preview
  }) => {
    try {
      const buffer = await fs.readFile(filePath);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      const sheetIndex = options.sheetIndex || 0;
      const sheetName = workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to array of arrays
      const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
      const totalRows = allRows.length;

      const result: any = {
        totalRows,
        sheetName,
      };

      // Get header row preview if requested
      if (options.headerRow && options.headerRow > 0 && options.headerRow <= totalRows) {
        const headerRowIndex = options.headerRow - 1; // Convert to 0-based
        const headerRowData = allRows[headerRowIndex];

        result.headerRow = {
          rowNumber: options.headerRow,
          content: headerRowData.filter((cell: any) => cell !== null && cell !== ''),
          rawRow: headerRowData,
        };
      }

      // Get bottom rows preview if requested
      if (options.bottomRowCount && options.bottomRowCount > 0) {
        const startIndex = Math.max(0, totalRows - options.bottomRowCount);
        const bottomRows = allRows.slice(startIndex);

        result.bottomRows = bottomRows.map((row, idx) => ({
          rowNumber: startIndex + idx + 1, // 1-based row number
          content: row.filter((cell: any) => cell !== null && cell !== ''),
          rawRow: row,
        }));
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error reading Excel rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read Excel file',
      };
    }
  });

  /**
   * Parse Excel or CSV file and return preview data
   */
  ipcMain.handle('user-data:parse-excel', async (event, filePath: string, options?: {
    headerRow?: number;
    skipRows?: number;
    skipBottomRows?: number;
    delimiter?: string; // For CSV files
  }) => {
    try {
      // Validate file (supports both Excel and CSV)
      const validation = validateFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Parse file based on type
      let parsedData;
      if (validation.fileType === 'csv') {
        parsedData = await parseCSVFile(filePath, options);
      } else {
        parsedData = await parseExcelFile(filePath, options);
      }

      return {
        success: true,
        data: parsedData,
      };
    } catch (error) {
      console.error('Error parsing file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      };
    }
  });

  /**
   * Import Excel or CSV data to create a new table
   */
  ipcMain.handle('user-data:import-excel', async (event, config: ExcelImportConfig) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Validate file type
      const validation = validateFile(config.filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Parse file again to get the data (with any parsing options)
      let parsedData;
      if (validation.fileType === 'csv') {
        parsedData = await parseCSVFile(config.filePath, {
          headerRow: config.headerRow,
          skipRows: config.skipRows,
          skipBottomRows: config.skipBottomRows,
        });
      } else {
        parsedData = await parseExcelFile(config.filePath, {
          headerRow: config.headerRow,
          skipRows: config.skipRows,
          skipBottomRows: config.skipBottomRows,
        });
      }

      if (config.sheetIndex < 0 || config.sheetIndex >= parsedData.sheets.length) {
        return {
          success: false,
          error: 'Invalid sheet index',
        };
      }

      let selectedSheet = parsedData.sheets[config.sheetIndex];

      // Apply column splits if they were applied in the frontend
      if (config.appliedSplits && config.appliedSplits.length > 0) {
        console.log(`✂️  Applying ${config.appliedSplits.length} column split(s) to backend data`);

        config.appliedSplits.forEach((split) => {
          const { applySplitColumn } = require('./excel-parser');
          selectedSheet = applySplitColumn(selectedSheet, split.originalColumn, {
            date: split.dateColumn,
            number: split.numberColumn,
          });
          console.log(`   ✂️  Split "${split.originalColumn}" → ["${split.dateColumn}", "${split.numberColumn}"]`);
        });
      }

      const fileName = path.basename(config.filePath);

      // Build column schema based on columnMappings and mergeConfig
      let schema: ColumnSchema[];

      if (config.columnMappings) {
        // Get unique DB column names (handle merges)
        const uniqueDbColumns = new Set(Object.values(config.columnMappings));

        schema = Array.from(uniqueDbColumns).map((dbColumnName) => {
          // Validate column name
          if (!dbColumnName || dbColumnName.trim() === '') {
            throw new Error('Invalid column name: empty or null');
          }

          // Find all Excel columns that map to this DB column
          const sourceExcelColumns = Object.entries(config.columnMappings!)
            .filter(([_, sqlName]) => sqlName === dbColumnName)
            .map(([originalName]) => originalName);

          if (sourceExcelColumns.length === 0) {
            throw new Error(`No source columns for database column: ${dbColumnName}`);
          }

          // Get type from first source column
          const firstSourceName = sourceExcelColumns[0];

          // Check if column type is explicitly provided (e.g., from split columns)
          let columnType = config.columnTypes?.[firstSourceName];

          // If not provided, try to find it in the sheet
          if (!columnType) {
            const originalIndex = selectedSheet.headers.indexOf(firstSourceName);

            if (originalIndex === -1) {
              throw new Error(`Source column not found in Excel: ${firstSourceName}`);
            }

            columnType = selectedSheet.detectedTypes[originalIndex];
          }

          return {
            name: dbColumnName,
            type: columnType,
            notNull: false,
          };
        });
      } else {
        // Fallback: include all columns with sanitized names
        schema = selectedSheet.headers.map((header, idx) => {
          const sanitizedName = sanitizeColumnName(header);
          const columnType = config.columnTypes?.[header] || selectedSheet.detectedTypes[idx];

          return {
            name: sanitizedName,
            type: columnType,
            notNull: false,
          };
        });
      }

      // Final validation: ensure no duplicate column names
      const columnNames = schema.map((c) => c.name);
      const duplicateNames = columnNames.filter((name, idx) => columnNames.indexOf(name) !== idx);
      if (duplicateNames.length > 0) {
        return {
          success: false,
          error: `Duplicate column names detected: ${[...new Set(duplicateNames)].join(', ')}. Please rename columns to unique names.`,
        };
      }

      // Check if table already exists (config.tableName should already be a valid SQL name)
      const existingTable = userDataManager.getTableByName(config.tableName);
      if (existingTable) {
        return {
          success: false,
          error: `A table with name "${config.tableName}" already exists`,
        };
      }

      // Validate schema
      if (!schema || schema.length === 0) {
        return {
          success: false,
          error: 'No columns to import. Please map at least one column.',
        };
      }

      console.log('Creating table with schema:', JSON.stringify(schema, null, 2));

      // Use manual selection if provided, otherwise auto-detect
      let uniqueKeyColumns: string[];
      let duplicateAction: string;
      
      if (config.uniqueKeyColumns !== undefined) {
        // Use manual selection from UI 
        uniqueKeyColumns = config.uniqueKeyColumns;
        duplicateAction = config.duplicateAction || 'skip';
        
        if (uniqueKeyColumns.length > 0) {
          console.log('Using manual duplicate detection settings (ENABLED):');
          console.log('  Unique Key Columns:', uniqueKeyColumns);
          console.log('  Duplicate Action:', duplicateAction);
        } else {
          console.log('Using manual duplicate detection settings (DISABLED):');
          console.log('  Unique Key Columns: [] (disabled by user)');
          console.log('  Duplicate Action: skip (no duplicate checking will occur)');
        }
      } else {
        // No manual config provided - disable duplicate detection entirely
        uniqueKeyColumns = [];
        duplicateAction = 'skip';
        console.log('No duplicate detection configuration provided - importing all data without duplicate checking');
      }

      // Create import operation
      let importOperation: any = null;
      let table: any = null;
      let tableId: string | null = null;

      try {
        // Debug: Log received unique key columns
        console.log(`🔧 Received uniqueKeyColumns for table creation: [${uniqueKeyColumns?.join(', ') || 'none'}] (count: ${uniqueKeyColumns?.length || 0})`);
        console.log(`🔧 Received duplicateAction: ${duplicateAction}`);
        console.log(`🔧 Add timestamp column: ${config.addTimestamp ? 'YES' : 'NO'}`);

        // Add imported_at column if requested
        if (config.addTimestamp) {
          schema.push({
            name: 'imported_at',
            type: 'TEXT', // Store as ISO string in SQLite
            notNull: false,
          });
          console.log('✅ Added imported_at timestamp column to schema');
        }

        // Create table from schema with duplicate detection settings
        table = userDataManager.createTableFromSchema(config.displayName, schema, {
          tableName: config.tableName, // Use user-specified table name
          description: config.description,
          createdFromFile: fileName,
          uniqueKeyColumns: uniqueKeyColumns.length > 0 ? uniqueKeyColumns : undefined,
          duplicateAction: uniqueKeyColumns.length > 0 ? duplicateAction : undefined,
          hasImportedAtColumn: config.addTimestamp,
        });
        tableId = table.id;
        console.log('Table created successfully:', tableId, 'Name:', table.tableName);
        console.log('Duplicate detection:', uniqueKeyColumns.length > 0 ? 'ENABLED' : 'DISABLED');

        // Create import operation
        importOperation = userDataManager.createImportOperation({
          tableId: table.id,
          fileName,
        });

        // Prepare rows for insertion - map original headers to SQL names with merge support
        const currentTimestamp = new Date().toISOString();
        const rowsToInsert = selectedSheet.rows.map((row) => {
          const mappedRow: any = {};

          if (config.columnMappings) {
            // Get unique DB column names
            const uniqueDbColumns = new Set(Object.values(config.columnMappings));

            uniqueDbColumns.forEach((dbColumnName) => {
              // Check if this DB column has a merge configuration
              const mergeInfo = config.mergeConfig?.[dbColumnName];

              if (mergeInfo && mergeInfo.sources.length > 1) {
                // Merge multiple Excel columns into one DB column
                const values = mergeInfo.sources
                  .map((sourceName) => {
                    const value = row[sourceName];
                    return value !== null && value !== undefined ? String(value).trim() : '';
                  })
                  .filter((v) => v !== ''); // Filter out empty values

                mappedRow[dbColumnName] = values.join(mergeInfo.separator);
              } else {
                // Simple 1:1 mapping - find the Excel column that maps to this DB column
                const sourceExcelColumn = Object.entries(config.columnMappings).find(
                  ([_, sqlName]) => sqlName === dbColumnName
                );

                if (sourceExcelColumn) {
                  const [originalName] = sourceExcelColumn;
                  mappedRow[dbColumnName] = row[originalName];
                }
              }
            });
          } else {
            // Fallback: include all columns with sanitized names
            selectedSheet.headers.forEach((originalHeader) => {
              const sanitizedName = sanitizeColumnName(originalHeader);
              mappedRow[sanitizedName] = row[originalHeader];
            });
          }

          // Add timestamp if requested
          if (config.addTimestamp) {
            mappedRow['imported_at'] = currentTimestamp;
          }

          return mappedRow;
        });

        // Insert rows in batches
        const insertResult = userDataManager.insertRows(table.id, rowsToInsert);

        console.log('Import results:', {
          inserted: insertResult.inserted,
          skipped: insertResult.skipped,
          duplicates: insertResult.duplicates,
          errors: insertResult.errors.length,
          duplicateDetails: insertResult.duplicateDetails?.length || 0,
          errorDetails: insertResult.errorDetails?.length || 0,
        });

        // Complete import operation
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: insertResult.inserted,
          rowsSkipped: insertResult.skipped,
          errorMessage:
            insertResult.errors.length > 0
              ? insertResult.errors.slice(0, 5).join('; ')
              : undefined,
        });

        return {
          success: true,
          data: {
            table,
            importOperation: {
              ...importOperation,
              rowsImported: insertResult.inserted,
              rowsSkipped: insertResult.skipped,
              duplicatesSkipped: insertResult.duplicates,
              duplicateDetails: insertResult.duplicateDetails || [],
              errorDetails: insertResult.errorDetails || [],
            },
          },
        };
      } catch (error) {
        console.error('Import failed, cleaning up...', error);

        // If import fails, try to complete the operation with error
        if (importOperation) {
          try {
            userDataManager.completeImportOperation(importOperation.id, {
              rowsImported: 0,
              rowsSkipped: 0,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
          } catch (completeError) {
            console.error('Error completing failed import operation:', completeError);
          }
        }

        // Clean up: Drop the data table and delete metadata
        if (tableId || table) {
          try {
            const cleanupTableName = table?.tableName || sanitizedTableName;
            console.log('Cleaning up table:', cleanupTableName);

            // Drop the actual data table directly
            try {
              manager.getUserDataDatabase().exec(`DROP TABLE IF EXISTS "${cleanupTableName}"`);
              console.log('Data table dropped');
            } catch (dropError) {
              console.error('Error dropping data table:', dropError);
            }

            // Delete metadata
            if (tableId) {
              try {
                manager.getUserDataDatabase().prepare('DELETE FROM user_tables WHERE id = ?').run(tableId);
                console.log('Metadata deleted');
              } catch (metaError) {
                console.error('Error deleting metadata:', metaError);
              }
            }
          } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
          }
        }

        throw error;
      }
    } catch (error) {
      console.error('Error importing Excel file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import Excel file',
      };
    }
  });

  /**
   * Rename a table
   */
  ipcMain.handle('user-data:rename-table', async (event, tableId: string, newTableName: string, newDisplayName?: string) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      const result = userDataManager.renameTable(tableId, newTableName, newDisplayName);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        data: result.table,
      };
    } catch (error) {
      console.error('Error renaming table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename table',
      };
    }
  });

  /**
   * Show file picker dialog for Excel files
   */
  ipcMain.handle('user-data:select-excel-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'Excel Files',
            extensions: ['xlsx', 'xls', 'xlsm'],
          },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return {
          success: false,
          canceled: true,
        };
      }

      return {
        success: true,
        filePath: result.filePaths[0],
      };
    } catch (error) {
      console.error('Error selecting Excel file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to select file',
      };
    }
  });

  /**
   * Validate table name availability
   */
  ipcMain.handle('user-data:validate-table-name', async (event, tableName: string) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      const sanitizedName = sanitizeTableName(tableName);
      const existingTable = userDataManager.getTableByName(sanitizedName);

      return {
        success: true,
        data: {
          available: !existingTable,
          sanitizedName,
          message: existingTable
            ? `Table "${sanitizedName}" already exists`
            : `Table name "${sanitizedName}" is available`,
        },
      };
    } catch (error) {
      console.error('Error validating table name:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate table name',
      };
    }
  });

  /**
   * Import pre-parsed island data as a new table
   */
  ipcMain.handle('user-data:import-island', async (event, config: {
    tableName: string;
    displayName: string;
    description?: string;
    headers: string[];
    rows: any[];
    detectedTypes: string[];
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Build column schema from headers and detected types
      const schema: ColumnSchema[] = config.headers.map((header, idx) => ({
        name: header,
        type: config.detectedTypes[idx] as ColumnType,
        notNull: false,
      }));

      // Check if table already exists (config.tableName should already be a valid SQL name)
      const existingTable = userDataManager.getTableByName(config.tableName);
      if (existingTable) {
        return {
          success: false,
          error: `A table with name "${config.tableName}" already exists`,
        };
      }

      console.log(`📦 Creating island table "${config.tableName}" with ${config.rows.length} rows`);

      // Create table
      const table = userDataManager.createTableFromSchema(config.displayName, schema, {
        tableName: config.tableName, // Use user-specified table name
        description: config.description,
        uniqueKeyColumns: config.uniqueKeyColumns && config.uniqueKeyColumns.length > 0
          ? config.uniqueKeyColumns
          : undefined,
        duplicateAction: config.uniqueKeyColumns && config.uniqueKeyColumns.length > 0
          ? config.duplicateAction
          : undefined,
      });

      console.log(`✅ Island table created: ${table.id}`);

      // Create import operation
      const importOperation = userDataManager.createImportOperation({
        tableId: table.id,
        fileName: 'island_import',
      });

      try {
        // Insert rows
        const insertResult = userDataManager.insertRows(table.id, config.rows);

        console.log(`📊 Island import results: ${insertResult.inserted} inserted, ${insertResult.skipped} skipped`);

        // Complete import operation
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: insertResult.inserted,
          rowsSkipped: insertResult.skipped,
          errorMessage: insertResult.errors.length > 0
            ? insertResult.errors.slice(0, 5).join('; ')
            : undefined,
        });

        return {
          success: true,
          data: {
            table,
            importOperation: {
              ...importOperation,
              rowsImported: insertResult.inserted,
              rowsSkipped: insertResult.skipped,
            },
          },
        };
      } catch (error) {
        console.error('Island import failed:', error);

        // Complete import operation with error
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: 0,
          rowsSkipped: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        // Clean up: Drop the table
        try {
          manager.getUserDataDatabase().exec(`DROP TABLE IF EXISTS "${table.tableName}"`);
          manager.getUserDataDatabase().prepare('DELETE FROM user_tables WHERE id = ?').run(table.id);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        throw error;
      }
    } catch (error) {
      console.error('Error importing island:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import island',
      };
    }
  });

  /**
   * Import merged islands as a single table
   */
  ipcMain.handle('user-data:import-merged-islands', async (event, config: {
    tableName: string;
    displayName: string;
    description?: string;
    islands: DataIsland[];
    addMetadataColumns?: boolean;
    addIslandIndex?: boolean;
    addTimestamp?: boolean;
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      console.log(`🔀 Merging ${config.islands.length} islands into table "${config.tableName}"`);

      // Merge islands
      const merged = mergeIslands(config.islands, {
        addMetadataColumns: config.addMetadataColumns,
        addIslandIndex: config.addIslandIndex,
      });

      // Build column schema from merged headers and detected types
      const schema: ColumnSchema[] = merged.headers.map((header, idx) => ({
        name: header,
        type: merged.detectedTypes[idx],
        notNull: false,
      }));

      // Add imported_at column if requested
      if (config.addTimestamp) {
        schema.push({
          name: 'imported_at',
          type: 'TEXT', // Store as ISO string in SQLite
          notNull: false,
        });
        console.log('✅ Added imported_at timestamp column to merged islands schema');
      }

      // Check if table already exists (config.tableName should already be a valid SQL name)
      const existingTable = userDataManager.getTableByName(config.tableName);
      if (existingTable) {
        return {
          success: false,
          error: `A table with name "${config.tableName}" already exists`,
        };
      }

      console.log(`📦 Creating merged table "${config.tableName}" with ${merged.rows.length} rows`);

      // Create table
      const table = userDataManager.createTableFromSchema(config.displayName, schema, {
        tableName: config.tableName, // Use user-specified table name
        description: config.description || `Merged from ${merged.mergedIslandCount} islands: ${merged.islandTitles.join(', ')}`,
        uniqueKeyColumns: config.uniqueKeyColumns && config.uniqueKeyColumns.length > 0
          ? config.uniqueKeyColumns
          : undefined,
        duplicateAction: config.uniqueKeyColumns && config.uniqueKeyColumns.length > 0
          ? config.duplicateAction
          : undefined,
      });

      console.log(`✅ Merged table created: ${table.id}`);

      // Create import operation
      const importOperation = userDataManager.createImportOperation({
        tableId: table.id,
        fileName: 'merged_islands',
      });

      try {
        // Add timestamp to rows if requested
        const rowsToInsert = config.addTimestamp
          ? merged.rows.map(row => ({
              ...row,
              imported_at: new Date().toISOString(),
            }))
          : merged.rows;

        // Insert rows
        const insertResult = userDataManager.insertRows(table.id, rowsToInsert);

        console.log(`📊 Merged import results: ${insertResult.inserted} inserted, ${insertResult.skipped} skipped`);

        // Complete import operation
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: insertResult.inserted,
          rowsSkipped: insertResult.skipped,
          errorMessage: insertResult.errors.length > 0
            ? insertResult.errors.slice(0, 5).join('; ')
            : undefined,
        });

        return {
          success: true,
          data: {
            table,
            importOperation: {
              ...importOperation,
              rowsImported: insertResult.inserted,
              rowsSkipped: insertResult.skipped,
            },
            mergedIslandCount: merged.mergedIslandCount,
            islandTitles: merged.islandTitles,
          },
        };
      } catch (error) {
        console.error('Merged island import failed:', error);

        // Complete import operation with error
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: 0,
          rowsSkipped: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        // Clean up: Drop the table
        try {
          manager.getUserDataDatabase().exec(`DROP TABLE IF EXISTS "${table.tableName}"`);
          manager.getUserDataDatabase().prepare('DELETE FROM user_tables WHERE id = ?').run(table.id);
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        throw error;
      }
    } catch (error) {
      console.error('Error importing merged islands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import merged islands',
      };
    }
  });

  /**
   * Sync Excel data to existing table
   */
  ipcMain.handle('user-data:sync-to-existing-table', async (event, config: {
    filePath: string;
    sheetIndex: number;
    tableId: string;
    columnMappings: Record<string, string>;
    mergeConfig?: Record<string, { sources: string[]; separator: string }>;
    headerRow?: number;
    skipRows?: number;
    skipBottomRows?: number;
    appliedSplits?: Array<{ originalColumn: string; dateColumn: string; numberColumn: string }>;
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
    addTimestamp?: boolean;
  }) => {
    try {
      console.log('🔄 Sync to existing table request:', {
        tableId: config.tableId,
        filePath: config.filePath,
        addTimestamp: config.addTimestamp,
      });

      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Get the existing table
      const table = userDataManager.getTable(config.tableId);
      if (!table) {
        console.error('❌ Table not found:', config.tableId);
        return {
          success: false,
          error: `Table not found: ${config.tableId}`,
        };
      }


      // Parse Excel file (with any parsing options)
      const parsedData = await parseExcelFile(config.filePath, {
        headerRow: config.headerRow,
        skipRows: config.skipRows,
        skipBottomRows: config.skipBottomRows,
      });

      if (config.sheetIndex < 0 || config.sheetIndex >= parsedData.sheets.length) {
        return {
          success: false,
          error: 'Invalid sheet index',
        };
      }

      let selectedSheet = parsedData.sheets[config.sheetIndex];
      const fileName = path.basename(config.filePath);

      // Apply column splits if provided (date-with-number splits from UI)
      if (config.appliedSplits && config.appliedSplits.length > 0) {
        console.log(`✂️  Applying ${config.appliedSplits.length} column split(s) from UI...`);
        const { applySplitColumn } = require('./excel-parser');

        for (const split of config.appliedSplits) {
          console.log(`   "${split.originalColumn}" → ["${split.dateColumn}", "${split.numberColumn}"]`);
          selectedSheet = applySplitColumn(
            selectedSheet as any,
            split.originalColumn,
            { date: split.dateColumn, number: split.numberColumn }
          );
        }

        console.log(`✅ Column splits applied successfully`);
      }

      // Add imported_at column if requested and it doesn't exist
      if (config.addTimestamp) {
        const hasImportedAt = table.schema.some(col => col.name === 'imported_at');
        if (!hasImportedAt) {
          console.log('⏰ Adding imported_at column to existing table');
          const db = manager.getUserDataDatabase();
          db.exec(`ALTER TABLE "${table.tableName}" ADD COLUMN "imported_at" TEXT`);

          // Update table metadata
          const newSchema = [...table.schema, { name: 'imported_at', type: 'TEXT' as any, notNull: false }];
          db.prepare(`UPDATE user_tables SET schema_json = ?, column_count = ?, has_imported_at_column = 1 WHERE id = ?`)
            .run(JSON.stringify(newSchema), newSchema.length, config.tableId);

          console.log('✅ imported_at column added successfully');
        }
      }

      // Create import operation
      const importOperation = userDataManager.createImportOperation({
        tableId: config.tableId,
        fileName,
      });

      try {
        // Map Excel rows to table columns using the same robust logic as regular import
        const currentTimestamp = new Date().toISOString();

        // Debug: Log first row structure before mapping
        console.log('🔍 DEBUG: First row keys from Excel:', Object.keys(selectedSheet.rows[0] || {}));
        console.log('🔍 DEBUG: Column mappings config:', JSON.stringify(config.columnMappings, null, 2));

        const rowsToInsert = selectedSheet.rows.map((row, idx) => {
          const mappedRow: any = {};

          if (config.columnMappings) {
            // Get unique DB column names
            const uniqueDbColumns = new Set(Object.values(config.columnMappings));

            uniqueDbColumns.forEach((dbColumnName) => {
              // Simple 1:1 mapping - find the Excel column that maps to this DB column
              const sourceExcelColumn = Object.entries(config.columnMappings).find(
                ([_, sqlName]) => sqlName === dbColumnName
              );

              if (sourceExcelColumn) {
                const [originalName] = sourceExcelColumn;
                mappedRow[dbColumnName] = row[originalName];

                // Debug first row
                if (idx === 0) {
                  console.log(`   Mapping: "${originalName}" (Excel) → "${dbColumnName}" (Table), value:`, row[originalName]);
                }
              }
            });
          } else {
            // Fallback: direct mapping (shouldn't happen in normal sync)
            Object.entries(config.columnMappings).forEach(([excelCol, tableCol]) => {
              mappedRow[tableCol] = row[excelCol];
            });
          }

          // Add timestamp if requested
          if (config.addTimestamp) {
            mappedRow['imported_at'] = currentTimestamp;
          }

          return mappedRow;
        });

        // Debug: Log first mapped row
        console.log('🔍 DEBUG: First mapped row keys:', Object.keys(rowsToInsert[0] || {}));
        console.log('🔍 DEBUG: First mapped row sample:', rowsToInsert[0]);

        // Filter out rows where date columns are empty/null (summary rows like 이월잔액, 합계, etc.)
        // BUT only if table has date columns - tables without dates should import all rows
        const dateColumns = table.schema.filter(
          col => col.type === 'DATE' && col.name !== 'imported_at'
        ).map(col => col.name);

        let filteredRows = rowsToInsert;

        if (dateColumns.length > 0) {
          // Table has date columns - filter out rows where ALL date columns are null
          filteredRows = rowsToInsert.filter((row, idx) => {
            // Keep row if ANY date column has a non-empty value
            const hasValidDate = dateColumns.some(dateCol => {
              const value = row[dateCol];
              return value !== null && value !== undefined && value !== '';
            });

            // Log filtered rows
            if (!hasValidDate && idx < 5) {
              console.log(`⏭️  Skipping row ${idx + 1} (empty date columns):`, row);
            }

            return hasValidDate;
          });

          const skippedCount = rowsToInsert.length - filteredRows.length;
          if (skippedCount > 0) {
            console.log(`⏭️  Filtered out ${skippedCount} row(s) with empty date columns (summary/subtotal rows)`);
          }
        } else {
          // Table has no date columns - import all rows without filtering
          console.log(`ℹ️  Table has no date columns - importing all ${rowsToInsert.length} row(s) without date filtering`);
        }

        // Handle different duplicate actions
        let insertResult;

        if (config.duplicateAction === 'replace-date-range') {
          console.log('🔄 Sync operation using REPLACE DATE RANGE mode');
          // For replace-date-range, use the special method
          insertResult = userDataManager.replaceByDateRange(config.tableId, filteredRows);
        } else if (config.uniqueKeyColumns !== undefined) {
          console.log('🔄 Sync operation using temporary duplicate detection settings');
          console.log('  uniqueKeyColumns:', config.uniqueKeyColumns);
          console.log('  duplicateAction:', config.duplicateAction);
          
          // Temporarily override table settings for this sync operation
          const originalTable = userDataManager.getTable(config.tableId);
          const originalUniqueKeyColumns = originalTable.uniqueKeyColumns;
          const originalDuplicateAction = originalTable.duplicateAction;
          
          try {
            // Temporarily update table settings
            const tempUniqueKeyColumns = config.uniqueKeyColumns.length > 0 
              ? JSON.stringify(config.uniqueKeyColumns) 
              : null;
            const tempDuplicateAction = config.duplicateAction || 'skip';
            
            const updateStmt = userDataManager.database.prepare(
              `UPDATE user_tables SET unique_key_columns = ?, duplicate_action = ? WHERE id = ?`
            );
            updateStmt.run(tempUniqueKeyColumns, tempDuplicateAction, config.tableId);
            
            // Insert with temporary settings
            insertResult = userDataManager.insertRows(config.tableId, filteredRows);
            
          } finally {
            // Always restore original settings
            const restoreStmt = userDataManager.database.prepare(
              `UPDATE user_tables SET unique_key_columns = ?, duplicate_action = ? WHERE id = ?`
            );
            restoreStmt.run(originalUniqueKeyColumns, originalDuplicateAction, config.tableId);
          }
        } else {
          console.log('🔄 Sync operation using table\'s existing duplicate detection settings');
          // Use existing table settings
          insertResult = userDataManager.insertRows(config.tableId, filteredRows);
        }

        // Complete import operation
        userDataManager.completeImportOperation(importOperation.id, {
          rowsImported: insertResult.inserted,
          rowsSkipped: insertResult.skipped,
          errorMessage:
            insertResult.errors.length > 0
              ? insertResult.errors.slice(0, 5).join('; ')
              : undefined,
        });

        return {
          success: true,
          data: {
            rowsImported: insertResult.inserted,
            rowsSkipped: insertResult.skipped,
            tableId: config.tableId,
          },
        };
      } catch (error) {
        console.error('Sync failed:', error);

        // Complete import operation with error
        if (importOperation) {
          try {
            userDataManager.completeImportOperation(importOperation.id, {
              rowsImported: 0,
              rowsSkipped: 0,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
          } catch (completeError) {
            console.error('Error completing failed sync operation:', completeError);
          }
        }

        throw error;
      }
    } catch (error) {
      console.error('Error syncing to existing table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync data',
      };
    }
  });

  /**
   * Export all tables to a single Excel file
   */
  ipcMain.handle('user-data:export-all-tables', async () => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const db = manager.getUserDataDatabase();

      // Get all user tables
      const tables = userDataManager.getAllTables();

      if (tables.length === 0) {
        return {
          success: false,
          error: 'No tables to export',
        };
      }

      console.log(`📦 Exporting ${tables.length} table(s) to Excel...`);

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Export each table as a separate sheet
      for (const table of tables) {
        try {
          // Get all data from the table, excluding the auto-generated 'id' column
          const columnsToExport = table.schema
            .filter(col => col.name !== 'id')
            .map(col => `"${col.name}"`)
            .join(', ');

          const query = `SELECT ${columnsToExport} FROM "${table.tableName}"`;
          const stmt = db.prepare(query);
          const rows = stmt.all();

          console.log(`   📄 Exporting table "${table.displayName}" (${rows.length} rows, ${table.schema.length - 1} columns)`);

          // Convert rows to worksheet format
          // If there's data, create worksheet from rows
          let worksheet;
          if (rows.length > 0) {
            worksheet = XLSX.utils.json_to_sheet(rows);
          } else {
            // If no data, create empty sheet with headers (excluding 'id')
            const headers = table.schema
              .filter(col => col.name !== 'id')
              .map(col => col.name);
            worksheet = XLSX.utils.aoa_to_sheet([headers]);
          }

          // Encode both display name and table name in sheet name
          // Format: "DisplayName(tablename)"
          const encodedName = `${table.displayName}(${table.tableName})`;

          // Sanitize sheet name (Excel has 31 char limit and doesn't allow certain chars)
          // Excel disallows: : \ / ? * [ ]
          let sheetName = encodedName
            .replace(/[:\\\/\?\*\[\]]/g, '_') // Remove invalid chars
            .substring(0, 31); // Max 31 chars

          // If truncated, try to keep at least the table name part
          if (encodedName.length > 31) {
            // Try format: shortened display + (tablename)
            const tableNamePart = `(${table.tableName})`;
            const maxDisplayLength = 31 - tableNamePart.length;
            if (maxDisplayLength > 0) {
              sheetName = table.displayName.substring(0, maxDisplayLength) + tableNamePart;
            }
          }

          // Ensure unique sheet name
          let counter = 1;
          let finalSheetName = sheetName;
          while (workbook.SheetNames.includes(finalSheetName)) {
            const suffix = `_${counter}`;
            const maxLength = 31 - suffix.length;
            finalSheetName = sheetName.substring(0, maxLength) + suffix;
            counter++;
          }

          // Add worksheet to workbook
          XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);

          console.log(`   ✅ Exported "${table.displayName}" as sheet "${finalSheetName}"`);
        } catch (tableError) {
          console.error(`Error exporting table "${table.displayName}":`, tableError);
          // Continue with other tables even if one fails
        }
      }

      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export All Tables',
        defaultPath: path.join(app.getPath('downloads'), `user_database_export_${new Date().toISOString().split('T')[0]}.xlsx`),
        filters: [
          {
            name: 'Excel Files',
            extensions: ['xlsx'],
          },
        ],
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
        };
      }

      // Generate Excel file buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Write buffer to file using fs
      await fs.writeFile(result.filePath, buffer);

      console.log(`✅ Successfully exported ${tables.length} table(s) to: ${result.filePath}`);

      return {
        success: true,
        data: {
          filePath: result.filePath,
          tablesExported: tables.length,
          totalRows: tables.reduce((sum, t) => sum + t.rowCount, 0),
        },
      };
    } catch (error) {
      console.error('Error exporting all tables:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export tables',
      };
    }
  });

  /**
   * Import all sheets from an Excel file as separate tables
   */
  ipcMain.handle('user-data:import-all-sheets', async (event, options?: { overwrite?: boolean }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Show file picker dialog
      const fileResult = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'Excel and CSV Files',
            extensions: ['xlsx', 'xls', 'xlsm', 'csv'],
          },
        ],
      });

      if (fileResult.canceled || fileResult.filePaths.length === 0) {
        return {
          success: false,
          canceled: true,
        };
      }

      const filePath = fileResult.filePaths[0];
      const fileName = path.basename(filePath);

      // Validate file
      const validation = validateFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Parse file based on type
      let parsedData;
      if (validation.fileType === 'csv') {
        parsedData = await parseCSVFile(filePath);
      } else {
        parsedData = await parseExcelFile(filePath);
      }

      console.log(`📦 Importing ${parsedData.sheets.length} sheet(s) from "${fileName}"...`);

      const results: any[] = [];
      let successCount = 0;
      let failCount = 0;

      // Import each sheet as a separate table
      for (let i = 0; i < parsedData.sheets.length; i++) {
        const sheet = parsedData.sheets[i];
        const sheetResult: any = {
          sheetName: sheet.name,
          sheetIndex: i,
        };

        try {
          // Parse sheet name to extract display name and table name
          // Format: "DisplayName(tablename)" or just "DisplayName" (legacy)
          let tableName: string;
          let displayName: string;

          const match = sheet.name.match(/^(.+)\((.+)\)$/);
          if (match) {
            // New format: "DisplayName(tablename)"
            displayName = match[1];
            tableName = match[2];
            console.log(`   📋 Parsed sheet name: display="${displayName}", table="${tableName}"`);
          } else {
            // Legacy format: just use the sheet name as-is
            displayName = sheet.name;
            tableName = sanitizeTableName(sheet.name);
            console.log(`   📋 Legacy format: using sheet name "${sheet.name}" → table="${tableName}"`);
          }

          // Check if table already exists
          const existingTable = userDataManager.getTableByName(tableName);
          if (existingTable) {
            if (options?.overwrite) {
              // Drop existing table and its metadata
              try {
                console.log(`   🔄 Overwriting existing table "${tableName}"...`);
                manager.getUserDataDatabase().exec(`DROP TABLE IF EXISTS "${existingTable.tableName}"`);
                manager.getUserDataDatabase().prepare('DELETE FROM user_tables WHERE id = ?').run(existingTable.id);
                console.log(`   ✅ Dropped existing table "${tableName}"`);
              } catch (dropError) {
                console.error(`Error dropping existing table "${tableName}":`, dropError);
                sheetResult.success = false;
                sheetResult.error = `Failed to drop existing table: ${dropError instanceof Error ? dropError.message : 'Unknown error'}`;
                failCount++;
                results.push(sheetResult);
                continue;
              }
            } else {
              sheetResult.success = false;
              sheetResult.error = `Table already exists`;
              sheetResult.skipped = true;
              failCount++;
              results.push(sheetResult);
              console.log(`   ⚠️  Skipped sheet "${sheet.name}": table "${tableName}" already exists`);
              continue;
            }
          }

          // Check if this sheet has islands (e.g., 계정별원장 with multiple account tables)
          // If so, merge them to get properly forward-filled pivot table data
          let dataToImport = sheet.rows;
          let headersToImport = sheet.headers;
          let typesToImport = sheet.detectedTypes;

          if (sheet.detectedIslands && sheet.detectedIslands.length > 0) {
            console.log(`   🏝️  Found ${sheet.detectedIslands.length} data island(s) in sheet "${sheet.name}", merging...`);

            const merged = mergeIslands(sheet.detectedIslands, {
              addMetadataColumns: true,  // Add 회사명, 기간, 계정코드_메타, 계정명_메타
              addIslandIndex: false,
            });

            dataToImport = merged.rows;
            headersToImport = merged.headers;
            typesToImport = merged.detectedTypes;

            console.log(`      ✅ Merged ${merged.mergedIslandCount} islands: ${merged.rows.length} total rows`);
          }

          // Build column schema from detected types
          const schema: ColumnSchema[] = headersToImport.map((header, idx) => ({
            name: header,
            type: typesToImport[idx],
            notNull: false,
          }));

          console.log(`   📄 Importing sheet "${sheet.name}" (${dataToImport.length} rows, ${schema.length} columns)`);

          // Create table with explicit table name
          const table = userDataManager.createTableFromSchema(displayName, schema, {
            tableName: tableName, // Use the parsed/specified table name
            description: `Imported from ${fileName} - Sheet: ${sheet.name}`,
            createdFromFile: fileName,
          });

          // Create import operation
          const importOperation = userDataManager.createImportOperation({
            tableId: table.id,
            fileName: `${fileName} (${sheet.name})`,
          });

          try {
            // Insert rows
            const insertResult = userDataManager.insertRows(table.id, dataToImport);

            console.log(`   ✅ Imported sheet "${sheet.name}": ${insertResult.inserted} rows inserted`);

            // Complete import operation
            userDataManager.completeImportOperation(importOperation.id, {
              rowsImported: insertResult.inserted,
              rowsSkipped: insertResult.skipped,
              errorMessage: insertResult.errors.length > 0
                ? insertResult.errors.slice(0, 5).join('; ')
                : undefined,
            });

            sheetResult.success = true;
            sheetResult.tableId = table.id;
            sheetResult.tableName = table.tableName;
            sheetResult.displayName = table.displayName;
            sheetResult.rowsImported = insertResult.inserted;
            sheetResult.rowsSkipped = insertResult.skipped;
            successCount++;
          } catch (insertError) {
            console.error(`Error inserting data for sheet "${sheet.name}":`, insertError);

            // Complete import operation with error
            userDataManager.completeImportOperation(importOperation.id, {
              rowsImported: 0,
              rowsSkipped: 0,
              errorMessage: insertError instanceof Error ? insertError.message : 'Unknown error',
            });

            // Clean up: Drop the table
            try {
              manager.getUserDataDatabase().exec(`DROP TABLE IF EXISTS "${table.tableName}"`);
              manager.getUserDataDatabase().prepare('DELETE FROM user_tables WHERE id = ?').run(table.id);
            } catch (cleanupError) {
              console.error('Error during cleanup:', cleanupError);
            }

            sheetResult.success = false;
            sheetResult.error = insertError instanceof Error ? insertError.message : 'Failed to insert data';
            failCount++;
          }
        } catch (sheetError) {
          console.error(`Error importing sheet "${sheet.name}":`, sheetError);
          sheetResult.success = false;
          sheetResult.error = sheetError instanceof Error ? sheetError.message : 'Failed to import sheet';
          failCount++;
        }

        results.push(sheetResult);
      }

      console.log(`✅ Import complete: ${successCount} succeeded, ${failCount} failed`);

      return {
        success: true,
        data: {
          filePath,
          fileName,
          totalSheets: parsedData.sheets.length,
          successCount,
          failCount,
          results,
        },
      };
    } catch (error) {
      console.error('Error importing all sheets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import sheets',
      };
    }
  });

  /**
   * Force drop ALL tables from the database (including orphaned ones without metadata)
   */
  ipcMain.handle('user-data:force-drop-all-tables', async () => {
    try {
      const manager = getSQLiteManager();
      const db = manager.getUserDataDatabase();

      console.log(`🗑️  Force dropping ALL tables from database...`);

      // Disable foreign key constraints temporarily
      db.pragma('foreign_keys = OFF');
      console.log(`   🔓 Disabled foreign key constraints`);

      try {
        // Get all tables from the database (excluding system tables)
        const allTables = db.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT IN ('user_tables', 'user_imports')
        `).all() as Array<{ name: string }>;

        console.log(`   Found ${allTables.length} table(s) in database`);

        let successCount = 0;
        let failCount = 0;
        const results: any[] = [];

        // Drop each table
        for (const { name: tableName } of allTables) {
          const result: any = {
            tableName,
          };

          try {
            // Drop the table
            db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
            console.log(`   🗑️  Dropped table: ${tableName}`);

            // Try to delete metadata if it exists
            try {
              db.prepare('DELETE FROM user_tables WHERE table_name = ?').run(tableName);
            } catch (metaError) {
              // Ignore metadata deletion errors
            }

            result.success = true;
            successCount++;
          } catch (tableError) {
            console.error(`Error dropping table "${tableName}":`, tableError);
            result.success = false;
            result.error = tableError instanceof Error ? tableError.message : 'Failed to drop table';
            failCount++;
          }

          results.push(result);
        }

        console.log(`✅ Force drop complete: ${successCount} succeeded, ${failCount} failed`);

        return {
          success: true,
          data: {
            totalTables: allTables.length,
            successCount,
            failCount,
            results,
          },
        };
      } finally {
        // Always re-enable foreign key constraints
        db.pragma('foreign_keys = ON');
        console.log(`   🔒 Re-enabled foreign key constraints`);
      }
    } catch (error) {
      console.error('Error force dropping all tables:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to force drop tables',
      };
    }
  });

  /**
   * Drop all user tables from the database
   */
  ipcMain.handle('user-data:drop-all-tables', async () => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const db = manager.getUserDataDatabase();

      // Get all user tables
      const tables = userDataManager.getAllTables();

      if (tables.length === 0) {
        return {
          success: false,
          error: 'No tables to drop',
        };
      }

      console.log(`🗑️  Dropping ${tables.length} table(s)...`);

      let successCount = 0;
      let failCount = 0;
      const results: any[] = [];

      // Drop each table
      for (const table of tables) {
        const result: any = {
          tableId: table.id,
          tableName: table.tableName,
          displayName: table.displayName,
        };

        try {
          // Drop the actual data table
          db.exec(`DROP TABLE IF EXISTS "${table.tableName}"`);
          console.log(`   🗑️  Dropped data table: ${table.tableName}`);

          // Delete metadata
          db.prepare('DELETE FROM user_tables WHERE id = ?').run(table.id);
          console.log(`   🗑️  Deleted metadata for: ${table.displayName}`);

          result.success = true;
          successCount++;
        } catch (tableError) {
          console.error(`Error dropping table "${table.displayName}":`, tableError);
          result.success = false;
          result.error = tableError instanceof Error ? tableError.message : 'Failed to drop table';
          failCount++;
        }

        results.push(result);
      }

      console.log(`✅ Drop all complete: ${successCount} succeeded, ${failCount} failed`);

      return {
        success: true,
        data: {
          totalTables: tables.length,
          successCount,
          failCount,
          results,
        },
      };
    } catch (error) {
      console.error('Error dropping all tables:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to drop tables',
      };
    }
  });

  /**
   * Export all tables as SQL commands
   */
  ipcMain.handle('user-data:export-sql', async () => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const db = manager.getUserDataDatabase();

      // Get all user tables
      const allTables = userDataManager.getAllTables();

      // Filter out system tables that should not be exported
      const systemTables = [
        'sync_configurations',
        'sync_activity_log',
        'user_data_embeddings',
        'user_data_embedding_metadata',
        'import_operations',
        'user_tables'
      ];

      const tables = allTables.filter(table => !systemTables.includes(table.tableName));

      if (tables.length === 0) {
        return {
          success: false,
          error: 'No tables to export',
        };
      }

      console.log(`📦 Exporting ${tables.length} table(s) as SQL...`);

      let sqlContent = `-- User Database SQL Export
-- Generated: ${new Date().toISOString()}
-- Tables: ${tables.length}
-- Total Rows: ${tables.reduce((sum, t) => sum + (t.rowCount || 0), 0)}

-- IMPORTANT: This export includes metadata for table display names and settings.
-- Import this file to restore tables with their original names and configurations.

`;

      // First, export all table metadata as INSERT statements
      sqlContent += `\n-- ============================================\n`;
      sqlContent += `-- TABLE METADATA\n`;
      sqlContent += `-- ============================================\n\n`;

      for (const table of tables) {
        const uniqueKeyColumns = table.uniqueKeyColumns
          ? `'${table.uniqueKeyColumns.replace(/'/g, "''")}'`
          : 'NULL';

        const description = table.description
          ? `'${table.description.replace(/'/g, "''")}'`
          : 'NULL';

        const createdFromFile = table.createdFromFile
          ? `'${table.createdFromFile.replace(/'/g, "''")}'`
          : 'NULL';

        const schemaJson = `'${JSON.stringify(table.schema).replace(/'/g, "''")}'`;
        const rowCount = table.rowCount !== undefined && table.rowCount !== null ? table.rowCount : 0;
        const columnCount = table.columnCount !== undefined && table.columnCount !== null ? table.columnCount : 0;

        sqlContent += `INSERT INTO user_tables (id, table_name, display_name, description, created_from_file, row_count, column_count, created_at, updated_at, schema_json, unique_key_columns, duplicate_action, has_imported_at_column) VALUES ('${table.id}', '${table.tableName}', '${table.displayName.replace(/'/g, "''")}', ${description}, ${createdFromFile}, ${rowCount}, ${columnCount}, '${table.createdAt}', '${table.updatedAt}', ${schemaJson}, ${uniqueKeyColumns}, '${table.duplicateAction || 'skip'}', ${table.hasImportedAtColumn ? 1 : 0});\n`;
      }

      sqlContent += `\n`;

      // Export sync configurations
      sqlContent += `\n-- ============================================\n`;
      sqlContent += `-- SYNC CONFIGURATIONS\n`;
      sqlContent += `-- ============================================\n\n`;

      const syncConfigManager = manager.getSyncConfigManager();
      const allSyncConfigs = syncConfigManager.getAllConfigurations();

      if (allSyncConfigs.length > 0) {
        console.log(`📦 Exporting ${allSyncConfigs.length} sync configuration(s)...`);

        for (const config of allSyncConfigs) {
          const columnMappings = `'${JSON.stringify(config.columnMappings).replace(/'/g, "''")}'`;
          const appliedSplits = config.appliedSplits
            ? `'${JSON.stringify(config.appliedSplits).replace(/'/g, "''")}'`
            : 'NULL';
          const uniqueKeyColumns = config.uniqueKeyColumns
            ? `'${JSON.stringify(config.uniqueKeyColumns).replace(/'/g, "''")}'`
            : 'NULL';
          const lastSyncAt = config.lastSyncAt ? `'${config.lastSyncAt}'` : 'NULL';
          const lastSyncStatus = config.lastSyncStatus ? `'${config.lastSyncStatus}'` : 'NULL';
          const lastSyncError = config.lastSyncError ? `'${config.lastSyncError.replace(/'/g, "''")}'` : 'NULL';

          // Convert absolute path to portable path with ~ for cross-platform compatibility
          const portablePath = makePathPortable(config.scriptFolderPath);

          sqlContent += `INSERT INTO sync_configurations (id, script_folder_path, script_name, folder_name, target_table_id, header_row, skip_bottom_rows, sheet_index, column_mappings, applied_splits, file_action, enabled, auto_sync_enabled, unique_key_columns, duplicate_action, last_sync_at, last_sync_status, last_sync_rows_imported, last_sync_rows_skipped, last_sync_duplicates, last_sync_error, created_at, updated_at) VALUES ('${config.id}', '${portablePath.replace(/'/g, "''")}', '${config.scriptName.replace(/'/g, "''")}', '${config.folderName.replace(/'/g, "''")}', '${config.targetTableId}', ${config.headerRow}, ${config.skipBottomRows}, ${config.sheetIndex}, ${columnMappings}, ${appliedSplits}, '${config.fileAction}', ${config.enabled ? 1 : 0}, ${config.autoSyncEnabled ? 1 : 0}, ${uniqueKeyColumns}, '${config.duplicateAction || 'skip'}', ${lastSyncAt}, ${lastSyncStatus}, ${config.lastSyncRowsImported}, ${config.lastSyncRowsSkipped}, ${config.lastSyncDuplicates}, ${lastSyncError}, '${config.createdAt}', '${config.updatedAt}');\n`;
        }

        sqlContent += `\n`;
        console.log(`   ✅ Exported ${allSyncConfigs.length} sync configuration(s)`);
      } else {
        sqlContent += `-- No sync configurations to export\n\n`;
      }

      // Export each table
      for (const table of tables) {
        try {
          console.log(`   📄 Exporting table "${table.displayName}" (${table.rowCount} rows)`);

          // Add comment header for this table
          sqlContent += `\n-- ============================================\n`;
          sqlContent += `-- Table: ${table.displayName}\n`;
          sqlContent += `-- SQL Name: ${table.tableName}\n`;
          sqlContent += `-- Rows: ${table.rowCount}\n`;
          sqlContent += `-- ============================================\n\n`;

          // Generate CREATE TABLE statement (excluding auto-generated id column)
          const columnsForCreate = table.schema
            .filter(col => col.name !== 'id')
            .map(col => {
              const sqliteType = col.type === 'DATE' ? 'TEXT' : col.type;
              let colDef = `  "${col.name}" ${sqliteType}`;
              if (col.notNull) colDef += ' NOT NULL';
              if (col.defaultValue !== undefined) {
                if (typeof col.defaultValue === 'string') {
                  colDef += ` DEFAULT '${col.defaultValue}'`;
                } else if (col.defaultValue === null) {
                  colDef += ' DEFAULT NULL';
                } else {
                  colDef += ` DEFAULT ${col.defaultValue}`;
                }
              }
              return colDef;
            });

          sqlContent += `CREATE TABLE "${table.tableName}" (\n`;
          sqlContent += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
          sqlContent += columnsForCreate.join(',\n');
          sqlContent += `\n);\n\n`;

          // Generate INSERT statements (excluding id column)
          if (table.rowCount > 0) {
            const columnsToExport = table.schema
              .filter(col => col.name !== 'id')
              .map(col => col.name);

            const columnList = columnsToExport.map(col => `"${col}"`).join(', ');

            const query = `SELECT ${columnsToExport.map(col => `"${col}"`).join(', ')} FROM "${table.tableName}"`;
            const stmt = db.prepare(query);
            const rows = stmt.all();

            for (const row of rows) {
              const values = columnsToExport.map(col => {
                const value = row[col];
                if (value === null || value === undefined) {
                  return 'NULL';
                } else if (typeof value === 'string') {
                  // Escape single quotes in strings
                  return `'${value.replace(/'/g, "''")}'`;
                } else {
                  return value;
                }
              });

              sqlContent += `INSERT INTO "${table.tableName}" (${columnList}) VALUES (${values.join(', ')});\n`;
            }

            sqlContent += `\n`;
          }

          // Store metadata as SQL comments
          sqlContent += `-- Table Metadata:\n`;
          sqlContent += `-- Display Name: ${table.displayName}\n`;
          if (table.description) {
            sqlContent += `-- Description: ${table.description}\n`;
          }
          if (table.createdFromFile) {
            sqlContent += `-- Created From: ${table.createdFromFile}\n`;
          }
          if (table.uniqueKeyColumns) {
            sqlContent += `-- Unique Key Columns: ${JSON.parse(table.uniqueKeyColumns).join(', ')}\n`;
          }
          if (table.duplicateAction) {
            sqlContent += `-- Duplicate Action: ${table.duplicateAction}\n`;
          }
          sqlContent += `\n`;

          console.log(`   ✅ Exported "${table.displayName}"`);
        } catch (tableError) {
          console.error(`Error exporting table "${table.displayName}":`, tableError);
          sqlContent += `-- ERROR exporting table "${table.displayName}": ${tableError instanceof Error ? tableError.message : 'Unknown error'}\n\n`;
        }
      }

      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export as SQL',
        defaultPath: path.join(app.getPath('downloads'), `user_database_export_${new Date().toISOString().split('T')[0]}.sql`),
        filters: [
          {
            name: 'SQL Files',
            extensions: ['sql'],
          },
        ],
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
        };
      }

      // Write SQL content to file
      await fs.writeFile(result.filePath, sqlContent, 'utf-8');

      console.log(`✅ Successfully exported ${tables.length} table(s) and ${allSyncConfigs.length} sync config(s) as SQL to: ${result.filePath}`);

      return {
        success: true,
        data: {
          filePath: result.filePath,
          tablesExported: tables.length,
          totalRows: tables.reduce((sum, t) => sum + t.rowCount, 0),
          syncConfigsExported: allSyncConfigs.length,
        },
      };
    } catch (error) {
      console.error('Error exporting as SQL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export as SQL',
      };
    }
  });

  /**
   * Import SQL commands from a file
   */
  ipcMain.handle('user-data:import-sql', async () => {
    try {
      const manager = getSQLiteManager();
      const db = manager.getUserDataDatabase();

      // Show file picker dialog
      const fileResult = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'SQL Files',
            extensions: ['sql'],
          },
        ],
      });

      if (fileResult.canceled || fileResult.filePaths.length === 0) {
        return {
          success: false,
          canceled: true,
        };
      }

      const filePath = fileResult.filePaths[0];
      const fileName = path.basename(filePath);

      console.log(`📥 Importing SQL from "${fileName}"...`);

      // Read SQL file
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      // Smart SQL statement splitter that handles BEGIN...END blocks
      const statements: string[] = [];
      let currentStatement = '';
      let inBeginEnd = 0; // Track nesting level of BEGIN...END blocks
      let inString = false;
      let stringChar = '';

      const lines = sqlContent.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comment-only lines
        if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
          continue;
        }

        // Process character by character to handle strings and keywords
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          currentStatement += char;

          // Handle string literals
          if ((char === "'" || char === '"') && (i === 0 || line[i - 1] !== '\\')) {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
            }
          }

          // Only process keywords when not inside a string
          if (!inString) {
            // Check for BEGIN keyword (case insensitive)
            const remaining = line.substring(i).toUpperCase();
            if (remaining.startsWith('BEGIN')) {
              // Make sure it's a word boundary
              const nextChar = line[i + 5];
              if (!nextChar || /\s/.test(nextChar)) {
                inBeginEnd++;
              }
            }

            // Check for END keyword (case insensitive)
            if (remaining.startsWith('END')) {
              // Make sure it's a word boundary
              const nextChar = line[i + 3];
              if (!nextChar || /\s|;/.test(nextChar)) {
                if (inBeginEnd > 0) {
                  inBeginEnd--;
                }
              }
            }

            // Check for semicolon - statement terminator
            if (char === ';' && inBeginEnd === 0) {
              const stmt = currentStatement.trim();
              if (stmt.length > 0) {
                statements.push(stmt);
              }
              currentStatement = '';
            }
          }
        }

        currentStatement += '\n';
      }

      // Add any remaining statement
      const finalStmt = currentStatement.trim();
      if (finalStmt.length > 0 && !finalStmt.startsWith('--')) {
        statements.push(finalStmt);
      }

      console.log(`   📝 Found ${statements.length} SQL statement(s)`);

      // Preprocess statements to expand portable paths (~) in sync_configurations
      const processedStatements = statements.map(statement => {
        // Check if this is an INSERT into sync_configurations
        if (statement.toUpperCase().includes('INSERT INTO SYNC_CONFIGURATIONS') ||
            statement.toUpperCase().includes('INSERT INTO "SYNC_CONFIGURATIONS"')) {
          // Extract script_folder_path value and expand portable path
          // Match pattern: script_folder_path, ... VALUES ('...', '~/...', ...)
          const pathMatch = statement.match(/VALUES\s*\([^)]*?'([^']*)',\s*'(~[^']*)',/);
          if (pathMatch && pathMatch[2]) {
            const portablePath = pathMatch[2];
            const expandedPath = expandPortablePath(portablePath);
            // Replace the portable path with expanded path
            const processedStatement = statement.replace(portablePath, expandedPath.replace(/\\/g, '\\\\'));
            console.log(`   🔄 Expanded path: ${portablePath} → ${expandedPath}`);
            return processedStatement;
          }
        }
        return statement;
      });

      let executedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Execute statements in a transaction
      const transaction = db.transaction(() => {
        for (const statement of processedStatements) {
          try {
            db.exec(statement);
            executedCount++;
          } catch (error) {
            errorCount++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Statement failed: ${statement.substring(0, 100)}...\nError: ${errorMsg}`);
            console.error(`   ❌ Error executing statement:`, errorMsg);
            console.error(`   Statement: ${statement.substring(0, 200)}`);

            // Continue with other statements instead of failing completely
          }
        }
      });

      try {
        transaction();
        console.log(`✅ Import complete: ${executedCount} statements executed, ${errorCount} errors`);
      } catch (error) {
        console.error('Transaction failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transaction failed',
        };
      }

      // After importing, scan for tables that don't have metadata entries and create them
      console.log(`🔍 Scanning for tables without metadata...`);
      const userDataManager = manager.getUserDataManager();

      // Get all tables from the database
      const allTables = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT IN ('user_tables', 'user_imports', 'import_operations')
      `).all() as Array<{ name: string }>;

      let metadataCreatedCount = 0;
      let metadataFoundCount = 0;

      for (const { name: tableName } of allTables) {
        // Check if metadata exists
        const existingMetadata = userDataManager.getTableByName(tableName);

        if (existingMetadata) {
          metadataFoundCount++;
          console.log(`   ✅ Found existing metadata for "${tableName}" (display name: "${existingMetadata.displayName}")`);
        } else {
          console.log(`   📝 Creating metadata for table "${tableName}" (no metadata found in import)`);

          try {
            // Get table schema from database
            const tableInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
              cid: number;
              name: string;
              type: string;
              notnull: number;
              dflt_value: any;
              pk: number;
            }>;

            // Get row count
            const rowCountResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number };
            const rowCount = rowCountResult.count;

            // Build schema (excluding id column as it's handled separately)
            const schema = tableInfo.map(col => ({
              name: col.name,
              type: col.type as any,
              notNull: col.notnull === 1,
              defaultValue: col.dflt_value,
            }));

            // Create metadata entry
            const now = new Date().toISOString();
            const tableId = randomUUID();

            db.prepare(`
              INSERT INTO user_tables (
                id, table_name, display_name, description, created_from_file,
                row_count, column_count, created_at, updated_at, schema_json,
                unique_key_columns, duplicate_action
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              tableId,
              tableName,
              tableName, // Use table name as display name (fallback only)
              `Imported from ${fileName}`,
              fileName,
              rowCount,
              schema.length,
              now,
              now,
              JSON.stringify(schema),
              null,
              'skip'
            );

            metadataCreatedCount++;
            console.log(`   ✅ Created metadata for "${tableName}" (${rowCount} rows, ${schema.length} columns)`);
          } catch (metadataError) {
            console.error(`   ❌ Error creating metadata for "${tableName}":`, metadataError);
          }
        }
      }

      console.log(`✅ Metadata scan complete: ${metadataFoundCount} existing, ${metadataCreatedCount} new table(s) registered`);

      // Count restored sync configurations
      const syncConfigManager = manager.getSyncConfigManager();
      const restoredSyncConfigs = syncConfigManager.getAllConfigurations();
      const syncConfigCount = restoredSyncConfigs.length;

      if (syncConfigCount > 0) {
        console.log(`✅ Restored ${syncConfigCount} sync configuration(s)`);

        // Ensure folders exist for all sync configurations
        console.log(`📁 Checking sync configuration folders...`);
        const fsSync = await import('fs');
        let foldersCreated = 0;
        let foldersExisting = 0;
        const missingFolders: string[] = [];

        for (const config of restoredSyncConfigs) {
          const folderPath = config.scriptFolderPath;
          try {
            if (fsSync.existsSync(folderPath)) {
              foldersExisting++;
              console.log(`   ✅ Folder exists: ${folderPath}`);
            } else {
              // Create folder
              fsSync.mkdirSync(folderPath, { recursive: true });
              foldersCreated++;
              console.log(`   📁 Created folder: ${folderPath}`);
            }
          } catch (folderError) {
            missingFolders.push(folderPath);
            console.error(`   ❌ Could not create folder: ${folderPath}`, folderError);
          }
        }

        console.log(`📁 Folders: ${foldersExisting} existing, ${foldersCreated} created${missingFolders.length > 0 ? `, ${missingFolders.length} failed` : ''}`);

        // Reload file watcher service to start watchers for restored configs
        try {
          const { FileWatcherService } = await import('../sync-config/file-watcher-service');
          const fileWatcherService = FileWatcherService.getInstance();
          await fileWatcherService.reload();
          console.log(`✅ File watcher service reloaded for restored sync configurations`);
        } catch (watcherError) {
          console.warn('Failed to reload file watcher service:', watcherError);
          // Don't fail the import if watcher reload fails
        }
      }

      return {
        success: true,
        data: {
          filePath,
          fileName,
          statementsExecuted: executedCount,
          errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors
          tablesWithMetadata: metadataFoundCount,
          tablesCreated: metadataCreatedCount,
          syncConfigsRestored: syncConfigCount,
        },
      };
    } catch (error) {
      console.error('Error importing SQL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import SQL',
      };
    }
  });

  // ==================== Vector Embedding IPC Handlers ====================

  /**
   * Embed table columns with progress tracking
   */
  ipcMain.handle(
    'user-data:embed-table-columns',
    async (
      event,
      tableId: string,
      columnNames: string[],
      options?: { batchSize?: number }
    ) => {
      try {
        const manager = getSQLiteManager();
        const userDataManager = manager.getUserDataManager();
        const embeddingService = new GeminiEmbeddingService();

        // Start embedding process with progress tracking
        const generator = userDataManager.embedTableColumns(
          tableId,
          columnNames,
          embeddingService,
          options
        );

        for await (const progress of generator) {
          // Send progress updates to renderer
          event.sender.send('user-data:embedding-progress', progress);
        }

        return { success: true };
      } catch (error) {
        console.error('Error embedding table columns:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to embed columns',
        };
      }
    }
  );

  /**
   * Perform semantic search on a table
   */
  ipcMain.handle(
    'user-data:vector-search-table',
    async (
      event,
      tableId: string,
      queryText: string,
      options?: {
        limit?: number;
        threshold?: number;
        columnNames?: string[];
      }
    ) => {
      try {
        const manager = getSQLiteManager();
        const userDataManager = manager.getUserDataManager();
        const embeddingService = new GeminiEmbeddingService();

        const result = await userDataManager.vectorSearch(
          tableId,
          queryText,
          embeddingService,
          options
        );

        return { success: true, data: result };
      } catch (error) {
        console.error('Error performing vector search:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to perform search',
        };
      }
    }
  );

  /**
   * Get embedding statistics for a table
   */
  ipcMain.handle('user-data:get-embedding-stats', async (event, tableId: string) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const stats = userDataManager.getEmbeddingStats(tableId);

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get embedding stats',
      };
    }
  });

  /**
   * Delete embeddings for a table
   */
  ipcMain.handle(
    'user-data:delete-embeddings',
    async (event, tableId: string, columnNames?: string[]) => {
      try {
        const manager = getSQLiteManager();
        const userDataManager = manager.getUserDataManager();
        const deletedCount = userDataManager.deleteEmbeddings(tableId, columnNames);

        return { success: true, data: { deletedCount } };
      } catch (error) {
        console.error('Error deleting embeddings:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete embeddings',
        };
      }
    }
  );

  /**
   * Get list of embedded columns for a table
   */
  ipcMain.handle('user-data:get-embedded-columns', async (event, tableId: string) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const columns = userDataManager.getEmbeddedColumns(tableId);

      return { success: true, data: columns };
    } catch (error) {
      console.error('Error getting embedded columns:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get embedded columns',
      };
    }
  });

  /**
   * Upload a file to user data storage
   */
  ipcMain.handle('user-data:upload-file', async (event, options: {
    tableId: string;
    rowId: number;
    columnName: string;
    filename: string;
    mimeType?: string;
    data: Buffer;
    forceStorageType?: 'blob' | 'filesystem';
    compress?: boolean;
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const result = await fileManager.storeFile(options);

      return { success: true, data: result };
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      };
    }
  });

  /**
   * Download a file from user data storage
   */
  ipcMain.handle('user-data:download-file', async (event, options: {
    fileId?: string;
    tableId?: string;
    rowId?: number;
    columnName?: string;
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const file = await fileManager.getFile(options);

      if (!file) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      return { success: true, data: file };
    } catch (error) {
      console.error('Error downloading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download file',
      };
    }
  });

  /**
   * Delete a file from user data storage
   */
  ipcMain.handle('user-data:delete-file', async (event, options: {
    fileId?: string;
    tableId?: string;
    rowId?: number;
    columnName?: string;
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const deleted = await fileManager.deleteFile(options);

      return { success: deleted, data: { deleted } };
    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      };
    }
  });

  /**
   * List files for a table row
   */
  ipcMain.handle('user-data:list-files', async (event, tableId: string, rowId: number) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const files = fileManager.listFilesForRow(tableId, rowId);

      return { success: true, data: files };
    } catch (error) {
      console.error('Error listing files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files',
      };
    }
  });

  /**
   * Get file storage statistics
   */
  ipcMain.handle('user-data:get-file-stats', async (event, tableId?: string) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const stats = fileManager.getStats(tableId);

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting file stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get file stats',
      };
    }
  });

  /**
   * Clean up orphaned files from filesystem
   */
  ipcMain.handle('user-data:cleanup-orphaned-files', async () => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();
      const fileManager = userDataManager.getFileStorageManager();
      await fileManager.initialize();

      const cleanedCount = await fileManager.cleanupOrphanedFiles();

      return { success: true, data: { cleanedCount } };
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup orphaned files',
      };
    }
  });
}
