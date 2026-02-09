import Database from 'better-sqlite3';

// ============================================================================
// Types
// ============================================================================

export type DataType = 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATETIME';

export interface ColumnMapping {
  columnIndex: number;      // 1-based column position (A=1, B=2, etc.)
  sheetColumn: string;      // Current header text in sheet
  dbColumn: string;         // SQLite column name
  dataType: DataType;
  nullable: boolean;
  history: string[];        // Previous header names
}

export interface SchemaResolution {
  mapping: ColumnMapping;
  action: 'existing' | 'created' | 'renamed';
  previousName?: string;
}

export interface SchemaInference {
  dbColumn: string;
  dataType: DataType;
  reasoning: string;
}

export interface AIProvider {
  generateText: (prompt: string) => Promise<string>;
}

export interface DynamicSchemaManagerConfig {
  db: Database.Database;
  aiProvider?: AIProvider;
  enableAI?: boolean;
}

// ============================================================================
// Dynamic Schema Manager
// ============================================================================

export class DynamicSchemaManager {
  private db: Database.Database;
  private schemaCache: Map<string, Map<number, ColumnMapping>> = new Map();
  private aiProvider?: AIProvider;
  private enableAI: boolean;

  constructor(config: DynamicSchemaManagerConfig) {
    this.db = config.db;
    this.aiProvider = config.aiProvider;
    this.enableAI = config.enableAI ?? true;
    
    this.initMetaTables();
    this.loadSchemaCache();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private initMetaTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheet_name TEXT NOT NULL,
        table_name TEXT NOT NULL,
        column_index INTEGER NOT NULL,
        sheet_column TEXT NOT NULL,
        sheet_column_history TEXT DEFAULT '[]',
        db_column TEXT NOT NULL,
        data_type TEXT DEFAULT 'TEXT',
        nullable INTEGER DEFAULT 1,
        ai_inferred INTEGER DEFAULT 0,
        sample_values TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(sheet_name, column_index)
      );

