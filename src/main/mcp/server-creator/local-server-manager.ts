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
import { AppsScriptMCPService } from '../apps-script/apps-script-mcp-service';
import { ConversationsMCPService } from '../conversations/conversations-mcp-service';
import { SheetsMCPService } from '../sheets/sheets-mcp-service';
import { UserDataMCPService } from '../user-data/user-data-mcp-service';
import { FinanceHubMCPService } from '../financehub/financehub-mcp-service';
import { InternalKnowledgeMCPService } from '../internal-knowledge/internal-knowledge-mcp-service';
import { BrowserRecordingMCPService } from '../browser-recording/browser-recording-mcp-service';
import { AICenterMCPService } from '../ai-center/ai-center-mcp-service';
import { KoreanLawMCPService } from '../korean-law/korean-law-mcp-service';
import { PageIndexMCPService } from '../pageindex/pageindex-mcp-service';
import { SSEMCPHandler } from './sse-handler';
import { HTTPStreamHandler } from './http-stream-handler';
import { IMCPService, MCPTool, MCPToolResult } from '../types/mcp-service';
import { SSLCertificateService } from '../../ssl/ssl-certificate-service';

// Database path helper
function getDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'conversations.db');
  }
  // Fallback for standalone mode
  return process.env.DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/conversations.db';
}

// Cloud MCP Database path helper
function getCloudMCPDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'cloudmcp.db');
  }
  // Fallback for standalone mode
  return process.env.CLOUDMCP_DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/cloudmcp.db';
}

// User Data Database path helper
function getUserDataDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'user_data.db');
  }
  // Fallback for standalone mode
  return process.env.USERDATA_DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/user_data.db';
}

// FinanceHub Database path helper
function getFinanceHubDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'database', 'financehub.db');
  }
  // Fallback for standalone mode
  return process.env.FINANCEHUB_DB_PATH || '/Users/minseocha/Library/Application Support/egdesk/database/financehub.db';
}

export interface HTTPServerOptions {
  port: number;
  useHTTPS?: boolean;  // Optional: false = HTTP, true = HTTPS (for tunnel mode)
  keyPath?: string;
  certPath?: string;
  certificateId?: string; // Optional: ID of a certificate from the store
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
  private apiKey: string | null = null;
  private kakaoCallbackApiKey: string | null = null;

  public setApiKey(key: string): void {
    this.apiKey = key || null;
  }

  public setKakaoCallbackApiKey(key: string): void {
    this.kakaoCallbackApiKey = key || null;
  }
  
  // Services
  private gmailMCPService: GmailMCPService | null = null;
  private filesystemMCPService: FileSystemMCPService | null = null;
  private fileConversionMCPService: FileConversionMCPService | null = null;
  private appsScriptMCPService: AppsScriptMCPService | null = null;
  private conversationsMCPService: ConversationsMCPService | null = null;
  private sheetsMCPService: SheetsMCPService | null = null;
  private userDataMCPService: UserDataMCPService | null = null;
  private financeHubMCPService: FinanceHubMCPService | null = null;
  private internalKnowledgeMCPService: InternalKnowledgeMCPService | null = null;
  private browserRecordingMCPService: BrowserRecordingMCPService | null = null;
  private aiCenterMCPService: AICenterMCPService | null = null;
  private koreanLawMCPService: KoreanLawMCPService | null = null;
  private pageIndexMCPService: PageIndexMCPService | null = null;

  // SSE Handlers
  private gmailSSEHandler: SSEMCPHandler | null = null;
  private filesystemSSEHandler: SSEMCPHandler | null = null;
  private fileConversionSSEHandler: SSEMCPHandler | null = null;
  private appsScriptSSEHandler: SSEMCPHandler | null = null;
  private mcpSSEHandler: SSEMCPHandler | null = null; // Combined handler for GET/POST /mcp (SSE transport)
  
  // HTTP Stream Handlers
  private httpStreamHandler: HTTPStreamHandler | null = null;
  private filesystemHTTPStreamHandler: HTTPStreamHandler | null = null;
  private appsScriptHTTPStreamHandler: HTTPStreamHandler | null = null;

  // Kakao answer store — maps userKey → stored AI answer (consumed on 'ㅇ' retrieval)
  private kakaoAnswerStore = new Map<string, string>();
  // Pending callback registrations — maps callbackId → { userKey }
  private kakaoPendingCallbacks = new Map<string, { userKey: string }>();

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

