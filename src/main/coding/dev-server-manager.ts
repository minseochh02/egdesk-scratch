import { ChildProcess, spawn, execSync } from 'child_process';
import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getProjectRegistry } from './project-registry';
import { getStore } from '../storage';

/**
 * Dynamically load setupNextApiPlugin from the user's project node_modules
 * This avoids npx issues in production
 */
async function loadNextApiPluginFromProject(projectPath: string): Promise<any> {
  try {
    // Construct path to the plugin in the user's project node_modules
    const pluginPath = path.join(projectPath, 'node_modules', '@egdesk', 'next-api-plugin', 'dist', 'index.js');

    if (!fs.existsSync(pluginPath)) {
      console.error(`Plugin not found at ${pluginPath}`);
      return null;
    }

    // Dynamically require the plugin from the user's project
    const plugin = require(pluginPath);
    return plugin.setupNextApiPlugin;
  } catch (error) {
    console.error('Failed to load @egdesk/next-api-plugin from project:', error);
    return null;
  }
}

interface ProjectInfo {
  type: 'nextjs' | 'vite' | 'react' | 'unknown';
  hasPackageJson: boolean;
  hasNodeModules: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm';
}

interface ServerInfo {
  port: number;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  process: ChildProcess | null;
  projectPath: string;
}

export class DevServerManager {
  private servers: Map<string, ServerInfo> = new Map();
  private portRange = { start: 3000, end: 3100 };
  private tunnelId: string | null = null;
  private runtimeInitialized: boolean = false;

  constructor() {
    this.setupIpcHandlers();
    this.initializeRuntime();
  }

  /**
   * Normalize line endings for the current platform
   */
  private normalizeLineEndings(content: string): string {
    // Replace all line endings with platform-specific ones
    return content.replace(/\r?\n/g, os.EOL);
  }

