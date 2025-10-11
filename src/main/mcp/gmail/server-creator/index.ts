/**
 * Gmail MCP Server Creator
 * 
 * Main orchestrator for creating and managing the Gmail MCP server.
 * This module provides a unified interface for all server creation operations.
 */

import { ipcMain } from 'electron';
import { ServerBuilder, ServerBuilderResult, ServerStatus } from './server-builder';
import { BuildScript, BuildResult } from './build-script';
import { ClaudeConfigManager, ClaudeConfigResult } from './claude-config-manager';

export class GmailMCPServerCreator {
  private static instance: GmailMCPServerCreator | null = null;
  private serverBuilder: ServerBuilder;
  private buildScript: BuildScript;
  private configManager: ClaudeConfigManager;

  private constructor() {
    this.serverBuilder = new ServerBuilder();
    this.buildScript = new BuildScript();
    this.configManager = new ClaudeConfigManager();
  }

  public static getInstance(): GmailMCPServerCreator {
    if (!GmailMCPServerCreator.instance) {
      GmailMCPServerCreator.instance = new GmailMCPServerCreator();
    }
    return GmailMCPServerCreator.instance;
  }

  /**
   * Get the current status of the MCP server
   */
  public async getStatus(): Promise<{ success: boolean; status?: ServerStatus; error?: string }> {
    try {
      const status = await this.serverBuilder.getStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build the MCP server
   */
  public async build(): Promise<BuildResult> {
    return await this.serverBuilder.build();
  }

  /**
   * Configure Claude Desktop
   */
  public async configureClaude(): Promise<ClaudeConfigResult> {
    return await this.serverBuilder.configureClaude();
  }

  /**
   * Unconfigure Claude Desktop
   */
  public async unconfigureClaude(): Promise<ClaudeConfigResult> {
    return await this.serverBuilder.unconfigureClaude();
  }

  /**
   * Build and configure the server in one operation
   */
  public async buildAndConfigure(): Promise<ServerBuilderResult> {
    return await this.serverBuilder.buildAndConfigure();
  }

  /**
   * Get instructions for the user
   */
  public getInstructions(): string {
    return this.serverBuilder.getInstructions();
  }

  /**
   * Get manual configuration instructions
   */
  public getManualInstructions(): string {
    return this.serverBuilder.getManualInstructions();
  }

  /**
   * Register IPC handlers for the renderer process
   */
  public registerIPCHandlers(): void {
    // Get MCP server status
    ipcMain.handle('mcp-server-get-status', async () => {
      return await this.getStatus();
    });

    // Build MCP server
    ipcMain.handle('mcp-server-build', async () => {
      return await this.build();
    });

    // Configure Claude Desktop
    ipcMain.handle('mcp-server-configure-claude', async () => {
      return await this.configureClaude();
    });

    // Unconfigure Claude Desktop
    ipcMain.handle('mcp-server-unconfigure-claude', async () => {
      return await this.unconfigureClaude();
    });

    // Build and configure in one operation
    ipcMain.handle('mcp-server-build-and-configure', async () => {
      return await this.buildAndConfigure();
    });

    // Get instructions
    ipcMain.handle('mcp-server-get-instructions', () => {
      return {
        success: true,
        instructions: this.getInstructions(),
      };
    });

    // Get manual instructions
    ipcMain.handle('mcp-server-get-manual-instructions', () => {
      return {
        success: true,
        instructions: this.getManualInstructions(),
      };
    });

    console.log('✅ Gmail MCP Server Creator IPC handlers registered');
  }
}

// Export singleton instance getter
export const getGmailMCPServerCreator = (): GmailMCPServerCreator => GmailMCPServerCreator.getInstance();

// Export individual components for direct access if needed
export { ServerBuilder } from './server-builder';
export { BuildScript } from './build-script';
export { ClaudeConfigManager } from './claude-config-manager';
export type { ServerBuilderResult, ServerStatus } from './server-builder';
export type { BuildResult } from './build-script';
export type { ClaudeConfigResult } from './claude-config-manager';
