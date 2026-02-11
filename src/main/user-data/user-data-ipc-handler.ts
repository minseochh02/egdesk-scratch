import { ipcMain, dialog } from 'electron';
import path from 'path';
import { getSQLiteManager } from '../sqlite/manager';
import {
  parseExcelFile,
  validateExcelFile,
  sanitizeTableName,
  sanitizeColumnName,
} from './excel-parser';
import { ExcelImportConfig, ColumnSchema } from './types';

/**
 * User Data IPC Handlers
 *
 * Handles IPC communication for user data operations including Excel import
 */

/**
 * Register User Data IPC Handlers
 */
export function registerUserDataIPCHandlers(): void {
  /**
   * Parse Excel file and return preview data
   */
  ipcMain.handle('user-data:parse-excel', async (event, filePath: string, options?: {
    headerRow?: number;
    skipRows?: number;
    skipBottomRows?: number;
  }) => {
    try {
      // Validate file
      const validation = validateExcelFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Parse Excel file with options
      const parsedData = await parseExcelFile(filePath, options);

      return {
        success: true,
        data: parsedData,
      };
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse Excel file',
      };
    }
  });

  /**
   * Import Excel data to create a new table
   */
  ipcMain.handle('user-data:import-excel', async (event, config: ExcelImportConfig) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Parse Excel file again to get the data (with any parsing options)
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

      const selectedSheet = parsedData.sheets[config.sheetIndex];
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
          const originalIndex = selectedSheet.headers.indexOf(firstSourceName);

          if (originalIndex === -1) {
            throw new Error(`Source column not found in Excel: ${firstSourceName}`);
          }

          const columnType = config.columnTypes?.[firstSourceName] || selectedSheet.detectedTypes[originalIndex];

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

      // Ensure table name is sanitized
      const sanitizedTableName = sanitizeTableName(config.tableName);

      // Check if table already exists
      const existingTable = userDataManager.getTableByName(sanitizedTableName);
      if (existingTable) {
        return {
          success: false,
          error: `A table with name "${sanitizedTableName}" already exists`,
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

      // Create import operation
      let importOperation: any = null;
      let table: any = null;
      let tableId: string | null = null;

      try {
        // Create table from schema
        table = userDataManager.createTableFromSchema(config.displayName, schema, {
          description: config.description,
          createdFromFile: fileName,
        });
        tableId = table.id;
        console.log('Table created successfully:', tableId, 'Name:', table.tableName);

        // Create import operation
        importOperation = userDataManager.createImportOperation({
          tableId: table.id,
          fileName,
        });

        // Prepare rows for insertion - map original headers to SQL names with merge support
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

          return mappedRow;
        });

        // Insert rows in batches
        const insertResult = userDataManager.insertRows(table.id, rowsToInsert);

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
   * Sync Excel data to existing table
   */
  ipcMain.handle('user-data:sync-to-existing-table', async (event, config: {
    filePath: string;
    sheetIndex: number;
    tableId: string;
    columnMappings: Record<string, string>;
  }) => {
    try {
      const manager = getSQLiteManager();
      const userDataManager = manager.getUserDataManager();

      // Get the existing table
      const table = userDataManager.getTable(config.tableId);
      if (!table) {
        return {
          success: false,
          error: 'Table not found',
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

      const selectedSheet = parsedData.sheets[config.sheetIndex];
      const fileName = path.basename(config.filePath);

      // Create import operation
      const importOperation = userDataManager.createImportOperation({
        tableId: config.tableId,
        fileName,
      });

      try {
        // Map Excel rows to table columns
        const rowsToInsert = selectedSheet.rows.map((row) => {
          const mappedRow: any = {};

          Object.entries(config.columnMappings).forEach(([excelCol, tableCol]) => {
            mappedRow[tableCol] = row[excelCol];
          });

          return mappedRow;
        });

        // Insert rows
        const insertResult = userDataManager.insertRows(config.tableId, rowsToInsert);

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
}
