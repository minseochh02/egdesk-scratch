# Sheet-to-SQLite Sync System

A bidirectional sync system between Google Sheets and SQLite with AI-mediated dynamic schema management.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Google Sheet   │         │  FastAPI Tunnel  │         │     EGDesk      │
│                 │         │    (Render)      │         │    (SQLite)     │
│  ┌───────────┐  │         │                  │         │                 │
│  │ Data Tabs │  │ ──────► │  POST /changes   │ ──────► │  Schema Manager │
│  └───────────┘  │ onEdit  │                  │ webhook │        │        │
│  ┌───────────┐  │         │                  │         │        ▼        │
│  │_changelog │  │ ◄────── │  GET /sync       │ ◄────── │  Apply to DB    │
│  └───────────┘  │  poll   │                  │  asks   │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Key Principles

1. **SQLite is source of truth** — conflicts resolve in favor of SQLite
2. **Change detection via changelog** — no continuous polling of entire sheet
3. **Position-based column tracking** — renames detected, data preserved
4. **AI only for schema changes** — not invoked on regular data edits

---

## Database Schema

### Meta Tables

```sql
-- Stores the mapping between sheets and SQLite columns
CREATE TABLE IF NOT EXISTS _schema_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  
  -- Track by POSITION, not just name
  column_index INTEGER NOT NULL,        -- 1-based column position (A=1, B=2, etc.)
  sheet_column TEXT NOT NULL,           -- Current header text
  sheet_column_history TEXT DEFAULT '[]', -- JSON array of previous names
  
  db_column TEXT NOT NULL,
  data_type TEXT DEFAULT 'TEXT',        -- TEXT, INTEGER, REAL, BOOLEAN, DATETIME
  nullable INTEGER DEFAULT 1,
  ai_inferred INTEGER DEFAULT 0,
  sample_values TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(sheet_name, column_index)      -- Position is the true identifier
);

-- Track which sheets we know about
CREATE TABLE IF NOT EXISTS _sheet_tables (
  sheet_name TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  last_synced TEXT,
  row_id_column TEXT DEFAULT '_row_id',
  header_row INTEGER DEFAULT 1
);
```

---

## Google Apps Script

Add this to your Google Sheet (Extensions → Apps Script):

```javascript
/**
 * Installable trigger: runs on every edit
 * Set up via: Triggers → Add Trigger → onSheetEdit → On edit
 */
function onSheetEdit(e) {
  const ignoredSheets = ['_changelog', '_config'];
  const sheetName = e.source.getActiveSheet().getName();
  
  if (ignoredSheets.includes(sheetName)) return;
  
  const change = {
    id: Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    sheet: sheetName,
    row: e.range.getRow(),
    col: e.range.getColumn(),
    oldValue: e.oldValue || null,
    newValue: e.value || null,
    synced: false
  };
  
  // Append to changelog
  appendToChangelog(change);
  
  // If realtime mode, push immediately
  const mode = PropertiesService.getScriptProperties().getProperty('SYNC_MODE');
  if (mode === 'realtime') {
    pushToTunnel([change]);
  }
}

/**
 * Append a change record to the _changelog sheet
 */
function appendToChangelog(change) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cl = ss.getSheetByName('_changelog');
  
  if (!cl) {
    cl = ss.insertSheet('_changelog');
    cl.appendRow(['id', 'timestamp', 'sheet', 'row', 'col', 'oldValue', 'newValue', 'synced']);
    cl.hideSheet(); // Optional: hide from users
  }
  
  cl.appendRow([
    change.id, 
    change.timestamp, 
    change.sheet, 
    change.row, 
    change.col, 
    change.oldValue, 
    change.newValue, 
    false
  ]);
}

/**
 * Push changes to the tunnel endpoint (for realtime mode)
 */
function pushToTunnel(changes) {
  const tunnelUrl = PropertiesService.getScriptProperties().getProperty('TUNNEL_URL');
  if (!tunnelUrl) return;
  
  try {
    UrlFetchApp.fetch(tunnelUrl + '/sheet-changes', {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ changes }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('Push failed:', err);
  }
}

/**
 * Called by Electron to register its tunnel URL
 */
function setTunnelUrl(url) {
  PropertiesService.getScriptProperties().setProperty('TUNNEL_URL', url);
  return { success: true, url };
}

/**
 * Called by Electron to set sync mode: 'realtime' | 'periodic' | 'manual'
 */
function setSyncMode(mode) {
  PropertiesService.getScriptProperties().setProperty('SYNC_MODE', mode);
  return { success: true, mode };
}

/**
 * Called by Electron to pull unsynced changes
 */
function getUnsynced() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName('_changelog');
  if (!cl) return [];
  
  const data = cl.getDataRange().getValues();
  const unsyncedRows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === false) { // synced column
      unsyncedRows.push({
        rowIndex: i + 1,
        id: data[i][0],
        timestamp: data[i][1],
        sheet: data[i][2],
        row: data[i][3],
        col: data[i][4],
        oldValue: data[i][5],
        newValue: data[i][6]
      });
    }
  }
  return unsyncedRows;
}

/**
 * Mark changes as synced after Electron processes them
 */
function markSynced(ids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName('_changelog');
  if (!cl) return { success: false };
  
  const data = cl.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (ids.includes(data[i][0])) {
      cl.getRange(i + 1, 8).setValue(true);
    }
  }
  return { success: true, count: ids.length };
}

/**
 * Get column headers for a sheet (needed for schema resolution)
 */
function getColumnHeaders(sheetName, headerRow = 1) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  return headers.map((h, i) => ({
    index: i + 1,
    header: h || `Column_${i + 1}`
  }));
}

/**
 * Cleanup old synced entries (optional maintenance)
 */
function cleanupChangelog(daysToKeep = 7) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName('_changelog');
  if (!cl) return;
  
  const data = cl.getDataRange().getValues();
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const timestamp = new Date(data[i][1]);
    const synced = data[i][7];
    
    if (synced && timestamp < cutoff) {
      rowsToDelete.push(i + 1);
    }
  }
  
  // Delete from bottom up to preserve row indices
  for (const row of rowsToDelete) {
    cl.deleteRow(row);
  }
  
  return { deleted: rowsToDelete.length };
}

// ============================================================
// SYNC TRIGGER WRAPPER
// Wrap any function that modifies data to auto-trigger sync
// ============================================================

/**
 * Wrapper that tracks changes made by any function
 * Use this for programmatic updates, imports, bulk operations, etc.
 */
function withSyncTracking(fn) {
  return function(...args) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Snapshot before
    const beforeState = captureSheetState(ss);
    
    // Execute the function
    const result = fn.apply(this, args);
    
    // Snapshot after
    const afterState = captureSheetState(ss);
    
    // Diff and log changes
    const changes = diffSheetStates(beforeState, afterState);
    
    if (changes.length > 0) {
      for (const change of changes) {
        appendToChangelog(change);
      }
      
      // If realtime mode, push immediately
      const mode = PropertiesService.getScriptProperties().getProperty('SYNC_MODE');
      if (mode === 'realtime') {
        pushToTunnel(changes);
      }
      
      console.log(`[Sync] Tracked ${changes.length} changes from function execution`);
    }
    
    return result;
  };
}

/**
 * Capture current state of all data sheets
 */
function captureSheetState(ss) {
  const state = {};
  const ignoredSheets = ['_changelog', '_config'];
  
  for (const sheet of ss.getSheets()) {
    const name = sheet.getName();
    if (ignoredSheets.includes(name)) continue;
    
    const data = sheet.getDataRange().getValues();
    state[name] = data;
  }
  
  return state;
}

/**
 * Diff two sheet states and return changes
 */
function diffSheetStates(before, after) {
  const changes = [];
  const timestamp = new Date().toISOString();
  
  // Check all sheets in after state
  for (const sheetName of Object.keys(after)) {
    const beforeData = before[sheetName] || [];
    const afterData = after[sheetName];
    
    const maxRows = Math.max(beforeData.length, afterData.length);
    const maxCols = Math.max(
      beforeData[0]?.length || 0,
      afterData[0]?.length || 0
    );
    
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < maxCols; col++) {
        const oldVal = beforeData[row]?.[col];
        const newVal = afterData[row]?.[col];
        
        if (oldVal !== newVal) {
          changes.push({
            id: Utilities.getUuid(),
            timestamp: timestamp,
            sheet: sheetName,
            row: row + 1,  // 1-indexed
            col: col + 1,  // 1-indexed
            oldValue: oldVal || null,
            newValue: newVal || null,
            synced: false
          });
        }
      }
    }
  }
  
  return changes;
}

/**
 * Example: Wrap your custom functions like this
 */
const importDataFromAPI = withSyncTracking(function(apiUrl) {
  const response = UrlFetchApp.fetch(apiUrl);
  const data = JSON.parse(response.getContentText());
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Imports');
  // ... process and write data
});

const bulkUpdatePrices = withSyncTracking(function(priceData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
  // ... update prices
});

/**
 * Alternative: Manual sync trigger after any operation
 * Call this at the end of any function that modifies data
 */
function triggerSyncCheck() {
  const mode = PropertiesService.getScriptProperties().getProperty('SYNC_MODE');
  
  if (mode === 'realtime') {
    // Get recent unsynced and push
    const unsynced = getUnsynced();
    if (unsynced.length > 0) {
      pushToTunnel(unsynced);
    }
  }
  
  return { triggered: true, mode: mode };
}

/**
 * Decorator-style helper for existing functions
 * Usage: myFunction = tracked(myFunction);
 */
function tracked(fn, fnName) {
  return function(...args) {
    console.log(`[Sync] Starting tracked function: ${fnName || fn.name}`);
    const result = withSyncTracking(fn).apply(this, args);
    console.log(`[Sync] Completed tracked function: ${fnName || fn.name}`);
    return result;
  };
}
```

