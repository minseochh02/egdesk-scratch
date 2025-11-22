# MCP Server Authorization System

## Overview

This document outlines the authorization system for the MCP (Model Context Protocol) tunneling service. The system allows MCP server hosts to control who can access their servers through email-based allowlists, with OAuth-based identity verification.

## Architecture Philosophy

### Key Principles

1. **IP-based Server Ownership**: Servers are owned by the IP address that registers them (your computer)
2. **Desktop Permission Management**: Permission management happens through EGDesk desktop app only (not web)
3. **Email-based Client Identity**: Remote clients use OAuth to prove their email for access
4. **Pre-authorization**: Server hosts can grant access before clients even connect
5. **Explicit Allowlisting**: No access by default; hosts must explicitly grant permissions
6. **Tunneling Service as Gatekeeper**: Authorization happens at the tunnel level, not at individual MCP servers

### Trust Model

- **Server Registration**: Trust based on IP address (your computer)
- **Permission Management**: EGDesk app uses service role key (elevated access)
- **Client Access**: OAuth-verified email must be in allowlist

## Database Schema

### Tables

#### 1. `mcp_servers`
Stores registered MCP servers and their metadata.

```sql
CREATE TABLE mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership (IP-based)
  owner_ip inet NOT NULL, -- IP address that registered this server
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional: linked OAuth account
  
  -- Server identification
  name text NOT NULL,
  description text,
  server_key text UNIQUE NOT NULL, -- URL-safe identifier
  
  -- Connection details
  connection_url text, -- Where the server is actually running
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  
  -- Settings
  max_concurrent_connections integer DEFAULT 10,
  require_email_verification boolean DEFAULT true,
  
  CONSTRAINT unique_owner_server_key UNIQUE(owner_ip, server_key)
);

CREATE INDEX idx_mcp_servers_owner_ip ON mcp_servers(owner_ip);
CREATE INDEX idx_mcp_servers_owner_id ON mcp_servers(owner_id);
CREATE INDEX idx_mcp_servers_key ON mcp_servers(server_key);
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
```

#### 2. `mcp_server_permissions`
Controls who can access which servers through email-based allowlists.

```sql
CREATE TABLE mcp_server_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  
  -- Identity
  allowed_email text NOT NULL, -- Email that's allowed to connect
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Populated when user connects
  
  -- Authorization status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  
  -- Access control
  granted_at timestamptz DEFAULT now(), -- When permission was added
  granted_by_ip inet, -- IP that granted this (for audit)
  activated_at timestamptz, -- When user first connected
  revoked_at timestamptz,
  expires_at timestamptz, -- Optional expiration
  
  -- Metadata
  access_level text DEFAULT 'read_write' CHECK (access_level IN ('read_only', 'read_write', 'admin')),
  notes text, -- Optional notes about why access was granted
  
  CONSTRAINT unique_server_email UNIQUE(server_id, allowed_email)
);

CREATE INDEX idx_permissions_server ON mcp_server_permissions(server_id);
CREATE INDEX idx_permissions_email ON mcp_server_permissions(allowed_email);
CREATE INDEX idx_permissions_user ON mcp_server_permissions(user_id);
CREATE INDEX idx_permissions_status ON mcp_server_permissions(status);
```

#### 3. `mcp_connection_sessions`
Tracks active connections for monitoring and security.

```sql
CREATE TABLE mcp_connection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES mcp_server_permissions(id),
  
  -- Session details
  session_token text UNIQUE NOT NULL,
  client_ip inet,
  user_agent text,
  
  -- Timing
  connected_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  disconnected_at timestamptz,
  
  -- Metrics
  requests_count integer DEFAULT 0,
  bytes_transferred bigint DEFAULT 0,
  
  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'terminated'))
);

CREATE INDEX idx_sessions_server ON mcp_connection_sessions(server_id);
CREATE INDEX idx_sessions_user ON mcp_connection_sessions(user_id);
CREATE INDEX idx_sessions_token ON mcp_connection_sessions(session_token);
CREATE INDEX idx_sessions_active ON mcp_connection_sessions(status) WHERE status = 'active';
```