      CREATE TABLE IF NOT EXISTS _sheet_tables (
        sheet_name TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        last_synced TEXT,
        row_id_column TEXT DEFAULT '_row_id',
        header_row INTEGER DEFAULT 1
      );
    `);
  }

  private loadSchemaCache(): void {
    const rows = this.db.prepare(`
      SELECT sheet_name, column_index, sheet_column, sheet_column_history,
             db_column, data_type, nullable 
      FROM _schema_registry
    `).all() as any[];

    for (const row of rows) {
      if (!this.schemaCache.has(row.sheet_name)) {
        this.schemaCache.set(row.sheet_name, new Map());
      }
      
      this.schemaCache.get(row.sheet_name)!.set(row.column_index, {
        columnIndex: row.column_index,
        sheetColumn: row.sheet_column,
        dbColumn: row.db_column,
        dataType: row.data_type as DataType,
        nullable: Boolean(row.nullable),
        history: JSON.parse(row.sheet_column_history || '[]')
      });
    }

    console.log(`[Schema] Loaded ${rows.length} column mappings into cache`);
  }

  // ==========================================================================
  // Main Entry: Resolve Column
  // ==========================================================================

  /**
   * Main entry point: resolve a column by POSITION
   * Detects: existing, new, or renamed
   */
  async resolveColumn(
    sheetName: string,
    columnIndex: number,
    currentHeader: string,
    sampleValue: any
  ): Promise<SchemaResolution> {
    const sheetCache = this.schemaCache.get(sheetName);
    const existingByIndex = sheetCache?.get(columnIndex);

    // Case 1: Known column at this position
    if (existingByIndex) {
      if (existingByIndex.sheetColumn !== currentHeader) {
        // Header changed — handle rename
        return await this.handleRename(sheetName, existingByIndex, currentHeader);
      }
      // Same header, same position — no changes needed
      return { mapping: existingByIndex, action: 'existing' };
    }

    // Case 2: New column at this position
    console.log(`[Schema] New column at index ${columnIndex}: "${currentHeader}"`);
    
    const tableName = await this.ensureTable(sheetName);
    const inference = await this.inferColumnSchema(sheetName, currentHeader, sampleValue);
    
    const dbColumn = await this.ensureUniqueDbColumn(tableName, inference.dbColumn);
    this.addColumn(tableName, dbColumn, inference.dataType);
    
    const mapping: ColumnMapping = {
      columnIndex,
      sheetColumn: currentHeader,
      dbColumn,
      dataType: inference.dataType,
      nullable: true,
      history: []
    };
    
    this.registerColumn(sheetName, tableName, mapping, true, sampleValue);
    
    return { mapping, action: 'created' };
  }

  // ==========================================================================
  // Rename Handling
  // ==========================================================================

  /**
   * Handle column rename: update header, optionally rename SQL column
   */
  private async handleRename(
    sheetName: string,
    existing: ColumnMapping,
    newHeader: string
  ): Promise<SchemaResolution> {
    const tableName = this.getTableName(sheetName)!;
    const oldHeader = existing.sheetColumn;
    
    console.log(`[Schema] Rename detected at index ${existing.columnIndex}: "${oldHeader}" → "${newHeader}"`);

    const shouldRenameDbColumn = await this.shouldRenameDbColumn(
      oldHeader, 
      newHeader, 
      existing.dbColumn
    );

    let newDbColumn = existing.dbColumn;
    
    if (shouldRenameDbColumn) {
      newDbColumn = this.normalizeColumnName(newHeader);
      newDbColumn = await this.ensureUniqueDbColumn(tableName, newDbColumn, existing.dbColumn);
      
      try {
        this.db.exec(`
          ALTER TABLE "${tableName}" 
          RENAME COLUMN "${existing.dbColumn}" TO "${newDbColumn}"
        `);
        console.log(`[Schema] Renamed SQL column: ${existing.dbColumn} → ${newDbColumn}`);
      } catch (error: any) {
        console.warn(`[Schema] RENAME COLUMN failed, keeping db column as "${existing.dbColumn}":`, error.message);
        newDbColumn = existing.dbColumn;
      }
    }

    // Update history
    const updatedHistory = [...existing.history, oldHeader];
    
    // Update registry
    this.db.prepare(`
      UPDATE _schema_registry 
      SET sheet_column = ?, 
          sheet_column_history = ?,
          db_column = ?,
          updated_at = datetime('now')
      WHERE sheet_name = ? AND column_index = ?
    `).run(
      newHeader,
      JSON.stringify(updatedHistory),
      newDbColumn,
      sheetName,
      existing.columnIndex
    );

    // Update cache
    const updatedMapping: ColumnMapping = {
      ...existing,
      sheetColumn: newHeader,
      dbColumn: newDbColumn,
      history: updatedHistory
    };
    
    this.schemaCache.get(sheetName)!.set(existing.columnIndex, updatedMapping);

    return {
      mapping: updatedMapping,
      action: 'renamed',
      previousName: oldHeader
    };
  }

  /**
   * AI decides if SQL column should also be renamed
   */
  private async shouldRenameDbColumn(
    oldHeader: string,
    newHeader: string,
    currentDbColumn: string
  ): Promise<boolean> {
    // Calculate string similarity first
    const similarity = this.stringSimilarity(oldHeader.toLowerCase(), newHeader.toLowerCase());
    
    // High similarity = likely typo fix → rename
    if (similarity > 0.7) {
      console.log(`[Schema] High similarity (${similarity.toFixed(2)}), renaming db column`);
      return true;
    }
    
    // If AI not available, default to keeping current column
    if (!this.enableAI || !this.aiProvider) {
      console.log(`[Schema] Low similarity (${similarity.toFixed(2)}), no AI, keeping db column`);
      return false;
    }

    // Ask AI
    const prompt = `A spreadsheet column was renamed. Should the database column also be renamed?

**Old header**: "${oldHeader}"
**New header**: "${newHeader}"
**Current DB column**: "${currentDbColumn}"

**Consider**:
- If it's a typo fix or clarification → YES, rename db column
- If it's a completely different concept → NO, this might be a mistake or the column is being repurposed
- If the new name better describes the data → YES

**Response (JSON only)**:
{"rename": true/false, "reason": "brief explanation"}`;

    try {
      const result = await this.aiProvider.generateText(prompt);
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleaned);
      
      console.log(`[Schema] AI rename decision: ${decision.rename} — ${decision.reason}`);
      return decision.rename;
    } catch (error) {
      console.error('[Schema] AI decision failed, defaulting to rename:', error);
      return true;
    }
  }

  // ==========================================================================
  // Schema Inference
  // ==========================================================================

  /**
   * AI-powered schema inference for new columns
   */
  private async inferColumnSchema(
    sheetName: string,
    sheetColumn: string,
    sampleValue: any
  ): Promise<SchemaInference> {
    // Fallback if no AI
    if (!this.enableAI || !this.aiProvider) {
      return {
        dbColumn: this.normalizeColumnName(sheetColumn),
        dataType: this.guessTypeFromValue(sampleValue),
        reasoning: 'Fallback: no AI available'
      };
    }

    // Build context from existing columns
    const existingColumns = this.schemaCache.get(sheetName);
    const existingContext = existingColumns 
      ? Array.from(existingColumns.values())
          .map(c => `${c.sheetColumn} → ${c.dbColumn} (${c.dataType})`)
          .join('\n')
      : 'No existing columns';

    const prompt = `You are a database schema designer. A new column appeared in a spreadsheet that needs to be added to SQLite.

**Sheet**: ${sheetName}
**New Column Header**: "${sheetColumn}"
**Sample Value**: ${JSON.stringify(sampleValue)}
**Sample Value Type**: ${typeof sampleValue}

**Existing columns in this table**:
${existingContext}

**Task**: Determine the appropriate SQLite column name and data type.

**Rules**:
1. Column name should be snake_case, lowercase, no spaces or special characters
2. Choose from these SQLite types: TEXT, INTEGER, REAL, BOOLEAN, DATETIME
3. If the column looks like a date/time, use DATETIME
4. If it looks like a number, use INTEGER or REAL
5. If it looks like true/false/yes/no, use BOOLEAN (stored as INTEGER 0/1)
6. When in doubt, use TEXT
7. Consider the existing columns for naming consistency

**Response format (JSON only, no markdown)**:
{"dbColumn": "column_name", "dataType": "TEXT", "reasoning": "brief explanation"}`;

    try {
      const result = await this.aiProvider.generateText(prompt);
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      const inference = JSON.parse(cleaned) as SchemaInference;
      
      // Validate dataType
      const validTypes: DataType[] = ['TEXT', 'INTEGER', 'REAL', 'BOOLEAN', 'DATETIME'];
      if (!validTypes.includes(inference.dataType)) {
        inference.dataType = 'TEXT';
      }
      
      console.log(`[Schema] AI inference: ${sheetColumn} → ${inference.dbColumn} (${inference.dataType})`);
      return inference;
    } catch (error) {
      console.error('[Schema] AI inference failed:', error);
      return {
        dbColumn: this.normalizeColumnName(sheetColumn),
        dataType: this.guessTypeFromValue(sampleValue),
        reasoning: 'Fallback after AI error'
      };
    }
  }

  // ==========================================================================
  // Table & Column Management
  // ==========================================================================

  /**
   * Ensure table exists for a sheet, create if not
   */
  private async ensureTable(sheetName: string): Promise<string> {
    const existing = this.db.prepare(
      'SELECT table_name FROM _sheet_tables WHERE sheet_name = ?'
    ).get(sheetName) as any;

    if (existing) return existing.table_name;

    const tableName = this.normalizeTableName(sheetName);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        _row_id INTEGER PRIMARY KEY,
        _synced_at TEXT DEFAULT (datetime('now')),
        _modified_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.prepare(
      'INSERT INTO _sheet_tables (sheet_name, table_name, row_id_column) VALUES (?, ?, ?)'
    ).run(sheetName, tableName, '_row_id');

    console.log(`[Schema] Created table: ${tableName}`);
    return tableName;
  }

  /**
   * Add a column to a table
   */
  private addColumn(tableName: string, columnName: string, dataType: DataType): void {
    const sqlType = this.toSqliteType(dataType);
    
    try {
      this.db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${sqlType}`);
      console.log(`[Schema] Added column: ${tableName}.${columnName} (${sqlType})`);
    } catch (error: any) {
      if (error.message.includes('duplicate column')) {
        console.log(`[Schema] Column already exists: ${tableName}.${columnName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Register a column mapping in the schema registry
   */
  private registerColumn(
    sheetName: string, 
    tableName: string, 
    mapping: ColumnMapping, 
    aiInferred: boolean,
    sampleValue: any
  ): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO _schema_registry 
      (sheet_name, table_name, column_index, sheet_column, db_column, 
       data_type, nullable, ai_inferred, sample_values)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sheetName, 
      tableName, 
      mapping.columnIndex,
      mapping.sheetColumn, 
      mapping.dbColumn, 
      mapping.dataType, 
      mapping.nullable ? 1 : 0,
      aiInferred ? 1 : 0,
      JSON.stringify([sampleValue])
    );

    // Update cache
    if (!this.schemaCache.has(sheetName)) {
      this.schemaCache.set(sheetName, new Map());
    }
    this.schemaCache.get(sheetName)!.set(mapping.columnIndex, mapping);
  }

  /**
   * Ensure the db column name is unique within the table
   */
  private async ensureUniqueDbColumn(
    tableName: string, 
    desiredName: string,
    excludeColumn?: string
  ): Promise<string> {
    const existingColumns = this.getTableColumns(tableName)
      .filter(c => c !== excludeColumn);
    
    if (!existingColumns.includes(desiredName)) {
      return desiredName;
    }

    let counter = 2;
    let candidate = `${desiredName}_${counter}`;
    while (existingColumns.includes(candidate)) {
      counter++;
      candidate = `${desiredName}_${counter}`;
    }
    
    console.log(`[Schema] Column name collision, using: ${candidate}`);
    return candidate;
  }

  /**
   * Get all column names for a table
   */
  private getTableColumns(tableName: string): string[] {
    try {
      const result = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
      return result.map(r => r.name);
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /**
   * Get the SQLite table name for a sheet
   */
  getTableName(sheetName: string): string | null {
    const row = this.db.prepare(
      'SELECT table_name FROM _sheet_tables WHERE sheet_name = ?'
    ).get(sheetName) as any;
    return row?.table_name || null;
  }

  /**
   * Get column mappings for a sheet (from cache)
   */
  getColumnMappings(sheetName: string): Map<number, ColumnMapping> {
    return this.schemaCache.get(sheetName) || new Map();
  }

  /**
   * Get a specific column mapping by index
   */
  getColumnByIndex(sheetName: string, columnIndex: number): ColumnMapping | null {
    return this.schemaCache.get(sheetName)?.get(columnIndex) || null;
  }

  /**
   * Get a column mapping by db column name
   */
  getColumnByDbName(sheetName: string, dbColumn: string): ColumnMapping | null {
    const mappings = this.schemaCache.get(sheetName);
    if (!mappings) return null;
    
    for (const mapping of mappings.values()) {
      if (mapping.dbColumn === dbColumn) {
        return mapping;
      }
    }
    return null;
  }

  /**
   * Get all tracked sheets
   */
  getTrackedSheets(): Array<{ sheetName: string; tableName: string }> {
    return this.db.prepare(`
      SELECT sheet_name, table_name FROM _sheet_tables
    `).all() as any[];
  }

  /**
   * Refresh the schema cache from database
   */
  refreshCache(): void {
    this.schemaCache.clear();
    this.loadSchemaCache();
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private normalizeTableName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_가-힣]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 63) || 'table';
  }

  private normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_가-힣]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 63) || 'column';
  }

  private guessTypeFromValue(value: any): DataType {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    }
    if (typeof value === 'string') {
      // Check for date patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'DATETIME';
      // Check for integer
      if (/^-?\d+$/.test(value)) return 'INTEGER';
      // Check for float
      if (/^-?\d+\.\d+$/.test(value)) return 'REAL';
      // Check for boolean strings
      if (/^(true|false|yes|no)$/i.test(value)) return 'BOOLEAN';
    }
    return 'TEXT';
  }

  private toSqliteType(dataType: DataType): string {
    switch (dataType) {
      case 'INTEGER': return 'INTEGER';
      case 'REAL': return 'REAL';
      case 'BOOLEAN': return 'INTEGER';  // SQLite stores booleans as 0/1
      case 'DATETIME': return 'TEXT';    // SQLite stores dates as ISO strings
      default: return 'TEXT';
    }
  }

  /**
   * Calculate string similarity using bigram comparison (Dice coefficient)
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const getBigrams = (s: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const aBigrams = getBigrams(a);
    const bBigrams = getBigrams(b);
    
    let intersection = 0;
    for (const bigram of aBigrams) {
      if (bBigrams.has(bigram)) intersection++;
    }

    return (2 * intersection) / (aBigrams.size + bBigrams.size);
  }
}

// ============================================================================
// Gemini AI Provider Implementation
// ============================================================================

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export function createGeminiProvider(config: GeminiConfig): AIProvider {
  const model = config.model || 'gemini-2.5-flash';
  const temperature = config.temperature ?? 0.1;

  return {
    async generateText(prompt: string): Promise<string> {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: 1024
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No text in Gemini response');
      }

      return text;
    }
  };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSchemaManager(
  db: Database.Database,
  options: {
    geminiApiKey?: string;
    enableAI?: boolean;
  } = {}
): DynamicSchemaManager {
  let aiProvider: AIProvider | undefined;

  if (options.geminiApiKey && options.enableAI !== false) {
    aiProvider = createGeminiProvider({ apiKey: options.geminiApiKey });
  }

  return new DynamicSchemaManager({
    db,
    aiProvider,
    enableAI: options.enableAI ?? !!options.geminiApiKey
  });
}