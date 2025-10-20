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
import { app, ipcMain } from 'electron';
import { getStore } from '../../../storage';
import { GmailMCPFetcher } from '../server-script/gmail-service';
import { GmailConnection } from '../../../types/gmail-types';

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

    // SSL Certificate handlers
    ipcMain.handle('ssl-certificate-generate', async (event, request: CertificateRequest) => {
      return await this.generateCertificate(request);
    });

    ipcMain.handle('ssl-certificate-generate-force', async (event, request: CertificateRequest) => {
      return await this.generateCertificateForce(request);
    });

    ipcMain.handle('ssl-certificate-list', async () => {
      return await this.listCertificates();
    });

    ipcMain.handle('ssl-certificate-get', async (event, certificateId: string) => {
      return await this.getCertificate(certificateId);
    });

    ipcMain.handle('ssl-certificate-delete', async (event, certificateId: string) => {
      return await this.deleteCertificate(certificateId);
    });

    ipcMain.handle('ssl-certificate-renew', async (event, certificateId: string) => {
      return await this.renewCertificate(certificateId);
    });

    ipcMain.handle('ssl-certificate-cleanup', async () => {
      return await this.cleanupExpiredCertificates();
    });

    // Get network information
    ipcMain.handle('https-server-get-network-info', () => {
      return this.getNetworkInfo();
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
        
        // Trigger firewall prompt by making a test connection
        this.triggerFirewallPrompt(options.port, protocol);
      });

      // Handle server errors
      this.server.on('error', (error) => {
        console.error('Server error:', error);
        this.isRunning = false;
        this.currentPort = null;
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
          console.log('🔒 HTTPS Server stopped');
        });
        this.server = null;
        this.isRunning = false;
        this.currentPort = null;
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to stop HTTPS server:', errorMessage);
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
      error: null
    };
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    console.log(`📨 Incoming request: ${req.method} ${url}`);

    // Root endpoint - List all available MCP servers
    if (url === '/' || url === '/mcp') {
      this.handleMCPServerList(res);
      return;
    }

    // Gmail MCP Server endpoints
    if (url.startsWith('/gmail')) {
      await this.handleGmailMCP(url, req, res);
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
        '/gmail/tools - List Gmail tools',
        '/gmail/tools/call - Call a Gmail tool',
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
        '/gmail/tools - List available tools',
        '/gmail/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle Gmail tools list
   */
  private handleGmailToolsList(res: http.ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      server: 'gmail',
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
      ],
      timestamp: new Date().toISOString()
    }, null, 2));
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
   * Generate self-signed certificate instructions
   */
  public getCertificateInstructions(): string {
    return `
To generate self-signed SSL certificates for local development:

1. Install OpenSSL (if not already installed)
2. Run the following command in your terminal:

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \\
  -keyout private-key.pem -out certificate.pem

This will create:
- private-key.pem (private key file)
- certificate.pem (certificate file)

Place these files in a secure location and use their paths when starting the HTTPS server.
    `.trim();
  }

  /**
   * Generate SSL certificate using mkcert
   * For debug mode: Always generates a fresh certificate
   */
  private async generateCertificate(request: CertificateRequest, forceNew: boolean = true): Promise<{ success: boolean; certificate?: SSLCertificate; error?: string }> {
    try {
      console.log(`🔐 Generating mkcert SSL certificate for domain: ${request.domain}`);

      // For debug purposes, always generate a fresh certificate
      if (forceNew) {
        console.log(`🔄 Debug mode: Generating fresh mkcert certificate for ${request.domain}...`);
        return await this.generateMkcertCertificate(request);
      }

      // Check if we already have a valid certificate for this domain
      const existingCert = await this.findValidCertificateForDomain(request.domain);
      
      if (existingCert) {
        console.log(`✅ Found valid existing certificate for ${request.domain} (expires: ${existingCert.validTo})`);
        return { success: true, certificate: existingCert };
      }

      // No valid certificate found, generate a new one with mkcert
      console.log(`🔄 No valid certificate found for ${request.domain}, generating new mkcert certificate...`);
      return await this.generateMkcertCertificate(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to generate certificate:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find a valid (non-expired) certificate for the given domain
   */
  private async findValidCertificateForDomain(domain: string): Promise<SSLCertificate | null> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      const now = new Date();
      
      // Find the most recent valid certificate for this domain
      const validCerts = certificates
        .filter(cert => 
          cert.domain === domain && 
          new Date(cert.validTo) > now && 
          !cert.isExpired
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return validCerts.length > 0 ? validCerts[0] : null;
    } catch (error) {
      console.error('Failed to find valid certificate:', error);
      return null;
    }
  }

  /**
   * Force generate SSL certificate (bypasses existing certificate check)
   */
  private async generateCertificateForce(request: CertificateRequest): Promise<{ success: boolean; certificate?: SSLCertificate; error?: string }> {
    try {
      console.log(`🔄 Force generating mkcert SSL certificate for domain: ${request.domain}`);
      return await this.generateMkcertCertificate(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to force generate certificate:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }


  /**
   * Get bundled mkcert path based on platform
   */
  private getBundledMkcertPath(): string | null {
    const os = require('os');
    const platform = os.platform();
    const arch = os.arch();

    let mkcertPath: string;
    
    // Determine the correct mkcert binary path based on platform
    if (platform === 'darwin') {
      // macOS
      const archFolder = arch === 'arm64' ? 'arm64' : 'x64';
      mkcertPath = path.join(app.getAppPath(), 'mkcert-bundle', 'macos', archFolder, 'mkcert');
    } else if (platform === 'win32') {
      // Windows
      mkcertPath = path.join(app.getAppPath(), 'mkcert-bundle', 'windows', 'x64', 'mkcert.exe');
    } else if (platform === 'linux') {
      // Linux
      const archFolder = arch === 'arm64' ? 'arm64' : 'x64';
      mkcertPath = path.join(app.getAppPath(), 'mkcert-bundle', 'linux', archFolder, 'mkcert');
    } else {
      return null;
    }

    // Check if bundled mkcert exists
    if (fs.existsSync(mkcertPath)) {
      return mkcertPath;
    }

    return null;
  }

  /**
   * Generate mkcert certificate (locally-trusted development certificates)
   */
  private async generateMkcertCertificate(request: CertificateRequest): Promise<{ success: boolean; certificate?: SSLCertificate; error?: string }> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Try to use bundled mkcert first
      let mkcertCommand = this.getBundledMkcertPath();
      
      if (!mkcertCommand) {
        // Fallback to system mkcert
        try {
          await execAsync('mkcert -version');
          mkcertCommand = 'mkcert';
        } catch {
          return {
            success: false,
            error: 'mkcert is not available. The bundled version was not found, and mkcert is not installed on your system.\n\nTo install:\nmacOS: brew install mkcert && mkcert -install\nWindows: choco install mkcert && mkcert -install\nLinux: See https://github.com/FiloSottile/mkcert#installation'
          };
        }
      } else {
        console.log(`✅ Using bundled mkcert: ${mkcertCommand}`);
      }

      // First-time setup: Install mkcert CA if needed
      // This may require sudo password on first run
      try {
        console.log('🔧 Checking mkcert installation...');
        
        // Check if mkcert CA is already installed by testing with mkcert
        let needsInstall = false;
        try {
          // Try to check if CAROOT exists
          const checkResult = await execAsync(`"${mkcertCommand}" -CAROOT`);
          const carootPath = checkResult.stdout.trim();
          
          if (!fs.existsSync(carootPath) || !fs.existsSync(path.join(carootPath, 'rootCA.pem'))) {
            needsInstall = true;
          } else {
            console.log(`✅ mkcert CA already installed at: ${carootPath}`);
          }
        } catch {
          needsInstall = true;
        }
        
        if (needsInstall) {
          console.log('📋 First-time mkcert setup required...');
          console.log('🔐 Installing mkcert certificate authority in system trust store...');
          console.log('💡 A system dialog will appear asking for your password');
          
          // Use sudo-prompt for GUI password dialog
          const sudoPrompt = require('sudo-prompt');
          const options = {
            name: 'EGDesk Certificate Setup',
          };
          
          await new Promise((resolve, reject) => {
            // Install to default system location (no custom CAROOT)
            const installCommand = `"${mkcertCommand}" -install`;
            console.log('🔐 Requesting administrator access for certificate installation...');
            
            sudoPrompt.exec(installCommand, options, (error: any, stdout: any, stderr: any) => {
              if (error) {
                console.error('❌ mkcert install failed:', error);
                console.error('This usually happens if the password dialog was cancelled');
                reject(error);
              } else {
                console.log('✅ mkcert CA installed successfully!');
                console.log('🎉 Your certificates will now be trusted by all browsers');
                if (stdout) console.log('stdout:', stdout);
                if (stderr) console.log('stderr:', stderr);
                resolve(stdout);
              }
            });
          });
        }
      } catch (installError: any) {
        console.warn('⚠️  mkcert install warning:', installError);
        
        // Check if user cancelled
        if (installError.message && installError.message.includes('User did not grant permission')) {
          throw new Error('Certificate installation was cancelled. Browser-trusted certificates require administrator access to install the local certificate authority.');
        }
        
        console.warn('⚠️  Could not install mkcert CA automatically');
        throw new Error('Failed to install certificate authority. Certificates may not be trusted by browsers.\n\nPlease run this command manually in Terminal:\n\n  ' + mkcertCommand + ' -install');
      }

      // Create temporary directory for certificates
      const tempDir = path.join(app.getPath('temp'), 'ssl-certs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const certPath = path.join(tempDir, `${request.domain}-cert.pem`);
      const keyPath = path.join(tempDir, `${request.domain}-key.pem`);

      // Generate locally-trusted certificate using mkcert
      const command = `"${mkcertCommand}" -cert-file "${certPath}" -key-file "${keyPath}" ${request.domain}`;
      
      console.log(`🔐 Running: ${command}`);
      console.log(`📁 Output directory: ${tempDir}`);
      
      try {
        const result = await execAsync(command, {
          cwd: tempDir
        });
        console.log('✅ mkcert output:', result.stdout);
        if (result.stderr) {
          console.log('⚠️  mkcert stderr:', result.stderr);
        }
      } catch (execError: any) {
        console.error('❌ mkcert command failed:', execError);
        console.error('Command:', command);
        console.error('stdout:', execError.stdout);
        console.error('stderr:', execError.stderr);
        throw new Error(`mkcert command failed: ${execError.message}\nstderr: ${execError.stderr}`);
      }

      // Verify files were created
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Private key file was not created: ${keyPath}`);
      }
      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificate file was not created: ${certPath}`);
      }

      // Read the generated files
      const privateKey = fs.readFileSync(keyPath, 'utf8');
      const certificate = fs.readFileSync(certPath, 'utf8');

      // Create certificate object
      const cert: SSLCertificate = {
        id: `mkcert-${Date.now()}`,
        domain: request.domain,
        certificate,
        privateKey,
        issuer: 'mkcert (Locally Trusted)',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 825 * 24 * 60 * 60 * 1000).toISOString(), // ~2.25 years
        createdAt: new Date().toISOString(),
        isExpired: false
      };

      // Store in Electron store
      await this.storeCertificate(cert);

      // Clean up temporary files
      fs.unlinkSync(keyPath);
      fs.unlinkSync(certPath);

      console.log(`✅ mkcert certificate generated for ${request.domain} (Browser-trusted!)`);
      return { success: true, certificate: cert };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to generate mkcert certificate: ${errorMessage}` };
    }
  }


  /**
   * Store certificate in Electron store
   */
  private async storeCertificate(certificate: SSLCertificate): Promise<void> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      certificates.push(certificate);
      this.store.set('sslCertificates', certificates);
      console.log(`📁 Certificate stored: ${certificate.id}`);
    } catch (error) {
      console.error('Failed to store certificate:', error);
      throw error;
    }
  }

  /**
   * List all stored certificates
   */
  private async listCertificates(): Promise<{ success: boolean; certificates?: SSLCertificate[]; error?: string }> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      
      // Check for expired certificates and update status
      const now = new Date();
      const updatedCertificates = certificates.map(cert => ({
        ...cert,
        isExpired: new Date(cert.validTo) < now
      }));

      // Update store with expiration status
      this.store.set('sslCertificates', updatedCertificates);

      // Clean up expired certificates (optional - you can remove this if you want to keep expired ones)
      await this.cleanupExpiredCertificates();

      return { success: true, certificates: updatedCertificates };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Clean up expired certificates from the store
   */
  private async cleanupExpiredCertificates(): Promise<void> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      const now = new Date();
      
      // Keep only non-expired certificates
      const validCertificates = certificates.filter(cert => new Date(cert.validTo) > now);
      
      if (validCertificates.length !== certificates.length) {
        this.store.set('sslCertificates', validCertificates);
        console.log(`🧹 Cleaned up ${certificates.length - validCertificates.length} expired certificates`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired certificates:', error);
    }
  }

  /**
   * Get specific certificate by ID
   */
  private async getCertificate(certificateId: string): Promise<{ success: boolean; certificate?: SSLCertificate; error?: string }> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      const certificate = certificates.find(cert => cert.id === certificateId);
      
      if (!certificate) {
        return { success: false, error: 'Certificate not found' };
      }

      return { success: true, certificate };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete certificate
   */
  private async deleteCertificate(certificateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      const filteredCertificates = certificates.filter(cert => cert.id !== certificateId);
      
      if (filteredCertificates.length === certificates.length) {
        return { success: false, error: 'Certificate not found' };
      }

      this.store.set('sslCertificates', filteredCertificates);
      console.log(`🗑️ Certificate deleted: ${certificateId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Renew certificate (for self-signed, this generates a new one)
   */
  private async renewCertificate(certificateId: string): Promise<{ success: boolean; certificate?: SSLCertificate; error?: string }> {
    try {
      const certificates = this.store.get('sslCertificates', []) as SSLCertificate[];
      const certificate = certificates.find(cert => cert.id === certificateId);
      
      if (!certificate) {
        return { success: false, error: 'Certificate not found' };
      }

      // For self-signed certificates, generate a new one
      if (certificate.issuer === 'Self-Signed') {
        const newRequest: CertificateRequest = {
          domain: certificate.domain,
          email: 'renewal@example.com', // Default email for renewal
          provider: 'selfsigned'
        };

        const result = await this.generateSelfSignedCertificate(newRequest);
        if (result.success && result.certificate) {
          // Delete old certificate
          await this.deleteCertificate(certificateId);
          return result;
        } else {
          return result;
        }
      } else {
        return { success: false, error: 'Certificate renewal not supported for this issuer' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
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
