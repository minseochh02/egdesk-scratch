# Homepage Editor's Chat Database System Architecture

The homepage editor uses a comprehensive **SQLite-based chat database system** to store and manage AI conversations.

## Architecture Overview

### Three-Tier System

1. **Frontend (Renderer)** - React component with UI (`AIChat.tsx`)
2. **IPC Bridge** - Electron IPC handlers for cross-process communication
3. **Backend (Main)** - SQLite database with operations layer

## Database Schema

### Two Main Tables

#### 1. `conversations` Table
- `id` (TEXT PRIMARY KEY) - Unique conversation identifier
- `title` (TEXT) - Conversation title
- `created_at` (DATETIME) - Creation timestamp
- `updated_at` (DATETIME) - Last update timestamp
- `project_context` (TEXT) - JSON string storing project context
- `is_active` (BOOLEAN) - Active/archived status

#### 2. `messages` Table
- `id` (TEXT PRIMARY KEY) - Unique message identifier
- `conversation_id` (TEXT) - Foreign key to conversations
- `role` (TEXT) - Either 'user', 'model', or 'tool'
- `content` (TEXT) - Message content
- `timestamp` (DATETIME) - Message timestamp
- `tool_call_id` (TEXT) - Optional tool execution ID
- `tool_status` (TEXT) - Tool execution status ('executing', 'completed', 'failed')
- `metadata` (TEXT) - JSON string for additional data

### Performance Optimizations
- Indexes on `conversation_id`, `timestamp`, `role`, `updated_at`, `is_active`
- Automatic timestamp updates via triggers
- Foreign key constraints with CASCADE delete

## Key Components

### 1. Database Layer
**Location:** `src/main/sqlite/ai.ts`

- `AIChatDatabase` class with CRUD operations
- Conversation management (create, read, update, delete, archive, restore)
- Message management (add single/bulk, read, update, delete)
- Statistics and analytics (conversation stats, overall stats)
- Cleanup operations (old data removal, full wipe)

### 2. IPC Service Layer
**Location:** `src/main/ai-code/ai-chat-data-service.ts`

- Singleton service exposing database operations via Electron IPC
- 20+ IPC handlers for all database operations
- Initialization handling and error management
- Database availability checks

### 3. Frontend Service
**Location:** `src/renderer/services/ai-chat-data-service.ts`

- Client-side wrapper for IPC calls
- Type-safe API matching backend operations
- Conversion utilities between `AIMessage` ↔ `ConversationMessage` formats

### 4. UI Component
**Location:** `src/renderer/components/HomepageEditor/AIChatInterface/AIChat.tsx`

- React component consuming the chat data service
- Conversation history browsing
- Message display and filtering
- Statistics dashboard (total conversations, active count, message count, DB size)

## Data Flow

1. **Storing Messages:** UI → Renderer Service → IPC → Main Service → SQLite DB
2. **Loading History:** SQLite DB → Main Service → IPC → Renderer Service → UI
3. **Autonomous Conversations:** Messages saved in real-time as AI processes requests

## Features

### Conversation Management
- Create new conversations with project context
- Archive/restore conversations
- Filter by active status or project
- Load conversation history with pagination

### Message Management
- Store user, model, and tool messages
- Track tool execution status
- Bulk message insertion
- Message filtering by role

### Analytics
- Per-conversation stats (message counts by role, timestamps, tool calls)
- Overall stats (total conversations, active count, DB size)
- Query performance via indexed fields

### Data Lifecycle
- Auto-cleanup of old archived conversations (configurable retention)
- Orphaned message cleanup
- Full data wipe capability

## Integration with AI Features

The database seamlessly integrates with:
- **Autonomous conversations** - Real-time message storage during AI interactions
- **Tool execution tracking** - Status updates for file operations, commands, etc.
- **Project context** - Conversations tied to specific projects
- **Backup system** - Works with the backup manager for conversation reverts

## Design Benefits

This architecture provides:
- **Robust persistence** - All conversations survive app restarts
- **Scalability** - Efficient indexing for large conversation histories
- **Data integrity** - Foreign key constraints and transactions
- **Type safety** - Strongly typed interfaces across all layers
- **Performance** - Optimized queries with proper indexing
- **Maintainability** - Clear separation of concerns across layers

## Current Limitations & Planned Improvements

### Project-Based Chat Organization

