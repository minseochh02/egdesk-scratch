/**
 * WebSocket Tunnel Client
 * 
 * Maintains a persistent WebSocket connection to the tunnel service.
 * Forwards incoming requests to local MCP server and sends responses back.
 */

import WebSocket from 'ws';
import http from 'http';
import { URL } from 'url';

interface TunnelConfig {
  tunnelServerUrl: string;
  serverName: string;
  localServerUrl: string;
  reconnectInterval?: number;
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

export class TunnelClient {
  private config: TunnelConfig;
  private tunnelServerUrl: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private isConnecting: boolean = false;
  private publicUrl: string | null = null;
  private tunnelId: string | null = null;

  constructor(config: TunnelConfig) {
    this.config = {
      ...config,
      reconnectInterval: config.reconnectInterval || 5000,
    };
    
    // Store tunnel server URL
    this.tunnelServerUrl = config.tunnelServerUrl;
  }

  /**
   * Start the tunnel client
   */
  public async start(): Promise<void> {
    console.log(`🚀 Starting tunnel client...`);
    this.shouldReconnect = true;
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
   * Connect to tunnel server via WebSocket
   */
  private async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;

    try {
      // Convert HTTP(S) URL to WS(S) URL and add /tunnel/connect path
      const wsUrl = this.tunnelServerUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://') + '/tunnel/connect';

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
          } else if (message.type === 'request') {
            const request = message as TunnelRequest;
            console.log(`📨 Received request: ${request.method} ${request.path}`);
            await this.handleRequest(request);
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
          reject(err);
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
