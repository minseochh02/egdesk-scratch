# User Data MCP Server Integration

## Overview

Successfully integrated the User Data MCP Server into the EGDesk MCP infrastructure, enabling AI assistants (Claude, Cursor, etc.) to query and analyze user-imported database tables through the Model Context Protocol.

## Changes Made

### 1. **LocalServerManager Updates** (`src/main/mcp/server-creator/local-server-manager.ts`)

#### Added User Data Database Path Helper
```typescript
function getUserDataDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'user_data.db');
  }
  return process.env.USERDATA_DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/user_data.db';
}
```

#### Added Service Instance Management
```typescript
// Private service instance
private userDataMCPService: UserDataMCPService | null = null;

// Service getter with lazy initialization
private getUserDataMCPService(): UserDataMCPService {
  if (!this.userDataMCPService) {
    const dbPath = getUserDataDatabasePath();
    const Database = require('better-sqlite3');
    const database = new Database(dbPath);
    this.userDataMCPService = new UserDataMCPService(database);
  }
  return this.userDataMCPService;
}
```

#### Added HTTP Request Routing
Added `/user-data` endpoint handling to the request router:
```typescript
// User Data MCP Server endpoints (REST API)
if (url.startsWith('/user-data')) {
  await this.handleUserDataEndpoint(req, res, url);
  return;
}
```

#### Added HTTP Endpoint Handlers
Implemented three handler methods:

1. **`handleUserDataEndpoint()`** - Routes requests and checks if server is enabled
2. **`handleUserDataToolsList()`** - Returns available MCP tools
3. **`handleUserDataToolCall()`** - Executes tool calls with arguments

#### Updated Default MCP Servers List
Added user-data server configuration:
```typescript
{
  name: 'user-data',
  enabled: true, // Enabled by default
  description: 'User Data MCP Server - Query and analyze user-imported database tables (Excel, CSV)'
}
```

### 2. **Available Endpoints Updated**
Added to the endpoint documentation list:
- `GET /user-data/tools` - List available User Data tools
- `POST /user-data/tools/call` - Call a User Data tool

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Assistant (Claude/Cursor)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/MCP Protocol
┌────────────────────────────▼────────────────────────────────────┐
│              LocalServerManager (HTTP Server)                     │
│  - Routes: /user-data/tools, /user-data/tools/call              │
│  - Enable/Disable Server Management                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                UserDataMCPService (MCP Interface)                 │
│  - Implements IMCPService                                         │
│  - Exposes 7 MCP Tools (see below)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│            UserDataDbManager (Database Operations)                │
│  - CRUD operations on user tables                                │
│  - Query, search, aggregate, SQL execution                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│             user_data.db (SQLite Database)                       │
│  - user_tables (metadata)                                        │
│  - import_operations (tracking)                                  │
│  - User-created data tables                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Exposed MCP Tools

The User Data MCP Server exposes 7 tools for AI assistants:

### 1. `user_data_list_tables`
Lists all user-created database tables with metadata
- **Parameters:** None
- **Returns:** Table list with row counts, column counts, creation dates

### 2. `user_data_get_schema`
Gets column definitions and schema for a specific table
- **Parameters:** `tableName` (string)
- **Returns:** Schema array with column names, types, constraints

### 3. `user_data_query`
Queries data from a table with filters, sorting, and pagination
- **Parameters:**
  - `tableName` (required)
  - `filters` (object) - e.g., `{"age": ">30", "status": "active"}`
  - `limit` (number) - max 1000, default 100
  - `offset` (number) - for pagination
  - `orderBy` (string) - column name
  - `orderDirection` - "ASC" or "DESC"
- **Returns:** Rows, total count, pagination info

### 4. `user_data_search`
Full-text search across all columns in a table
- **Parameters:**
  - `tableName` (required)
  - `searchQuery` (required)
  - `limit` (number) - max 1000, default 100
- **Returns:** Matching rows with total count

### 5. `user_data_aggregate`
Computes aggregations (SUM, AVG, MIN, MAX, COUNT) on a column
- **Parameters:**
  - `tableName` (required)
  - `column` (required)
  - `function` (required) - one of: SUM, AVG, MIN, MAX, COUNT
  - `filters` (object) - optional filter conditions
  - `groupBy` (string) - optional grouping column
- **Returns:** Aggregated value(s)

### 6. `user_data_sql_query`
Executes a raw SQL SELECT query (read-only, safe mode)
- **Parameters:** `query` (string) - must be SELECT only
- **Returns:** Rows and column names
- **Security:** Only SELECT allowed, dangerous keywords blocked