---

## Electron: Dynamic Schema Manager

```typescript
import Database from 'better-sqlite3';
import { generateTextWithAI, getGoogleApiKey } from './gemini';

interface ColumnMapping {
  columnIndex: number;
  sheetColumn: string;
  dbColumn: string;
  dataType: 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATETIME';
  nullable: boolean;
  history: string[];
}

interface SchemaResolution {
  mapping: ColumnMapping;
  action: 'existing' | 'created' | 'renamed';
  previousName?: string;
}

interface SchemaInference {
  dbColumn: string;
  dataType: 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATETIME';
  reasoning: string;
}

export class DynamicSchemaManager {
  private db: Database.Database;
  private schemaCache: Map<string, Map<number, ColumnMapping>> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initMetaTables();
    this.loadSchemaCache();
  }

  private initMetaTables() {
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

  private loadSchemaCache() {
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
        dataType: row.data_type,
        nullable: Boolean(row.nullable),
        history: JSON.parse(row.sheet_column_history || '[]')
      });
    }
  }

  /**
   * Main entry: resolve column by POSITION
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
        return await this.handleRename(sheetName, existingByIndex, currentHeader);
      }
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

    const updatedHistory = [...existing.history, oldHeader];
    
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
    const { apiKey } = getGoogleApiKey();
    
    const similarity = this.stringSimilarity(oldHeader.toLowerCase(), newHeader.toLowerCase());
    
    if (similarity > 0.7) {
      return true;
    }
    
    if (!apiKey) {
      console.log(`[Schema] Low similarity (${similarity.toFixed(2)}), no AI, keeping db column`);
      return false;
    }

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
      const result = await generateTextWithAI({
        prompt,
        model: 'gemini-2.5-flash-lite',
        temperature: 0.1,
        apiKey
      });

      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const decision = JSON.parse(cleaned);
      
      console.log(`[Schema] AI rename decision: ${decision.rename} — ${decision.reason}`);
      return decision.rename;
    } catch (error) {
      console.error('[Schema] AI decision failed, defaulting to rename:', error);
      return true;
    }
  }

  /**
   * AI-powered schema inference for new columns
   */
  private async inferColumnSchema(
    sheetName: string,
    sheetColumn: string,
    sampleValue: any
  ): Promise<SchemaInference> {
    const { apiKey } = getGoogleApiKey();
    
    if (!apiKey) {
      return {
        dbColumn: this.normalizeColumnName(sheetColumn),
        dataType: this.guessTypeFromValue(sampleValue),
        reasoning: 'Fallback: no AI available'
      };
    }

    const existingColumns = this.schemaCache.get(sheetName);
    const existingContext = existingColumns 
      ? Array.from(existingColumns.values()).map(c => `${c.sheetColumn} → ${c.dbColumn} (${c.dataType})`).join('\n')
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
      const result = await generateTextWithAI({
        prompt,
        model: 'gemini-2.5-flash-lite',
        temperature: 0.1,
        apiKey
      });

      const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
      const inference = JSON.parse(cleaned) as SchemaInference;
      
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

  private addColumn(tableName: string, columnName: string, dataType: string) {
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

  private registerColumn(
    sheetName: string, 
    tableName: string, 
    mapping: ColumnMapping, 
    aiInferred: boolean,
    sampleValue: any
  ) {
    this.db.prepare(`
      INSERT OR REPLACE INTO _schema_registry 
      (sheet_name, table_name, column_index, sheet_column, db_column, data_type, nullable, ai_inferred, sample_values)
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

    if (!this.schemaCache.has(sheetName)) {
      this.schemaCache.set(sheetName, new Map());
    }
    this.schemaCache.get(sheetName)!.set(mapping.columnIndex, mapping);
  }

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
    
    return candidate;
  }

  private getTableColumns(tableName: string): string[] {
    const result = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
    return result.map(r => r.name);
  }

  getTableName(sheetName: string): string | null {
    const row = this.db.prepare(
      'SELECT table_name FROM _sheet_tables WHERE sheet_name = ?'
    ).get(sheetName) as any;
    return row?.table_name || null;
  }

  getColumnMappings(sheetName: string): Map<number, ColumnMapping> {
    return this.schemaCache.get(sheetName) || new Map();
  }

  // --- Utility Methods ---

  private normalizeTableName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_가-힣]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 63);
  }

  private normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_가-힣]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 63);
  }

  private guessTypeFromValue(value: any): 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATETIME' {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'INTEGER' : 'REAL';
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'DATETIME';
      if (/^-?\d+$/.test(value)) return 'INTEGER';
      if (/^-?\d+\.\d+$/.test(value)) return 'REAL';
      if (/^(true|false|yes|no)$/i.test(value)) return 'BOOLEAN';
    }
    return 'TEXT';
  }

  private toSqliteType(dataType: string): string {
    switch (dataType) {
      case 'INTEGER': return 'INTEGER';
      case 'REAL': return 'REAL';
      case 'BOOLEAN': return 'INTEGER';
      case 'DATETIME': return 'TEXT';
      default: return 'TEXT';
    }
  }

  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const getBigrams = (s: string) => {
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
```

---

## Electron: Sync Controller

```typescript
type SyncMode = 'realtime' | 'periodic' | 'manual';

interface SheetChange {
  id: string;
  timestamp: string;
  sheet: string;
  row: number;
  col: number;
  oldValue: any;
  newValue: any;
}

interface SyncResult {
  applied: number;
  conflicts: number;
  newColumns: number;
  renamedColumns: number;
}

export class SheetSyncController {
  private mode: SyncMode = 'manual';
  private intervalId?: NodeJS.Timeout;
  private spreadsheetId: string;
  private tunnelUrl: string;
  private db: Database.Database;
  private schemaManager: DynamicSchemaManager;
  private headerCache: Map<string, Map<number, string>> = new Map();

  constructor(
    db: Database.Database,
    spreadsheetId: string, 
    tunnelUrl: string
  ) {
    this.db = db;
    this.spreadsheetId = spreadsheetId;
    this.tunnelUrl = tunnelUrl;
    this.schemaManager = new DynamicSchemaManager(db);
  }

  /**
   * Set sync mode and configure accordingly
   */
  async setMode(mode: SyncMode) {
    this.mode = mode;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    await this.callAppsScript('setSyncMode', [mode]);
    await this.callAppsScript('setTunnelUrl', [this.tunnelUrl]);
    
    if (mode === 'periodic') {
      this.intervalId = setInterval(() => this.sync(), 60_000);
    }
    
    console.log(`[Sync] Mode set to: ${mode}`);
  }

  /**
   * Single unified sync method — works for all modes
   */
  async sync(): Promise<SyncResult> {
    console.log(`[Sync] Starting sync (mode: ${this.mode})`);
    
    const changes = await this.pullChanges();
    
    if (changes.length === 0) {
      console.log('[Sync] No changes to process');
      return { applied: 0, conflicts: 0, newColumns: 0, renamedColumns: 0 };
    }

    console.log(`[Sync] Processing ${changes.length} changes`);
    const result = await this.applyChanges(changes);
    
    const syncedIds = changes.map(c => c.id);
    await this.callAppsScript('markSynced', [syncedIds]);
    
    console.log(`[Sync] Complete:`, result);
    return result;
  }

  /**
   * Apply changes from sheet to SQLite
   */
  async applyChanges(changes: SheetChange[]): Promise<SyncResult> {
    let applied = 0;
    let conflicts = 0;
    let newColumns = 0;
    let renamedColumns = 0;

    // Group changes by sheet for header fetching efficiency
    const changesBySheet = new Map<string, SheetChange[]>();
    for (const change of changes) {
      if (!changesBySheet.has(change.sheet)) {
        changesBySheet.set(change.sheet, []);
      }
      changesBySheet.get(change.sheet)!.push(change);
    }

    // Process each sheet's changes
    for (const [sheetName, sheetChanges] of changesBySheet) {
      // Fetch headers for this sheet
      await this.refreshHeaderCache(sheetName);
      
      for (const change of sheetChanges) {
        const columnHeader = this.getColumnHeader(sheetName, change.col);
        if (!columnHeader) {
          console.warn(`[Sync] No header for ${sheetName}:${change.col}`);
          continue;
        }

        // Resolve column (may trigger AI for new/renamed)
        const resolution = await this.schemaManager.resolveColumn(
          sheetName,
          change.col,
          columnHeader,
          change.newValue
        );

        if (resolution.action === 'created') newColumns++;
        if (resolution.action === 'renamed') renamedColumns++;

        const tableName = this.schemaManager.getTableName(sheetName);
        if (!tableName) continue;

        // Ensure row exists
        await this.ensureRow(tableName, change.row);

        // Check for conflicts (SQLite newer = SQLite wins)
        const sqliteModified = await this.getRowModifiedTime(tableName, change.row);
        if (sqliteModified && new Date(sqliteModified) > new Date(change.timestamp)) {
          conflicts++;
          console.log(`[Sync] Conflict at ${sheetName}:${change.row}:${change.col} — SQLite wins`);
          continue;
        }

        // Apply the change
        const typedValue = this.castValue(change.newValue, resolution.mapping.dataType);
        
        this.db.prepare(`
          UPDATE "${tableName}" 
          SET "${resolution.mapping.dbColumn}" = ?, _modified_at = datetime('now')
          WHERE _row_id = ?
        `).run(typedValue, change.row);

        applied++;
      }
    }

    return { applied, conflicts, newColumns, renamedColumns };
  }

  /**
   * Receive changes pushed in realtime mode (called by FastAPI)
   */
  async receiveRealtimeChanges(changes: SheetChange[]): Promise<SyncResult> {
    if (this.mode !== 'realtime') {
      console.warn('[Sync] Received realtime changes but not in realtime mode');
    }
    return this.applyChanges(changes);
  }

  // --- Private Helpers ---

  private async pullChanges(): Promise<SheetChange[]> {
    const result = await this.callAppsScript('getUnsynced', []);
    return result || [];
  }

  private async refreshHeaderCache(sheetName: string) {
    const headers = await this.callAppsScript('getColumnHeaders', [sheetName]);
    const headerMap = new Map<number, string>();
    
    for (const h of headers || []) {
      headerMap.set(h.index, h.header);
    }
    
    this.headerCache.set(sheetName, headerMap);
  }

  private getColumnHeader(sheetName: string, colIndex: number): string | null {
    return this.headerCache.get(sheetName)?.get(colIndex) || null;
  }

  private async ensureRow(tableName: string, rowId: number) {
    const exists = this.db.prepare(
      `SELECT 1 FROM "${tableName}" WHERE _row_id = ?`
    ).get(rowId);
    
    if (!exists) {
      this.db.prepare(
        `INSERT INTO "${tableName}" (_row_id) VALUES (?)`
      ).run(rowId);
    }
  }

  private async getRowModifiedTime(tableName: string, rowId: number): Promise<string | null> {
    const row = this.db.prepare(
      `SELECT _modified_at FROM "${tableName}" WHERE _row_id = ?`
    ).get(rowId) as any;
    return row?._modified_at || null;
  }

  private castValue(value: any, dataType: string): any {
    if (value === null || value === undefined || value === '') return null;
    
    switch (dataType) {
      case 'INTEGER':
        return parseInt(value, 10) || null;
      case 'REAL':
        return parseFloat(value) || null;
      case 'BOOLEAN':
        if (typeof value === 'boolean') return value ? 1 : 0;
        return /^(true|yes|1)$/i.test(String(value)) ? 1 : 0;
      case 'DATETIME':
        return new Date(value).toISOString();
      default:
        return String(value);
    }
  }

  private async callAppsScript(fn: string, args: any[]): Promise<any> {
    const response = await fetch(`${this.tunnelUrl}/apps-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        function: fn, 
        parameters: args, 
        spreadsheetId: this.spreadsheetId 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Apps Script call failed: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

---

## Automatic Injection: db.gs

When creating a new spreadsheet from a template, inject this `db.gs` file into the Apps Script project. This ensures every EGDesk spreadsheet has sync capabilities built-in.

### db.gs (Injected File)

```javascript
/**
 * =============================================================================
 * EGDesk Database Sync Module (db.gs)
 * Auto-injected when spreadsheet is created from template
 * =============================================================================
 */

const DB_CONFIG = {
  CHANGELOG_SHEET: '_changelog',
  CONFIG_SHEET: '_config',
  IGNORED_SHEETS: ['_changelog', '_config', '_template'],
  TUNNEL_URL_KEY: 'TUNNEL_URL',
  SYNC_MODE_KEY: 'SYNC_MODE',
  SPREADSHEET_ID_KEY: 'SPREADSHEET_ID'
};

/**
 * Initialize sync for this spreadsheet (called once on creation)
 */
function initializeSync(tunnelUrl) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DB_CONFIG.TUNNEL_URL_KEY, tunnelUrl);
  props.setProperty(DB_CONFIG.SYNC_MODE_KEY, 'manual');
  props.setProperty(DB_CONFIG.SPREADSHEET_ID_KEY, SpreadsheetApp.getActiveSpreadsheet().getId());
  
  // Create changelog sheet
  ensureChangelogSheet_();
  
  // Set up installable trigger
  setupEditTrigger_();
  
  return { success: true, spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId() };
}

/**
 * =============================================================================
 * SYNC WRAPPER - Call this from ANY function that modifies data
 * =============================================================================
 */

/**
 * Wraps any function execution with automatic sync notification.
 * Use this to wrap your custom functions.
 * 
 * @param {Function} fn - The function to execute
 * @param {string} fnName - Name for logging
 * @param {Array} args - Arguments to pass to the function
 * @returns {any} - Result of the function
 * 
 * @example
 * function myCustomFunction(param1, param2) {
 *   return withSync(() => {
 *     // Your logic here
 *     sheet.getRange('A1').setValue(param1);
 *     return 'done';
 *   }, 'myCustomFunction');
 * }
 */
function withSync(fn, fnName = 'unknown') {
  const startTime = new Date().toISOString();
  let result;
  let error;
  
  try {
    result = fn();
  } catch (e) {
    error = e;
  }
  
  // Always notify sync endpoint, even on error
  notifySyncEndpoint_({
    type: 'function_execution',
    function: fnName,
    timestamp: startTime,
    success: !error,
    error: error?.message
  });
  
  if (error) throw error;
  return result;
}

/**
 * Decorator-style sync trigger. Add to end of any function.
 * 
 * @example
 * function processOrder(orderId) {
 *   // ... your logic ...
 *   triggerSync('processOrder', { orderId });
 * }
 */
function triggerSync(fnName, metadata = {}) {
  notifySyncEndpoint_({
    type: 'function_execution',
    function: fnName,
    timestamp: new Date().toISOString(),
    metadata,
    success: true
  });
}

/**
 * =============================================================================
 * CHANGELOG MANAGEMENT
 * =============================================================================
 */

/**
 * Installable trigger: runs on every edit
 */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  
  const sheetName = e.source.getActiveSheet().getName();
  if (DB_CONFIG.IGNORED_SHEETS.includes(sheetName)) return;
  
  const change = {
    id: Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    sheet: sheetName,
    row: e.range.getRow(),
    col: e.range.getColumn(),
    oldValue: e.oldValue ?? null,
    newValue: e.value ?? null,
    synced: false,
    source: 'edit'
  };
  
  appendToChangelog_(change);
  
  const mode = PropertiesService.getScriptProperties().getProperty(DB_CONFIG.SYNC_MODE_KEY);
  if (mode === 'realtime') {
    pushChangesToTunnel_([change]);
  }
}

/**
 * Log a programmatic change (from custom functions)
 */
function logProgrammaticChange(sheetName, row, col, oldValue, newValue, source = 'function') {
  if (DB_CONFIG.IGNORED_SHEETS.includes(sheetName)) return;
  
  const change = {
    id: Utilities.getUuid(),
    timestamp: new Date().toISOString(),
    sheet: sheetName,
    row,
    col,
    oldValue,
    newValue,
    synced: false,
    source
  };
  
  appendToChangelog_(change);
  
  const mode = PropertiesService.getScriptProperties().getProperty(DB_CONFIG.SYNC_MODE_KEY);
  if (mode === 'realtime') {
    pushChangesToTunnel_([change]);
  }
  
  return change.id;
}

/**
 * Batch log multiple changes at once
 */
function logBatchChanges(changes, source = 'batch') {
  const timestamp = new Date().toISOString();
  const processedChanges = [];
  
  for (const c of changes) {
    if (DB_CONFIG.IGNORED_SHEETS.includes(c.sheet)) continue;
    
    const change = {
      id: Utilities.getUuid(),
      timestamp,
      sheet: c.sheet,
      row: c.row,
      col: c.col,
      oldValue: c.oldValue ?? null,
      newValue: c.newValue ?? null,
      synced: false,
      source
    };
    
    appendToChangelog_(change);
    processedChanges.push(change);
  }
  
  const mode = PropertiesService.getScriptProperties().getProperty(DB_CONFIG.SYNC_MODE_KEY);
  if (mode === 'realtime' && processedChanges.length > 0) {
    pushChangesToTunnel_(processedChanges);
  }
  
  return processedChanges.map(c => c.id);
}

/**
 * =============================================================================
 * API FUNCTIONS (Called by Electron via tunnel)
 * =============================================================================
 */

function setTunnelUrl(url) {
  PropertiesService.getScriptProperties().setProperty(DB_CONFIG.TUNNEL_URL_KEY, url);
  return { success: true, url };
}

function setSyncMode(mode) {
  if (!['realtime', 'periodic', 'manual'].includes(mode)) {
    return { success: false, error: 'Invalid mode' };
  }
  PropertiesService.getScriptProperties().setProperty(DB_CONFIG.SYNC_MODE_KEY, mode);
  return { success: true, mode };
}

function getUnsynced() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName(DB_CONFIG.CHANGELOG_SHEET);
  if (!cl) return [];
  
  const data = cl.getDataRange().getValues();
  const unsyncedRows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === false) { // synced column (index 8)
      unsyncedRows.push({
        rowIndex: i + 1,
        id: data[i][0],
        timestamp: data[i][1],
        sheet: data[i][2],
        row: data[i][3],
        col: data[i][4],
        oldValue: data[i][5],
        newValue: data[i][6],
        source: data[i][7]
      });
    }
  }
  return unsyncedRows;
}

