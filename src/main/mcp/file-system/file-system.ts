/**
 * File System MCP Server
 * Based on Claude Desktop's file system tools via Model Context Protocol (MCP)
 * 
 * This server provides file system operations through MCP protocol:
 * - read_file, write_file, edit_file
 * - list_directory, create_directory
 * - move_file, copy_file, delete_file
 * - search_files, get_file_info, get_directory_tree
 * - list_allowed_directories
 */

import * as http from 'http';
import { FileSystemService } from './file-system-service';
import { FileSystemHTTPStreamHandler } from './http-stream-handler';
import { FileSystemSSEHandler } from './sse-handler';

export interface FileSystemMCPServerConfig {
  allowedDirectories?: string[];
  port?: number;
  host?: string;
}

/**
 * File System MCP Server
 * Provides a complete MCP server for file system operations
 */
export class FileSystemMCPServer {
  private service: FileSystemService;
  private httpStreamHandler: FileSystemHTTPStreamHandler;
  private sseHandler: FileSystemSSEHandler;
  private server: http.Server | null = null;
  private config: FileSystemMCPServerConfig;

  constructor(config: FileSystemMCPServerConfig = {}) {
    this.config = {
      allowedDirectories: config.allowedDirectories || [],
      port: config.port || 3000,
      host: config.host || 'localhost'
    };

    this.service = new FileSystemService(this.config.allowedDirectories || []);
    this.httpStreamHandler = new FileSystemHTTPStreamHandler(this.config.allowedDirectories || []);
    this.sseHandler = new FileSystemSSEHandler(this.config.allowedDirectories || []);
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(async (req, res) => {
          await this.handleRequest(req, res);
        });

        this.server.listen(this.config.port, this.config.host, () => {
          console.log(`✅ File System MCP Server running on http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('❌ File System MCP Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          console.error('❌ Error stopping File System MCP Server:', error);
          reject(error);
        } else {
          console.log('✅ File System MCP Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    console.log(`📨 ${method} ${url}`);

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    // HTTP Streaming endpoint (new transport)
    if (url === '/mcp' && method === 'POST') {
      await this.httpStreamHandler.handleStream(req, res);
      return;
    }

    // SSE endpoint (legacy transport)
    if (url === '/sse' && method === 'GET') {
      await this.sseHandler.handleSSE(req, res);
      return;
    }

    // Message endpoint for SSE transport
    if (url === '/message' && method === 'POST') {
      await this.sseHandler.handleMessage(req, res);
      return;
    }

    // Health check
    if (url === '/health' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        status: 'healthy',
        server: 'filesystem-mcp-server',
        version: '1.0.0',
        allowedDirectories: this.service.listAllowedDirectories()
      }));
      return;
    }

    // Server info
    if (url === '/' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        name: 'File System MCP Server',
        version: '1.0.0',
        protocol: 'MCP',
        endpoints: {
          mcp: 'POST /mcp - HTTP Streamable endpoint for MCP protocol (bidirectional streaming)',
          sse: 'GET /sse - SSE endpoint for MCP protocol (legacy)',
          message: 'POST /message - Message endpoint for SSE transport',
          health: 'GET /health - Health check'
        },
        allowedDirectories: this.service.listAllowedDirectories()
      }));
      return;
    }

    // 404
    res.writeHead(404, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: 'Not found',
      availableEndpoints: [
        'POST /mcp - HTTP Streamable endpoint',
        'GET /sse - SSE endpoint',
        'POST /message - Message endpoint',
        'GET /health - Health check',
        'GET / - Server info'
      ]
    }));
  }

  /**
   * Get the file system service
   */
  getService(): FileSystemService {
    return this.service;
  }

  /**
   * Get server configuration
   */
  getConfig(): FileSystemMCPServerConfig {
    return this.config;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
}

// Export utility function to create server
export const createFileSystemMCPServer = (config?: FileSystemMCPServerConfig): FileSystemMCPServer => {
  return new FileSystemMCPServer(config);
};

