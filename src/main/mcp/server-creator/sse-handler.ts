/**
 * SSE Handler for MCP Protocol
 * 
 * Implements Server-Sent Events transport for Model Context Protocol.
 * This allows Cursor and other MCP clients to connect via HTTP/SSE.
 * 
 * This is a generic handler that works with any MCP service.
 */

import * as http from 'http';
import { IMCPService } from '../types/mcp-service';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Shared SSE connections across all handler instances
const globalSSEConnections = new Map<string, http.ServerResponse>();
// Track if we're already sending a response to avoid duplicate sends
const responseSendLocks = new Map<string, boolean>();

export class SSEMCPHandler {
  private service: IMCPService;
  private endpointPath: string;
  private sessionId: string;

  constructor(service: IMCPService, endpointPath: string = '/sse', sessionId: string = 'default') {
    this.service = service;
    this.endpointPath = endpointPath;
    this.sessionId = sessionId;
  }

  /**
   * Handle SSE connection (GET /sse)
   * This keeps the connection open for server-to-client messages
   */
  async handleSSEStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Use the configured session ID for this handler instance
    const sessionId = this.sessionId;
    
    // Check if we already have an active SSE connection
    const existingConnection = globalSSEConnections.get(sessionId);
    if (existingConnection) {
      console.log(`⚠️  Replacing existing SSE connection for session '${sessionId}'`);
      // Close the old connection
      try {
        existingConnection.end();
      } catch (err) {
        console.log(`Error closing old connection: ${err}`);
      }
      globalSSEConnections.delete(sessionId);
      responseSendLocks.delete(sessionId);
    }
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable proxy buffering for streaming
    });

    globalSSEConnections.set(sessionId, res);
    responseSendLocks.set(sessionId, false);

    console.log(`📡 SSE stream connection established (session: ${sessionId})`);

    // Send endpoint information - MUST be a named SSE event per MCP spec
    res.write(`event: endpoint\n`);
    res.write(`data: ${this.endpointPath}\n\n`);
    console.log(`📤 Sent endpoint event: ${this.endpointPath}`);

    // Keep connection alive with periodic pings
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000); // 30 second keepalive (MCP spec recommends 30-60s)

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      // Only delete if THIS connection is still the active one
      if (globalSSEConnections.get(sessionId) === res) {
        globalSSEConnections.delete(sessionId);
        responseSendLocks.delete(sessionId);
        console.log(`📡 SSE stream connection closed (session: ${sessionId})`);
      } else {
        console.log(`📡 Old SSE stream connection closed (session: ${sessionId}) - keeping active connection`);
      }
    });
  }

  /**
   * Handle message endpoint (POST /message)
   * This receives requests from the client and sends responses via SSE
   */
  async handleMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const request = JSON.parse(body) as JSONRPCRequest;
          const requestMethod = request.method || 'unknown';
          console.log(`📨 Received JSON-RPC: ${requestMethod} (id: ${request.id})`);
          
          // Immediately acknowledge the request
          res.writeHead(202);
          res.end();

          // Wait for SSE connection to be established (with shorter timeout)
          let sseRes = globalSSEConnections.get(this.sessionId);
          let waitAttempts = 0;
          
          while (!sseRes && waitAttempts < 200) { // ~20 seconds (200 * 100ms)
            await new Promise(resolve => setTimeout(resolve, 100));
            sseRes = globalSSEConnections.get(this.sessionId);
            waitAttempts++;
          }
          
          if (!sseRes) {
            console.error(`❌ SSE connection not available after 20s for ${requestMethod} (session: ${this.sessionId})`);
            return;
          }

          console.log(`✅ SSE connection found, processing ${requestMethod} (id: ${request.id}) (session: ${this.sessionId})`);
          
          const response = await this.handleJSONRPC(request);

          // Send response via SSE connection
          console.log(`📤 Sending SSE response for ${requestMethod} (${JSON.stringify(response).length} bytes)`);
          this.sendSSEMessage(sseRes, response);

        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
    } catch (error) {
      console.error('Error in message handler:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleJSONRPC(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    console.log(`📨 JSON-RPC request: ${request.method}`);

    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);

        case 'tools/list':
          return this.handleToolsList(id);

        case 'tools/call':
          return await this.handleToolCall(id, params);

        case 'resources/list':
          return this.handleResourcesList(id);

        case 'resources/read':
          return await this.handleResourceRead(id, params);

        case 'notifications/initialized':
          // Client notification that initialization is complete
          // No response needed for notifications, but we'll acknowledge
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            result: {}
          };

        default:
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (error) {
      console.error(`Error handling ${method}:`, error);
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(id: string | number | null | undefined, params: any): JSONRPCResponse {
    console.log('🔄 Initializing MCP session');
    
    const serverInfo = this.service.getServerInfo();
    const capabilities = this.service.getCapabilities();
    
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo,
        capabilities
      }
    };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(id: string | number | null | undefined): JSONRPCResponse {
    console.log('📋 Listing tools');

    const tools = this.service.listTools();

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools
      }
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(
    id: string | number | null | undefined,
    params: any
  ): Promise<JSONRPCResponse> {
    const { name, arguments: args } = params;

    console.log(`🔧 Calling tool: ${name}`);

    // Initialize service if needed
    if (this.service.initialize) {
      await this.service.initialize();
    }

    try {
      const result = await this.service.executeTool(name, args || {});

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result
      };
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Handle resources/list request
   */
  private handleResourcesList(id: string | number | null | undefined): JSONRPCResponse {
    console.log('📋 Listing resources (SSE)');

    // Check if service supports resources
    if ('listResources' in this.service && typeof (this.service as any).listResources === 'function') {
      const resources = (this.service as any).listResources();
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          resources
        }
      };
    }

    // Return empty array if service doesn't support resources
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        resources: []
      }
    };
  }

  /**
   * Handle resources/read request
   */
  private async handleResourceRead(
    id: string | number | null | undefined,
    params: any
  ): Promise<JSONRPCResponse> {
    const { uri } = params;

    console.log(`📖 Reading resource: ${uri} (SSE)`);

    // Check if service supports resources
    if ('readResource' in this.service && typeof (this.service as any).readResource === 'function') {
      try {
        const resource = await (this.service as any).readResource(uri);
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            contents: [resource]
          }
        };
      } catch (error) {
        console.error(`Error reading resource ${uri}:`, error);
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        };
      }
    }

    // Return error if service doesn't support resources
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32601,
        message: 'Resources not supported by this service'
      }
    };
  }

  /**
   * Send SSE message (for JSON-RPC responses and notifications)
   */
  private sendSSEMessage(res: http.ServerResponse, data: JSONRPCResponse | JSONRPCNotification): void {
    const message = JSON.stringify(data);
    
    // Per MCP spec, JSON-RPC messages use "message" event type
    const sseMessage = `event: message\ndata: ${message}\n\n`;
    
    console.log(`📤 Sending SSE message: ${data.jsonrpc ? (data as any).method || 'response' : 'unknown'} (${message.length} bytes)`);
    console.log(`📝 SSE message content: ${sseMessage.substring(0, 200)}...`);
    
    const written = res.write(sseMessage);
    console.log(`✍️  Write result: ${written}, writable: ${res.writable}`);
    
    // Flush the response to ensure it's sent immediately
    if ('flush' in res && typeof (res as any).flush === 'function') {
      (res as any).flush();
      console.log(`💧 Flushed SSE response`);
    }
  }
}

