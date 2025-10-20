/**
 * WebSocket Tunnel Client (using Supabase Realtime)
 * 
 * Maintains a persistent connection to Supabase Realtime for tunneling.
 * Forwards incoming requests to local MCP server and sends responses back.
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import http from 'http';
import { URL } from 'url';

interface TunnelConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serverName: string;
  localServerUrl: string;
  reconnectInterval?: number;
}

interface TunnelRequest {
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

export class TunnelClient {
  private config: TunnelConfig;
  private supabase: any;
  private channel: RealtimeChannel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor(config: TunnelConfig) {
    this.config = {
      ...config,
      reconnectInterval: config.reconnectInterval || 5000,
    };

    // Initialize Supabase client
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  /**
   * Start the tunnel client
   */
  public async start(): Promise<void> {
    console.log(`🚀 Starting tunnel client for: ${this.config.serverName}`);
    this.shouldReconnect = true;
    await this.connect();
  }

  /**
   * Stop the tunnel client
   */
  public async stop(): Promise<void> {
    console.log(`🛑 Stopping tunnel client for: ${this.config.serverName}`);
    this.shouldReconnect = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Check if tunnel is connected
   */
  public isConnected(): boolean {
    return this.channel !== null;
  }

  /**
   * Connect to Supabase Realtime
   */
  private async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log(`🔌 Connecting to Supabase Realtime for: ${this.config.serverName}`);

      // Subscribe to the tunnel channel for this server
      // All requests come through this single channel
      // Note: Setting self: true to ensure we receive messages from the edge function
      // (which uses the same auth credentials)
      const channelName = `tunnel:${this.config.serverName}`;
      console.log(`📺 Creating channel: ${channelName}`);
      this.channel = this.supabase.channel(channelName, {
        config: {
          broadcast: {
            self: true  // Receive messages from all sources including same auth
          }
        }
      });

      // Listen for incoming requests
      if (!this.channel) {
        throw new Error('Failed to create channel');
      }

      // Add catch-all listener to see ALL broadcasts
      this.channel
        .on('broadcast', { event: '*' }, (payload: any) => {
          console.log(`🔔 Received broadcast event:`, payload.event, payload.payload);
        })
        .on('broadcast', { event: 'request' }, async (payload: any) => {
          console.log(`📨 Received request via Realtime:`, payload.payload.requestId);
          await this.handleRequest(payload.payload as TunnelRequest);
        })
        .on('broadcast', { event: 'ping' }, async (payload: any) => {
          console.log(`🏓 Received PING, sending PONG...`, payload);
          if (this.channel) {
            await this.channel.send({
              type: 'broadcast',
              event: 'pong',
              payload: { timestamp: Date.now(), message: 'Hello from tunnel client!' }
            });
            console.log(`🏓 PONG sent`);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Tunnel connected: ${this.config.serverName}`);
            console.log(`🎉 Tunnel established at ${new Date().toISOString()}`);
            this.isConnecting = false;
            this.startPingInterval();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error(`❌ Tunnel error: ${status}`);
            this.channel = null;
            this.isConnecting = false;
            if (this.shouldReconnect) {
              this.scheduleReconnect();
            }
          }
        });

    } catch (error) {
      console.error('Error connecting to tunnel:', error);
      this.channel = null;
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
      console.log(`📨 Tunnel request: ${request.method} ${request.path}`);

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

      // Make HTTP request to local server
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

      // Send response back through Realtime broadcast
      if (this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'response',
          payload: {
            requestId: request.requestId,
            status: responseData.statusCode,
            headers: responseData.headers,
            body: responseData.body,
          }
        });

        console.log(`✅ Response sent: ${responseData.statusCode}`);
      }

    } catch (error) {
      console.error('Error handling request:', error);

      // Send error response
      if (this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'error',
          payload: {
            requestId: request.requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        });
      }
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Supabase Realtime keeps connections alive automatically
    // But we can still send periodic pings if needed
    this.pingInterval = setInterval(() => {
      if (this.channel) {
        // Connection is alive if channel exists
        console.log(`💓 Tunnel heartbeat: ${this.config.serverName}`);
      }
    }, 30000);
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
