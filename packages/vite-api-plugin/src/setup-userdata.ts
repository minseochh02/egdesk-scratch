/**
 * User Data Setup Utility
 *
 * Automatically discovers EGDesk user-data tables and generates configuration
 * for Vite projects to access them.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UserDataTable {
  id: string;
  tableName: string;
  displayName: string;
  description?: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
}

export interface UserDataConfig {
  apiKey: string | null;
  baseUrl: string;
  tables: UserDataTable[];
  generatedAt: string;
}

/**
 * Fetch available tables from EGDesk
 */
export async function discoverTables(
  egdeskUrl: string = 'http://localhost:8080',
  apiKey?: string
): Promise<UserDataTable[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    // List all tables
    const listResponse = await fetch(`${egdeskUrl}/user-data/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: 'user_data_list_tables',
        arguments: {}
      })
    });

    const listResult = await listResponse.json().catch(() => null);

    if (listResult && typeof listResult === 'object' && listResult.success === false) {
      throw new Error(listResult.error || 'Failed to list tables');
    }

    if (!listResponse.ok) {
      const fromBody =
        listResult && typeof listResult === 'object' && typeof listResult.error === 'string'
          ? listResult.error
          : '';
      throw new Error(fromBody || `Failed to list tables: ${listResponse.status} ${listResponse.statusText}`);
    }

    if (!listResult || !listResult.success) {
      throw new Error(
        listResult && typeof listResult === 'object' && listResult.error
          ? String(listResult.error)
          : 'Failed to list tables'
      );
    }

    // Parse MCP response
    const content = listResult.result?.content?.[0]?.text;
    const data = content ? JSON.parse(content) : null;

    console.log('[DEBUG] List tables response:', JSON.stringify(listResult, null, 2));
    console.log('[DEBUG] Parsed data:', JSON.stringify(data, null, 2));
    console.log('[DEBUG] Tables array:', data?.tables);
    console.log('[DEBUG] Total tables:', data?.totalTables);

    if (!data || !data.tables) {
      console.log('[DEBUG] No data or no tables array - returning empty');
      return [];
    }

    // Fetch schema for each table to get column names
    const tablesWithColumns: UserDataTable[] = [];

    for (const table of data.tables) {
      try {
        const schemaResponse = await fetch(`${egdeskUrl}/user-data/tools/call`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tool: 'user_data_get_schema',
            arguments: { tableName: table.tableName }
          })
        });

        if (schemaResponse.ok) {
          const schemaResult = await schemaResponse.json();
          const schemaContent = schemaResult.result?.content?.[0]?.text;
          const schemaData = schemaContent ? JSON.parse(schemaContent) : null;

          tablesWithColumns.push({
            id: table.id,
            tableName: table.tableName,
            displayName: table.displayName,
            description: table.description,
            rowCount: table.rowCount,
            columnCount: table.columnCount,
            columns: schemaData?.schema?.map((col: any) => col.name) || []
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch schema for ${table.tableName}:`, error);
        // Add table without column info
        tablesWithColumns.push({
          ...table,
          columns: []
        });
      }
    }

    return tablesWithColumns;
  } catch (error) {
    console.error('Failed to discover tables:', error);
    throw error;
  }
}

/**
 * Generate .env.egdesk file with user-data configuration
 */
export function generateEnvFile(
  projectPath: string,
  config: UserDataConfig
): void {
  const envPath = path.join(projectPath, '.env.egdesk');

  const envContent = [
    '# EGDesk User Data Configuration',
    `# Generated at: ${config.generatedAt}`,
    '',
    '# EGDesk HTTP MCP Server',
    `VITE_EGDESK_API_URL=${config.baseUrl}`,
    '',
    '# API Key (if required)',
    config.apiKey ? `VITE_EGDESK_API_KEY=${config.apiKey}` : '# VITE_EGDESK_API_KEY=your-api-key-here',
    '',
    '# Available Tables',
    `# Total tables: ${config.tables.length}`,
    ...config.tables.map((table, index) =>
      `# ${index + 1}. ${table.displayName} (${table.tableName}) - ${table.rowCount} rows, ${table.columnCount} columns`
    ),
    '',
    '# Table Names (use these in your code)',
    ...config.tables.map((table, index) =>
      `VITE_TABLE_${index + 1}_NAME=${table.tableName}`
    ),
    '',
    '# Main table (if you have one primary table)',
    config.tables.length > 0 ? `VITE_MAIN_TABLE=${config.tables[0].tableName}` : '# VITE_MAIN_TABLE=',
    ''
  ].join('\n');

  fs.writeFileSync(envPath, envContent.replace(/\r?\n/g, os.EOL), 'utf-8');
  console.log(`✅ Generated ${envPath}`);
}

