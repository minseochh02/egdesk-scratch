/**
 * Local Server Manager
 * 
 * Handles local server setup and management for MCP server communication.
 * This module manages:
 * - Local server creation and configuration (HTTP/HTTPS)
 * - SSL certificate management
 * - Port allocation and management
 * - Security configuration
 */

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { app, ipcMain, powerSaveBlocker } from 'electron';
import { getStore } from '../../storage';
import { GmailMCPFetcher } from '../gmail/gmail-service';
import { GmailConnection } from '../../types/gmail-types';
import { GmailMCPService } from '../gmail/gmail-mcp-service';
import { FileSystemMCPService } from '../file-system/file-system-mcp-service';
import { FileConversionMCPService } from '../file-conversion/file-conversion-mcp-service';
import { SSEMCPHandler } from './sse-handler';
import { HTTPStreamHandler } from './http-stream-handler';

export interface HTTPServerOptions {
  port: number;
  useHTTPS?: boolean;  // Optional: false = HTTP, true = HTTPS (for tunnel mode)
  keyPath?: string;
  certPath?: string;
}

export interface HTTPServerStatus {
  isRunning: boolean;
  port: number | null;
  error: string | null;
  powerSaveBlocker?: {
    isActive: boolean;
    blockerId: number | null;
  };
}

export interface SSLCertificate {
  id: string;
  domain: string;
  certificate: string;
  privateKey: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
  isExpired: boolean;
}

export interface CertificateRequest {
  domain: string;
  email?: string;
}

export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  description: string;
}

export class LocalServerManager {
  private static instance: LocalServerManager | null = null;
  private server: http.Server | https.Server | null = null;
  private isRunning = false;
  private currentPort: number | null = null;
  private useHTTPS = false;
  private store = getStore();
  private gmailMCPService: GmailMCPService | null = null;
  private filesystemMCPService: FileSystemMCPService | null = null;
  private fileConversionMCPService: FileConversionMCPService | null = null;
  private gmailSSEHandler: SSEMCPHandler | null = null;
  private filesystemSSEHandler: SSEMCPHandler | null = null;
  private fileConversionSSEHandler: SSEMCPHandler | null = null;
  private httpStreamHandler: HTTPStreamHandler | null = null;
  private filesystemHTTPStreamHandler: HTTPStreamHandler | null = null;
  // Power management
  private powerSaveBlockerId: number | null = null;

  private constructor() {}

  public static getInstance(): LocalServerManager {
    if (!LocalServerManager.instance) {
      LocalServerManager.instance = new LocalServerManager();
    }
    return LocalServerManager.instance;
  }

  /**
   * Register IPC handlers for the renderer process
   */
  public registerIPCHandlers(): void {
    // Start HTTPS server
    ipcMain.handle('https-server-start', async (event, options: HTTPServerOptions) => {
      return await this.startServer(options);
    });

    // Stop HTTPS server
    ipcMain.handle('https-server-stop', async () => {
      return await this.stopServer();
    });

    // Get server status
    ipcMain.handle('https-server-status', () => {
      return this.getStatus();
    });

    // Restart server
    ipcMain.handle('https-server-restart', async (event, options: HTTPServerOptions) => {
      await this.stopServer();
      return await this.startServer(options);
    });

    // Get network information
    ipcMain.handle('https-server-get-network-info', () => {
      return this.getNetworkInfo();
    });

    // Get power management status
    ipcMain.handle('https-server-get-power-status', () => {
      return this.getPowerSaveBlockerStatus();
    });

    // MCP Server management handlers
    ipcMain.handle('mcp-server-enable', async (event, serverName: string) => {
      return await this.enableMCPServer(serverName);
    });

    ipcMain.handle('mcp-server-disable', async (event, serverName: string) => {
      return await this.disableMCPServer(serverName);
    });

    ipcMain.handle('mcp-server-list', async () => {
      return await this.getMCPServers();
    });

    ipcMain.handle('mcp-server-status', async (event, serverName: string) => {
      return await this.getMCPServerStatus(serverName);
    });

    console.log('✅ Local Server Manager IPC handlers registered');
  }

