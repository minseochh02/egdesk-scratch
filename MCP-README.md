# Gmail SQLite MCP Server

Model Context Protocol (MCP) server that provides access to Gmail data stored in your local SQLite database.

## Features

This MCP server allows Claude Desktop to:
- **List domain users** from your Gmail/Google Workspace
- **Get Gmail messages** for specific users
- **Get Gmail statistics** (total, unread, important, sent messages)
- **Search messages** by subject, sender, or content
- **Get database information** and stats

## Architecture

```
Claude Desktop → MCP Server (Node.js) → SQLite Database ← Electron App
```

Your Electron app fetches Gmail data from Google APIs and saves it to SQLite. The MCP server reads this SQLite database and provides the data to Claude Desktop.

## For End Users

**See [MCP-USER-GUIDE.md](./MCP-USER-GUIDE.md)** for simple, non-technical instructions.

**TL;DR**: Open the app → Debug Panel → Click "Enable in Claude" → Restart Claude Desktop. Done!

## Installation (Automatic)

The app automatically handles everything:
1. **Building**: Compiles the MCP server when you click "Enable in Claude"
2. **Configuration**: Updates Claude Desktop config automatically
3. **No Terminal**: Everything is done through the UI

## Installation (Manual - for developers)

### 1. Build the MCP Server

```bash
npm run build:mcp
```

This will compile the TypeScript server to `dist-mcp/server.js`.

### 2. Configure Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gmail-sqlite": {
      "command": "node",
      "args": ["/absolute/path/to/egdesk-scratch/dist-mcp/server.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with your actual project path.

### 3. Restart Claude Desktop

Restart Claude Desktop to load the new MCP server.

## Available Tools

### `gmail_list_users`
List all domain users from the Gmail database.

**Example**: "List all users in the Gmail database"

### `gmail_get_user_messages`
Get Gmail messages for a specific user.

**Parameters**:
- `email` (required): User's email address
- `limit` (optional): Number of messages to return (default: 50)
- `offset` (optional): Number of messages to skip for pagination

**Example**: "Show me the last 10 messages for user@quus.cloud"

### `gmail_get_user_stats`
Get Gmail statistics for a specific user.

**Parameters**:
- `email` (required): User's email address

**Example**: "What are the Gmail stats for user@quus.cloud?"

### `gmail_search_messages`
Search Gmail messages by subject, sender, or content.

**Parameters**:
- `query` (required): Search query
- `email` (optional): Filter by specific user
- `limit` (optional): Number of results (default: 50)

**Example**: "Search for messages containing 'invoice'"

### `db_get_stats`
Get database statistics (total users, messages, etc.).

**Example**: "Show me the database statistics"

### `db_get_path`
Get the database file path.

**Example**: "Where is the database located?"

## Requirements

1. **Electron App Running**: The Electron app must have been run at least once to create the SQLite database
2. **Gmail Data Synced**: Use the Gmail Dashboard in the Electron app to sync Gmail data
3. **Database Path**: The MCP server looks for the database at:
   - macOS: `~/Library/Application Support/egdesk/database/conversations.db`

## Troubleshooting

### "Database not found" error

Make sure:
1. You've run the Electron app (`npm start`)
2. You've used the Gmail Dashboard to fetch domain users
3. The database file exists at the expected path

### MCP server not showing in Claude Desktop

1. Check the Claude Desktop logs for errors
2. Verify the path in `claude_desktop_config.json` is correct
3. Make sure you've restarted Claude Desktop after configuration

### Permission errors

Make sure the database file has read permissions:
```bash
chmod 644 ~/Library/Application\ Support/egdesk/database/conversations.db
```

## Development

To rebuild the MCP server after making changes:

```bash
npm run build:mcp
```

Then restart Claude Desktop to load the updated server.

## Example Usage in Claude Desktop

Once configured, you can ask Claude:

- "List all Gmail users in the database"
- "Show me the latest 20 messages for m8chaa@quus.cloud"
- "What are the Gmail statistics for all users?"
- "Search for messages about 'meeting' from user@quus.cloud"
- "How many total messages are in the database?"

## Technical Details

- **Protocol**: Model Context Protocol (MCP)
- **Transport**: stdio
- **Database**: SQLite (better-sqlite3)
- **Language**: TypeScript/Node.js
- **SDK**: @modelcontextprotocol/sdk

## License

MIT

