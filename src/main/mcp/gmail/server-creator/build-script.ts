/**
 * Build Script for Gmail MCP Server
 * 
 * Compiles TypeScript to JavaScript for standalone execution.
 * This is the TypeScript version of the build-mcp.js script.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BuildResult {
  success: boolean;
  error?: string;
  serverPath?: string;
}

export class BuildScript {
  private distPath: string;
  private serverPath: string;
  private sourcePath: string;

  constructor() {
    // Paths
    this.distPath = path.join(app.getAppPath(), 'dist-mcp');
    this.serverPath = path.join(this.distPath, 'server.js');
    this.sourcePath = path.join(app.getAppPath(), 'src', 'main', 'mcp', 'server.ts');
  }

  /**
   * Build the MCP server
   */
  public async build(): Promise<BuildResult> {
    try {
      console.log('📦 Building Gmail MCP Server...');

      // Create dist directory if it doesn't exist
      if (!fs.existsSync(this.distPath)) {
        fs.mkdirSync(this.distPath, { recursive: true });
      }

      // Check if source file exists
      if (!fs.existsSync(this.sourcePath)) {
        throw new Error(`Source file not found: ${this.sourcePath}`);
      }

      // Compile TypeScript
      console.log('🔨 Compiling TypeScript...');
      const tscCommand = `npx tsc "${this.sourcePath}" --outDir "${this.distPath}" --module commonjs --target es2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node`;
      
      execSync(tscCommand, {
        cwd: app.getAppPath(),
        stdio: 'pipe',
      });

      // Make the output executable
      if (fs.existsSync(this.serverPath)) {
        fs.chmodSync(this.serverPath, '755');
        console.log('✅ Made server executable');
      } else {
        throw new Error('Server file was not created');
      }

      console.log('✅ TypeScript compiled successfully');
      console.log(`\n✨ Build complete!`);
      console.log(`📍 MCP Server: ${this.serverPath}`);

      return {
        success: true,
        serverPath: this.serverPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ TypeScript compilation failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if the server is already built
   */
  public isBuilt(): boolean {
    return fs.existsSync(this.serverPath);
  }

  /**
   * Get the server path
   */
  public getServerPath(): string {
    return this.serverPath;
  }

  /**
   * Get the dist directory path
   */
  public getDistPath(): string {
    return this.distPath;
  }

  /**
   * Get the source file path
   */
  public getSourcePath(): string {
    return this.sourcePath;
  }

  /**
   * Get instructions for manual configuration
   */
  public getInstructions(): string {
    return `
To manually configure Claude Desktop, add this to your config:

{
  "mcpServers": {
    "gmail-sqlite": {
      "command": "node",
      "args": ["${this.serverPath}"]
    }
  }
}

Config file location: ~/Library/Application Support/Claude/claude_desktop_config.json
    `.trim();
  }
}