**Current State:**
- The `conversations` table has a `project_context` field (JSON string)
- Database layer supports filtering by `projectContext` parameter
- UI does **NOT** currently filter conversations by project - all conversations are shown together

**Needed Improvements:**
- Add explicit `project_name` column (TEXT, optional) to `conversations` table
- Add explicit `project_folder_path` column (TEXT, optional) to `conversations` table
- Update UI to group/filter conversations by project
- Add index on `project_folder_path` for better query performance

**Benefits:**
- Clear project association without parsing JSON
- Easier querying and filtering
- Better UI organization with project-based conversation grouping
- Cleaner data model with explicit columns instead of JSON parsing

### Tool System Architecture - No MCP Integration

**Current State:**
The AI chat uses a **completely separate, built-in tool system** and does NOT use MCP (Model Context Protocol) servers.

**How Tools Are Exposed:**

1. **Tool Registry** (`src/main/ai-code/tool-executor.ts`)
   - Hardcoded registry in the `ToolRegistry` class
   - Tools registered in `registerBuiltinTools()` method
   - Currently includes:
     - **File system tools**: read_file, write_file, list_directory, move_file, partial_edit
     - **Shell tools**: shell_command
     - **Project tools**: analyze_project, init_project
     - **Apps Script tools**: 20+ tools for Google Apps Script operations
     - **User Data tools**: query, search, aggregate imported tables

2. **Tool Exposure to AI** (`src/main/ai-code/gemini-autonomous-client.ts`)
   ```typescript
   // Tools are converted to Gemini's function calling format
   availableTools = toolRegistry.getToolDefinitions()
   const geminiTools = this.convertToolsForGemini(availableTools);
   // Passed directly to Gemini API in generateContent() call
   ```

3. **Tool Execution Flow**
   - AI calls a tool → `toolRegistry.executeToolCall()`
   - Each tool implements the `ToolExecutor` interface
   - Tools directly access services (file system, Apps Script service, etc.)

**MCP Servers - Separate System:**
- MCP servers exist in `src/main/mcp/` but serve a **different purpose**
- Designed for **Claude Desktop** to connect via stdio protocol
- Expose Gmail, Sheets, Apps Script data to external Claude clients
- **NOT connected** to the internal AI chat interface

**Key Limitation:**
The AI chat **cannot dynamically discover** or use MCP tools. New tools must be:
1. Manually coded as `ToolExecutor` classes
2. Registered in `ToolRegistry.registerBuiltinTools()`
3. Parameter schemas manually defined in `getParameterSchema()`

**Path to MCP Integration:**
To enable MCP tool discovery, would need to build a bridge that:
- Discovers available MCP servers
- Translates MCP tool definitions → Gemini function declarations
- Routes tool calls from AI → MCP servers → back to AI
- Handles MCP stdio communication protocol

## API Endpoint Support for Tunneled Projects

### @egdesk/vite-api-plugin

EGDesk includes a custom Vite plugin (`@egdesk/vite-api-plugin`) that enables API endpoint support for projects served through the tunneling service.

**Location:** `/packages/vite-api-plugin/`

### Automatic Installation

When EGDesk starts a Vite project, it automatically:

1. Checks if `@egdesk/vite-api-plugin` is installed
2. If not installed, automatically installs it as a dev dependency
3. Uses the local package from `packages/vite-api-plugin` (installed via `file:` protocol)

**Implementation:** `src/main/coding/dev-server-manager.ts:ensureViteApiPlugin()`

### How It Works

The plugin handles API routing for both local development and tunneled environments:

**Local Development (no --base flag):**
- Request: `GET /api/users`
- Plugin matches: `/api/users`
- Handler executes

**Tunneled Development (with --base /t/{id}/p/{name}):**
- Request: `GET /t/vicky-cha4/p/myproject/api/users`
- Plugin extracts: `/api/users`
- Handler executes

### Usage

Once installed, add the plugin to `vite.config.ts`:

```typescript
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';

export default defineConfig({
  plugins: [
    viteApiPlugin({
      routes: [
        {
          path: '/api/users',
          method: 'GET',
          handler: (req, res) => {
            jsonResponse(res, { users: [...] });
          }
        },
        {
          path: '/api/users',
          method: 'POST',
          handler: (req, res, body) => {
            // Create user with body data
            jsonResponse(res, { success: true }, 201);
          }
        }
      ]
    })
  ]
});
```