function markSynced(ids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName(DB_CONFIG.CHANGELOG_SHEET);
  if (!cl) return { success: false };
  
  const data = cl.getDataRange().getValues();
  const idSet = new Set(ids);
  
  for (let i = 1; i < data.length; i++) {
    if (idSet.has(data[i][0])) {
      cl.getRange(i + 1, 9).setValue(true); // synced column
    }
  }
  return { success: true, count: ids.length };
}

function getColumnHeaders(sheetName, headerRow = 1) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  return headers.map((h, i) => ({
    index: i + 1,
    header: h || `Column_${i + 1}`
  }));
}

function getSyncStatus() {
  const props = PropertiesService.getScriptProperties();
  return {
    tunnelUrl: props.getProperty(DB_CONFIG.TUNNEL_URL_KEY),
    syncMode: props.getProperty(DB_CONFIG.SYNC_MODE_KEY),
    spreadsheetId: props.getProperty(DB_CONFIG.SPREADSHEET_ID_KEY)
  };
}

/**
 * =============================================================================
 * PRIVATE HELPER FUNCTIONS
 * =============================================================================
 */

function ensureChangelogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let cl = ss.getSheetByName(DB_CONFIG.CHANGELOG_SHEET);
  
  if (!cl) {
    cl = ss.insertSheet(DB_CONFIG.CHANGELOG_SHEET);
    cl.appendRow(['id', 'timestamp', 'sheet', 'row', 'col', 'oldValue', 'newValue', 'source', 'synced']);
    cl.hideSheet();
  }
  
  return cl;
}

