# Claude Desktop Connection Fix

## Issue
The stdio proxy was configured for port 3100, but your HTTP server is running on port 8080.

## Fix Applied

1. **Updated `mcp-stdio-proxy.js`:**
   - Changed default port from `3100` → `8080`
   - Fixed stdin/stdout handling to keep connection alive
   - Copied updated version to `resources/` folder

2. **Port Configuration:**
```javascript
// OLD: const BASE_URL = process.env.EGDESK_MCP_URL || 'http://localhost:3100';
// NEW: const BASE_URL = process.env.EGDESK_MCP_URL || 'http://localhost:8080';
```

## Next Steps

### 1. Reinstall to Claude Desktop

Click the **"Install to Claude Desktop"** button in EGDesk again to update the configuration with the fixed proxy.

OR manually run in EGDesk:
```javascript
await window.electron.mcpServer.configureClaude();
```

### 2. Restart Claude Desktop

Quit Claude Desktop completely:
```bash
# macOS
Cmd+Q (not just close window)

# Then reopen Claude Desktop
```

### 3. Verify Installation

Check that Claude Desktop config has the updated proxy:
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Should point to the same proxy file:
```json
{
  "mcpServers": {
    "egdesk-user-data": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "user-data"]
    }
  }
}
```

### 4. Test Connection

In Claude Desktop, you should see:
- 🔨 Icon in the toolbar
- 5 EGDesk services listed
- Services should connect without errors

Try asking Claude:
```
List my imported database tables
```

## If Still Not Working

### Check Server Status
Make sure your HTTP server is running on port 8080:
```bash
curl http://localhost:8080/user-data/tools
```

Should return JSON with available tools.

### Check Proxy Logs
Claude Desktop logs are at:
```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log
```

Look for `[MCP Stdio Proxy]` messages showing connection attempts.

### Manual Test
Test the proxy manually:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  node /path/to/mcp-stdio-proxy.js user-data
```

Should output JSON response with tools list.

## Port Configuration Summary

| Component | Port | URL |
|-----------|------|-----|
| HTTP Server | 8080 | http://localhost:8080 |
| Stdio Proxy | → 8080 | Connects to HTTP server |
| Claude Desktop | stdio | Uses proxy via stdin/stdout |

The proxy now correctly connects to port **8080** where your server is actually running! 🎉