### Frontend Integration

Use Vite's `BASE_URL` to construct API paths that work in both environments:

```typescript
const apiUrl = (endpoint: string) => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return `${base}${path}`;
};

// Usage
const response = await fetch(apiUrl('api/users'));
```

### Benefits

- **Zero Manual Configuration:** Automatically installed when Vite project starts
- **Works Everywhere:** Same code works locally and through tunnel
- **Type-Safe:** Full TypeScript support
- **Simple API:** Clean route definition syntax
- **Auto Body Parsing:** Automatically parses JSON for POST/PUT/PATCH requests

### File Structure

```
packages/vite-api-plugin/
├── src/
│   └── index.ts           # Plugin implementation
├── dist/                  # Compiled output
│   ├── index.js
│   ├── index.d.ts
│   └── index.d.ts.map
├── examples/
│   ├── vite.config.example.ts
│   └── App.example.tsx
├── package.json
├── tsconfig.json
└── README.md
```

### See Also

- Plugin README: `/packages/vite-api-plugin/README.md`
- Example config: `/packages/vite-api-plugin/examples/vite.config.example.ts`
- Example React app: `/packages/vite-api-plugin/examples/App.example.tsx`

## Accessing EGDesk SQLite Data from Tunneled Projects

### Overview

Tunneled Vite projects can access EGDesk's SQLite databases (user-data, financehub, etc.) via EGDesk's HTTP MCP server.

### Architecture

```
┌─────────────────────┐
│   Vite Project      │
│  (via Tunnel)       │
│                     │
│  API Routes in      │
│  vite.config.js     │
└──────────┬──────────┘
           │ HTTP calls to localhost:8080
           ▼
┌─────────────────────┐
│   EGDesk            │
│   HTTP MCP Server   │
│   (Port 8080)       │
└──────────┬──────────┘
           │ Calls MCP tools
           ▼
┌─────────────────────┐
│ UserDataMCPService  │
│                     │
│ ├─ list_tables      │
│ ├─ get_schema       │
│ ├─ query            │
│ ├─ search           │
│ ├─ aggregate        │
│ └─ sql_query        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SQLite Database    │
│  user_data.db       │
└─────────────────────┘
```

### HTTP MCP Server

**Location:** `src/main/mcp/server-creator/local-server-manager.ts`

**Default Port:** 8080 (configurable in EGDesk settings)

**Endpoints:**
- `GET /user-data/tools` - List available MCP tools
- `POST /user-data/tools/call` - Call an MCP tool

### Available MCP Tools

#### user_data_list_tables
List all imported data tables with metadata

```javascript
const result = await callUserDataTool('user_data_list_tables');
// Returns: { totalTables, tables: [...] }
```

#### user_data_get_schema
Get column definitions for a table

```javascript
const result = await callUserDataTool('user_data_get_schema', {
  tableName: 'my_table'
});
// Returns: { tableName, displayName, schema, rowCount, columnCount }
```

#### user_data_query
Query data with filters, sorting, pagination

```javascript
const result = await callUserDataTool('user_data_query', {
  tableName: 'my_table',
  filters: { status: 'active', age: '>30' },
  limit: 100,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'DESC'
});
// Returns: { tableName, rows, total, limit, offset, hasMore }
```

#### user_data_search
Full-text search across all columns

```javascript
const result = await callUserDataTool('user_data_search', {
  tableName: 'my_table',
  searchQuery: 'search term',
  limit: 50
});
// Returns: { tableName, searchQuery, rows, total, matchCount }
```

#### user_data_aggregate
Compute aggregations (SUM, AVG, MIN, MAX, COUNT)

```javascript
const result = await callUserDataTool('user_data_aggregate', {
  tableName: 'sales',
  column: 'amount',
  function: 'SUM',
  filters: { status: 'completed' },
  groupBy: 'category'
});
// Returns: { tableName, column, function, value, groupedResults? }
```

#### user_data_sql_query
Execute raw SQL SELECT queries (read-only)

```javascript
const result = await callUserDataTool('user_data_sql_query', {
  query: 'SELECT * FROM my_table WHERE status = "active" LIMIT 10'
});
// Returns: { query, rows, columns, rowCount }
```

### Integration Pattern

**Step 1: Add API routes in vite.config.js**

