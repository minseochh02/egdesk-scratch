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
import * as os from 'os';

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

      // Check for npm bundled in resources/npm directory
      const npmCliPath = path.join(resourcesPath, 'npm', 'bin', 'npm-cli.js');
      console.log(`  Checking for npm at: ${npmCliPath}`);

      if (fs.existsSync(npmCliPath)) {
        console.log(`  ✅ Found bundled npm at: ${npmCliPath}`);
        return npmCliPath;
      }

      // Fallback: check for npm-prefix package (lighter alternative)
      const npmPrefixPath = path.join(resourcesPath, 'npm-prefix', 'cli.js');
      if (fs.existsSync(npmPrefixPath)) {
        console.log(`  ✅ Found npm-prefix at: ${npmPrefixPath}`);
        return npmPrefixPath;
      }

      console.log('  ⚠️ No bundled npm found in resources');
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
   * Downloads the full npm package from the registry
   */
  private async downloadNpm(): Promise<string> {
    const appDataPath = app.getPath('userData');
    const npmDir = path.join(appDataPath, 'bundled-npm');

    console.log('📥 Downloading npm to app data directory...');
    console.log(`   Target: ${npmDir}`);

    // Create directory
    if (!fs.existsSync(npmDir)) {
      fs.mkdirSync(npmDir, { recursive: true });
    }

    const npmVersion = '10.9.2'; // Use a stable npm version
    const tarballUrl = `https://registry.npmjs.org/npm/-/npm-${npmVersion}.tgz`;
    const tarballPath = path.join(appDataPath, 'npm.tgz');

    try {
      // Download tarball
      console.log(`   Downloading npm ${npmVersion}...`);
      await this.downloadFile(tarballUrl, tarballPath);

      // Extract tarball
      console.log('   Extracting...');
      await this.extractTarball(tarballPath, npmDir);

      // Clean up tarball
      fs.unlinkSync(tarballPath);

      const npmCliPath = path.join(npmDir, 'bin', 'npm-cli.js');

      if (!fs.existsSync(npmCliPath)) {
        throw new Error('npm-cli.js not found after extraction');
      }

      console.log('✅ npm downloaded successfully');
      return npmCliPath;
    } catch (error) {
      console.error('❌ Failed to download npm:', error);

      // Fallback: create error message wrapper
      const errorWrapperPath = path.join(npmDir, 'cli.js');
      const errorContent = `#!/usr/bin/env node
console.error('ERROR: npm is not available.');
console.error('Please install Node.js and npm from https://nodejs.org/');
process.exit(1);
`;
      fs.writeFileSync(errorWrapperPath, errorContent.replace(/\r?\n/g, os.EOL), 'utf-8');
      return errorWrapperPath;
    }
  }

  /**
   * Download a file from URL
   */
  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          return this.downloadFile(response.headers.location!, dest)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      }).on('error', reject);
    });
  }

  /**
   * Extract tarball to directory
   */
  private extractTarball(tarballPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');

      // Ensure dest directory exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Use tar command to extract
      exec(
        `tar -xzf "${tarballPath}" -C "${destDir}" --strip-components=1`,
        (error: any, stdout: any, stderr: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
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
