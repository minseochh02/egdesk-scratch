/**
 * Claude Configuration Manager
 * 
 * Handles Claude Desktop configuration for MCP server integration.
 * This module manages the claude_desktop_config.json file.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeConfigResult {
  success: boolean;
  error?: string;
}

export interface ClaudeConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
    };
  };
}

export class ClaudeConfigManager {
  private claudeConfigPath: string;
  private serverName: string = 'gmail-sqlite';

  constructor() {
    // Claude Desktop config path varies by platform
    const homeDir = app.getPath('home');
    
    if (process.platform === 'win32') {
      // Windows: %APPDATA%\Claude\claude_desktop_config.json
      this.claudeConfigPath = path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    } else if (process.platform === 'darwin') {
      // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
      this.claudeConfigPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      // Linux: ~/.config/Claude/claude_desktop_config.json
      this.claudeConfigPath = path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
    }
    
    console.log(`📁 Claude config path (${process.platform}):`, this.claudeConfigPath);
  }

  /**
   * Check if Claude Desktop is configured with our MCP server
   */
  public async isConfigured(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return false;
      }

      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      return config.mcpServers?.[this.serverName] !== undefined;
    } catch (error) {
      console.warn('Failed to check Claude configuration:', error);
      return false;
    }
  }

  /**
   * Configure Claude Desktop to use our MCP server
   */
  public async configure(serverPath: string): Promise<ClaudeConfigResult> {
    try {
      console.log('⚙️ Configuring Claude Desktop...');

      // Create Claude config directory if it doesn't exist
      const configDir = path.dirname(this.claudeConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Read existing config or create new one
      let config: ClaudeConfig = { mcpServers: {} };
      if (fs.existsSync(this.claudeConfigPath)) {
        try {
          const existingContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
          config = JSON.parse(existingContent);
          if (!config.mcpServers) {
            config.mcpServers = {};
          }
        } catch (error) {
          console.warn('Failed to parse existing config, creating new one');
          config = { mcpServers: {} };
        }
      }

      // Add our MCP server configuration
      config.mcpServers[this.serverName] = {
        command: 'node',
        args: [serverPath],
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
  public async unconfigure(): Promise<ClaudeConfigResult> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return { success: true }; // Already not configured
      }

      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      if (config.mcpServers?.[this.serverName]) {
        delete config.mcpServers[this.serverName];
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
   * Get the Claude config file path
   */
  public getConfigPath(): string {
    return this.claudeConfigPath;
  }

  /**
   * Get the server name used in configuration
   */
  public getServerName(): string {
    return this.serverName;
  }

  /**
   * Read the current Claude configuration
   */
  public async readConfig(): Promise<ClaudeConfig | null> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return null;
      }

      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error('Failed to read Claude config:', error);
      return null;
    }
  }

  /**
   * Get instructions for manual configuration
   */
  public getInstructions(serverPath: string): string {
    return `
To manually configure Claude Desktop, add this to your config:

{
  "mcpServers": {
    "${this.serverName}": {
      "command": "node",
      "args": ["${serverPath}"]
    }
  }
}

Config file location: ${this.claudeConfigPath}
    `.trim();
  }
}
