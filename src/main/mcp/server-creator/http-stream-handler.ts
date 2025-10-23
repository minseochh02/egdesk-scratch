/**
 * HTTP Streaming Handler for MCP Protocol
 * 
 * Implements bidirectional HTTP streaming transport for Model Context Protocol.
 * This is the new streamable HTTP transport that uses a single POST endpoint
 * for both client-to-server and server-to-client messages.
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

/**
 * HTTP Streaming Handler
 * 
 * This handler implements the newest MCP HTTP streamable transport.
 * It uses a single POST /mcp endpoint for bidirectional streaming.
 * 
 * This is a generic handler that works with any IMCPService implementation.
 */
export class HTTPStreamHandler {
  private service: IMCPService;

  constructor(service: IMCPService) {
    this.service = service;
  }

  /**
   * Handle bidirectional HTTP streaming (POST /mcp)
   * 
   * This endpoint receives a stream of JSON-RPC requests and sends back
   * a stream of JSON-RPC responses in the same HTTP connection.
   */
  async handleStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    console.log('📡 HTTP Streaming connection established');

    // Set streaming headers
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable proxy buffering for streaming
    });

    // Buffer to accumulate partial JSON
    let buffer = '';

    // Handle incoming data stream
    req.on('data', async (chunk: Buffer) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;
      
      console.log(`📥 Received chunk (${chunkStr.length} bytes):`, chunkStr.substring(0, 200));

      // Try to parse complete JSON-RPC messages from the buffer
      const lines = buffer.split('\n');
      
      // Process all complete lines (all but the last, which may be incomplete)
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const request = JSON.parse(line) as JSONRPCRequest;
            console.log(`📨 Received JSON-RPC: ${request.method} (id: ${request.id})`);
            
            // Process the request and send response
            const response = await this.handleJSONRPC(request);
            
            // Send response immediately through the stream
            const responseData = JSON.stringify(response) + '\n';
            res.write(responseData);
            
            console.log(`📤 Sent response for ${request.method} (id: ${request.id})`);
          } catch (error) {
            console.error('Error processing message:', error, 'Line:', line);
            
            // Send error response
            const errorResponse: JSONRPCResponse = {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32700,
                message: 'Parse error',
                data: error instanceof Error ? error.message : 'Unknown error'
              }
            };
            
            res.write(JSON.stringify(errorResponse) + '\n');
          }
        }
      }
      
      // Keep the last incomplete line in the buffer
      buffer = lines[lines.length - 1];
    });

    // Handle connection close
    req.on('end', async () => {
      console.log('📡 HTTP Streaming connection ending...');
      
      // Process any remaining data in the buffer
      if (buffer.trim()) {
        console.log(`📥 Processing remaining buffer (${buffer.length} bytes):`, buffer.substring(0, 200));
        try {
          const request = JSON.parse(buffer) as JSONRPCRequest;
          console.log(`📨 Received JSON-RPC (on end): ${request.method} (id: ${request.id})`);
          
          // Process the request and send response
          const response = await this.handleJSONRPC(request);
          
          // Send response immediately through the stream
          const responseData = JSON.stringify(response) + '\n';
          res.write(responseData);
          
          console.log(`📤 Sent response for ${request.method} (id: ${request.id})`);
        } catch (error) {
          console.error('Error processing remaining buffer:', error, 'Buffer:', buffer);
          
          // Send error response
          const errorResponse: JSONRPCResponse = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          };
          
          res.write(JSON.stringify(errorResponse) + '\n');
        }
      }
      
      console.log('📡 HTTP Streaming connection ended');
      res.end();
    });

    req.on('error', (error) => {
      console.error('HTTP Streaming connection error:', error);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      console.log('📡 HTTP Streaming connection closed');
    });
  }

  /**
   * Handle JSON-RPC request
   */
  private async handleJSONRPC(request: JSONRPCRequest): Promise<JSONRPCResponse> {
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

        case 'ping':
          return this.handlePing(id);

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
    console.log('🔄 Initializing MCP session (HTTP Stream)');
    
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
   * Handle ping request
   */
  private handlePing(id: string | number | null | undefined): JSONRPCResponse {
    console.log('🏓 PING received');
    
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        message: 'pong'
      }
    };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(id: string | number | null | undefined): JSONRPCResponse {
    console.log('📋 Listing tools (HTTP Stream)');

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

    console.log(`🔧 Calling tool: ${name} (HTTP Stream)`);

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
    console.log('📋 Listing resources (HTTP Stream)');

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

    console.log(`📖 Reading resource: ${uri} (HTTP Stream)`);

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
}

