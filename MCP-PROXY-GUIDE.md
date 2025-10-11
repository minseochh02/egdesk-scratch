# MCP Proxy System Guide

## Overview

The MCP Proxy System enables secure sharing of MCP server access between users. When Person A sets up their MCP server, they can generate a shareable URL that allows Person B to access Person A's data through a secure proxy service.

## How It Works

### 1. **Person A: Setting Up Shareable Access**

Person A has their EGDesk application running with:
- Local SQLite database containing their data
- HTTP server running on localhost:8080
- Gmail integration, file access, etc.

**Step 1: Generate Shareable URL**
```bash
# Person A runs this command in EGDesk
egdesk mcp share --generate-url
```

**Output:**
```
✅ Shareable URL generated successfully!
🔗 Share URL: https://proxy.egdesk.com/share/abc123def456
🔑 Access Token: xyz789uvw012
📋 Share this URL with trusted users
⚠️  This URL provides access to your data - use carefully!
```

**What happens behind the scenes:**
1. EGDesk generates a unique share token
2. Registers the token with Supabase proxy service
3. Maps the token to Person A's localhost server
4. Returns a public URL that routes through the proxy

### 2. **Person B: Accessing Person A's Data**

Person B receives the shareable URL from Person A.

**Step 1: Access the Shared URL**
```bash
# Person B can access via curl, browser, or API client
curl "https://proxy.egdesk.com/share/abc123def456/api/health"
```

**Step 2: Authentication (if required)**
```bash
# If Person A has set up authentication
curl -H "Authorization: Bearer xyz789uvw012" \
     "https://proxy.egdesk.com/share/abc123def456/api/gmail"
```

### 3. **Proxy Flow Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Person B      │    │   Supabase       │    │   Person A's    │    │   Person A's    │
│   (Consumer)    │    │   Proxy Service  │    │   Local Server  │    │   Data          │
│                 │    │                  │    │                 │    │                 │
│ • API Request   │───►│ • Route by Token │───►│ • localhost:8080│───►│ • SQLite DB     │
│ • Share URL     │    │ • Authentication │    │ • HTTP Server   │    │ • Gmail Data    │
│ • Access Token  │    │ • Rate Limiting  │    │ • Data Access   │    │ • File System   │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
```

## Detailed Flow

### **Step 1: Person A Generates Share URL**

```typescript
// EGDesk generates share token
const shareToken = generateSecureToken(); // e.g., "abc123def456"
const accessToken = generateAccessToken(); // e.g., "xyz789uvw012"

// Get Person A's public IP address (this is the key!)
const publicIP = await getPublicIPAddress(); // e.g., "203.0.113.42"
const localPort = 8080; // Person A's local server port

// Register with Supabase proxy
await supabase.from('mcp_shares').insert({
  share_token: shareToken,
  access_token: accessToken,
  owner_id: personA.userId,
  public_ip: publicIP,           // Person A's public IP
  local_port: localPort,         // Person A's local port
  created_at: new Date(),
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  permissions: ['read'], // Person A can set permissions
  is_active: true
});

// Return shareable URL
const shareUrl = `https://proxy.egdesk.com/share/${shareToken}`;
```

### **Step 2: Person B Makes Request**

```bash
# Person B makes request to shared URL
curl "https://proxy.egdesk.com/share/abc123def456/api/gmail"
```

### **Step 3: Supabase Proxy Processing**

```typescript
// Supabase Edge Function processes the request
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const shareToken = url.pathname.split('/share/')[1];
  
  // Look up share configuration
  const share = await supabase
    .from('mcp_shares')
    .select('*')
    .eq('share_token', shareToken)
    .eq('is_active', true)
    .single();
  
  if (!share) {
    return new Response('Share not found or expired', { status: 404 });
  }
  
  // Check if expired
  if (new Date() > new Date(share.expires_at)) {
    return new Response('Share has expired', { status: 410 });
  }
  
  // Build Person A's server URL using their public IP and port
  const personAServerUrl = `http://${share.public_ip}:${share.local_port}`;
  const apiPath = url.pathname.replace(`/share/${shareToken}`, '');
  const fullUrl = `${personAServerUrl}${apiPath}`;
  
  // Forward request to Person A's local server
  const response = await fetch(fullUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      'Authorization': `Bearer ${share.access_token}`
    },
    body: req.body
  });
  
  return response;
}
```

### **Step 4: Person A's Local Server Response**

```typescript
// Person A's local server receives the request
app.get('/api/gmail', authenticateToken, async (req, res) => {
  // Verify the access token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!isValidAccessToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Fetch data from local SQLite
  const emails = await db.query('SELECT * FROM emails WHERE user_id = ?', [userId]);
  
  res.json({
    success: true,
    data: {
      emails: emails,
      totalCount: emails.length
    }
  });
});
```

## Security Features

### **1. Token-Based Authentication**
- Each share has a unique access token
- Tokens can be rotated or revoked
- No direct access to Person A's credentials

### **2. Permission Control**
```json
{
  "permissions": {
    "read": true,
    "write": false,
    "admin": false,
    "endpoints": ["/api/gmail", "/api/files"],
    "rate_limit": "100/hour"
  }
}
```

### **3. Time-Limited Access**
- Shares automatically expire (default: 7 days)
- Person A can set custom expiration
- Can be revoked immediately if needed

### **4. Rate Limiting**
- Prevents abuse of shared access
- Configurable per share
- IP-based and token-based limiting

### **5. Audit Logging**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "share_token": "abc123def456",
  "requester_ip": "192.168.1.100",
  "endpoint": "/api/gmail",
  "method": "GET",
  "status": 200,
  "response_time": 45
}
```

