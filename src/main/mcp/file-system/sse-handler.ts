/**
 * SSE (Server-Sent Events) Handler for File System MCP Protocol
 * 
 * Implements Server-Sent Events transport for Model Context Protocol.
 * This is the legacy SSE transport method.
 */

import * as http from 'http';
import { FileSystemService } from './file-system-service';

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
 * SSE Handler for File System MCP
 * 
 * This handler implements the legacy MCP SSE (Server-Sent Events) transport.
 * It provides server-to-client streaming via SSE.
 */
export class FileSystemSSEHandler {
  private fileSystemService: FileSystemService;

  constructor(allowedDirectories: string[] = []) {
    this.fileSystemService = new FileSystemService(allowedDirectories);
  }

  /**
   * Handle SSE connection
   */
  async handleSSE(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    console.log('📡 File System MCP - SSE connection established');

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    this.sendSSEMessage(res, 'endpoint', { endpoint: '/message' });

    // Keep connection alive with periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000); // Every 30 seconds

    // Handle connection close
    req.on('close', () => {
      console.log('📡 File System MCP - SSE connection closed');
      clearInterval(heartbeatInterval);
    });

    req.on('error', (error) => {
      console.error('File System MCP - SSE connection error:', error);
      clearInterval(heartbeatInterval);
      res.end();
    });
  }

  /**
   * Handle message endpoint (POST /message)
   * This endpoint receives client messages when using SSE transport
   */
  async handleMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    console.log('📨 File System MCP - Received message via POST');

    try {
      // Read request body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const request = JSON.parse(body) as JSONRPCRequest;
          console.log(`📨 Received JSON-RPC (SSE): ${request.method} (id: ${request.id})`);

          // Process the request
          const response = await this.handleJSONRPC(request);

          // Send response
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(response));