    ipcMain.handle('mcp-tool-execute', async (event, serverName: string, toolName: string, args: any) => {
      try {
        let service: IMCPService | null = null;
        switch (serverName) {
          case 'ai-center-mcp-server':
          case 'ai-center':
            service = this.getAICenterMCPService();
            break;
          case 'user-data-mcp-server':
          case 'user-data':
            service = this.getUserDataMCPService();
            break;
          case 'financehub-mcp-server':
          case 'financehub':
            service = this.getFinanceHubMCPService();
            break;
          case 'gmail-mcp-server':
          case 'gmail':
            service = this.getGmailMCPService();
            break;
          case 'filesystem-mcp-server':
          case 'filesystem':
            service = this.getFilesystemMCPService();
            break;
          case 'sheets-mcp-server':
          case 'sheets':
            service = this.getSheetsMCPService();
            break;
          case 'conversations-mcp-server':
          case 'conversations':
            service = this.getConversationsMCPService();
            break;
          case 'apps-script-mcp-server':
          case 'apps-script':
            service = this.getAppsScriptMCPService();
            break;
          case 'internal-knowledge-mcp-server':
          case 'internal-knowledge':
            service = this.getInternalKnowledgeMCPService();
            break;
          case 'browser-recording-mcp-server':
          case 'browser-recording':
            service = this.getBrowserRecordingMCPService();
            break;
          case 'korean-law-mcp-server':
          case 'korean-law':
            service = this.getKoreanLawMCPService();
            break;
          case 'pageindex-mcp-server':
          case 'pageindex':
            service = this.getPageIndexMCPService();
            break;
        }

        if (!service) {
          throw new Error(`Unknown MCP server: ${serverName}`);
        }

        const result = await service.executeTool(toolName, args || {});
        return { success: true, result };
      } catch (error: any) {
        console.error(`Error executing MCP tool ${toolName} on ${serverName}:`, error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('https-server-set-enabled', async (event, enabled: boolean) => {
      try {
        this.store.set('https-enabled', enabled);
        console.log(`🔒 HTTPS setting updated: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to set HTTPS setting:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('✅ Local Server Manager IPC handlers registered');
  }

  /**
   * Start the HTTP/HTTPS server
   */
  public async startServer(options: HTTPServerOptions): Promise<{ success: boolean; error?: string; port?: number; protocol?: string }> {
    try {
      // Check if server is already running
      if (this.isRunning) {
        return { success: true, port: this.currentPort, protocol: this.useHTTPS ? 'https' : 'http' };
      }

      // Default to HTTPS if a certificate is available and not explicitly disabled
      const httpsEnabled = this.store.get('https-enabled', false) as boolean;
      const activeCertId = SSLCertificateService.getInstance().getActiveCertificateId();
      this.useHTTPS = options.useHTTPS ?? (httpsEnabled && !!activeCertId);
      const certificateId = options.certificateId || activeCertId;

      // Create request handler
      const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        // Set CORS headers for all requests
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

        // Handle OPTIONS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // API key validation for sensitive routes (defense-in-depth)
        const reqPath = req.url?.split('?')[0] || '/';
        const isProtectedRoute = reqPath.startsWith('/user-data/') || reqPath.startsWith('/financehub');
        if (this.apiKey && isProtectedRoute) {
          if (req.headers['x-api-key'] !== this.apiKey) {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: invalid or missing X-Api-Key' }));
            return;
          }
        }

        // Dedicated auth for Kakao callback endpoint
        // Only reject when the header is present but wrong — missing header means
        // Kakao's skill validation test (it doesn't include custom headers), let it through.
        if (this.kakaoCallbackApiKey && (reqPath === '/kakao/skill' || reqPath === '/webhook/start')) {
          const incomingKey = req.headers['x-api-key'];
          if (incomingKey !== undefined && incomingKey !== this.kakaoCallbackApiKey) {
            res.writeHead(401);
            res.end(JSON.stringify({ success: false, error: 'Unauthorized: invalid X-Api-Key' }));
            return;
          }
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
      if (this.useHTTPS) {
        let sslOptions: any;

        if (certificateId) {
          const cert = SSLCertificateService.getInstance().getCertificate(certificateId);
          if (cert) {
            sslOptions = { key: cert.privateKey, cert: cert.certificate };
            console.log(`🔒 Using Let's Encrypt certificate for ${cert.domain}`);
          } else {
            return { success: false, error: 'SSL certificate not found in store' };
          }
        } else if (options.keyPath && options.certPath) {
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
        } else {
          return { success: false, error: 'No SSL certificate provided' };
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
  public getStatus(): HTTPServerStatus {
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
    if (url === '/' && req.method === 'GET') {
      this.handleMCPServerList(res);
      return;
    }

    // Let's Encrypt ACME challenge handler
    if (url.startsWith('/.well-known/acme-challenge/') && req.method === 'GET') {
      const token = url.split('/').pop() || '';
      const response = SSLCertificateService.getInstance().getChallengeResponse(token);
      
      if (response) {
        console.log(`✅ Serving ACME challenge for token: ${token}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(response);
      } else {
        console.warn(`⚠️ ACME challenge token not found: ${token}`);
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }

    // GET /mcp — SSE transport: open SSE stream and send endpoint event pointing to /mcp/message
    // OpenClaw and other clients using the old MCP SSE transport send GET first to discover
    // where to POST messages. We respond with an SSE stream + endpoint event.
    if (url === '/mcp' && req.method === 'GET') {
      const sseHandler = this.getMCPSSEHandler();
      await sseHandler.handleSSEStream(req, res);
      return;
    }

    // POST /mcp/message — SSE transport message endpoint (client POSTs here after GET /mcp)
    if (url === '/mcp/message' && req.method === 'POST') {
      const sseHandler = this.getMCPSSEHandler();
      await sseHandler.handleMessage(req, res);
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

    // Apps Script HTTP Streamable endpoint for MCP protocol (POST for bidirectional streaming)
    if (url === '/apps-script' && req.method === 'POST') {
      await this.handleAppsScriptHTTPStream(req, res);
      return;
    }

    // Apps Script SSE endpoints for MCP protocol
    if (url === '/apps-script/sse') {
      if (req.method === 'GET') {
        await this.handleAppsScriptSSEStream(req, res);
        return;
      } else if (req.method === 'POST') {
        await this.handleAppsScriptMessage(req, res);
        return;
      }
    }

    if (url === '/apps-script/message' && req.method === 'POST') {
      await this.handleAppsScriptMessage(req, res);
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

    // Apps Script MCP Server endpoints (REST API)
    if (url.startsWith('/apps-script')) {
      await this.handleAppsScriptMCP(url, req, res);
      return;
    }

    // File Conversion MCP Server endpoints (REST API)
    if (url.startsWith('/file-conversion')) {
      await this.handleFileConversionEndpoint(req, res, url);
      return;
    }

    // Conversations MCP Server endpoints (REST API)
    if (url.startsWith('/conversations')) {
      await this.handleConversationsEndpoint(req, res, url);
      return;
    }

    // Sheets MCP Server endpoints (REST API)
    if (url.startsWith('/sheets')) {
      await this.handleSheetsEndpoint(req, res, url);
      return;
    }

    // User Data MCP Server endpoints (REST API)
    if (url.startsWith('/user-data')) {
      await this.handleUserDataEndpoint(req, res, url);
      return;
    }

    // FinanceHub MCP Server endpoints (REST API)
    if (url.startsWith('/financehub')) {
      await this.handleFinanceHubEndpoint(req, res, url);
      return;
    }

    // Korean Law MCP Server endpoints (REST API)
    if (url.startsWith('/korean-law')) {
      await this.handleKoreanLawEndpoint(req, res, url);
      return;
    }

    // PageIndex MCP Server endpoints (REST API)
    if (url.startsWith('/pageindex')) {
      await this.handlePageIndexEndpoint(req, res, url);
      return;
    }

    // Business Identity & Company Research MCP Server endpoints (REST API)
    // Provides access to: internal knowledge documents, business identity snapshots, company research
    if (url.startsWith('/internal-knowledge')) {
      await this.handleInternalKnowledgeEndpoint(req, res, url);
      return;
    }

    // Browser Recording MCP Server endpoints (REST API)
    if (url.startsWith('/browser-recording')) {
      await this.handleBrowserRecordingEndpoint(req, res, url);
      return;
    }

    // AI Center MCP Server endpoints (workflows + neuron entities/relations/tags)
    if (url.startsWith('/ai-center')) {
      await this.handleAICenterEndpoint(req, res, url);
      return;
    }

    // KakaoTalk answer callback — OpenClaw posts the AI answer here
    if (url.startsWith('/kakao/callback/') && req.method === 'POST') {
      await this.handleKakaoAnswerCallback(req, res, url);
      return;
    }

    // KakaoTalk skill endpoint — forwards to OpenClaw WebSocket gateway
    if (url === '/kakao/skill' || url === '/webhook/start') {
      if (req.method === 'POST') {
        await this.handleKakaoSkill(req, res);
      } else {
        // GET — used by Kakao's skill URL validation check and browser testing
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, service: 'kakao-skill', status: 'online' }));
      }
      return;
    }

    // KakaoTalk skill endpoint — synchronous (no callback), useful for testing
    if (url === '/kakao/skill/sync' && req.method === 'POST') {
      await this.handleKakaoSkillSync(req, res);
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
        'POST /apps-script - Apps Script HTTP Streamable endpoint for MCP protocol',
        'GET /apps-script/sse - Apps Script SSE endpoint for MCP protocol',
        'POST /apps-script/message - Apps Script message endpoint for SSE',
        '/apps-script/tools - List Apps Script tools',
        '/apps-script/tools/call - Call an Apps Script tool',
        '/file-conversion/tools - List File Conversion tools',
        '/file-conversion/tools/call - Call a File Conversion tool',
        '/conversations/tools - List Conversations tools',
        '/conversations/tools/call - Call a Conversations tool',
        '/sheets/tools - List Sheets tools',
        '/sheets/tools/call - Call a Sheets tool',
        '/user-data/tools - List User Data tools',
        '/user-data/tools/call - Call a User Data tool',
        '/financehub/tools - List FinanceHub tools',
        '/financehub/tools/call - Call a FinanceHub tool',
        '/internal-knowledge/tools - List Business Identity & Company Research tools',
        '/internal-knowledge/tools/call - Call a Business Identity & Company Research tool',
        '/browser-recording/tools - List Browser Recording tools',
        '/browser-recording/tools/call - Call a Browser Recording tool',
        '/korean-law/tools - List Korean Law tools',
        '/korean-law/tools/call - Call a Korean Law tool',
        '/pageindex/tools - List PageIndex tools',
        '/pageindex/tools/call - Call a PageIndex tool',
        'POST /kakao/skill - KakaoTalk skill webhook endpoint',
        'POST /webhook/start - Webhook start endpoint',
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
   * Get or create Apps Script MCP Service instance
   */
  private getAppsScriptMCPService(): AppsScriptMCPService {
    if (!this.appsScriptMCPService) {
      const dbPath = getCloudMCPDatabasePath();
      this.appsScriptMCPService = new AppsScriptMCPService(dbPath);
    }
    return this.appsScriptMCPService;
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
   * Get or create Conversations MCP Service instance
   */
  private getConversationsMCPService(): ConversationsMCPService {
    if (!this.conversationsMCPService) {
      this.conversationsMCPService = new ConversationsMCPService();
    }
    return this.conversationsMCPService;
  }

  /**
   * Get or create Sheets MCP Service instance
   */
  private getSheetsMCPService(): SheetsMCPService {
    if (!this.sheetsMCPService) {
      this.sheetsMCPService = new SheetsMCPService();
    }
    return this.sheetsMCPService;
  }

  /**
   * Get or create User Data MCP Service instance
   */
  private getUserDataMCPService(): UserDataMCPService {
    if (!this.userDataMCPService) {
      // Use the existing database connection from SQLiteManager instead of creating a new one
      // This prevents "database is locked" errors from multiple connections
      const { getSQLiteManager } = require('../../sqlite/manager');
      const manager = getSQLiteManager();
      const database = manager.getUserDataDatabase();
      this.userDataMCPService = new UserDataMCPService(database);
    }
    return this.userDataMCPService;
  }

  private getFinanceHubMCPService(): FinanceHubMCPService {
    if (!this.financeHubMCPService) {
      // Use the existing database connection from SQLiteManager instead of creating a new one
      // This prevents "database is locked" errors from multiple connections
      const { getSQLiteManager } = require('../../sqlite/manager');
      const manager = getSQLiteManager();
      const database = manager.getFinanceHubDatabase();
      this.financeHubMCPService = new FinanceHubMCPService(database);
    }
    return this.financeHubMCPService;
  }

  /**
   * Get or create Korean Law MCP Service
   */
  private getKoreanLawMCPService(): KoreanLawMCPService {
    if (!this.koreanLawMCPService) {
      this.koreanLawMCPService = new KoreanLawMCPService();
    }
    return this.koreanLawMCPService;
  }

  /**
   * Get or create PageIndex MCP Service
   */
  private getPageIndexMCPService(): PageIndexMCPService {
    if (!this.pageIndexMCPService) {
      this.pageIndexMCPService = new PageIndexMCPService();
    }
    return this.pageIndexMCPService;
  }

  /**
   * Get or create Internal Knowledge MCP Service
   */
  private getInternalKnowledgeMCPService(): InternalKnowledgeMCPService {
    if (!this.internalKnowledgeMCPService) {
      // Business identity data is in WordPress database, company research is in Conversations database
      const { getSQLiteManager } = require('../../sqlite/manager');
      const manager = getSQLiteManager();
      const wordpressDatabase = manager.getWordPressDatabase();
      const conversationsDatabase = manager.getConversationsDatabase();
      this.internalKnowledgeMCPService = new InternalKnowledgeMCPService(wordpressDatabase, conversationsDatabase);
    }
    return this.internalKnowledgeMCPService;
  }

  /**
   * Get or create Browser Recording MCP Service (saved Playwright specs + optional date replay)
   */
  private getBrowserRecordingMCPService(): BrowserRecordingMCPService {
    if (!this.browserRecordingMCPService) {
      this.browserRecordingMCPService = new BrowserRecordingMCPService();
    }
    return this.browserRecordingMCPService;
  }

  private getAICenterMCPService(): AICenterMCPService {
    if (!this.aiCenterMCPService) {
      this.aiCenterMCPService = new AICenterMCPService();
    }
    return this.aiCenterMCPService;
  }

  /**
   * Create a combined MCP service that aggregates all enabled tool services.
   * This is used for the main /mcp SSE endpoint exposed to OpenClaw.
   */
  private createCombinedMCPService(): IMCPService {
    const self = this;

    function safeTools(service: IMCPService): MCPTool[] {
      try { return service.listTools(); } catch { return []; }
    }

    function getServices(): IMCPService[] {
      const list: IMCPService[] = [];
      try { list.push(self.getFinanceHubMCPService()); } catch {}
      try { list.push(self.getKoreanLawMCPService()); } catch {}
      try { list.push(self.getUserDataMCPService()); } catch {}
      try { list.push(self.getConversationsMCPService()); } catch {}
      try { list.push(self.getSheetsMCPService()); } catch {}
      try { list.push(self.getInternalKnowledgeMCPService()); } catch {}
      try { list.push(self.getAICenterMCPService()); } catch {}
      try { list.push(self.getPageIndexMCPService()); } catch {}
      try { list.push(self.getFilesystemMCPService()); } catch {}
      return list;
    }

    return {
      getServerInfo: () => ({ name: 'egdesk-mcp-server', version: '1.0.0' }),
      getCapabilities: () => ({ tools: {}, resources: {} }),

      listTools(): MCPTool[] {
        const all: MCPTool[] = [];
        for (const svc of getServices()) {
          all.push(...safeTools(svc));
        }
        return all;
      },

      async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
        for (const svc of getServices()) {
          if (safeTools(svc).some(t => t.name === name)) {
            if (svc.initialize) await svc.initialize();
            return svc.executeTool(name, args);
          }
        }
        throw new Error(`Tool not found: ${name}`);
      }
    };
  }

  /**
   * Get or create the combined SSE handler for the main /mcp endpoint
   */
  private getMCPSSEHandler(): SSEMCPHandler {
    if (!this.mcpSSEHandler) {
      this.mcpSSEHandler = new SSEMCPHandler(this.createCombinedMCPService(), '/mcp/message', 'mcp-combined');
    }
    return this.mcpSSEHandler;
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
   * Get or create Apps Script SSE handler instance
   */
  private getAppsScriptSSEHandler(): SSEMCPHandler {
    if (!this.appsScriptSSEHandler) {
      const appsScriptService = this.getAppsScriptMCPService();
      this.appsScriptSSEHandler = new SSEMCPHandler(appsScriptService, '/apps-script/message', 'apps-script');
    }
    return this.appsScriptSSEHandler;
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
   * Get or create Apps Script HTTP Stream handler instance
   */
  private getAppsScriptHTTPStreamHandler(): HTTPStreamHandler {
    if (!this.appsScriptHTTPStreamHandler) {
      const appsScriptService = this.getAppsScriptMCPService();
      this.appsScriptHTTPStreamHandler = new HTTPStreamHandler(appsScriptService);
    }
    return this.appsScriptHTTPStreamHandler;
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
   * Handle Apps Script HTTP Stream endpoint (POST /apps-script)
   * This is the new bidirectional HTTP streaming protocol
   */
  private async handleAppsScriptHTTPStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Apps Script MCP is enabled
    if (!this.isMCPServerEnabled('apps-script')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Apps Script MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'apps-script'
      }));
      return;
    }

    try {
      const httpStreamHandler = this.getAppsScriptHTTPStreamHandler();
      await httpStreamHandler.handleStream(req, res);
    } catch (error) {
      console.error('❌ Error handling Apps Script HTTP Stream:', error);
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
   * Handle Apps Script SSE stream endpoint (GET /apps-script/sse)
   */
  private async handleAppsScriptSSEStream(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Apps Script MCP is enabled
    if (!this.isMCPServerEnabled('apps-script')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Apps Script MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'apps-script'
      }));
      return;
    }

    try {
      const sseHandler = this.getAppsScriptSSEHandler();
      await sseHandler.handleSSEStream(req, res);
    } catch (error) {
      console.error('❌ Error handling Apps Script SSE stream:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Apps Script message endpoint (POST /apps-script/message)
   */
  private async handleAppsScriptMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Apps Script MCP is enabled
    if (!this.isMCPServerEnabled('apps-script')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Apps Script MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'apps-script'
      }));
      return;
    }

    try {
      const sseHandler = this.getAppsScriptSSEHandler();
      await sseHandler.handleMessage(req, res);
    } catch (error) {
      console.error('❌ Error handling Apps Script message:', error);
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
   * Handle Apps Script MCP requests
   */
  private async handleAppsScriptMCP(url: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check if Apps Script MCP is enabled
    if (!this.isMCPServerEnabled('apps-script')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Apps Script MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'apps-script'
      }));
      return;
    }

    // List Apps Script tools
    if (url === '/apps-script/tools' && req.method === 'GET') {
      this.handleAppsScriptToolsList(res);
      return;
    }

    // Call an Apps Script tool
    if (url === '/apps-script/tools/call' && req.method === 'POST') {
      await this.handleAppsScriptToolCall(req, res);
      return;
    }

    // Unknown Apps Script endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Apps Script MCP endpoint not found',
      availableEndpoints: [
        '/apps-script/tools - List available tools',
        '/apps-script/tools/call - Call a tool'
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
   * Handle Conversations MCP endpoints
   */
  private async handleConversationsEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // Check if conversations server is enabled
    if (!this.isMCPServerEnabled('conversations')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Conversations MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'conversations'
      }));
      return;
    }

    // List Conversations tools
    if (url === '/conversations/tools' && req.method === 'GET') {
      this.handleConversationsToolsList(res);
      return;
    }

    // Call a Conversations tool
    if (url === '/conversations/tools/call' && req.method === 'POST') {
      await this.handleConversationsToolCall(req, res);
      return;
    }

    // Unknown Conversations endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Conversations MCP endpoint not found',
      availableEndpoints: [
        '/conversations/tools - List available tools',
        '/conversations/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle Conversations tools list
   */
  private handleConversationsToolsList(res: http.ServerResponse): void {
    const service = this.getConversationsMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle Conversations tool call
   */
  private async handleConversationsToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

      console.log(`💬 Calling Conversations tool: ${tool}`);

      // Get Conversations service
      const service = this.getConversationsMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling Conversations tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Sheets MCP endpoints
   */
  private async handleSheetsEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // Check if sheets server is enabled
    if (!this.isMCPServerEnabled('sheets')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Sheets MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        hint: 'Use: ipcRenderer.invoke("mcp-server-enable", "sheets")'
      }));
      return;
    }

    // List Sheets tools
    if (url === '/sheets/tools' && req.method === 'GET') {
      this.handleSheetsToolsList(res);
      return;
    }

    // Call a Sheets tool
    if (url === '/sheets/tools/call' && req.method === 'POST') {
      await this.handleSheetsToolCall(req, res);
      return;
    }

    // Unknown Sheets endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Sheets MCP endpoint not found',
      availableEndpoints: [
        '/sheets/tools - List available tools',
        '/sheets/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle Sheets tools list
   */
  private handleSheetsToolsList(res: http.ServerResponse): void {
    const service = this.getSheetsMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle Sheets tool call
   */
  private async handleSheetsToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

      console.log(`📊 Calling Sheets tool: ${tool}`);

      // Get Sheets service
      const service = this.getSheetsMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling Sheets tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle User Data MCP endpoints
   */
  private async handleUserDataEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // Check if user-data server is enabled
    if (!this.isMCPServerEnabled('user-data')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'User Data MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        hint: 'Use: ipcRenderer.invoke("mcp-server-enable", "user-data")'
      }));
      return;
    }

    // List User Data tools
    if (url === '/user-data/tools' && req.method === 'GET') {
      this.handleUserDataToolsList(res);
      return;
    }

    // Call a User Data tool
    if (url === '/user-data/tools/call' && req.method === 'POST') {
      await this.handleUserDataToolCall(req, res);
      return;
    }

    // Unknown User Data endpoint
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'User Data MCP endpoint not found',
      availableEndpoints: [
        '/user-data/tools - List available tools',
        '/user-data/tools/call - Call a tool'
      ]
    }));
  }

  /**
   * Handle User Data tools list
   */
  private handleUserDataToolsList(res: http.ServerResponse): void {
    const service = this.getUserDataMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle User Data tool call
   */
  private async handleUserDataToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

      console.log(`🗄️ Calling User Data tool: ${tool}`);

      // Get User Data service
      const service = this.getUserDataMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling User Data tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle FinanceHub MCP endpoint
   */
  private async handleFinanceHubEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // Check if financehub server is enabled
    if (!this.isMCPServerEnabled('financehub')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'FinanceHub MCP server is not enabled. Enable it first.',
        hint: 'Use: ipcRenderer.invoke("mcp-server-enable", "financehub")'
      }));
      return;
    }

    // List FinanceHub tools
    if (url === '/financehub/tools' && req.method === 'GET') {
      this.handleFinanceHubToolsList(res);
      return;
    }

    // Call a FinanceHub tool
    if (url === '/financehub/tools/call' && req.method === 'POST') {
      await this.handleFinanceHubToolCall(req, res);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'FinanceHub MCP endpoint not found'
    }));
  }

  /**
   * Handle FinanceHub tools list
   */
  private handleFinanceHubToolsList(res: http.ServerResponse): void {
    const service = this.getFinanceHubMCPService();
    const tools = service.listTools();
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle FinanceHub tool call
   */
  private async handleFinanceHubToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "tool" parameter' }));
        return;
      }

      console.log(`💰 Calling FinanceHub tool: ${tool}`);
      const service = this.getFinanceHubMCPService();
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result }, null, 2));
    } catch (error) {
      console.error('Error calling FinanceHub tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle Korean Law MCP endpoint
   */
  private async handleKoreanLawEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    if (!this.isMCPServerEnabled('korean-law')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Korean Law MCP server is not enabled. Enable it first.',
        hint: 'Use: ipcRenderer.invoke("mcp-server-enable", "korean-law")'
      }));
      return;
    }

    if (url === '/korean-law/tools' && req.method === 'GET') {
      this.handleKoreanLawToolsList(res);
      return;
    }

    if (url === '/korean-law/tools/call' && req.method === 'POST') {
      await this.handleKoreanLawToolCall(req, res);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Korean Law MCP endpoint not found'
    }));
  }

  /**
   * Handle Korean Law tools list
   */
  private handleKoreanLawToolsList(res: http.ServerResponse): void {
    const service = this.getKoreanLawMCPService();
    const tools = service.listTools();
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle Korean Law tool call
   */
  private async handleKoreanLawToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "tool" parameter' }));
        return;
      }

      console.log(`⚖️ Calling Korean Law tool: ${tool}`);
      const service = this.getKoreanLawMCPService();
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result }, null, 2));
    } catch (error) {
      console.error('Error calling Korean Law tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle PageIndex MCP endpoint
   */
  private async handlePageIndexEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    if (url === '/pageindex/tools' && req.method === 'GET') {
      const service = this.getPageIndexMCPService();
      res.writeHead(200);
      res.end(JSON.stringify(service.listTools(), null, 2));
      return;
    }

    if (url === '/pageindex/tools/call' && req.method === 'POST') {
      try {
        const body = await this.parseRequestBody(req);
        const { tool, arguments: args } = body;

        if (!tool) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Missing "tool" parameter' }));
          return;
        }

        console.log(`📄 Calling PageIndex tool: ${tool}`);
        const service = this.getPageIndexMCPService();
        const result = await service.executeTool(tool, args || {});

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, result }, null, 2));
      } catch (error) {
        console.error('Error calling PageIndex tool:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: 'PageIndex endpoint not found' }));
  }

  /**
   * Handle Business Identity & Company Research MCP endpoint
   * Provides access to internal knowledge, business identity snapshots, and company research
   */
  private async handleInternalKnowledgeEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    // List Business Identity tools
    if (url === '/internal-knowledge/tools' && req.method === 'GET') {
      this.handleInternalKnowledgeToolsList(res);
      return;
    }

    // Call a Business Identity tool
    if (url === '/internal-knowledge/tools/call' && req.method === 'POST') {
      await this.handleInternalKnowledgeToolCall(req, res);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Business Identity MCP endpoint not found'
    }));
  }

  /**
   * Handle Business Identity tools list (knowledge, snapshots, company research)
   */
  private handleInternalKnowledgeToolsList(res: http.ServerResponse): void {
    const service = this.getInternalKnowledgeMCPService();
    const tools = service.listTools();
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle Business Identity tool call (knowledge, snapshots, company research)
   */
  private async handleInternalKnowledgeToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { tool, arguments: args } = body;

      if (!tool) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Missing "tool" parameter' }));
        return;
      }

      console.log(`🏢 Calling Business Identity tool: ${tool}`);
      const service = this.getInternalKnowledgeMCPService();
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, result }, null, 2));
    } catch (error) {
      console.error('Error calling Business Identity tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * KakaoTalk skill endpoint.
   *
   * If the user's utterance is 'ㅇ' or 'o', return the last stored AI answer
   * for that user (consumed on retrieval).
   *
   * Otherwise:
   *  1. Immediately return a holding message telling the user to type 'ㅇ'.
   *  2. Forward the request to OpenClaw in the background, replacing the
   *     Kakao-issued callbackUrl with our own /kakao/callback/:id endpoint.
   *  3. When OpenClaw calls our callback, store the answer keyed by userKey.
   */
  private async handleKakaoSkill(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Read body
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', resolve);
    });
    const bodyText = Buffer.concat(chunks).toString();

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const utterance: string = (body?.userRequest?.utterance ?? '').trim();
    const userKey: string =
      body?.userRequest?.user?.properties?.botUserKey ||
      body?.userRequest?.user?.properties?.plusfriendUserKey ||
      body?.userRequest?.user?.id ||
      'unknown';

    console.log(`[KakaoSkill] Incoming request: userKey=${userKey}, utterance="${utterance}"`);
    console.log(`[KakaoSkill] Full userRequest: ${JSON.stringify(body?.userRequest || {})}`);

    // ── 'ㅇ' retrieval command ────────────────────────────────────────────────
    if (utterance === 'ㅇ' || utterance === 'o' || utterance === '어' || utterance === 'ㅇㅇ') {
      console.log(`[KakaoSkill] Retrieval attempt for userKey="${userKey}". Available keys: ${Array.from(this.kakaoAnswerStore.keys()).join(', ')}`);
      const cached = this.kakaoAnswerStore.get(userKey);
      console.log(`[KakaoSkill] Retrieval result: ${cached ? 'FOUND' : 'NOT FOUND'}`);
      if (cached) {
        this.kakaoAnswerStore.delete(userKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          version: '2.0',
          template: { outputs: [{ simpleText: { text: cached } }] },
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          version: '2.0',
          template: { outputs: [{ simpleText: { text: '아직 처리 중이에요. 잠시 후 다시 \'ㅇ\'를 입력해주세요 😊' } }] },
        }));
      }
      return;
    }

    // ── Holding message + background dispatch ─────────────────────────────────
    // Generate a callback ID so we can store the AI answer when it arrives
    const callbackId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.kakaoPendingCallbacks.set(callbackId, { userKey });

    // Replace the Kakao-issued callbackUrl with our own intercept endpoint.
    // This lets OpenClaw work normally while we capture (and store) the answer.
    const ourCallbackUrl = `http://localhost:8080/kakao/callback/${callbackId}`;
    const modifiedBody = JSON.parse(JSON.stringify(body));
    if (modifiedBody.userRequest) {
      modifiedBody.userRequest.callbackUrl = ourCallbackUrl;
    }

    // Return the holding message immediately (no useCallback — this IS the response)
    const now = new Date();
    const minute = now.getMinutes();
    const holdText = `처리 중이에요! 잠시 후 'ㅇ'를 입력하면 답변을 드릴게요 😊\n(약 ${minute}분 ${now.getSeconds()}초에 접수됨)`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: '2.0',
      template: { outputs: [{ simpleText: { text: holdText } }] },
    }));

    // Fire off to OpenClaw in background — no await, we already responded
    fetch('http://localhost:18789/kakao/skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modifiedBody),
    }).catch((err: unknown) => {
      console.error('[KakaoSkill] Background OpenClaw dispatch failed:', err);
    });
  }

  /**
   * Receives the AI answer from OpenClaw (it POSTs here instead of the
   * original Kakao callbackUrl).  Stores the answer text for the user to
   * retrieve by typing 'ㅇ'.
   */
  private async handleKakaoAnswerCallback(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
  ): Promise<void> {
    const callbackId = url.replace('/kakao/callback/', '');
    const pending = this.kakaoPendingCallbacks.get(callbackId);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', resolve);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

    if (!pending) {
      console.warn(`[KakaoCallback] Unknown callbackId: ${callbackId}`);
      return;
    }
    this.kakaoPendingCallbacks.delete(callbackId);

    let answerText = '';
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      // Kakao callback body: { version, template: { outputs: [{ simpleText: { text } }] } }
      answerText =
        payload?.template?.outputs?.[0]?.simpleText?.text ||
        payload?.template?.outputs?.[0]?.textCard?.text ||
        JSON.stringify(payload);
    } catch {
      answerText = Buffer.concat(chunks).toString() || '(응답 파싱 실패)';
    }

    this.kakaoAnswerStore.set(pending.userKey, answerText);
    console.log(`[KakaoCallback] Stored answer for user ${pending.userKey} (${answerText.length} chars)`);
  }

  /**
   * Synchronous variant — same proxy, useful for testing.
   */
  private async handleKakaoSkillSync(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', resolve);
    });
    const body = Buffer.concat(chunks);

    try {
      const upstream = await fetch('http://localhost:18789/kakao/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (err) {
      console.error('[KakaoProxy] Failed to reach OpenClaw:', err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: '2.0',
        template: { outputs: [{ simpleText: { text: '오류가 발생했어요. 다시 시도해주세요.' } }] },
      }));
    }
  }

  /**
   * Handle Browser Recording MCP endpoint
   */
  private async handleBrowserRecordingEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    if (!this.isMCPServerEnabled('browser-recording')) {
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        error: 'Browser Recording MCP server is not enabled. Enable it first using the IPC handler "mcp-server-enable".',
        serverName: 'browser-recording'
      }));
      return;
    }

    if (url === '/browser-recording/tools' && req.method === 'GET') {
      this.handleBrowserRecordingToolsList(res);
      return;
    }

    if (url === '/browser-recording/tools/call' && req.method === 'POST') {
      await this.handleBrowserRecordingToolCall(req, res);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Browser Recording MCP endpoint not found',
      availableEndpoints: [
        '/browser-recording/tools - List available tools',
        '/browser-recording/tools/call - Call a tool'
      ]
    }));
  }

  private handleBrowserRecordingToolsList(res: http.ServerResponse): void {
    const service = this.getBrowserRecordingMCPService();
    const tools = service.listTools();
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  private async handleBrowserRecordingToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
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

      console.log(`🎬 Calling Browser Recording tool: ${tool}`);
      const service = this.getBrowserRecordingMCPService();
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling Browser Recording tool:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  private async handleAICenterEndpoint(req: http.IncomingMessage, res: http.ServerResponse, url: string): Promise<void> {
    if (url === '/ai-center/tools' && req.method === 'GET') {
      const tools = this.getAICenterMCPService().listTools();
      res.writeHead(200);
      res.end(JSON.stringify(tools, null, 2));
      return;
    }

    if (url === '/ai-center/tools/call' && req.method === 'POST') {
      try {
        const body = await this.parseRequestBody(req);
        const { tool, arguments: args } = body;
        if (!tool) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Missing "tool" parameter in request body' }));
          return;
        }
        console.log(`🤖 Calling AI Center tool: ${tool}`);
        const result = await this.getAICenterMCPService().executeTool(tool, args || {});
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, result }, null, 2));
      } catch (error) {
        console.error('Error calling AI Center tool:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'AI Center MCP endpoint not found',
      availableEndpoints: [
        '/ai-center/tools - List available tools',
        '/ai-center/tools/call - Call a tool',
      ],
    }));
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
   * Handle Apps Script tools list
   */
  private handleAppsScriptToolsList(res: http.ServerResponse): void {
    const service = this.getAppsScriptMCPService();
    const tools = service.listTools();
    
    res.writeHead(200);
    res.end(JSON.stringify(tools, null, 2));
  }

  /**
   * Handle Apps Script tool call
   */
  private async handleAppsScriptToolCall(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

      console.log(`📝 Calling Apps Script tool: ${tool}`);

      // Get Apps Script service
      const service = this.getAppsScriptMCPService();

      // Execute the tool
      const result = await service.executeTool(tool, args || {});

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        result
      }, null, 2));
    } catch (error) {
      console.error('Error calling Apps Script tool:', error);
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
      const mcpServers = this.getMCPServersWithMigration();
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
      },
      {
        name: 'apps-script',
        enabled: true, // Enabled by default
        description: 'Apps Script MCP Server - Virtual Filesystem for editing Google Apps Script projects'
      },
      {
        name: 'conversations',
        enabled: true, // Enabled by default for website integration
        description: 'Conversations MCP Server - Store and retrieve chat conversations for egdesk-website'
      },
      {
        name: 'sheets',
        enabled: true, // Enabled by default for spreadsheet data access
        description: 'Google Sheets MCP Server - Read spreadsheet data (headers, ranges, metadata)'
      },
      {
        name: 'user-data',
        enabled: true, // Enabled by default
        description: 'User Data MCP Server - Query and analyze user-imported database tables (Excel, CSV)'
      },
      {
        name: 'financehub',
        enabled: true, // Enabled by default per user preference
        description: 'FinanceHub MCP Server - Query Korean bank accounts and transactions (read-only)'
      },
      {
        name: 'browser-recording',
        enabled: false, // Opt-in: launches Chrome and runs recorded browser automation
        description: 'Browser Recording MCP Server - List and replay saved EGDesk browser recorder tests with optional dates'
      },
      {
        name: 'korean-law',
        enabled: true, // Enabled by default
        description: 'Korean Law MCP Server - Search laws, precedents, administrative rules via 법제처 API'
      },
      {
        name: 'pageindex',
        enabled: true, // Enabled by default
        description: 'PageIndex MCP Server - Vectorless RAG: index PDFs into hierarchical trees and retrieve by page range'
      }
    ];
  }

  /**
   * Get MCP servers with migration - ensures new services are added to existing configs
   */
  private getMCPServersWithMigration(): MCPServerConfig[] {
    const defaults = this.getDefaultMCPServers();
    const stored = this.store.get('mcpServers') as MCPServerConfig[] | undefined;
    
    // If no stored config, return defaults
    if (!stored || !Array.isArray(stored)) {
      this.store.set('mcpServers', defaults);
      return defaults;
    }
    
    // Check if any new services need to be added
    const storedNames = new Set(stored.map(s => s.name));
    const missingServices = defaults.filter(d => !storedNames.has(d.name));
    
    if (missingServices.length > 0) {
      console.log(`🔄 Migrating MCP config: adding ${missingServices.map(s => s.name).join(', ')}`);
      const migrated = [...stored, ...missingServices];
      this.store.set('mcpServers', migrated);
      return migrated;
    }
    
    return stored;
  }

  /**
   * Check if an MCP server is enabled
   */
  private isMCPServerEnabled(serverName: string): boolean {
    try {
      const mcpServers = this.getMCPServersWithMigration();
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
      const mcpServers = this.getMCPServersWithMigration();
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
      
      const mcpServers = this.getMCPServersWithMigration();
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
      
      const mcpServers = this.getMCPServersWithMigration();
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
      const mcpServers = this.getMCPServersWithMigration();
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
