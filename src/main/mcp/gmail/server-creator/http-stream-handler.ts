/**
 * HTTP Streaming Handler for MCP Protocol
 * 
 * Implements bidirectional HTTP streaming transport for Model Context Protocol.
 * This is the new streamable HTTP transport that uses a single POST endpoint
 * for both client-to-server and server-to-client messages.
 */

import * as http from 'http';
import { GmailMCPFetcher } from '../server-script/gmail-service';
import { GmailConnection } from '../../../types/gmail-types';

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
 */
export class HTTPStreamHandler {
  private connection: GmailConnection | null = null;
  private fetcher: GmailMCPFetcher | null = null;

  constructor(connection: GmailConnection | null) {
    this.connection = connection;
    if (connection) {
      this.fetcher = new GmailMCPFetcher(connection);
    }
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
      buffer += chunk.toString();

      // Try to parse complete JSON-RPC messages from the buffer
      const messages = this.extractJSONRPCMessages(buffer);
      
      for (const { message, remaining } of messages) {
        buffer = remaining;
        
        try {
          const request = JSON.parse(message) as JSONRPCRequest;
          console.log(`📨 Received JSON-RPC: ${request.method} (id: ${request.id})`);
          
          // Process the request and send response
          const response = await this.handleJSONRPC(request);
          
          // Send response immediately through the stream
          const responseData = JSON.stringify(response) + '\n';
          res.write(responseData);
          
          console.log(`📤 Sent response for ${request.method} (id: ${request.id})`);
        } catch (error) {
          console.error('Error processing message:', error);
          
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
    });

    // Handle connection close
    req.on('end', () => {
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
   * Extract complete JSON-RPC messages from buffer
   * 
   * Messages are separated by newlines. This handles partial messages
   * that may arrive across multiple chunks.
   */
  private extractJSONRPCMessages(buffer: string): Array<{ message: string; remaining: string }> {
    const results: Array<{ message: string; remaining: string }> = [];
    const lines = buffer.split('\n');
    
    // Process all complete lines (all but the last, which may be incomplete)
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line) {
        const remaining = lines.slice(i + 1).join('\n');
        results.push({ message: line, remaining });
      }
    }
    
    // If no complete messages found, return empty array
    if (results.length === 0) {
      return [];
    }
    
    return results;
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
    
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'gmail-mcp-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: {},
          resources: {}
        }
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

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools: [
          {
            name: 'gmail_list_users',
            description: 'List all domain users from Google Workspace',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'gmail_get_user_messages',
            description: 'Get Gmail messages for a specific user',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'The email address of the user'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of messages to return (default: 50)',
                  default: 50
                }
              },
              required: ['email']
            }
          },
          {
            name: 'gmail_get_user_stats',
            description: 'Get Gmail statistics for a specific user',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'The email address of the user'
                }
              },
              required: ['email']
            }
          },
          {
            name: 'gmail_search_messages',
            description: 'Search Gmail messages by query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (e.g., "from:example@gmail.com")'
                },
                email: {
                  type: 'string',
                  description: 'Optional: filter by specific user email'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of messages to return (default: 50)',
                  default: 50
                }
              },
              required: ['query']
            }
          }
        ]
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

    if (!this.fetcher || !this.connection) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32603,
          message: 'No Gmail connection available'
        }
      };
    }

    // Initialize fetcher if needed
    await this.fetcher.waitForInitialization();

    try {
      let result;

      switch (name) {
        case 'gmail_list_users': {
          const users = await this.fetcher.fetchAllDomainUsers();
          result = {
            totalUsers: users.length,
            users
          };
          break;
        }

        case 'gmail_get_user_messages': {
          const { email, maxResults = 50 } = args || {};
          if (!email) {
            throw new Error('Missing required parameter: email');
          }
          const messages = await this.fetcher.fetchUserMessages(email, { maxResults });
          result = {
            userEmail: email,
            totalMessages: messages.length,
            messages
          };
          break;
        }

        case 'gmail_get_user_stats': {
          const { email } = args || {};
          if (!email) {
            throw new Error('Missing required parameter: email');
          }
          const stats = await this.fetcher.fetchUserStats(email);
          result = {
            userEmail: email,
            stats
          };
          break;
        }

        case 'gmail_search_messages': {
          const { query, email, maxResults = 50 } = args || {};
          if (!query) {
            throw new Error('Missing required parameter: query');
          }
          const messages = await this.fetcher.fetchUserMessages(email || '', { 
            query,
            maxResults 
          });
          result = {
            query,
            userEmail: email,
            totalMessages: messages.length,
            messages
          };
          break;
        }

        default:
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            }
          };
      }

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
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
}

