# MCP Server Architecture Diagram

## Request Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP CLIENT                                  │
│                    (Cursor, Claude Desktop, etc.)                   │
└────────────┬─────────────────────────────────┬──────────────────────┘
             │                                 │
             │ HTTP Streamable                 │ SSE (Legacy)
             │ (Recommended)                   │
             │                                 │
    ┌────────▼─────────┐              ┌────────▼──────────┐
    │  POST /mcp       │              │  GET /sse          │
    │  Bidirectional   │              │  POST /message     │
    │  Streaming       │              │  Two-way Split     │
    └────────┬─────────┘              └────────┬───────────┘
             │                                 │
             └─────────────┬───────────────────┘
                           │
            ┌──────────────▼───────────────┐
            │   Local Server Manager        │
            │   (Request Router)            │
            │                               │
            │   • Route detection           │
            │   • Permission checks         │
            │   • Handler delegation        │
            └──────┬────────────────┬───────┘
                   │                │
       ┌───────────▼──────┐  ┌─────▼──────────────┐
       │ HTTP Stream      │  │ SSE Handler        │
       │ Handler          │  │                    │
       │ (NEW)            │  │ (Legacy)           │
       │                  │  │                    │
       │ • Parse newline  │  │ • Manage SSE       │
       │   delimited JSON │  │   connections      │
       │ • Stream         │  │ • Handle POST      │
       │   responses      │  │   requests         │
       │ • Keep-alive     │  │ • Send via SSE     │
       └──────────┬───────┘  └──────┬─────────────┘
                  │                 │
                  └────────┬────────┘
                           │
                ┌──────────▼───────────┐
                │ JSON-RPC Processor   │
                │                      │
                │ • initialize         │
                │ • tools/list         │
                │ • tools/call         │
                │ • ping               │
                └──────────┬───────────┘
                           │
                ┌──────────▼───────────┐
                │ Gmail MCP Fetcher    │
                │                      │
                │ • List users         │
                │ • Get messages       │
                │ • Get stats          │
                │ • Search messages    │
                └──────────┬───────────┘
                           │
                ┌──────────▼───────────┐
                │ Google Workspace API │
                │                      │
                │ • Gmail API          │
                │ • Admin SDK          │
                └──────────────────────┘
```

## HTTP Streamable Flow (Detailed)

```
CLIENT                                 SERVER
  │                                      │
  ├─── POST /mcp ───────────────────────>│
  │    Transfer-Encoding: chunked        │
  │                                      │
  │<────── 200 OK ───────────────────────┤
  │       Content-Type: application/json │
  │       Transfer-Encoding: chunked     │
  │                                      │
  │                                      │
  ├─── REQUEST ─────────────────────────>│
  │    {"jsonrpc":"2.0",                 │
  │     "id":1,                          │
  │     "method":"initialize",           │
  │     "params":{...}}\n                │
  │                                      ├─ Parse JSON
  │                                      ├─ Validate
  │                                      ├─ Execute
  │                                      │
  │<──── RESPONSE ───────────────────────┤
  │      {"jsonrpc":"2.0",               │
  │       "id":1,                        │
  │       "result":{...}}\n              │
  │                                      │
  │                                      │
  ├─── REQUEST ─────────────────────────>│
  │    {"jsonrpc":"2.0",                 │
  │     "id":2,                          │
  │     "method":"tools/list",           │
  │     "params":{}}\n                   │
  │                                      ├─ Parse JSON
  │                                      ├─ Validate
  │                                      ├─ Execute
  │                                      │
  │<──── RESPONSE ───────────────────────┤
  │      {"jsonrpc":"2.0",               │
  │       "id":2,                        │
  │       "result":{"tools":[...]}}\n    │
  │                                      │
  │                                      │
  ├─── Close stream ────────────────────>│
  │                                      │
  └─────────────────────────────────────>│
