import { ChildProcess, spawn } from 'child_process';
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectRegistry } from './project-registry';
import { getStore } from '../storage';
import { getNodeRuntimeManager } from './node-runtime-manager';

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
   * Initialize Node.js runtime
   */
  private async initializeRuntime(): Promise<void> {
    try {
      const runtimeManager = getNodeRuntimeManager();
      await runtimeManager.initialize();
      this.runtimeInitialized = true;
      console.log('✅ Node.js runtime initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Node.js runtime:', error);
    }
  }

  /**
   * Check if Node.js and npm are available (using bundled runtime)
   */
  private async checkNodeInstallation(): Promise<{ hasNode: boolean; hasNpm: boolean; nodeVersion?: string; npmVersion?: string }> {
    try {
      // Ensure runtime is initialized
      if (!this.runtimeInitialized) {
        await this.initializeRuntime();
      }

      const runtimeManager = getNodeRuntimeManager();
      const runtimeInfo = runtimeManager.getRuntimeInfo();

      return {
        hasNode: true, // Always true since we use Electron's Node.js
        hasNpm: true, // Always true since we bundle or download npm
        nodeVersion: runtimeInfo.nodeVersion,
        npmVersion: runtimeInfo.npmVersion
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

      // Use runtime manager for npx (which comes with npm)
      const runtimeManager = getNodeRuntimeManager();
      const initProcess = runtimeManager.spawn('npm', ['exec', '--', 'create-next-app@latest', ...args.slice(1)], {
        cwd: folderPath,
        env: cleanEnv,
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

      // Use runtime manager for package installation
      const runtimeManager = getNodeRuntimeManager();
      const installProcess = packageManager === 'npm'
        ? runtimeManager.spawn('npm', args, { cwd: folderPath, env: cleanEnv })
        : spawn(packageManager, args, { cwd: folderPath, shell: true, env: cleanEnv });

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

      // Use runtime manager for package installation
      const runtimeManager = getNodeRuntimeManager();
      const installProcess = packageManager === 'npm'
        ? runtimeManager.spawn('npm', args, { cwd: folderPath, env: cleanEnv })
        : spawn(packageManager, args, { cwd: folderPath, shell: true, env: cleanEnv });

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

      // Use local package (link to packages/vite-api-plugin)
      const pluginPath = path.join(__dirname, '../../packages/vite-api-plugin');

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
        console.log('✓ @egdesk/next-api-plugin already installed');
        // Write EGDesk API key to environment file
        this.writeEGDeskEnv(folderPath, 'nextjs');
        // Run setup to generate middleware and helpers
        await this.setupNextApiPlugin(folderPath);
        return;
      }

      console.log('📦 Installing @egdesk/next-api-plugin for database proxy support...');

      // Use local package (link to packages/next-api-plugin)
      const pluginPath = path.join(__dirname, '../../packages/next-api-plugin');

      if (fs.existsSync(pluginPath)) {
        // Install from local path
        await this.installPackage(folderPath, `file:${pluginPath}`, packageManager, true);
        console.log('✓ @egdesk/next-api-plugin installed from local source');

        // Write EGDesk API key to environment file
        this.writeEGDeskEnv(folderPath, 'nextjs');

        // Run plugin setup to generate middleware and helpers
        await this.setupNextApiPlugin(folderPath);
      } else {
        console.warn('⚠️ Local @egdesk/next-api-plugin not found at', pluginPath);
        console.warn('⚠️ Skipping plugin installation. Database proxy will need manual setup.');
      }
    } catch (error) {
      console.error('Failed to install @egdesk/next-api-plugin:', error);
      console.warn('⚠️ Continuing without API plugin. Database proxy will need manual setup.');
      // Don't throw - continue server startup even if plugin install fails
    }
  }

  /**
   * Run Next.js plugin setup to generate middleware and helper files
   */
  private async setupNextApiPlugin(folderPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔧 Setting up Next.js API plugin...');

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

      // Run the CLI via npx (using runtime manager)
      const runtimeManager = getNodeRuntimeManager();
      const setupProcess = runtimeManager.spawn('npm', ['exec', '--', ...args], {
        cwd: folderPath,
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
          console.log('✓ Next.js API plugin setup complete');
          resolve();
        } else {
          const errorMsg = `Next.js plugin setup failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          console.warn('⚠️ Please run "npx egdesk-next-setup" manually in your project');
          // Don't reject - just warn and continue
          resolve();
        }
      });

      setupProcess.on('error', (error) => {
        console.error('Next.js setup process error:', error);
        console.warn('⚠️ Please run "npx egdesk-next-setup" manually in your project');
        // Don't reject - just warn and continue
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

      fs.writeFileSync(configPath, configContent, 'utf-8');
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

      const envContent = [
        '# EGDesk Configuration - Auto-generated',
        `# This file is used by ${pluginName} for user-data access`,
        '',
        `${prefix}EGDESK_API_URL=http://localhost:8080`,
        `${prefix}EGDESK_API_KEY=${apiKey}`,
        ''
      ].join('\n');

      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✓ EGDesk environment variables written to .env.local');
    } catch (error) {
      console.error('Failed to write EGDesk environment file:', error);
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
    }

    // Find available port
    const port = await this.findAvailablePort();

    // Determine command based on project type
    let command: string;
    let args: string[];
    const projectName = path.basename(folderPath);

    switch (projectInfo.type) {
      case 'nextjs':
        command = projectInfo.packageManager;
        args = ['run', 'dev', '--', '-p', port.toString()];
        break;
      case 'vite':
        command = projectInfo.packageManager;
        args = ['run', 'dev', '--', '--port', port.toString()];

        // Add --base flag for tunneling if tunnel ID is set
        if (this.tunnelId) {
          const viteBasePath = `/t/${this.tunnelId}/p/${projectName}`;
          args.push('--base', viteBasePath);
          console.log(`Adding Vite --base flag: ${viteBasePath}`);
        }
        break;
      case 'react':
        command = projectInfo.packageManager;
        args = ['start'];
        break;
      default:
        command = projectInfo.packageManager;
        args = ['run', 'dev'];
    }

    console.log(`Starting dev server: ${command} ${args.join(' ')} in ${folderPath}`);

    // Clean environment - remove problematic variables
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

    // Spawn the dev server process using runtime manager
    const runtimeManager = getNodeRuntimeManager();
    const serverProcess = command === 'npm' || command === 'yarn' || command === 'pnpm'
      ? (command === 'npm'
          ? runtimeManager.spawn('npm', args, {
              cwd: folderPath,
              env: {
                ...cleanEnv,
                PORT: port.toString(),
                NODE_ENV: 'development'
              }
            })
          : spawn(command, args, {
              cwd: folderPath,
              shell: true,
              env: {
                ...cleanEnv,
                PORT: port.toString(),
                NODE_ENV: 'development'
              }
            }))
      : spawn(command, args, {
          cwd: folderPath,
          shell: true,
          env: {
            ...cleanEnv,
            PORT: port.toString(),
            NODE_ENV: 'development'
          }
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
    projectRegistry.register(folderPath, port, serverInfo.url, 'starting');

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