  /**
   * Start the HTTP/HTTPS server
   */
  private async startServer(options: HTTPServerOptions): Promise<{ success: boolean; error?: string; port?: number; protocol?: string }> {
    try {
      // Check if server is already running
      if (this.isRunning) {
        return { success: false, error: 'Server is already running' };
      }

      this.useHTTPS = options.useHTTPS || false;

      // Create request handler
      const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        // Set CORS headers for all requests
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        try {
          // Route to appropriate handler
          await this.handleRequest(req, res);
        } catch (error) {
          console.error('Request handler error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ 
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      };

      // Create HTTP or HTTPS server based on options
      if (this.useHTTPS && options.keyPath && options.certPath) {
        // HTTPS mode (for tunnel use later)
        let sslOptions: any;
        if (options.keyPath.startsWith('-----BEGIN') || options.certPath.startsWith('-----BEGIN')) {
          sslOptions = { key: options.keyPath, cert: options.certPath };
        } else {
          if (!fs.existsSync(options.keyPath) || !fs.existsSync(options.certPath)) {
            return { success: false, error: 'SSL certificate files not found' };
          }
          sslOptions = {
            key: fs.readFileSync(options.keyPath),
            cert: fs.readFileSync(options.certPath),
          };
        }
        this.server = https.createServer(sslOptions, requestHandler);
        console.log('🔒 Creating HTTPS server...');
      } else {
        // HTTP mode (default for local network - no SSL needed!)
        this.server = http.createServer(requestHandler);
        console.log('🌐 Creating HTTP server (local network mode - no SSL required)...');
      }

      // Start listening on all network interfaces (0.0.0.0) to allow network access
      const protocol = this.useHTTPS ? 'https' : 'http';
      this.server.listen(options.port, '0.0.0.0', () => {
        this.isRunning = true;
        this.currentPort = options.port;
        console.log(`✅ ${protocol.toUpperCase()} Server running on port ${options.port} (accessible from network)`);
        console.log(`🌐 Access from any device: ${protocol}://[YOUR_IP]:${options.port}`);
        
        // Prevent system sleep while server is running
        this.preventSleep();
        
        // Trigger firewall prompt by making a test connection
        this.triggerFirewallPrompt(options.port, protocol);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        console.error('Server error:', error);
        this.isRunning = false;
        this.currentPort = null;
        
        // Allow system sleep if server fails
        this.allowSleep();
      });

      return { success: true, port: options.port, protocol };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start HTTPS server:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Stop the HTTPS server
   */
  private async stopServer(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.server) {
        this.server.close(() => {
          console.log('🔒 Server stopped');
        });
        this.server = null;
        this.isRunning = false;
        this.currentPort = null;
        
        // Allow system sleep when server is stopped
        this.allowSleep();
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to stop server:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get current server status
   */
  private getStatus(): HTTPServerStatus {
    return {
      isRunning: this.isRunning,
      port: this.currentPort,
      error: null,
      powerSaveBlocker: this.getPowerSaveBlockerStatus()
    };
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    console.log(`📨 Incoming request: ${req.method} ${url}`);

    // Root endpoint - List all available MCP servers (GET only)
    if ((url === '/' || url === '/mcp') && req.method === 'GET') {
      this.handleMCPServerList(res);
      return;
    }

    // HTTP Streamable endpoint for MCP protocol (POST for bidirectional streaming)
    if ((url === '/mcp' || url === '/gmail/mcp') && req.method === 'POST') {
      await this.handleHTTPStream(req, res);
      return;
    }

    // SSE endpoint for MCP protocol (GET for stream, POST for messages)
    if (url === '/gmail/sse' || url === '/sse') {
      if (req.method === 'GET') {
        await this.handleGmailSSEStream(req, res);
        return;
      } else if (req.method === 'POST') {
        await this.handleGmailMessage(req, res);
        return;
      }
    }

    // Alternative message endpoint for MCP protocol (POST)
    if ((url === '/gmail/message' || url === '/message') && req.method === 'POST') {
      await this.handleGmailMessage(req, res);
      return;
    }

    // FileSystem HTTP Streamable endpoint for MCP protocol (POST for bidirectional streaming)
    if (url === '/filesystem' && req.method === 'POST') {
      await this.handleFilesystemHTTPStream(req, res);
      return;
    }

    // FileSystem SSE endpoints for MCP protocol
    if (url === '/filesystem/sse') {
      if (req.method === 'GET') {
        await this.handleFilesystemSSEStream(req, res);
        return;
      } else if (req.method === 'POST') {
        await this.handleFilesystemMessage(req, res);
        return;
      }
    }

    if (url === '/filesystem/message' && req.method === 'POST') {
      await this.handleFilesystemMessage(req, res);
      return;
    }

    // Gmail MCP Server endpoints
    if (url.startsWith('/gmail')) {
      await this.handleGmailMCP(url, req, res);
      return;
    }

    // FileSystem MCP Server endpoints (REST API)
    if (url.startsWith('/filesystem')) {
      await this.handleFilesystemMCP(url, req, res);
      return;
    }

    // File Conversion MCP Server endpoints (REST API)
    if (url.startsWith('/file-conversion')) {
      await this.handleFileConversionEndpoint(req, res, url);
      return;
    }

    // Test endpoint (for development)
    if (url === '/test-gmail' && req.method === 'GET') {
      await this.handleTestGmail(req, res);
      return;
    }

    // Unknown endpoint
    res.writeHead(404);
    res.end(JSON.stringify({ 
      success: false,
      error: 'Endpoint not found',
      availableEndpoints: [
        '/ - List all MCP servers',
        'POST /mcp - HTTP Streamable endpoint for MCP protocol (bidirectional streaming)',
        'GET /gmail/sse - Gmail SSE endpoint for MCP protocol',
        'POST /gmail/message - Gmail message endpoint for SSE',
        '/gmail/tools - List Gmail tools',
        '/gmail/tools/call - Call a Gmail tool',
        'POST /filesystem - FileSystem HTTP Streamable endpoint for MCP protocol (bidirectional streaming)',
        'GET /filesystem/sse - FileSystem SSE endpoint for MCP protocol',
        'POST /filesystem/message - FileSystem message endpoint for SSE',
        '/filesystem/tools - List File System tools',
        '/filesystem/tools/call - Call a File System tool',
        '/file-conversion/tools - List File Conversion tools',
        '/file-conversion/tools/call - Call a File Conversion tool',
        '/test-gmail - Test endpoint (dev only)'
      ]
    }));
  }

  /**
   * Handle MCP server list - shows only enabled MCP servers
   */
  private handleMCPServerList(res: http.ServerResponse): void {
    const enabledServers = this.getEnabledMCPServers();
    
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      message: 'MCP Multi-Server Gateway',
      version: '1.0.0',
      servers: enabledServers.map(server => ({
        name: server.name,
        description: server.description,
        endpoints: {
          tools: `/${server.name}/tools`,
          call: `/${server.name}/tools/call`
        },
        status: 'active'
      })),
      totalServers: enabledServers.length,
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  /**
   * Get or create Gmail MCP Service instance
   */
  private async getGmailMCPService(): Promise<GmailMCPService> {
    if (!this.gmailMCPService) {
      const connection = await this.getGmailConnection();
      this.gmailMCPService = new GmailMCPService(connection);
    }
    return this.gmailMCPService;
  }

  /**
   * Get or create FileSystem MCP Service instance
   */
  private getFilesystemMCPService(): FileSystemMCPService {
    if (!this.filesystemMCPService) {
      // Initialize with default security config (can be customized)
      this.filesystemMCPService = new FileSystemMCPService({});
    }
    return this.filesystemMCPService;
  }

  /**
   * Get or create File Conversion MCP Service instance
   */
  private getFileConversionMCPService(): FileConversionMCPService {
    if (!this.fileConversionMCPService) {
      this.fileConversionMCPService = new FileConversionMCPService();
      // Initialize the service
      this.fileConversionMCPService.initialize().catch(err => {
        console.error('Failed to initialize File Conversion service:', err);
      });
    }
    return this.fileConversionMCPService;
  }

  /**
   * Get or create Gmail SSE handler instance
   */
  private async getGmailSSEHandler(): Promise<SSEMCPHandler> {
    if (!this.gmailSSEHandler) {
      const gmailService = await this.getGmailMCPService();
      this.gmailSSEHandler = new SSEMCPHandler(gmailService, '/gmail/message', 'gmail');
    }
    return this.gmailSSEHandler;
  }

  /**
   * Get or create FileSystem SSE handler instance
   */
  private getFilesystemSSEHandler(): SSEMCPHandler {
    if (!this.filesystemSSEHandler) {
      const filesystemService = this.getFilesystemMCPService();
      this.filesystemSSEHandler = new SSEMCPHandler(filesystemService, '/filesystem/message', 'filesystem');
    }
    return this.filesystemSSEHandler;
  }

  /**
   * Get or create HTTP Stream handler instance
   */
  private async getHTTPStreamHandler(): Promise<HTTPStreamHandler> {
    if (!this.httpStreamHandler) {
      const gmailService = await this.getGmailMCPService();
      this.httpStreamHandler = new HTTPStreamHandler(gmailService);
    }
    return this.httpStreamHandler;
  }

  /**
   * Get or create FileSystem HTTP Stream handler instance
   */
  private getFilesystemHTTPStreamHandler(): HTTPStreamHandler {
    if (!this.filesystemHTTPStreamHandler) {
      const filesystemService = this.getFilesystemMCPService();
      this.filesystemHTTPStreamHandler = new HTTPStreamHandler(filesystemService);
    }
    return this.filesystemHTTPStreamHandler;
  }

  /**
   * Handle HTTP Stream endpoint (POST /mcp)
   * This is the new bidirectional HTTP streaming protocol
   */
  private async handleHTTPStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Gmail MCP is enabled
    if (!this.isMCPServerEnabled('gmail')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Gmail MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'gmail'
      }));
      return;
    }

    try {
      const httpStreamHandler = await this.getHTTPStreamHandler();
      await httpStreamHandler.handleStream(req, res);
    } catch (error) {
      console.error('❌ Error handling HTTP Stream:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle FileSystem HTTP Stream endpoint (POST /filesystem/mcp)
   * This is the new bidirectional HTTP streaming protocol
   */
  private async handleFilesystemHTTPStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if FileSystem MCP is enabled
    if (!this.isMCPServerEnabled('filesystem')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'FileSystem MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'filesystem'
      }));
      return;
    }

    try {
      const httpStreamHandler = this.getFilesystemHTTPStreamHandler();
      await httpStreamHandler.handleStream(req, res);
    } catch (error) {
      console.error('❌ Error handling FileSystem HTTP Stream:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Gmail SSE stream endpoint (GET /sse)
   */
  private async handleGmailSSEStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Gmail MCP is enabled
    if (!this.isMCPServerEnabled('gmail')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Gmail MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'gmail'
      }));
      return;
    }

