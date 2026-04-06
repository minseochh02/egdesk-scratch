import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import path from 'path';
import {
  UserTable,
  UserTableWithSchema,
  ColumnSchema,
  ImportOperation,
  CreateImportOperationData,
  ImportResults,
  InsertResult,
  QueryOptions,
  QueryResult,
  AggregationOptions,
  AggregationResult,
  ColumnType,
} from '../user-data/types';
import { GeminiEmbeddingService } from '../embeddings/gemini-embedding-service';
import {
  UserDataVectorManager,
  UserDataEmbeddingData,
  UserDataEmbeddingStats,
} from './user-data-vector-manager';
import { FileStorageManager } from '../user-data/file-storage-manager';

/**
 * User Data Database Manager
 *
 * Manages user-created database tables, data operations, and import tracking
 */
export class UserDataDbManager {
  private fileStorageManager: FileStorageManager | null = null;

  constructor(public database: Database.Database) {}

  /**
   * Get or create file storage manager instance
   */
  public getFileStorageManager(): FileStorageManager {
    if (!this.fileStorageManager) {
      const userDataDir = app.getPath('userData');
      this.fileStorageManager = new FileStorageManager(this.database, userDataDir);
    }
    return this.fileStorageManager;
  }

  /**
   * Sanitize table name for SQL safety
   */
  private sanitizeTableName(name: string): string {
    // Remove special characters, keep alphanumeric and underscores
    return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  /**
   * Validate table name against whitelist
   */
  private validateTableName(tableName: string): boolean {
    const stmt = this.database.prepare(
      'SELECT table_name FROM user_tables WHERE table_name = ?'
    );
    const result = stmt.get(tableName);
    return !!result;
  }

  /**
   * Create a new table from schema
   */
  createTableFromSchema(
    displayName: string,
    schema: ColumnSchema[],
    options?: {
      tableName?: string; // Optional SQL table name (if not provided, will sanitize displayName)
      description?: string;
      createdFromFile?: string;
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
      hasImportedAtColumn?: boolean; // Whether this table has imported_at column
    }
  ): UserTableWithSchema {
    // Validate input schema
    if (!schema || schema.length === 0) {
      throw new Error('Schema cannot be empty');
    }

    // Validate each column in schema
    schema.forEach((col, idx) => {
      if (!col.name || !col.type) {
        throw new Error(`Invalid column at index ${idx}: missing name or type`);
      }
    });

    const id = randomUUID();
    // Use provided table name or sanitize display name
    const tableName = options?.tableName || this.sanitizeTableName(displayName);
    const now = new Date().toISOString();

    // Check if user provided their own id column
    const hasUserIdColumn = schema.some((col) => col.name.toLowerCase() === 'id');

    let fullSchema: ColumnSchema[];
    if (hasUserIdColumn) {
      // User defined their own id column - use it as-is
      fullSchema = schema;
    } else {
      // Add auto-incrementing ID column as the first column
      const idColumn: ColumnSchema = {
        name: 'id',
        type: 'INTEGER',
        notNull: true,
      };
      fullSchema = [idColumn, ...schema];
    }

    // Validate fullSchema is serializable
    const schemaJson = JSON.stringify(fullSchema);
    if (!schemaJson || schemaJson === 'undefined' || schemaJson === 'null') {
      throw new Error('Failed to serialize schema to JSON');
    }

    // Build CREATE TABLE SQL with ID column
    const columnDefs = fullSchema
      .map((col, index) => {
        // Handle id column
        if (col.name.toLowerCase() === 'id') {
          if (!hasUserIdColumn && col.type === 'INTEGER') {
            // Auto-generated INTEGER id
            return 'id INTEGER PRIMARY KEY AUTOINCREMENT';
          } else {
            // User-defined id column (could be TEXT, INTEGER without autoincrement, etc.)
            const sqliteType = col.type === 'DATE' ? 'TEXT' : col.type;
            const parts = [`"${col.name}"`, sqliteType, 'PRIMARY KEY'];
            if (col.notNull) parts.push('NOT NULL');
            if (col.defaultValue !== undefined) {
              if (typeof col.defaultValue === 'string') {
                parts.push(`DEFAULT '${col.defaultValue}'`);
              } else if (col.defaultValue === null) {
                parts.push('DEFAULT NULL');
              } else {
                parts.push(`DEFAULT ${col.defaultValue}`);
              }
            }
            return parts.join(' ');
          }
        }

        // Convert DATE type to TEXT for SQLite storage
        const sqliteType = col.type === 'DATE' ? 'TEXT' : col.type;

        const parts = [`"${col.name}"`, sqliteType];
        if (col.notNull) parts.push('NOT NULL');
        if (col.defaultValue !== undefined) {
          if (typeof col.defaultValue === 'string') {
            parts.push(`DEFAULT '${col.defaultValue}'`);
          } else if (col.defaultValue === null) {
            parts.push('DEFAULT NULL');
          } else {
            parts.push(`DEFAULT ${col.defaultValue}`);
          }
        }
        return parts.join(' ');
      })
      .join(', ');

    // Check if table already exists (orphaned from failed import)
    const tableExists = this.database
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName);

    if (tableExists) {
      // Clean up orphaned table
      console.log(`Found orphaned table "${tableName}", dropping it...`);
      this.database.exec(`DROP TABLE IF EXISTS "${tableName}"`);
    }

    const createTableSql = `CREATE TABLE "${tableName}" (${columnDefs})`;

    // Execute with EXPLICIT transaction control to ensure proper commit/fsync
    // Using manual BEGIN/COMMIT instead of .transaction() wrapper
    try {
      this.database.exec('BEGIN IMMEDIATE');

      // Create the data table
      this.database.exec(createTableSql);

      // Insert metadata (store full schema including ID column)
      const uniqueKeyColumnsJson = options?.uniqueKeyColumns && options.uniqueKeyColumns.length > 0
        ? JSON.stringify(options.uniqueKeyColumns)
        : null;

      // Detect if this table has imported_at column
      const hasImportedAtColumn = options?.hasImportedAtColumn !== undefined
        ? options.hasImportedAtColumn
        : schema.some(col => col.name === 'imported_at');

      const insertMetadata = this.database.prepare(`
        INSERT INTO user_tables (
          id, table_name, display_name, description, created_from_file,
          row_count, column_count, created_at, updated_at, schema_json,
          unique_key_columns, duplicate_action, has_imported_at_column
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      console.log('Storing schema JSON:', schemaJson);
      console.log('has_imported_at_column:', hasImportedAtColumn);

      insertMetadata.run(
        id,
        tableName,
        displayName,
        options?.description || null,
        options?.createdFromFile || null,
        0,
        fullSchema.length, // Include ID column in count
        now,
        now,
        schemaJson, // Use pre-validated JSON string
        uniqueKeyColumnsJson,
        options?.duplicateAction || 'skip',
        hasImportedAtColumn ? 1 : 0
      );

      // Verify insertion
      const verify = this.database.prepare('SELECT schema_json FROM user_tables WHERE id = ?');
      const verifyResult = verify.get(id) as { schema_json: string } | undefined;
      console.log('Verification - schema_json stored as:', verifyResult?.schema_json);

      // EXPLICIT COMMIT - this forces fsync to disk
      this.database.exec('COMMIT');
      console.log('✅ [createTable] Explicit COMMIT executed, data flushed to disk');

    } catch (error) {
      // Rollback on error
      try {
        this.database.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback:', rollbackError);
      }
      throw error;
    }

    return {
      id,
      tableName,
      displayName,
      description: options?.description,
      createdFromFile: options?.createdFromFile,
      rowCount: 0,
      columnCount: fullSchema.length,
      createdAt: now,
      updatedAt: now,
      schema: fullSchema,
    };
  }

  /**
   * Get table by ID
   */
  getTable(tableId: string): UserTableWithSchema | null {
    const stmt = this.database.prepare(`
      SELECT * FROM user_tables WHERE id = ?
    `);
    const row = stmt.get(tableId) as any;

    if (!row) {
      console.error('Table not found:', tableId);
      return null;
    }

    console.log('Retrieved row for table:', tableId);
    console.log('Row keys:', Object.keys(row));
    console.log('schema_json type:', typeof row.schema_json);
    console.log('schema_json value:', row.schema_json);
    console.log('schemaJson (camelCase) type:', typeof row.schemaJson);
    console.log('schemaJson (camelCase) value:', row.schemaJson);

    // Try both snake_case and camelCase (better-sqlite3 might return snake_case)
    const schemaJsonStr = row.schema_json || row.schemaJson;

    // Safely parse schema JSON
    let schema: ColumnSchema[];
    try {
      if (!schemaJsonStr || schemaJsonStr === 'undefined' || schemaJsonStr === 'null') {
        console.error('Invalid schema JSON for table:', tableId, 'Value:', schemaJsonStr);
        return null;
      }
      schema = JSON.parse(schemaJsonStr) as ColumnSchema[];
    } catch (error) {
      console.error('Failed to parse schema JSON for table:', tableId, error);
      console.error('Attempted to parse:', schemaJsonStr);
      return null;
    }

    return {
      id: row.id,
      tableName: row.table_name || row.tableName,
      displayName: row.display_name || row.displayName,
      description: row.description,
      createdFromFile: row.created_from_file || row.createdFromFile,
      rowCount: row.row_count || row.rowCount,
      columnCount: row.column_count || row.columnCount,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
      uniqueKeyColumns: row.unique_key_columns || row.uniqueKeyColumns,
      duplicateAction: row.duplicate_action || row.duplicateAction || 'skip',
      hasImportedAtColumn: (row.has_imported_at_column || row.hasImportedAtColumn) === 1,
      schema,
    };
  }

  /**
   * Get table by table name
   */
  getTableByName(tableName: string): UserTableWithSchema | null {
    const stmt = this.database.prepare(`
      SELECT * FROM user_tables WHERE table_name = ?
    `);
    const row = stmt.get(tableName) as any;

    if (!row) return null;

    // Try both snake_case and camelCase
    const schemaJsonStr = row.schema_json || row.schemaJson;

    // Safely parse schema JSON
    let schema: ColumnSchema[];
    try {
      if (!schemaJsonStr || schemaJsonStr === 'undefined' || schemaJsonStr === 'null') {
        console.error('Invalid schema JSON for table:', tableName, 'Value:', schemaJsonStr);
        return null;
      }
      schema = JSON.parse(schemaJsonStr) as ColumnSchema[];
    } catch (error) {
      console.error('Failed to parse schema JSON for table:', tableName, error);
      return null;
    }

    return {
      id: row.id,
      tableName: row.table_name || row.tableName,
      displayName: row.display_name || row.displayName,
      description: row.description,
      createdFromFile: row.created_from_file || row.createdFromFile,
      rowCount: row.row_count || row.rowCount,
      columnCount: row.column_count || row.columnCount,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
      uniqueKeyColumns: row.unique_key_columns || row.uniqueKeyColumns,
      duplicateAction: row.duplicate_action || row.duplicateAction || 'skip',
      hasImportedAtColumn: (row.has_imported_at_column || row.hasImportedAtColumn) === 1,
      schema,
    };
  }

  /**
   * Get all user tables
   */
  getAllTables(): UserTableWithSchema[] {
    const stmt = this.database.prepare(`
      SELECT * FROM user_tables ORDER BY created_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows
      .map((row) => {
        // Try both snake_case and camelCase
        const schemaJsonStr = row.schema_json || row.schemaJson;

        // Safely parse schema JSON
        try {
          if (!schemaJsonStr || schemaJsonStr === 'undefined' || schemaJsonStr === 'null') {
            console.error('Invalid schema JSON for table:', row.id);
            return null;
          }
          const schema = JSON.parse(schemaJsonStr) as ColumnSchema[];
          return {
            id: row.id,
            tableName: row.table_name || row.tableName,
            displayName: row.display_name || row.displayName,
            description: row.description,
            createdFromFile: row.created_from_file || row.createdFromFile,
            rowCount: row.row_count || row.rowCount,
            columnCount: row.column_count || row.columnCount,
            createdAt: row.created_at || row.createdAt,
            updatedAt: row.updated_at || row.updatedAt,
            uniqueKeyColumns: row.unique_key_columns || row.uniqueKeyColumns,
            duplicateAction: row.duplicate_action || row.duplicateAction || 'skip',
            replaceColumn: row.replace_column || row.replaceColumn,
            hasImportedAtColumn: (row.has_imported_at_column || row.hasImportedAtColumn) === 1,
            schema,
          };
        } catch (error) {
          console.error('Failed to parse schema JSON for table:', row.id, error);
          return null;
        }
      })
      .filter((table): table is UserTableWithSchema => table !== null);
  }

  /**
   * Rename a table (both the actual table and metadata)
   */
  renameTable(tableId: string, newTableName: string, newDisplayName?: string): { success: boolean; error?: string; table?: UserTableWithSchema } {
    try {
      // Get the existing table
      const table = this.getTable(tableId);
      if (!table) {
        return { success: false, error: 'Table not found' };
      }

      // Sanitize the new table name for SQL safety
      const sanitizedNewTableName = newTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

      // Check if the new table name already exists
      const existingTable = this.getTableByName(sanitizedNewTableName);
      if (existingTable && existingTable.id !== tableId) {
        return { success: false, error: `A table with name "${sanitizedNewTableName}" already exists` };
      }

      // If names are the same, just update display name
      if (table.tableName === sanitizedNewTableName && !newDisplayName) {
        return { success: false, error: 'New table name is the same as the current name' };
      }

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        // Rename the actual SQLite table (only if name changed)
        if (table.tableName !== sanitizedNewTableName) {
          this.database.exec(`ALTER TABLE "${table.tableName}" RENAME TO "${sanitizedNewTableName}"`);
        }

        // Update metadata
        const updateStmt = this.database.prepare(
          `UPDATE user_tables
           SET table_name = ?,
               display_name = ?,
               updated_at = ?
           WHERE id = ?`
        );
        updateStmt.run(
          sanitizedNewTableName,
          newDisplayName || newTableName,
          new Date().toISOString(),
          tableId
        );

        // EXPLICIT COMMIT
        this.database.exec('COMMIT');
        console.log('✅ [renameTable] Explicit COMMIT executed');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }
        throw txError;
      }

      // Return the updated table
      const updatedTable = this.getTable(tableId);
      return { success: true, table: updatedTable || undefined };
    } catch (error) {
      console.error('Error renaming table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename table',
      };
    }
  }