```javascript
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';

const EGDESK_API_BASE = 'http://localhost:8080';

async function callUserDataTool(toolName, args = {}) {
  const response = await fetch(`${EGDESK_API_BASE}/user-data/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, args })
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error);

  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

export default defineConfig({
  plugins: [
    viteApiPlugin({
      routes: [
        {
          path: '/api/userdata/tables',
          method: 'GET',
          handler: async (req, res) => {
            const result = await callUserDataTool('user_data_list_tables');
            jsonResponse(res, { success: true, tables: result.tables });
          }
        },
        {
          path: '/api/userdata/query',
          method: 'POST',
          handler: async (req, res, body) => {
            const result = await callUserDataTool('user_data_query', body);
            jsonResponse(res, { success: true, data: result });
          }
        }
      ]
    })
  ]
});
```

**Step 2: Use in React components**

```javascript
const apiUrl = (endpoint) => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  return `${base}/${endpoint}`;
};

function MyComponent() {
  const [tables, setTables] = useState([]);

  useEffect(() => {
    async function fetchTables() {
      const response = await fetch(apiUrl('api/userdata/tables'));
      const result = await response.json();
      setTables(result.tables);
    }
    fetchTables();
  }, []);

  return <div>{/* Display tables */}</div>;
}
```

### Automatic Configuration

**New Feature:** The vite-api-plugin now **automatically discovers and configures** your EGDesk user-data tables when your Vite dev server starts. This eliminates all manual setup and provides type-safe access to your imported data.

**Complete Workflow:**

When EGDesk starts a Vite project, the following happens automatically:

1. **Plugin Installation** - `dev-server-manager.ts:ensureViteApiPlugin()`
   - Checks if `@egdesk/vite-api-plugin` is installed
   - If not, installs via `file:` protocol from `packages/vite-api-plugin`
   - Writes API key to `.env.local` from `mcpConfiguration.tunnel.apiKey`
   - Injects plugin into `vite.config.js` if not already present

2. **Vite Startup** - Plugin's `buildStart` hook executes
   - Reads API key from `.env.local` (Vite hasn't loaded env vars yet at this point)
   - Calls `user_data_list_tables` via HTTP MCP server
   - For each discovered table, calls `user_data_get_schema` to get column names

3. **File Generation** - Three files created in project root
   - `.env.egdesk` - Environment variables (table names, API key)
   - `egdesk.config.ts` - Type-safe table definitions with column names
   - `egdesk-helpers.ts` - Helper functions (queryTable, searchTable, etc.)

**Implementation Details:**

**Key Files:**
- `src/main/coding/dev-server-manager.ts:writeEGDeskEnv()` - Writes API key to `.env.local`
- `src/main/coding/dev-server-manager.ts:injectViteApiPlugin()` - Injects plugin into vite.config.js
- `packages/vite-api-plugin/src/index.ts:buildStart()` - Auto-discovery hook
- `packages/vite-api-plugin/src/setup-userdata.ts:discoverTables()` - Discovery logic

**Critical Implementation Note - MCP Tool Arguments:**
The HTTP MCP server expects tool arguments to be sent as `arguments` (not `args`):

```javascript
// ✅ Correct
body: JSON.stringify({
  tool: 'user_data_list_tables',
  arguments: {}
})

// ❌ Wrong (will fail silently)
body: JSON.stringify({
  tool: 'user_data_list_tables',
  args: {}
})
```

This is because `local-server-manager.ts:handleUserDataToolCall()` destructures:
```javascript
const { tool, arguments: args } = body;
```

**API Key Authentication:**
The plugin reads the API key from `.env.local` in the `buildStart` hook because Vite hasn't loaded environment variables yet:

```typescript
// packages/vite-api-plugin/src/index.ts
async buildStart() {
  // Read API key from .env.local (Vite hasn't loaded env vars yet)
  const projectPath = process.cwd();
  const envVars = readEnvLocal(projectPath);
  const actualApiKey = envVars.apiKey || egdeskApiKey;

  const tables = await discoverTables(actualApiUrl, actualApiKey);
  // ...
}
```

**Real Example - Generated Files:**

From actual test with Korean sales data (6,718 rows, 26 columns):

`.env.egdesk`:
```env
# EGDesk User Data Configuration
# Generated at: 2026-02-20T06:44:58.552Z

# EGDesk HTTP MCP Server
VITE_EGDESK_API_URL=http://localhost:8080

