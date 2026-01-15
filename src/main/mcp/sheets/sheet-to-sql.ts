import Database from 'better-sqlite3';
import { SheetsService } from './sheets-service';

/**
 * Simple sheet-to-SQL importer
 * Pulls data from Google Sheets and stores in SQLite with flexible schema
 */
export class SheetToSQLImporter {
  private db: Database.Database;
  private sheetsService: SheetsService;

  constructor(db: Database.Database) {
    this.db = db;
    this.sheetsService = new SheetsService();
  }

  /**
   * Import a specific sheet from a Google Sheets file into SQLite
   * 
   * @param spreadsheetId Google Sheets file ID
   * @param sheetName Name of the sheet to import (optional, imports all if not specified)
   * @returns Array of table names created
   */
  async importSheet(
    spreadsheetId: string, 
    sheetName?: string
  ): Promise<string[]> {
    try {
      // Get spreadsheet metadata
      const metadata = await this.sheetsService.getSpreadsheet(spreadsheetId);
      
      // Determine which sheets to import
      const sheetsToImport = sheetName 
        ? metadata.sheets.filter(s => s.title === sheetName)
        : metadata.sheets;
      
      if (sheetsToImport.length === 0) {
        throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
      }

      const createdTables: string[] = [];

      console.log(`[SheetToSQL] Found ${sheetsToImport.length} sheets to import:`, sheetsToImport.map(s => s.title));

      // Import each sheet
      for (const sheet of sheetsToImport) {
        console.log(`[SheetToSQL] Importing sheet: ${sheet.title}`);

        // Get all data from the sheet
        const range = `${sheet.title}!A:ZZ`; // Get all columns up to ZZ
        const rangeData = await this.sheetsService.getRange(spreadsheetId, range);

        if (!rangeData.values || rangeData.values.length === 0) {
          console.log(`[SheetToSQL] Sheet "${sheet.title}" is empty, skipping`);
          continue;
        }

        // Create table and import data
        const tableName = this.createTableForSheet(
          spreadsheetId,
          sheet.title,
          rangeData.values
        );

        console.log(`[SheetToSQL] Successfully created table: ${tableName}`);
        createdTables.push(tableName);
      }

      console.log(`[SheetToSQL] Import complete. Created ${createdTables.length} tables:`, createdTables);
      return createdTables;
    } catch (error) {
      console.error('[SheetToSQL] Import failed:', error);
      throw error;
    }
  }

  /**
   * Create a table for sheet data and insert all rows
   */
  private createTableForSheet(
    spreadsheetId: string,
    sheetName: string,
    values: string[][]
  ): string {
    if (values.length < 2) {
      throw new Error('Sheet must have at least headers and one data row');
    }

    // First row is headers
    const headers = values[0];
    const dataRows = values.slice(1);

    // Debug logging
    console.log(`[SheetToSQL] Raw headers:`, JSON.stringify(headers));
    console.log(`[SheetToSQL] Number of headers:`, headers.length);
    console.log(`[SheetToSQL] First few headers:`, headers.slice(0, 5));
    if (dataRows.length > 0) {
      console.log(`[SheetToSQL] First data row:`, JSON.stringify(dataRows[0]));
    }

    // Generate table name
    const tableName = this.generateTableName(spreadsheetId, sheetName);

    // Generate column definitions
    const columns = this.generateColumns(headers);
    
    console.log(`[SheetToSQL] Generated columns:`, columns.map(c => `${c.name} -> ${c.sqlName}`));

    // Create table
    this.createTable(tableName, columns);

    // Insert data
    this.insertData(tableName, columns, dataRows);

    console.log(`[SheetToSQL] Created table "${tableName}" with ${dataRows.length} rows`);
    return tableName;
  }