  /**
   * Delete a table and all its data
   */
  deleteTable(tableId: string): boolean {
    try {
      // Try to get table first
      const table = this.getTable(tableId);

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        // If we got the table, drop it
        if (table && table.tableName) {
          try {
            this.database.exec(`DROP TABLE IF EXISTS "${table.tableName}"`);
          } catch (dropError) {
            console.error('Error dropping table:', dropError);
            // Continue anyway to clean up metadata
          }
        }

        // Always delete metadata (cascades to import_operations)
        const deleteMetadata = this.database.prepare(
          'DELETE FROM user_tables WHERE id = ?'
        );
        deleteMetadata.run(tableId);

        // EXPLICIT COMMIT
        this.database.exec('COMMIT');
        console.log('✅ [deleteTable] Explicit COMMIT executed, data flushed to disk');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }
        throw txError;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTable:', error);
      // Try to at least clean up metadata
      try {
        const deleteMetadata = this.database.prepare(
          'DELETE FROM user_tables WHERE id = ?'
        );
        deleteMetadata.run(tableId);
        return true;
      } catch (cleanupError) {
        console.error('Failed to clean up metadata:', cleanupError);
        return false;
      }
    }
  }

  /**
   * Insert rows into a table
   */
  insertRows(tableId: string, rows: any[]): InsertResult {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    let inserted = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: string[] = [];
    const duplicateDetails: Array<{ rowIndex: number; uniqueKeyValues: Record<string, any> }> = [];
    const errorDetails: Array<{ rowIndex: number; error: string; rowData?: Record<string, any> }> = [];

    // Parse duplicate detection settings
    const uniqueKeyColumns: string[] = table.uniqueKeyColumns 
      ? JSON.parse(table.uniqueKeyColumns) 
      : [];
    const duplicateAction = table.duplicateAction || 'skip';
    const hasDuplicateDetection = uniqueKeyColumns.length > 0;

    // Handle replace-date-range mode
    if (duplicateAction === 'replace-date-range') {
      return this.replaceByDateRange(tableId, rows);
    }

    // Handle replace-all mode
    if (duplicateAction === 'replace-all') {
      return this.replaceAll(tableId, rows);
    }

    // Check if id column is AUTOINCREMENT (first column is INTEGER with autoincrement)
    const idColumn = table.schema.find((col) => col.name === 'id');
    const isAutoIncrementId = idColumn?.type === 'INTEGER' && table.schema.indexOf(idColumn) === 0;

    // Filter out the ID column only if it's auto-increment
    // If user defined their own id column (e.g., TEXT), include it in inserts
    const dataColumns = isAutoIncrementId
      ? table.schema.filter((col) => col.name !== 'id')
      : table.schema;

    // Prepare column names (excluding ID)
    const columnNames = dataColumns.map((col) => `"${col.name}"`).join(', ');
    const placeholders = dataColumns.map(() => '?').join(', ');

    const insertStmt = this.database.prepare(
      `INSERT INTO "${table.tableName}" (${columnNames}) VALUES (${placeholders})`
    );

    // Prepare duplicate check statement if needed
    let checkDuplicateStmt: any = null;
    if (hasDuplicateDetection) {
      // We'll build the query dynamically to handle NULLs properly
      console.log(`🔍 Unique key columns: [${uniqueKeyColumns.join(', ')}]`);
    }

    // Prepare update statement if needed
    let updateStmt: any = null;
    if (hasDuplicateDetection && duplicateAction === 'update') {
      const updateColumns = dataColumns
        .filter(col => !uniqueKeyColumns.includes(col.name))
        .map(col => `"${col.name}" = ?`)
        .join(', ');
      const whereClause = uniqueKeyColumns
        .map(col => `"${col}" = ?`)
        .join(' AND ');
      
      if (updateColumns) {
        updateStmt = this.database.prepare(
          `UPDATE "${table.tableName}" SET ${updateColumns} WHERE ${whereClause}`
        );
      }
    }

    // Process rows in batches of 500
    const batchSize = 500;
    for (let batchStart = 0; batchStart < rows.length; batchStart += batchSize) {
      const batch = rows.slice(batchStart, batchStart + batchSize);

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        for (let i = 0; i < batch.length; i++) {
          const row = batch[i];
          const rowIndex = batchStart + i;

          try {
            // Check for duplicate if duplicate detection is enabled
            if (hasDuplicateDetection) {
              // Convert unique key values using the same logic as insertStmt to ensure consistency
              const uniqueKeyValues = uniqueKeyColumns.map(col => {
                const colSchema = dataColumns.find(c => c.name === col);
                if (colSchema) {
                  return this.convertValue(colSchema, row[col]);
                }
                return row[col]; // Fallback to raw value
              });
              
              // Build dynamic query that handles NULL values properly
              const whereClauses = uniqueKeyColumns.map((col, idx) => {
                const value = uniqueKeyValues[idx];
                return value === null ? `"${col}" IS NULL` : `"${col}" = ?`;
              });
              const whereClause = whereClauses.join(' AND ');
              const sqlQuery = `SELECT id FROM "${table.tableName}" WHERE ${whereClause}`;
              
              // Prepare query parameters (excluding NULL values since they're handled with IS NULL)
              const queryParams = uniqueKeyValues.filter(val => val !== null);
              
              // Debug logging for duplicate detection
              if (rowIndex < 3) { // Log first 3 rows to avoid spam
                console.log(`🔍 Duplicate check for row ${rowIndex}:`);
                console.log(`   uniqueKeyColumns: [${uniqueKeyColumns.join(', ')}]`);
                console.log(`   row keys: [${Object.keys(row).join(', ')}]`);
                console.log(`   uniqueKeyValues (converted): [${uniqueKeyValues.join(', ')}]`);
                console.log(`   🔍 Dynamic SQL: ${sqlQuery}`);
                console.log(`   🔍 Query params: [${queryParams.join(', ')}]`);
              }
              
              const checkStmt = this.database.prepare(sqlQuery);
              const existingRow = checkStmt.get(...queryParams);

              // Debug logging for duplicate detection results
              if (rowIndex < 3) {
                console.log(`   🔍 Query result: ${existingRow ? 'DUPLICATE FOUND' : 'No match'}`);
                if (existingRow) {
                  console.log(`   📎 Existing row ID: ${existingRow.id}`);
                }
              }

              if (existingRow) {
                // Duplicate found!
                duplicates++;
                
                // Track duplicate details
                const uniqueKeyValuesObj: Record<string, any> = {};
                uniqueKeyColumns.forEach((col, idx) => {
                  uniqueKeyValuesObj[col] = uniqueKeyValues[idx];
                });
                duplicateDetails.push({ rowIndex, uniqueKeyValues: uniqueKeyValuesObj });

                if (duplicateAction === 'skip') {
                  // Skip this row
                  skipped++;
                  continue;
                } else if (duplicateAction === 'update' && updateStmt) {
                  // Update existing row
                  const values = dataColumns.map((col) => {
                    return this.convertValue(col, row[col.name]);
                  });

                  // Filter out unique key columns from update values
                  const updateValues = values.filter((_, idx) => {
                    return !uniqueKeyColumns.includes(dataColumns[idx].name);
                  });

                  // Add unique key values for WHERE clause (convert them same as insert)
                  const whereValues = uniqueKeyColumns.map(col => {
                    const colSchema = dataColumns.find(c => c.name === col);
                    if (colSchema) {
                      return this.convertValue(colSchema, row[col]);
                    }
                    return row[col];
                  });

                  updateStmt.run(...updateValues, ...whereValues);
                  inserted++; // Count as "inserted" (actually updated)
                  continue;
                }
                // If duplicateAction === 'allow', fall through to insert
              }
            }

            const values = dataColumns.map((col) => {
              return this.convertValue(col, row[col.name]);
            });

            insertStmt.run(...values);
            inserted++;
          } catch (error) {
            skipped++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMessage);

            // Log first 3 errors for debugging
            if (errorDetails.length < 3) {
              console.error(`❌ Row ${rowIndex} insert failed:`, errorMessage);
              console.error(`   Row data:`, JSON.stringify(row, null, 2));
            }

            // Track error details with row info
            errorDetails.push({
              rowIndex,
              error: errorMessage,
              rowData: row
            });
          }
        }

        // EXPLICIT COMMIT for this batch
        this.database.exec('COMMIT');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback batch:', rollbackError);
        }
        // Don't throw - continue with next batch
        console.error('Batch insert error:', txError);
      }
    }

    // Update row count
    this.updateRowCount(tableId);

    return { inserted, skipped, duplicates, errors, duplicateDetails, errorDetails };
  }

  /**
   * Insert rows with temporary duplicate detection settings (for sync operations)
   */
  insertRowsWithSettings(
    tableId: string,
    rows: any[],
    tempSettings?: {
      uniqueKeyColumns?: string[];
      duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
    }
  ): { inserted: number; skipped: number; duplicates: number; errors: string[]; duplicateDetails: any[]; errorDetails: any[] } {
    
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Use temporary settings if provided, otherwise fall back to table's settings
    let uniqueKeyColumns: string[];
    let duplicateAction: string;
    
    if (tempSettings && tempSettings.uniqueKeyColumns !== undefined) {
      uniqueKeyColumns = tempSettings.uniqueKeyColumns;
      duplicateAction = tempSettings.duplicateAction || 'skip';
      console.log('🔄 Using temporary sync settings:');
      console.log('  Unique Key Columns:', uniqueKeyColumns);
      console.log('  Duplicate Action:', duplicateAction);
    } else {
      // Fall back to table's stored settings
      uniqueKeyColumns = table.uniqueKeyColumns ? JSON.parse(table.uniqueKeyColumns) : [];
      duplicateAction = table.duplicateAction || 'skip';
      console.log('📋 Using table\'s existing settings:');
      console.log('  Unique Key Columns:', uniqueKeyColumns);
      console.log('  Duplicate Action:', duplicateAction);
    }

    const hasDuplicateDetection = uniqueKeyColumns.length > 0;

    // Handle replace-date-range mode
    if (duplicateAction === 'replace-date-range') {
      return this.replaceByDateRange(tableId, rows);
    }

    // Handle replace-all mode
    if (duplicateAction === 'replace-all') {
      return this.replaceAll(tableId, rows);
    }

    // Core insertion logic (same as insertRows but with override settings)
    let inserted = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors: string[] = [];
    const duplicateDetails: Array<{ rowIndex: number; uniqueKeyValues: Record<string, any> }> = [];
    const errorDetails: Array<{ rowIndex: number; error: string; rowData?: Record<string, any> }> = [];

    // Check if id column is AUTOINCREMENT (first column is INTEGER with autoincrement)
    const idColumn = table.schema.find((col) => col.name === 'id');
    const isAutoIncrementId = idColumn?.type === 'INTEGER' && table.schema.indexOf(idColumn) === 0;

    // Filter out the ID column only if it's auto-increment
    // If user defined their own id column (e.g., TEXT), include it in inserts
    const dataColumns = isAutoIncrementId
      ? table.schema.filter((col) => col.name !== 'id')
      : table.schema;

    // Prepare column names (excluding ID)
    const columnNames = dataColumns.map((col) => `"${col.name}"`).join(', ');
    const placeholders = dataColumns.map(() => '?').join(', ');

    const insertStmt = this.database.prepare(
      `INSERT INTO "${table.tableName}" (${columnNames}) VALUES (${placeholders})`
    );

    // Prepare duplicate check statement if needed
    let checkDuplicateStmt: any = null;
    if (hasDuplicateDetection) {
      // We'll build the query dynamically to handle NULLs properly
      console.log(`🔍 Unique key columns: [${uniqueKeyColumns.join(', ')}]`);
    }

    // Prepare update statement if needed
    let updateStmt: any = null;
    if (hasDuplicateDetection && duplicateAction === 'update') {
      const updateColumns = dataColumns
        .filter(col => !uniqueKeyColumns.includes(col.name))
        .map(col => `"${col.name}" = ?`)
        .join(', ');
      const whereClause = uniqueKeyColumns
        .map(col => `"${col}" = ?`)
        .join(' AND ');

      if (updateColumns) {
        updateStmt = this.database.prepare(
          `UPDATE "${table.tableName}" SET ${updateColumns} WHERE ${whereClause}`
        );
      }
    }

    // Process rows in batches of 500
    const batchSize = 500;
    for (let batchStart = 0; batchStart < rows.length; batchStart += batchSize) {
      const batch = rows.slice(batchStart, batchStart + batchSize);

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        for (let i = 0; i < batch.length; i++) {
          const row = batch[i];
          const rowIndex = batchStart + i;

          try {
            // Check for duplicate if duplicate detection is enabled
            if (hasDuplicateDetection) {
              // Convert unique key values using the same logic as insertStmt to ensure consistency
              const uniqueKeyValues = uniqueKeyColumns.map(col => {
                const colSchema = dataColumns.find(c => c.name === col);
                if (colSchema) {
                  return this.convertValue(colSchema, row[col]);
                }
                return row[col]; // Fallback to raw value
              });

              // Build dynamic query that handles NULL values properly
              const whereClauses = uniqueKeyColumns.map((col, idx) => {
                const value = uniqueKeyValues[idx];
                return value === null ? `"${col}" IS NULL` : `"${col}" = ?`;
              });
              const whereClause = whereClauses.join(' AND ');
              const sqlQuery = `SELECT id FROM "${table.tableName}" WHERE ${whereClause}`;

              // Prepare query parameters (excluding NULL values since they're handled with IS NULL)
              const queryParams = uniqueKeyValues.filter(val => val !== null);

              const checkStmt = this.database.prepare(sqlQuery);
              const existingRow = checkStmt.get(...queryParams);

              if (existingRow) {
                // Duplicate found!
                duplicates++;

                // Track duplicate details
                const uniqueKeyValuesObj: Record<string, any> = {};
                uniqueKeyColumns.forEach((col, idx) => {
                  uniqueKeyValuesObj[col] = uniqueKeyValues[idx];
                });
                duplicateDetails.push({ rowIndex, uniqueKeyValues: uniqueKeyValuesObj });

                if (duplicateAction === 'skip') {
                  // Skip this row
                  skipped++;
                  continue;
                } else if (duplicateAction === 'update' && updateStmt) {
                  // Update existing row
                  const values = dataColumns.map((col) => {
                    return this.convertValue(col, row[col.name]);
                  });

                  // Filter out unique key columns from update values
                  const updateValues = values.filter((_, idx) => {
                    return !uniqueKeyColumns.includes(dataColumns[idx].name);
                  });

                  // Add unique key values for WHERE clause (convert them same as insert)
                  const whereValues = uniqueKeyColumns.map(col => {
                    const colSchema = dataColumns.find(c => c.name === col);
                    if (colSchema) {
                      return this.convertValue(colSchema, row[col]);
                    }
                    return row[col];
                  });

                  updateStmt.run(...updateValues, ...whereValues);
                  inserted++; // Count as "inserted" (actually updated)
                  continue;
                }
                // If duplicateAction === 'allow', fall through to insert
              }
            }

            const values = dataColumns.map((col) => {
              return this.convertValue(col, row[col.name]);
            });

            insertStmt.run(...values);
            inserted++;
          } catch (error) {
            skipped++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMessage);

            // Track error details with row info
            errorDetails.push({
              rowIndex,
              error: errorMessage,
              rowData: row
            });
          }
        }

        // EXPLICIT COMMIT for this batch
        this.database.exec('COMMIT');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback batch:', rollbackError);
        }
        // Don't throw - continue with next batch
        console.error('Batch insert error:', txError);
      }
    }

    // Update row count
    this.updateRowCount(tableId);

    return { inserted, skipped, duplicates, errors, duplicateDetails, errorDetails };
  }


  /**
   * Replace data by date range - deletes existing data in the date range and inserts new data
   */
  replaceByDateRange(tableId: string, rows: any[]): { inserted: number; skipped: number; duplicates: number; errors: string[]; duplicateDetails: any[]; errorDetails: any[] } {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Find date columns in the schema (exclude id and imported_at)
    const dateColumns = table.schema.filter(
      col => col.type === 'DATE' && col.name !== 'id' && col.name !== 'imported_at'
    );

    if (dateColumns.length === 0) {
      throw new Error('No date columns found in table. Replace-date-range mode requires at least one date column (excluding imported_at).');
    }

    // Use the first date column as the primary date column for range calculation
    const primaryDateColumn = dateColumns[0].name;
    console.log(`📅 Using "${primaryDateColumn}" as primary date column for range replacement`);

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const errorDetails: Array<{ rowIndex: number; error: string; rowData?: Record<string, any> }> = [];

    try {
      // Convert all incoming row dates and find the date range
      const dateValues: Date[] = [];

      // Check if id column is AUTOINCREMENT
      const idColumn = table.schema.find((col) => col.name === 'id');
      const isAutoIncrementId = idColumn?.type === 'INTEGER' && table.schema.indexOf(idColumn) === 0;

      const dataColumns = isAutoIncrementId
        ? table.schema.filter((col) => col.name !== 'id')
        : table.schema;
      
      rows.forEach((row, idx) => {
        try {
          // Debug logging for first few rows
          if (idx < 3) {
            console.log(`🔍 Row ${idx} keys:`, Object.keys(row));
            console.log(`🔍 Row ${idx}["${primaryDateColumn}"]:`, row[primaryDateColumn]);
          }

          const rawValue = row[primaryDateColumn];
          if (rawValue === undefined || rawValue === null || rawValue === '') {
            if (idx < 3) {
              console.warn(`⚠️ Row ${idx}: Empty date value for column "${primaryDateColumn}"`);
            }
            return; // Skip this row
          }

          const dateValue = this.convertValue(dateColumns.find(c => c.name === primaryDateColumn)!, rawValue);
          if (dateValue) {
            dateValues.push(new Date(dateValue));
            if (idx < 3) {
              console.log(`✓ Row ${idx}: Parsed date: ${new Date(dateValue).toISOString()}`);
            }
          } else {
            if (idx < 3) {
              console.warn(`⚠️ Row ${idx}: convertValue returned null/undefined for "${rawValue}"`);
            }
          }
        } catch (error) {
          if (idx < 3) {
            console.warn(`⚠️ Could not parse date for row ${idx}:`, {
              rawValue: row[primaryDateColumn],
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      });

      if (dateValues.length === 0) {
        throw new Error(`No valid dates found in column "${primaryDateColumn}". Cannot determine date range.`);
      }

      // Calculate date range
      const minDate = new Date(Math.min(...dateValues.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dateValues.map(d => d.getTime())));
      
      console.log(`📅 Excel date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        // Delete existing data in the date range - use DATE() function to handle rows with time components
        const deleteStmt = this.database.prepare(
          `DELETE FROM "${table.tableName}" WHERE DATE("${primaryDateColumn}") >= ? AND DATE("${primaryDateColumn}") <= ?`
        );
        const deletedRows = deleteStmt.run(minDate.toISOString().split('T')[0], maxDate.toISOString().split('T')[0]);
        console.log(`🗑️ Deleted ${deletedRows.changes} existing rows in date range`);

        // Insert all new rows
        const columnNames = dataColumns.map((col) => `"${col.name}"`).join(', ');
        const placeholders = dataColumns.map(() => '?').join(', ');
        const insertStmt = this.database.prepare(
          `INSERT INTO "${table.tableName}" (${columnNames}) VALUES (${placeholders})`
        );

        rows.forEach((row, idx) => {
          try {
            const values = dataColumns.map((col) => {
              return this.convertValue(col, row[col.name]);
            });

            insertStmt.run(...values);
            inserted++;
          } catch (error) {
            skipped++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMessage);

            errorDetails.push({
              rowIndex: idx,
              error: errorMessage,
              rowData: row
            });
          }
        });

        // EXPLICIT COMMIT
        this.database.exec('COMMIT');
        console.log('✅ [replaceByDateRange] Explicit COMMIT executed');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }
        throw txError;
      }

      // Update row count
      this.updateRowCount(tableId);

      console.log(`✅ Date range replacement complete: ${inserted} inserted, ${skipped} errors`);

      return { 
        inserted, 
        skipped, 
        duplicates: 0, // No duplicates in replace mode
        errors, 
        duplicateDetails: [], // No duplicate tracking in replace mode
        errorDetails 
      };

    } catch (error) {
      console.error('❌ Date range replacement failed:', error);
      throw error;
    }
  }

  /**
   * Replace all rows in a table with new data
   * Deletes ALL existing rows and inserts all incoming rows (complete replacement)
   * Executes in a single transaction for atomicity
   *
   * @param tableId - Table ID to replace data in
   * @param rows - All rows to insert
   * @returns Insert result with counts
   */
  replaceAll(tableId: string, rows: any[]): InsertResult {
    console.log(`🔄 Replace all mode: Deleting ALL data and inserting ${rows.length} new rows into table ${tableId}...`);

    try {
      // Get table metadata
      const table = this.getTable(tableId);
      if (!table) {
        throw new Error(`Table with ID ${tableId} not found`);
      }

      // Determine which columns to insert (exclude auto-increment id)
      const idColumn = table.schema.find((col) => col.name === 'id');
      const isAutoIncrementId = idColumn?.type === 'INTEGER' && table.schema.indexOf(idColumn) === 0;
      const dataColumns = isAutoIncrementId
        ? table.schema.filter(col => col.name !== 'id')
        : table.schema;

      let inserted = 0;
      let skipped = 0;
      const errors: string[] = [];
      const errorDetails: Array<{ rowIndex: number; error: string; rowData: any }> = [];

      // Use explicit BEGIN/COMMIT for proper fsync
      try {
        this.database.exec('BEGIN IMMEDIATE');

        // Step 1: Delete ALL existing rows
        const deleteStmt = this.database.prepare(`DELETE FROM "${table.tableName}"`);
        const deleteResult = deleteStmt.run();
        console.log(`  🗑️ Deleted ${deleteResult.changes} existing rows`);

        // Step 2: Insert all new rows
        const columnNames = dataColumns.map((col) => `"${col.name}"`).join(', ');
        const placeholders = dataColumns.map(() => '?').join(', ');
        const insertStmt = this.database.prepare(
          `INSERT INTO "${table.tableName}" (${columnNames}) VALUES (${placeholders})`
        );

        rows.forEach((row, idx) => {
          try {
            const values = dataColumns.map((col) => {
              return this.convertValue(col, row[col.name]);
            });

            insertStmt.run(...values);
            inserted++;
          } catch (error) {
            skipped++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMessage);

            errorDetails.push({
              rowIndex: idx,
              error: errorMessage,
              rowData: row
            });
          }
        });

        // EXPLICIT COMMIT
        this.database.exec('COMMIT');
        console.log('✅ [replaceAll] Explicit COMMIT executed');

      } catch (txError) {
        try {
          this.database.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback:', rollbackError);
        }
        throw txError;
      }

      // Update row count
      this.updateRowCount(tableId);

      console.log(`✅ Replace all complete: ${inserted} inserted, ${skipped} errors`);

      return {
        inserted,
        skipped,
        duplicates: 0, // No duplicates in replace mode
        errors,
        duplicateDetails: [], // No duplicate tracking in replace mode
        errorDetails
      };

    } catch (error) {
      console.error('❌ Replace all failed:', error);
      throw error;
    }
  }

  /**
   * Convert value based on column type
   * @private
   */
  private convertValue(col: ColumnSchema, value: any): any {
    // Always trim string values first to remove leading/trailing whitespace
    let processedValue = value;
    if (typeof value === 'string') {
      processedValue = value.trim();
    }
    
    // Handle null/undefined/empty (after trimming)
    if (processedValue === undefined || processedValue === null || processedValue === '') {
      if (col.notNull) {
        throw new Error(`Column "${col.name}" cannot be null`);
      }
      return null;
    }
    
    // Type conversions with validation
    if (col.type === 'INTEGER') {
      const stringValue = String(processedValue);

      // Reject values with dashes (like "123-45-67890")
      if (stringValue.includes('-') && !/^-?\d+$/.test(stringValue.replace(/,/g, ''))) {
        throw new Error(`Cannot convert "${processedValue}" to INTEGER for column "${col.name}" (contains dashes)`);
      }

      const cleanValue = stringValue.replace(/,/g, '').trim();
      const num = parseInt(cleanValue, 10);
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${processedValue}" to INTEGER for column "${col.name}"`);
      }
      return num;
    }

    if (col.type === 'REAL') {
      const stringValue = String(processedValue);

      // Reject values with dashes (like "123-45-67890")
      if (stringValue.includes('-') && !/^-?\d+(\.\d+)?$/.test(stringValue.replace(/,/g, ''))) {
        throw new Error(`Cannot convert "${processedValue}" to REAL for column "${col.name}" (contains dashes)`);
      }

      const cleanValue = stringValue.replace(/,/g, '').trim();
      const num = parseFloat(cleanValue);
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${processedValue}" to REAL for column "${col.name}"`);
      }
      return num;
    }
    
    if (col.type === 'DATE') {
      let dateObj: Date;

      if (processedValue instanceof Date) {
        dateObj = processedValue;
      } else if (typeof processedValue === 'string') {
        // Strip suffix if present (e.g., "26/02/02-1" → "26/02/02")
        // Only match suffixes on slash-delimited dates, not ISO format (YYYY-MM-DD)
        let dateStr = processedValue;
        const suffixMatch = processedValue.match(/^(.+\/\d{2,4})-\d+$/);
        if (suffixMatch) {
          dateStr = suffixMatch[1];
        }

        // Handle YYYYMMDD format (e.g., "20250101") by adding delimiters
        if (/^\d{8}$/.test(dateStr)) {
          // Convert "20250101" to "2025/01/01"
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          dateObj = new Date(`${year}/${month}/${day}`);
        } else {
          // Use slashes for normalization to ensure JS Date treats it as local time
          // (YYYY-MM-DD is often treated as UTC, while YYYY/MM/DD is local)
          let normalized = dateStr.replace(/-/g, '/');
          if (normalized.includes('오전') || normalized.includes('오후')) {
            const isPM = normalized.includes('오후');
            const isAM = normalized.includes('오전');
            // Remove day of week like (월)
            normalized = normalized.replace(/\([^)]+\)/, '').trim();
            // Remove Korean AM/PM
            normalized = normalized.replace('오전', '').replace('오후', '').trim();
            // Add standard AM/PM at the end for JS Date
            normalized += isPM ? ' PM' : ' AM';
          }

          dateObj = new Date(normalized);
        }

        if (isNaN(dateObj.getTime())) {
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            const first = parseInt(parts[0], 10);
            const second = parseInt(parts[1], 10);
            const third = parseInt(parts[2], 10);

            // Check for YY/MM/DD format (all parts are <= 99)
            if (first <= 99 && second <= 12 && third <= 31) {
              // Assume 20YY for years 00-99
              const fullYear = first < 100 ? 2000 + first : first;
              dateObj = new Date(fullYear, second - 1, third);
            } else if (third > 31) {
              // YYYY format at end
              dateObj = new Date(third, second - 1, first);
            } else if (first > 31) {
              // YYYY format at start
              dateObj = new Date(first, second - 1, third);
            } else {
              // Ambiguous - assume first is year
              dateObj = new Date(first, second - 1, third);
            }
          }
        }
      } else if (typeof processedValue === 'number') {
        // Check if it's YYYYMMDD format (8-digit integer)
        if (Number.isInteger(processedValue) && processedValue >= 19000101 && processedValue <= 21991231) {
          const valueStr = String(processedValue);
          if (valueStr.length === 8) {
            const year = parseInt(valueStr.substring(0, 4), 10);
            const month = parseInt(valueStr.substring(4, 6), 10);
            const day = parseInt(valueStr.substring(6, 8), 10);
            dateObj = new Date(year, month - 1, day);
          } else {
            // Excel serial date
            dateObj = new Date((processedValue - 25569) * 86400 * 1000);
          }
        } else {
          // Excel serial date
          dateObj = new Date((processedValue - 25569) * 86400 * 1000);
        }
      } else {
        throw new Error(`Cannot convert "${processedValue}" to DATE for column "${col.name}"`);
      }

      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date "${processedValue}" for column "${col.name}"`);
      }

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');

      // If time is exactly midnight, store as date only, otherwise store full datetime
      if (hours === '00' && minutes === '00' && seconds === '00') {
        return `${year}-${month}-${day}`;
      }
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    // TEXT: convert everything to string and trim
    if (processedValue instanceof Date) {
      return processedValue.toISOString();
    }
    
    return String(processedValue).trim();
  }

  /**
   * Update row count for a table
   */
  private updateRowCount(tableId: string): void {
    const table = this.getTable(tableId);
    if (!table) return;

    const countStmt = this.database.prepare(
      `SELECT COUNT(*) as count FROM "${table.tableName}"`
    );
    const result = countStmt.get() as { count: number };

    const updateStmt = this.database.prepare(
      'UPDATE user_tables SET row_count = ? WHERE id = ?'
    );
    updateStmt.run(result.count, tableId);
  }

  /**
   * Query data from a table
   */
  queryData(tableId: string, options: QueryOptions = {}): QueryResult {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    const limit = Math.min(options.limit || 100, 1000);
    const offset = options.offset || 0;

    let whereClauses: string[] = [];
    let params: any[] = [];

    // Build filter conditions
    if (options.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        // Check if column exists
        const columnExists = table.schema.some((col) => col.name === column);
        if (!columnExists) continue;

        // Parse operators (>, <, >=, <=, =, !=)
        const operatorMatch = value.match(/^([><=!]+)(.+)$/);
        if (operatorMatch) {
          const [, operator, val] = operatorMatch;
          whereClauses.push(`"${column}" ${operator} ?`);
          params.push(val.trim());
        } else {
          whereClauses.push(`"${column}" = ?`);
          params.push(value);
        }
      }
    }

    // Search across columns
    if (options.searchQuery && options.searchColumns) {
      const searchClauses = options.searchColumns
        .filter((col) => table.schema.some((c) => c.name === col))
        .map((col) => `"${col}" LIKE ?`);

      if (searchClauses.length > 0) {
        whereClauses.push(`(${searchClauses.join(' OR ')})`);
        // Add search parameter for each column
        for (let i = 0; i < searchClauses.length; i++) {
          params.push(`%${options.searchQuery}%`);
        }
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderByClause = '';
    if (options.orderBy) {
      const columnExists = table.schema.some(
        (col) => col.name === options.orderBy
      );
      if (columnExists) {
        const direction = options.orderDirection || 'ASC';
        orderByClause = `ORDER BY "${options.orderBy}" ${direction}`;
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM "${table.tableName}" ${whereClause}`;
    const countResult = this.database.prepare(countSql).get(...params) as {
      count: number;
    };
    const total = countResult.count;

    // Get rows
    const dataSql = `SELECT * FROM "${table.tableName}" ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
    const rows = this.database.prepare(dataSql).all(...params, limit, offset);

    return { rows, total, limit, offset };
  }

  /**
   * Search across all columns in a table
   */
  searchData(
    tableId: string,
    searchQuery: string,
    limit: number = 100
  ): QueryResult {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    return this.queryData(tableId, {
      searchQuery,
      searchColumns: table.schema.map((col) => col.name),
      limit: Math.min(limit, 1000),
      offset: 0,
    });
  }

  /**
   * Perform aggregation on a column
   */
  aggregate(tableId: string, options: AggregationOptions): AggregationResult {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Validate column exists
    const columnExists = table.schema.some(
      (col) => col.name === options.column
    );
    if (!columnExists) {
      throw new Error(`Column not found: ${options.column}`);
    }

    let whereClauses: string[] = [];
    let params: any[] = [];

    // Build filter conditions
    if (options.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        const colExists = table.schema.some((col) => col.name === column);
        if (!colExists) continue;

        const operatorMatch = value.match(/^([><=!]+)(.+)$/);
        if (operatorMatch) {
          const [, operator, val] = operatorMatch;
          whereClauses.push(`"${column}" ${operator} ?`);
          params.push(val.trim());
        } else {
          whereClauses.push(`"${column}" = ?`);
          params.push(value);
        }
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Simple aggregation without grouping
    if (!options.groupBy) {
      const sql = `SELECT ${options.function}("${options.column}") as value FROM "${table.tableName}" ${whereClause}`;
      const result = this.database.prepare(sql).get(...params) as {
        value: number;
      };
      return { value: result.value || 0 };
    }

    // Aggregation with grouping
    const groupByExists = table.schema.some(
      (col) => col.name === options.groupBy
    );
    if (!groupByExists) {
      throw new Error(`Group by column not found: ${options.groupBy}`);
    }

    const sql = `
      SELECT "${options.groupBy}" as group_col, ${options.function}("${options.column}") as value
      FROM "${table.tableName}"
      ${whereClause}
      GROUP BY "${options.groupBy}"
      ORDER BY value DESC
    `;

    const rows = this.database.prepare(sql).all(...params) as Array<{
      group_col: string;
      value: number;
    }>;

    const groupedResults = rows.map((row) => ({
      group: String(row.group_col),
      value: row.value || 0,
    }));

    const totalValue = groupedResults.reduce((sum, item) => sum + item.value, 0);

    return {
      value: totalValue,
      groupedResults,
    };
  }

  /**
   * Execute raw SQL SELECT query (read-only, security validated)
   */
  executeRawQuery(sql: string): { rows: any[]; columns: string[] } {
    // Security: Only allow SELECT statements
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Security: Validate query doesn't contain dangerous keywords
    const dangerousKeywords = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'CREATE',
      'ALTER',
      'TRUNCATE',
      'ATTACH',
      'DETACH',
    ];
    for (const keyword of dangerousKeywords) {
      if (trimmedSql.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    // Validate query plan to ensure it's safe
    try {
      this.database.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid SQL query: ${message}`);
    }

    // Execute query
    const stmt = this.database.prepare(sql);
    const rows = stmt.all();

    // Get column names
    const columns =
      rows.length > 0 ? Object.keys(rows[0]) : stmt.columns().map((c) => c.name);

    return { rows, columns };
  }

  /**
   * Get sample data for export preview
   */
  getExportPreview(tableId: string, limit: number = 10): any[] {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    const sql = `SELECT * FROM "${table.tableName}" LIMIT ?`;
    return this.database.prepare(sql).all(Math.min(limit, 100));
  }

  /**
   * Delete rows from a table by filter or by ID
   */
  deleteRows(tableId: string, options: {
    ids?: number[];
    filters?: Record<string, string>;
  }): { deleted: number } {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    let whereClauses: string[] = [];
    let params: any[] = [];

    // Delete by IDs
    if (options.ids && options.ids.length > 0) {
      const placeholders = options.ids.map(() => '?').join(', ');
      whereClauses.push(`id IN (${placeholders})`);
      params.push(...options.ids);
    }

    // Delete by filters
    if (options.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        // Check if column exists
        const columnExists = table.schema.some((col) => col.name === column);
        if (!columnExists) continue;

        // Parse operators (>, <, >=, <=, =, !=)
        const operatorMatch = value.match(/^([><=!]+)(.+)$/);
        if (operatorMatch) {
          const [, operator, val] = operatorMatch;
          whereClauses.push(`"${column}" ${operator} ?`);
          params.push(val.trim());
        } else {
          whereClauses.push(`"${column}" = ?`);
          params.push(value);
        }
      }
    }

    if (whereClauses.length === 0) {
      throw new Error('No deletion criteria provided (ids or filters required)');
    }

    const whereClause = whereClauses.join(' AND ');
    const sql = `DELETE FROM "${table.tableName}" WHERE ${whereClause}`;

    const stmt = this.database.prepare(sql);
    const result = stmt.run(...params);

    // Update row count
    this.updateRowCount(tableId);

    return { deleted: result.changes };
  }

  /**
   * Update rows in a table by filter or by ID
   */
  updateRows(tableId: string, updates: Record<string, any>, options: {
    ids?: number[];
    filters?: Record<string, string>;
  }): { updated: number } {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('No update fields provided');
    }

    // Build SET clause
    const setClauses: string[] = [];
    const setParams: any[] = [];
    const dataColumns = table.schema.filter((col) => col.name !== 'id');

    for (const [column, value] of Object.entries(updates)) {
      // Check if column exists (excluding id which is auto-generated)
      const columnSchema = dataColumns.find((col) => col.name === column);
      if (!columnSchema) {
        console.warn(`Column "${column}" not found in table schema, skipping`);
        continue;
      }

      setClauses.push(`"${column}" = ?`);
      setParams.push(this.convertValue(columnSchema, value));
    }

    if (setClauses.length === 0) {
      throw new Error('No valid update columns provided');
    }

    // Build WHERE clause
    let whereClauses: string[] = [];
    let whereParams: any[] = [];

    // Update by IDs
    if (options.ids && options.ids.length > 0) {
      const placeholders = options.ids.map(() => '?').join(', ');
      whereClauses.push(`id IN (${placeholders})`);
      whereParams.push(...options.ids);
    }

    // Update by filters
    if (options.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        // Check if column exists
        const columnExists = table.schema.some((col) => col.name === column);
        if (!columnExists) continue;

        // Parse operators (>, <, >=, <=, =, !=)
        const operatorMatch = value.match(/^([><=!]+)(.+)$/);
        if (operatorMatch) {
          const [, operator, val] = operatorMatch;
          whereClauses.push(`"${column}" ${operator} ?`);
          whereParams.push(val.trim());
        } else {
          whereClauses.push(`"${column}" = ?`);
          whereParams.push(value);
        }
      }
    }

    if (whereClauses.length === 0) {
      throw new Error('No update criteria provided (ids or filters required)');
    }

    const setClause = setClauses.join(', ');
    const whereClause = whereClauses.join(' AND ');
    const sql = `UPDATE "${table.tableName}" SET ${setClause} WHERE ${whereClause}`;

    const stmt = this.database.prepare(sql);
    const result = stmt.run(...setParams, ...whereParams);

    return { updated: result.changes };
  }

  /**
   * Create an import operation
   */
  createImportOperation(data: CreateImportOperationData): ImportOperation {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.database.prepare(`
      INSERT INTO import_operations (
        id, table_id, file_name, status, started_at, rows_imported, rows_skipped
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.tableId, data.fileName, 'running', now, 0, 0);

    return {
      id,
      tableId: data.tableId,
      fileName: data.fileName,
      status: 'running',
      startedAt: now,
      rowsImported: 0,
      rowsSkipped: 0,
    };
  }

  /**
   * Complete an import operation
   */
  completeImportOperation(id: string, results: ImportResults): void {
    const now = new Date().toISOString();
    const status = results.errorMessage ? 'failed' : 'completed';

    const stmt = this.database.prepare(`
      UPDATE import_operations
      SET status = ?, completed_at = ?, rows_imported = ?, rows_skipped = ?, error_message = ?
      WHERE id = ?
    `);

    stmt.run(
      status,
      now,
      results.rowsImported,
      results.rowsSkipped,
      results.errorMessage || null,
      id
    );
  }

  /**
   * Get import operations for a table
   */
  getImportOperations(tableId: string, limit: number = 50): ImportOperation[] {
    const stmt = this.database.prepare(`
      SELECT * FROM import_operations
      WHERE table_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);

    return stmt.all(tableId, limit) as ImportOperation[];
  }

  /**
   * Get recent import operations
   */
  getRecentImportOperations(limit: number = 50): ImportOperation[] {
    const stmt = this.database.prepare(`
      SELECT * FROM import_operations
      ORDER BY started_at DESC
      LIMIT ?
    `);

    return stmt.all(limit) as ImportOperation[];
  }

  // ==================== Vector Embedding Methods ====================

  /**
   * Embed table columns with progress tracking
   * Async generator that yields progress updates
   */
  async *embedTableColumns(
    tableId: string,
    columnNames: string[],
    embeddingService: GeminiEmbeddingService,
    options?: { batchSize?: number }
  ): AsyncGenerator<{
    progress: number;
    total: number;
    message: string;
    estimatedCost?: number;
  }> {
    const batchSize = options?.batchSize || 100;
    const vectorManager = new UserDataVectorManager(this.database);

    // Get table info
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Validate columns are TEXT type
    const validColumns = columnNames.filter((colName) => {
      const col = table.schema.find((c) => c.name === colName);
      return col && col.type === 'TEXT';
    });

    if (validColumns.length === 0) {
      throw new Error('No valid TEXT columns to embed');
    }

    // Count total rows
    const countStmt = this.database.prepare(
      `SELECT COUNT(*) as count FROM "${table.tableName}"`
    );
    const countRow = countStmt.get() as any;
    const totalRows = countRow.count;

    if (totalRows === 0) {
      throw new Error('Table is empty, nothing to embed');
    }

    const totalOperations = totalRows * validColumns.length;
    let processedOperations = 0;
    let totalChars = 0;

    // Process each column
    for (const columnName of validColumns) {
      yield {
        progress: processedOperations,
        total: totalOperations,
        message: `Embedding column: ${columnName}`,
      };

      // Fetch all rows for this column in batches
      let offset = 0;
      while (offset < totalRows) {
        const dataStmt = this.database.prepare(
          `SELECT id as rowId, "${columnName}" as value FROM "${table.tableName}" LIMIT ? OFFSET ?`
        );
        const rows = dataStmt.all(batchSize, offset) as any[];

        if (rows.length === 0) break;

        // Filter out null/empty values
        const validRows = rows.filter(
          (row) => row.value && typeof row.value === 'string' && row.value.trim()
        );

        if (validRows.length > 0) {
          // Generate embeddings for this batch
          const texts = validRows.map((row) => row.value.trim());
          const embeddings = await embeddingService.embedBatch(texts, {
            taskType: 'RETRIEVAL_DOCUMENT',
          });

          // Count characters for cost estimation
          const batchChars = texts.reduce((sum, text) => sum + text.length, 0);
          totalChars += batchChars;

          // Prepare embedding data
          const embeddingData: UserDataEmbeddingData[] = validRows.map(
            (row, idx) => ({
              tableId,
              rowId: row.rowId,
              columnName,
              embedding: embeddings[idx].embedding,
              model: embeddings[idx].model,
              dimensions: embeddings[idx].dimensions,
            })
          );

          // Bulk insert embeddings
          vectorManager.bulkInsertEmbeddings(embeddingData);
        }

        processedOperations += rows.length;
        offset += batchSize;

        // Yield progress
        const estimatedCost = (totalChars / 1000) * 0.00001;
        yield {
          progress: processedOperations,
          total: totalOperations,
          message: `Embedding column: ${columnName} (${offset}/${totalRows})`,
          estimatedCost,
        };
      }

      // Update metadata for this column
      const estimatedCostForColumn = (totalChars / 1000) * 0.00001;
      const firstEmbedding = await embeddingService.embedText('test', {
        taskType: 'RETRIEVAL_DOCUMENT',
      });
      vectorManager.updateMetadata(
        tableId,
        columnName,
        firstEmbedding.model,
        firstEmbedding.dimensions,
        estimatedCostForColumn
      );
    }

    // Final progress
    const finalCost = (totalChars / 1000) * 0.00001;
    yield {
      progress: totalOperations,
      total: totalOperations,
      message: 'Embedding complete',
      estimatedCost: finalCost,
    };
  }

  /**
   * Perform semantic search on a table
   */
  async vectorSearch(
    tableId: string,
    queryText: string,
    embeddingService: GeminiEmbeddingService,
    options?: {
      limit?: number;
      threshold?: number;
      columnNames?: string[];
    }
  ): Promise<{
    rows: any[];
    total: number;
    searchResults: Array<{
      rowId: number;
      similarity: number;
      matchedColumns: string[];
    }>;
  }> {
    const limit = options?.limit || 50;
    const threshold = options?.threshold || 0.7;
    const columnNames = options?.columnNames;

    // Get table info
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    // Generate query embedding
    const queryEmbedding = await embeddingService.embedQuery(queryText);

    // Search for similar embeddings
    const vectorManager = new UserDataVectorManager(this.database);
    const searchResults = vectorManager.searchSimilar(tableId, {
      embedding: queryEmbedding.embedding,
      limit: limit * 10, // Get more results to group by row
      threshold,
      columnNames,
    });

    // Group results by row_id and take max similarity
    const rowMap = new Map<
      number,
      { similarity: number; matchedColumns: string[] }
    >();

    for (const result of searchResults) {
      const existing = rowMap.get(result.rowId);
      if (!existing || result.similarity > existing.similarity) {
        const matchedColumns = existing
          ? [...existing.matchedColumns, result.columnName]
          : [result.columnName];
        rowMap.set(result.rowId, {
          similarity: result.similarity,
          matchedColumns: Array.from(new Set(matchedColumns)),
        });
      }
    }

    // Sort by similarity and take top results
    const sortedRows = Array.from(rowMap.entries())
      .sort((a, b) => b[1].similarity - a[1].similarity)
      .slice(0, limit);

    // Fetch full rows
    if (sortedRows.length === 0) {
      return { rows: [], total: 0, searchResults: [] };
    }

    const rowIds = sortedRows.map(([rowId]) => rowId);
    const placeholders = rowIds.map(() => '?').join(',');
    const dataStmt = this.database.prepare(
      `SELECT rowid, * FROM "${table.tableName}" WHERE rowid IN (${placeholders})`
    );
    const rows = dataStmt.all(...rowIds) as any[];

    // Add similarity and matched columns to rows
    const enrichedRows = rows.map((row) => {
      const rowData = rowMap.get(row.rowid);
      return {
        ...row,
        _similarity: rowData?.similarity,
        _matchedColumns: rowData?.matchedColumns,
      };
    });

    // Sort by similarity
    enrichedRows.sort((a, b) => (b._similarity || 0) - (a._similarity || 0));

    return {
      rows: enrichedRows,
      total: enrichedRows.length,
      searchResults: sortedRows.map(([rowId, data]) => ({
        rowId,
        similarity: data.similarity,
        matchedColumns: data.matchedColumns,
      })),
    };
  }

  /**
   * Get embedding statistics for a table
   */
  getEmbeddingStats(tableId: string): UserDataEmbeddingStats {
    const vectorManager = new UserDataVectorManager(this.database);
    return vectorManager.getEmbeddingStats(tableId);
  }

  /**
   * Delete embeddings for a table
   */
  deleteEmbeddings(tableId: string, columnNames?: string[]): number {
    const vectorManager = new UserDataVectorManager(this.database);
    return vectorManager.deleteEmbeddings(tableId, columnNames);
  }

  /**
   * Get list of embedded columns for a table
   */
  getEmbeddedColumns(tableId: string): string[] {
    const vectorManager = new UserDataVectorManager(this.database);
    return vectorManager.getEmbeddedColumns(tableId);
  }
}