          console.log(`📤 Sent response for ${request.method} (id: ${request.id})`);
        } catch (error) {
          console.error('Error processing message:', error);
          
          const errorResponse: JSONRPCResponse = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error instanceof Error ? error.message : 'Unknown error'
            }
          };

          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify(errorResponse));
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  }

  /**
   * Send SSE message
   */
  private sendSSEMessage(res: http.ServerResponse, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
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
    console.log('🔄 Initializing File System MCP session (SSE)');
    
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'filesystem-mcp-server',
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
    console.log('🏓 PING received (File System MCP SSE)');
    
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
    console.log('📋 Listing File System tools (SSE)');

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools: [
          {
            name: 'fs_read_file',
            description: 'Read the complete contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the file to read'
                },
                encoding: {
                  type: 'string',
                  description: 'The encoding to use (default: utf8)',
                  default: 'utf8'
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_write_file',
            description: 'Write or overwrite a file with new content',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the file to write'
                },
                content: {
                  type: 'string',
                  description: 'The content to write to the file'
                },
                encoding: {
                  type: 'string',
                  description: 'The encoding to use (default: utf8)',
                  default: 'utf8'
                }
              },
              required: ['path', 'content']
            }
          },
          {
            name: 'fs_edit_file',
            description: 'Make targeted edits to specific parts of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the file to edit'
                },
                edits: {
                  type: 'array',
                  description: 'Array of edit operations to perform',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['search_replace', 'insert', 'delete'],
                        description: 'Type of edit operation'
                      },
                      search: {
                        type: 'string',
                        description: 'String to search for (search_replace only)'
                      },
                      replace: {
                        type: 'string',
                        description: 'String to replace with (search_replace only)'
                      },
                      position: {
                        type: 'number',
                        description: 'Position to insert at (insert only)'
                      },
                      content: {
                        type: 'string',
                        description: 'Content to insert (insert only)'
                      },
                      startLine: {
                        type: 'number',
                        description: 'Start line to delete (delete only)'
                      },
                      endLine: {
                        type: 'number',
                        description: 'End line to delete (delete only)'
                      }
                    },
                    required: ['type']
                  }
                }
              },
              required: ['path', 'edits']
            }
          },
          {
            name: 'fs_list_directory',
            description: 'List files and subdirectories in a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the directory to list'
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_create_directory',
            description: 'Create new directories (can create nested directories)',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the directory to create'
                },
                recursive: {
                  type: 'boolean',
                  description: 'Create parent directories if they don\'t exist (default: true)',
                  default: true
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_move_file',
            description: 'Move or rename files and directories',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'The source path'
                },
                destination: {
                  type: 'string',
                  description: 'The destination path'
                }
              },
              required: ['source', 'destination']
            }
          },
          {
            name: 'fs_copy_file',
            description: 'Copy a file to a new location',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'The source file path'
                },
                destination: {
                  type: 'string',
                  description: 'The destination file path'
                }
              },
              required: ['source', 'destination']
            }
          },
          {
            name: 'fs_delete_file',
            description: 'Delete a file or directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the file or directory to delete'
                },
                recursive: {
                  type: 'boolean',
                  description: 'Recursively delete directories (default: false)',
                  default: false
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_search_files',
            description: 'Search for files matching patterns',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The base directory to search in'
                },
                pattern: {
                  type: 'string',
                  description: 'Glob pattern or search string'
                },
                useRegex: {
                  type: 'boolean',
                  description: 'Use regex pattern matching (default: false)',
                  default: false
                },
                searchContent: {
                  type: 'boolean',
                  description: 'Search file contents instead of just names (default: false)',
                  default: false
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 1000)',
                  default: 1000
                }
              },
              required: ['path', 'pattern']
            }
          },
          {
            name: 'fs_get_file_info',
            description: 'Get metadata about a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the file'
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_get_directory_tree',
            description: 'Get recursive directory tree structure',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The path to the directory'
                },
                maxDepth: {
                  type: 'number',
                  description: 'Maximum depth to traverse (default: 3)',
                  default: 3
                }
              },
              required: ['path']
            }
          },
          {
            name: 'fs_list_allowed_directories',
            description: 'Shows which directories the MCP server has access to',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
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

    console.log(`🔧 Calling File System tool: ${name} (SSE)`);

    try {
      let result;

      switch (name) {
        case 'fs_read_file': {
          const { path, encoding = 'utf8' } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          const content = await this.fileSystemService.readFile(path, encoding);
          result = {
            path,
            content,
            size: Buffer.byteLength(content, encoding)
          };
          break;
        }

        case 'fs_write_file': {
          const { path, content, encoding = 'utf8' } = args || {};
          if (!path || content === undefined) {
            throw new Error('Missing required parameters: path, content');
          }
          await this.fileSystemService.writeFile(path, content, encoding);
          result = {
            path,
            success: true,
            message: `File written successfully: ${path}`
          };
          break;
        }

        case 'fs_edit_file': {
          const { path, edits } = args || {};
          if (!path || !edits) {
            throw new Error('Missing required parameters: path, edits');
          }
          await this.fileSystemService.editFile(path, edits);
          result = {
            path,
            success: true,
            message: `File edited successfully: ${path}`,
            editsApplied: edits.length
          };
          break;
        }

        case 'fs_list_directory': {
          const { path } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          const entries = await this.fileSystemService.listDirectory(path);
          result = {
            path,
            totalEntries: entries.length,
            entries
          };
          break;
        }

        case 'fs_create_directory': {
          const { path, recursive = true } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          await this.fileSystemService.createDirectory(path, recursive);
          result = {
            path,
            success: true,
            message: `Directory created successfully: ${path}`
          };
          break;
        }

        case 'fs_move_file': {
          const { source, destination } = args || {};
          if (!source || !destination) {
            throw new Error('Missing required parameters: source, destination');
          }
          await this.fileSystemService.moveFile(source, destination);
          result = {
            source,
            destination,
            success: true,
            message: `Moved successfully from ${source} to ${destination}`
          };
          break;
        }

        case 'fs_copy_file': {
          const { source, destination } = args || {};
          if (!source || !destination) {
            throw new Error('Missing required parameters: source, destination');
          }
          await this.fileSystemService.copyFile(source, destination);
          result = {
            source,
            destination,
            success: true,
            message: `Copied successfully from ${source} to ${destination}`
          };
          break;
        }

        case 'fs_delete_file': {
          const { path, recursive = false } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          await this.fileSystemService.deleteFile(path, recursive);
          result = {
            path,
            success: true,
            message: `Deleted successfully: ${path}`
          };
          break;
        }

        case 'fs_search_files': {
          const { path, pattern, useRegex = false, searchContent = false, maxResults = 1000 } = args || {};
          if (!path || !pattern) {
            throw new Error('Missing required parameters: path, pattern');
          }
          const searchResults = await this.fileSystemService.searchFiles(path, pattern, {
            useRegex,
            searchContent,
            maxResults
          });
          result = {
            path,
            pattern,
            totalResults: searchResults.length,
            results: searchResults
          };
          break;
        }

        case 'fs_get_file_info': {
          const { path } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          const fileInfo = await this.fileSystemService.getFileInfo(path);
          result = fileInfo;
          break;
        }

        case 'fs_get_directory_tree': {
          const { path, maxDepth = 3 } = args || {};
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          const tree = await this.fileSystemService.getDirectoryTree(path, maxDepth);
          result = {
            path,
            tree
          };
          break;
        }

        case 'fs_list_allowed_directories': {
          const allowedDirs = this.fileSystemService.listAllowedDirectories();
          result = {
            totalDirectories: allowedDirs.length,
            allowedDirectories: allowedDirs
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

