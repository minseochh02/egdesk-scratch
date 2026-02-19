# Coding Project Request Routing System

This system enables external access to local development servers running on your machine through a secure tunneling service.

## Overview

The request routing system consists of several integrated components:

1. **Dev Server Manager** - Manages local development servers
2. **Project Registry** - Maps project names to localhost ports
3. **Request Router** - Routes incoming tunneled requests to correct dev servers
4. **Tunnel Client** - Handles WebSocket tunnel and request forwarding

## Architecture

```
External Request
    ↓
Tunneling Service (tunneling-service.onrender.com)
    ↓
WebSocket Tunnel
    ↓
Tunnel Client (tunnel-client.ts)
    ↓
Request Router (coding-request-router.ts)
    ↓
Project Registry (project-registry.ts)
    ↓
Local Dev Server (localhost:PORT)
```

## URL Pattern

### Public URL Format
```
https://tunneling-service.onrender.com/t/{tunnel_id}/p/{project_name}/{path}
```

**Components:**
- `/t/{tunnel_id}` - Identifies your tunnel connection
- `/p/{project_name}` - Identifies which project to route to
- `/{path}` - Remaining path forwarded to dev server

### Examples

**Next.js App API Route:**
```
Public:  https://tunneling-service.onrender.com/t/abc123/p/my-nextjs-app/api/users
         ↓
Local:   http://localhost:3000/api/users
```

**Vite App Asset:**
```
Public:  https://tunneling-service.onrender.com/t/abc123/p/my-vite-app/assets/logo.png
         ↓
Local:   http://localhost:5173/assets/logo.png
```

## Components

### 1. Dev Server Manager (`dev-server-manager.ts`)

Manages the lifecycle of local development servers.

**Responsibilities:**
- Analyzes project folders (detects Next.js, Vite, React)
- Installs dependencies if needed
- Spawns dev server processes with available ports
- Monitors server status (starting → running → stopped/error)
- Auto-registers projects in the registry

**IPC Handlers:**
- `dev-server:analyze-folder` - Analyze a project folder
- `dev-server:start` - Start a dev server
- `dev-server:stop` - Stop a dev server
- `dev-server:get-status` - Get server status
- `dev-server:get-all` - Get all running servers

**Example Usage:**
```typescript
// Start a Next.js project
const result = await electron.ipcRenderer.invoke('dev-server:start', '/path/to/my-nextjs-app');
// Result: { success: true, serverInfo: { port: 3000, url: 'http://localhost:3000', status: 'running' } }
```

### 2. Project Registry (`project-registry.ts`)

In-memory storage mapping project names to their runtime information.

**Data Structure:**
```typescript
interface RegisteredProject {
  projectName: string;    // Folder basename (e.g., "my-nextjs-app")
  folderPath: string;     // Full path to project folder
  port: number;           // Port where dev server is running
  url: string;            // Local URL (http://localhost:PORT)
  status: 'running' | 'stopped' | 'error';
  registeredAt: string;   // ISO timestamp
}
```

**IPC Handlers:**
- `project-registry:get-all` - Get all registered projects
- `project-registry:get-project` - Get project by name
- `project-registry:get-by-path` - Get project by folder path

**Auto-Registration:**
Projects are automatically registered when their dev servers start:
```typescript
// When server starts at port 3000 for folder "/Users/dev/my-nextjs-app"
projectRegistry.register('/Users/dev/my-nextjs-app', 3000, 'http://localhost:3000', 'starting');
// Stores as: { projectName: 'my-nextjs-app', port: 3000, ... }
```

### 3. Request Router (`coding-request-router.ts`)

Routes incoming tunneled requests to the correct local dev server.

**Key Functions:**

**`parseProjectRoute(requestPath: string)`**
Parses `/p/{project_name}/{path}` pattern:
```typescript
parseProjectRoute('/p/my-app/api/users')
// Returns: { projectName: 'my-app', path: '/api/users' }

parseProjectRoute('/some-other-path')
// Returns: null (not a project route)
```

**`routeRequest(requestPath: string)`**
Looks up project in registry and constructs target URL:
```typescript
routeRequest('/p/my-app/api/users')
// Returns: { handled: true, projectName: 'my-app', targetUrl: 'http://localhost:3000/api/users' }

routeRequest('/p/unknown-project/api/users')
// Returns: { handled: false, projectName: 'unknown-project', error: 'Project not found in registry' }
```

**`proxyRequest(method, targetUrl, headers, body?, queryParams?)`**
Proxies HTTP request to local dev server:
```typescript
await proxyRequest('GET', 'http://localhost:3000/api/users', headers)
// Returns: { statusCode: 200, headers: {...}, body: '[{...}]' }
```