  /**
   * Generate table name from sheet ID and name
   */
  private generateTableName(spreadsheetId: string, sheetName: string): string {
    // Clean the sheet name for SQL
    let cleanSheetName = sheetName
      .replace(/[^a-zA-Z0-9_가-힣]/g, '_')  // Keep Korean characters
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // If sheet name becomes empty after cleaning, use a hash of the original name
    if (!cleanSheetName) {
      // Create a deterministic hash from the sheet name
      // This ensures same sheet name always creates same table name
      let hash = 0;
      for (let i = 0; i < sheetName.length; i++) {
        const char = sheetName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      cleanSheetName = `sheet${Math.abs(hash).toString(36)}`;
      console.log(`[SheetToSQL] Sheet name "${sheetName}" cleaned to empty, using hash: ${cleanSheetName}`);
    }

    // Use first 8 chars of spreadsheet ID for uniqueness
    const shortId = spreadsheetId.substring(0, 8);

    const finalName = `sheet_${shortId}_${cleanSheetName}`;
    console.log(`[SheetToSQL] Generated table name: "${sheetName}" → "${finalName}"`);

    return finalName;
  }

  /**
   * Generate column definitions from headers
   */
  private generateColumns(headers: string[]): Array<{name: string, sqlName: string}> {
    const columns: Array<{name: string, sqlName: string}> = [];
    const usedNames = new Set<string>();

    headers.forEach((header, index) => {
      // If header is empty or undefined, use a default name
      const headerValue = header || `Column ${index + 1}`;
      
      // Generate SQL-safe column name
      let sqlName = headerValue
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      // If sqlName is empty after cleaning, use default
      if (!sqlName) {
        sqlName = `col_${index + 1}`;
      }

      // Ensure uniqueness
      let counter = 1;
      let uniqueName = sqlName;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${sqlName}_${counter}`;
        counter++;
      }
      usedNames.add(uniqueName);

      columns.push({
        name: headerValue,
        sqlName: uniqueName
      });
    });

    return columns;
  }

  /**
   * Create the table in SQLite
   */
  private createTable(tableName: string, columns: Array<{name: string, sqlName: string}>): void {
    // Drop table if exists (for reimport)
    this.db.prepare(`DROP TABLE IF EXISTS "${tableName}"`).run();
    this.db.prepare(`DROP TABLE IF EXISTS "${tableName}_headers"`).run();

    // Build column definitions (all nullable TEXT for flexibility)
    const columnDefs = [
      '_row_id INTEGER PRIMARY KEY',
      '_imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ...columns.map(col => `"${col.sqlName}" TEXT`)
    ].join(',\n    ');

    // Create table
    const createSQL = `
      CREATE TABLE "${tableName}" (
        ${columnDefs}
      )
    `;

    this.db.prepare(createSQL).run();

    // Create headers mapping table
    const createHeadersSQL = `
      CREATE TABLE "${tableName}_headers" (
        column_index INTEGER PRIMARY KEY,
        sql_name TEXT NOT NULL,
        original_name TEXT NOT NULL
      )
    `;

    this.db.prepare(createHeadersSQL).run();

    // Insert header mappings
    const insertHeader = this.db.prepare(`
      INSERT INTO "${tableName}_headers" (column_index, sql_name, original_name)
      VALUES (?, ?, ?)
    `);

    columns.forEach((col, index) => {
      insertHeader.run(index, col.sqlName, col.name);
    });

    console.log(`[SheetToSQL] Created table structure for "${tableName}" with headers mapping`);
  }

  /**
   * Insert data into the table
   */
  private insertData(
    tableName: string, 
    columns: Array<{name: string, sqlName: string}>,
    dataRows: string[][]
  ): void {
    if (dataRows.length === 0) return;

    // Prepare insert statement
    const columnNames = columns.map(c => `"${c.sqlName}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    
    const insertSQL = `
      INSERT INTO "${tableName}" (_row_id, ${columnNames})
      VALUES (?, ${placeholders})
    `;

    const stmt = this.db.prepare(insertSQL);

    // Insert each row
    const insertMany = this.db.transaction((rows: string[][]) => {
      rows.forEach((row, index) => {
        // Pad row to match column count
        const values = columns.map((_, colIndex) => row[colIndex] || null);
        
        // Row ID is 1-based (row 2 in sheet = row 1 in data)
        stmt.run(index + 2, ...values);
      });
    });

    insertMany(dataRows);
    console.log(`[SheetToSQL] Inserted ${dataRows.length} rows`);
  }

  /**
   * Get original column headers for a table
   */
  getOriginalHeaders(tableName: string): Array<{
    columnIndex: number;
    sqlName: string;
    originalName: string;
  }> {
    return this.db.prepare(`
      SELECT column_index, sql_name, original_name
      FROM "${tableName}_headers"
      ORDER BY column_index
    `).all() as Array<{
      columnIndex: number;
      sqlName: string;
      originalName: string;
    }>;
  }

  /**
   * Get import summary for a spreadsheet
   */
  async getImportedTables(spreadsheetId: string): Promise<Array<{
    tableName: string;
    rowCount: number;
    columnCount: number;
    lastImported: string;
  }>> {
    const prefix = `sheet_${spreadsheetId.substring(0, 8)}_`;

    console.log('[SheetToSQL:getImportedTables] Searching for tables with prefix:', prefix);

    // Use prefix matching instead of pattern matching to catch tables ending with underscore
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      AND name LIKE ? || '%'
      AND name NOT LIKE '%_headers'
    `).all(prefix) as Array<{name: string}>;

    console.log('[SheetToSQL:getImportedTables] Found', tables.length, 'tables:', tables.map(t => t.name));

    const result = [];
    for (const table of tables) {
      const count = this.db.prepare(
        `SELECT COUNT(*) as count FROM "${table.name}"`
      ).get() as {count: number};

      const columnInfo = this.db.prepare(
        `PRAGMA table_info("${table.name}")`
      ).all() as Array<{name: string}>;

      const lastImport = this.db.prepare(
        `SELECT MAX(_imported_at) as last FROM "${table.name}"`
      ).get() as {last: string};

      const tableInfo = {
        tableName: table.name,
        rowCount: count.count,
        columnCount: columnInfo.length - 2, // Exclude _row_id and _imported_at
        lastImported: lastImport.last || 'Never'
      };

      console.log('[SheetToSQL:getImportedTables] Table info:', tableInfo);
      result.push(tableInfo);
    }

    console.log('[SheetToSQL:getImportedTables] Returning', result.length, 'tables');
    return result;
  }
}

// Export a factory function
export function createSheetToSQLImporter(db: Database.Database): SheetToSQLImporter {
  return new SheetToSQLImporter(db);
}