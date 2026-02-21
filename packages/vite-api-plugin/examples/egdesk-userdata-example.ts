/**
 * Example: Accessing EGDesk User Data from Vite Projects
 *
 * This example shows how to query EGDesk's SQLite user-data database
 * from a Vite project running through the tunnel.
 *
 * Prerequisites:
 * 1. EGDesk HTTP MCP server is running (usually on port 8080)
 * 2. user-data MCP server is enabled in EGDesk settings
 * 3. You have imported some data tables in EGDesk (from Excel/CSV)
 */

// ============================================
// Configuration
// ============================================

const EGDESK_API_BASE = 'http://localhost:8080'; // EGDesk HTTP server
const API_KEY = 'your-api-key-here'; // Optional: Set in EGDesk settings

// ============================================
// Helper Functions
// ============================================

/**
 * Call an EGDesk user-data MCP tool
 */
async function callUserDataTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const response = await fetch(`${EGDESK_API_BASE}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Optional: Add API key if configured in EGDesk
      // 'X-Api-Key': API_KEY
    },
    body: JSON.stringify({
      tool: toolName,
      args
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to call tool ${toolName}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Unknown error');
  }

  // Parse the result content (MCP format)
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

/**
 * List all available MCP tools
 */
async function listUserDataTools(): Promise<any[]> {
  const response = await fetch(`${EGDESK_API_BASE}/user-data/tools`);

  if (!response.ok) {
    throw new Error(`Failed to list tools: ${response.statusText}`);
  }

  const result = await response.json();
  return result.tools || [];
}

// ============================================
// Example Usage
// ============================================

/**
 * Example 1: List all imported tables
 */
export async function listAllTables() {
  const result = await callUserDataTool('user_data_list_tables');

  console.log('📊 Available tables:', result.tables);
  console.log('Total tables:', result.totalTables);

  return result.tables;
}

/**
 * Example 2: Get schema for a specific table
 */
export async function getTableSchema(tableName: string) {
  const result = await callUserDataTool('user_data_get_schema', { tableName });

  console.log('📋 Schema for', tableName);
  console.log('Columns:', result.schema);
  console.log('Row count:', result.rowCount);

  return result;
}

/**
 * Example 3: Query data with filters
 */
export async function queryTableData(
  tableName: string,
  filters?: Record<string, string>,
  limit: number = 100,
  offset: number = 0
) {
  const result = await callUserDataTool('user_data_query', {
    tableName,
    filters,
    limit,
    offset,
    orderBy: 'id',
    orderDirection: 'DESC'
  });

  console.log('📊 Query results:', result.rows);
  console.log('Total rows:', result.total);
  console.log('Has more:', result.hasMore);

  return result;
}

/**
 * Example 4: Search across all columns
 */
export async function searchTable(tableName: string, searchQuery: string) {
  const result = await callUserDataTool('user_data_search', {
    tableName,
    searchQuery,
    limit: 50
  });

  console.log('🔍 Search results for:', searchQuery);
  console.log('Matches:', result.matchCount);
  console.log('Rows:', result.rows);

  return result;
}

/**
 * Example 5: Aggregate data (SUM, AVG, COUNT, etc.)
 */
export async function aggregateData(
  tableName: string,
  column: string,
  aggregateFunction: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT',
  filters?: Record<string, string>,
  groupBy?: string
) {
  const result = await callUserDataTool('user_data_aggregate', {
    tableName,
    column,
    function: aggregateFunction,
    filters,
    groupBy
  });

  console.log(`📊 ${aggregateFunction}(${column}):`, result.value);
  if (result.groupedResults) {
    console.log('Grouped results:', result.groupedResults);
  }

  return result;
}

/**
 * Example 6: Execute raw SQL query
 */
export async function executeRawSQL(query: string) {
  const result = await callUserDataTool('user_data_sql_query', { query });

  console.log('💾 SQL query results:');
  console.log('Columns:', result.columns);
  console.log('Rows:', result.rows);
  console.log('Row count:', result.rowCount);

  return result;
}

// ============================================
// React Hook Example
// ============================================

/**
 * React hook to fetch user data tables
 */
export function useUserDataTables() {
  const [tables, setTables] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchTables() {
      try {
        setLoading(true);
        const result = await listAllTables();
        setTables(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tables');
      } finally {
        setLoading(false);
      }
    }

    fetchTables();
  }, []);

  return { tables, loading, error };
}

/**
 * React hook to query table data
 */
export function useTableData(tableName: string, filters?: Record<string, string>) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await queryTableData(tableName, filters);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }

    if (tableName) {
      fetchData();
    }
  }, [tableName, JSON.stringify(filters)]);

  return { data, loading, error };
}

// ============================================
// Usage in Vite Project
// ============================================

/*
// In your vite.config.ts, you can add API routes that proxy to EGDesk:

import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';

viteApiPlugin({
  routes: [
    {
      path: '/api/egdesk/tables',
      method: 'GET',
      handler: async (req, res) => {
        const tables = await listAllTables();
        jsonResponse(res, tables);
      }
    },
    {
      path: '/api/egdesk/query',
      method: 'POST',
      handler: async (req, res, body) => {
        const { tableName, filters } = body;
        const result = await queryTableData(tableName, filters);
        jsonResponse(res, result);
      }
    }
  ]
})

// Then in your React components:

function MyComponent() {
  const { tables } = useUserDataTables();

  return (
    <div>
      <h1>Available Tables</h1>
      {tables.map(table => (
        <div key={table.id}>
          <h2>{table.displayName}</h2>
          <p>Rows: {table.rowCount}</p>
        </div>
      ))}
    </div>
  );
}
*/