## Usage Examples

### **Example 1: Sharing Gmail Access**

**Person A (Data Owner):**
```bash
# Generate share URL for Gmail access
egdesk mcp share --service gmail --permissions read --expires 3d
```

**Person B (Consumer):**
```bash
# Access Person A's Gmail data
curl "https://proxy.egdesk.com/share/abc123def456/api/gmail?query=from:important@company.com"
```

### **Example 2: Sharing File Access**

**Person A (Data Owner):**
```bash
# Generate share URL for specific folder
egdesk mcp share --service files --path /Documents/Projects --permissions read --expires 1d
```

**Person B (Consumer):**
```bash
# List files in shared folder
curl "https://proxy.egdesk.com/share/abc123def456/api/files?path=/Documents/Projects"
```

### **Example 3: Integration with AI Assistant**

**Person B can use the shared URL in their AI assistant:**
```json
{
  "mcp_servers": {
    "person_a_data": {
      "command": "curl",
      "args": ["https://proxy.egdesk.com/share/abc123def456/api/health"],
      "env": {
        "AUTHORIZATION": "Bearer xyz789uvw012"
      }
    }
  }
}
```

## Management Commands

### **For Person A (Data Owner):**

```bash
# List all active shares
egdesk mcp share --list

# Revoke a specific share
egdesk mcp share --revoke abc123def456

# Update share permissions
egdesk mcp share --update abc123def456 --permissions read,write

# Extend share expiration
egdesk mcp share --extend abc123def456 --expires 7d

# View share usage logs
egdesk mcp share --logs abc123def456
```

### **For Person B (Consumer):**

```bash
# Test share URL accessibility
curl "https://proxy.egdesk.com/share/abc123def456/api/health"

# Get available endpoints
curl "https://proxy.egdesk.com/share/abc123def456/api/config"
```

## Error Handling

### **Common Error Responses:**

```json
// Share not found
{
  "error": "Share not found",
  "code": "SHARE_NOT_FOUND",
  "status": 404
}

// Share expired
{
  "error": "Share has expired",
  "code": "SHARE_EXPIRED", 
  "status": 410
}

// Rate limit exceeded
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429
}

// Insufficient permissions
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS",
  "status": 403
}

// Person A's server offline
{
  "error": "Data source unavailable",
  "code": "SOURCE_OFFLINE",
  "status": 503
}
```

## Best Practices

### **For Person A (Data Owner):**
1. **Set appropriate expiration times** - Don't create permanent shares
2. **Use minimal permissions** - Only grant what's needed
3. **Monitor usage logs** - Check who's accessing your data
4. **Rotate tokens regularly** - Change access tokens periodically
5. **Be selective about what you share** - Don't share sensitive data

### **For Person B (Consumer):**
1. **Respect rate limits** - Don't overwhelm the data source
2. **Cache data appropriately** - Don't make unnecessary requests
3. **Handle errors gracefully** - Implement proper error handling
4. **Don't store sensitive data** - Only use what you need
5. **Report issues** - Let Person A know if there are problems

## Troubleshooting

### **Share URL Not Working:**
1. Check if Person A's server is running
2. Verify the share token is correct
3. Check if the share has expired
4. Ensure Person A's firewall allows connections

### **Authentication Issues:**
1. Verify the access token is correct
2. Check if the token has been revoked
3. Ensure proper Authorization header format

### **Permission Denied:**
1. Check what permissions were granted
2. Verify the endpoint is allowed
3. Contact Person A to update permissions

## Privacy & Compliance

- **Data never leaves Person A's machine** - Only API responses are proxied
- **No data storage in proxy** - Supabase only forwards requests
- **Audit trail maintained** - All access is logged
- **User control** - Person A can revoke access anytime
- **GDPR compliant** - Data remains under user control

## Support

- 📧 Email: support@egdesk.com
- 💬 Discord: [EGDesk Community](https://discord.gg/egdesk)
- 📖 Documentation: [docs.egdesk.com](https://docs.egdesk.com)
- 🐛 Issues: [GitHub Issues](https://github.com/egdesk/egdesk/issues)
