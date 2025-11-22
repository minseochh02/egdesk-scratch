# MCP Protocol Quick Reference

## 🎯 Quick Start

Your server now supports **both** MCP protocols. Choose the one that works best for you!

### HTTP Streamable (New & Recommended)
```bash
# Single endpoint - bidirectional streaming
POST http://localhost:3000/mcp
```

### SSE (Legacy - Still Works)
```bash
# Two endpoints - separate stream and message
GET  http://localhost:3000/sse      # Open stream first
POST http://localhost:3000/message  # Then send messages
```

## 🔗 All Available Endpoints

| Method | Endpoint | Protocol | Description |
|--------|----------|----------|-------------|
| `POST` | `/mcp` | HTTP Stream | **✨ NEW** Bidirectional streaming |
| `GET` | `/sse` | SSE | Legacy SSE stream |
| `POST` | `/message` | SSE | Legacy message endpoint |
| `GET` | `/` | REST | Server info |
| `GET` | `/gmail/tools` | REST | List tools |
| `POST` | `/gmail/tools/call` | REST | Call a tool |

## 📝 Message Format

All messages use JSON-RPC 2.0:

### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

## 🔧 Supported Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize` | Start MCP session | `{ protocolVersion, capabilities, clientInfo }` |
| `tools/list` | List available tools | `{}` |
| `tools/call` | Execute a tool | `{ name, arguments }` |
| `ping` | Test connection | `{}` |

## 🛠️ Available Tools

| Tool Name | Description |
|-----------|-------------|
| `gmail_list_users` | List all domain users |
| `gmail_get_user_messages` | Get messages for a user |
| `gmail_get_user_stats` | Get user statistics |
| `gmail_search_messages` | Search messages by query |

## 🧪 Testing

```bash
# Test HTTP Streamable
node scripts/test/test-http-streamable.js

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'
```

## ⚙️ Cursor Configuration

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "url": "http://localhost:3000/mcp",
      "transport": "http-streamable"
    }
  }
}
```

Or for legacy SSE:

```json
{
  "mcpServers": {
    "gmail": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

## 📚 Full Documentation

- **Protocol Details**: See `docs/mcp-protocol-support.md`
- **Implementation Summary**: See `IMPLEMENTATION-SUMMARY.md`
- **Test Suite**: See `scripts/test/test-http-streamable.js`

## 🆘 Troubleshooting

### Server Not Responding
```bash
# Check if server is running
curl http://localhost:3000/

# Enable Gmail MCP server (via IPC)
# The server must be enabled before it can handle requests
```

### HTTP Streamable Connection Closes Immediately
- Ensure messages end with `\n` (newline)
- Check Content-Type header is `application/json`
- Verify server is running and Gmail MCP is enabled

### SSE No Response
- Make sure GET /sse is called **before** POST /message
- Only one SSE connection per session
- Check that the SSE stream is still open

## 💡 Tips

1. **Use HTTP Streamable** for new integrations (it's simpler!)
2. **Keep both protocols** available for compatibility
3. **Test with curl** before integrating with clients
4. **Check server logs** for detailed debugging info
5. **Enable Gmail MCP** server before testing

## 🔄 Migration from SSE to HTTP Streamable

| Step | Action |
|------|--------|
| 1️⃣ | Test new endpoint with curl or test script |
| 2️⃣ | Update client config to use `/mcp` |
| 3️⃣ | Change transport to `http-streamable` |
| 4️⃣ | Verify everything works |
| 5️⃣ | Keep SSE as fallback if needed |

---

**Need help?** Check the full docs in `docs/mcp-protocol-support.md`

