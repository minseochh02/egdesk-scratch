/**
 * MCP Server Manager
 * 
 * Manages the MCP server setup and configuration for Claude Desktop integration.
 * This module handles:
 * - Building the MCP server
 * - Configuring Claude Desktop
 * - Providing status information to the UI
 */

import { app, ipcMain } from 'electron';
import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MCPServerStatus {
  isBuilt: boolean;
  isConfigured: boolean;
  serverPath: string | null;
  configPath: string | null;
  error: string | null;
}

export class MCPServerManager {
  private static instance: MCPServerManager | null = null;
  
  private serverPath: string;
  private distPath: string;
  private claudeConfigPath: string;
  
  private constructor() {
    // Paths
    this.distPath = path.join(app.getAppPath(), 'dist-mcp');
    this.serverPath = path.join(this.distPath, 'server.js');
    
    // Claude Desktop config path (macOS)
    const homeDir = app.getPath('home');
    this.claudeConfigPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
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
    const isBuilt = fs.existsSync(this.serverPath);
    const isConfigured = await this.isClaudeConfigured();
    
    return {
      isBuilt,
      isConfigured,
      serverPath: isBuilt ? this.serverPath : null,
      configPath: this.claudeConfigPath,
      error: null,
    };
  }
  
  /**
   * Build the MCP server
   */
  public async buildServer(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔨 Building MCP server...');
      
      // Create dist directory if it doesn't exist
      if (!fs.existsSync(this.distPath)) {
        fs.mkdirSync(this.distPath, { recursive: true });
      }
      
      // Get the source file path
      const sourcePath = path.join(app.getAppPath(), 'src', 'main', 'mcp', 'server.ts');
      
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }
      
      // Compile TypeScript to JavaScript
      const tscCommand = `npx tsc "${sourcePath}" --outDir "${this.distPath}" --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node`;
      
      execSync(tscCommand, {
        cwd: app.getAppPath(),
        stdio: 'pipe',
      });
      
      // Make the output executable
      if (fs.existsSync(this.serverPath)) {
        fs.chmodSync(this.serverPath, '755');
        console.log('✅ MCP server built successfully');
        return { success: true };
      } else {
        throw new Error('Server file was not created');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to build MCP server:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Check if Claude Desktop is configured with our MCP server
   */
  private async isClaudeConfigured(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return false;
      }
      
      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      return config.mcpServers?.['gmail-sqlite'] !== undefined;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Configure Claude Desktop to use our MCP server
   */
  public async configureClaudeDesktop(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('⚙️ Configuring Claude Desktop...');
      
      // Ensure the server is built
      if (!fs.existsSync(this.serverPath)) {
        const buildResult = await this.buildServer();
        if (!buildResult.success) {
          throw new Error(`Failed to build server: ${buildResult.error}`);
        }
      }
      
      // Create Claude config directory if it doesn't exist
      const configDir = path.dirname(this.claudeConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Read existing config or create new one
      let config: any = { mcpServers: {} };
      if (fs.existsSync(this.claudeConfigPath)) {
        try {
          const existingContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
          config = JSON.parse(existingContent);
          if (!config.mcpServers) {
            config.mcpServers = {};
          }
        } catch (error) {
          console.warn('Failed to parse existing config, creating new one');
        }
      }
      
      // Add our MCP server configuration
      config.mcpServers['gmail-sqlite'] = {
        command: 'node',
        args: [this.serverPath],
      };
      
      // Write the updated config
      fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      
      console.log('✅ Claude Desktop configured successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to configure Claude Desktop:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Remove our MCP server from Claude Desktop configuration
   */
  public async unconfigureClaudeDesktop(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return { success: true }; // Already not configured
      }
      
      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.['gmail-sqlite']) {
        delete config.mcpServers['gmail-sqlite'];
        fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log('✅ Removed from Claude Desktop configuration');
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to unconfigure Claude Desktop:', errorMessage);
      return { success: false, error: errorMessage };
    }
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
   * Register IPC handlers for the renderer process
   */
  public registerIPCHandlers(): void {
    // Get MCP server status
    ipcMain.handle('mcp-server-get-status', async () => {
      try {
        const status = await this.getStatus();
        return { success: true, status };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
    
    // Build MCP server
    ipcMain.handle('mcp-server-build', async () => {
      return await this.buildServer();
    });
    
    // Configure Claude Desktop
    ipcMain.handle('mcp-server-configure-claude', async () => {
      return await this.configureClaudeDesktop();
    });
    
    // Unconfigure Claude Desktop
    ipcMain.handle('mcp-server-unconfigure-claude', async () => {
      return await this.unconfigureClaudeDesktop();
    });
    
    // Get instructions
    ipcMain.handle('mcp-server-get-instructions', () => {
      return {
        success: true,
        instructions: this.getInstructions(),
      };
    });
    
    console.log('✅ MCP Server Manager IPC handlers registered');
  }
}

// Export singleton instance getter
export const getMCPServerManager = (): MCPServerManager => MCPServerManager.getInstance();