function appendToChangelog_(change) {
  const cl = ensureChangelogSheet_();
  cl.appendRow([
    change.id,
    change.timestamp,
    change.sheet,
    change.row,
    change.col,
    change.oldValue,
    change.newValue,
    change.source || 'edit',
    false
  ]);
}

function pushChangesToTunnel_(changes) {
  const tunnelUrl = PropertiesService.getScriptProperties().getProperty(DB_CONFIG.TUNNEL_URL_KEY);
  if (!tunnelUrl) return;
  
  try {
    UrlFetchApp.fetch(tunnelUrl + '/sheet-changes', {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        changes
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('Push to tunnel failed:', err);
  }
}

function notifySyncEndpoint_(event) {
  const tunnelUrl = PropertiesService.getScriptProperties().getProperty(DB_CONFIG.TUNNEL_URL_KEY);
  if (!tunnelUrl) return;
  
  try {
    UrlFetchApp.fetch(tunnelUrl + '/function-executed', {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        event
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('Notify sync endpoint failed:', err);
  }
}

function setupEditTrigger_() {
  // Remove existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onSheetEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Create new installable trigger
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}

function cleanupChangelog(daysToKeep = 7) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cl = ss.getSheetByName(DB_CONFIG.CHANGELOG_SHEET);
  if (!cl) return { deleted: 0 };
  
  const data = cl.getDataRange().getValues();
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const timestamp = new Date(data[i][1]);
    const synced = data[i][8];
    
    if (synced && timestamp < cutoff) {
      rowsToDelete.push(i + 1);
    }
  }
  
  for (const row of rowsToDelete) {
    cl.deleteRow(row);
  }
  
  return { deleted: rowsToDelete.length };
}
```

---

## Example: Using Sync in Custom Functions

Any custom function in your EGDesk spreadsheet should use the sync wrapper:

```javascript
// Code.gs or any other .gs file in the same project

/**
 * Example 1: Using withSync wrapper
 */
function createInvoice(customerId, items) {
  return withSync(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invoiceSheet = ss.getSheetByName('Invoices');
    
    const invoiceId = generateInvoiceId_();
    const row = invoiceSheet.getLastRow() + 1;
    
    // Write invoice data
    invoiceSheet.getRange(row, 1, 1, 4).setValues([[
      invoiceId,
      customerId,
      JSON.stringify(items),
      new Date().toISOString()
    ]]);
    
    return { invoiceId, row };
  }, 'createInvoice');
}

/**
 * Example 2: Using triggerSync at the end
 */
function updateOrderStatus(orderId, newStatus) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ordersSheet = ss.getSheetByName('Orders');
  
  // Find and update the order
  const data = ordersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orderId) {
      const oldStatus = data[i][3];
      ordersSheet.getRange(i + 1, 4).setValue(newStatus);
      
      // Log the specific change for sync
      logProgrammaticChange('Orders', i + 1, 4, oldStatus, newStatus, 'updateOrderStatus');
      
      triggerSync('updateOrderStatus', { orderId, oldStatus, newStatus });
      return { success: true };
    }
  }
  
  return { success: false, error: 'Order not found' };
}

/**
 * Example 3: Batch operations with batch logging
 */
