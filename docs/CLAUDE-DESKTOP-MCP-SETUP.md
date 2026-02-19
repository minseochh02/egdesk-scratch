# Claude Desktop MCP Configuration Issue & Solution

## The Problem

Claude Desktop **cannot access HTTP-based MCP servers directly**. It only supports:
- ✅ **Stdio transport** (command-based, local process)
- ❌ **NOT HTTP URLs** (like `http://localhost:3100`)

Your EGDesk MCP server runs as an HTTP server, which Claude Desktop doesn't natively support.

---

## The Solution: Stdio Proxy

I've created `mcp-stdio-proxy.js` - a bridge that allows Claude Desktop to connect to your HTTP MCP server.

### How It Works

```
Claude Desktop (stdio)
       ↓
mcp-stdio-proxy.js (translates stdio ↔ HTTP)
       ↓
Your HTTP MCP Server (localhost:3100)
       ↓
SQLite Database
```

---

## Setup Instructions

### Step 1: Make sure your EGDesk HTTP server is running
1. Start EGDesk application
2. Go to MCP Server settings
3. Ensure the server is running on `localhost:3100`

### Step 2: Configure Claude Desktop

Open your Claude Desktop config:
```bash
# macOS
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Or via Claude Desktop: Settings → Developer → Edit Config
```

Add this configuration:

```json
{
  "mcpServers": {
    "egdesk-user-data": {
      "command": "node",
      "args": [
        "/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/mcp-stdio-proxy.js",
        "user-data"
      ]
    },
    "egdesk-gmail": {
      "command": "node",
      "args": [
        "/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/mcp-stdio-proxy.js",
        "gmail"
      ]
    },
    "egdesk-sheets": {
      "command": "node",
      "args": [
        "/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/egdesk-scratch/mcp-stdio-proxy.js",
        "sheets"
      ]
    }
  }
}
```

**Important:** Update the full path if your project is in a different location!

### Step 3: Restart Claude Desktop

**Completely quit and restart Claude Desktop** (not just close the window):
- macOS: Cmd+Q, then reopen
- Check for the 🔨 (hammer) icon in Claude Desktop

---

## Available Services

The proxy supports all your MCP services:

| Service | Endpoint | Description |
|---------|----------|-------------|
| `user-data` | `/user-data` | Query user-imported tables (Excel, CSV) |
| `gmail` | `/gmail` | Gmail operations |
| `sheets` | `/sheets` | Google Sheets sync |
| `apps-script` | `/apps-script` | Google Apps Script |
| `file-conversion` | `/file-conversion` | File format conversion |

### Add More Services

Just add another entry with the service name:

```json
{
  "egdesk-file-conversion": {
    "command": "node",
    "args": [
      "/path/to/mcp-stdio-proxy.js",
      "file-conversion"
    ]
  }
}
```

---

## Verification

### Check if it's working:

1. Open Claude Desktop
2. Look for the 🔨 hammer icon
3. Click it to see available tools
4. You should see tools like:
   - `user_data_list_tables`
   - `user_data_query`
   - `user_data_search`
   - `user_data_aggregate`

### Test a query:

Ask Claude:
```
List all my imported database tables
```

Claude should use the `user_data_list_tables` tool and show your tables!

---

## Troubleshooting

### "Connection refused" error
**Problem:** EGDesk HTTP server is not running  
**Solution:** Start EGDesk application and enable the MCP server

### "Command not found" error
**Problem:** Incorrect file path in config  
**Solution:** Verify the full path to `mcp-stdio-proxy.js`

### No 🔨 icon appears
**Problem:** Claude Desktop didn't reload config  
**Solution:** Completely quit (Cmd+Q) and restart Claude Desktop

### Tools listed but not working
**Problem:** HTTP server responding with errors  
**Solution:** Check EGDesk console logs for errors

### View Proxy Logs

The proxy logs to stderr, which you can view:

```bash
# Run manually to see logs
node /path/to/mcp-stdio-proxy.js user-data
# Then paste JSON-RPC messages to stdin
```

---

## Environment Variables

You can customize the HTTP endpoint:

```json
{
  "egdesk-user-data": {
    "command": "node",
    "args": ["/path/to/mcp-stdio-proxy.js", "user-data"],
    "env": {
      "EGDESK_MCP_URL": "http://localhost:3100"
    }
  }
}
```

---

## Alternative: Use Tunnel URL

If you have the tunnel enabled, you can also use:

```json
{
  "egdesk-user-data": {
    "command": "node",
    "args": ["/path/to/mcp-stdio-proxy.js", "user-data"],
    "env": {
      "EGDESK_MCP_URL": "https://tunneling-service.onrender.com/t/your-tunnel-id"
    }
  }
}

// Note: When using tunnel URL, you'll need OAuth authentication.
// The tunnel service at tunneling-service.onrender.com requires:
// - Valid Supabase access token in Authorization header
// - User must have permission to access the server
```

---

## Why This Is Needed

Claude Desktop's MCP implementation:
- ✅ Supports: **stdio transport** (launches local processes)
- ❌ Does NOT support: **HTTP URLs** (network endpoints)

Most MCP servers use stdio because:
1. Easier for desktop apps to manage child processes
2. Better security (no network exposure)
3. Standard in MCP specification

Your EGDesk server uses HTTP because:
1. Supports both local and remote access
2. Enables tunneling for external sharing
3. Better for multi-service architecture

The proxy bridges both worlds! 🌉

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Claude Desktop (Electron App)                           │
│                                                          │
│ [MCP Client] ← stdio (JSON-RPC over stdin/stdout) →     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ mcp-stdio-proxy.js (Node.js Process)                    │
│                                                          │
│ - Reads JSON-RPC from stdin                             │
│ - Translates to HTTP requests                           │
│ - Forwards to localhost:3100                            │
│ - Returns results via stdout                            │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│ EGDesk HTTP MCP Server (Electron Main Process)          │
│                                                          │
│ LocalServerManager (localhost:3100)                     │
│   ├─ /user-data/* → UserDataMCPService                  │
│   ├─ /gmail/* → GmailMCPService                         │
│   ├─ /sheets/* → SheetsMCPService                       │
│   └─ /apps-script/* → AppsScriptMCPService             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ SQLite Databases                                        │
│   ├─ user_data.db (imported tables)                     │
│   ├─ conversations.db                                   │
│   └─ tasks.db, wordpress.db, etc.                       │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

**Problem:** Claude Desktop only supports stdio MCP servers, not HTTP URLs

**Solution:** Use `mcp-stdio-proxy.js` to translate stdio ↔ HTTP

**Result:** Claude Desktop can now access your EGDesk MCP services! 🎉

---

## Quick Start (TL;DR)

1. Make sure EGDesk is running with HTTP server enabled
2. Edit Claude Desktop config: Settings → Developer → Edit Config
3. Add stdio proxy configuration (see Step 2 above)
4. Quit and restart Claude Desktop (Cmd+Q)
5. Look for 🔨 icon and test with "List my database tables"

Done! 🚀