  /**
   * Get the plugin path that works in both dev and production
   * In production (ASAR), we need to use app.getAppPath() and handle unpacked resources
   */
  private getPluginPath(pluginName: string): string {
    const isProduction = app.isPackaged;

    if (isProduction) {
      // In production, plugins should be in resources/app.asar.unpacked/packages
      // or resources/app/packages (depending on build config)
      const appPath = app.getAppPath();

      // Try multiple possible locations
      const possiblePaths = [
        // Unpacked resources (preferred for node_modules and native modules)
        path.join(path.dirname(appPath), 'app.asar.unpacked', 'packages', pluginName),
        // Regular app path
        path.join(appPath, 'packages', pluginName),
        // One level up from app.asar
        path.join(path.dirname(appPath), 'packages', pluginName),
        // Resources folder directly
        path.join(process.resourcesPath, 'packages', pluginName),
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          console.log(`✓ Found plugin at: ${testPath}`);
          return testPath;
        }
      }

      console.error(`⚠️ Plugin ${pluginName} not found in production. Tried:`, possiblePaths);
      return possiblePaths[0]; // Return first path as fallback
    } else {
      // In development, use __dirname
      return path.join(__dirname, '../../packages', pluginName);
    }
  }

  /**
   * Initialize Node.js runtime (no longer needed - using system npm)
   */
  private async initializeRuntime(): Promise<void> {
    this.runtimeInitialized = true;
    console.log('✅ Using system Node.js and npm');
  }

  /**
   * Check if Node.js and npm are available (using system installation)
   */
  private async checkNodeInstallation(): Promise<{ hasNode: boolean; hasNpm: boolean; nodeVersion?: string; npmVersion?: string }> {
    try {
      // Check system node and npm
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();

      return {
        hasNode: true,
        hasNpm: true,
        nodeVersion,
        npmVersion
      };
    } catch (error) {
      console.error('Failed to check Node.js installation:', error);
      return {
        hasNode: false,
        hasNpm: false
      };
    }
  }

  /**
   * Kill process running on specific port
   */
  private async killProcessOnPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔪 Attempting to kill process on port ${port}...`);

      const platform = process.platform;
      let command: string;

      if (platform === 'win32') {
        // Windows: Find PID and kill it
        command = `netstat -ano | findstr :${port} && FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${port}') DO taskkill /PID %P /F`;
      } else {
        // macOS/Linux: Use lsof and kill
        command = `lsof -ti:${port} | xargs kill -9 || true`;
      }

      try {
        execSync(command, { encoding: 'utf-8', shell: true, stdio: 'ignore' });
        console.log(`✅ Successfully killed process on port ${port}`);
      } catch (error) {
        // It's ok if no process was found on that port
        console.log(`ℹ️ No process found on port ${port} or already killed`);
      }

      // Give it a moment to fully release the port
      setTimeout(() => resolve(), 500);
    });
  }

  /**
   * Set the tunnel ID for generating Vite base paths
   */
  public setTunnelId(tunnelId: string) {
    this.tunnelId = tunnelId;
    console.log(`DevServerManager: Tunnel ID set to ${tunnelId}`);
  }

  private setupIpcHandlers() {
    ipcMain.handle('dev-server:check-node', async () => {
      try {
        const nodeCheck = await this.checkNodeInstallation();
        return { success: true, ...nodeCheck };
      } catch (error: any) {
        console.error('Failed to check Node.js installation:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:analyze-folder', async (event, folderPath: string) => {
      try {
        const projectInfo = await this.analyzeFolder(folderPath);
        return { success: true, projectInfo };
      } catch (error: any) {
        console.error('Failed to analyze folder:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:start', async (event, folderPath: string) => {
      try {
        const serverInfo = await this.startServer(folderPath);
        // Remove process object before sending through IPC (not serializable)
        const { process, ...serializableInfo } = serverInfo;
        return { success: true, serverInfo: serializableInfo };
      } catch (error: any) {
        console.error('Failed to start dev server:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:stop', async (event, folderPath: string) => {
      try {
        await this.stopServer(folderPath);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to stop dev server:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:get-status', async (event, folderPath: string) => {
      try {
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          // Remove process object before sending through IPC (not serializable)
          const { process, ...serializableInfo } = serverInfo;
          return { success: true, serverInfo: serializableInfo };
        }
        return { success: true, serverInfo: null };
      } catch (error: any) {
        console.error('Failed to get server status:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:get-all', async () => {
      try {
        const allServers = Array.from(this.servers.entries()).map(([path, info]) => {
          // Remove process object before sending through IPC (not serializable)
          const { process, ...serializableInfo } = info;
          return {
            projectPath: path,
            ...serializableInfo
          };
        });
        return { success: true, servers: allServers };
      } catch (error: any) {
        console.error('Failed to get all servers:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:kill-port', async (event, port: number) => {
      try {
        await this.killProcessOnPort(port);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to kill process on port:', error);
        return { success: false, error: error.message };
      }
    });

    // Project registry handlers
    ipcMain.handle('project-registry:get-all', async () => {
      try {
        const projectRegistry = getProjectRegistry();
        const projects = projectRegistry.getAllProjects();
        return { success: true, projects };
      } catch (error: any) {
        console.error('Failed to get projects from registry:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('project-registry:get-project', async (event, projectName: string) => {
      try {
        const projectRegistry = getProjectRegistry();
        const project = projectRegistry.getProject(projectName);
        return { success: true, project };
      } catch (error: any) {
        console.error('Failed to get project from registry:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('project-registry:get-by-path', async (event, folderPath: string) => {
      try {
        const projectRegistry = getProjectRegistry();
        const project = projectRegistry.getProjectByPath(folderPath);
        return { success: true, project };
      } catch (error: any) {
        console.error('Failed to get project by path:', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Check if a folder is empty or only contains hidden files
   */
  private isFolderEmpty(folderPath: string): boolean {
    try {
      const files = fs.readdirSync(folderPath);
      // Filter out hidden files (starting with .)
      const visibleFiles = files.filter(file => !file.startsWith('.'));
      return visibleFiles.length === 0;
    } catch (error) {
      console.error('Failed to check if folder is empty:', error);
      return false;
    }
  }

  /**
   * Initialize a new Next.js project in the given folder
   */
  private async initializeNextJsProject(folderPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Initializing Next.js project in ${folderPath}...`);

      // Use create-next-app with default settings
      // All flags to make it completely non-interactive
      const args = [
        'create-next-app@latest',
        '.',  // Create in current directory
        '--typescript',  // Use TypeScript
        '--tailwind',  // Include Tailwind CSS
        '--eslint',  // Include ESLint
        '--app',  // Use App Router
        '--src-dir',  // Use src/ directory
        '--import-alias', '@/*',  // Set import alias
        '--use-npm',  // Use npm as package manager
        '--no-git',  // Don't initialize git (user may already have it)
        '--skip-install'  // Skip npm install (we'll do it ourselves with better error handling)
      ];

      // Clean environment and add flags to force non-interactive mode
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      // Force non-interactive mode to skip all prompts
      cleanEnv.CI = 'true';  // Tells create-next-app we're in CI mode (no prompts)
      cleanEnv.DISABLE_PROMPTS = 'true';  // Additional safety

      // Use system npx (on Windows, use npx.cmd explicitly)
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const initProcess = spawn(npxCommand, ['create-next-app@latest', ...args.slice(1)], {
        cwd: folderPath,
        env: cleanEnv,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']  // Allow us to pipe input if needed
      });

      // Pipe 'n' (No) to stdin to answer any prompts that might still appear
      // This handles the React Compiler question and any other new prompts
      if (initProcess.stdin) {
        initProcess.stdin.write('n\n');  // Answer No to React Compiler
        initProcess.stdin.end();
      }

      let stdoutOutput = '';
      let errorOutput = '';

      initProcess.stdout?.on('data', (data) => {
        stdoutOutput += data.toString();
        console.log(`Next.js init: ${data}`);
      });

      initProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        if (!data.toString().includes('WARN')) {
          console.error(`Next.js init error: ${data}`);
        }
      });

      initProcess.on('close', async (code) => {
        if (code === 0) {
          console.log('✅ Next.js project initialized successfully');
          console.log('📦 Created files:');
          console.log('  - src/app/page.tsx (Home page)');
          console.log('  - src/app/layout.tsx (Root layout)');
          console.log('  - package.json (Dependencies)');
          console.log('  - tailwind.config.ts (Tailwind configuration)');
          console.log('  - tsconfig.json (TypeScript configuration)');

          // Now install dependencies since we skipped it during create-next-app
          try {
            console.log('📦 Installing dependencies...');
            await this.installDependencies(folderPath, 'npm');
            console.log('✅ Dependencies installed successfully');
            resolve();
          } catch (installError) {
            console.error('Failed to install dependencies:', installError);
            reject(installError);
          }
        } else {
          const errorMsg = `Next.js initialization failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      initProcess.on('error', (error) => {
        console.error('Next.js init process error:', error);
        reject(error);
      });
    });
  }

  private async analyzeFolder(folderPath: string): Promise<ProjectInfo> {
    const packageJsonPath = path.join(folderPath, 'package.json');
    const nodeModulesPath = path.join(folderPath, 'node_modules');

    const hasPackageJson = fs.existsSync(packageJsonPath);
    const hasNodeModules = fs.existsSync(nodeModulesPath);

    let type: ProjectInfo['type'] = 'unknown';
    let packageManager: ProjectInfo['packageManager'] = 'npm';

    if (hasPackageJson) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Detect project type
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        type = 'nextjs';
      } else if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
        type = 'vite';
      } else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
        type = 'react';
      }

      // Detect package manager
      if (fs.existsSync(path.join(folderPath, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      }
    }

    return {
      type,
      hasPackageJson,
      hasNodeModules,
      packageManager
    };
  }

  private async findAvailablePort(): Promise<number> {
    const usedPorts = Array.from(this.servers.values()).map(s => s.port);

    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      if (!usedPorts.includes(port)) {
        return port;
      }
    }

    throw new Error('No available ports in range');
  }

  private async installDependencies(folderPath: string, packageManager: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Installing dependencies in ${folderPath} using ${packageManager}...`);

      // Use --ignore-scripts to prevent install scripts from failing
      // Use --legacy-peer-deps for npm to handle peer dependency conflicts
      const args = packageManager === 'npm'
        ? ['install', '--ignore-scripts', '--legacy-peer-deps']
        : ['install', '--ignore-scripts'];

      // Clean environment - remove NODE_OPTIONS and other problematic variables
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      // Use system package manager (on Windows, use .cmd explicitly)
      const command = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
      const installProcess = spawn(command, args, { cwd: folderPath, shell: true, env: cleanEnv });

      let stdoutOutput = '';
      let errorOutput = '';

      installProcess.stdout?.on('data', (data) => {
        stdoutOutput += data.toString();
        console.log(`Install: ${data}`);
      });

      installProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        // Don't log warnings as errors
        if (!data.toString().includes('WARN')) {
          console.error(`Install error: ${data}`);
        }
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Dependencies installed successfully');
          resolve();
        } else {
          // Provide more context in error message
          const errorMsg = `Installation failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      installProcess.on('error', (error) => {
        console.error('Install process error:', error);
        reject(error);
      });
    });
  }

  /**
   * Install a single package as a dev dependency
   */
  private async installPackage(folderPath: string, packageName: string, packageManager: string, isDev: boolean = true): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Installing ${packageName} in ${folderPath} using ${packageManager}...`);

      // Build install command args based on package manager
      let args: string[];
      if (packageManager === 'npm') {
        args = ['install', isDev ? '--save-dev' : '--save', packageName, '--legacy-peer-deps'];
      } else if (packageManager === 'yarn') {
        args = ['add', isDev ? '--dev' : '', packageName].filter(Boolean);
      } else if (packageManager === 'pnpm') {
        args = ['add', isDev ? '--save-dev' : '', packageName].filter(Boolean);
      } else {
        args = ['install', packageName];
      }

      // Clean environment
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      // Use system package manager (on Windows, use .cmd explicitly)
      const command = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
      const installProcess = spawn(command, args, { cwd: folderPath, shell: true, env: cleanEnv });

      let stdoutOutput = '';
      let errorOutput = '';

      installProcess.stdout?.on('data', (data) => {
        stdoutOutput += data.toString();
        console.log(`Install ${packageName}: ${data}`);
      });

      installProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        if (!data.toString().includes('WARN')) {
          console.error(`Install ${packageName} error: ${data}`);
        }
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`${packageName} installed successfully`);
          resolve();
        } else {
          const errorMsg = `Failed to install ${packageName} (code ${code})\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      installProcess.on('error', (error) => {
        console.error(`Install ${packageName} process error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Ensure @egdesk/vite-api-plugin is installed for Vite projects
   */
  private async ensureViteApiPlugin(folderPath: string, packageManager: string): Promise<void> {
    try {
      const packageJsonPath = path.join(folderPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check if plugin is already installed
      const hasPlugin =
        packageJson.devDependencies?.['@egdesk/vite-api-plugin'] ||
        packageJson.dependencies?.['@egdesk/vite-api-plugin'];

      if (hasPlugin) {
        console.log('✓ @egdesk/vite-api-plugin already installed');
        // Write EGDesk API key to environment file
        this.writeEGDeskEnv(folderPath, 'vite');
        // Still inject into vite.config if needed
        await this.injectViteApiPlugin(folderPath);
        return;
      }

      console.log('📦 Installing @egdesk/vite-api-plugin for API route support...');

      // Get plugin path (works in both dev and production)
      const pluginPath = this.getPluginPath('vite-api-plugin');

      if (fs.existsSync(pluginPath)) {
        // Install from local path
        await this.installPackage(folderPath, `file:${pluginPath}`, packageManager, true);
        console.log('✓ @egdesk/vite-api-plugin installed from local source');

        // Write EGDesk API key to environment file
        this.writeEGDeskEnv(folderPath, 'vite');

        // Inject plugin into vite.config.js
        await this.injectViteApiPlugin(folderPath);
      } else {
        console.warn('⚠️ Local @egdesk/vite-api-plugin not found at', pluginPath);
        console.warn('⚠️ Skipping plugin installation. API routes will need manual setup.');
      }
    } catch (error) {
      console.error('Failed to install @egdesk/vite-api-plugin:', error);
      console.warn('⚠️ Continuing without API plugin. API routes will need manual setup.');
      // Don't throw - continue server startup even if plugin install fails
    }
  }

  /**
   * Ensure @egdesk/next-api-plugin is installed and configured for Next.js projects
   */
  private async ensureNextApiPlugin(folderPath: string, packageManager: string): Promise<void> {
    try {
      const packageJsonPath = path.join(folderPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check if plugin is already installed
      const hasPlugin =
        packageJson.devDependencies?.['@egdesk/next-api-plugin'] ||
        packageJson.dependencies?.['@egdesk/next-api-plugin'];

      if (hasPlugin) {
        console.log('✓ @egdesk/next-api-plugin already installed, updating to latest...');
        // Always update to latest version to get newest features
        await this.installPackage(folderPath, '@egdesk/next-api-plugin@latest', packageManager, true);
        console.log('✓ Updated to latest version');
      } else {
        console.log('📦 Installing @egdesk/next-api-plugin for database proxy support...');
        // Install from npm (published package - more reliable than local path)
        await this.installPackage(folderPath, '@egdesk/next-api-plugin@latest', packageManager, true);
        console.log('✓ @egdesk/next-api-plugin installed from npm');
      }

      // Write EGDesk API key to environment file
      this.writeEGDeskEnv(folderPath, 'nextjs');

      // Run plugin setup to generate middleware and helpers
      await this.setupNextApiPlugin(folderPath);
    } catch (error) {
      console.error('Failed to install @egdesk/next-api-plugin:', error);
      console.warn('⚠️ Continuing without API plugin. Database proxy will need manual setup.');
      // Don't throw - continue server startup even if plugin install fails
    }
  }

  /**
   * Run Next.js plugin setup to generate middleware and helper files
   * Now calls the plugin directly from the project's node_modules instead of using npx
   */
  private async setupNextApiPlugin(folderPath: string): Promise<void> {
    console.log('🔧 Setting up Next.js API plugin...');

    try {
      // Get API key from store
      const store = getStore();
      const mcpConfig = store.get('mcpConfiguration') as any;
      const apiKey = mcpConfig?.tunnel?.apiKey;

      // Try to load and call the setup function directly from the project's node_modules
      const setupFunc = await loadNextApiPluginFromProject(folderPath);

      if (setupFunc) {
        // Call the setup function directly
        console.log('✅ Using direct require of @egdesk/next-api-plugin from project node_modules');
        await setupFunc(folderPath, {
          egdeskUrl: 'http://localhost:8080',
          apiKey: apiKey,
          useProxy: true
        });
        console.log('✓ Next.js API plugin setup complete');
        console.log('✓ Generated: egdesk.config.ts, egdesk-helpers.ts, proxy.ts, src/lib/api.ts');
      } else {
        // Fallback to npx if direct import fails
        console.log('⚠️ Direct require failed, trying npx fallback...');
        await this.setupNextApiPluginViaNpx(folderPath);
      }
    } catch (error) {
      console.error('Setup failed:', error);
      console.warn('⚠️ Please run "npx egdesk-next-setup" manually in your project');
      // Don't throw - just warn and continue
    }
  }

  /**
   * Fallback method to run setup via npx
   */
  private async setupNextApiPluginViaNpx(folderPath: string): Promise<void> {
    return new Promise((resolve) => {
      // Get API key from store
      const store = getStore();
      const mcpConfig = store.get('mcpConfiguration') as any;
      const apiKey = mcpConfig?.tunnel?.apiKey;

      // Build CLI arguments
      const args = ['egdesk-next-setup', '--url', 'http://localhost:8080'];
      if (apiKey) {
        args.push('--api-key', apiKey);
      }

      // Clean environment
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      // Run the CLI via system npx (on Windows, use npx.cmd explicitly)
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const setupProcess = spawn(npxCommand, args, {
        cwd: folderPath,
        shell: true,
        env: cleanEnv
      });

      let stdoutOutput = '';
      let errorOutput = '';

      setupProcess.stdout?.on('data', (data) => {
        stdoutOutput += data.toString();
        console.log(`Next.js setup: ${data}`);
      });

      setupProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        if (!data.toString().includes('WARN')) {
          console.error(`Next.js setup error: ${data}`);
        }
      });

      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✓ Next.js API plugin setup complete (via npx)');
        } else {
          const errorMsg = `Next.js plugin setup failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          console.warn('⚠️ Please run "npx egdesk-next-setup" manually in your project');
        }
        resolve();
      });

      setupProcess.on('error', (error) => {
        console.error('Next.js setup process error:', error);
        console.warn('⚠️ Please run "npx egdesk-next-setup" manually in your project');
        resolve();
      });
    });
  }

  private async injectViteApiPlugin(folderPath: string): Promise<void> {
    try {
      // Find vite.config file (.js, .ts, .mjs, etc.)
      const configFiles = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
      let configPath: string | null = null;

      for (const file of configFiles) {
        const testPath = path.join(folderPath, file);
        if (fs.existsSync(testPath)) {
          configPath = testPath;
          break;
        }
      }

      if (!configPath) {
        console.log('⚠️ No vite.config file found - skipping plugin injection');
        return;
      }

      let configContent = fs.readFileSync(configPath, 'utf-8');

      // Check if plugin is already used in plugins array (look for viteApiPlugin() call)
      const pluginsArrayMatch = configContent.match(/plugins:\s*\[([\s\S]*?)\]/);
      if (pluginsArrayMatch && pluginsArrayMatch[1].includes('viteApiPlugin')) {
        console.log('✓ @egdesk/vite-api-plugin already configured in vite.config');
        return;
      }

      console.log('🔧 Injecting @egdesk/vite-api-plugin into vite.config...');

      // Add import statement
      if (!configContent.includes('@egdesk/vite-api-plugin')) {
        const importLine = "import { viteApiPlugin } from '@egdesk/vite-api-plugin'\n";
        // Insert after last import statement or at the beginning
        const lastImportMatch = configContent.match(/^import .+?$/gm);
        if (lastImportMatch) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          configContent = configContent.replace(lastImport, lastImport + '\n' + importLine);
        } else {
          configContent = importLine + configContent;
        }
      }

      // Add plugin to plugins array
      const pluginsMatch2 = configContent.match(/plugins:\s*\[([\s\S]*?)\]/);
      if (pluginsMatch2 && !pluginsMatch2[1].includes('viteApiPlugin')) {
        const pluginsContent = pluginsMatch2[1].trim();
        const newPluginsContent = pluginsContent
          ? `${pluginsContent},\n    viteApiPlugin({ debug: true, routes: [] })`
          : `viteApiPlugin({ debug: true, routes: [] })`;

        configContent = configContent.replace(
          /plugins:\s*\[([\s\S]*?)\]/,
          `plugins: [\n    ${newPluginsContent}\n  ]`
        );
      }

      fs.writeFileSync(configPath, this.normalizeLineEndings(configContent), 'utf-8');
      console.log('✓ @egdesk/vite-api-plugin injected into vite.config');
    } catch (error) {
      console.error('Failed to inject plugin into vite.config:', error);
      console.warn('⚠️ Please manually add the plugin to your vite.config file');
    }
  }

  private writeEGDeskEnv(folderPath: string, framework: 'vite' | 'nextjs'): void {
    try {
      // Get API key from store
      const store = getStore();
      const mcpConfig = store.get('mcpConfiguration') as any;
      const apiKey = mcpConfig?.tunnel?.apiKey;

      if (!apiKey) {
        console.log('⚠️ No EGDesk API key found - skipping environment file');
        return;
      }

      // Write to .env.local (both Vite and Next.js will automatically load this)
      const envPath = path.join(folderPath, '.env.local');

      // Use framework-specific environment variable prefixes
      const prefix = framework === 'vite' ? 'VITE_' : 'NEXT_PUBLIC_';
      const pluginName = framework === 'vite' ? '@egdesk/vite-api-plugin' : '@egdesk/next-api-plugin';

      // Read existing .env.local if it exists
      let existingContent = '';
      let existingLines: string[] = [];
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, 'utf-8');
        existingLines = existingContent.split('\n');
      }

      // Parse existing variables (preserve non-EGDesk variables)
      const filteredLines: string[] = [];
      let inEGDeskSection = false;

      for (const line of existingLines) {
        // Check if we're entering EGDesk section
        if (line.includes('# EGDesk Configuration')) {
          inEGDeskSection = true;
          continue; // Skip this line, we'll add fresh EGDesk section
        }

        // Check if we're exiting EGDesk section (empty line after EGDesk vars)
        if (inEGDeskSection && line.trim() === '') {
          inEGDeskSection = false;
          continue; // Skip the trailing empty line
        }

        // Skip lines within EGDesk section
        if (inEGDeskSection) {
          continue;
        }

        // Skip individual EGDesk variables if not in section (fallback)
        if (line.includes('EGDESK_API_URL') || line.includes('EGDESK_API_KEY')) {
          continue;
        }

        // Preserve all other lines
        filteredLines.push(line);
      }

      // Remove trailing empty lines from preserved content
      while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === '') {
        filteredLines.pop();
      }

      // Build new content with EGDesk section
      const egdeskSection = [
        '# EGDesk Configuration - Auto-generated',
        `# This file is used by ${pluginName} for user-data access`,
        '',
        `${prefix}EGDESK_API_URL=http://localhost:8080`,
        `${prefix}EGDESK_API_KEY=${apiKey}`,
        ''
      ];

      // Combine: existing vars + EGDesk section
      const finalContent = [
        ...filteredLines,
        ...(filteredLines.length > 0 ? [''] : []), // Add separator if there's existing content
        ...egdeskSection
      ].join('\n');

      fs.writeFileSync(envPath, this.normalizeLineEndings(finalContent), 'utf-8');
      console.log('✓ EGDesk environment variables written to .env.local (preserved existing variables)');
    } catch (error) {
      console.error('Failed to write EGDesk environment file:', error);
    }
  }

  /**
   * Write EGDesk development guide README to Next.js project folder
   * This helps AI assistants understand how to handle basePath in client-side code
   */
  private writeEGDeskReadme(folderPath: string): void {
    try {
      const readmePath = path.join(folderPath, 'EGDESK-README.md');

      const readmeContent = `# EGDesk Development Guide

This Next.js project is running in EGDesk with tunneling support.

## ⚠️ Important: Client-Side API Calls

**Next.js basePath does NOT automatically apply to client-side \`fetch()\` calls.**

This is a known Next.js limitation that affects all projects using \`basePath\`.

### ❌ Wrong - Will Return 404

\`\`\`javascript
// This will fail when running through EGDesk tunnel
fetch('/api/transactions')
\`\`\`

### ✅ Correct - Use Environment Variable

\`\`\`javascript
const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
fetch(\`\${basePath}/api/transactions\`)
\`\`\`

## Recommended: Create API Wrapper Function

Create a reusable wrapper in \`lib/api.ts\`:

\`\`\`typescript
// lib/api.ts
const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';

export async function apiFetch(path: string, options?: RequestInit) {
  // Automatically prepend basePath to relative URLs
  const url = path.startsWith('/') && !path.startsWith('//')
    ? \`\${basePath}\${path}\`
    : path;
  return fetch(url, options);
}
\`\`\`

Then use it everywhere instead of \`fetch()\`:

\`\`\`typescript
import { apiFetch } from '@/lib/api';

// In your components
const response = await apiFetch('/api/transactions');
const data = await response.json();
\`\`\`

## Environment Variables Provided by EGDesk

EGDesk automatically sets these when starting your dev server:

- \`NEXT_PUBLIC_EGDESK_BASE_PATH\` - The tunnel path prefix (e.g., \`/t/abc123/p/my-app\`)
- \`NEXT_PUBLIC_EGDESK_API_KEY\` - Your EGDesk API key (for database/sheets access)
- \`NEXT_PUBLIC_EGDESK_API_URL\` - EGDesk API endpoint (usually \`http://localhost:8080\`)

## What Works Automatically

✅ Next.js routing (\`router.push()\`, \`<Link>\`, etc.)
✅ Server-side rendering and API routes
✅ Static assets (\`/_next/static/...\`)
✅ Images via \`next/image\`

❌ Client-side \`fetch()\` calls - **You must handle this manually**

## For AI Assistants

When building features for this Next.js project:

1. **Always create \`lib/api.ts\` wrapper** at the start of the project
2. **Use \`apiFetch()\` instead of \`fetch()\`** for all API calls in components
3. **Never use bare \`fetch('/api/...')\`** - it will fail in EGDesk tunnel
4. **Inform the user** about this limitation when implementing API features

## Troubleshooting

### API calls return 404

Check if you're using \`fetch()\` directly instead of the wrapper:

\`\`\`javascript
// ❌ This will fail
fetch('/api/users')

// ✅ Use this instead
const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
fetch(\`\${basePath}/api/users\`)

// ✅ Or better, use the wrapper
apiFetch('/api/users')
\`\`\`

### Assets (fonts, CSS) return 404

This usually means the basePath configuration wasn't applied correctly.
EGDesk automatically configures this - try restarting the dev server.

---

*This file is auto-generated by EGDesk. Do not modify.*
`;

      fs.writeFileSync(readmePath, this.normalizeLineEndings(readmeContent), 'utf-8');
      console.log('✓ EGDesk development guide written to EGDESK-README.md');
    } catch (error) {
      console.error('Failed to write EGDesk README:', error);
    }
  }

  /**
   * Backup next.config.js before modification
   */
  private async backupNextConfig(folderPath: string): Promise<void> {
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

    for (const file of configFiles) {
      const configPath = path.join(folderPath, file);
      const backupPath = path.join(folderPath, `${file}.egdesk-backup`);

      if (fs.existsSync(configPath)) {
        await fs.promises.copyFile(configPath, backupPath);
        console.log(`📦 Backed up ${file} to ${file}.egdesk-backup`);
        return;
      }
    }

    console.log('ℹ️ No next.config found, will create one');
  }

  /**
   * Configure next.config.js to read basePath from environment variable
   */
  private async configureNextJsBasePath(folderPath: string): Promise<void> {
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
    let configPath: string | null = null;

    // Find existing config
    for (const file of configFiles) {
      const filePath = path.join(folderPath, file);
      if (fs.existsSync(filePath)) {
        configPath = filePath;
        break;
      }
    }

    // Create new config if none exists
    if (!configPath) {
      configPath = path.join(folderPath, 'next.config.js');
      const newConfig = `/** @type {import('next').NextConfig} */
console.log('🔍 DEBUG next.config.js: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);

const nextConfig = {
  basePath: process.env.EGDESK_BASE_PATH || '',
  assetPrefix: process.env.EGDESK_BASE_PATH || '',
};

console.log('🔍 DEBUG next.config.js: basePath =', nextConfig.basePath);
console.log('🔍 DEBUG next.config.js: assetPrefix =', nextConfig.assetPrefix);

export default nextConfig;
`;
      await fs.promises.writeFile(configPath, this.normalizeLineEndings(newConfig), 'utf8');
      console.log(`✅ Created next.config.js with dynamic basePath`);
      return;
    }

    // Modify existing config to read from environment variable
    let content = await fs.promises.readFile(configPath, 'utf8');

    // Check if already configured
    if (content.includes('EGDESK_BASE_PATH')) {
      console.log('✓ next.config.js already configured for dynamic basePath');
      return;
    }

    // Add debug logging before the config
    const debugLogging = `\nconsole.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);\n`;

    // Find import statement or beginning of file to insert debug
    const firstImportMatch = content.match(/^import\s/m);
    if (firstImportMatch && firstImportMatch.index !== undefined) {
      // Insert after imports
      const lastImportIndex = content.lastIndexOf('import');
      const afterImportLine = content.indexOf('\n', lastImportIndex) + 1;
      content = content.slice(0, afterImportLine) + debugLogging + content.slice(afterImportLine);
    } else {
      // Insert at beginning
      content = debugLogging + content;
    }

    // Simple injection: add to config object
    // Match: const nextConfig = { or const nextConfig: NextConfig = {
    const configObjectMatch = content.match(/(const\s+\w+Config\s*:\s*\w+\s*=\s*\{)|(const\s+\w+Config\s*=\s*\{)/);

    if (configObjectMatch) {
      const matchedPattern = configObjectMatch[0];
      const insertPoint = configObjectMatch.index! + matchedPattern.length;
      const injection = `
  basePath: process.env.EGDESK_BASE_PATH || '',
  assetPrefix: process.env.EGDESK_BASE_PATH || '',`;

      content = content.slice(0, insertPoint) + injection + content.slice(insertPoint);

      // Add logging after the config object
      const configEndMatch = content.indexOf('};', insertPoint);
      if (configEndMatch !== -1) {
        const afterConfigEnd = configEndMatch + 2;
        const configLogging = `\n\nconsole.log('🔍 DEBUG next.config: Final config basePath =', nextConfig.basePath);\nconsole.log('🔍 DEBUG next.config: Final config assetPrefix =', nextConfig.assetPrefix);\n`;
        content = content.slice(0, afterConfigEnd) + configLogging + content.slice(afterConfigEnd);
      }

      await fs.promises.writeFile(configPath, this.normalizeLineEndings(content), 'utf8');
      console.log(`✅ Configured ${path.basename(configPath)} to read basePath from EGDESK_BASE_PATH (with debug logging)`);
    } else {
      console.warn('⚠️ Could not parse next.config - may need manual configuration');
    }
  }

  /**
   * Restore original next.config.js
   */
  private async restoreNextConfig(folderPath: string): Promise<void> {
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

    for (const file of configFiles) {
      const configPath = path.join(folderPath, file);
      const backupPath = path.join(folderPath, `${file}.egdesk-backup`);

      if (fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, configPath);
        await fs.promises.unlink(backupPath);
        console.log(`✅ Restored ${file} from backup`);
        return;
      }
    }

    console.log('ℹ️ No backup found to restore');
  }

  /**
   * Remove EGDesk README from project folder
   */
  private removeEGDeskReadme(folderPath: string): void {
    try {
      const readmePath = path.join(folderPath, 'EGDESK-README.md');
      if (fs.existsSync(readmePath)) {
        fs.unlinkSync(readmePath);
        console.log('✓ Removed EGDESK-README.md');
      }
    } catch (error) {
      console.error('Failed to remove EGDesk README:', error);
    }
  }


  public async startServer(folderPath: string): Promise<ServerInfo> {
    // Ensure runtime is initialized
    if (!this.runtimeInitialized) {
      await this.initializeRuntime();
    }

    // Check Node.js runtime
    console.log('🔍 Checking Node.js runtime...');
    const nodeCheck = await this.checkNodeInstallation();

    if (!nodeCheck.hasNode || !nodeCheck.hasNpm) {
      const errorMessage = `❌ Failed to initialize Node.js runtime. Please restart the application.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    console.log(`✅ Using Node.js ${nodeCheck.nodeVersion} and npm ${nodeCheck.npmVersion}`);

    // Check if tunnel is active for Vite projects
    // We need tunnelId set to properly configure Vite's --base flag
    if (!this.tunnelId) {
      console.warn('⚠️ No tunnel ID set - dev servers will not work with website viewer');
      console.warn('⚠️ Please start the MCP tunnel first before starting dev servers');
      throw new Error('Tunnel not started. Please start the MCP tunnel in Settings first, then start the dev server.');
    }

    // Check if server already running
    const existing = this.servers.get(folderPath);
    if (existing && existing.status === 'running') {
      return existing;
    }

    // Check if folder is empty - if so, initialize Next.js
    if (this.isFolderEmpty(folderPath)) {
      console.log('📂 Empty folder detected - setting up Next.js project...');
      await this.initializeNextJsProject(folderPath);
    }

    // Analyze folder
    const projectInfo = await this.analyzeFolder(folderPath);

    if (!projectInfo.hasPackageJson) {
      throw new Error('No package.json found in folder. This should not happen after initialization.');
    }

    // Install dependencies if needed
    if (!projectInfo.hasNodeModules) {
      await this.installDependencies(folderPath, projectInfo.packageManager);
    }

    // For Vite projects, ensure API plugin is installed
    // The plugin will automatically discover user-data tables when Vite starts
    if (projectInfo.type === 'vite') {
      await this.ensureViteApiPlugin(folderPath, projectInfo.packageManager);
    }

    // For Next.js projects, ensure API plugin is installed and configured
    // The plugin will generate middleware and helper files
    if (projectInfo.type === 'nextjs') {
      await this.ensureNextApiPlugin(folderPath, projectInfo.packageManager);

      // Configure basePath for tunnel support
      if (this.tunnelId) {
        console.log(`🔧 Configuring Next.js for tunnel support...`);
        await this.backupNextConfig(folderPath);
        await this.configureNextJsBasePath(folderPath);
        this.writeEGDeskReadme(folderPath);
      }
    }

    // Find available port
    const port = await this.findAvailablePort();

    // Determine command based on project type
    let command: string;
    let args: string[];
    const projectName = path.basename(folderPath);

    // On Windows, npm/yarn/pnpm are .cmd files
    const packageManagerCommand = process.platform === 'win32'
      ? `${projectInfo.packageManager}.cmd`
      : projectInfo.packageManager;

    switch (projectInfo.type) {
      case 'nextjs':
        command = packageManagerCommand;
        args = ['run', 'dev', '--', '-p', port.toString()];
        break;
      case 'vite':
        command = packageManagerCommand;
        args = ['run', 'dev', '--', '--port', port.toString()];

        // Add --base flag for tunneling if tunnel ID is set
        if (this.tunnelId) {
          const viteBasePath = `/t/${this.tunnelId}/p/${projectName}`;
          args.push('--base', viteBasePath);
          console.log(`Adding Vite --base flag: ${viteBasePath}`);
        }
        break;
      case 'react':
        command = packageManagerCommand;
        args = ['start'];
        break;
      default:
        command = packageManagerCommand;
        args = ['run', 'dev'];
    }

    console.log(`Starting dev server: ${command} ${args.join(' ')} in ${folderPath}`);

    // Clean environment - remove problematic variables
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

    // For Next.js, set basePath via environment variable
    const serverEnv = {
      ...cleanEnv,
      PORT: port.toString(),
      NODE_ENV: 'development'
    };

    if (projectInfo.type === 'nextjs' && this.tunnelId) {
      const basePath = `/t/${this.tunnelId}/p/${projectName}`;
      serverEnv.EGDESK_BASE_PATH = basePath;
      // Also expose to client-side for fetch calls
      serverEnv.NEXT_PUBLIC_EGDESK_BASE_PATH = basePath;
      console.log(`🔧 Setting EGDESK_BASE_PATH=${basePath} for Next.js`);
      console.log(`🔧 Setting NEXT_PUBLIC_EGDESK_BASE_PATH=${basePath} for client-side`);
      console.log(`🔍 DEBUG: Full environment for Next.js process:`);
      console.log(`   - EGDESK_BASE_PATH: ${serverEnv.EGDESK_BASE_PATH}`);
      console.log(`   - NEXT_PUBLIC_EGDESK_BASE_PATH: ${serverEnv.NEXT_PUBLIC_EGDESK_BASE_PATH}`);
      console.log(`   - PORT: ${serverEnv.PORT}`);
      console.log(`   - NODE_ENV: ${serverEnv.NODE_ENV}`);
      console.log(`   - PATH: ${serverEnv.PATH?.substring(0, 100)}...`);
    }

    // Spawn the dev server process using system npm/yarn/pnpm
    console.log(`🔍 DEBUG: Spawning process with command: ${command} ${args.join(' ')}`);
    console.log(`🔍 DEBUG: Working directory: ${folderPath}`);
    console.log(`🔍 DEBUG: Shell: true`);
    console.log(`🔍 DEBUG: Environment variables count: ${Object.keys(serverEnv).length}`);

    const serverProcess = spawn(command, args, {
      cwd: folderPath,
      shell: true,
      env: serverEnv
    });

    const serverInfo: ServerInfo = {
      port,
      url: `http://localhost:${port}`,
      status: 'starting',
      process: serverProcess,
      projectPath: folderPath
    };

    this.servers.set(folderPath, serverInfo);

    // Register project in registry
    const projectRegistry = getProjectRegistry();
    projectRegistry.register(folderPath, port, serverInfo.url, 'starting', projectInfo.type);

    // Monitor output for "ready" status
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[Dev Server ${port}]:`, output);

      // Detect when server is ready
      if (output.includes('ready') ||
          output.includes('compiled') ||
          output.includes('Local:') ||
          output.includes('started server')) {
        serverInfo.status = 'running';
        this.servers.set(folderPath, serverInfo);

        // Update registry status
        const projectRegistry = getProjectRegistry();
        const projectName = path.basename(folderPath);
        projectRegistry.updateStatus(projectName, 'running');

        console.log(`Dev server ready at ${serverInfo.url}`);

        // For Next.js, check if basePath was applied
        if (projectInfo.type === 'nextjs' && this.tunnelId) {
          console.log(`🔍 DEBUG: Next.js started. Expected URL with basePath would be: http://localhost:${port}/t/${this.tunnelId}/p/${projectName}/`);
          console.log(`🔍 DEBUG: If you see just http://localhost:${port}, the env var is NOT being read by Next.js`);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Dev Server ${port} Error]:`, data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error(`Failed to start dev server:`, error);
      serverInfo.status = 'error';
      this.servers.set(folderPath, serverInfo);

      // Update registry status
      const projectRegistry = getProjectRegistry();
      const projectName = path.basename(folderPath);
      projectRegistry.updateStatus(projectName, 'error');
    });

    serverProcess.on('close', (code) => {
      console.log(`Dev server process exited with code ${code}`);
      serverInfo.status = 'stopped';
      serverInfo.process = null;
      this.servers.set(folderPath, serverInfo);

      // Update registry status
      const projectRegistry = getProjectRegistry();
      const projectName = path.basename(folderPath);
      projectRegistry.updateStatus(projectName, 'stopped');
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    return serverInfo;
  }

  public async stopServer(folderPath: string): Promise<void> {
    const serverInfo = this.servers.get(folderPath);

    if (!serverInfo || !serverInfo.process) {
      throw new Error('No server running for this folder');
    }

    // Restore Next.js config and remove README if it was modified
    const projectInfo = await this.analyzeFolder(folderPath);
    if (projectInfo.type === 'nextjs') {
      await this.restoreNextConfig(folderPath);
      this.removeEGDeskReadme(folderPath);
    }

    return new Promise((resolve, reject) => {
      if (!serverInfo.process) {
        resolve();
        return;
      }

      serverInfo.process.on('close', () => {
        console.log(`Dev server stopped for ${folderPath}`);
        this.servers.delete(folderPath);

        // Unregister from registry
        const projectRegistry = getProjectRegistry();
        const projectName = path.basename(folderPath);
        projectRegistry.unregister(projectName);

        resolve();
      });

      // Try graceful shutdown first
      serverInfo.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (serverInfo.process && !serverInfo.process.killed) {
          serverInfo.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  public async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(folderPath =>
      this.stopServer(folderPath).catch(err =>
        console.error(`Failed to stop server for ${folderPath}:`, err)
      )
    );

    await Promise.all(stopPromises);
  }

  public cleanup(): void {
    this.stopAllServers();
  }
}

// Singleton instance
let devServerManagerInstance: DevServerManager | null = null;

export function getDevServerManager(): DevServerManager {
  if (!devServerManagerInstance) {
    devServerManagerInstance = new DevServerManager();
  }
  return devServerManagerInstance;
}