function importProducts(products) {
  return withSync(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const productsSheet = ss.getSheetByName('Products');
    const startRow = productsSheet.getLastRow() + 1;
    
    const changes = [];
    
    products.forEach((product, index) => {
      const row = startRow + index;
      productsSheet.getRange(row, 1, 1, 3).setValues([[
        product.id,
        product.name,
        product.price
      ]]);
      
      // Track each cell change
      changes.push(
        { sheet: 'Products', row, col: 1, newValue: product.id },
        { sheet: 'Products', row, col: 2, newValue: product.name },
        { sheet: 'Products', row, col: 3, newValue: product.price }
      );
    });
    
    // Log all changes at once
    logBatchChanges(changes, 'importProducts');
    
    return { imported: products.length };
  }, 'importProducts');
}
```

---

## Template Injection: Electron Code

When creating a new spreadsheet from a template, use the Google Apps Script API to inject `db.gs`:

```typescript
import { google } from 'googleapis';

interface InjectionResult {
  spreadsheetId: string;
  scriptId: string;
  success: boolean;
}

/**
 * Create a spreadsheet from template and inject db.gs
 */
export async function createSpreadsheetWithSync(
  auth: any,
  templateId: string,
  newName: string,
  tunnelUrl: string
): Promise<InjectionResult> {
  const drive = google.drive({ version: 'v3', auth });
  const script = google.script({ version: 'v1', auth });
  
  // Step 1: Copy the template
  const copyResponse = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: newName
    }
  });
  
  const spreadsheetId = copyResponse.data.id!;
  console.log(`[Template] Created spreadsheet: ${spreadsheetId}`);
  
  // Step 2: Get or create the bound Apps Script project
  const scriptId = await getOrCreateBoundScript(script, drive, spreadsheetId);
  
  // Step 3: Inject db.gs into the script project
  await injectDbScript(script, scriptId);
  
  // Step 4: Initialize sync by calling initializeSync
  await initializeSyncInSheet(script, scriptId, tunnelUrl);
  
  return {
    spreadsheetId,
    scriptId,
    success: true
  };
}

/**
 * Get existing or create new bound script project
 */
async function getOrCreateBoundScript(
  script: any,
  drive: any,
  spreadsheetId: string
): Promise<string> {
  // Check if script already exists (from template)
  const existingFiles = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.script' and '${spreadsheetId}' in parents`,
    fields: 'files(id, name)'
  });
  
  if (existingFiles.data.files?.length > 0) {
    return existingFiles.data.files[0].id;
  }
  
  // Create new bound script
  const createResponse = await script.projects.create({
    requestBody: {
      title: 'EGDesk Sync',
      parentId: spreadsheetId
    }
  });
  
  return createResponse.data.scriptId!;
}

/**
 * Inject db.gs content into the script project
 */
async function injectDbScript(script: any, scriptId: string): Promise<void> {
  // Get current project content
  const contentResponse = await script.projects.getContent({
    scriptId
  });
  
  const existingFiles = contentResponse.data.files || [];
  
  // Check if db.gs already exists
  const dbFileIndex = existingFiles.findIndex((f: any) => f.name === 'db');
  
  // db.gs content (the full content from above)
  const dbGsContent = getDbGsContent();
  
  const dbFile = {
    name: 'db',
    type: 'SERVER_JS',
    source: dbGsContent
  };
  
  if (dbFileIndex >= 0) {
    // Update existing
    existingFiles[dbFileIndex] = dbFile;
  } else {
    // Add new
    existingFiles.push(dbFile);
  }
  
  // Update project content
  await script.projects.updateContent({
    scriptId,
    requestBody: {
      files: existingFiles
    }
  });
  
  console.log(`[Template] Injected db.gs into script: ${scriptId}`);
}

/**
 * Call initializeSync in the newly created spreadsheet
 */
async function initializeSyncInSheet(
  script: any, 
  scriptId: string, 
  tunnelUrl: string
): Promise<void> {
  try {
    await script.scripts.run({
      scriptId,
      requestBody: {
        function: 'initializeSync',
        parameters: [tunnelUrl]
      }
    });
    console.log(`[Template] Initialized sync with tunnel: ${tunnelUrl}`);
  } catch (error) {
    console.error('[Template] Failed to initialize sync:', error);
    // Non-fatal: sync can be initialized later
  }
}

/**
 * Returns the full db.gs content as a string
 */
function getDbGsContent(): string {
  return `
/**
 * =============================================================================
 * EGDesk Database Sync Module (db.gs)
 * Auto-injected when spreadsheet is created from template
 * =============================================================================
 */

const DB_CONFIG = {
  CHANGELOG_SHEET: '_changelog',
  CONFIG_SHEET: '_config',
  IGNORED_SHEETS: ['_changelog', '_config', '_template'],
  TUNNEL_URL_KEY: 'TUNNEL_URL',
  SYNC_MODE_KEY: 'SYNC_MODE',
  SPREADSHEET_ID_KEY: 'SPREADSHEET_ID'
};

// ... (rest of the db.gs content - full file from above)
// In production, load this from a file or embed as a template string
`.trim();
}
```

---

## Template Injection: Alternative Using clasp

If you prefer using `clasp` for script management:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Inject db.gs using clasp CLI
 */
export async function injectWithClasp(
  spreadsheetId: string,
  tunnelUrl: string
): Promise<void> {
  const tempDir = path.join(process.cwd(), '.clasp-temp', spreadsheetId);
  
  try {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Write .clasp.json
    await fs.writeFile(
      path.join(tempDir, '.clasp.json'),
      JSON.stringify({
        scriptId: await getScriptId(spreadsheetId),
        rootDir: tempDir
      })
    );
    
    // Write db.gs
    await fs.writeFile(
      path.join(tempDir, 'db.gs'),
      await fs.readFile(path.join(__dirname, 'templates', 'db.gs'), 'utf-8')
    );
    
    // Write appsscript.json
    await fs.writeFile(
      path.join(tempDir, 'appsscript.json'),
      JSON.stringify({
        timeZone: 'Asia/Seoul',
        dependencies: {},
        exceptionLogging: 'STACKDRIVER',
        runtimeVersion: 'V8'
      })
    );
    
    // Push with clasp
    await execAsync(`clasp push`, { cwd: tempDir });
    
    console.log(`[clasp] Pushed db.gs to spreadsheet: ${spreadsheetId}`);
    
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
```

---

## FastAPI Tunnel Endpoint