#### 4. `mcp_audit_logs`
Comprehensive audit trail for security and debugging.

```sql
CREATE TABLE mcp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What happened
  event_type text NOT NULL, -- 'connection_attempt', 'connection_established', 'permission_granted', etc.
  event_status text NOT NULL CHECK (event_status IN ('success', 'failure', 'error')),
  
  -- Who
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  
  -- Where
  server_id uuid REFERENCES mcp_servers(id),
  session_id uuid REFERENCES mcp_connection_sessions(id),
  
  -- Context
  ip_address inet,
  user_agent text,
  details jsonb, -- Flexible field for additional context
  error_message text,
  
  -- When
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX idx_audit_server ON mcp_audit_logs(server_id);
CREATE INDEX idx_audit_event ON mcp_audit_logs(event_type);
CREATE INDEX idx_audit_time ON mcp_audit_logs(created_at DESC);
```

## Authorization Flow

### 1. Server Registration Flow

```
┌──────────────────────┐
│ EGDesk (Your PC)     │
│ IP: 123.45.67.89     │
└──────┬───────────────┘
       │
       │ 1. Register Server (no auth needed)
       ▼
┌─────────────────────────┐
│ Tunnel Service          │
│ (main.py)               │
└──────┬──────────────────┘
       │
       │ 2. Create mcp_servers row
       ▼
┌─────────────────────────┐
│ Supabase DB             │
│ - owner_ip: 123.45.67.89│ ← Your IP!
│ - name                  │
│ - server_key (unique)   │
│ - owner_id: NULL        │ ← Optional OAuth link
└──────┬──────────────────┘
       │
       │ 3. Manage Permissions (via EGDesk UI)
       ▼
┌──────────────────────────────┐
│ Create mcp_server_permissions│
│ (using service role key)     │
│ - allowed_email              │
│ - status: 'pending'          │
│ - granted_by_ip              │
└──────────────────────────────┘
```

### 2. Client Connection Flow (Remote Access)

```
┌─────────────────────────┐
│ Remote Client (Claude)  │
└──────┬──────────────────┘
       │
       │ 1. Request: Connect to "my-server"
       ▼
┌─────────────────────────┐
│ Tunnel Service          │
│ (main.py)               │
└──────┬──────────────────┘
       │
       │ 2. Require OAuth Authentication
       ▼
┌─────────────────┐
│ OAuth Provider  │
│ (Google/GitHub) │
└──────┬──────────┘
       │
       │ 3. Return verified email: "claude@anthropic.com"
       ▼
┌──────────────────────────────┐
│ Check mcp_server_permissions │
│ WHERE server_key = ?         │
│   AND allowed_email = ?      │
│   AND status IN ('pending',  │
│                   'active')  │
└──────┬───────────────────────┘
       │
       ├─ NOT FOUND ──────────┐
       │                      │
       │                      ▼
       │              ┌──────────────────┐
       │              │ DENY ACCESS      │
       │              │ Log attempt      │
       │              │ "Email not in    │
       │              │  allowlist"      │
       │              └──────────────────┘
       │
       ├─ FOUND ──────────────┐
       │                      │
       │                      ▼
       │              ┌───────────────────────┐
       │              │ Update permission:    │
       │              │ - user_id = ?         │
       │              │ - status = 'active'   │
       │              │ - activated_at = NOW()│
       │              └───────┬───────────────┘
       │                      │
       │                      ▼
       │              ┌───────────────────────┐
       │              │ Create session:       │
       │              │ - session_token       │
       │              │ - user_id             │
       │              │ - server_id           │
       │              └───────┬───────────────┘
       │                      │
       │                      ▼
       │              ┌──────────────┐
       │              │ ALLOW ACCESS │
       │              │ Proxy MCP    │
       │              │ protocol     │
       │              └──────────────┘
       │
       ▼
  Client connected to
  your MCP server!
```

### 3. Permission Management Flow (via EGDesk Desktop App)

