"use strict";
/**
 * User Data Setup Utility for Next.js
 *
 * Automatically discovers EGDesk user-data tables and generates configuration
 * for Next.js projects to access them.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverTables = discoverTables;
exports.readEnvLocal = readEnvLocal;
exports.updateEnvLocal = updateEnvLocal;
exports.generateConfigFile = generateConfigFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Fetch available tables from EGDesk
 */
async function discoverTables(egdeskUrl = 'http://localhost:8080', apiKey) {
    try {
        const headers = {
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
        if (!data || !data.tables) {
            return [];
        }
        // Fetch schema for each table to get column names
        const tablesWithColumns = [];
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
                        columns: schemaData?.schema?.map((col) => col.name) || []
                    });
                }
            }
            catch (error) {
                console.warn(`Failed to fetch schema for ${table.tableName}:`, error);
                // Add table without column info
                tablesWithColumns.push({
                    ...table,
                    columns: []
                });
            }
        }
        return tablesWithColumns;
    }
    catch (error) {
        console.error('Failed to discover tables:', error);
        throw error;
    }
}
/**
 * Read existing .env.local file or return empty object
 */
function readEnvLocal(projectPath) {
    const envPath = path.join(projectPath, '.env.local');
    if (!fs.existsSync(envPath)) {
        return {};
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
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
function updateEnvLocal(projectPath, config) {
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
        ...config.tables.map((table, index) => `# ${index + 1}. ${table.displayName} (${table.tableName}) - ${table.rowCount} rows, ${table.columnCount} columns`),
        ''
    ].join('\n');
    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log(`✅ Updated ${envPath}`);
}
/**
 * Generate TypeScript config file with table definitions
 */
function generateConfigFile(projectPath, config) {
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
