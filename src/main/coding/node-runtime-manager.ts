/**
 * Node.js Runtime Manager
 *
 * Manages Node.js and npm runtime for the coding system.
 * Uses Electron's bundled Node.js and handles npm availability.
 */

import { spawn } from 'child_process';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

interface RuntimeInfo {
  nodePath: string;
  npmCommand: string;
  hasSystemNpm: boolean;
  nodeVersion: string;
  npmVersion?: string;
  useBundledNpm: boolean;
}

export class NodeRuntimeManager {
  private runtimeInfo?: RuntimeInfo;
  private bundledNpmPath?: string;

  /**
   * Initialize the runtime manager
   */
  async initialize(): Promise<RuntimeInfo> {
    console.log('🔧 Initializing Node.js runtime manager...');

    // Electron's bundled Node.js
    const nodePath = process.execPath;
    const nodeVersion = process.version;

    console.log(`✅ Using Electron's Node.js: ${nodePath}`);
    console.log(`📦 Node.js version: ${nodeVersion}`);

    // Check for system npm first
    const systemNpmVersion = await this.checkSystemNpm();
    const hasSystemNpm = systemNpmVersion !== null;

    let npmCommand: string;
    let useBundledNpm = false;
    let npmVersion: string | undefined;

    if (hasSystemNpm) {
      console.log(`✅ System npm found: ${systemNpmVersion}`);
      npmCommand = 'npm';
      npmVersion = systemNpmVersion;
    } else {
      console.log('⚠️ System npm not found, setting up bundled npm...');
      npmCommand = await this.setupBundledNpm();
      useBundledNpm = true;
      npmVersion = await this.checkBundledNpmVersion();
      console.log(`✅ Using bundled npm: ${npmVersion}`);
    }

    this.runtimeInfo = {
      nodePath,
      npmCommand,
      hasSystemNpm,
      nodeVersion,
      npmVersion,
      useBundledNpm
    };

    console.log('✅ Runtime manager initialized');
    return this.runtimeInfo;
  }

  /**
   * Get runtime information
   */
  getRuntimeInfo(): RuntimeInfo {
    if (!this.runtimeInfo) {
      throw new Error('Runtime manager not initialized. Call initialize() first.');
    }
    return this.runtimeInfo;
  }

  /**
   * Check if system npm is available
   */
  private async checkSystemNpm(): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn('npm', ['--version'], { shell: true });
      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Check bundled npm version
   */
  private async checkBundledNpmVersion(): Promise<string | undefined> {
    if (!this.bundledNpmPath) {
      return undefined;
    }

    return new Promise((resolve) => {
      const child = spawn(process.execPath, [this.bundledNpmPath!, '--version']);
      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(undefined);
        }
      });

      child.on('error', () => {
        resolve(undefined);
      });
    });
  }

  /**
   * Setup bundled npm
   * First checks if npm is already bundled in resources
   * If not, downloads it to app data directory
   */
  private async setupBundledNpm(): Promise<string> {
    // Check if npm is bundled in app resources
    const resourcesNpmPath = this.checkResourcesNpm();
    if (resourcesNpmPath) {
      console.log('✅ Found npm in app resources');
      this.bundledNpmPath = resourcesNpmPath;
      return resourcesNpmPath;
    }

    // Check if npm already downloaded to app data
    const appDataNpmPath = this.checkAppDataNpm();
    if (appDataNpmPath) {
      console.log('✅ Found npm in app data');
      this.bundledNpmPath = appDataNpmPath;
      return appDataNpmPath;
    }

    // Download npm to app data
    console.log('📥 Downloading npm...');
    const downloadedNpmPath = await this.downloadNpm();
    this.bundledNpmPath = downloadedNpmPath;
    return downloadedNpmPath;
  }

  /**
   * Check if npm exists in app resources (bundled during build)
   */
  private checkResourcesNpm(): string | null {
    try {
      const resourcesPath = process.resourcesPath;
      const npmCliPath = path.join(resourcesPath, 'npm', 'bin', 'npm-cli.js');

      if (fs.existsSync(npmCliPath)) {
        return npmCliPath;
      }

      // Also check for npm-prefix package (lighter alternative)
      const npmPrefixPath = path.join(resourcesPath, 'npm-prefix', 'cli.js');
      if (fs.existsSync(npmPrefixPath)) {
        return npmPrefixPath;
      }

      return null;
    } catch (error) {
      console.error('Error checking resources npm:', error);
      return null;
    }
  }

  /**
   * Check if npm exists in app data directory
   */
  private checkAppDataNpm(): string | null {
    try {
      const appDataPath = app.getPath('userData');
      const npmPath = path.join(appDataPath, 'bundled-npm', 'cli.js');

      if (fs.existsSync(npmPath)) {
        return npmPath;
      }

      return null;
    } catch (error) {
      console.error('Error checking app data npm:', error);
      return null;
    }
  }

  /**
   * Download npm to app data directory
   * Downloads a minimal npm package (npm-programmatic or similar)
   */
  private async downloadNpm(): Promise<string> {
    const appDataPath = app.getPath('userData');
    const npmDir = path.join(appDataPath, 'bundled-npm');

    // Create directory
    if (!fs.existsSync(npmDir)) {
      fs.mkdirSync(npmDir, { recursive: true });
    }

    // For now, create a minimal npm wrapper that uses npx
    // This is a lightweight solution that leverages npx (comes with Node.js 8.2.0+)
    const npmWrapperPath = path.join(npmDir, 'cli.js');

    const wrapperContent = `#!/usr/bin/env node
// Minimal npm wrapper using npx
const { spawn } = require('child_process');
const args = process.argv.slice(2);

// Use npx which comes with modern Node.js
const child = spawn('npx', ['npm@latest', ...args], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code || 0);
});
`;

    fs.writeFileSync(npmWrapperPath, wrapperContent, 'utf-8');
    fs.chmodSync(npmWrapperPath, '755');

    console.log('✅ Created npm wrapper using npx');
    return npmWrapperPath;
  }

  /**
   * Spawn a command using the managed runtime
   */
  spawn(command: 'node' | 'npm', args: string[], options: any = {}) {
    if (!this.runtimeInfo) {
      throw new Error('Runtime manager not initialized');
    }

    if (command === 'node') {
      // Use Electron's Node.js
      return spawn(this.runtimeInfo.nodePath, args, options);
    } else if (command === 'npm') {
      // Use npm (system or bundled)
      if (this.runtimeInfo.hasSystemNpm) {
        return spawn('npm', args, { ...options, shell: true });
      } else {
        // Use bundled npm via Electron's Node.js
        return spawn(this.runtimeInfo.nodePath, [this.runtimeInfo.npmCommand, ...args], options);
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Get npm command string for spawning
   */
  getNpmCommandString(): { command: string; isSystemNpm: boolean } {
    if (!this.runtimeInfo) {
      throw new Error('Runtime manager not initialized');
    }

    return {
      command: this.runtimeInfo.hasSystemNpm ? 'npm' : this.runtimeInfo.npmCommand,
      isSystemNpm: this.runtimeInfo.hasSystemNpm
    };
  }
}

// Singleton instance
let runtimeManagerInstance: NodeRuntimeManager | null = null;

export function getNodeRuntimeManager(): NodeRuntimeManager {
  if (!runtimeManagerInstance) {
    runtimeManagerInstance = new NodeRuntimeManager();
  }
  return runtimeManagerInstance;
}
