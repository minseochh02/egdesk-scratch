# Claude Desktop Local MCP Integration Update

## What Changed

Updated the "Add to Claude Desktop" button to automatically install **all EGDesk MCP services** using the stdio proxy method.

---

## How It Works Now

### 1. **Single Click Installation**

When you click "Add to Claude Desktop" in the MCP Server UI:

```
Button Click
     ↓
ClaudeConfigManager.configure()
     ↓
Copies mcp-stdio-proxy.js to app resources
     ↓
Updates claude_desktop_config.json with ALL services:
  - egdesk-user-data
  - egdesk-gmail
  - egdesk-sheets
  - egdesk-apps-script
  - egdesk-file-conversion
     ↓
Done! Restart Claude Desktop
```

### 2. **What Gets Installed**

The button now installs **5 MCP services** at once:

```json
{
  "mcpServers": {
    "egdesk-user-data": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "user-data"]
    },
    "egdesk-gmail": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "gmail"]
    },
    "egdesk-sheets": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "sheets"]
    },
    "egdesk-apps-script": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "apps-script"]
    },
    "egdesk-file-conversion": {
      "command": "node",
      "args": ["/path/to/mcp-stdio-proxy.js", "file-conversion"]
    }
  }
}
```

### 3. **Stdio Proxy Management**

- ✅ Proxy automatically copied from `resources/mcp-stdio-proxy.js`
- ✅ Made executable (chmod 755)
- ✅ Connects to `localhost:3100` internally
- ✅ No OAuth tokens needed (local access)

---

## Updated Code

### `claude-config-manager.ts` Changes

1. **Added stdio proxy path tracking:**
```typescript
private stdioProxyPath: string;

constructor() {
  // ... platform-specific paths ...
  const appPath = app.getAppPath();
  this.stdioProxyPath = path.join(appPath, 'mcp-stdio-proxy.js');
}
```

2. **New `ensureStdioProxy()` method:**
```typescript
private async ensureStdioProxy(): Promise<void> {
  const resourcesPath = process.resourcesPath || path.join(app.getAppPath(), '..');
  const sourceProxyPath = path.join(resourcesPath, 'mcp-stdio-proxy.js');
  
  if (!fs.existsSync(this.stdioProxyPath) && fs.existsSync(sourceProxyPath)) {
    fs.copyFileSync(sourceProxyPath, this.stdioProxyPath);
  }
  
  fs.chmodSync(this.stdioProxyPath, 0o755);
}
```

3. **Updated `configure()` to install all services:**
```typescript
public async configure(serverPath: string): Promise<ClaudeConfigResult> {
  await this.ensureStdioProxy();
  
  const services = [
    { name: 'egdesk-user-data', service: 'user-data' },
    { name: 'egdesk-gmail', service: 'gmail' },
    { name: 'egdesk-sheets', service: 'sheets' },
    { name: 'egdesk-apps-script', service: 'apps-script' },
    { name: 'egdesk-file-conversion', service: 'file-conversion' },
  ];

  for (const { name, service } of services) {
    config.mcpServers[name] = {
      command: 'node',
      args: [this.stdioProxyPath, service],
    };
  }
  
  fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
}
```

4. **Updated `unconfigure()` to remove all services:**
```typescript
public async unconfigure(): Promise<ClaudeConfigResult> {
  const egdeskServices = [
    'egdesk-user-data',
    'egdesk-gmail', 
    'egdesk-sheets',
    'egdesk-apps-script',
    'egdesk-file-conversion',
    'gmail-sqlite' // Legacy
  ];

  for (const serviceName of egdeskServices) {
    if (config.mcpServers?.[serviceName]) {
      delete config.mcpServers[serviceName];
    }
  }
}
```

5. **Updated `isConfigured()` to check for any EGDesk service:**
```typescript
public async isConfigured(): Promise<boolean> {
  const egdeskServices = [
    'egdesk-user-data',
    'egdesk-gmail',
    'egdesk-sheets',
    'egdesk-apps-script',
    'egdesk-file-conversion',
    'gmail-sqlite'
  ];

  return egdeskServices.some(service => 
    config.mcpServers?.[service] !== undefined
  );
}
```