### 7. `user_data_export_preview`
Gets a sample of data from a table for export preview
- **Parameters:**
  - `tableName` (required)
  - `limit` (number) - max 100, default 10
- **Returns:** Sample rows, total row count, column names

## Security Features

1. **Read-Only Access:** All MCP tools are read-only (no INSERT/UPDATE/DELETE)
2. **SQL Injection Prevention:** Parameterized queries, keyword filtering
3. **Query Limits:** Maximum 1000 rows per query to prevent memory issues
4. **Table Validation:** Only whitelisted user-created tables are accessible
5. **Enable/Disable Control:** Server can be disabled through IPC handlers

## UI Integration

The user-data server appears in the MCP Server configuration UI (MCPServer component):
- Displayed in the `TunnelAndServerConfig` component
- Shows as: **"User Data MCP Server - Query and analyze user-imported database tables (Excel, CSV)"**
- **Default State:** Enabled
- Users can toggle enable/disable through the UI
- Requires HTTP server to be running

## Testing the Integration

### 1. Start the HTTP Server
```typescript
// From renderer process
await window.electron.invoke('https-server-start', { port: 3100, useHTTPS: false });
```

### 2. List Available Tools
```bash
curl http://localhost:3100/user-data/tools
```

### 3. Call a Tool
```bash
curl -X POST http://localhost:3100/user-data/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "user_data_list_tables",
    "arguments": {}
  }'
```

### 4. Query User Data
```bash
curl -X POST http://localhost:3100/user-data/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "user_data_query",
    "arguments": {
      "tableName": "my_excel_data",
      "filters": {"status": "active"},
      "limit": 50,
      "orderBy": "created_at",
      "orderDirection": "DESC"
    }
  }'
```

## Example Use Cases

### 1. AI-Powered Data Analysis
An AI assistant can:
- List all imported tables
- Explore table schemas
- Query filtered data
- Compute aggregations
- Generate insights and reports

### 2. Natural Language Queries
User: "Show me all customers from New York with orders over $1000"

AI executes:
```json
{
  "tool": "user_data_query",
  "arguments": {
    "tableName": "customers",
    "filters": {
      "city": "New York",
      "order_total": ">1000"
    }
  }
}
```

### 3. Data Exploration
User: "What tables do I have available?"

AI executes:
```json
{
  "tool": "user_data_list_tables",
  "arguments": {}
}
```

## Database Schema

### user_tables (metadata)
```sql
CREATE TABLE user_tables (
  id TEXT PRIMARY KEY,
  table_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  created_from_file TEXT,
  row_count INTEGER DEFAULT 0,
  column_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  schema_json TEXT NOT NULL
)
```

### import_operations (tracking)
```sql
CREATE TABLE import_operations (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  rows_imported INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (table_id) REFERENCES user_tables(id) ON DELETE CASCADE
)
```

## Benefits

1. **Seamless Integration:** Works with existing MCP infrastructure
2. **Consistent API:** Follows same patterns as other MCP servers (gmail, sheets, etc.)
3. **User-Friendly:** AI assistants can query user data naturally
4. **Secure:** Read-only access with comprehensive security measures
5. **Performant:** Pagination, limits, and efficient SQLite queries
6. **Extensible:** Easy to add new tools in the future

## Future Enhancements

1. **Write Operations:** Add MCP tools for updating data (with proper permissions)
2. **Join Operations:** Cross-table queries and relationships
3. **Export Tools:** Direct export to CSV, Excel, JSON formats
4. **Visualization:** Generate charts and graphs from query results
5. **Scheduled Queries:** Automated data analysis and reports
6. **Data Validation:** Schema validation and data quality checks

## Related Files

- **MCP Service:** `src/main/mcp/user-data/user-data-mcp-service.ts`
- **Database Manager:** `src/main/sqlite/user-data.ts`
- **Database Schema:** `src/main/sqlite/user-data-init.ts`
- **Server Manager:** `src/main/mcp/server-creator/local-server-manager.ts`
- **UI Component:** `src/renderer/components/MCPServer/MCPServer.tsx`
- **Types:** `src/main/user-data/types.ts`

## Conclusion

The User Data MCP Server is now fully integrated and operational, providing AI assistants with powerful capabilities to query and analyze user-imported data through a secure, standardized MCP interface. The integration follows EGDesk's architectural patterns and is ready for production use.
