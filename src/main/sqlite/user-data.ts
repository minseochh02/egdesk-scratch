import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
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

/**
 * User Data Database Manager
 *
 * Manages user-created database tables, data operations, and import tracking
 */
export class UserDataDbManager {
  constructor(private database: Database.Database) {}

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
      description?: string;
      createdFromFile?: string;
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
    const tableName = this.sanitizeTableName(displayName);
    const now = new Date().toISOString();

    // Add auto-incrementing ID column as the first column
    const idColumn: ColumnSchema = {
      name: 'id',
      type: 'INTEGER',
      notNull: true,
    };

    // Full schema including ID column
    const fullSchema = [idColumn, ...schema];

    // Validate fullSchema is serializable
    const schemaJson = JSON.stringify(fullSchema);
    if (!schemaJson || schemaJson === 'undefined' || schemaJson === 'null') {
      throw new Error('Failed to serialize schema to JSON');
    }

    // Build CREATE TABLE SQL with ID column
    const columnDefs = fullSchema
      .map((col, index) => {
        // First column is the auto-incrementing ID
        if (index === 0) {
          return 'id INTEGER PRIMARY KEY AUTOINCREMENT';
        }

        const parts = [`"${col.name}"`, col.type];
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

    // Execute in transaction
    const transaction = this.database.transaction(() => {
      // Create the data table
      this.database.exec(createTableSql);

      // Insert metadata (store full schema including ID column)
      const insertMetadata = this.database.prepare(`
        INSERT INTO user_tables (
          id, table_name, display_name, description, created_from_file,
          row_count, column_count, created_at, updated_at, schema_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      console.log('Storing schema JSON:', schemaJson);

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
        schemaJson // Use pre-validated JSON string
      );

      // Verify insertion
      const verify = this.database.prepare('SELECT schema_json FROM user_tables WHERE id = ?');
      const verifyResult = verify.get(id) as { schema_json: string } | undefined;
      console.log('Verification - schema_json stored as:', verifyResult?.schema_json);
    });

    transaction();

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
   * Delete a table and all its data
   */
  deleteTable(tableId: string): boolean {
    try {
      // Try to get table first
      const table = this.getTable(tableId);

      const transaction = this.database.transaction(() => {
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
      });

      transaction();
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
    const errors: string[] = [];

    // Filter out the ID column (first column) - SQLite will auto-generate it
    const dataColumns = table.schema.filter((col) => col.name !== 'id');

    // Prepare column names (excluding ID)
    const columnNames = dataColumns.map((col) => `"${col.name}"`).join(', ');
    const placeholders = dataColumns.map(() => '?').join(', ');

    const insertStmt = this.database.prepare(
      `INSERT INTO "${table.tableName}" (${columnNames}) VALUES (${placeholders})`
    );

    // Process rows in batches of 500
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const transaction = this.database.transaction(() => {
        for (const row of batch) {
          try {
            const values = dataColumns.map((col) => {
              const value = row[col.name];
              
              // Handle null/undefined/empty
              if (value === undefined || value === null || value === '') {
                // Allow null unless column is NOT NULL
                if (col.notNull) {
                  throw new Error(`Column "${col.name}" cannot be null`);
                }
                return null;
              }
              
              // Type conversions with validation
              if (col.type === 'INTEGER') {
                // Handle numeric strings with commas: "1,234" → 1234
                const cleanValue = String(value).replace(/,/g, '');
                const num = parseInt(cleanValue, 10);
                if (isNaN(num)) {
                  throw new Error(`Cannot convert "${value}" to INTEGER for column "${col.name}"`);
                }
                return num;
              }
              
              if (col.type === 'REAL') {
                // Handle numeric strings with commas: "1,234.56" → 1234.56
                const cleanValue = String(value).replace(/,/g, '');
                const num = parseFloat(cleanValue);
                if (isNaN(num)) {
                  throw new Error(`Cannot convert "${value}" to REAL for column "${col.name}"`);
                }
                return num;
              }
              
              // TEXT: convert everything to string
              // Handle dates by converting to ISO string if it's a Date object
              if (value instanceof Date) {
                return value.toISOString();
              }
              
              return String(value);
            });

            insertStmt.run(...values);
            inserted++;
          } catch (error) {
            skipped++;
            errors.push(
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      });

      transaction();
    }

    // Update row count
    this.updateRowCount(tableId);

    return { inserted, skipped, errors };
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
      throw new Error('Invalid SQL query');
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
}
