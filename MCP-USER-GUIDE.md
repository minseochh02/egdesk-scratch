# Gmail MCP Server - User Guide

## What is this?

This feature allows **Claude Desktop** (the AI assistant) to access your Gmail data directly from your app. No manual setup required!

## How to Use

### Step 1: Fetch Gmail Data
1. Open your app
2. Go to the **MCP Server** section (navigation menu)
3. Create a Gmail connection with your Google service account
4. Click on the connection to open the Gmail Dashboard
5. The app will automatically fetch domain users and their Gmail data
6. The data is saved to a local SQLite database

### Step 2: Enable in Claude Desktop
1. Open the **Debug Panel** (click the "Debug" button in navigation)
2. Scroll down to the **"🤖 MCP Server for Claude Desktop"** section
3. Click **"🤖 Enable in Claude"** button
   - The app will automatically:
     - Build the MCP server
     - Configure Claude Desktop
     - Show you the status
4. **Restart Claude Desktop**

### Step 3: Use with Claude
1. Open Claude Desktop
2. Start asking questions about your Gmail data:
   - "List all Gmail users in the database"
   - "Show me the latest messages for user@quus.cloud"
   - "Search for messages about 'invoice'"
   - "What are my Gmail statistics?"

## Architecture

```
Your Electron App
├── Gmail Dashboard → Fetches Gmail via Google API
├── SQLite Database → Stores Gmail data locally
├── PHP Server (port 8080) → Provides REST API access to data
└── MCP Server → Proxies requests to PHP server

Claude Desktop
└── Connects to → Your MCP Server (via stdio)
```

## Why This Design?

1. **No Terminal Commands**: Everything is done through the UI
2. **Automatic Setup**: Click one button to enable
3. **Local Data**: All Gmail data stays on your computer
4. **Secure**: Uses Google OAuth2 with service accounts
5. **Fast**: Claude can query your local database instantly

## Technical Details

### MCP Server
- **Location**: `dist-mcp/server.js` (automatically built)
- **Transport**: stdio (standard input/output)
- **Tools Available**:
  - `list_gmail_users`: Get all users in database
  - `get_user_messages`: Get messages for a specific user
  - `search_messages`: Search messages by query
  - `get_gmail_stats`: Get statistics
  - `get_database_info`: Get database metadata

### Claude Desktop Config
The app automatically updates:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gmail-sqlite": {
      "command": "node",
      "args": ["/path/to/your/app/dist-mcp/server.js"]
    }
  }
}
```

### PHP API Endpoints
Available at `http://localhost:8080/mcp/gmail-api.php/`:
- `GET /users` - List all users
- `GET /users/{email}/messages` - Get user messages
- `GET /users/{email}/stats` - Get user stats
- `GET /search?q={query}` - Search messages
- `GET /stats` - Get database stats

## Troubleshooting

### MCP Server not working?
1. Check Status in Debug Panel → MCP Server section
2. Make sure PHP server is running (port 8080)
3. Restart Claude Desktop after enabling
4. Check if data exists in SQLite database (fetch some Gmail first)

### Claude says "no tools available"?
- Restart Claude Desktop
- Check `~/Library/Application Support/Claude/claude_desktop_config.json`
- Make sure "gmail-sqlite" is listed

### PHP server connection errors?
- Ensure PHP server is running (Debug Panel → PHP Server → Start)
- Check port 8080 is not in use
- Try restarting the PHP server

## Disabling

To remove from Claude Desktop:
1. Open Debug Panel
2. Go to MCP Server section
3. Click **"🗑️ Disable"** button
4. Restart Claude Desktop

## Need Help?

Check the console logs in your app for detailed error messages and debugging information.