/**
 * Generate TypeScript config file with table definitions
 */
export function generateConfigFile(
  projectPath: string,
  config: UserDataConfig
): void {
  const configPath = path.join(projectPath, 'egdesk.config.ts');

  const configContent = `/**
 * EGDesk User Data Configuration
 * Generated at: ${config.generatedAt}
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: '${config.baseUrl}',
  apiKey: ${config.apiKey ? `'${config.apiKey}'` : 'undefined'},
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
${config.tables.map((table, index) => `  table${index + 1}: {
    name: '${table.tableName}',
    displayName: '${table.displayName}',
    description: ${table.description ? `'${table.description}'` : 'undefined'},
    rowCount: ${table.rowCount},
    columnCount: ${table.columnCount},
    columns: [${table.columns.map(col => `'${col}'`).join(', ')}]
  } as TableDefinition`).join(',\n')}
} as const;

${config.tables.length > 0 ? `
// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;
` : ''}

// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
${config.tables.map((table, index) => `  table${index + 1}: '${table.tableName}'`).join(',\n')}
} as const;
`;

  fs.writeFileSync(configPath, configContent.replace(/\r?\n/g, os.EOL), 'utf-8');
  console.log(`✅ Generated ${configPath}`);
}

/**
 * Generate helper functions file
 */
export function generateHelperFile(projectPath: string): void {
  const helperPath = path.join(projectPath, 'egdesk-helpers.ts');

  const helperContent = `/**
 * EGDesk User Data Helper Functions
 *
 * Type-safe helpers for accessing EGDesk user data.
 */

/**
 * Parse EGDesk MCP \`/tools/call\` JSON so \`error\` is shown even when HTTP status is 500.
 */
async function parseEgdeskMcpToolResponse(response: Response): Promise<any> {
  const result = await response.json().catch(() => null);

  if (result && typeof result === 'object' && result.success === false) {
    const errMsg =
      typeof result.error === 'string'
        ? result.error
        : result.error != null
          ? String(result.error)
          : 'Tool call failed';
    throw new Error(errMsg);
  }

  if (!response.ok) {
    let fromBody = '';
    if (result && typeof result === 'object') {
      if (typeof (result as { error?: string }).error === 'string') {
        fromBody = (result as { error: string }).error;
      } else if (typeof (result as { message?: string }).message === 'string') {
        fromBody = (result as { message: string }).message;
      }
    }
    throw new Error(fromBody || \`HTTP \${response.status}: \${response.statusText}\`);
  }

  if (!result || result.success !== true) {
    throw new Error(
      result && typeof result === 'object' && typeof (result as { error?: string }).error === 'string'
        ? (result as { error: string }).error
        : 'Tool call failed'
    );
  }

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

/**
 * Call EGDesk user-data MCP tool
 *
 * Uses a proxy endpoint to work in both local and tunneled environments.
 * The @egdesk/vite-api-plugin intercepts these requests and forwards them to localhost:8080.
 */
export async function callUserDataTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Use proxy endpoint - works in both local and tunneled environments
  // Absolute URL with leading slash to ensure correct resolution from any route
  const response = await fetch('/__user_data_proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool: toolName, arguments: args })
  });

  return parseEgdeskMcpToolResponse(response);
}

/**
 * Query table data
 */
export async function queryTable(
  tableName: string,
  options: {
    filters?: Record<string, string>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}
) {
  return callUserDataTool('user_data_query', {
    tableName,
    ...options
  });
}

/**
 * Search table
 */
export async function searchTable(
  tableName: string,
  searchQuery: string,
  limit: number = 50
) {
  return callUserDataTool('user_data_search', {
    tableName,
    searchQuery,
    limit
  });
}

/**
 * Aggregate data
 */
export async function aggregateTable(
  tableName: string,
  column: string,
  aggregateFunction: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT',
  options: {
    filters?: Record<string, string>;
    groupBy?: string;
  } = {}
) {
  return callUserDataTool('user_data_aggregate', {
    tableName,
    column,
    function: aggregateFunction,
    ...options
  });
}

/**
 * Execute raw SQL query (read-only, SELECT only)
 */
export async function executeSQL(query: string) {
  return callUserDataTool('user_data_sql_query', { query });
}

/**
 * Create a new table
 */
export async function createTable(
  displayName: string,
  schema: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE';
    notNull?: boolean;
    defaultValue?: any;
  }>,
  options?: {
    description?: string;
    tableName?: string;
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
  }
) {
  return callUserDataTool('user_data_create_table', {
    displayName,
    schema,
    ...options
  });
}

/**
 * Insert rows into a table
 */
export async function insertRows(
  tableName: string,
  rows: Array<Record<string, any>>
) {
  return callUserDataTool('user_data_insert_rows', {
    tableName,
    rows
  });
}

/**
 * Update rows in a table
 */
export async function updateRows(
  tableName: string,
  updates: Record<string, any>,
  options: {
    ids?: number[];
    filters?: Record<string, string>;
  }
) {
  return callUserDataTool('user_data_update_rows', {
    tableName,
    updates,
    ...options
  });
}

/**
 * Delete rows from a table
 */
export async function deleteRows(
  tableName: string,
  options: {
    ids?: number[];
    filters?: Record<string, string>;
  }
) {
  return callUserDataTool('user_data_delete_rows', {
    tableName,
    ...options
  });
}

/**
 * Delete a table
 */
export async function deleteTable(tableName: string) {
  return callUserDataTool('user_data_delete_table', { tableName });
}

/**
 * Rename a table
 */
export async function renameTable(
  tableName: string,
  newTableName: string,
  newDisplayName?: string
) {
  return callUserDataTool('user_data_rename_table', {
    tableName,
    newTableName,
    newDisplayName
  });
}

// ==========================================
// BROWSER RECORDING (saved EGDesk recorder tests)
// ==========================================

/**
 * Call Browser Recording MCP tool.
 *
 * Uses \`/__browser_recording_proxy\` (see @egdesk/vite-api-plugin) so it works when the app is tunneled.
 * Enable the \`browser-recording\` MCP service in EGDesk and start the HTTP server first.
 */
export async function callBrowserRecordingTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const response = await fetch('/__browser_recording_proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool: toolName, arguments: args })
  });

  return parseEgdeskMcpToolResponse(response);
}

/** List saved *.spec.js files under the EGDesk browser-recorder-tests output folder */
export async function listBrowserRecordingTests() {
  return callBrowserRecordingTool('browser_recording_list_saved_tests', {});
}

/** Inspect a spec: date UI, defaultReplayDates, labeledFieldReplayBlocks, etc. */
export async function getBrowserRecordingReplayOptions(testFile: string) {
  return callBrowserRecordingTool('browser_recording_get_replay_options', { testFile });
}

export type BrowserRecordingRunOptions = {
  startDate?: string;
  endDate?: string;
  datePickersByIndex?: string[];
  /** Per captureLabeledFields step, values in field order (see labeledFieldReplayBlocks from get_replay_options) */
  labeledFieldFills?: (string | undefined)[][];
};

/** Replay a saved recording in Chrome; optional dates (YYYY/MM/DD or YYYY-MM-DD) and optional labeledFieldFills */
export async function runBrowserRecording(
  testFile: string,
  options: BrowserRecordingRunOptions = {}
) {
  return callBrowserRecordingTool('browser_recording_run', {
    testFile,
    ...options
  });
}
`;

  fs.writeFileSync(helperPath, helperContent.replace(/\r?\n/g, os.EOL), 'utf-8');
  console.log(`✅ Generated ${helperPath}`);
}

