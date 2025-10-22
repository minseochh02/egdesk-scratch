# MCP Protocol Support

This server now supports **both** MCP transport protocols:

1. **HTTP + SSE (Legacy)** - Two-endpoint approach with Server-Sent Events
2. **HTTP Streamable (New)** - Single-endpoint bidirectional streaming

## HTTP Streamable (Recommended)

The newest MCP protocol uses a single POST endpoint for bidirectional streaming.

### Endpoint
```
POST /mcp
```

### How it works
- Client sends JSON-RPC requests as newline-delimited JSON over the POST request body
- Server responds with JSON-RPC responses as newline-delimited JSON over the HTTP response stream
- Both directions happen over the same HTTP connection
- Connection stays open for the duration of the session

### Example Flow
```
Client → POST /mcp
Client → {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}\n
Server ← {"jsonrpc":"2.0","id":1,"result":{...}}\n
Client → {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n
Server ← {"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}\n
Client → {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{...}}\n
Server ← {"jsonrpc":"2.0","id":3,"result":{...}}\n
```

### Supported Methods
- `initialize` - Initialize the MCP session
- `tools/list` - List available tools
- `tools/call` - Execute a tool
- `ping` - Test connection

### Configuration (Cursor IDE)
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

## HTTP + SSE (Legacy)

The original MCP protocol uses two separate endpoints.

### Endpoints
```
GET  /sse      - Establish SSE stream for server-to-client messages
POST /message  - Send client-to-server messages
```

### How it works
- Client opens SSE stream via GET /sse to receive responses
- Client sends JSON-RPC requests via POST /message
- Server responds via the SSE stream (not the POST response)
- POST /message immediately returns 202 Accepted

### Example Flow
```
Client → GET /sse (opens stream)
Server ← event: endpoint
Server ← data: /gmail/sse
Client → POST /message {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
Server ← (via SSE) event: message
Server ← (via SSE) data: {"jsonrpc":"2.0","id":1,"result":{...}}
Client → POST /message {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
Server ← (via SSE) event: message
Server ← (via SSE) data: {"jsonrpc":"2.0","id":2,"result":{"tools":[...]}}
```

### Configuration (Cursor IDE)
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

## Alternative Endpoints

Both protocols are also available with the `/gmail` prefix for namespace clarity:

- `POST /gmail/mcp` - HTTP Streamable for Gmail server
- `GET /gmail/sse` - SSE stream for Gmail server
- `POST /gmail/message` - SSE message endpoint for Gmail server

## Testing the Server

### Test HTTP Streamable
```bash
# Send a simple ping request
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'
```

### Test SSE
```bash
# Terminal 1 - Open SSE stream
curl -N http://localhost:3000/sse

# Terminal 2 - Send a message
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

## Migration Guide

If you're currently using the SSE transport, you can migrate to HTTP Streamable:

1. **Update your client configuration** to use `POST /mcp` instead of GET `/sse`
2. **Change transport mode** from `"sse"` to `"http-streamable"`
3. **No server changes needed** - both protocols work simultaneously

The SSE transport will remain supported for backward compatibility.

## Implementation Details

### Files
- `http-stream-handler.ts` - New HTTP Streamable protocol handler
- `sse-handler.ts` - Original SSE protocol handler
- `local-server-manager.ts` - Routes requests to appropriate handler

### Key Differences

| Feature | HTTP Streamable | SSE |
|---------|----------------|-----|
| Endpoints | 1 (POST /mcp) | 2 (GET /sse + POST /message) |
| Connection Model | Bidirectional stream | One-way stream + request endpoint |
| Response Location | Same stream | Separate SSE stream |
| Complexity | Simpler | More complex |
| Browser Support | Limited | Excellent |
| MCP Spec Version | Latest (2024-11-05+) | Original |

## Troubleshooting

### HTTP Streamable Issues
- **Connection closes immediately**: Check that client is sending newline-delimited JSON
- **No response**: Ensure request ends with `\n` character
- **Timeout**: Check that connection remains open during streaming

### SSE Issues
- **No SSE connection**: Make sure GET /sse is called before POST /message
- **Duplicate connection error**: Only one SSE stream per session is allowed
- **Response timeout**: SSE connection must be established before sending messages