```

## SSE Flow (Detailed)

```
CLIENT                                 SERVER
  │                                      │
  ├─── GET /sse ────────────────────────>│
  │                                      │
  │<────── 200 OK ───────────────────────┤
  │       Content-Type: text/event-stream│
  │       Connection: keep-alive         │
  │                                      │
  │<──── SSE EVENT ──────────────────────┤
  │      event: endpoint                 │
  │      data: /gmail/sse                │
  │                                      │
  │    [SSE Stream Open]                 │
  │    <───────────────────────────────> │
  │                                      │
  ├─── POST /message ───────────────────>│
  │    {"jsonrpc":"2.0",                 │
  │     "id":1,                          │
  │     "method":"initialize",           │
  │     "params":{...}}                  │
  │                                      ├─ Parse JSON
  │<────── 202 Accepted ─────────────────┤  ├─ Queue request
  │                                      │  ├─ Execute
  │                                      │  │
  │<──── SSE EVENT ──────────────────────┤ <┘
  │      event: message                  │
  │      data: {"jsonrpc":"2.0",         │
  │            "id":1,                   │
  │            "result":{...}}           │
  │                                      │
  │    [SSE Stream Still Open]           │
  │    <───────────────────────────────> │
  │                                      │
  ├─── POST /message ───────────────────>│
  │    {"jsonrpc":"2.0",                 │
  │     "id":2,                          │
  │     "method":"tools/list",           │
  │     "params":{}}                     │
  │                                      ├─ Parse JSON
  │<────── 202 Accepted ─────────────────┤  ├─ Queue request
  │                                      │  ├─ Execute
  │                                      │  │
  │<──── SSE EVENT ──────────────────────┤ <┘
  │      event: message                  │
  │      data: {"jsonrpc":"2.0",         │
  │            "id":2,                   │
  │            "result":{"tools":[...]}} │
  │                                      │
  │    [Client closes stream]            │
  ├─── Close connection ────────────────>│
  │                                      │
  └─────────────────────────────────────>│
```

## Code Structure

```
egdesk-scratch/
└── src/
    └── main/
        └── mcp/
            └── gmail/
                ├── server-creator/
                │   ├── local-server-manager.ts  ← Main router
                │   ├── http-stream-handler.ts   ← NEW: HTTP Streamable
                │   └── sse-handler.ts            ← Legacy: SSE
                │
                ├── server-script/
                │   └── gmail-service.ts          ← Business logic
                │
                └── types/
                    └── gmail-types.ts            ← Type definitions
```

## Protocol Comparison

### HTTP Streamable (New)

**Pros:**
- ✅ Single endpoint (simpler)
- ✅ True bidirectional streaming
- ✅ More efficient
- ✅ Modern standard

**Cons:**
- ❌ Newer spec (less client support)
- ❌ Requires chunked encoding

**Best for:**
- New integrations
- When client supports it
- Production deployments

### SSE (Legacy)

**Pros:**
- ✅ Widely supported
- ✅ Works in browsers
- ✅ Proven technology
- ✅ Simple debugging

**Cons:**
- ❌ Two endpoints (more complex)
- ❌ Unidirectional stream
- ❌ More overhead

**Best for:**
- Browser-based clients
- Legacy compatibility
- Debugging/testing

## State Management

```
┌─────────────────────────────────────────┐
│      Local Server Manager               │
│                                         │
│  Shared State:                          │
│  • server: http.Server                  │
│  • isRunning: boolean                   │
│  • currentPort: number                  │
│  • store: ElectronStore                 │
│                                         │
│  Protocol Handlers (Lazy Init):         │
│  • sseHandler: SSEMCPHandler | null     │
│  • httpStreamHandler: HTTPStreamHandler │
│                                         │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  SSE Handler    │  │ HTTP Stream     │
│                 │  │ Handler         │
│  • Global SSE   │  │ • Per-request   │
│    connections  │  │   state         │
│  • Response     │  │ • Buffer for    │
│    locks        │  │   partial JSON  │
└─────────────────┘  └─────────────────┘
```

## Security & Permissions

```
┌─────────────────────────────────────────┐
│          Request Arrives                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Check CORS Headers                  │
│     (All origins allowed for local dev) │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Route to Handler                    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Check if Gmail MCP Enabled          │
│     (Via electron-store)                │
└──────────────┬──────────────────────────┘
               │
               ├─ Enabled ─────> Process
               │
               └─ Disabled ────> 403 Forbidden
```

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│          Error Occurs                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Catch in Handler                    │
└──────────────┬──────────────────────────┘
               │
               ├─ JSON-RPC Error ───────────┐
               │                            │
               ├─ HTTP Error ──────────────┐│
               │                           ││
               └─ Connection Error ───────┐││
                                          │││
                                          vvv
               ┌─────────────────────────────┐
               │  Format Error Response      │
               │                             │
               │  JSON-RPC:                  │
               │  {"jsonrpc":"2.0",          │
               │   "id":X,                   │
               │   "error":{                 │
               │     "code":-32603,          │
               │     "message":"..."}}       │
               │                             │
               │  HTTP:                      │
               │  {"success":false,          │
               │   "error":"..."}            │
               └──────────────┬──────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │  Log Error (console)        │
               └──────────────┬──────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │  Send to Client             │
               └─────────────────────────────┘
```

---

**Note:** Both protocols share the same business logic (Gmail MCP Fetcher) and only differ in transport mechanism. This ensures consistent behavior regardless of which protocol is used.

