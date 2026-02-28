import { ipcMain, dialog } from 'electron';
import path from 'path';
import { getSQLiteManager } from '../sqlite/manager';
import {
  parseExcelFile,
  validateExcelFile,
  sanitizeTableName,
  sanitizeColumnName,
  mergeIslands,
} from './excel-parser';
import { ExcelImportConfig, ColumnSchema, DataIsland } from './types';
import {
  autoDetectUniqueKeyColumns,
  getRecommendedDuplicateAction,
} from './duplicate-detection-helper';

/**
 * User Data IPC Handlers
 *
 * Handles IPC communication for user data operations including Excel import
 */

import { registerUpdateTableDuplicateSettingsHandler } from './update-table-duplicate-settings-ipc';

/**
 * Register User Data IPC Handlers
 */
export function registerUserDataIPCHandlers(): void {
  // Register duplicate settings update handler
  registerUpdateTableDuplicateSettingsHandler();
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
          description: config.description,
          createdFromFile: fileName,
          uniqueKeyColumns: uniqueKeyColumns.length > 0 ? uniqueKeyColumns : undefined,
          duplicateAction: uniqueKeyColumns.length > 0 ? duplicateAction : undefined,
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

      console.log(`📦 Creating island table "${sanitizedTableName}" with ${config.rows.length} rows`);

      // Create table
      const table = userDataManager.createTableFromSchema(config.displayName, schema, {
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

      console.log(`📦 Creating merged table "${sanitizedTableName}" with ${merged.rows.length} rows`);

      // Create table
      const table = userDataManager.createTableFromSchema(config.displayName, schema, {
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
    headerRow?: number;
    skipRows?: number;
    skipBottomRows?: number;
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
    addTimestamp?: boolean;
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

      // Add imported_at column if requested and it doesn't exist
      if (config.addTimestamp) {
        const hasImportedAt = table.schema.some(col => col.name === 'imported_at');
        if (!hasImportedAt) {
          console.log('⏰ Adding imported_at column to existing table');
          const db = manager.getUserDataDatabase();
          db.exec(`ALTER TABLE "${table.tableName}" ADD COLUMN "imported_at" TEXT`);

          // Update table metadata
          const newSchema = [...table.schema, { name: 'imported_at', type: 'TEXT' as any, notNull: false }];
          db.prepare(`UPDATE user_tables SET schema_json = ?, column_count = ? WHERE id = ?`)
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
        const rowsToInsert = selectedSheet.rows.map((row) => {
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

        // Handle different duplicate actions
        let insertResult;
        
        if (config.duplicateAction === 'replace-date-range') {
          console.log('🔄 Sync operation using REPLACE DATE RANGE mode');
          // For replace-date-range, use the special method
          insertResult = userDataManager.replaceByDateRange(config.tableId, rowsToInsert);
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
            insertResult = userDataManager.insertRows(config.tableId, rowsToInsert);
            
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
          insertResult = userDataManager.insertRows(config.tableId, rowsToInsert);
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
}