```
┌─────────────────────────┐
│ EGDesk Desktop App      │
│ (Your Computer)         │
│                         │
│ [Manage Permissions UI] │
└──────┬──────────────────┘
       │
       │ Uses Service Role Key
       │ (elevated permissions)
       ▼
┌─────────────────────────┐
│ Tunnel Service API      │
│ (main.py)               │
└──────┬──────────────────┘
       │
       ├─ Add Email ──────────────┐
       │                          │
       │                          ▼
       │                  ┌────────────────────┐
       │                  │ INSERT INTO        │
       │                  │ permissions        │
       │                  │ - allowed_email    │
       │                  │ - status: 'pending'│
       │                  │ - granted_by_ip    │
       │                  └────────────────────┘
       │
       ├─ Revoke Access ──────────┐
       │                          │
       │                          ▼
       │                  ┌────────────────────┐
       │                  │ UPDATE permissions │
       │                  │ SET status='revoked'│
       │                  │ Terminate sessions │
       │                  └────────────────────┘
       │
       ├─ View Access Logs ───────┐
       │                          │
       │                          ▼
       │                  ┌────────────────────┐
       │                  │ SELECT FROM        │
       │                  │ - audit_logs       │
       │                  │ - sessions         │
       │                  └────────────────────┘
       │
       └─ Update Permissions ─────┐
                                  │
                                  ▼
                          ┌────────────────────┐
                          │ UPDATE permissions │
                          │ - access_level     │
                          │ - expires_at       │
                          └────────────────────┘
```

## Security Considerations

### 1. IP-Based Server Ownership
- **IP as identity**: Server ownership is tied to the IP address that registers it
- **IP trust assumption**: We trust that your IP address is not compromised
- **Re-registration**: Same IP can re-register (update) their server
- **Different IP**: Cannot take over a server registered by another IP
- **Service role key**: EGDesk app uses service role key for permission management (keep secure!)

### 2. Client Email Verification
- **Must use OAuth providers**: Remote clients must authenticate via OAuth (Google, GitHub, Microsoft)
- **No manual email entry**: Clients cannot self-register; email must come from OAuth
- **Email case-insensitivity**: Store and compare emails in lowercase
- **Verified emails only**: Only OAuth-verified emails are trusted

### 3. Session Security
- **Session tokens**: Generate cryptographically secure random tokens for each connection
- **Token rotation**: Consider rotating tokens periodically for long-lived connections
- **Token revocation**: Immediate invalidation when permissions are revoked
- **Session monitoring**: Track active sessions per server

### 4. Rate Limiting
- **Connection attempts**: Limit failed connection attempts per email/IP
- **Registration attempts**: Limit server registrations per IP per time period
- **Permission changes**: Rate limit permission management operations
- **API calls**: Rate limit all API endpoints

### 5. Audit Trail
- **Log everything**: All registrations, connection attempts, permission changes, and access denials
- **Immutable logs**: Audit logs should never be deleted or modified
- **Retention policy**: Keep logs for compliance (90 days minimum recommended)
- **IP tracking**: Log IP addresses for all operations

### 6. Additional Protections
- **Email domain restrictions**: Optionally allow hosts to restrict by domain (e.g., only @company.com)
- **IP allowlisting**: Optional additional layer for sensitive servers (whitelist specific client IPs)
- **Webhook notifications**: Alert hosts of suspicious activity
- **Connection monitoring**: Real-time dashboard of active connections

## API Endpoints

### Server Management

#### `POST /register`
Register a new MCP server (IP-based, no auth required).

**Request:**
```typescript
{
  name: string;
  description?: string;
  server_key: string; // Must be unique, URL-safe
  connection_url?: string;
  max_concurrent_connections?: number;
}
```

**Response (Success):**
```typescript
{
  success: true;
  message: string;
  name: string;
  id: string;
  server_key: string;
  ip: string; // Your IP address
  created_at: string;
}
```

**Response (409 - Conflict):**
```typescript
{
  success: false;
  error: "Server key already exists";
  message: string;
  existing_record: {
    name: string;
    server_key: string;
    registered_at: string;
  }
}
```

#### `GET /servers/by-ip`
List all servers registered from your IP address (requires service role key).