    try {
      const sseHandler = await this.getGmailSSEHandler();
      await sseHandler.handleSSEStream(req, res);
    } catch (error) {
      console.error('❌ Error handling Gmail SSE stream:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Gmail message endpoint (POST /message)
   */
  private async handleGmailMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Gmail MCP is enabled
    if (!this.isMCPServerEnabled('gmail')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Gmail MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'gmail'
      }));
      return;
    }

    try {
      const sseHandler = await this.getGmailSSEHandler();
      await sseHandler.handleMessage(req, res);
    } catch (error) {
      console.error('❌ Error handling Gmail message:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle FileSystem SSE stream endpoint (GET /filesystem/sse)
   */
  private async handleFilesystemSSEStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if FileSystem MCP is enabled
    if (!this.isMCPServerEnabled('filesystem')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'File System MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'filesystem'
      }));
      return;
    }

    try {
      const sseHandler = this.getFilesystemSSEHandler();
      await sseHandler.handleSSEStream(req, res);
    } catch (error) {
      console.error('❌ Error handling FileSystem SSE stream:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle FileSystem message endpoint (POST /filesystem/message)
   */
  private async handleFilesystemMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if FileSystem MCP is enabled
    if (!this.isMCPServerEnabled('filesystem')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'File System MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'filesystem'
      }));
      return;
    }

    try {
      const sseHandler = this.getFilesystemSSEHandler();
      await sseHandler.handleMessage(req, res);
    } catch (error) {
      console.error('❌ Error handling FileSystem message:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Gmail MCP requests
   */
  private async handleGmailMCP(url: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Gmail MCP is enabled
    if (!this.isMCPServerEnabled('gmail')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Gmail MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'gmail'
      }));
      return;
    }

    // List Gmail tools
    if (url === '/gmail/tools' && req.method === 'GET') {
      this.handleGmailToolsList(res);
      return;
    }

    // Call a Gmail tool
    if (url === '/gmail/tools/call' && req.method === 'POST') {
      await this.handleGmailToolCall(req, res);
      return;
    }

    // Unknown Gmail endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Gmail MCP endpoint not found',
      availableEndpoints: [
        'POST /mcp - HTTP Streamable endpoint for MCP protocol (bidirectional streaming)',
        '/gmail/sse - SSE endpoint for MCP protocol (legacy)',
        '/gmail/tools - List available tools',
        '/gmail/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle FileSystem MCP requests
   */
  private async handleFilesystemMCP(url: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if FileSystem MCP is enabled
    if (!this.isMCPServerEnabled('filesystem')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'File System MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'filesystem'
      }));
      return;
    }

    // List FileSystem tools
    if (url === '/filesystem/tools' && req.method === 'GET') {
      this.handleFilesystemToolsList(res);
      return;
    }

    // Call a FileSystem tool
    if (url === '/filesystem/tools/call' && req.method === 'POST') {
      await this.handleFilesystemToolCall(req, res);
      return;
    }

    // Unknown FileSystem endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'File System MCP endpoint not found',
      availableEndpoints: [
        '/filesystem/tools - List available tools',
        '/filesystem/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle File Conversion MCP endpoints
   */
  private async handleFileConversionEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // Check if file-conversion server is enabled
    if (!this.isMCPServerEnabled('file-conversion')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'File Conversion MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'file-conversion'
      }));
      return;
    }

    // List File Conversion tools
    if (url === '/file-conversion/tools' && req.method === 'GET') {
      this.handleFileConversionToolsList(res);
      return;
    }

    // Call a File Conversion tool
    if (url === '/file-conversion/tools/call' && req.method === 'POST') {
      await this.handleFileConversionToolCall(req, res);
      return;
    }

    // Unknown File Conversion endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'File Conversion MCP endpoint not found',
      availableEndpoints: [
        '/file-conversion/tools - List available tools',
        '/file-conversion/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle File Conversion tools list
   */
  private handleFileConversionToolsList(res: http.ServerResponse): void {
    const service = this.getFileConversionMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle File Conversion tool call
   */
  private async handleFileConversionToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Missing "tool" parameter in request body'
        }));
        return;
      }

      console.log(`🔄 Calling File Conversion tool: ${tool}`);

      // Get File Conversion service
      const service = this.getFileConversionMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling File Conversion tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle FileSystem tools list
   */
  private handleFilesystemToolsList(res: http.ServerResponse): void {
    const service = this.getFilesystemMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle FileSystem tool call
   */
  private async handleFilesystemToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Missing "tool" parameter in request body'
        }));
        return;
      }

      console.log(`🔧 Calling FileSystem tool: ${tool}`);

      // Get FileSystem service
      const service = this.getFilesystemMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling FileSystem tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Gmail tools list
   * MCP protocol expects a plain array of tools, not wrapped in an object
   */
  private handleGmailToolsList(res: http.ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify([
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
    ], null, 2));
  }

  /**
   * Handle Gmail tool call
   */
  private async handleGmailToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // Parse request body
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({
          success: false,
          error: 'Missing "tool" parameter in request body'
        }));
        return;
      }

      console.log(`🔧 Calling Gmail tool: ${tool}`);

      // Get Gmail connection
      const connection = await this.getGmailConnection();
      if (!connection) {
        res.writeHead(404);
        res.end(JSON.stringify({
          success: false,
          error: 'No Gmail connection found. Please configure a Gmail connection first.'
        }));
        return;
      }

      // Create Gmail fetcher instance
      const fetcher = new GmailMCPFetcher(connection);
      await fetcher.waitForInitialization();

      // Route to appropriate tool
      let result;
      switch (tool) {
        case 'gmail_list_users':
          result = await this.executeListUsers(fetcher);
          break;

        case 'gmail_get_user_messages':
          result = await this.executeGetUserMessages(fetcher, args);
          break;

        case 'gmail_get_user_stats':
          result = await this.executeGetUserStats(fetcher, args);
          break;

        case 'gmail_search_messages':
          result = await this.executeSearchMessages(fetcher, args);
          break;

        default:
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: `Unknown tool: ${tool}`
          }));
          return;
      }

      // Return success response
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        tool,
        result,
        timestamp: new Date().toISOString()
      }, null, 2));

    } catch (error) {
      console.error('❌ Error calling Gmail tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }));
    }
  }

  /**
   * Parse request body
   */
  private parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Execute gmail_list_users tool
   */
  private async executeListUsers(fetcher: GmailMCPFetcher): Promise<any> {
    const users = await fetcher.fetchAllDomainUsers();
    return {
      totalUsers: users.length,
      users
    };
  }

  /**
   * Execute gmail_get_user_messages tool
   */
  private async executeGetUserMessages(fetcher: GmailMCPFetcher, args: any): Promise<any> {
    const { email, maxResults = 50 } = args || {};
    
    if (!email) {
      throw new Error('Missing required parameter: email');
    }

    const messages = await fetcher.fetchUserMessages(email, { maxResults });
    return {
      userEmail: email,
      totalMessages: messages.length,
      messages
    };
  }

  /**
   * Execute gmail_get_user_stats tool
   */
  private async executeGetUserStats(fetcher: GmailMCPFetcher, args: any): Promise<any> {
    const { email } = args || {};
    
    if (!email) {
      throw new Error('Missing required parameter: email');
    }

    const stats = await fetcher.fetchUserStats(email);
    return {
      userEmail: email,
      stats
    };
  }

  /**
   * Execute gmail_search_messages tool
   */
  private async executeSearchMessages(fetcher: GmailMCPFetcher, args: any): Promise<any> {
    const { query, email, maxResults = 50 } = args || {};
    
    if (!query) {
      throw new Error('Missing required parameter: query');
    }

    const messages = await fetcher.fetchUserMessages(email || '', { 
      query,
      maxResults 
    });
    
    return {
      query,
      userEmail: email,
      totalMessages: messages.length,
      messages
    };
  }

  /**
   * Handle test Gmail endpoint - fetches domain users using GmailMCPFetcher
   */
  private async handleTestGmail(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      console.log('🧪 Testing Gmail MCP Fetcher...');

      // Get the first Gmail connection from store
      const connection = await this.getGmailConnection();
      
      if (!connection) {
        res.writeHead(404);
        res.end(JSON.stringify({ 
          success: false,
          error: 'No Gmail connection found. Please configure a Gmail connection first.'
        }));
        return;
      }

      console.log(`📧 Using connection: ${connection.email}`);

      // Create Gmail fetcher instance
      const fetcher = new GmailMCPFetcher(connection);
      await fetcher.waitForInitialization();

      // Fetch domain users
      console.log('👥 Fetching domain users...');
      const users = await fetcher.fetchAllDomainUsers();

      // Return success response
      res.writeHead(200);
      res.end(JSON.stringify({ 
        success: true,
        connection: {
          id: connection.id,
          email: connection.email,
          adminEmail: connection.adminEmail
        },
        data: {
          totalUsers: users.length,
          users: users
        },
        timestamp: new Date().toISOString()
      }));

      console.log(`✅ Successfully fetched ${users.length} domain users`);
    } catch (error) {
      console.error('❌ Error in test Gmail endpoint:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }));
    }
  }

  /**
   * Get Gmail connection from store
   */
  private async getGmailConnection(): Promise<GmailConnection | null> {
    try {
      const store = getStore();
      const config = store.get('mcpConfiguration', { connections: [] });
      const connections = config.connections || [];
      
      // Find the first Gmail connection
      const gmailConnection = connections.find((conn: any) => 
        conn.type === 'gmail' || conn.serviceAccountKey
      );

      if (!gmailConnection) {
        console.log('⚠️ No Gmail connection found in store');
        return null;
      }

      console.log(`✅ Found Gmail connection: ${gmailConnection.email}`);
      return gmailConnection as GmailConnection;
    } catch (error) {
      console.error('Error getting Gmail connection:', error);
      return null;
    }
  }


  /**
   * Trigger macOS firewall prompt by making a test connection
   */
  private triggerFirewallPrompt(port: number, protocol: string): void {
    setTimeout(() => {
      try {
        console.log('🔥 Triggering firewall prompt with test connection...');
        
        const httpModule = protocol === 'https' ? https : http;
        const testRequest = httpModule.request({
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'GET',
          ...(protocol === 'https' ? { rejectUnauthorized: false } : {}),
        }, (res) => {
          console.log('✅ Firewall prompt triggered');
          res.on('data', () => {});
          res.on('end', () => {
            console.log('🔥 Test connection completed - firewall dialog should appear');
          });
        });

        testRequest.on('error', (error) => {
          console.log('🔥 Test connection error (expected):', error.message);
        });

        testRequest.end();
      } catch (error) {
        console.error('Failed to trigger firewall prompt:', error);
      }
    }, 1000);
  }

  /**
   * Get network information for displaying network URLs
   */
  public getNetworkInfo(): { localIP: string; interfaces: any[] } {
    try {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      let localIP = 'localhost';
      const interfaces: any[] = [];

      for (const interfaceName in networkInterfaces) {
        const ifaces = networkInterfaces[interfaceName];
        for (const iface of ifaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            interfaces.push({
              name: interfaceName,
              address: iface.address,
              family: iface.family
            });
            if (localIP === 'localhost') {
              localIP = iface.address;
            }
          }
        }
      }

      return { localIP, interfaces };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return { localIP: 'localhost', interfaces: [] };
    }
  }

  /**
   * ========================================
   * Power Management Methods
   * ========================================
   */

  /**
   * Prevent system sleep while server is running
   */
  private preventSleep(): void {
    try {
      if (this.powerSaveBlockerId !== null) {
        console.log('🔋 System sleep prevention already active');
        return;
      }

      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      console.log('🔋 System sleep prevention enabled - desktop will stay awake while server is running');
      console.log(`📱 Power save blocker ID: ${this.powerSaveBlockerId}`);
    } catch (error) {
      console.error('❌ Failed to prevent system sleep:', error);
      this.powerSaveBlockerId = null;
    }
  }

  /**
   * Allow system sleep when server is stopped
   */
  private allowSleep(): void {
    try {
      if (this.powerSaveBlockerId === null) {
        console.log('🔋 System sleep prevention not active');
        return;
      }

      const wasActive = powerSaveBlocker.isStarted(this.powerSaveBlockerId);
      if (wasActive) {
        powerSaveBlocker.stop(this.powerSaveBlockerId);
        console.log('🔋 System sleep prevention disabled - desktop can now sleep normally');
      }
      
      this.powerSaveBlockerId = null;
    } catch (error) {
      console.error('❌ Failed to restore system sleep:', error);
      // Still reset the ID to avoid keeping a stale reference
      this.powerSaveBlockerId = null;
    }
  }

  /**
   * Get current power save blocker status
   */
  private getPowerSaveBlockerStatus(): { isActive: boolean; blockerId: number | null } {
    const isActive = this.powerSaveBlockerId !== null && 
                     powerSaveBlocker.isStarted(this.powerSaveBlockerId);
    return {
      isActive,
      blockerId: this.powerSaveBlockerId
    };
  }

  /**
   * ========================================
   * MCP Server Management Methods
   * ========================================
   */

  /**
   * Get all available MCP servers and their status
   */
  private async getMCPServers(): Promise<{ success: boolean; servers?: MCPServerConfig[]; error?: string }> {
    try {
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      return { success: true, servers: mcpServers };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get default MCP servers configuration
   */
  private getDefaultMCPServers(): MCPServerConfig[] {
    return [
      {
        name: 'gmail',
        enabled: false, // Disabled by default
        description: 'Gmail MCP Server - Access Gmail data from Google Workspace'
      },
      {
        name: 'filesystem',
        enabled: true, // Enabled by default
        description: 'File System MCP Server - Access files and directories with security controls'
      },
      {
        name: 'file-conversion',
        enabled: true, // Enabled by default
        description: 'File Conversion MCP Server - Convert between file formats (PDF, images, documents)'
      }
      // Future servers:
      // {
      //   name: 'calendar',
      //   enabled: false,
      //   description: 'Google Calendar MCP Server - Access calendar data'
      // },
      // {
      //   name: 'drive',
      //   enabled: false,
      //   description: 'Google Drive MCP Server - Access drive files'
      // }
    ];
  }

  /**
   * Check if an MCP server is enabled
   */
  private isMCPServerEnabled(serverName: string): boolean {
    try {
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      const server = mcpServers.find(s => s.name === serverName);
      return server ? server.enabled : false;
    } catch (error) {
      console.error('Error checking MCP server status:', error);
      return false;
    }
  }

  /**
   * Get enabled MCP servers
   */
  private getEnabledMCPServers(): MCPServerConfig[] {
    try {
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      return mcpServers.filter(server => server.enabled);
    } catch (error) {
      console.error('Error getting enabled MCP servers:', error);
      return [];
    }
  }

  /**
   * Enable an MCP server
   */
  private async enableMCPServer(serverName: string): Promise<{ success: boolean; server?: MCPServerConfig; error?: string }> {
    try {
      console.log(`🟢 Enabling MCP server: ${serverName}`);
      
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      const serverIndex = mcpServers.findIndex(s => s.name === serverName);
      
      if (serverIndex === -1) {
        return { success: false, error: `MCP server '${serverName}' not found` };
      }
      
      // Enable the server
      mcpServers[serverIndex].enabled = true;
      this.store.set('mcpServers', mcpServers);
      
      console.log(`✅ MCP server '${serverName}' enabled successfully`);
      console.log(`📚 Documentation for ${serverName} is now available at /${serverName}/tools`);
      
      return { success: true, server: mcpServers[serverIndex] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to enable MCP server '${serverName}':`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disable an MCP server
   */
  private async disableMCPServer(serverName: string): Promise<{ success: boolean; server?: MCPServerConfig; error?: string }> {
    try {
      console.log(`🔴 Disabling MCP server: ${serverName}`);
      
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      const serverIndex = mcpServers.findIndex(s => s.name === serverName);
      
      if (serverIndex === -1) {
        return { success: false, error: `MCP server '${serverName}' not found` };
      }
      
      // Disable the server
      mcpServers[serverIndex].enabled = false;
      this.store.set('mcpServers', mcpServers);
      
      console.log(`✅ MCP server '${serverName}' disabled successfully`);
      console.log(`🚫 Documentation for ${serverName} is no longer available`);
      console.log(`💡 AI clients won't be able to call ${serverName} tools`);
      
      return { success: true, server: mcpServers[serverIndex] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to disable MCP server '${serverName}':`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get status of a specific MCP server
   */
  private async getMCPServerStatus(serverName: string): Promise<{ success: boolean; server?: MCPServerConfig; error?: string }> {
    try {
      const mcpServers = this.store.get('mcpServers', this.getDefaultMCPServers()) as MCPServerConfig[];
      const server = mcpServers.find(s => s.name === serverName);
      
      if (!server) {
        return { success: false, error: `MCP server '${serverName}' not found` };
      }
      
      return { success: true, server };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance getter
export const getLocalServerManager = (): LocalServerManager => LocalServerManager.getInstance();