# API Key (if required)
# VITE_EGDESK_API_KEY=your-api-key-here

# Available Tables
# Total tables: 1
# 1. ka78vf6wn364hxr (ka78vf6wn364hxr) - 6718 rows, 26 columns

# Table Names (use these in your code)
VITE_TABLE_1_NAME=ka78vf6wn364hxr

# Main table (if you have one primary table)
VITE_MAIN_TABLE=ka78vf6wn364hxr
```

`egdesk.config.ts`:
```typescript
export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: undefined,
} as const;

export const TABLES = {
  table1: {
    name: 'ka78vf6wn364hxr',
    displayName: 'ka78vf6wn364hxr',
    description: undefined,
    rowCount: 6718,
    columnCount: 26,
    columns: [
      'id', '일자', '거래처그룹1코드명', '세무신고거래처코드',
      '거래처코드', '담당자코드명', '판매처명', '품목코드',
      '품목명_규격_', '단위', '규격명', '수량', '중량', '단가',
      '공급가액', '합_계', '품목그룹1코드', '품목그룹2명',
      '품목그룹3코드', '창고명', '거래처그룹2명', '신규일',
      '적요', '적요2', '코드변경', '실납업체'
    ]
  } as TableDefinition
} as const;

// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;

// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
  table1: 'ka78vf6wn364hxr'
} as const;
```

`egdesk-helpers.ts`:
```typescript
/**
 * EGDesk User Data Helper Functions
 * Type-safe helpers for accessing EGDesk user data.
 */
import { EGDESK_CONFIG } from './egdesk.config';

export async function callUserDataTool(
  toolName: string,
  args: Record<string, any> = {}
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (EGDESK_CONFIG.apiKey) {
    headers['X-Api-Key'] = EGDESK_CONFIG.apiKey;
  }

  const response = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool: toolName, arguments: args })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Tool call failed');
  }

  // Parse MCP response format
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

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

export async function executeSQL(query: string) {
  return callUserDataTool('user_data_sql_query', { query });
}
```

**Usage After Auto-Discovery:**

Example using the auto-discovered Korean sales data table:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';
import { queryTable, searchTable, aggregateTable } from './egdesk-helpers';
import { TABLES } from './egdesk.config';

export default defineConfig({
  plugins: [
    react(),
    viteApiPlugin({
      routes: [
        // Get all sales records with pagination
        {
          path: '/api/sales/all',
          method: 'GET',
          handler: async (req, res) => {
            const data = await queryTable(TABLES.table1.name, {
              limit: 100,
              offset: 0,
              orderBy: '일자', // Date column
              orderDirection: 'DESC'
            });
            jsonResponse(res, data);
          }
        },

        // Search sales by customer name
        {
          path: '/api/sales/search',
          method: 'POST',
          handler: async (req, res, body) => {
            const { query } = body;
            const results = await searchTable(TABLES.table1.name, query, 50);
            jsonResponse(res, results);
          }
        },

        // Get total sales amount
        {
          path: '/api/sales/total',
          method: 'GET',
          handler: async (req, res) => {
            const total = await aggregateTable(
              TABLES.table1.name,
              '공급가액', // Supply amount column
              'SUM'
            );
            jsonResponse(res, total);
          }
        },

        // Get sales by customer (grouped)
        {
          path: '/api/sales/by-customer',
          method: 'GET',
          handler: async (req, res) => {
            const results = await aggregateTable(
              TABLES.table1.name,
              '공급가액',
              'SUM',
              { groupBy: '판매처명' } // Group by customer name
            );
            jsonResponse(res, results);
          }
        }
      ]
    })
  ]
});
```

**Frontend Usage:**

