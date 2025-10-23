/**
 * MCP Server Manager
 * 
 * Manages the MCP server runtime and provides status information to the UI.
 * This module handles:
 * - Server status monitoring
 * - Runtime management
 * - UI integration
 * 
 * Note: Server creation logic has been moved to server-creator/ folder
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getGmailMCPServerCreator } from '../server-creator';

export interface MCPServerStatus {
  isBuilt: boolean;
  isConfigured: boolean;
  serverPath: string | null;
  configPath: string | null;
  error: string | null;
}

export class MCPServerManager {
  private static instance: MCPServerManager | null = null;
  private serverCreator: ReturnType<typeof getGmailMCPServerCreator>;
  
  private constructor() {
    this.serverCreator = getGmailMCPServerCreator();
  }
  
  public static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }
  
  /**
   * Get the current status of the MCP server
   */
  public async getStatus(): Promise<MCPServerStatus> {
    const result = await this.serverCreator.getStatus();
    if (!result.success) {
      return {
        isBuilt: false,
        isConfigured: false,
        serverPath: null,
        configPath: null,
        error: result.error || 'Unknown error',
      };
    }
    
    return {
      isBuilt: result.status?.isBuilt || false,
      isConfigured: result.status?.isConfigured || false,
      serverPath: result.status?.serverPath || null,
      configPath: result.status?.configPath || null,
      error: null,
    };
  }
  
  /**
   * Build the MCP server
   */
  public async buildServer(): Promise<{ success: boolean; error?: string }> {
    return await this.serverCreator.build();
  }
  
  /**
   * Configure Claude Desktop to use our MCP server
   */
  public async configureClaudeDesktop(): Promise<{ success: boolean; error?: string }> {
    return await this.serverCreator.configureClaude();
  }
  
  /**
   * Remove our MCP server from Claude Desktop configuration
   */
  public async unconfigureClaudeDesktop(): Promise<{ success: boolean; error?: string }> {
    return await this.serverCreator.unconfigureClaude();
  }
  
  /**
   * Get instructions for the user
   */
  public getInstructions(): string {
    return this.serverCreator.getInstructions();
  }
  
  /**
   * Register IPC handlers for the renderer process
   */
  public registerIPCHandlers(): void {
    // Delegate to the server creator
    this.serverCreator.registerIPCHandlers();
    console.log('✅ MCP Server Manager IPC handlers registered (delegated to server creator)');
  }
}

// Export singleton instance getter
export const getMCPServerManager = (): MCPServerManager => MCPServerManager.getInstance();

