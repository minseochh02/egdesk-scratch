/**
 * Tunneling Manager
 * 
 * Handles tunneling services for MCP server external access.
 * This module manages:
 * - Tunnel service integration provided by us.
 * - Tunnel URL management and monitoring
 * - Security and authentication for tunneled connections
 * - Tunnel lifecycle management
 */

import { 
  TunnelClient, 
  AddPermissionsRequest, 
  AddPermissionsResponse,
  GetPermissionsResponse,
  UpdatePermissionRequest,
  UpdatePermissionResponse,
  DeletePermissionResponse
} from './tunnel-client';

// Environment variables (loaded via dotenv in main.ts)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TUNNEL_SERVER_URL = process.env.TUNNEL_SERVER_URL || 'https://tunneling-service.onrender.com';

// Active tunnel clients
const activeTunnels = new Map<string, TunnelClient>();

export interface TunnelRegistrationResult {
  success: boolean;
  status: 'registered' | 'name_taken' | 'error';
  message?: string;
  name?: string;
  ip?: string;
  timestamp?: string;
  id?: string;
  existing_record?: {
    name: string;
    ip: string;
    registered_at: string;
  };
}

/**
 * Register MCP server name with Supabase to get tunnel URL
 * @param name - The server name to register
 * @param password - Optional password for the server
 * @returns Registration result with server details
 */
