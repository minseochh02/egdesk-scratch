# Using Supabase as the Tunnel Server

## The Brilliant Insight

**Yes! Supabase can absolutely act as the tunnel server.** This is actually much simpler and more elegant than using a separate tunneling service like ngrok.

## How It Would Work

### **The Architecture:**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EGDesk App    │    │   Local SQLite   │    │   HTTP Server   │    │   Supabase      │
│                 │    │                  │    │   (localhost)   │    │   (Tunnel + DB) │
│ • Folder Setup  │───►│ • User Configs   │◄──►│ • Data Access   │◄──►│ • WebSocket     │
│ • Data Config   │    │ • Gmail Data     │    │ • Security      │    │ • Tunnel Server │
│ • OAuth Setup   │    │ • File Metadata  │    │ • Tool Registry │    │ • Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

### **The Flow:**
1. **EGDesk creates outbound WebSocket connection** to Supabase
2. **Supabase stores the connection** and generates a public URL
3. **Person B makes request** to the public URL
4. **Supabase forwards request** through the existing WebSocket connection
5. **EGDesk responds** through the same WebSocket connection

## Implementation Details

### **1. Supabase Edge Function (Tunnel Server)**

```typescript
// supabase/functions/tunnel-server/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const connections = new Map<string, WebSocket>();

serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname.startsWith('/tunnel/')) {
    // Handle tunnel requests
    const tunnelId = url.pathname.split('/')[2];
    const connection = connections.get(tunnelId);
    
    if (connection) {
      // Forward request to EGDesk
      connection.send(JSON.stringify({
        type: 'http_request',
        method: req.method,
        url: url.pathname,
        headers: Object.fromEntries(req.headers),
        body: await req.text()
      }));
      
      // Wait for response from EGDesk
      return new Promise((resolve) => {
        connection.onmessage = (event) => {
          const response = JSON.parse(event.data);
          resolve(new Response(response.body, {
            status: response.status,
            headers: response.headers
          }));
        };
      });
    } else {
      return new Response('Tunnel not found', { status: 404 });
    }
  }
  
  if (url.pathname === '/ws') {
    // Handle WebSocket connections from EGDesk
    const upgrade = req.headers.get('upgrade');
    if (upgrade === 'websocket') {
      const { socket, response } = Deno.upgradeWebSocket(req);
      
      socket.onopen = () => {
        console.log('EGDesk connected');
      };
      
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'register_tunnel') {
          const tunnelId = generateTunnelId();
          connections.set(tunnelId, socket);
          
          socket.send(JSON.stringify({
            type: 'tunnel_registered',
            tunnelId: tunnelId,
            publicUrl: `https://your-project.supabase.co/functions/v1/tunnel/${tunnelId}`
          }));
        }
        
        if (message.type === 'http_response') {
          // This is a response from EGDesk, already handled above
        }
      };
      
      socket.onclose = () => {
        // Remove connection from map
        for (const [tunnelId, conn] of connections.entries()) {
          if (conn === socket) {
            connections.delete(tunnelId);
            break;
          }
        }
      };
      
      return response;
    }
  }
  
  return new Response('Not found', { status: 404 });
});
```

### **2. EGDesk Tunnel Client**

```typescript
// EGDesk tunnel client
class EGTunnelClient {
  private ws: WebSocket | null = null;
  private tunnelId: string | null = null;
  private publicUrl: string | null = null;
  
  async connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://your-project.supabase.co/functions/v1/ws');
      
      this.ws.onopen = () => {
        // Register tunnel
        this.ws!.send(JSON.stringify({
          type: 'register_tunnel',
          userId: this.userId
        }));
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'tunnel_registered') {
          this.tunnelId = message.tunnelId;
          this.publicUrl = message.publicUrl;
          resolve(message.publicUrl);
        }
        
        if (message.type === 'http_request') {
          // Forward request to local HTTP server
          this.handleHttpRequest(message);
        }
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }
  
  private async handleHttpRequest(request: any) {
    // Forward to local HTTP server
    const response = await fetch(`http://localhost:8080${request.url}`, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    const responseBody = await response.text();
    
    // Send response back to Supabase
    this.ws!.send(JSON.stringify({
      type: 'http_response',
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: responseBody
    }));
  }
  
  getPublicUrl(): string | null {
    return this.publicUrl;
  }
}
```

### **3. Database Schema (Updated)**

```sql
-- Store tunnel connections
CREATE TABLE tunnel_connections (
  id SERIAL PRIMARY KEY,
  tunnel_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  public_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Store share configurations
CREATE TABLE mcp_shares (
  id SERIAL PRIMARY KEY,
  share_token VARCHAR(255) UNIQUE NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  owner_id VARCHAR(255) NOT NULL,
  tunnel_id VARCHAR(255) REFERENCES tunnel_connections(tunnel_id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  is_active BOOLEAN DEFAULT true
);
```

## Advantages of Using Supabase as Tunnel Server

### **1. Simplicity**
- No need for separate tunneling service
- Everything in one place (database + tunnel + proxy)
- Easier to manage and maintain

### **2. Integration**
- Seamless integration with existing Supabase setup
- Single authentication system
- Unified logging and monitoring

### **3. Cost Efficiency**
- No additional infrastructure costs
- Uses existing Supabase Edge Functions
- No per-tunnel fees

### **4. Security**
- All connections go through Supabase's secure infrastructure
- Built-in authentication and authorization
- Easy to implement rate limiting and access control

## The Complete Flow

### **Person A Creates Share:**
```typescript
// 1. EGDesk starts local HTTP server
const httpServer = startHttpServer(8080);

// 2. EGDesk connects to Supabase tunnel
const tunnel = new EGTunnelClient();
const publicUrl = await tunnel.connect();
// Result: "https://your-project.supabase.co/functions/v1/tunnel/abc123"

// 3. EGDesk stores share in database
await supabase.from('mcp_shares').insert({
  share_token: 'abc123def456',
  access_token: 'xyz789uvw012',
  owner_id: personA.userId,
  tunnel_id: tunnel.tunnelId,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});
```

### **Person B Makes Request:**
```typescript
// 1. Person B makes request to share URL
const response = await fetch('https://proxy.egdesk.com/share/abc123def456/api/gmail');

// 2. Supabase proxy looks up share and tunnel
const share = await supabase
  .from('mcp_shares')
  .select('tunnel_id')
  .eq('share_token', 'abc123def456')
  .single();

// 3. Supabase forwards to tunnel URL
const tunnelUrl = `https://your-project.supabase.co/functions/v1/tunnel/${share.tunnel_id}`;
const response = await fetch(`${tunnelUrl}/api/gmail`);

// 4. Tunnel forwards to EGDesk via WebSocket
// 5. EGDesk responds via WebSocket
// 6. Response sent back to Person B
```

## Why This is Better

1. **No external dependencies** - everything runs on Supabase
2. **Simpler architecture** - one less service to manage
3. **Better integration** - tunnel and database in same place
4. **Easier debugging** - all logs in one place
5. **More secure** - all traffic goes through Supabase's infrastructure

## Implementation Steps

1. **Create Supabase Edge Function** for tunnel server
2. **Update database schema** to include tunnel connections
3. **Build EGDesk tunnel client** that connects to Supabase
4. **Update proxy service** to use tunnel URLs instead of direct IPs
5. **Test the complete flow** from Person A to Person B

This approach is much cleaner and more maintainable than using external tunneling services!
