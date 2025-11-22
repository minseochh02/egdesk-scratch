# Tunnel Registration API Usage Example

## Overview
The tunnel registration API allows you to register your MCP server name with Supabase to get a tunnel URL for public access.

## API Method

```typescript
window.electron.mcp.registerTunnel(name: string, password?: string)
```

## Usage in MCPServer.tsx

### Example 1: Simple Registration Button

```typescript
const handleRegisterTunnel = async (serverName: string) => {
  try {
    console.log(`🌐 Registering tunnel for server: ${serverName}`);
    
    const result = await window.electron.mcp.registerTunnel(serverName);
    
    if (result.success && result.status === 'registered') {
      alert(`✅ Tunnel registered successfully!
      
Server Name: ${result.name}
IP Address: ${result.ip}
Registered At: ${result.timestamp}
ID: ${result.id}

Your tunnel is now active!`);
    } else if (result.status === 'name_taken') {
      alert(`⚠️ Server name is already taken!

Existing Registration:
Name: ${result.existing_record?.name}
IP: ${result.existing_record?.ip}
Registered: ${result.existing_record?.registered_at}

Please choose a different name.`);
    } else {
      alert(`❌ Registration failed: ${result.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error registering tunnel:', error);
    alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
```

### Example 2: Registration with Password

```typescript
const handleRegisterTunnelWithPassword = async (serverName: string, password: string) => {
  try {
    const result = await window.electron.mcp.registerTunnel(serverName, password);
    
    if (result.success) {
      console.log('Tunnel registered with password protection');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Example 3: Integration with Existing Server

Add this button to your running servers section in MCPServer.tsx:

```typescript
// In the running server card actions section
{server.accessLevel?.level === 'public' && (
  <button
    className="running-servers-action-btn running-servers-tunnel-btn"
    onClick={() => handleRegisterTunnel(server.name)}
    title="Register tunnel for public access"
  >
    <FontAwesomeIcon icon={faGlobe} />
    Register Tunnel
  </button>
)}
```

### Example 4: Store Tunnel Registration in Server State

```typescript
const [tunnelRegistrations, setTunnelRegistrations] = useState<Map<string, any>>(new Map());

const handleRegisterAndStore = async (server: RunningMCPServer) => {
  const result = await window.electron.mcp.registerTunnel(server.name);
  
  if (result.success) {
    // Store the registration info
    setTunnelRegistrations(prev => new Map(prev).set(server.id, result));
    
    // Update the server's public URL
    const tunnelUrl = `https://${result.name}.your-domain.com`;
    
    // You could update the server configuration here
    await window.electron.mcpConfig.connections.update(server.id, {
      tunnelUrl,
      tunnelRegistered: true,
      tunnelRegistrationId: result.id
    });
  }
};
```

## Response Format

### Success Response (registered)
```typescript
{
  success: true,
  status: 'registered',
  name: 'my-server-name',
  ip: '123.45.67.89',
  timestamp: '2025-10-20T12:34:56.789Z',
  id: 'uuid-here'
}
```

### Name Taken Response
```typescript
{
  success: false,
  status: 'name_taken',
  message: "MCP name 'my-server-name' is already registered",
  existing_record: {
    name: 'my-server-name',
    ip: '123.45.67.89',
    registered_at: '2025-10-15T10:00:00.000Z'
  }
}
```

### Error Response
```typescript
{
  success: false,
  status: 'error',
  message: 'Error description here'
}
```

## Implementation Summary

✅ **Main Process** (`main.ts`):
- IPC handler registered: `'mcp-tunnel-register'`
- Calls `registerServerName()` from `tunneling-manager.ts`

✅ **Preload** (`preload.ts`):
- Exposed as: `window.electron.mcp.registerTunnel()`

✅ **Tunneling Manager** (`tunneling-manager.ts`):
- Function: `registerServerName(name, password?)`
- Makes GET request to Supabase Edge Function
- Returns typed `TunnelRegistrationResult`

## Next Steps

After successful registration:
1. Update the server's public MCP schema with the actual tunnel URL
2. Display the tunnel URL to the user
3. Store the registration ID for future reference
4. Add a "Unregister Tunnel" button if needed