```javascript
// React component using auto-discovered table
import { useEffect, useState } from 'react';
import { TABLES, TABLE_NAMES } from './egdesk.config';

function SalesData() {
  const [sales, setSales] = useState([]);

  useEffect(() => {
    async function fetchSales() {
      const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL.slice(0, -1)
        : import.meta.env.BASE_URL;

      const response = await fetch(`${baseUrl}/api/sales/all`);
      const data = await response.json();
      setSales(data.rows);
    }
    fetchSales();
  }, []);

  return (
    <div>
      <h1>Sales Data - {TABLES.table1.displayName}</h1>
      <p>Total rows: {TABLES.table1.rowCount}</p>
      <p>Columns: {TABLES.table1.columnCount}</p>

      <table>
        <thead>
          <tr>
            {TABLES.table1.columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map(row => (
            <tr key={row.id}>
              {TABLES.table1.columns.map(col => (
                <td key={col}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Plugin Configuration:**

```typescript
// vite.config.ts
viteApiPlugin({
  // Auto-setup enabled by default
  autoSetupUserData: true,

  // Customize EGDesk HTTP server URL
  egdeskUrl: process.env.VITE_EGDESK_API_URL || 'http://localhost:8080',

  // API key (auto-discovered from MCP server)
  egdeskApiKey: process.env.VITE_EGDESK_API_KEY,

  // Your routes
  routes: [...]
})
```

**Benefits:**
- Zero manual configuration required
- Type-safe access to table names and columns
- Auto-updates when tables change (just restart Vite server)
- Works seamlessly with API routes
- No need to hardcode table names or column names
- Supports Korean and other Unicode column names
- All helpers are type-safe with TypeScript

**Troubleshooting:**

**Issue: "Unauthorized" error during auto-discovery**
- **Cause**: API key not found or not being sent correctly
- **Solution**: Check that `.env.local` contains `VITE_EGDESK_API_KEY`
- **Location**: `dev-server-manager.ts:writeEGDeskEnv()` writes this file
- **Debug**: Look for log message "✓ EGDesk environment variables written to .env.local"

**Issue: "No user-data tables found" even though tables exist**
- **Cause**: Using `args` instead of `arguments` in MCP tool calls
- **Solution**: Always use `arguments` when calling HTTP MCP server:
  ```javascript
  // ✅ Correct
  body: JSON.stringify({ tool: 'user_data_list_tables', arguments: {} })

  // ❌ Wrong
  body: JSON.stringify({ tool: 'user_data_list_tables', args: {} })
  ```
- **Why**: `local-server-manager.ts` destructures as `const { tool, arguments: args } = body`

**Issue: Plugin not injecting into vite.config.js**
- **Cause**: Plugin already imported but not added to plugins array
- **Solution**: `injectViteApiPlugin()` checks if plugin is called in plugins array
- **Location**: `dev-server-manager.ts:injectViteApiPlugin()`
- **Debug**: Check vite.config.js has both import and usage:
  ```javascript
  import { viteApiPlugin } from '@egdesk/vite-api-plugin'; // Import
  plugins: [viteApiPlugin({ ... })] // Usage
  ```

**Issue: Electron Store "not valid JSON" error**
- **Cause**: Creating new `Store()` without encryption key
- **Solution**: Use `getStore()` from `storage.ts` instead
- **Correct**:
  ```javascript
  import { getStore } from '../storage';
  const store = getStore();
  ```
- **Wrong**:
  ```javascript
  import Store from 'electron-store';
  const store = new Store(); // Missing encryption key
  ```

**Testing Auto-Discovery:**

To verify auto-discovery is working:

1. **Check console output** when starting Vite project:
   ```
   [vite-api-plugin] 🔍 Auto-discovering EGDesk user-data tables...
   [vite-api-plugin] Using API URL: http://localhost:8080
   [vite-api-plugin] Using API Key: b3f449ce...
   [DEBUG] Total tables: 1
   ✅ Auto-discovered 1 table(s) and generated config files
   ```

2. **Verify generated files** exist in project root:
   ```bash
   ls -la .env.egdesk egdesk.config.ts egdesk-helpers.ts
   ```

3. **Check file contents**:
   ```bash
   cat egdesk.config.ts
   # Should show your actual table names and columns
   ```

4. **Test in browser** - Navigate to tunnel URL:
   ```
   https://tunneling-service.onrender.com/t/{tunnel}/p/{project}/
   ```

5. **Check API endpoints** work:
   ```bash
   curl https://tunneling-service.onrender.com/t/{tunnel}/p/{project}/api/sales/all
   ```

**Expected Debug Output:**

When auto-discovery runs successfully, you'll see:
```
[DEBUG] List tables response: {
  "success": true,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"totalTables\": 1,\n  \"tables\": [\n    {\n      \"id\": \"...\",\n      \"tableName\": \"ka78vf6wn364hxr\",\n      \"displayName\": \"ka78vf6wn364hxr\",\n      \"rowCount\": 6718,\n      \"columnCount\": 26,\n      ...\n    }\n  ]\n}"
      }
    ]
  }
}

