/**
 * WebSocket Tunnel Client
 * 
 * Maintains a persistent WebSocket connection to the tunnel service.
 * Forwards incoming requests to local MCP server and sends responses back.
 */

import WebSocket from 'ws';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import * as readline from 'readline';

interface TunnelConfig {
  tunnelServerUrl: string;
  serverName?: string;
  localServerUrl: string;
  reconnectInterval?: number;
  autoPrompt?: boolean;
}

interface TunnelRequest {
  type: 'request';
  request_id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query_params?: Record<string, string>;
  body?: string;
}

interface TunnelResponse {
  type: 'response';
  request_id: string;
  status_code: number;
  headers: Record<string, string>;
  body: string;
}

interface TunnelStreamChunk {
  type: 'stream_chunk';
  request_id: string;
  body: string;
}

interface TunnelStreamEnd {
  type: 'stream_end';
  request_id: string;
}

interface ConnectedMessage {
  type: 'connected';
  tunnel_id: string;
  public_url: string;
}

interface RegistrationResponse {
  success: boolean;
  message: string;
  name: string;
  id: string;
  server_key?: string;
  ip: string;
  created_at: string;
  is_reregistration?: boolean;
  error?: string;
}

export interface Permission {
  id: string;
  server_id: string;
  allowed_email: string;
  user_id: string | null;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  access_level: 'read_only' | 'read_write' | 'admin';
  granted_at: string;
  granted_by_ip: string;
  activated_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  notes: string | null;
}

export interface AddPermissionsRequest {
  server_key: string;
  emails: string[];
  access_level?: 'read_only' | 'read_write' | 'admin';
  expires_at?: string;
  notes?: string;
}

export interface AddPermissionsResponse {
  success: boolean;
  message: string;
  added: number;
  permissions: Permission[];
}

export interface GetPermissionsResponse {
  success: boolean;
  server_key: string;
  permissions: Permission[];
}

export interface UpdatePermissionRequest {
  access_level?: 'read_only' | 'read_write' | 'admin';
  expires_at?: string;
  notes?: string;
  status?: 'pending' | 'active' | 'revoked' | 'expired';
}

export interface UpdatePermissionResponse {
  success: boolean;
  message: string;
  permission: Permission;
}

export interface DeletePermissionResponse {
  success: boolean;
  message: string;
}

export class TunnelClient {
  private config: TunnelConfig;
  private tunnelServerUrl: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private isConnecting: boolean = false;
  private publicUrl: string | null = null;
  private tunnelId: string | null = null;
  private serverName: string | null = null;
  private registrationId: string | null = null;
  private activeStreamRequests: Map<string, http.ClientRequest> = new Map();

  constructor(config: TunnelConfig) {
    this.config = {
      ...config,
      reconnectInterval: config.reconnectInterval || 5000,
      autoPrompt: config.autoPrompt !== false, // Default to true
    };
    
    // Store tunnel server URL
    this.tunnelServerUrl = config.tunnelServerUrl;
    this.serverName = config.serverName || null;
  }

  /**
   * Start the tunnel client
   */
  public async start(): Promise<void> {
    console.log(`🚀 Starting tunnel client...`);
    this.shouldReconnect = true;
    
    // Prompt for server name and register if not already set
    if (!this.serverName && this.config.autoPrompt) {
      this.serverName = await this.promptForServerName();
      
      // Keep trying until successful registration
      let registered = false;
      while (!registered && this.serverName) {
        registered = await this.registerWithTunnelService(this.serverName);
        if (!registered) {
          // Prompt for a different name
          this.serverName = await this.promptForServerName();
        }
      }
    } else if (this.serverName) {
      // Server name provided in config
      const registered = await this.registerWithTunnelService(this.serverName);
      if (!registered) {
        throw new Error(`Failed to register MCP server '${this.serverName}'`);
      }
    } else {
      console.log(`⚠️  No server name provided. Skipping registration.`);
    }
    
    await this.connect();
  }

