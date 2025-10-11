/**
 * Server Builder
 * 
 * Handles the building and management of the MCP server.
 * This module coordinates between build script and configuration.
 */

import { BuildScript, BuildResult } from './build-script';
import { ClaudeConfigManager, ClaudeConfigResult } from './claude-config-manager';

export interface ServerBuilderResult {
  success: boolean;
  error?: string;
  serverPath?: string;
  isConfigured?: boolean;
}

export interface ServerStatus {
  isBuilt: boolean;
  isConfigured: boolean;
  serverPath: string | null;
  configPath: string | null;
  error: string | null;
}

export class ServerBuilder {
  private buildScript: BuildScript;
  private configManager: ClaudeConfigManager;

  constructor() {
    this.buildScript = new BuildScript();
    this.configManager = new ClaudeConfigManager();
  }

  /**
   * Build the MCP server
   */
  public async build(): Promise<BuildResult> {
    return await this.buildScript.build();
  }

  /**
   * Configure Claude Desktop with the built server
   */
  public async configureClaude(): Promise<ClaudeConfigResult> {
    const serverPath = this.buildScript.getServerPath();
    return await this.configManager.configure(serverPath);
  }

  /**
   * Unconfigure Claude Desktop
   */
  public async unconfigureClaude(): Promise<ClaudeConfigResult> {
    return await this.configManager.unconfigure();
  }

  /**
   * Build and configure the server in one operation
   */
  public async buildAndConfigure(): Promise<ServerBuilderResult> {
    try {
      // Build the server
      const buildResult = await this.build();
      if (!buildResult.success) {
        return {
          success: false,
          error: `Build failed: ${buildResult.error}`,
        };
      }

      // Configure Claude Desktop
      const configResult = await this.configureClaude();
      if (!configResult.success) {
        return {
          success: false,
          error: `Configuration failed: ${configResult.error}`,
        };
      }

      return {
        success: true,
        serverPath: buildResult.serverPath,
        isConfigured: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current status of the server
   */
  public async getStatus(): Promise<ServerStatus> {
    const isBuilt = this.buildScript.isBuilt();
    const isConfigured = await this.configManager.isConfigured();

    return {
      isBuilt,
      isConfigured,
      serverPath: isBuilt ? this.buildScript.getServerPath() : null,
      configPath: this.configManager.getConfigPath(),
      error: null,
    };
  }

  /**
   * Check if the server is built
   */
  public isBuilt(): boolean {
    return this.buildScript.isBuilt();
  }

  /**
   * Check if Claude is configured
   */
  public async isConfigured(): Promise<boolean> {
    return await this.configManager.isConfigured();
  }

  /**
   * Get the server path
   */
  public getServerPath(): string {
    return this.buildScript.getServerPath();
  }

  /**
   * Get the config path
   */
  public getConfigPath(): string {
    return this.configManager.getConfigPath();
  }

  /**
   * Get instructions for the user
   */
  public getInstructions(): string {
    return `
To use the Gmail MCP Server with Claude Desktop:

1. Click "Enable in Claude Desktop" button below
2. Restart Claude Desktop
3. You can now ask Claude about your Gmail data!

Example prompts:
- "List all Gmail users in the database"
- "Show me the latest messages for user@quus.cloud"
- "Search for messages about 'invoice'"
- "What are the Gmail statistics?"
    `.trim();
  }

  /**
   * Get manual configuration instructions
   */
  public getManualInstructions(): string {
    return this.configManager.getInstructions(this.buildScript.getServerPath());
  }
}