export async function registerServerName(
  name: string,
  password?: string
): Promise<TunnelRegistrationResult> {
  try {
    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }

    console.log(`🔗 Registering MCP server: ${name}`);

    // Build URL with query parameters
    const url = `${SUPABASE_URL}/functions/v1/register?name=${encodeURIComponent(name)}${
      password ? `&password=${encodeURIComponent(password)}` : ''
    }`;

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if anon key is provided
    if (SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      headers['apikey'] = SUPABASE_ANON_KEY;
    }

    // Make GET request
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (response.ok && data.status === 'registered') {
      console.log(`✅ Successfully registered: ${name}`);
      return {
        success: true,
        status: 'registered',
        name: data.name,
        ip: data.ip,
        timestamp: data.timestamp,
        id: data.id,
      };
    }

    if (response.status === 409 && data.status === 'name_taken') {
      console.log(`⚠️ Name already taken: ${name}`);
      return {
        success: false,
        status: 'name_taken',
        message: data.message,
        existing_record: data.existing_record,
      };
    }

    // Handle error cases
    console.error(`❌ Registration failed: ${data.message || 'Unknown error'}`);
    return {
      success: false,
      status: 'error',
      message: data.message || 'Registration failed',
    };
  } catch (error) {
    console.error('❌ Registration error:', error);
    return {
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Start WebSocket tunnel for a server
 * Auto-registers the server name and establishes tunnel connection
 * @param serverName - The server name to register and tunnel
 * @param localServerUrl - Local server URL (e.g., 'http://localhost:8080')
 * @returns Tunnel start result with public URL
 */
export async function startTunnel(
  serverName: string,
  localServerUrl: string = 'http://localhost:8080'
): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
  publicUrl?: string;
  registrationId?: string;
  tunnelId?: string;
}> {
  try {
    // Check if tunnel already running
    const existingTunnel = activeTunnels.get(serverName);
    if (existingTunnel && existingTunnel.isConnected()) {
      return {
        success: false,
        message: 'Tunnel is already running for this server',
        publicUrl: existingTunnel.getPublicUrl() || undefined,
      };
    }

    console.log(`🚀 Starting tunnel: ${serverName} → ${localServerUrl}`);
    console.log(`📝 Auto-registering with tunnel service...`);

    // Create tunnel client (registration happens automatically in start())
    const tunnel = new TunnelClient({
      tunnelServerUrl: TUNNEL_SERVER_URL,
      serverName,
      localServerUrl,
      reconnectInterval: 5000,
      autoPrompt: false, // Don't prompt in GUI mode
    });

    // Start tunnel (this auto-registers and connects)
    await tunnel.start();

    // Wait a bit for connection to establish and get public URL
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Store active tunnel
    activeTunnels.set(serverName, tunnel);

    const publicUrl = tunnel.getPublicUrl();
    const registrationId = tunnel.getRegistrationId();
    const tunnelId = tunnel.getTunnelId();

    console.log(`✅ Tunnel started: ${serverName}`);
    if (publicUrl) {
      console.log(`🌐 Public URL: ${publicUrl}`);
    }

    return {
      success: true,
      message: `Tunnel established for ${serverName}`,
      publicUrl: publicUrl || undefined,
      registrationId: registrationId || undefined,
      tunnelId: tunnelId || undefined,
    };
  } catch (error) {
    console.error('❌ Failed to start tunnel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stop WebSocket tunnel for a server
 * @param serverName - The server name
 * @returns Tunnel stop result
 */
export function stopTunnel(
  serverName: string
): { success: boolean; message?: string; error?: string } {
  try {
    const tunnel = activeTunnels.get(serverName);
    
    if (!tunnel) {
      return {
        success: false,
        message: 'No active tunnel found for this server',
      };
    }

    console.log(`🛑 Stopping tunnel: ${serverName}`);

    tunnel.stop();
    activeTunnels.delete(serverName);

    console.log(`✅ Tunnel stopped: ${serverName}`);

    return {
      success: true,
      message: `Tunnel stopped for ${serverName}`,
    };
  } catch (error) {
    console.error('❌ Failed to stop tunnel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get tunnel status for a server
 * @param serverName - The server name
 * @returns Tunnel status
 */
export function getTunnelStatus(
  serverName: string
): { isActive: boolean; isConnected: boolean } {
  const tunnel = activeTunnels.get(serverName);
  
  return {
    isActive: tunnel !== undefined,
    isConnected: tunnel ? tunnel.isConnected() : false,
  };
}

/**
 * Get full tunnel info including public URL
 * @param serverName - The server name
 * @returns Tunnel information
 */
export function getTunnelInfo(
  serverName: string
): { 
  isActive: boolean; 
  isConnected: boolean;
  publicUrl?: string;
  tunnelId?: string;
  registrationId?: string;
  serverName?: string;
} {
  const tunnel = activeTunnels.get(serverName);
  
  if (!tunnel) {
    return {
      isActive: false,
      isConnected: false,
    };
  }
  
  return {
    isActive: true,
    isConnected: tunnel.isConnected(),
    publicUrl: tunnel.getPublicUrl() || undefined,
    tunnelId: tunnel.getTunnelId() || undefined,
    registrationId: tunnel.getRegistrationId() || undefined,
    serverName: tunnel.getServerName() || undefined,
  };
}

/**
 * Get all active tunnels
 * @returns List of active tunnel names
 */
export function getActiveTunnels(): string[] {
  return Array.from(activeTunnels.keys());
}

/**
 * Stop all tunnels
 */
export function stopAllTunnels(): void {
  console.log('🛑 Stopping all tunnels...');
  
  for (const [serverName, tunnel] of activeTunnels.entries()) {
    console.log(`  Stopping: ${serverName}`);
    tunnel.stop();
  }
  
  activeTunnels.clear();
  console.log('✅ All tunnels stopped');
}

/**
 * Add permissions to a server
 * Creates a temporary client to make the request
 */
export async function addPermissions(request: AddPermissionsRequest): Promise<AddPermissionsResponse> {
  const client = new TunnelClient({
    tunnelServerUrl: TUNNEL_SERVER_URL,
    localServerUrl: 'http://localhost:8080', // Not used for permissions
    autoPrompt: false
  });
  
  return await client.addPermissions(request);
}

/**
 * Get permissions for a server
 */
export async function getPermissions(serverKey: string): Promise<GetPermissionsResponse> {
  const client = new TunnelClient({
    tunnelServerUrl: TUNNEL_SERVER_URL,
    localServerUrl: 'http://localhost:8080', // Not used for permissions
    autoPrompt: false
  });
  
  return await client.getPermissions(serverKey);
}

/**
 * Update a permission
 */
export async function updatePermission(
  permissionId: string, 
  updates: UpdatePermissionRequest
): Promise<UpdatePermissionResponse> {
  const client = new TunnelClient({
    tunnelServerUrl: TUNNEL_SERVER_URL,
    localServerUrl: 'http://localhost:8080', // Not used for permissions
    autoPrompt: false
  });
  
  return await client.updatePermission(permissionId, updates);
}

/**
 * Revoke a permission
 */
export async function revokePermission(permissionId: string): Promise<DeletePermissionResponse> {
  const client = new TunnelClient({
    tunnelServerUrl: TUNNEL_SERVER_URL,
    localServerUrl: 'http://localhost:8080', // Not used for permissions
    autoPrompt: false
  });
  
  return await client.revokePermission(permissionId);
}