  /**
   * Stop the tunnel client
   */
  public async stop(): Promise<void> {
    console.log(`🛑 Stopping tunnel client...`);
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if tunnel is connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get the public URL for this tunnel
   */
  public getPublicUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Get the tunnel ID
   */
  public getTunnelId(): string | null {
    return this.tunnelId;
  }

  /**
   * Get the server name
   */
  public getServerName(): string | null {
    return this.serverName;
  }

  /**
   * Get the registration ID
   */
  public getRegistrationId(): string | null {
    return this.registrationId;
  }

  /**
   * Add allowed email(s) to a server
   */
  public async addPermissions(request: AddPermissionsRequest): Promise<AddPermissionsResponse> {
    try {
      const url = `${this.tunnelServerUrl}/permissions`;
      const postData = JSON.stringify(request);

      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData).toString(),
        },
        body: postData,
      });

      const result = JSON.parse(response.body);
      
      if (response.statusCode === 201 && result.success) {
        console.log(`✅ Added ${result.added} permission(s) to server '${request.server_key}'`);
        return result;
      } else {
        console.error(`❌ Failed to add permissions: ${result.message || result.error}`);
        throw new Error(result.message || result.error || 'Failed to add permissions');
      }
    } catch (error) {
      console.error('❌ Error adding permissions:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Get all permissions for a server
   */
  public async getPermissions(serverKey: string): Promise<GetPermissionsResponse> {
    try {
      const url = `${this.tunnelServerUrl}/permissions/${encodeURIComponent(serverKey)}`;

      const response = await this.makeHttpRequest(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = JSON.parse(response.body);
      
      if (response.statusCode === 200 && result.success) {
        console.log(`✅ Retrieved ${result.permissions.length} permission(s) for server '${serverKey}'`);
        return result;
      } else {
        console.error(`❌ Failed to get permissions: ${result.message || result.error}`);
        throw new Error(result.message || result.error || 'Failed to get permissions');
      }
    } catch (error) {
      console.error('❌ Error getting permissions:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Update a permission
   */
  public async updatePermission(
    permissionId: string,
    updates: UpdatePermissionRequest
  ): Promise<UpdatePermissionResponse> {
    try {
      const url = `${this.tunnelServerUrl}/permissions/${encodeURIComponent(permissionId)}`;
      const postData = JSON.stringify(updates);

      const response = await this.makeHttpRequest(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData).toString(),
        },
        body: postData,
      });

      const result = JSON.parse(response.body);
      
      if (response.statusCode === 200 && result.success) {
        console.log(`✅ Updated permission ${permissionId}`);
        return result;
      } else {
        console.error(`❌ Failed to update permission: ${result.message || result.error}`);
        throw new Error(result.message || result.error || 'Failed to update permission');
      }
    } catch (error) {
      console.error('❌ Error updating permission:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Revoke a permission (soft delete)
   */
  public async revokePermission(permissionId: string): Promise<DeletePermissionResponse> {
    try {
      const url = `${this.tunnelServerUrl}/permissions/${encodeURIComponent(permissionId)}`;

      const response = await this.makeHttpRequest(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = JSON.parse(response.body);
      
      if (response.statusCode === 200 && result.success) {
        console.log(`✅ Revoked permission ${permissionId}`);
        return result;
      } else {
        console.error(`❌ Failed to revoke permission: ${result.message || result.error}`);
        throw new Error(result.message || result.error || 'Failed to revoke permission');
      }
    } catch (error) {
      console.error('❌ Error revoking permission:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Prompt user for MCP server name
   */
  private async promptForServerName(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise<string>((resolve) => {
      rl.question('Enter MCP Server Name: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Register MCP server with tunnel service
   * @returns true if registration successful, false otherwise
   */
  private async registerWithTunnelService(name: string): Promise<boolean> {
    try {
      console.log(`📝 Registering MCP server "${name}" with tunnel service...`);

      const registrationUrl = `${this.tunnelServerUrl}/register`;
      
      // Generate server_key from name (URL-safe, lowercase, replace spaces with hyphens)
      const server_key = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      
      const postData = JSON.stringify({ 
        name,
        server_key,
        description: `MCP server: ${name}`,
        connection_url: this.config.localServerUrl
      });

      const response = await this.makeHttpRequest(registrationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData).toString(),
        },
        body: postData,
      });

      if (response.statusCode === 201 || response.statusCode === 200) {
        const result: RegistrationResponse = JSON.parse(response.body);
        
        if (!result.success) {
          console.error(`❌ Registration failed: ${result.message}`);
          return false;
        }
        
        this.registrationId = result.id;
        
        if (result.is_reregistration) {
          console.log(`✅ Server re-registered (updated)!`);
        } else {
          console.log(`✅ Registration successful!`);
        }
        console.log(`   Name: ${result.name}`);
        console.log(`   Server Key: ${result.server_key || server_key}`);
        console.log(`   ID: ${result.id}`);
        console.log(`   IP: ${result.ip}`);
        console.log(`   Registered at: ${result.created_at}`);
        return true;
      } else if (response.statusCode === 409) {
        // Server key already exists
        const error = JSON.parse(response.body);
        console.error(`❌ ${error.message || error.error}`);
        console.log(`💡 Please choose a different server name.`);
        return false;
      } else {
        const error = JSON.parse(response.body);
        console.error(`❌ Registration failed with status ${response.statusCode}: ${error.message || response.body}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error registering with tunnel service:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Make HTTP/HTTPS request
   */
  private async makeHttpRequest(url: string, options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method: options.method,
        headers: options.headers,
      };

      const req = httpModule.request(requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            body
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Connect to tunnel server via WebSocket
   */
  private async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      // Convert HTTP(S) URL to WS(S) URL and add /tunnel/connect path with server name
      let wsUrl = this.tunnelServerUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://') + '/tunnel/connect';
      
      // Add server name as query parameter if available
      if (this.serverName) {
        wsUrl += `?name=${encodeURIComponent(this.serverName)}`;
      }

      console.log(`🔌 Connecting to tunnel server: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      // Handle connection open
      this.ws.on('open', () => {
        console.log(`✅ WebSocket connected`);
      });

      // Handle incoming messages
      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'connected') {
            const connectedMsg = message as ConnectedMessage;
            this.tunnelId = connectedMsg.tunnel_id;
            this.publicUrl = connectedMsg.public_url;
            this.isConnecting = false;
            
            console.log(`🎉 Tunnel established!`);
            console.log(`📡 Tunnel ID: ${this.tunnelId}`);
            console.log(`🌐 Public URL: ${this.publicUrl}`);
            console.log(`🔄 Forwarding to: ${this.config.localServerUrl}`);
          } else if (message.type === 'error') {
            console.error(`❌ Server error: ${message.message}`);
            this.isConnecting = false;
            // Close the connection
            if (this.ws) {
              this.ws.close();
            }
          } else if (message.type === 'request') {
            const request = message as TunnelRequest;
            console.log(`📨 Received request: ${request.method} ${request.path}`);
            await this.handleRequest(request);
          } else if (message.type === 'ping') {
            // Respond to heartbeat ping
            console.log(`💓 Received heartbeat ping`);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'pong',
                timestamp: message.timestamp
              }));
            }
          } else if (message.type === 'stream_cancel') {
            // Client disconnected from SSE stream - cancel the request
            const requestId = message.request_id;
            console.log(`🛑 Received stream cancellation for ${requestId}`);
            const activeRequest = this.activeStreamRequests.get(requestId);
            if (activeRequest) {
              activeRequest.destroy();
              this.activeStreamRequests.delete(requestId);
              console.log(`✅ Cancelled stream request ${requestId}`);
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      // Handle connection close
      this.ws.on('close', () => {
        console.log(`❌ WebSocket disconnected`);
        this.ws = null;
        this.publicUrl = null;
        this.tunnelId = null;
        this.isConnecting = false;
        
        // Clean up all active stream requests
        if (this.activeStreamRequests.size > 0) {
          console.log(`🧹 Cleaning up ${this.activeStreamRequests.size} active stream request(s)`);
          for (const [requestId, req] of this.activeStreamRequests.entries()) {
            try {
              req.destroy();
            } catch (error) {
              console.error(`Error destroying request ${requestId}:`, error);
            }
          }
          this.activeStreamRequests.clear();
        }
        
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      // Handle errors
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      });

    } catch (error) {
      console.error('Error connecting to tunnel:', error);
      this.ws = null;
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle incoming request through tunnel
   */
  private async handleRequest(request: TunnelRequest): Promise<void> {
    try {
      console.log(`→ ${request.method} ${request.path}`);

      // Forward request to local server
      const targetUrl = new URL(this.config.localServerUrl);
      const [pathname, search] = request.path.split('?');
      
      const options: http.RequestOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: pathname + (search ? `?${search}` : ''),
        method: request.method,
        headers: request.headers,
      };

      // Check if this is an SSE request
      const isSSE = request.method === 'GET' && (request.path.includes('/sse') || request.path.endsWith('/sse'));

      if (isSSE) {
        // Handle SSE streaming request
        await this.handleSSERequest(request, options);
      } else {
        // Handle regular request/response
        await this.handleRegularRequest(request, options);
      }

    } catch (error) {
      console.error('Error handling request:', error);

      // Send error response
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const errorResponse: TunnelResponse = {
          type: 'response',
          request_id: request.request_id,
          status_code: 502,
          headers: {},
          body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        };

        this.ws.send(JSON.stringify(errorResponse));
      }
    }
  }

  /**
   * Handle regular (non-streaming) request
   */
  private async handleRegularRequest(request: TunnelRequest, options: http.RequestOptions): Promise<void> {
    const responseData = await new Promise<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }>((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const headers: Record<string, string> = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
              headers[key] = value;
            } else if (Array.isArray(value)) {
              headers[key] = value.join(', ');
            }
          });
          
          resolve({
            statusCode: res.statusCode || 200,
            headers,
            body
          });
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      // Send request body if present
      if (request.body) {
        req.write(request.body);
      }
      
      req.end();
    });

    // Send response back through WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const response: TunnelResponse = {
        type: 'response',
        request_id: request.request_id,
        status_code: responseData.statusCode,
        headers: responseData.headers,
        body: responseData.body,
      };

      this.ws.send(JSON.stringify(response));
      console.log(`← ${responseData.statusCode} ${request.method} ${options.path}`);
    }
  }

  /**
   * Handle SSE streaming request
   */
  private async handleSSERequest(request: TunnelRequest, options: http.RequestOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = http.request(options, (res) => {
        console.log(`← ${res.statusCode} ${request.method} ${options.path} (streaming)`);

        // Stream response chunks as they arrive
        res.on('data', (chunk) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const chunkStr = chunk.toString();
            console.log(`📤 Sending stream chunk (${chunkStr.length} bytes) for ${request.request_id}`);
            const streamChunk: TunnelStreamChunk = {
              type: 'stream_chunk',
              request_id: request.request_id,
              body: chunkStr
            };
            this.ws.send(JSON.stringify(streamChunk));
          }
        });

        // Signal end of stream
        res.on('end', () => {
          console.log(`🏁 Stream ended for ${request.request_id}`);
          // Clean up from active requests
          this.activeStreamRequests.delete(request.request_id);
          
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const streamEnd: TunnelStreamEnd = {
              type: 'stream_end',
              request_id: request.request_id
            };
            this.ws.send(JSON.stringify(streamEnd));
          }
          resolve();
        });

        res.on('error', (err) => {
          // Clean up from active requests
          this.activeStreamRequests.delete(request.request_id);
          reject(err);
        });
      });

      req.on('error', (err) => {
        // Clean up from active requests
        this.activeStreamRequests.delete(request.request_id);
        reject(err);
      });

      // Track this streaming request so it can be cancelled
      this.activeStreamRequests.set(request.request_id, req);
      console.log(`📝 Tracking stream request ${request.request_id}`);

      // Send request body if present
      if (request.body) {
        req.write(request.body);
      }

      req.end();
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`🔄 Reconnecting in ${this.config.reconnectInterval}ms...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }
}