```python
from fastapi import FastAPI, Request, HTTPException
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from googleapiclient.discovery import build
import httpx
import os
import json
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

# =============================================================================
# STATE MANAGEMENT
# =============================================================================

# Store Electron callback URLs per spreadsheet
electron_callbacks: dict[str, str] = {}

# Store pending changes when Electron is not connected
pending_changes: dict[str, list] = {}

# Store spreadsheet -> script ID mapping
script_id_cache: dict[str, str] = {}


# =============================================================================
# MODELS
# =============================================================================

class ElectronRegistration(BaseModel):
    callback_url: str
    spreadsheet_id: str


class FunctionExecutedEvent(BaseModel):
    spreadsheetId: str
    event: dict


class SheetChangesPayload(BaseModel):
    spreadsheetId: str
    changes: list


class TemplateCreationRequest(BaseModel):
    template_id: str
    new_name: str
    tunnel_url: str


# =============================================================================
# ELECTRON REGISTRATION
# =============================================================================

@app.post("/register-electron")
async def register_electron(data: ElectronRegistration):
    """Register Electron app's callback URL for a specific spreadsheet"""
    electron_callbacks[data.spreadsheet_id] = data.callback_url
    
    # Send any pending changes
    if data.spreadsheet_id in pending_changes:
        pending = pending_changes.pop(data.spreadsheet_id)
        if pending:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        data.callback_url,
                        json={"changes": pending, "type": "pending_flush"},
                        timeout=10.0
                    )
            except Exception as e:
                print(f"Failed to flush pending changes: {e}")
    
    return {
        "status": "registered", 
        "callback_url": data.callback_url,
        "spreadsheet_id": data.spreadsheet_id
    }


@app.post("/unregister-electron/{spreadsheet_id}")
async def unregister_electron(spreadsheet_id: str):
    """Unregister Electron callback (e.g., on app close)"""
    electron_callbacks.pop(spreadsheet_id, None)
    return {"status": "unregistered", "spreadsheet_id": spreadsheet_id}


# =============================================================================
# SHEET CHANGES (from Apps Script onEdit)
# =============================================================================

@app.post("/sheet-changes")
async def receive_sheet_changes(data: SheetChangesPayload):
    """
    Webhook endpoint for realtime mode.
    Called by Google Apps Script on each edit.
    """
    spreadsheet_id = data.spreadsheetId
    changes = data.changes
    
    callback_url = electron_callbacks.get(spreadsheet_id)
    
    if not callback_url:
        # Queue for later
        if spreadsheet_id not in pending_changes:
            pending_changes[spreadsheet_id] = []
        pending_changes[spreadsheet_id].extend(changes)
        
        # Limit pending queue size
        if len(pending_changes[spreadsheet_id]) > 1000:
            pending_changes[spreadsheet_id] = pending_changes[spreadsheet_id][-500:]
        
        return {"status": "queued", "count": len(changes)}
    
    # Forward to Electron
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                callback_url,
                json={"changes": changes, "type": "sheet_changes"},
                timeout=10.0
            )
            return {"status": "forwarded", "electron_response": response.status_code}
    except Exception as e:
        # Queue on forward failure
        if spreadsheet_id not in pending_changes:
            pending_changes[spreadsheet_id] = []
        pending_changes[spreadsheet_id].extend(changes)
        return {"status": "forward_failed", "error": str(e), "queued": True}


# =============================================================================
# FUNCTION EXECUTION NOTIFICATIONS
# =============================================================================

@app.post("/function-executed")
async def function_executed(data: FunctionExecutedEvent):
    """
    Notification endpoint when any Apps Script function executes.
    Called by withSync() and triggerSync() in db.gs.
    """
    spreadsheet_id = data.spreadsheetId
    event = data.event
    
    callback_url = electron_callbacks.get(spreadsheet_id)
    
    if not callback_url:
        return {"status": "no_callback", "event_logged": True}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                callback_url,
                json={"event": event, "type": "function_executed"},
                timeout=10.0
            )
            return {"status": "forwarded", "electron_response": response.status_code}
    except Exception as e:
        return {"status": "forward_failed", "error": str(e)}


# =============================================================================
# APPS SCRIPT PROXY
# =============================================================================

@app.post("/apps-script")
async def proxy_apps_script(request: Request):
    """
    Proxy calls to Google Apps Script.
    Electron calls this → we call Apps Script Execution API.
    """
    data = await request.json()
    
    function_name = data.get("function")
    parameters = data.get("parameters", [])
    spreadsheet_id = data.get("spreadsheetId")
    
    if not function_name:
        raise HTTPException(400, "Missing 'function' parameter")
    
    try:
        credentials = get_google_credentials()
        service = build('script', 'v1', credentials=credentials)
        
        script_id = await get_script_id_for_spreadsheet(spreadsheet_id, credentials)
        
        response = service.scripts().run(
            scriptId=script_id,
            body={
                'function': function_name,
                'parameters': parameters
            }
        ).execute()
        
        if 'error' in response:
            raise HTTPException(500, response['error'])
        
        return response.get('response', {}).get('result')
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# =============================================================================
# TEMPLATE CREATION WITH DB.GS INJECTION
# =============================================================================

@app.post("/create-from-template")
async def create_from_template(data: TemplateCreationRequest):
    """
    Create a new spreadsheet from template and inject db.gs.
    Called by Electron when user creates a new spreadsheet.
    """
    try:
        credentials = get_google_credentials()
        drive = build('drive', 'v3', credentials=credentials)
        script = build('script', 'v1', credentials=credentials)
        
        # Step 1: Copy template
        copy_response = drive.files().copy(
            fileId=data.template_id,
            body={'name': data.new_name}
        ).execute()
        
        spreadsheet_id = copy_response['id']
        
        # Step 2: Get or create bound script
        script_id = await get_or_create_bound_script(drive, script, spreadsheet_id)
        
        # Step 3: Inject db.gs
        await inject_db_script(script, script_id)
        
        # Step 4: Initialize sync
        try:
            script.scripts().run(
                scriptId=script_id,
                body={
                    'function': 'initializeSync',
                    'parameters': [data.tunnel_url]
                }
            ).execute()
        except Exception as init_error:
            print(f"Warning: Failed to initialize sync: {init_error}")
        
        # Cache the script ID
        script_id_cache[spreadsheet_id] = script_id
        
        return {
            "success": True,
            "spreadsheetId": spreadsheet_id,
            "scriptId": script_id,
            "url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        }
        
    except Exception as e:
        raise HTTPException(500, str(e))


async def get_or_create_bound_script(drive, script, spreadsheet_id: str) -> str:
    """Get existing or create new bound script project"""
    
    # Check for existing bound script
    try:
        files = drive.files().list(
            q=f"mimeType='application/vnd.google-apps.script' and '{spreadsheet_id}' in parents",
            fields='files(id)'
        ).execute()
        
        if files.get('files'):
            return files['files'][0]['id']
    except Exception:
        pass
    
    # Create new bound script
    response = script.projects().create(
        body={
            'title': 'EGDesk Sync',
            'parentId': spreadsheet_id
        }
    ).execute()
    
    return response['scriptId']


async def inject_db_script(script, script_id: str):
    """Inject db.gs content into the script project"""
    
    # Get current content
    try:
        content = script.projects().getContent(scriptId=script_id).execute()
        existing_files = content.get('files', [])
    except Exception:
        existing_files = []
    
    # Load db.gs content
    db_gs_content = get_db_gs_content()
    
    # Find or add db.gs
    db_file = {
        'name': 'db',
        'type': 'SERVER_JS',
        'source': db_gs_content
    }
    
    db_index = next((i for i, f in enumerate(existing_files) if f['name'] == 'db'), None)
    
    if db_index is not None:
        existing_files[db_index] = db_file
    else:
        existing_files.append(db_file)
    
    # Ensure appsscript.json exists
    manifest_index = next((i for i, f in enumerate(existing_files) if f['name'] == 'appsscript'), None)
    if manifest_index is None:
        existing_files.append({
            'name': 'appsscript',
            'type': 'JSON',
            'source': json.dumps({
                'timeZone': 'Asia/Seoul',
                'dependencies': {},
                'exceptionLogging': 'STACKDRIVER',
                'runtimeVersion': 'V8'
            })
        })
    
    # Update content
    script.projects().updateContent(
        scriptId=script_id,
        body={'files': existing_files}
    ).execute()


def get_db_gs_content() -> str:
    """Return the full db.gs content"""
    # In production, load from file: 
    # with open('templates/db.gs', 'r') as f: return f.read()
    
    # For now, return the embedded content
    return '''
const DB_CONFIG = {
  CHANGELOG_SHEET: '_changelog',
  CONFIG_SHEET: '_config',
  IGNORED_SHEETS: ['_changelog', '_config', '_template'],
  TUNNEL_URL_KEY: 'TUNNEL_URL',
  SYNC_MODE_KEY: 'SYNC_MODE',
  SPREADSHEET_ID_KEY: 'SPREADSHEET_ID'
};

function initializeSync(tunnelUrl) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DB_CONFIG.TUNNEL_URL_KEY, tunnelUrl);
  props.setProperty(DB_CONFIG.SYNC_MODE_KEY, 'manual');
  props.setProperty(DB_CONFIG.SPREADSHEET_ID_KEY, SpreadsheetApp.getActiveSpreadsheet().getId());
  ensureChangelogSheet_();
  setupEditTrigger_();
  return { success: true, spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId() };
}

// ... (include full db.gs content here)
// See the db.gs section above for complete implementation
'''.strip()


# =============================================================================
# UTILITIES
# =============================================================================

async def get_script_id_for_spreadsheet(spreadsheet_id: str, credentials) -> str:
    """Get the Apps Script ID bound to a spreadsheet"""
    
    # Check cache first
    if spreadsheet_id in script_id_cache:
        return script_id_cache[spreadsheet_id]
    
    # Look up via Drive API
    drive = build('drive', 'v3', credentials=credentials)
    
    files = drive.files().list(
        q=f"mimeType='application/vnd.google-apps.script' and '{spreadsheet_id}' in parents",
        fields='files(id)'
    ).execute()
    
    if files.get('files'):
        script_id = files['files'][0]['id']
        script_id_cache[spreadsheet_id] = script_id
        return script_id
    
    raise HTTPException(404, f"No script found for spreadsheet: {spreadsheet_id}")


def get_google_credentials():
    """Load Google credentials from environment"""
    
    # Option 1: Service Account (recommended for server)
    service_account_info = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
    if service_account_info:
        info = json.loads(service_account_info)
        return service_account.Credentials.from_service_account_info(
            info,
            scopes=[
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/script.projects',
                'https://www.googleapis.com/auth/script.external_request'
            ]
        )
    
    # Option 2: OAuth refresh token
    oauth_creds = os.getenv('GOOGLE_OAUTH_CREDENTIALS')
    if oauth_creds:
        creds_data = json.loads(oauth_creds)
        return Credentials(
            token=creds_data.get('token'),
            refresh_token=creds_data.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=creds_data.get('client_id'),
            client_secret=creds_data.get('client_secret')
        )
    
    raise HTTPException(500, "No Google credentials configured")


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "registered_spreadsheets": len(electron_callbacks),
        "pending_queues": len(pending_changes)
    }
```