---

## User Experience

### Before
```
User clicks "Add to Claude Desktop"
  → Single service added (gmail-sqlite)
  → Had to manually add other services
  → Complex JSON editing required
```

### After
```
User clicks "Add to Claude Desktop"
  → All 5 EGDesk services installed automatically
  → Ready to use in Claude Desktop
  → Just restart Claude Desktop
```

---

## Requirements

### For this to work, you need:

1. **`mcp-stdio-proxy.js` in resources folder** ✅ (Done)
2. **EGDesk HTTP server running** on `localhost:3100`
3. **Claude Desktop app installed**
4. **Restart Claude Desktop** after installation

---

## Testing Steps

1. **Start EGDesk**
   - Make sure HTTP MCP server is running on port 3100

2. **Click "Add to Claude Desktop"** in UI
   - Should see success message
   - Check console for confirmation

3. **Verify config file:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Should see all 5 services listed.

4. **Restart Claude Desktop**
   - Quit completely (Cmd+Q)
   - Reopen

5. **Check for 🔨 icon in Claude Desktop**
   - Should see 5 EGDesk services
   - Try querying: "List my imported database tables"

---

## Architecture

```
Claude Desktop
      ↓ (stdio: stdin/stdout JSON-RPC)
mcp-stdio-proxy.js (per service)
      ↓ (HTTP: localhost:3100/{service}/*)
LocalServerManager (EGDesk main process)
      ↓
UserDataMCPService, GmailMCPService, etc.
      ↓
SQLite databases
```

### Per-Service Proxy Instances

Each service gets its own proxy process:
- `node mcp-stdio-proxy.js user-data` → `localhost:3100/user-data/*`
- `node mcp-stdio-proxy.js gmail` → `localhost:3100/gmail/*`
- `node mcp-stdio-proxy.js sheets` → `localhost:3100/sheets/*`

---

## Benefits

1. ✅ **One-click installation** - All services installed at once
2. ✅ **No manual JSON editing** - Fully automated
3. ✅ **No OAuth complexity** - Local access only
4. ✅ **Fast performance** - Direct localhost connection
5. ✅ **Easy removal** - One-click uninstall
6. ✅ **Version independent** - Works with any Claude Desktop version

---

## Troubleshooting

### "Connection refused" error
**Problem:** EGDesk HTTP server not running  
**Solution:** Start EGDesk and ensure port 3100 is open

### No 🔨 icon in Claude Desktop
**Problem:** Config not loaded or Claude not restarted  
**Solution:** Quit Claude Desktop completely (Cmd+Q) and reopen

### "node: command not found"
**Problem:** Node.js not in PATH  
**Solution:** Install Node.js or use full path to node binary

### Services not appearing
**Problem:** Wrong proxy path or proxy not executable  
**Solution:** Check logs, verify proxy exists and is executable

---

## Files Modified

1. ✅ `src/main/mcp/server-creator/claude-config-manager.ts`
   - Added stdio proxy management
   - Updated configure/unconfigure for all services
   - Added service list and detection

2. ✅ `resources/mcp-stdio-proxy.js` (copied)
   - Stdio proxy for Claude Desktop integration

3. ✅ Existing UI components (no changes needed)
   - `RunningServersSection.tsx` already has the button
   - `MCPServer.tsx` already has the handlers

---

## Next Steps

To complete the integration:

1. **Test the installation:**
   - Build the app
   - Click "Add to Claude Desktop"
   - Verify all services appear

2. **Update user documentation:**
   - Add instructions for using Claude Desktop
   - Explain what each service does

3. **Consider adding:**
   - Service-specific enable/disable toggles
   - Per-service configuration options
   - Health check for Claude Desktop connection

---

## Summary

The "Add to Claude Desktop" button now:
- ✅ Automatically installs **all 5 EGDesk MCP services**
- ✅ Uses stdio proxy for seamless integration
- ✅ Requires zero manual configuration
- ✅ Works with local HTTP server (no tunnel needed)
- ✅ One-click enable/disable

Users can now access their EGDesk data, Gmail, Sheets, and more directly from Claude Desktop with a single button click! 🚀
