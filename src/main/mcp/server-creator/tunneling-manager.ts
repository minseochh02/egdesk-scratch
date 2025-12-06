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

import { getAuthService } from '../../auth/auth-service';
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
  ownerPermissionAdded?: boolean;
  existing_record?: {
    id?: string;
    name: string;
    server_key?: string;
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

    // Build URL
    const url = `${SUPABASE_URL}/functions/v1/register`;

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if anon key is provided
    if (SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      headers['apikey'] = SUPABASE_ANON_KEY;
    }

    // If we have a user session, use their token for Authorization instead of anon key
    // This is required because the Edge Function checks for an authenticated user
    let userEmail: string | undefined;
    try {
      const authService = getAuthService();
      const { session, user } = await authService.getSession();
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log('🔐 Using user session token for registration');
      } else {
        console.warn('⚠️ No session access token found, using anon key');
      }
      
      // Get user email for auto-invite owner feature
      if (user?.email) {
        userEmail = user.email;
        console.log(`📧 User email found: ${userEmail} - will auto-add owner permission`);
      } else {
        console.warn('⚠️ No user email found in session! Owner permission may not be added.');
        console.warn('   User object:', user ? JSON.stringify({ id: user.id, email: user.email, role: user.role }) : 'null');
      }
    } catch (err) {
      console.error('❌ Failed to retrieve user session:', err);
      console.warn('⚠️ Falling back to anon key - owner permission will NOT be added');
    }

    // Prepare body
    const body = JSON.stringify({
      name,
      // Generate a simple server_key from name if not provided (or let the function handle it if logic exists)
      // The edge function expects server_key.
      server_key: name.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      connection_url: 'http://localhost:8080', // Default
      description: `MCP Server: ${name}`,
      owner_email: userEmail  // Auto-add owner as invited user
    });

    // Make POST request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    const data = await response.json();

    // Check for successful registration (201 Created)
    // Edge Function returns { success: true, ... } not { status: 'registered' }
    if (response.ok && data.success === true) {
      console.log(`✅ Successfully registered: ${name}`);
      
      // Log whether owner permission was added
      if (data.owner_permission_added) {
        console.log(`✅ Owner permission auto-added for server: ${name}`);
      } else {
        console.warn(`⚠️ Owner permission was NOT added for server: ${name}. User may not see this server in their dashboard.`);
      }
      
      return {
        success: true,
        status: 'registered',
        name: data.name,
        ip: data.ip,
        timestamp: data.created_at,
        id: data.id,
        ownerPermissionAdded: data.owner_permission_added,
      };
    }

    // Check for 409 Conflict (server_key already exists)
    if (response.status === 409) {
      console.log(`⚠️ Server key already taken: ${name}`);
      
      // Log whether owner permission was added during re-registration attempt
      if (data.owner_permission_added) {
        console.log(`✅ Owner permission was added on re-registration for server: ${name}`);
      } else if (data.owner_permission_added === false) {
        console.warn(`⚠️ Owner permission was NOT added on re-registration for server: ${name}`);
      }
      
      return {
        success: false,
        status: 'name_taken',
        message: data.message,
        existing_record: data.existing_record,
        ownerPermissionAdded: data.owner_permission_added,
      };
    }

    // Handle error cases
    console.error(`❌ Registration failed: ${data.message || data.error || 'Unknown error'}`);
    return {
      success: false,
      status: 'error',
      message: data.message || data.error || 'Registration failed',
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

    // Register with Supabase Edge Function first to ensure secure IP storage
    console.log(`📝 Registering with Supabase Edge Function...`);
    const registration = await registerServerName(serverName);
    
    if (!registration.success) {
      // If name is taken, we can proceed (it might be our own server), otherwise fail
      if (registration.status !== 'name_taken') {
        console.error(`❌ Supabase registration failed: ${registration.message}`);
        // We generally want to fail here, but for now let's just log error and try to proceed 
        // in case the tunnel service can still handle it, or throw if strict security is required.
        // throw new Error(`Registration failed: ${registration.message}`);
      } else {
        console.log(`ℹ️ Server name already registered in Supabase, proceeding...`);
      }
    }

    console.log(`📝 Auto-registering with tunnel service...`);

    // Create tunnel client (registration happens automatically in start())
    const tunnel = new TunnelClient({
      tunnelServerUrl: TUNNEL_SERVER_URL,
      serverName,
      localServerUrl,
      reconnectInterval: 5000,
      autoPrompt: false, // Don't prompt in GUI mode
      skipRegistration: true, // Registration handled by Supabase Edge Function above
    });

    // Start tunnel (this auto-registers and connects)
    await tunnel.start();

    // Wait for connection to establish and get public URL (poll for up to 10 seconds)
    let attempts = 0;
    while ((!tunnel.isConnected() || !tunnel.getPublicUrl()) && attempts < 40) {
      await new Promise(resolve => setTimeout(resolve, 250));
      attempts++;
    }

    if (!tunnel.isConnected()) {
      console.warn(`⚠️ Tunnel started but failed to connect within 10 seconds`);
      tunnel.stop();
      return {
        success: false,
        message: 'Tunnel started but failed to establish connection to service (timeout)',
      };
    }

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