**`handleProjectRequest(requestPath, method, headers, body?, queryParams?)`**
Complete flow: route + proxy (or return error):
```typescript
await handleProjectRequest('/p/my-app/api/users', 'GET', headers)
// If project running: proxies and returns response
// If project not found: returns { statusCode: 404, body: '{"error": "Project not found"}' }
// If project stopped: returns { statusCode: 503, body: '{"error": "Project not running"}' }
```

### 4. Tunnel Client Integration (`tunnel-client.ts`)

Modified `handleRequest()` method to intercept project routes:

```typescript
private async handleRequest(request: TunnelRequest): Promise<void> {
  // Check if this is a coding project route (/p/{project_name}/...)
  const projectRoute = parseProjectRoute(request.path);

  if (projectRoute) {
    // Route to coding project
    const proxyResponse = await handleProjectRequest(
      request.path,
      request.method,
      request.headers,
      request.body,
      request.query_params
    );

    // Send response back through WebSocket
    this.ws.send(JSON.stringify({
      type: 'response',
      request_id: request.request_id,
      status_code: proxyResponse.statusCode,
      headers: proxyResponse.headers,
      body: proxyResponse.body,
    }));

    return;
  }

  // Not a project route - forward to default local server (MCP server, etc.)
  // ... existing logic ...
}
```

## Request Flow Example

**Scenario:** User accesses their Next.js app API through the tunnel

1. **External Request:**
   ```
   GET https://tunneling-service.onrender.com/t/abc123/p/my-nextjs-app/api/posts
   ```

2. **Tunneling Service:**
   - Receives request at `/t/abc123/p/my-nextjs-app/api/posts`
   - Identifies tunnel connection `abc123`
   - Forwards entire path through WebSocket

3. **Tunnel Client (EGDesk):**
   - Receives WebSocket message:
     ```json
     {
       "type": "request",
       "request_id": "req_xyz",
       "method": "GET",
       "path": "/p/my-nextjs-app/api/posts",
       "headers": {...}
     }
     ```

4. **Request Router:**
   - Parses path: `{ projectName: 'my-nextjs-app', path: '/api/posts' }`
   - Looks up in registry: `{ port: 3000, status: 'running' }`
   - Constructs target: `http://localhost:3000/api/posts`

5. **Local Proxy:**
   - Sends `GET http://localhost:3000/api/posts`
   - Next.js dev server responds: `200 OK [{"id": 1, ...}]`

6. **Response Back:**
   - Router → Tunnel Client → WebSocket → Tunneling Service → User
   - User receives: `200 OK [{"id": 1, ...}]`

## Error Handling

### Project Not Found
```
Request: /p/nonexistent-project/api/users
Response: 404 Not Found
Body: {"error": "Project 'nonexistent-project' not found in registry"}
```

### Project Not Running
```
Request: /p/stopped-project/api/users
Response: 503 Service Unavailable
Body: {"error": "Project 'stopped-project' is not running (status: stopped)"}
```

### Proxy Error
```
Request: /p/my-app/api/users
If local server is down:
Response: 502 Bad Gateway
Body: {"error": "Failed to proxy request to local dev server", "details": "ECONNREFUSED"}
```

## UI Components

### DeveloperWindow (`DeveloperWindow.tsx`)

Shows development information for current project:
- Project name
- Local URL (http://localhost:PORT)
- Status (running/stopped/error)
- Public tunnel URL pattern

**Features:**
- Polls project registry every 2 seconds for updates
- Displays tunnel URL pattern for reference

### Coding (`Coding.tsx`)

Lists all registered projects:
- Project cards with name, status, port, URL, folder
- Real-time updates (polls registry every 3 seconds)
- "Create New" button to start new dev server
- Empty state when no projects running

## Security Considerations

1. **In-Memory Only:** Project registry is not persisted - clears on app restart
2. **Local Access:** All dev servers only bind to localhost
3. **Tunnel Authentication:** Tunneling service handles authentication
4. **CORS:** Dev servers may need CORS configuration for cross-origin requests

## Future Enhancements

1. **Persistent Storage:** Save project configurations across restarts
2. **Manual Port Assignment:** Allow users to specify ports
3. **Project Templates:** Quick-start templates for common frameworks
4. **Environment Variables:** UI to manage .env files
5. **Logs Viewer:** View dev server console output in UI
6. **Auto-Start:** Automatically start frequently-used projects
7. **Custom Domains:** Map custom subdomains to projects
8. **HTTPS Support:** Local HTTPS certificates for testing

## Troubleshooting

### Dev Server Won't Start
- Check if port is already in use
- Verify package.json exists
- Ensure dependencies are installed
- Check console logs for errors

### Project Not Accessible via Tunnel
- Verify project is in "running" status
- Check project registry: `project-registry:get-all`
- Ensure tunnel is connected
- Verify URL pattern: `/t/{tunnel_id}/p/{project_name}/{path}`

### Wrong Port or Project
- Projects are identified by folder basename
- If two folders have same name, newer one overwrites
- Solution: Use unique folder names
