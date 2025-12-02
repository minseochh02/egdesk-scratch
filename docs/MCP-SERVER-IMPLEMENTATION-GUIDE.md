# MCP Server Implementation Guide

This guide explains how to expose internal functionalities (like Apps Script tools) as a standalone Model Context Protocol (MCP) Server. This architecture allows these tools to be consumed by any MCP-compliant client (Claude Desktop, Cursor, or our internal MCP editor).

We will follow the pattern used by the **File System MCP Server** (`src/main/mcp/file-system/`).

## Architecture Overview

The architecture consists of three main layers:

1.  **Core Service (`*-service.ts`)**: Contains the actual business logic (e.g., reading files, calling APIs). It has no knowledge of MCP.
2.  **MCP Adapter (`*-mcp-service.ts`)**: Implements the `IMCPService` interface. It translates MCP tool calls and resource requests into calls to the Core Service.
3.  **Server Transport (`*-server.ts`)**: Sets up an HTTP server and uses generic handlers (`HTTPStreamHandler` / `SSEMCPHandler`) to manage the MCP protocol connection.

```
[ MCP Client ]  <-- HTTP/SSE -->  [ Server Transport ]  <-->  [ MCP Adapter ]  <-->  [ Core Service ]
```

## Implementation Steps

### Step 1: Define the Core Service

Create a class that encapsulates the raw functionality. This should be independent of MCP types.

**File:** `src/main/mcp/apps-script/apps-script-service.ts` (Example)

```typescript
export class AppsScriptService {
  constructor(private dbPath: string) {}

  async readFile(fileId: string): Promise<string> {
    // Logic to read file from SQLite or API
    return "content";
  }

  async writeFile(fileId: string, content: string): Promise<void> {
    // Logic to write file
  }
  
  // ... other methods
}
```

### Step 2: Create the MCP Service Adapter

Implement the `IMCPService` interface to expose your service as MCP tools and resources.

**File:** `src/main/mcp/apps-script/apps-script-mcp-service.ts`

```typescript
import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { AppsScriptService } from './apps-script-service';

export class AppsScriptMCPService implements IMCPService {
  private service: AppsScriptService;

  constructor() {
    this.service = new AppsScriptService('path/to/db');
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'apps-script-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {} // Tools are enabled by default if listTools is implemented
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'apps_script_read_file',
        description: 'Read content of an Apps Script file',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: { type: 'string', description: 'The ID of the file' }
          },
          required: ['fileId']
        }
      },
      // ... define other tools
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'apps_script_read_file':
          const content = await this.service.readFile(args.fileId);
          return {
            content: [{ type: 'text', text: content }]
          };
        
        // ... handle other tools
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
}
```

### Step 3: Create the Server Entry Point

Set up the HTTP server to handle incoming MCP connections. This uses the standard `HTTPStreamHandler` for modern clients and `SSEMCPHandler` for legacy support.

**File:** `src/main/mcp/apps-script/apps-script-server.ts`

```typescript
import * as http from 'http';
import { AppsScriptMCPService } from './apps-script-mcp-service';
import { HTTPStreamHandler } from '../server-creator/http-stream-handler';
import { SSEMCPHandler } from '../server-creator/sse-handler';

export class AppsScriptMCPServer {
  private mcpService: AppsScriptMCPService;
  private httpStreamHandler: HTTPStreamHandler;
  private sseHandler: SSEMCPHandler;
  private server: http.Server | null = null;

  constructor(private port: number = 3001) {
    this.mcpService = new AppsScriptMCPService();
    this.httpStreamHandler = new HTTPStreamHandler(this.mcpService);
    this.sseHandler = new SSEMCPHandler(this.mcpService);
  }

  async start(): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      const url = req.url || '/';
      const method = req.method || 'GET';

      // 1. Handle HTTP Streaming (Standard MCP)
      if (url === '/mcp' && method === 'POST') {
        await this.httpStreamHandler.handleStream(req, res);
        return;
      }

      // 2. Handle SSE (Legacy/Browser)
      if (url === '/sse' && method === 'GET') {
        await this.sseHandler.handleSSEStream(req, res);
        return;
      }
      if (url === '/message' && method === 'POST') {
        await this.sseHandler.handleMessage(req, res);
        return;
      }

      // 3. Server Info
      if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          name: 'Apps Script MCP Server',
          endpoints: {
            mcp: 'POST /mcp',
            sse: 'GET /sse'
          }
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.server.listen(this.port, () => {
      console.log(`✅ Apps Script MCP Server running on port ${this.port}`);
    });
  }
  
  async stop() {
    this.server?.close();
  }
}
```

## Multi-Project Support

Since there can be multiple Apps Script projects (Template Copies), the MCP server needs a strategy to handle them. We cannot assume a single implicit "current project" because the MCP client (e.g., Cursor) is decoupled from the UI.

We will use a **Resource + Tool** approach:

### 1. Expose Projects as Resources
The server should list available projects so the AI knows what `copyId`s are valid.

-   **Resource**: `apps-script://projects`
    -   **Content**: JSON list of `{ id, name, spreadsheetUrl, createdAt }`.
    -   **Purpose**: Allows the AI to "see" what projects exist.

-   **Resource**: `apps-script://{copyId}/structure`
    -   **Content**: File tree of that specific project.
    -   **Purpose**: Allows the AI to see files within a project.

### 2. Tools Require `copyId`
All modification tools must explicitly state which project they act upon.

**Tool: `apps_script_list_projects`**
-   **Description**: "List all available Apps Script projects and their IDs."
-   **Returns**: Same data as `apps-script://projects` resource, but accessible as a tool call.

**Tool: `apps_script_read_file`**
```json
{
  "name": "apps_script_read_file",
  "inputSchema": {
    "type": "object",
    "properties": {
      "copyId": { "type": "string", "description": "The ID of the template copy (Apps Script project)" },
      "filePath": { "type": "string", "description": "Path to the file (e.g. Code.gs)" }
    },
    "required": ["copyId", "filePath"]
  }
}
```

**Tool: `apps_script_write_file`**
```json
{
  "name": "apps_script_write_file",
  "inputSchema": {
    "type": "object",
    "properties": {
      "copyId": { "type": "string" },
      "filePath": { "type": "string" },
      "content": { "type": "string" },
      "conversationId": { "type": "string", "description": "For backup tracking" }
    },
    "required": ["copyId", "filePath", "content"]
  }
}
```

### 3. Simplifying for the AI
To avoid the AI having to constantly guess `copyId`, we can provide a helper tool:

**Tool: `apps_script_set_active_project` (Optional Statefulness)**
-   *Warning*: MCP servers are ideally stateless. If we use this, we must ensure the state persists per-connection or globally.
-   Better approach: The System Prompt in the client should instruct the AI: *"First, list projects. Then, use the relevant `copyId` for all subsequent file operations."*

### Summary of Apps Script MCP Tools

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `apps_script_list_projects` | None | List all available Apps Script projects (template copies). |
| `apps_script_list_files` | `copyId` | List all files in a specific project. |
| `apps_script_read_file` | `copyId`, `filePath` | Read the content of a file. |
| `apps_script_write_file` | `copyId`, `filePath`, `content` | Create or overwrite a file. |
| `apps_script_partial_edit` | `copyId`, `filePath`, `oldString`, `newString` | Perform a search-and-replace edit. |
| `apps_script_delete_file` | `copyId`, `filePath` | Delete a file. |
| `apps_script_rename_file` | `copyId`, `oldFilePath`, `newFilePath` | Rename a file. |

This design ensures full compatibility with multiple projects while keeping the server robust and accessible to any MCP client.
