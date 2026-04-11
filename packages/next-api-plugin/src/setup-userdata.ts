/**
 * User Data Setup Utility for Next.js
 *
 * Automatically discovers EGDesk user-data tables and generates configuration
 * for Next.js projects to access them.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UserDataTable {
  id: string;
  tableName: string;
  displayName: string;
  description?: string;
  /** May be unknown until the table is synced or counted */
  rowCount?: number;
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

    if (!data || !data.tables) {
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
 * Read existing .env.local file or return empty object
 */
export function readEnvLocal(projectPath: string): Record<string, string> {
  const envPath = path.join(projectPath, '.env.local');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars: Record<string, string> = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return envVars;
}

/**
 * Update .env.local file with Next.js environment variables
 */
export function updateEnvLocal(
  projectPath: string,
  config: UserDataConfig
): void {
  const envPath = path.join(projectPath, '.env.local');
  const existingVars = readEnvLocal(projectPath);

  // Merge with existing vars, prioritizing new EGDesk values
  const newVars = {
    ...existingVars,
    'NEXT_PUBLIC_EGDESK_API_URL': config.baseUrl,
    ...(config.apiKey && { 'NEXT_PUBLIC_EGDESK_API_KEY': config.apiKey })
  };

  const envContent = [
    '# EGDesk User Data Configuration',
    `# Generated at: ${config.generatedAt}`,
    '',
    ...Object.entries(newVars).map(([key, value]) => `${key}=${value}`),
    '',
    '# Available Tables',
    `# Total tables: ${config.tables.length}`,
    ...config.tables.map((table, index) =>
      `# ${index + 1}. ${table.displayName} (${table.tableName}) - ${table.rowCount != null ? table.rowCount : '?'} rows, ${table.columnCount} columns`
    ),
    ''
  ].join('\n');

  fs.writeFileSync(envPath, envContent.replace(/\r?\n/g, os.EOL), 'utf-8');
  console.log(`✅ Updated ${envPath}`);
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
  /** Omitted or unknown until synced / counted */
  rowCount?: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
${config.tables.map((table, index) => {
  const properties = [
    `name: '${table.tableName}'`,
    `displayName: '${table.displayName}'`,
    table.description ? `description: '${table.description}'` : null,
    table.rowCount != null ? `rowCount: ${table.rowCount}` : null,
    `columnCount: ${table.columnCount}`,
    `columns: [${table.columns.map(col => `'${col}'`).join(', ')}]`
  ].filter(Boolean).join(',\n    ');

  return `  table${index + 1}: {
    ${properties}
  } as TableDefinition`;
}).join(',\n')}
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