---

## Flow Summary

| Scenario | AI Called? | Action |
|----------|------------|--------|
| Edit existing cell | ❌ | Direct SQLite update via cached mapping |
| New column in known sheet | ✅ | AI infers type → ALTER TABLE → update |
| Column header renamed | ✅ | AI decides if DB column renames → RENAME COLUMN → update |
| First edit in new sheet | ✅ | CREATE TABLE → AI infers column → update |
| Same column, different value | ❌ | Use cached mapping, cast value |

| Sync Mode | How It Works |
|-----------|--------------|
| **Manual** | User calls `controller.sync()` |
| **Periodic** | `setInterval` calls `sync()` every N minutes |
| **Realtime** | Apps Script `onEdit` → POST to tunnel → forward to Electron |

---

## Setup Checklist

### 1. Google Cloud Project
- [ ] Create project in [Google Cloud Console](https://console.cloud.google.com)
- [ ] Enable APIs:
  - Google Sheets API
  - Google Drive API
  - Apps Script API
- [ ] Create OAuth credentials OR service account
- [ ] Download credentials JSON

### 2. FastAPI Tunnel (Render)
- [ ] Deploy FastAPI app to Render
- [ ] Set environment variable: `GOOGLE_SERVICE_ACCOUNT_JSON` (or OAuth creds)
- [ ] Note your tunnel URL: `https://your-app.onrender.com`
- [ ] Test health: `curl https://your-app.onrender.com/health`

### 3. Template Spreadsheet
- [ ] Create a template spreadsheet with desired sheets/columns
- [ ] Note the template ID from URL: `docs.google.com/spreadsheets/d/{TEMPLATE_ID}/edit`
- [ ] (Optional) Add initial structure for common data

### 4. Electron App Integration
- [ ] Install dependencies:
  ```bash
  npm install better-sqlite3 googleapis undici
  ```
- [ ] Copy schema manager and sync controller classes
- [ ] Initialize on app startup:
  ```typescript
  const db = new Database('egdesk.db');
  const schemaManager = new DynamicSchemaManager(db);
  const syncController = new SheetSyncController(db, schemaManager, spreadsheetId, tunnelUrl);
  ```
- [ ] Set up local HTTP server for realtime webhook callbacks
- [ ] Call `syncController.setMode('manual' | 'periodic' | 'realtime')`

### 5. Create First Spreadsheet
- [ ] Call `POST /create-from-template`:
  ```bash
  curl -X POST https://your-tunnel.onrender.com/create-from-template \
    -H "Content-Type: application/json" \
    -d '{"template_id":"TEMPLATE_ID","new_name":"My Sheet","tunnel_url":"https://your-tunnel.onrender.com"}'
  ```
- [ ] Verify response contains `spreadsheetId` and `scriptId`
- [ ] Open spreadsheet in browser
- [ ] Verify `_changelog` sheet was created (it may be hidden)
- [ ] Check Apps Script editor (Extensions → Apps Script) for `db.gs`

### 6. Test Sync Flow
- [ ] Edit a cell in Google Sheet
- [ ] Call `await syncController.sync()` in Electron
- [ ] Verify SQLite table was created with correct columns
- [ ] Verify data was inserted
- [ ] Rename a column header in Sheet
- [ ] Sync again → verify column was renamed (not duplicated)

### 7. Test Custom Function Sync
- [ ] Add a custom function in Apps Script with `withSync()`:
  ```javascript
  function myFunction() {
    return withSync(() => {
      // your logic
      SpreadsheetApp.getActiveSheet().getRange('A1').setValue('test');
      return 'done';
    }, 'myFunction');
  }
  ```
- [ ] Run the function
- [ ] Verify sync endpoint received `function_executed` event
- [ ] Verify SQLite received the change

### 8. Test Bidirectional Sync
- [ ] Modify data in SQLite directly
- [ ] Call `await syncController.push()` 
- [ ] Verify Sheet was updated

---

---

## Bidirectional Sync: SQLite → Sheet

Since SQLite is the source of truth, you'll want to push local changes back to the sheet.

### SQLite Change Tracking

Add a trigger to track local changes:

```sql
-- Table to track local changes that need to sync to sheet
CREATE TABLE IF NOT EXISTS _local_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT DEFAULT (datetime('now')),
  pushed_to_sheet INTEGER DEFAULT 0
);

-- Create triggers for each synced table
-- Run this after table creation:
```

### Dynamic Trigger Generator

```typescript
export class LocalChangeTracker {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initChangelogTable();
  }

  private initChangelogTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _local_changelog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_id INTEGER NOT NULL,
        column_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT DEFAULT (datetime('now')),
        pushed_to_sheet INTEGER DEFAULT 0
      )
    `);
  }

  /**
   * Create UPDATE trigger for a table/column
   * Call this after adding new columns
   */
  createUpdateTrigger(tableName: string, columnName: string) {
    const triggerName = `track_${tableName}_${columnName}`;
    
    // Drop existing trigger if any
    this.db.exec(`DROP TRIGGER IF EXISTS "${triggerName}"`);
    
    // Create new trigger
    this.db.exec(`
      CREATE TRIGGER "${triggerName}"
      AFTER UPDATE OF "${columnName}" ON "${tableName}"
      WHEN OLD."${columnName}" IS NOT NEW."${columnName}"
      BEGIN
        INSERT INTO _local_changelog (table_name, row_id, column_name, old_value, new_value)
        VALUES (
          '${tableName}',
          NEW._row_id,
          '${columnName}',
          OLD."${columnName}",
          NEW."${columnName}"
        );
      END
    `);
    
    console.log(`[Tracker] Created trigger: ${triggerName}`);
  }

  /**
   * Create triggers for all columns in a table
   */
  createTriggersForTable(tableName: string) {
    const columns = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
    
    for (const col of columns) {
      // Skip internal columns
      if (col.name.startsWith('_')) continue;
      this.createUpdateTrigger(tableName, col.name);
    }
  }

  /**
   * Get unpushed local changes
   */
  getUnpushedChanges(): LocalChange[] {
    return this.db.prepare(`
      SELECT * FROM _local_changelog 
      WHERE pushed_to_sheet = 0 
      ORDER BY changed_at ASC
    `).all() as LocalChange[];
  }

  /**
   * Mark changes as pushed
   */
  markAsPushed(ids: number[]) {
    const placeholders = ids.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE _local_changelog 
      SET pushed_to_sheet = 1 
      WHERE id IN (${placeholders})
    `).run(...ids);
  }
}

interface LocalChange {
  id: number;
  table_name: string;
  row_id: number;
  column_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}
```

### Push to Sheet (Electron)

```typescript
export class SheetPusher {
  private db: Database.Database;
  private schemaManager: DynamicSchemaManager;
  private changeTracker: LocalChangeTracker;
  private tunnelUrl: string;
  private spreadsheetId: string;

  constructor(
    db: Database.Database,
    schemaManager: DynamicSchemaManager,
    tunnelUrl: string,
    spreadsheetId: string
  ) {
    this.db = db;
    this.schemaManager = schemaManager;
    this.changeTracker = new LocalChangeTracker(db);
    this.tunnelUrl = tunnelUrl;
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * Push local SQLite changes to Google Sheet
   */
  async pushToSheet(): Promise<{ pushed: number; failed: number }> {
    const changes = this.changeTracker.getUnpushedChanges();
    
    if (changes.length === 0) {
      return { pushed: 0, failed: 0 };
    }

    console.log(`[Push] Pushing ${changes.length} local changes to sheet`);

    let pushed = 0;
    let failed = 0;
    const pushedIds: number[] = [];

    // Group by table for efficiency
    const changesByTable = new Map<string, LocalChange[]>();
    for (const change of changes) {
      if (!changesByTable.has(change.table_name)) {
        changesByTable.set(change.table_name, []);
      }
      changesByTable.get(change.table_name)!.push(change);
    }

    for (const [tableName, tableChanges] of changesByTable) {
      // Get sheet name from registry
      const sheetName = this.getSheetNameForTable(tableName);
      if (!sheetName) {
        console.warn(`[Push] No sheet mapping for table: ${tableName}`);
        failed += tableChanges.length;
        continue;
      }

      // Convert to sheet updates
      const updates = tableChanges.map(change => {
        const colIndex = this.getColumnIndexForDbColumn(sheetName, change.column_name);
        return {
          sheet: sheetName,
          row: change.row_id,
          col: colIndex,
          value: change.new_value
        };
      }).filter(u => u.col !== null);

      // Batch update via Apps Script
      try {
        await this.callAppsScript('batchUpdateCells', [updates]);
        pushed += updates.length;
        pushedIds.push(...tableChanges.map(c => c.id));
      } catch (error) {
        console.error(`[Push] Failed to push to ${sheetName}:`, error);
        failed += tableChanges.length;
      }
    }

    // Mark as pushed
    if (pushedIds.length > 0) {
      this.changeTracker.markAsPushed(pushedIds);
    }

    return { pushed, failed };
  }

  private getSheetNameForTable(tableName: string): string | null {
    const row = this.db.prepare(
      'SELECT sheet_name FROM _sheet_tables WHERE table_name = ?'
    ).get(tableName) as any;
    return row?.sheet_name || null;
  }

  private getColumnIndexForDbColumn(sheetName: string, dbColumn: string): number | null {
    const row = this.db.prepare(
      'SELECT column_index FROM _schema_registry WHERE sheet_name = ? AND db_column = ?'
    ).get(sheetName, dbColumn) as any;
    return row?.column_index || null;
  }

  private async callAppsScript(fn: string, args: any[]): Promise<any> {
    const response = await fetch(`${this.tunnelUrl}/apps-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        function: fn, 
        parameters: args, 
        spreadsheetId: this.spreadsheetId 
      })
    });
    return response.json();
  }
}
```

### Apps Script: Batch Update Function

Add this to your Apps Script:

```javascript
/**
 * Batch update cells from SQLite changes
 * Called by Electron to push local changes to sheet
 */
