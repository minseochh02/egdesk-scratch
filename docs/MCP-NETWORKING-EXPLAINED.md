# MCP Networking Explained: How Proxy Actually Works

## The Confusion: What is Supabase's Role?

You're absolutely right to be confused! Let me clarify what's actually happening:

**Supabase is NOT a tunneling service.** It's just a database and API platform (like Firebase).

## What Each Component Actually Does

### **Supabase (Database + API Platform)**
- ✅ Stores share tokens and configuration data
- ✅ Provides API endpoints for the proxy service  
- ✅ Handles authentication and rate limiting
- ❌ Does NOT create tunnels to your local server
- ❌ Does NOT handle networking between users
- ❌ Does NOT bypass router configurations

### **The Real Problem: Making Person A's Server Accessible**

The fundamental issue is: **How does Person B reach Person A's local server?**

Person A's server runs on `localhost:8080` - this is only accessible from Person A's own computer. For Person B to access it, we need to make it reachable from the internet.

## The Three Real Solutions

### **Solution 1: Port Forwarding (Hard)**
```
Person B → Internet → Person A's Router → Port Forwarding → Person A's Computer
```

**What happens:**
1. Person A configures their router to forward port 8080 to their computer
2. Person A gets their public IP address (e.g., `203.0.113.42`)
3. Supabase stores: `public_ip: "203.0.113.42", port: 8080`
4. When Person B makes a request, Supabase forwards to `http://203.0.113.42:8080`

**Problems:**
- Most home users don't know how to configure port forwarding
- Many ISPs block incoming connections
- Dynamic IP addresses change frequently
- Security risks (exposes your computer to the internet)

### **Solution 2: Tunneling Service (Easy)**
```
Person A's Computer → Outbound Connection → Tunneling Service (ngrok)
Person B → Internet → Tunneling Service → (uses existing connection) → Person A's Computer
```

**What happens:**
1. Person A runs `ngrok http 8080` (creates outbound connection)
2. ngrok gives Person A a public URL: `https://abc123.ngrok.io`
3. Supabase stores: `tunnel_url: "https://abc123.ngrok.io"`
4. When Person B makes a request, Supabase forwards to the tunnel URL
5. ngrok forwards the request through the existing connection to Person A

**Why this works:**
- Outbound connections work through any router (no configuration needed)
- ngrok handles all the networking complexity
- No security risks (your computer isn't directly exposed)

### **Solution 3: Relay Server (Most Complex)**
```
Person A's Computer → Outbound Connection → Relay Server
Person B → Internet → Relay Server → (uses existing connection) → Person A's Computer
```

**What happens:**
1. Person A's server connects to a relay server (outbound WebSocket)
2. Relay server maintains the connection
3. When Person B makes a request, Supabase forwards to the relay
4. Relay forwards the request through the existing connection to Person A

## The Corrected Architecture

### **With Tunneling Service (Recommended):**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Person B      │    │   Supabase       │    │   Tunneling     │    │   Person A's    │
│   (Consumer)    │    │   (Database)     │    │   Service       │    │   Local Server  │
│                 │    │                  │    │   (ngrok)       │    │                 │
│ • API Request   │───►│ • Look up token  │───►│ • Forward to    │───►│ • localhost:8080│
│ • Share URL     │    │ • Get tunnel URL │    │   tunnel URL    │    │ • Process data  │
│ • Access Token  │    │ • Rate limiting  │    │ • Handle tunnel │    │ • Return data   │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Database Schema (Corrected):**

```sql
CREATE TABLE mcp_shares (
  id SERIAL PRIMARY KEY,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL,
  
  -- Instead of storing IP addresses, store tunnel URL
  tunnel_url VARCHAR(500), -- e.g., "https://abc123.ngrok.io"
  
  -- OR if using relay server
  relay_connection_id VARCHAR(255), -- e.g., "conn_abc123"
  
  -- OR if using cloud deployment
  cloud_server_url VARCHAR(500), -- e.g., "https://person-a.egdesk.com"
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  is_active BOOLEAN DEFAULT true
);
```

## Step-by-Step Flow (Corrected)

### **Person A Sets Up Sharing:**

```typescript
// 1. Person A starts their local server
const localServer = startServer(8080);

// 2. Person A starts tunneling service
const tunnel = await ngrok.connect({
  addr: 8080,
  subdomain: `person-a-${shareToken}`
});

// 3. Person A registers with Supabase (stores tunnel URL, not IP)
await supabase.from('mcp_shares').insert({
  share_token: shareToken,
  access_token: accessToken,
  owner_id: personA.userId,
  tunnel_url: tunnel, // "https://abc123.ngrok.io"
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  permissions: ['read'],
  is_active: true
});
```

### **Person B Makes Request:**

```typescript
// 1. Person B makes request to shared URL
const response = await fetch('https://proxy.egdesk.com/share/abc123def456/api/gmail');

// 2. Supabase proxy looks up the share
const share = await supabase
  .from('mcp_shares')
  .select('tunnel_url, access_token')
  .eq('share_token', 'abc123def456')
  .single();

// 3. Supabase forwards to tunnel URL (not IP address)
const tunnelUrl = share.tunnel_url; // "https://abc123.ngrok.io"
const apiPath = '/api/gmail';
const fullUrl = `${tunnelUrl}${apiPath}`;

const response = await fetch(fullUrl, {
  headers: {
    'Authorization': `Bearer ${share.access_token}`
  }
});
```

## Why This Confusion Exists

The original documentation was misleading because:

1. **It suggested Supabase could directly access local servers** (it can't)
2. **It implied storing IP addresses was sufficient** (it's not, without port forwarding)
3. **It didn't clearly explain the networking requirements**

## The Real Implementation

For EGDesk to work, you need:

1. **A tunneling service integration** (like ngrok, localtunnel, or cloudflare tunnel)
2. **Supabase for storing share configurations** (not for networking)
3. **A proxy service** that forwards requests to the correct tunnel URLs

The tunneling service is what actually solves the networking problem, not Supabase.

## Summary

- **Supabase = Database + API** (stores configuration)
- **Tunneling Service = Networking** (makes local server accessible)
- **Proxy Service = Router** (forwards requests to the right place)

Person A's local server is never directly accessible from the internet - it's always accessed through a tunnel or relay.
