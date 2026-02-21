/**
 * User Data Setup Utility
 *
 * Automatically discovers EGDesk user-data tables and generates configuration
 * for Vite projects to access them.
 */

import * as fs from 'fs';
import * as path from 'path';

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

    if (!listResponse.ok) {
      throw new Error(`Failed to list tables: ${listResponse.statusText}`);
    }

    const listResult = await listResponse.json();

    if (!listResult.success) {
      throw new Error(listResult.error || 'Failed to list tables');
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

  fs.writeFileSync(envPath, envContent, 'utf-8');
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

  fs.writeFileSync(configPath, configContent, 'utf-8');
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

  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  // Parse MCP response format
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
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
 * Execute raw SQL query
 */
export async function executeSQL(query: string) {
  return callUserDataTool('user_data_sql_query', { query });
}
`;

  fs.writeFileSync(helperPath, helperContent, 'utf-8');
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
