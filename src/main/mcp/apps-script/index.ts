/**
 * Apps Script MCP Server
 * 
 * Exposes Apps Script projects as a virtual filesystem via MCP protocol.
 * Clients (like Cursor, Claude) can list projects, read files, and edit code
 * as if they were interacting with a local file system.
 */

import * as http from 'http';
import { app } from 'electron';
import path from 'path';
import { AppsScriptMCPService } from './apps-script-mcp-service';
import { HTTPStreamHandler } from '../server-creator/http-stream-handler';
import { SSEMCPHandler } from '../server-creator/sse-handler';

// Database path helper
function getDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'conversations.db');
  }
  // Fallback for standalone mode (dev/testing)
  return process.env.DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/conversations.db';
}

export class AppsScriptMCPServer {
  private mcpService: AppsScriptMCPService;
  private httpStreamHandler: HTTPStreamHandler;
  private sseHandler: SSEMCPHandler;
  private server: http.Server | null = null;

  constructor(private port: number = 3002) { // Port 3002 to avoid conflict with FS (3000) or others
    const dbPath = getDatabasePath();
    this.mcpService = new AppsScriptMCPService(dbPath);
    this.httpStreamHandler = new HTTPStreamHandler(this.mcpService);
    this.sseHandler = new SSEMCPHandler(this.mcpService);
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

        this.server.listen(this.port, () => {
          console.log(`✅ Apps Script MCP Server running on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('❌ Apps Script MCP Server error:', error);
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
          console.error('❌ Error stopping Apps Script MCP Server:', error);
          reject(error);
        } else {
          console.log('✅ Apps Script MCP Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    console.log(`📨 Apps Script MCP: ${method} ${url}`);

    // CORS
    if (method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    // 1. Handle HTTP Streaming (Standard MCP)
    if (url === '/mcp' && method === 'POST') {
      await this.httpStreamHandler.handleStream(req, res);
      return;
    }

    // 2. Handle SSE (Legacy/Browser)
    if (url === '/sse' && method === 'GET') {
      await this.sseHandler.handleSSEStream(req, res);
      return;
    }
    if (url === '/message' && method === 'POST') {
      await this.sseHandler.handleMessage(req, res);
      return;
    }

    // 3. Server Info
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        name: 'Apps Script MCP Server',
        description: 'Virtual Filesystem for Apps Script Projects',
        endpoints: {
          mcp: 'POST /mcp',
          sse: 'GET /sse'
        }
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }
}

export const createAppsScriptMCPServer = (port?: number) => {
  return new AppsScriptMCPServer(port);
};