#### `PATCH /servers/:server_key`
Update server settings (requires service role key + IP verification).

#### `DELETE /servers/:server_key`
Deactivate a server (soft delete) (requires service role key + IP verification).

### Permission Management

> **Authentication:** All permission management endpoints require service role key (used by EGDesk app only)

#### `POST /permissions`
Add allowed email(s) to server.

**Headers:**
```
Authorization: Bearer <service_role_key>
X-Server-IP: <your_ip> // For verification
```

**Request:**
```typescript
{
  server_key: string;
  emails: string[]; // Array of emails to grant access
  access_level?: 'read_only' | 'read_write' | 'admin';
  expires_at?: string; // ISO 8601 timestamp
  notes?: string;
}
```

**Response:**
```typescript
{
  success: true;
  added: number;
  permissions: Array<{
    id: string;
    allowed_email: string;
    status: 'pending';
    access_level: string;
  }>;
}
```

#### `GET /permissions/:server_key`
List all permissions for a server (requires service role key).

#### `PATCH /permissions/:id`
Update a permission (change access level, expiration, etc.) (requires service role key).

#### `DELETE /permissions/:id`
Revoke a permission (requires service role key).

### Connection Endpoints

> **Authentication:** OAuth required for remote clients connecting to servers

#### `WS /tunnel/connect?name=<server_key>`
WebSocket connection from EGDesk to establish tunnel (no auth required - IP-based).

**Used by:** EGDesk desktop app

**Flow:**
1. EGDesk connects via WebSocket
2. Verifies server is registered (by server_key or name)
3. Checks server status is 'active'
4. Establishes tunnel

#### `GET|POST|PUT|PATCH|DELETE /t/:server_key/*`
Client access to tunneled MCP server (Supabase OAuth required).

**Used by:** Remote clients (Claude Desktop, web apps, etc.)

**Headers:**
```
Authorization: Bearer <supabase_access_token>
```

**Flow:**
1. Client authenticates via Supabase OAuth (Google, GitHub, etc.)
2. Client obtains Supabase access token
3. Client sends request with token in Authorization header
4. Tunnel service verifies token with Supabase Auth
5. System extracts verified email from token
6. Checks if email is in server's permission list
7. Validates permission status (active, not revoked, not expired)
8. Auto-activates pending permissions on first use
9. Creates/updates session record
10. If authorized, proxies request to tunneled MCP server

**Response (Success):**
Proxied response from MCP server (with CORS headers)

**Response (401 - Unauthorized):**
```typescript
{
  error: "Unauthorized";
  message: "Missing or invalid Authorization header. Please authenticate with Supabase OAuth.";
}
```

**Response (403 - Forbidden - No Permission):**
```typescript
{
  error: "Forbidden";
  message: "User 'email@example.com' does not have permission to access this server. Contact the server owner to request access.";
}
```

**Response (403 - Forbidden - Revoked):**
```typescript
{
  error: "Forbidden";
  message: "Your access to this server has been revoked";
}
```

**Response (403 - Forbidden - Expired):**
```typescript
{
  error: "Forbidden";
  message: "Your access to this server has expired";
}
```

**Response (404 - Server Not Found):**
```typescript
{
  error: "Server not found";
  message: "Server 'server_key' does not exist";
}
```

#### `GET /sessions/:server_key`
List active sessions for a server (requires service role key).

#### `DELETE /sessions/:session_id`
Terminate a session (requires service role key).

### Monitoring Endpoints

> **Authentication:** Requires service role key (used by EGDesk app only)

#### `GET /audit-logs/:server_key`
Retrieve audit logs for a server.

**Headers:**
```
Authorization: Bearer <service_role_key>
X-Server-IP: <your_ip> // For verification
```

**Response:**
```typescript
{
  logs: Array<{
    id: string;
    event_type: string;
    event_status: 'success' | 'failure' | 'error';
    user_email: string;
    ip_address: string;
    created_at: string;
    details: object;
  }>;
}
```

#### `GET /stats/:server_key`
Get connection statistics and metrics (requires service role key).