function batchUpdateCells(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Temporarily disable sync tracking to avoid loops
  const wasRealtime = PropertiesService.getScriptProperties().getProperty('SYNC_MODE') === 'realtime';
  if (wasRealtime) {
    PropertiesService.getScriptProperties().setProperty('SYNC_MODE', 'paused');
  }
  
  try {
    // Group by sheet
    const bySheet = {};
    for (const update of updates) {
      if (!bySheet[update.sheet]) bySheet[update.sheet] = [];
      bySheet[update.sheet].push(update);
    }
    
    for (const sheetName of Object.keys(bySheet)) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        console.warn(`Sheet not found: ${sheetName}`);
        continue;
      }
      
      for (const update of bySheet[sheetName]) {
        sheet.getRange(update.row, update.col).setValue(update.value);
      }
    }
    
    return { success: true, updated: updates.length };
  } finally {
    // Restore sync mode
    if (wasRealtime) {
      PropertiesService.getScriptProperties().setProperty('SYNC_MODE', 'realtime');
    }
  }
}

/**
 * Alternative: Batch update with range optimization
 * More efficient for large updates in contiguous areas
 */
function batchUpdateCellsOptimized(updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Pause tracking
  const originalMode = PropertiesService.getScriptProperties().getProperty('SYNC_MODE');
  PropertiesService.getScriptProperties().setProperty('SYNC_MODE', 'paused');
  
  try {
    const bySheet = {};
    for (const u of updates) {
      if (!bySheet[u.sheet]) bySheet[u.sheet] = [];
      bySheet[u.sheet].push(u);
    }
    
    for (const sheetName of Object.keys(bySheet)) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      
      // Sort by row, then col for potential range merging
      const sorted = bySheet[sheetName].sort((a, b) => 
        a.row - b.row || a.col - b.col
      );
      
      // Apply updates
      for (const update of sorted) {
        sheet.getRange(update.row, update.col).setValue(update.value);
      }
      
      // Flush to ensure all changes are written
      SpreadsheetApp.flush();
    }
    
    return { success: true, updated: updates.length };
  } finally {
    PropertiesService.getScriptProperties().setProperty('SYNC_MODE', originalMode || 'manual');
  }
}
```

### Integrated Bidirectional Sync Controller

```typescript
export class BidirectionalSyncController {
  private pullController: SheetSyncController;
  private pusher: SheetPusher;
  private mode: SyncMode = 'manual';
  private intervalId?: NodeJS.Timeout;

  constructor(
    db: Database.Database,
    spreadsheetId: string,
    tunnelUrl: string
  ) {
    const schemaManager = new DynamicSchemaManager(db);
    
    this.pullController = new SheetSyncController(db, spreadsheetId, tunnelUrl);
    this.pusher = new SheetPusher(db, schemaManager, tunnelUrl, spreadsheetId);
  }

  async setMode(mode: SyncMode) {
    this.mode = mode;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    await this.pullController.setMode(mode);
    
    if (mode === 'periodic') {
      // Bidirectional sync every minute
      this.intervalId = setInterval(() => this.syncBidirectional(), 60_000);
    }
  }

  /**
   * Full bidirectional sync
   */
  async syncBidirectional(): Promise<{
    pulled: SyncResult;
    pushed: { pushed: number; failed: number };
  }> {
    console.log('[Sync] Starting bidirectional sync');
    
    // Push local changes first (SQLite is source of truth)
    const pushed = await this.pusher.pushToSheet();
    
    // Then pull any sheet changes
    const pulled = await this.pullController.sync();
    
    console.log('[Sync] Bidirectional sync complete:', { pulled, pushed });
    
    return { pulled, pushed };
  }

  /**
   * Pull only (sheet → SQLite)
   */
  async pull() {
    return this.pullController.sync();
  }

  /**
   * Push only (SQLite → sheet)  
   */
  async push() {
    return this.pusher.pushToSheet();
  }
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BIDIRECTIONAL SYNC                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   GOOGLE SHEET                              SQLITE (Source of Truth)│
│   ┌─────────────┐                          ┌─────────────┐         │
│   │ User edits  │                          │ App edits   │         │
│   │ cell        │                          │ data        │         │
│   └──────┬──────┘                          └──────┬──────┘         │
│          │                                        │                 │
│          ▼                                        ▼                 │
│   ┌─────────────┐                          ┌─────────────┐         │
│   │ onEdit      │                          │ UPDATE      │         │
│   │ trigger     │                          │ trigger     │         │
│   └──────┬──────┘                          └──────┬──────┘         │
│          │                                        │                 │
│          ▼                                        ▼                 │
│   ┌─────────────┐                          ┌─────────────┐         │
│   │ _changelog  │                          │ _local_     │         │
│   │ sheet       │                          │ changelog   │         │
│   └──────┬──────┘                          └──────┬──────┘         │
│          │                                        │                 │
│          │         ┌───────────────┐              │                 │
│          └────────►│ FastAPI       │◄─────────────┘                 │
│                    │ Tunnel        │                                │
│          ┌─────────┤ (Render)      ├──────────┐                    │
│          │         └───────────────┘          │                    │
│          ▼                                    ▼                    │
│   ┌─────────────┐                      ┌─────────────┐             │
│   │ Pull:       │                      │ Push:       │             │
│   │ Apply to    │                      │ Update      │             │
│   │ SQLite      │                      │ Sheet       │             │
│   └─────────────┘                      └─────────────┘             │
│                                                                     │
│   Conflict Resolution: SQLite always wins (newer timestamp)         │
│   Loop Prevention: Pause tracking during push operations            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Notes

- **SQLite 3.25+** required for `RENAME COLUMN` support
- **AI calls are cached** — only invoked on schema changes
- **Position-based tracking** preserves data on column renames
- **Conflict resolution** favors SQLite (source of truth)
- **Loop prevention** — push operations pause sheet tracking temporarily
- **Trigger coverage** — use `withSyncTracking()` wrapper for any Apps Script function that modifies data