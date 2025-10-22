# File System MCP Server

A complete Model Context Protocol (MCP) server implementation for file system operations, similar to Claude Desktop's file system tools.

## Features

- 🔐 **Security**: Configurable allowed directories with path validation
- 🌐 **Multiple Transports**: HTTP Streaming and SSE (Server-Sent Events)
- 🛠️ **12 File System Tools**: Read, write, edit, search, and manage files
- 📦 **TypeScript**: Full type safety and IDE support
- ⚡ **Async/Await**: Modern asynchronous API

## Architecture

```
file-system/
├── index.ts                    # Main exports
├── file-system.ts             # MCP Server (HTTP server)
├── file-system-service.ts     # Core file system operations
├── http-stream-handler.ts     # HTTP Streaming transport
├── sse-handler.ts             # SSE transport
├── example.ts                 # Usage examples
└── README.md                  # This file
```

## Quick Start

### 1. Basic Server Setup

```typescript
import { createFileSystemMCPServer } from './mcp/file-system';

const server = createFileSystemMCPServer({
  allowedDirectories: [process.cwd()],
  port: 3000,
  host: 'localhost'
});

await server.start();
```

### 2. Use Service Directly

```typescript
import { FileSystemService } from './mcp/file-system';

const service = new FileSystemService(['/path/to/allowed/dir']);

// Read a file
const content = await service.readFile('file.txt');

// List directory
const entries = await service.listDirectory('.');

// Search files
const results = await service.searchFiles('.', '*.ts');
```

## Available Tools

The MCP server exposes 12 file system tools:

1. **fs_read_file** - Read file contents
   ```json
   {
     "name": "fs_read_file",
     "arguments": {
       "path": "file.txt",
       "encoding": "utf8"
     }
   }
   ```

2. **fs_write_file** - Write or overwrite a file
   ```json
   {
     "name": "fs_write_file",
     "arguments": {
       "path": "file.txt",
       "content": "Hello, world!",
       "encoding": "utf8"
     }
   }
   ```

3. **fs_edit_file** - Make targeted edits
   ```json
   {
     "name": "fs_edit_file",
     "arguments": {
       "path": "file.txt",
       "edits": [
         {
           "type": "search_replace",
           "search": "old text",
           "replace": "new text"
         }
       ]
     }
   }
   ```

4. **fs_list_directory** - List directory contents
   ```json
   {
     "name": "fs_list_directory",
     "arguments": {
       "path": "."
     }
   }
   ```

5. **fs_create_directory** - Create directories
   ```json
   {
     "name": "fs_create_directory",
     "arguments": {
       "path": "new-dir",
       "recursive": true
     }
   }
   ```

6. **fs_move_file** - Move or rename files
   ```json
   {
     "name": "fs_move_file",
     "arguments": {
       "source": "old.txt",
       "destination": "new.txt"
     }
   }
   ```

7. **fs_copy_file** - Copy files
   ```json
   {
     "name": "fs_copy_file",
     "arguments": {
       "source": "original.txt",
       "destination": "copy.txt"
     }
   }
   ```

8. **fs_delete_file** - Delete files or directories
   ```json
   {
     "name": "fs_delete_file",
     "arguments": {
       "path": "file.txt",
       "recursive": false
     }
   }
   ```

9. **fs_search_files** - Search for files
   ```json
   {
     "name": "fs_search_files",
     "arguments": {
       "path": ".",
       "pattern": "*.ts",
       "searchContent": false,
       "maxResults": 100
     }
   }
   ```

10. **fs_get_file_info** - Get file metadata
    ```json
    {
      "name": "fs_get_file_info",
      "arguments": {
        "path": "file.txt"
      }
    }
    ```

11. **fs_get_directory_tree** - Get directory tree
    ```json
    {
      "name": "fs_get_directory_tree",
      "arguments": {
        "path": ".",
        "maxDepth": 3
      }
    }
    ```

12. **fs_list_allowed_directories** - List accessible directories
    ```json
    {
      "name": "fs_list_allowed_directories",
      "arguments": {}
    }
    ```

## MCP Protocol

### Endpoints

- **POST /mcp** - HTTP Streaming transport (recommended)
- **GET /sse** - SSE transport (legacy)
- **POST /message** - Message endpoint for SSE
- **GET /health** - Health check
- **GET /** - Server info

### HTTP Streaming Example

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fs_read_file","arguments":{"path":"package.json"}}}'
```

## Security

The server implements path validation to ensure operations only occur within allowed directories:

```typescript
const service = new FileSystemService([
  '/allowed/path/1',
  '/allowed/path/2'
]);

// This will work
await service.readFile('/allowed/path/1/file.txt');

// This will throw an error
await service.readFile('/not/allowed/file.txt');
```

## Configuration

```typescript
interface FileSystemMCPServerConfig {
  allowedDirectories?: string[];  // Directories accessible to MCP
  port?: number;                  // Server port (default: 3000)
  host?: string;                  // Server host (default: localhost)
}
```

## Testing

Run the example file to see usage demonstrations:

```bash
npm run dev:file-system
```

Or use the provided curl commands in the examples.

## Integration with Claude Desktop

Add to your Claude Desktop MCP configuration (`~/.config/claude/mcp.json`):

```json
{
  "mcpServers": {
    "filesystem": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

## Comparison with Gmail MCP Tools

This implementation follows the same architecture as the Gmail MCP tools:

| Feature | Gmail MCP | File System MCP |
|---------|-----------|-----------------|
| Service Layer | ✅ GmailMCPFetcher | ✅ FileSystemService |
| HTTP Streaming | ✅ HTTPStreamHandler | ✅ FileSystemHTTPStreamHandler |
| SSE Transport | ✅ SSEMCPHandler | ✅ FileSystemSSEHandler |
| Main Server | ✅ LocalServerManager | ✅ FileSystemMCPServer |
| Tool Count | 4 tools | 12 tools |

## API Reference

See inline documentation in:
- `file-system-service.ts` - Core operations
- `http-stream-handler.ts` - HTTP transport
- `sse-handler.ts` - SSE transport
- `file-system.ts` - Server management

## License

Same as the main project.

