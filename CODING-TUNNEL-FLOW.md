# Coding Project Tunnel Flow - Complete Architecture

This document describes the complete request flow for accessing local development servers through the tunneling service.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          External User                              │
│  https://tunneling-service.onrender.com/t/abc123/p/my-app/api/users │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS Request
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                   Tunneling Service (Render.com)                    │
│                         main.py - FastAPI                           │
│                                                                      │
│  1. Receives: /t/abc123/p/my-app/api/users                         │
│  2. Authenticates: Bearer token (OAuth) or X-Api-Key               │
│  3. Logs: "🔀 Routing to coding project: my-app → /api/users"      │
│  4. Forwards via WebSocket:                                         │
│     {                                                                │
│       "type": "request",                                             │
│       "request_id": "req_xyz",                                       │
│       "method": "GET",                                               │
│       "path": "/p/my-app/api/users",                                │
│       "headers": {...},                                              │
│       "query_params": {...}                                          │
│     }                                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ WebSocket Tunnel
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                  EGDesk - Tunnel Client (Local)                     │
│              src/main/mcp/server-creator/tunnel-client.ts           │
│                                                                      │
│  1. Receives WebSocket message                                      │
│  2. handleRequest() checks: parseProjectRoute("/p/my-app/...")     │
│  3. Detects project route: { projectName: "my-app", path: "/api/..." }│
│  4. Calls: handleProjectRequest()                                   │
│     ├─ routeRequest() → looks up "my-app" in ProjectRegistry       │
│     │   └─ Returns: { handled: true, targetUrl: "localhost:3000/..." }│
│     └─ proxyRequest() → proxies to localhost:3000                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP Proxy
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                  Request Router (EGDesk)                            │
│           src/main/coding/coding-request-router.ts                  │
│                                                                      │
│  parseProjectRoute("/p/my-app/api/users")                          │
│    → { projectName: "my-app", path: "/api/users" }                 │
│                                                                      │
│  routeRequest("/p/my-app/api/users")                               │
│    ├─ getProject("my-app") from ProjectRegistry                    │
│    │   → { port: 3000, status: "running", ... }                    │
│    └─ Returns: { targetUrl: "http://localhost:3000/api/users" }    │
│                                                                      │
│  proxyRequest("GET", "http://localhost:3000/api/users", ...)       │
│    → Makes HTTP request to local dev server                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Lookup
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    Project Registry (EGDesk)                        │
│              src/main/coding/project-registry.ts                    │
│                                                                      │
│  In-Memory Map:                                                      │
│  {                                                                   │
│    "my-app": {                                                       │
│      projectName: "my-app",                                          │
│      folderPath: "/Users/dev/my-nextjs-app",                        │
│      port: 3000,                                                     │
│      url: "http://localhost:3000",                                  │
│      status: "running",                                              │
│      registeredAt: "2024-..."                                        │
│    },                                                                │
│    "my-vite-app": {                                                  │
│      projectName: "my-vite-app",                                     │
│      port: 5173,                                                     │
│      status: "running",                                              │
│      ...                                                             │
│    }                                                                 │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP GET localhost:3000/api/users
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                Local Development Server                             │
│                   Next.js / Vite / React                            │
│                                                                      │
│  Dev server running on localhost:3000                               │
│  Handles: GET /api/users                                            │
│  Returns: 200 OK [{"id": 1, "name": "Alice"}, ...]                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Request Flow Details

### 1. External Request

**URL Pattern:**
```
https://tunneling-service.onrender.com/t/{tunnel_id}/p/{project_name}/{path}
```

**Example:**
```
GET https://tunneling-service.onrender.com/t/abc123/p/my-nextjs-app/api/posts?limit=10
Authorization: Bearer eyJhbGc...
```

**Components:**
- `/t/abc123` - Tunnel identifier (server_key)
- `/p/my-nextjs-app` - Project route indicator + project name
- `/api/posts` - Remaining path forwarded to dev server
- `?limit=10` - Query parameters

### 2. Tunneling Service Processing

**File:** `/Users/minseocha/Desktop/projects/Taesung/EGDesk-scratch/tunneling-service/main.py`

**Line 909-1212:** `tunnel_request()` function handles the request

**Steps:**
1. **Extract tunnel ID from URL:** `abc123`
2. **Extract path from URL:** `p/my-nextjs-app/api/posts`
3. **Check authentication:**
   - OAuth: `Authorization: Bearer {token}` → verify with Supabase Auth
   - API Key: `X-Api-Key: {key}` → verify against registered key
4. **Check permissions:** User must have permission to access this server
5. **Detect project route:** Check if path starts with `p/`
6. **Log routing info:** `🔀 Routing to coding project: my-nextjs-app → /api/posts`
7. **Forward via WebSocket:**
   ```python
   request_data = {
       "type": "request",
       "request_id": "req_xyz",
       "method": "GET",
       "path": "/p/my-nextjs-app/api/posts",  # Full path preserved
       "headers": dict(request.headers),
       "query_params": {"limit": "10"},
       "body": None
   }
   await websocket.send_json(request_data)
   ```

### 3. Tunnel Client Receives Request

**File:** `src/main/mcp/server-creator/tunnel-client.ts`

**Line 702-745:** `handleRequest()` method

**Steps:**
1. **Receive WebSocket message**
2. **Parse project route:**
   ```typescript
   const projectRoute = parseProjectRoute('/p/my-nextjs-app/api/posts');
   // Returns: { projectName: 'my-nextjs-app', path: '/api/posts' }
   ```
3. **Check if project route:**
   - If `projectRoute !== null` → route to coding project
   - If `null` → route to default local server (MCP server)
4. **Handle project request:**
   ```typescript
   const proxyResponse = await handleProjectRequest(
     '/p/my-nextjs-app/api/posts',
     'GET',
     headers,
     body,
     { limit: '10' }
   );
   ```
5. **Send response back through WebSocket:**
   ```typescript
   this.ws.send(JSON.stringify({
     type: 'response',
     request_id: 'req_xyz',
     status_code: 200,
     headers: { 'content-type': 'application/json' },
     body: '[{"id": 1, ...}]'
   }));
   ```

### 4. Request Router Processing

**File:** `src/main/coding/coding-request-router.ts`

**Step 1: Parse Route**
```typescript
parseProjectRoute('/p/my-nextjs-app/api/posts')
```
Returns:
```typescript
{
  projectName: 'my-nextjs-app',
  path: '/api/posts'
}
```

**Step 2: Route Request**
```typescript
routeRequest('/p/my-nextjs-app/api/posts')
```
1. Looks up `'my-nextjs-app'` in ProjectRegistry
2. Checks status (must be `'running'`)
3. Constructs target: `http://localhost:3000/api/posts`

Returns:
```typescript
{
  handled: true,
  projectName: 'my-nextjs-app',
  targetUrl: 'http://localhost:3000/api/posts'
}
```

**Step 3: Proxy Request**
```typescript
proxyRequest(
  'GET',
  'http://localhost:3000/api/posts',
  headers,
  undefined,  // no body
  { limit: '10' }
)
```
Makes actual HTTP request to local dev server.

Returns:
```typescript
{
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: '[{"id": 1, "title": "Post 1"}, ...]'
}
```

### 5. Project Registry Lookup

**File:** `src/main/coding/project-registry.ts`

**In-Memory Storage:**
```typescript
private projects: Map<string, RegisteredProject> = new Map([
  ['my-nextjs-app', {
    projectName: 'my-nextjs-app',
    folderPath: '/Users/dev/my-nextjs-app',
    port: 3000,
    url: 'http://localhost:3000',
    status: 'running',
    registeredAt: '2024-02-19T...'
  }],
  ['my-vite-app', {
    projectName: 'my-vite-app',
    folderPath: '/Users/dev/my-vite-app',
    port: 5173,
    url: 'http://localhost:5173',
    status: 'running',
    registeredAt: '2024-02-19T...'
  }]
]);
```

**Lookup:**
```typescript
getProject('my-nextjs-app')
// Returns the RegisteredProject object with port 3000
```

### 6. Local Dev Server Response

The Next.js/Vite/React dev server receives:
```
GET http://localhost:3000/api/posts?limit=10
```

And responds:
```
HTTP/1.1 200 OK
Content-Type: application/json

[
  {"id": 1, "title": "First Post", "author": "Alice"},
  {"id": 2, "title": "Second Post", "author": "Bob"}
]
```

### 7. Response Flow Back

```
Local Dev Server
    → Request Router (proxyRequest returns)
    → Tunnel Client (sends WebSocket response)
    → Tunneling Service (receives WebSocket response)
    → External User (receives HTTP response)
```

## Project Registration Flow

When a dev server starts, it's automatically registered:

```typescript
// src/main/coding/dev-server-manager.ts

// 1. User selects folder via Coding UI
// 2. DevServerManager.startServer(folderPath) is called
// 3. Dev server spawns on available port (e.g., 3000)
// 4. Auto-register in ProjectRegistry:

const projectRegistry = getProjectRegistry();
projectRegistry.register(
  '/Users/dev/my-nextjs-app',  // folderPath
  3000,                         // port
  'http://localhost:3000',      // url
  'starting'                    // status
);
// Stores as: { projectName: 'my-nextjs-app', port: 3000, ... }

// 5. When server is ready:
projectRegistry.updateStatus('my-nextjs-app', 'running');
```

## Error Scenarios

### Project Not Found
```
Request: /p/unknown-project/api/users
↓
Router: getProject('unknown-project') → undefined
↓
Response: 404 Not Found
{
  "error": "Project 'unknown-project' not found in registry",
  "projectName": "unknown-project"
}
```

### Project Not Running
```
Request: /p/stopped-app/api/users
↓
Router: getProject('stopped-app') → { status: 'stopped' }
↓
Response: 503 Service Unavailable
{
  "error": "Project 'stopped-app' is not running (status: stopped)",
  "projectName": "stopped-app"
}
```

### Local Server Error
```
Request: /p/my-app/api/users
↓
Router: proxy to localhost:3000 → ECONNREFUSED
↓
Response: 502 Bad Gateway
{
  "error": "Failed to proxy request to local dev server",
  "details": "connect ECONNREFUSED 127.0.0.1:3000",
  "projectName": "my-app",
  "targetUrl": "http://localhost:3000/api/users"
}
```

## Testing the Flow

### 1. Start a Dev Server
```bash
# In EGDesk UI:
# 1. Go to Coding section
# 2. Click "Create New"
# 3. Select project folder (e.g., /Users/dev/my-nextjs-app)
# 4. Wait for server to start
# 5. Verify in UI: Status = "running", Port = 3000
```

### 2. Check Project Registry
```typescript
// In renderer console:
const result = await window.electron.ipcRenderer.invoke('project-registry:get-all');
console.log('Projects:', result.projects);
// Should show: [{ projectName: 'my-nextjs-app', port: 3000, status: 'running', ... }]
```

### 3. Test Local Access
```bash
curl http://localhost:3000/api/users
# Should work if dev server is running
```

### 4. Test Tunnel Access
```bash
# Replace with your actual tunnel ID and auth token
curl https://tunneling-service.onrender.com/t/YOUR_TUNNEL_ID/p/my-nextjs-app/api/users \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Should return same response as local access
```

### 5. Monitor Logs

**Tunneling Service (Render.com logs):**
```
🔀 Routing to coding project: my-nextjs-app → /api/users
📡 Sending request req_xyz through tunnel abc123
```

**EGDesk Console:**
```
→ GET /p/my-nextjs-app/api/users
🔀 Routing to project: my-nextjs-app → /api/users
🔀 Proxying GET /api/users to localhost:3000
← 200 GET /api/users
```

**Dev Server Console:**
```
GET /api/users 200 in 45ms
```

## Security Considerations

1. **Tunnel Authentication:** All requests must include valid OAuth token or API key
2. **Project Isolation:** Each project runs on separate port
3. **Local-Only:** Dev servers only bind to localhost (127.0.0.1)
4. **No Persistence:** Registry clears on app restart (no sensitive data stored)
5. **Permission Checks:** Tunneling service validates user permissions before forwarding

## Performance

- **Latency:** External → Tunnel Service → WebSocket → Router → Local
  - Typical: 100-300ms (depends on tunnel service location)
  - Local-only: < 10ms
- **Throughput:** Limited by WebSocket connection and local dev server
- **Concurrent Projects:** Multiple projects can run simultaneously on different ports

## Future Enhancements

1. **WebSocket Proxying:** Support WebSocket connections to dev servers (HMR, etc.)
2. **Request Caching:** Cache static assets at tunnel service level
3. **Load Balancing:** Multiple instances of same project on different ports
4. **Custom Domains:** Map custom subdomains to projects
5. **SSL Termination:** Local HTTPS support for testing