[DEBUG] Parsed data: {
  "totalTables": 1,
  "tables": [ ... ]
}

✅ Generated /Users/.../project/.env.egdesk
✅ Generated /Users/.../project/egdesk.config.ts
✅ Generated /Users/.../project/egdesk-helpers.ts
```

### Prerequisites

1. **EGDesk HTTP MCP server must be running**
   - Start in EGDesk settings → MCP Servers
   - Default port: 8080
   - Verify it's running: Check for log "📨 Incoming request: POST /user-data/tools/call"

2. **user-data MCP server must be enabled**
   - Enable in EGDesk settings → MCP Servers → user-data
   - Verify it's working: Check for log "🗄️ Calling User Data tool: user_data_list_tables"

3. **Import data into EGDesk**
   - Import Excel/CSV files via EGDesk UI
   - Data becomes available as queryable tables
   - Verify: Run `user_data_list_tables` should return at least one table

### Security Considerations

- HTTP server runs on `localhost` by default (only accessible locally)
- API key authentication required via `X-Api-Key` header
- API key is auto-generated UUID stored in `mcpConfiguration.tunnel.apiKey`
- User-data tools are read-only (SELECT queries only)
- SQL injection protection via parameterized queries
- `.env.local` should be added to `.gitignore` to protect API keys

### Complete Automatic Workflow Summary

**End-to-End Flow (User Perspective):**

1. User imports CSV/Excel into EGDesk → Creates user-data table
2. User starts a Vite project in EGDesk
3. **Everything happens automatically - no manual steps needed**
4. User can immediately use type-safe helpers to query their data

**Behind the Scenes (Implementation):**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "Start Dev Server" in EGDesk                │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. dev-server-manager.ts:startServer()                      │
│    - Checks if Vite project                                 │
│    - Calls ensureViteApiPlugin()                            │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ensureViteApiPlugin()                                    │
│    - Installs plugin: npm install file:../../packages/...  │
│    - Writes .env.local with API key from store             │
│    - Injects plugin into vite.config.js                     │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Vite starts, plugin.buildStart() executes                │
│    - Reads API key from .env.local                          │
│    - Calls user_data_list_tables                            │
│    - For each table: calls user_data_get_schema             │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. discoverTables() generates files                         │
│    - .env.egdesk (table names, metadata)                    │
│    - egdesk.config.ts (type-safe table definitions)         │
│    - egdesk-helpers.ts (query/search/aggregate helpers)     │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Vite dev server ready                                    │
│    - User can import { TABLES } from './egdesk.config'      │
│    - User can use queryTable(), searchTable(), etc.         │
│    - All table names and columns are type-safe              │
└─────────────────────────────────────────────────────────────┘
```

**Key Files Modified/Created:**

**EGDesk Side:**
- `src/main/coding/dev-server-manager.ts` - Orchestrates auto-setup
- `packages/vite-api-plugin/src/index.ts` - Plugin with buildStart hook
- `packages/vite-api-plugin/src/setup-userdata.ts` - Discovery logic

**User Project Side (Auto-generated):**
- `.env.local` - API key for authentication
- `vite.config.js` - Plugin injected
- `.env.egdesk` - Table metadata
- `egdesk.config.ts` - Type-safe table definitions
- `egdesk-helpers.ts` - Query helper functions

**Result:**
User writes zero configuration code and gets full type-safe access to their imported data with auto-complete for table names and column names (including Korean/Unicode).

### Manual Setup (Optional)

While auto-discovery happens automatically, users can manually trigger setup if needed:

**CLI Command:**
```bash
npx egdesk-setup
npx egdesk-setup --api-key YOUR_KEY
npx egdesk-setup --url http://localhost:8080
```

**When to Use Manual Setup:**
- Re-generate config files after importing new tables
- Regenerate after deleting/renaming tables
- Set up config in a project that wasn't started via EGDesk

**Implementation:**
- Binary: `packages/vite-api-plugin/bin/setup-userdata.js`
- Same logic as auto-discovery, but runs on-demand
- Useful for updating config without restarting Vite server

### Examples

- Full vite config example: `/packages/vite-api-plugin/examples/egdesk-userdata-example.ts`
- React component example: See oneconductor project `UserDataExample.jsx`
- Working vite config: `oneconductor/vite.config.userdata.example.js`