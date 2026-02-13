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
  private stdioProxyPath: string;

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
    
    // Path to stdio proxy (will be installed to app resources)
    const appPath = app.getAppPath();
    this.stdioProxyPath = path.join(appPath, 'mcp-stdio-proxy.js');
    
    console.log(`📁 Claude config path (${process.platform}):`, this.claudeConfigPath);
    console.log(`📁 Stdio proxy path:`, this.stdioProxyPath);
  }

  /**
   * Check if Claude Desktop is configured with any EGDesk MCP servers
   */
  public async isConfigured(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return false;
      }

      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Check for any EGDesk service
      const egdeskServices = [
        'egdesk-user-data',
        'egdesk-gmail',
        'egdesk-sheets',
        'egdesk-apps-script',
        'egdesk-file-conversion',
        this.serverName // Legacy
      ];

      return egdeskServices.some(service => config.mcpServers?.[service] !== undefined);
    } catch (error) {
      console.warn('Failed to check Claude configuration:', error);
      return false;
    }
  }

  /**
   * Ensure stdio proxy exists and is up-to-date
   */
  private async ensureStdioProxy(): Promise<void> {
    // Copy stdio proxy from resources if it doesn't exist or is outdated
    const resourcesPath = process.resourcesPath || path.join(app.getAppPath(), '..');
    const sourceProxyPath = path.join(resourcesPath, 'mcp-stdio-proxy.js');
    
    // If proxy doesn't exist in app resources, copy from source
    if (!fs.existsSync(this.stdioProxyPath) && fs.existsSync(sourceProxyPath)) {
      console.log('📋 Copying stdio proxy to app resources...');
      fs.copyFileSync(sourceProxyPath, this.stdioProxyPath);
    }
    
    // Make sure it's executable
    if (fs.existsSync(this.stdioProxyPath)) {
      fs.chmodSync(this.stdioProxyPath, 0o755);
    }
  }

  /**
   * Configure Claude Desktop to use our MCP server with all available services
   */
  public async configure(serverPath: string): Promise<ClaudeConfigResult> {
    try {
      console.log('⚙️ Configuring Claude Desktop with stdio proxy...');

      // Ensure stdio proxy exists
      await this.ensureStdioProxy();

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

      // Add all MCP services via stdio proxy
      const services = [
        { name: 'egdesk-user-data', service: 'user-data', description: 'User imported data (Excel, CSV)' },
        { name: 'egdesk-gmail', service: 'gmail', description: 'Gmail operations' },
        { name: 'egdesk-sheets', service: 'sheets', description: 'Google Sheets sync' },
        { name: 'egdesk-apps-script', service: 'apps-script', description: 'Google Apps Script' },
        { name: 'egdesk-file-conversion', service: 'file-conversion', description: 'File format conversion' },
      ];

      for (const { name, service } of services) {
        config.mcpServers[name] = {
          command: 'node',
          args: [this.stdioProxyPath, service],
        };
        console.log(`  ✓ Added ${name}`);
      }

      // Write the updated config
      fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log('✅ Claude Desktop configured with all EGDesk MCP services');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to configure Claude Desktop:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Remove all EGDesk MCP servers from Claude Desktop configuration
   */
  public async unconfigure(): Promise<ClaudeConfigResult> {
    try {
      if (!fs.existsSync(this.claudeConfigPath)) {
        return { success: true }; // Already not configured
      }

      const configContent = fs.readFileSync(this.claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Remove all EGDesk services
      const egdeskServices = [
        'egdesk-user-data',
        'egdesk-gmail', 
        'egdesk-sheets',
        'egdesk-apps-script',
        'egdesk-file-conversion',
        this.serverName // Legacy name
      ];

      let removedCount = 0;
      for (const serviceName of egdeskServices) {
        if (config.mcpServers?.[serviceName]) {
          delete config.mcpServers[serviceName];
          removedCount++;
          console.log(`  ✓ Removed ${serviceName}`);
        }
      }

      if (removedCount > 0) {
        fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`✅ Removed ${removedCount} EGDesk MCP service(s) from Claude Desktop`);
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
    "egdesk-user-data": {
      "command": "node",
      "args": ["${this.stdioProxyPath}", "user-data"]
    },
    "egdesk-gmail": {
      "command": "node",
      "args": ["${this.stdioProxyPath}", "gmail"]
    },
    "egdesk-sheets": {
      "command": "node",
      "args": ["${this.stdioProxyPath}", "sheets"]
    }
  }
}

Config file location: ${this.claudeConfigPath}

The stdio proxy connects to your local HTTP MCP server at localhost:3100.
    `.trim();
  }
}