## Setting Up Supabase OAuth

To enable client authentication, you need to configure OAuth providers in your Supabase project.

### 1. Enable OAuth Providers

Go to your Supabase dashboard → Authentication → Providers

#### Google OAuth

1. Create a Google Cloud project
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `https://[your-project-ref].supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase
6. Enable Google provider in Supabase

#### GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth app
3. Set Authorization callback URL:
   - `https://[your-project-ref].supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase
5. Enable GitHub provider in Supabase

### 2. Client Authentication Flow

**For Web Clients:**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in with OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google' // or 'github'
})

// Get access token
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session?.access_token

// Use token to access MCP server
const response = await fetch('https://tunnel-service.com/t/my-server/endpoint', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
```

**For Claude Desktop:**

Add to your Claude Desktop configuration with Supabase authentication:

```json
{
  "mcpServers": {
    "remote-mcp-server": {
      "url": "https://tunnel-service.com/t/my-server",
      "auth": {
        "type": "oauth2",
        "provider": "supabase",
        "authUrl": "https://[project-ref].supabase.co/auth/v1/authorize",
        "tokenUrl": "https://[project-ref].supabase.co/auth/v1/token",
        "clientId": "your-oauth-client-id"
      }
    }
  }
}
```

### 3. Email Verification (Optional)

To require email verification before granting access:

1. Go to Supabase dashboard → Authentication → Email Templates
2. Enable "Confirm signup" email template
3. Users must verify their email before accessing servers
4. Set `require_email_verification` to `true` in `mcp_servers` table

### 4. Testing Authentication

Test your OAuth setup:

```bash
# 1. Get Supabase access token (via OAuth flow or dashboard)
TOKEN="your-supabase-access-token"

# 2. Test access to your MCP server
curl -X POST https://tunnel-service.com/t/my-server/some-endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method": "list_tools"}'
```

**Expected responses:**
- ✅ 200: Success (user is authorized)
- ❌ 401: Invalid/expired token
- ❌ 403: User email not in permission list

## Implementation Status

### Phase 1: Core Infrastructure ✅
- [x] Database schema designed (IP-based ownership)
- [x] Row Level Security (RLS) policies
- [x] Supabase integration setup

### Phase 2: Server Registration ✅
- [x] Server registration API (`/register` endpoint)
- [x] IP-based authentication
- [x] Server key generation and validation
- [x] Re-registration support (same IP can update)
- [x] Client integration (tunnel-client.ts)

### Phase 3: Permission Management ✅
- [x] Add permissions API (`POST /permissions`)
- [x] Get permissions API (`GET /permissions/:server_key`)
- [x] Update permissions API (`PATCH /permissions/:id`)
- [x] Revoke permissions API (`DELETE /permissions/:id`)
- [x] IP-based verification (no service role key in requests)
- [x] IPC handlers exposed to renderer
- [x] InviteManager UI component
- [x] Integrated into TunnelAndServerConfig

### Phase 4: OAuth Integration ✅
- [x] Supabase OAuth integration (supports Google, GitHub, etc.)
- [x] Token verification via Supabase Auth
- [x] Email extraction from verified token
- [x] Tunnel endpoint OAuth middleware

### Phase 5: Authorization Logic ✅
- [x] Permission checking in `/t/:server_key/*` endpoint
- [x] Session management and creation
- [x] Auto-activation of pending permissions
- [x] Active session tracking
- [x] Expiration checking
- [x] Revocation enforcement

### Phase 6: Monitoring & Security (Future)
- [ ] Audit logging implementation
- [ ] Rate limiting
- [ ] Analytics dashboard
- [ ] Alert system

### Phase 7: Advanced Features (Future)
- [ ] Domain-based restrictions (`*@company.com`)
- [ ] Time-based access windows
- [ ] Webhook notifications
- [ ] Client IP allowlisting

## Row Level Security (RLS) Policies

> **Note:** Since server registration is IP-based and permission management uses service role key, RLS policies are simplified. Most operations bypass RLS using service role key.

### `mcp_servers`

```sql
-- Allow public to register servers (INSERT only, no auth required)
CREATE POLICY "Allow public server registration"
  ON mcp_servers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role has full access (used by EGDesk app)
-- No RLS needed as service role bypasses RLS

-- Allow public to view server existence (for connection validation)
CREATE POLICY "Allow public to view servers"
  ON mcp_servers FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
```

### `mcp_server_permissions`

```sql
-- Service role manages all permissions (bypasses RLS)
-- Authenticated users can check if THEY are allowed
CREATE POLICY "Users can check their own permissions"
  ON mcp_server_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR allowed_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
```

### `mcp_connection_sessions`

```sql
-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON mcp_connection_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role manages sessions (bypasses RLS)
```

### `mcp_audit_logs`

```sql
-- Audit logs are append-only for service role
-- No public access (service role only)
CREATE POLICY "Service role only"
  ON mcp_audit_logs FOR ALL
  TO service_role
  USING (true);
```

## Example Usage

### 1. Server Host Registers Server (via EGDesk)

```typescript
// In EGDesk desktop app - no authentication needed
// User clicks "Register Server" button

// EGDesk calls tunnel service
const response = await fetch('https://tunnel-service.com/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My AI Assistant Server',
    description: 'Internal company MCP server',
    server_key: 'company-ai-assistant',
    connection_url: 'http://localhost:8080'
  })
});

const result = await response.json();
// {
//   success: true,
//   name: 'My AI Assistant Server',
//   id: 'uuid',
//   server_key: 'company-ai-assistant',
//   ip: '123.45.67.89', // Your IP
//   created_at: '2024-01-01T00:00:00Z'
// }

// Later, add allowed emails via EGDesk UI
// This uses service role key internally
await egdesk.addAllowedEmails('company-ai-assistant', [
  { email: 'alice@company.com', access_level: 'read_write' },
  { email: 'bob@company.com', access_level: 'read_only' }
]);
```

### 2. Client Connects to Server

```typescript
// Client authenticates
const { data: { user } } = await supabase.auth.signInWithOAuth({
  provider: 'google'
});
// User's verified email: alice@company.com

// Client requests connection
const response = await fetch('/api/connect/company-ai-assistant', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabase.auth.session().access_token}`
  }
});

const { authorized, session_token, websocket_url } = await response.json();

if (authorized) {
  // Connect to MCP server via WebSocket
  const ws = new WebSocket(websocket_url, {
    headers: {
      'Authorization': `Bearer ${session_token}`
    }
  });
  
  // Start using MCP protocol
  ws.on('open', () => {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: { ... }
    }));
  });
}
```

### 3. Host Revokes Access

```typescript
// Host revokes Bob's access
const { data } = await supabase
  .from('mcp_server_permissions')
  .update({
    status: 'revoked',
    revoked_at: new Date().toISOString()
  })
  .eq('server_id', server.id)
  .eq('allowed_email', 'bob@company.com');

// Terminate active sessions for Bob
await supabase
  .from('mcp_connection_sessions')
  .update({ status: 'terminated', disconnected_at: new Date().toISOString() })
  .eq('server_id', server.id)
  .eq('user_id', bob_user_id)
  .eq('status', 'active');
```

## Edge Function Implementation

### `/tunnel` Edge Function (Modified)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  // Extract server_key from URL
  const url = new URL(req.url);
  const server_key = url.pathname.split('/').pop();

  // 1. Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Check if server exists
  const { data: server, error: serverError } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('server_key', server_key)
    .eq('status', 'active')
    .single();

  if (serverError || !server) {
    await logAuditEvent({
      event_type: 'connection_attempt',
      event_status: 'failure',
      user_id: user.id,
      user_email: user.email,
      details: { error: 'Server not found', server_key }
    });
    
    return new Response(JSON.stringify({ error: 'Server not found' }), {
      status: 404
    });
  }

  // 3. Check permissions
  const { data: permission, error: permError } = await supabase
    .from('mcp_server_permissions')
    .select('*')
    .eq('server_id', server.id)
    .eq('allowed_email', user.email?.toLowerCase())
    .in('status', ['pending', 'active'])
    .single();

  if (permError || !permission) {
    await logAuditEvent({
      event_type: 'connection_attempt',
      event_status: 'failure',
      user_id: user.id,
      user_email: user.email,
      server_id: server.id,
      details: { error: 'Permission denied' }
    });
    
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403
    });
  }

  // 4. Check if permission has expired
  if (permission.expires_at && new Date(permission.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Permission expired' }), {
      status: 403
    });
  }

  // 5. Activate permission if pending (first time user connects)
  if (permission.status === 'pending') {
    await supabase
      .from('mcp_server_permissions')
      .update({
        user_id: user.id,
        status: 'active',
        activated_at: new Date().toISOString()
      })
      .eq('id', permission.id);
  }

  // 6. Create session
  const session_token = crypto.randomUUID();
  const { data: session } = await supabase
    .from('mcp_connection_sessions')
    .insert({
      server_id: server.id,
      user_id: user.id,
      permission_id: permission.id,
      session_token,
      client_ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent')
    })
    .single();

  // 7. Log successful connection
  await logAuditEvent({
    event_type: 'connection_established',
    event_status: 'success',
    user_id: user.id,
    user_email: user.email,
    server_id: server.id,
    session_id: session.id
  });

  // 8. Handle WebSocket upgrade and proxy to actual MCP server
  if (req.headers.get('upgrade') === 'websocket') {
    // Validate session token
    if (req.headers.get('sec-websocket-protocol') !== session_token) {
      return new Response('Invalid session token', { status: 403 });
    }

    // Upgrade and proxy to actual server
    return proxyWebSocket(req, server.connection_url, session.id);
  }

  // Return session info for HTTP connections
  return new Response(JSON.stringify({
    authorized: true,
    session_token,
    websocket_url: `/tunnel/${server_key}`,
    server: {
      name: server.name,
      description: server.description
    },
    permission: {
      access_level: permission.access_level
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

async function logAuditEvent(event: any) {
  // Implementation for logging to mcp_audit_logs
  // ... (details omitted for brevity)
}

async function proxyWebSocket(req: Request, targetUrl: string, sessionId: string) {
  // Implementation for WebSocket proxying
  // ... (details omitted for brevity)
}
```

## Migration Path

### Step 1: Create Tables
Run the SQL migrations in Supabase SQL Editor.

### Step 2: Enable RLS
Enable Row Level Security and apply policies.

### Step 3: Update Edge Functions
Modify the `/tunnel` edge function to include authorization logic.

### Step 4: Create Management UI
Build interface for server hosts to:
- Register servers
- Manage allowed emails
- View connection logs
- Monitor active sessions

### Step 5: Update Client
Update EGDesk client to:
- Handle OAuth flow
- Send authentication headers
- Use session tokens

## Future Enhancements

1. **Organization Support**: Group servers and permissions under organizations
2. **Role-Based Access Control**: Define roles (viewer, editor, admin) with granular permissions
3. **API Keys**: Alternative to OAuth for programmatic access
4. **Usage Billing**: Track usage and implement billing based on connections/data transfer
5. **Geographic Restrictions**: Limit access based on client location
6. **Time-Based Access**: Allow access only during specific time windows
7. **Approval Workflows**: Require approval before granting access to sensitive servers

## Questions & Considerations

1. **Should we support anonymous/public MCP servers?**
   - Could add a `public: boolean` field to `mcp_servers`
   - If public, skip permission checks

2. **How long should sessions last?**
   - Currently: As long as WebSocket is connected
   - Could add: Maximum session duration, idle timeout

3. **Should email allowlists support wildcards?**
   - e.g., `*@company.com` to allow entire domain
   - Would need pattern matching logic

4. **Rate limiting strategy?**
   - Per user? Per IP? Per server?
   - Implemented at edge function or database level?

5. **What happens when a server is deleted?**
   - Currently: Cascade delete (removes permissions and sessions)
   - Alternative: Soft delete with grace period

---

**This authorization system provides a solid foundation for secure, scalable MCP server tunneling with fine-grained access control.**

