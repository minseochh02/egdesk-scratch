/**
 * SSE Handler for MCP Protocol
 * 
 * Implements Server-Sent Events transport for Model Context Protocol.
 * This allows Cursor and other MCP clients to connect via HTTP/SSE.
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

// Shared SSE connections across all handler instances
const globalSSEConnections = new Map<string, http.ServerResponse>();
// Track if we're already sending a response to avoid duplicate sends
const responseSendLocks = new Map<string, boolean>();

export class SSEMCPHandler {
  private connection: GmailConnection | null = null;
  private fetcher: GmailMCPFetcher | null = null;

  constructor(connection: GmailConnection | null) {
    this.connection = connection;
    if (connection) {
      this.fetcher = new GmailMCPFetcher(connection);
    }
  }

  /**
   * Handle SSE connection (GET /sse)
   * This keeps the connection open for server-to-client messages
   */
  async handleSSEStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Generate session ID from request or use a default
    const sessionId = 'default';
    
    // Check if we already have an active SSE connection
    const existingConnection = globalSSEConnections.get(sessionId);
    if (existingConnection) {
      console.log(`⚠️  SSE connection already exists! Rejecting duplicate`);
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSE connection already established' }));
      return;
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
    res.write(`data: /gmail/sse\n\n`);
    console.log(`📤 Sent endpoint event: /gmail/sse`);

    // Keep connection alive with periodic pings
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000); // 30 second keepalive (MCP spec recommends 30-60s)

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      globalSSEConnections.delete(sessionId);
      responseSendLocks.delete(sessionId);
      console.log(`📡 SSE stream connection closed (session: ${sessionId})`);
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
          let sseRes = globalSSEConnections.get('default');
          let waitAttempts = 0;
          
          while (!sseRes && waitAttempts < 200) { // ~20 seconds (200 * 100ms)
            await new Promise(resolve => setTimeout(resolve, 100));
            sseRes = globalSSEConnections.get('default');
            waitAttempts++;
          }
          
          if (!sseRes) {
            console.error(`❌ SSE connection not available after 20s for ${requestMethod}`);
            return;
          }

          console.log(`✅ SSE connection found, processing ${requestMethod} (id: ${request.id})`);
          
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
   * Handle tools/list request
   */
  private handleToolsList(id: string | number | null | undefined): JSONRPCResponse {
    console.log('📋 Listing tools');

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

    console.log(`🔧 Calling tool: ${name}`);

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

  /**
   * Send SSE message (for JSON-RPC responses and notifications)
   */
  private sendSSEMessage(res: http.ServerResponse, data: JSONRPCResponse | JSONRPCNotification): void {
    const message = JSON.stringify(data);
    
    // Per MCP spec, JSON-RPC messages use "message" event type
    const sseMessage = `event: message\ndata: ${message}\n\n`;
    
    console.log(`📤 Sending SSE message: ${data.jsonrpc ? (data as any).method || 'response' : 'unknown'} (${message.length} bytes)`);
    
    res.write(sseMessage);
    
    // Flush the response to ensure it's sent immediately
    if ('flush' in res && typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  }
}