/**
 * Main setup function
 */
export async function setupUserData(
  projectPath: string,
  egdeskUrl: string = 'http://localhost:8080',
  apiKey?: string
): Promise<void> {
  console.log('🔍 Discovering EGDesk user-data tables...');

  const tables = await discoverTables(egdeskUrl, apiKey);

  if (tables.length === 0) {
    console.warn('⚠️  No tables found. Import data in EGDesk first.');
    return;
  }

  console.log(`✅ Found ${tables.length} table(s):`);
  tables.forEach((table, index) => {
    console.log(`   ${index + 1}. ${table.displayName} (${table.rowCount} rows)`);
  });

  const config: UserDataConfig = {
    apiKey: apiKey || null,
    baseUrl: egdeskUrl,
    tables,
    generatedAt: new Date().toISOString()
  };

  // Generate configuration files
  generateEnvFile(projectPath, config);
  generateConfigFile(projectPath, config);
  generateHelperFile(projectPath);

  console.log('');
  console.log('✅ Setup complete! Files generated:');
  console.log('   - .env.egdesk (environment variables)');
  console.log('   - egdesk.config.ts (type-safe config)');
  console.log('   - egdesk-helpers.ts (helper functions)');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Add .env.egdesk to your .gitignore');
  console.log('   2. Import helpers in vite.config.js:');
  console.log('      import { TABLES, TABLE_NAMES } from "./egdesk.config"');
  console.log('      import { queryTable } from "./egdesk-helpers"');
}
