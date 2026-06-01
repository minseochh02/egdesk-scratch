import { ChildProcess, spawn, execSync } from 'child_process';
import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { getProjectRegistry } from './project-registry';
import { getStore } from '../storage';
import { getLocalServerManager } from '../mcp/server-creator/local-server-manager';
import { startTunnel, getTunnelStatus } from '../mcp/server-creator/tunneling-manager';
import { CODING_PORTS, getPreferredPort, getPortMode, isDevPortAllowed, isProductionPortAllowed, type ActivePortInfo } from '../../shared/coding-ports';
import { getDeploymentManager } from './deployment-manager';

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
  status: 'starting' | 'running' | 'error' | 'stopped' | 'rebuilding';
  process: ChildProcess | null;
  projectPath: string;
  watcher?: chokidar.FSWatcher;
  rebuildTimer?: NodeJS.Timeout;
  projectType?: 'nextjs' | 'vite' | 'react' | 'unknown';
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  mode: 'dev' | 'production';
  supportsHotReload: boolean;
  lastModeChange?: string;
  terminalLogs: string[];
  maxLogLines: number;
  deploymentPath?: string;
}

export class DevServerManager {
  private servers: Map<string, ServerInfo> = new Map();
  private pendingStarts: Map<string, Promise<ServerInfo>> = new Map();
  private tunnelId: string | null = null;
  private runtimeInitialized: boolean = false;

  constructor() {
    this.setupIpcHandlers();
    this.initializeRuntime();
    this.initializeTunnelId();
  }

  /**
   * Get the current active certificate ID from the service
   */
  private getActiveCertificateId(): string | null {
    try {
      const store = getStore();
      const httpsEnabled = store.get('https-enabled', false) as boolean;
      if (!httpsEnabled) return null;

      const { SSLCertificateService } = require('../ssl/ssl-certificate-service');
      return SSLCertificateService.getInstance().getActiveCertificateId();
    } catch (error) {
      console.error('Failed to get active certificate ID:', error);
      return null;
    }
  }

  /**
   * Initialize tunnel ID from store if available
   */
  private initializeTunnelId() {
    try {
      const store = getStore();
      const mcpConfig = store.get('mcpConfiguration') as any;
      if (mcpConfig?.tunnel?.registered && mcpConfig?.tunnel?.serverName) {
        this.tunnelId = mcpConfig.tunnel.serverName;
        console.log(`🔧 DevServerManager: Initialized tunnel ID from store: ${this.tunnelId}`);
      }
    } catch (error) {
      console.error('Failed to initialize tunnel ID from store:', error);
    }
  }

  /**
   * Determine default mode based on tunnel and stored preference
   */
  private determineDefaultMode(folderPath: string): 'dev' | 'production' {
    const store = getStore();
    const projectName = path.basename(folderPath);
    const modeConfigs = store.get('projectModeConfigs') as any || {};

    if (modeConfigs[projectName]?.preferredMode) {
      return modeConfigs[projectName].preferredMode;
    }

    return this.tunnelId ? 'production' : 'dev';
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
        // Changed: Remove stdio: 'ignore' to capture output for debugging
        const output = execSync(command, { encoding: 'utf-8', shell: true });
        console.log(`✅ Successfully killed process on port ${port}`);
        console.log(`Command output: ${output}`);
      } catch (error: any) {
        // Better error handling - distinguish between "no process" and actual errors
        const errorMessage = error.message || '';
        const stderr = error.stderr?.toString() || '';
        const stdout = error.stdout?.toString() || '';

        console.log(`⚠️ Kill port command failed for port ${port}`);
        console.log(`Error message: ${errorMessage}`);
        console.log(`Stderr: ${stderr}`);
        console.log(`Stdout: ${stdout}`);

        // Check if it's just "no process found" (exit code 1 with empty output)
        // or an actual error (command not found, permission denied, etc.)
        if (error.code === 1 && !stderr.includes('not found') && !stderr.includes('permission')) {
          console.log(`ℹ️ No process found on port ${port} (this is ok)`);
        } else if (stderr.includes('not found') || stderr.includes('command not found')) {
          console.error(`❌ Command not found. Make sure lsof/netstat is available in PATH`);
          reject(new Error(`Command not found. The system cannot find the required command to kill processes.`));
          return;
        } else if (stderr.includes('permission') || stderr.includes('denied')) {
          console.error(`❌ Permission denied when trying to kill process on port ${port}`);
          reject(new Error(`Permission denied. Please run the application with appropriate permissions.`));
          return;
        } else {
          console.error(`❌ Unexpected error killing process: ${errorMessage}`);
        }
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

    ipcMain.handle('dev-server:set-tunnel-id', async (event, tunnelId: string) => {
      this.setTunnelId(tunnelId);
      return { success: true };
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

    ipcMain.handle('dev-server:start', async (
      event,
      folderPath: string,
      mode?: 'dev' | 'production'
    ) => {
      try {
        const serverInfo = await this.startServer(folderPath, mode);
        // Remove non-serializable objects before sending through IPC
        const { process, watcher, rebuildTimer, ...serializableInfo } = serverInfo;
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

    ipcMain.handle('dev-server:switch-mode', async (
      event,
      folderPath: string,
      newMode: 'dev' | 'production'
    ) => {
      try {
        // Stop current server
        await this.stopServer(folderPath);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start with new mode
        const serverInfo = await this.startServer(folderPath, newMode);

        // Store mode preference
        const store = getStore();
        const projectName = path.basename(folderPath);
        const modeConfigs = store.get('projectModeConfigs') as any || {};

        modeConfigs[projectName] = {
          preferredMode: newMode,
          lastUsedMode: newMode,
          lastChanged: new Date().toISOString()
        };

        store.set('projectModeConfigs', modeConfigs);

        // Remove non-serializable objects before sending through IPC
        const { process, watcher, rebuildTimer, ...serializableInfo } = serverInfo;
        return { success: true, serverInfo: serializableInfo };

      } catch (error: any) {
        console.error('Failed to switch mode:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:get-status', async (event, folderPath: string) => {
      try {
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          // Remove non-serializable objects before sending through IPC
          const { process, watcher, rebuildTimer, ...serializableInfo } = serverInfo;
          return { success: true, serverInfo: serializableInfo };
        }
        return { success: true, serverInfo: null };
      } catch (error: any) {
        console.error('Failed to get server status:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:get-logs', async (event, folderPath: string) => {
      try {
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          return { success: true, logs: serverInfo.terminalLogs };
        }
        return { success: true, logs: [] };
      } catch (error: any) {
        console.error('Failed to get terminal logs:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:clear-logs', async (event, folderPath: string) => {
      try {
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          serverInfo.terminalLogs = [];
          this.servers.set(folderPath, serverInfo);
          return { success: true };
        }
        return { success: false, error: 'Server not found' };
      } catch (error: any) {
        console.error('Failed to clear terminal logs:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:get-all', async () => {
      try {
        const allServers = Array.from(this.servers.entries()).map(([path, info]) => {
          const { process, watcher, rebuildTimer, ...serializableInfo } = info;
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

    ipcMain.handle('dev-server:scan-ports', async () => {
      try {
        const ports = this.scanActivePorts();
        return { success: true, ports };
      } catch (error: any) {
        console.error('Failed to scan ports:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('dev-server:kill-port', async (event, port: number) => {
      try {
        // Kill the process on the port
        await this.killProcessOnPort(port);

        // Find and clean up any server using this port
        let cleanedUp = false;
        for (const [folderPath, serverInfo] of this.servers.entries()) {
          if (serverInfo.port === port) {
            console.log(`🧹 Cleaning up server state for ${folderPath} (port ${port})`);

            // Remove from servers map
            this.servers.delete(folderPath);

            // Unregister from project registry
            const projectRegistry = getProjectRegistry();
            const projectName = path.basename(folderPath);
            projectRegistry.unregister(projectName);

            cleanedUp = true;
            break;
          }
        }

        if (cleanedUp) {
          console.log(`✅ Port ${port} freed and removed from active servers list`);
        } else {
          console.log(`✅ Port ${port} killed (no matching server found in registry)`);
        }

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

    ipcMain.handle('ssl-certificate:set-active', async (_event, certificateId: string | null) => {
      try {
        const { SSLCertificateService } = require('../ssl/ssl-certificate-service');
        SSLCertificateService.getInstance().setActiveCertificateId(certificateId);
        console.log(`🔧 DevServerManager: Active certificate set to ${certificateId}`);
        return { success: true };
      } catch (error: any) {
        console.error('Failed to set active certificate:', error);
        return { success: false, error: error.message };
      }
    });

    // ── Deployment management handlers ──────────────────────────────────────

    ipcMain.handle('deployment:list', async (_event, projectName: string) => {
      try {
        const versions = getDeploymentManager().listDeployments(projectName);
        return { success: true, versions };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('deployment:get-active', async (_event, projectName: string) => {
      try {
        const version = getDeploymentManager().getActiveVersion(projectName);
        return { success: true, version };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('deployment:rollback', async (_event, projectName: string, versionId: string) => {
      try {
        const result = getDeploymentManager().rollbackToVersion(projectName, versionId);
        if (!result.success) return { success: false, error: result.error };

        // Restart the running production server from the rolled-back snapshot
        const projectRegistry = getProjectRegistry();
        const project = projectRegistry.getProject(projectName);
        if (project?.mode === 'production' && project.folderPath) {
          const serverInfo = this.servers.get(project.folderPath);
          if (serverInfo?.process) {
            await this.rebuildAndRestart(project.folderPath);
            return { success: true, message: `Rolled back to ${versionId} and restarted` };
          }
        }
        return { success: true, message: `Rolled back to ${versionId} (server not running)` };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('deployment:cleanup', async (_event, projectName: string, keepCount: number = 5) => {
      try {
        const result = getDeploymentManager().cleanupOldDeployments(projectName, keepCount);
        return result;
      } catch (error: any) {
        return { success: false, removed: 0, error: error.message };
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
   * Initialize a new Next.js project in the given folder.
   * Scaffolds into a temp directory first to avoid conflicts with existing files,
   * then copies generated files into folderPath (without overwriting existing ones).
   */
  private async initializeNextJsProject(folderPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log(`🚀 Initializing Next.js project in ${folderPath}...`);

      // Sanitize folder name for use as a create-next-app project name
      const projectName = path.basename(folderPath).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const tempParentDir = path.join(os.tmpdir(), `egdesk-init-${Date.now()}`);
      const tempProjectDir = path.join(tempParentDir, projectName);

      try {
        fs.mkdirSync(tempParentDir, { recursive: true });
      } catch (err) {
        reject(err);
        return;
      }

      const args = [
        projectName,
        '--typescript',
        '--tailwind',
        '--eslint',
        '--app',
        '--src-dir',
        '--import-alias', '@/*',
        '--use-npm',
        '--no-git',
        '--skip-install'
      ];

      // Clean environment and force non-interactive mode
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
      cleanEnv.CI = 'true';
      cleanEnv.DISABLE_PROMPTS = 'true';

      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const initProcess = spawn(npxCommand, ['create-next-app@latest', ...args], {
        cwd: tempParentDir,
        env: cleanEnv,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (initProcess.stdin) {
        initProcess.stdin.write('n\n');
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
          try {
            // Copy scaffolded files into folderPath without overwriting existing files
            fs.cpSync(tempProjectDir, folderPath, { recursive: true, force: false, errorOnExist: false });
            console.log('✅ Next.js project files copied to target folder');
          } catch (copyError) {
            console.error('Failed to copy Next.js project files:', copyError);
            fs.rmSync(tempParentDir, { recursive: true, force: true });
            reject(copyError);
            return;
          }

          fs.rmSync(tempParentDir, { recursive: true, force: true });

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
          fs.rmSync(tempParentDir, { recursive: true, force: true });
          const errorMsg = `Next.js initialization failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      initProcess.on('error', (error) => {
        fs.rmSync(tempParentDir, { recursive: true, force: true });
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

  /**
   * List listening ports in the 3000-series (production) and 4000-series (dev) ranges.
   */
  private getListeningPortsInRanges(): Array<{ port: number; processName?: string; pid?: number }> {
    const inRange = (port: number) => getPortMode(port) !== null;
    const byPort = new Map<number, { port: number; processName?: string; pid?: number }>();

    try {
      if (process.platform === 'win32') {
        const output = execSync('netstat -ano', { encoding: 'utf-8' });
        for (const line of output.split('\n')) {
          if (!line.includes('LISTENING')) continue;
          const portMatch = line.match(/:(\d+)\s+[^\s]+\s+LISTENING\s+(\d+)/);
          if (!portMatch) continue;
          const port = parseInt(portMatch[1], 10);
          if (!inRange(port)) continue;
          byPort.set(port, {
            port,
            pid: parseInt(portMatch[2], 10),
            processName: 'unknown',
          });
        }
      } else {
        const output = execSync('lsof -iTCP -sTCP:LISTEN -P -n', { encoding: 'utf-8' });
        for (const line of output.split('\n').slice(1)) {
          if (!line.includes('(LISTEN)')) continue;
          const portMatch = line.match(/:(\d+)\s+\(LISTEN\)/);
          if (!portMatch) continue;
          const port = parseInt(portMatch[1], 10);
          if (!inRange(port)) continue;
          const parts = line.trim().split(/\s+/);
          byPort.set(port, {
            port,
            processName: parts[0],
            pid: Number.parseInt(parts[1], 10) || undefined,
          });
        }
      }
    } catch {
      // No listeners or command unavailable
    }

    return Array.from(byPort.values()).sort((a, b) => a.port - b.port);
  }

  public scanActivePorts(): ActivePortInfo[] {
    return this.getListeningPortsInRanges().map(({ port, processName, pid }) => {
      const mode = getPortMode(port)!;
      let projectPath: string | undefined;
      let status: string | undefined;

      for (const [folderPath, serverInfo] of this.servers.entries()) {
        if (serverInfo.port === port) {
          projectPath = folderPath;
          status = serverInfo.status;
          break;
        }
      }

      return {
        port,
        mode,
        projectPath,
        projectName: projectPath ? path.basename(projectPath) : undefined,
        processName,
        pid,
        status,
      };
    });
  }

  /**
   * Check if a port is occupied on the system (outside our registry).
   */
  private isPortInUse(port: number): boolean {
    try {
      if (process.platform === 'win32') {
        execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { stdio: 'ignore' });
      } else {
        execSync(`lsof -iTCP:${port} -sTCP:LISTEN -P -n`, { stdio: 'ignore' });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Free the preferred dev port — kills the OS process and clears stale registry entries.
   */
  private async ensureDevPortAvailable(port: number, excludeFolderPath?: string): Promise<void> {
    if (!this.isPortInUse(port)) {
      return;
    }

    console.log(`⚠️ Port ${port} is already in use — attempting to free it for dev server...`);

    for (const [folderPath, serverInfo] of this.servers.entries()) {
      if (serverInfo.port === port && folderPath !== excludeFolderPath) {
        console.log(`🧹 Removing stale server registry for ${folderPath} (port ${port})`);
        if (serverInfo.process) {
          try {
            serverInfo.process.kill('SIGTERM');
          } catch {
            // Process may already be gone
          }
        }
        this.servers.delete(folderPath);
      }
    }

    await this.killProcessOnPort(port);
  }

  private async findAvailablePort(
    preferredPort?: number,
    mode?: 'dev' | 'production',
    folderPath?: string,
  ): Promise<number> {
    const devPort = CODING_PORTS.dev.preferred;
    const prodPort = CODING_PORTS.production.preferred;

    if (mode === 'dev' && preferredPort === devPort) {
      await this.ensureDevPortAvailable(devPort, folderPath);
      if (!this.isPortInUse(devPort)) {
        console.log(`✅ Port ${devPort} is available for dev server`);
        return devPort;
      }
      console.warn(`⚠️ Port ${devPort} still in use after kill attempt — scanning for another port`);
    }

    const usedPorts = Array.from(this.servers.entries())
      .filter(([fp]) => fp !== folderPath)
      .map(([, serverInfo]) => serverInfo.port);

    if (preferredPort && !usedPorts.includes(preferredPort) && !this.isPortInUse(preferredPort)) {
      return preferredPort;
    }

    if (preferredPort && this.isPortInUse(preferredPort)) {
      console.log(`⚠️ Preferred port ${preferredPort} is already in use on the system.`);
    }

    const portRange = mode === 'dev' ? CODING_PORTS.dev.range : CODING_PORTS.production.range;
    for (let port = portRange.start; port <= portRange.end; port++) {
      const allowed = mode === 'dev' ? isDevPortAllowed(port) : isProductionPortAllowed(port);
      if (!allowed) continue;
      if (!usedPorts.includes(port) && !this.isPortInUse(port)) {
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
        const output = data.toString();
        console.log(`Install: ${output}`);

        // Capture install logs
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogLine(folderPath, `[INSTALL] ${line.trim()}`, 'stdout');
            }
          });
        }
      });

      installProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        const output = data.toString();
        // Don't log warnings as errors
        if (!output.includes('WARN')) {
          console.error(`Install error: ${output}`);
        }

        // Capture install error logs
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogLine(folderPath, `[INSTALL] ${line.trim()}`, 'stderr');
            }
          });
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
   * Clean environment - remove problematic variables
   */
  private cleanEnv(): NodeJS.ProcessEnv {
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_OPTIONS;
    delete cleanEnv.TS_NODE_PROJECT;
    delete cleanEnv.TS_NODE_TRANSPILE_ONLY;
    return cleanEnv;
  }

  /**
   * Add log line to terminal logs with size limit
   */
  private addLogLine(folderPath: string, line: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    const serverInfo = this.servers.get(folderPath);
    if (!serverInfo) return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = type === 'stderr' ? '[ERROR]' : '[INFO]';
    const formattedLine = `[${timestamp}] ${prefix} ${line}`;

    serverInfo.terminalLogs.push(formattedLine);

    // Keep only the last maxLogLines
    if (serverInfo.terminalLogs.length > serverInfo.maxLogLines) {
      serverInfo.terminalLogs.shift();
    }

    this.servers.set(folderPath, serverInfo);
  }

  /**
   * Write active certificate to temporary files for dev server use
   */
  private async writeTempCertificateFiles(): Promise<{ keyPath: string; certPath: string } | null> {
    const activeCertId = this.getActiveCertificateId();
    console.log(`🔍 DevServerManager: Checking for active certificate (ID: ${activeCertId})`);
    if (!activeCertId) return null;

    try {
      const { SSLCertificateService } = require('../ssl/ssl-certificate-service');
      const cert = SSLCertificateService.getInstance().getCertificate(activeCertId);

      if (!cert) {
        console.log(`⚠️ DevServerManager: Active certificate ID ${activeCertId} not found in store`);
        return null;
      }

      console.log(`✅ DevServerManager: Found active certificate for ${cert.domain}`);

      const tempDir = path.join(os.tmpdir(), 'egdesk-ssl');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const keyPath = path.join(tempDir, `${cert.id}.key`);
      const certPath = path.join(tempDir, `${cert.id}.crt`);

      fs.writeFileSync(keyPath, cert.privateKey);
      fs.writeFileSync(certPath, cert.certificate);

      console.log(`📝 DevServerManager: Wrote temp cert files to ${tempDir}`);

      return { keyPath, certPath };
    } catch (error) {
      console.error('Failed to write temporary certificate files:', error);
      return null;
    }
  }

  /**
   * Start server in dev mode (no build step)
   */
  private async startDevModeServer(
    folderPath: string,
    projectType: ProjectInfo['type'],
    packageManager: string,
    port: number,
    basePath?: string
  ): Promise<ChildProcess> {
    const packageManagerCommand = process.platform === 'win32'
      ? `${packageManager}.cmd` : packageManager;

    let command: string;
    let args: string[];

    const sslFiles = await this.writeTempCertificateFiles();

    switch (projectType) {
      case 'nextjs':
        command = packageManagerCommand;
        // Bind to 0.0.0.0 to allow network access (IP address)
        args = ['run', 'dev', '--', '-p', port.toString(), '-H', '0.0.0.0'];
        if (sslFiles) {
          args.push('--experimental-https');
          args.push('--experimental-https-key', sslFiles.keyPath);
          args.push('--experimental-https-cert', sslFiles.certPath);
        }
        break;
      case 'vite':
        command = packageManagerCommand;
        // Bind to 0.0.0.0 to allow network access (IP address)
        args = ['run', 'dev', '--', '--port', port.toString(), '--host', '0.0.0.0'];
        if (sslFiles) {
          args.push('--https');
          // Vite might need a plugin or specific config for custom certs via CLI
          // but many templates support these flags
        }
        if (basePath) args.push('--base', basePath);
        break;
      case 'react':
        command = packageManagerCommand;
        // For CRA, we use HOST environment variable
        args = ['start'];
        break;
      default:
        command = packageManagerCommand;
        args = ['run', 'dev'];
    }

    const serverEnv = {
      ...this.cleanEnv(),
      PORT: port.toString(),
      HOST: '0.0.0.0', // For CRA and others that respect HOST env var
      NODE_ENV: 'development',
      HTTPS: sslFiles ? 'true' : 'false', // For CRA
    };

    // DEV MODE: Do NOT set basePath env vars - framework should use empty basePath
    // The config checks NODE_ENV === 'development' and skips basePath accordingly

    console.log(`🚀 Starting DEV mode: ${command} ${args.join(' ')}`);

    return spawn(command, args, {
      cwd: folderPath,
      shell: true,
      env: serverEnv
    });
  }

  /**
   * Start production server (after build)
   */
  private async startProductionServer(
    folderPath: string,
    projectType: ProjectInfo['type'],
    packageManager: string,
    port: number,
    basePath?: string,
    deploymentPath?: string
  ): Promise<ChildProcess> {
    const packageManagerCommand = process.platform === 'win32'
      ? `${packageManager}.cmd`
      : packageManager;

    let command: string;
    let args: string[];

    const sslFiles = await this.writeTempCertificateFiles();

    switch (projectType) {
      case 'nextjs':
        command = packageManagerCommand;
        // Bind to 0.0.0.0 to allow network access (IP address)
        args = ['run', 'start', '--', '-p', port.toString(), '-H', '0.0.0.0'];
        // Next.js 'start' doesn't support experimental-https directly in the same way dev does
        // but we can set environment variables if the project uses a custom server or is configured
        break;
      case 'vite':
        command = 'npx';
        // Use static file serving from deployment dir (no node_modules needed)
        args = ['serve', 'dist', '-l', port.toString(), '-n'];
        if (sslFiles) {
          args.push('--ssl-cert', sslFiles.certPath, '--ssl-key', sslFiles.keyPath);
        }
        break;
      case 'react':
        command = 'npx';
        // Bind to 0.0.0.0 to allow network access (IP address)
        args = ['serve', '-s', 'build', '-l', port.toString(), '-n'];
        if (sslFiles) {
          args.push('--ssl-cert', sslFiles.certPath, '--ssl-key', sslFiles.keyPath);
        }
        break;
      default:
        command = packageManagerCommand;
        args = ['run', 'start'];
    }

    const serverEnv = {
      ...this.cleanEnv(),
      PORT: port.toString(),
      HOST: '0.0.0.0', // For apps that respect HOST env var
      NODE_ENV: 'production',
      HTTPS: sslFiles ? 'true' : 'false',
    };

    if (projectType === 'nextjs' && basePath) {
      serverEnv.EGDESK_BASE_PATH = basePath;
      serverEnv.NEXT_PUBLIC_EGDESK_BASE_PATH = basePath;
    }

    // Serve from deployment snapshot when available.
    // Next.js on Windows falls back to source (symlinks unreliable without admin rights).
    const servingCwd =
      deploymentPath && !(projectType === 'nextjs' && process.platform === 'win32')
        ? deploymentPath
        : folderPath;

    console.log(`🚀 Starting PRODUCTION mode: ${command} ${args.join(' ')} (cwd: ${servingCwd})`);

    return spawn(command, args, {
      cwd: servingCwd,
      shell: true,
      env: serverEnv
    });
  }

  /**
   * Build the project for production
   */
  private async buildProject(folderPath: string, packageManager: string, projectType: ProjectInfo['type'], basePath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🏗️ Building ${projectType} project in ${folderPath}...`);

      // Clean environment
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      // Set production environment
      cleanEnv.NODE_ENV = 'production';

      // For Next.js, set basePath during build
      if (projectType === 'nextjs' && basePath) {
        cleanEnv.EGDESK_BASE_PATH = basePath;
        cleanEnv.NEXT_PUBLIC_EGDESK_BASE_PATH = basePath;
        console.log(`🔧 Building Next.js with basePath: ${basePath}`);
      }

      // Use system package manager (on Windows, use .cmd explicitly)
      const command = process.platform === 'win32' ? `${packageManager}.cmd` : packageManager;
      const buildProcess = spawn(command, ['run', 'build'], { cwd: folderPath, shell: true, env: cleanEnv });

      let stdoutOutput = '';
      let errorOutput = '';

      buildProcess.stdout?.on('data', (data) => {
        stdoutOutput += data.toString();
        const output = data.toString();
        console.log(`Build: ${output}`);

        // Capture build logs
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogLine(folderPath, `[BUILD] ${line.trim()}`, 'stdout');
            }
          });
        }
      });

      buildProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        const output = data.toString();
        // Don't log warnings as errors
        if (!output.includes('WARN')) {
          console.error(`Build error: ${output}`);
        }

        // Capture build error logs
        const serverInfo = this.servers.get(folderPath);
        if (serverInfo) {
          output.split('\n').forEach(line => {
            if (line.trim()) {
              this.addLogLine(folderPath, `[BUILD] ${line.trim()}`, 'stderr');
            }
          });
        }
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Build completed successfully');
          resolve();
        } else {
          const errorMsg = `Build failed with code ${code}\nStdout: ${stdoutOutput}\nStderr: ${errorOutput}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });

      buildProcess.on('error', (error) => {
        console.error('Build process error:', error);
        reject(error);
      });
    });
  }

  /**
   * Setup file watcher for auto-rebuild on file changes
   * Debounces for 60 seconds (1 minute) after last change
   */
  private setupFileWatcher(folderPath: string): void {
    const serverInfo = this.servers.get(folderPath);
    if (!serverInfo) return;

    console.log(`👀 Setting up file watcher for ${folderPath}...`);

    // Patterns to watch (source files only)
    const watchPatterns = [
      path.join(folderPath, 'src/**/*'),
      path.join(folderPath, 'app/**/*'),
      path.join(folderPath, 'pages/**/*'),
      path.join(folderPath, 'components/**/*'),
      path.join(folderPath, 'lib/**/*'),
      path.join(folderPath, 'public/**/*'),
      path.join(folderPath, '*.{js,ts,jsx,tsx,json}'),
    ];

    // Patterns to ignore
    const ignorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.cache/**',
      '**/*.log',
      '**/.DS_Store',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
    ];

    const watcher = chokidar.watch(watchPatterns, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher.on('change', (filePath) => {
      console.log(`📝 File changed: ${path.relative(folderPath, filePath)}`);
      this.scheduleRebuild(folderPath);
    });

    watcher.on('add', (filePath) => {
      console.log(`➕ File added: ${path.relative(folderPath, filePath)}`);
      this.scheduleRebuild(folderPath);
    });

    watcher.on('unlink', (filePath) => {
      console.log(`➖ File removed: ${path.relative(folderPath, filePath)}`);
      this.scheduleRebuild(folderPath);
    });

    watcher.on('error', (error) => {
      console.error('File watcher error:', error);
    });

    serverInfo.watcher = watcher;
    this.servers.set(folderPath, serverInfo);

    console.log('✅ File watcher active (60s debounce after changes)');
  }

  /**
   * Schedule a rebuild after debounce period (60 seconds)
   */
  private scheduleRebuild(folderPath: string): void {
    const serverInfo = this.servers.get(folderPath);
    if (!serverInfo) return;

    // Clear existing timer
    if (serverInfo.rebuildTimer) {
      clearTimeout(serverInfo.rebuildTimer);
      console.log('⏱️ Reset rebuild timer');
    }

    // Set new timer for 60 seconds
    serverInfo.rebuildTimer = setTimeout(async () => {
      console.log('🔄 Debounce period complete, starting rebuild...');
      await this.rebuildAndRestart(folderPath);
    }, 60000); // 60 seconds

    this.servers.set(folderPath, serverInfo);
    console.log('⏱️ Scheduled rebuild in 60 seconds (will reset if more changes occur)');
  }

  /**
   * Rebuild and restart the server
   */
  private async rebuildAndRestart(folderPath: string): Promise<void> {
    const serverInfo = this.servers.get(folderPath);
    if (!serverInfo) return;

    try {
      // Update status
      serverInfo.status = 'rebuilding';
      this.servers.set(folderPath, serverInfo);

      const projectRegistry = getProjectRegistry();
      const projectName = path.basename(folderPath);
      projectRegistry.updateStatus(projectName, 'rebuilding' as any);

      console.log('🛑 Stopping current server...');

      // Stop the current process
      if (serverInfo.process) {
        serverInfo.process.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Calculate basePath
      const basePath = this.tunnelId ? `/t/${this.tunnelId}/p/${projectName}` : undefined;

      console.log('🏗️ Starting rebuild...');

      // Rebuild
      await this.buildProject(
        folderPath,
        serverInfo.packageManager || 'npm',
        serverInfo.projectType || 'unknown',
        basePath
      );

      // Create a new versioned deployment snapshot after rebuild
      let rebuildDeploymentPath: string | undefined;
      try {
        const deploymentManager = getDeploymentManager();
        const deploymentResult = await deploymentManager.createDeploymentSnapshot(
          projectName,
          folderPath,
          serverInfo.projectType || 'unknown',
          'Auto-rebuild after file changes'
        );
        if (deploymentResult.success && deploymentResult.deploymentPath) {
          rebuildDeploymentPath = deploymentResult.deploymentPath;
          serverInfo.deploymentPath = rebuildDeploymentPath;
          console.log(`📂 Restart will serve from new deployment: ${rebuildDeploymentPath}`);
        }
      } catch (deployErr) {
        console.warn('⚠️ Deployment snapshot failed during rebuild, serving from source:', deployErr);
      }

      console.log('🚀 Restarting server...');

      // Restart server with same port
      const port = serverInfo.port;
      const packageManagerCommand = process.platform === 'win32'
        ? `${serverInfo.packageManager || 'npm'}.cmd`
        : serverInfo.packageManager || 'npm';

      let command: string;
      let args: string[];

      const sslFiles = await this.writeTempCertificateFiles();

      switch (serverInfo.projectType) {
        case 'nextjs':
          command = packageManagerCommand;
          // Bind to 0.0.0.0 to allow network access (IP address)
          args = ['run', 'start', '--', '-p', port.toString(), '-H', '0.0.0.0'];
          break;
        case 'vite':
          command = 'npx';
          // Use static file serving from deployment dir (no node_modules needed)
          args = ['serve', 'dist', '-l', port.toString(), '-n'];
          if (sslFiles) {
            args.push('--ssl-cert', sslFiles.certPath, '--ssl-key', sslFiles.keyPath);
          }
          break;
        case 'react':
          command = 'npx';
          // Bind to 0.0.0.0 to allow network access (IP address)
          args = ['serve', '-s', 'build', '-l', port.toString(), '-n'];
          if (sslFiles) {
            args.push('--ssl-cert', sslFiles.certPath, '--ssl-key', sslFiles.keyPath);
          }
          break;
        default:
          command = packageManagerCommand;
          args = ['run', 'start'];
      }

      // Setup environment
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_OPTIONS;
      delete cleanEnv.TS_NODE_PROJECT;
      delete cleanEnv.TS_NODE_TRANSPILE_ONLY;

      const serverEnv = {
        ...cleanEnv,
        PORT: port.toString(),
        HOST: '0.0.0.0', // For apps that respect HOST env var
        NODE_ENV: 'production',
        HTTPS: sslFiles ? 'true' : 'false',
      };

      if (serverInfo.projectType === 'nextjs' && basePath) {
        serverEnv.EGDESK_BASE_PATH = basePath;
        serverEnv.NEXT_PUBLIC_EGDESK_BASE_PATH = basePath;
      }

      // Serve from deployment snapshot when available
      const restartCwd =
        rebuildDeploymentPath && !(serverInfo.projectType === 'nextjs' && process.platform === 'win32')
          ? rebuildDeploymentPath
          : folderPath;

      // Start new process
      const serverProcess = spawn(command, args, {
        cwd: restartCwd,
        shell: true,
        env: serverEnv
      });

      serverInfo.process = serverProcess;
      serverInfo.status = 'starting';
      this.servers.set(folderPath, serverInfo);

      // Setup output handlers with log capturing
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[Production Server ${port}]:`, output);

        // Capture logs
        output.split('\n').forEach(line => {
          if (line.trim()) {
            this.addLogLine(folderPath, line.trim(), 'stdout');
          }
        });

        const outputLower = output.toLowerCase();
      if (outputLower.includes('ready') ||
            output.includes('started') ||
            output.includes('Local:') ||
            output.includes('Accepting connections') ||
            output.includes('started server')) {
          serverInfo.status = 'running';
          this.servers.set(folderPath, serverInfo);
          projectRegistry.updateStatus(projectName, 'running');
          console.log('✅ Server restarted successfully');
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        const errorOutput = data.toString();
        console.error(`[Production Server ${port} Error]:`, errorOutput);

        // Capture error logs
        errorOutput.split('\n').forEach(line => {
          if (line.trim()) {
            this.addLogLine(folderPath, line.trim(), 'stderr');
          }
        });
      });

      serverProcess.on('error', (error) => {
        console.error('Failed to restart server:', error);
        serverInfo.status = 'error';
        this.servers.set(folderPath, serverInfo);
        projectRegistry.updateStatus(projectName, 'error');
      });

      serverProcess.on('close', (code) => {
        console.log(`Production server process exited with code ${code}`);
        serverInfo.status = 'stopped';
        serverInfo.process = null;
        this.servers.set(folderPath, serverInfo);
        projectRegistry.updateStatus(projectName, 'stopped');
      });

    } catch (error) {
      console.error('Rebuild and restart failed:', error);
      serverInfo.status = 'error';
      this.servers.set(folderPath, serverInfo);

      const projectRegistry = getProjectRegistry();
      const projectName = path.basename(folderPath);
      projectRegistry.updateStatus(projectName, 'error');
    }
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
console.log('🔍 DEBUG next.config.js: NODE_ENV =', process.env.NODE_ENV);

// Only use basePath in production mode, not in dev mode (npm run dev)
const isDevelopment = process.env.NODE_ENV === 'development';
const basePath = isDevelopment ? '' : (process.env.EGDESK_BASE_PATH || '');

/**
 * 🔍 Automatically detect local IPv4 addresses to allow LAN access.
 */
const getLocalIPs = () => {
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = ['localhost', '127.0.0.1'];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            ips.push(\`\${parts[0]}.\${parts[1]}.\${parts[2]}.*\`);
          }
        }
      }
    }
    return Array.from(new Set(ips));
  } catch (e) {
    return ['localhost', '127.0.0.1', '192.168.0.*', '192.168.1.*', '10.0.0.*'];
  }
};

const nextConfig = {
  basePath: basePath,
  assetPrefix: basePath,

  // Allow LAN/IP access to the dev server (Next.js 15+)
  allowedDevOrigins: getLocalIPs(),

  // Always skip TypeScript and ESLint errors to prevent blocking on auto-generated files
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        'localhost:4000',
        '127.0.0.1:4000',
        '*.loca.lt',
        '*.ngrok.io',
        '*.ngrok-free.app',
        '*.trycloudflare.com',
        '*.gitpod.io',
        '*.tryhook.io',
        '*.localto.net'
      ]
    }
  }
};

console.log('🔍 DEBUG next.config.js: isDevelopment =', isDevelopment);
console.log('🔍 DEBUG next.config.js: basePath =', nextConfig.basePath);
console.log('🔍 DEBUG next.config.js: assetPrefix =', nextConfig.assetPrefix);

export default nextConfig;
`;
      await fs.promises.writeFile(configPath, this.normalizeLineEndings(newConfig), 'utf8');
      console.log(`✅ Created next.config.js with dynamic basePath (disabled in dev mode), allowedDevOrigins, and allowedOrigins`);
      return;
    }

    // Modify existing config to read from environment variable
    let content = await fs.promises.readFile(configPath, 'utf8');

    // Check if already configured for basePath with NODE_ENV check
    const hasBasePath = content.includes('EGDESK_BASE_PATH') && content.includes("NODE_ENV === 'development'");

    // Check if config already has typescript/eslint settings
    const hasIgnoreBuildErrors = content.includes('ignoreBuildErrors');
    const hasIgnoreDuringBuilds = content.includes('ignoreDuringBuilds');

    // Check if allowedOrigins already exist
    const hasAllowedOrigins = content.includes('allowedOrigins') && content.includes('loca.lt');
    const hasAllowedDevOrigins = content.includes('allowedDevOrigins');
    const hasExperimental = content.includes('experimental:') || content.includes('experimental :');

    // If everything is already configured, skip
    if (hasBasePath && hasIgnoreBuildErrors && hasIgnoreDuringBuilds && hasAllowedOrigins && hasAllowedDevOrigins) {
      console.log('✓ next.config already configured for dynamic basePath, error skipping, allowedOrigins, and allowedDevOrigins');
      return;
    }

    // Add debug logging and getLocalIPs helper before the config
    if (!hasBasePath || !hasAllowedDevOrigins) {
      let preConfigInjection = '';
      
      if (!hasBasePath && !content.includes('EGDESK_BASE_PATH')) {
        preConfigInjection += `\nconsole.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);\n`;
      }
      
      if (!hasAllowedDevOrigins && !content.includes('getLocalIPs')) {
        preConfigInjection += `
/**
 * 🔍 Automatically detect local IPv4 addresses to allow LAN access.
 */
const getLocalIPs = () => {
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = ['localhost', '127.0.0.1'];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            ips.push(\`\${parts[0]}.\${parts[1]}.\${parts[2]}.*\`);
          }
        }
      }
    }
    return Array.from(new Set(ips));
  } catch (e) {
    return ['localhost', '127.0.0.1', '192.168.0.*', '192.168.1.*', '10.0.0.*'];
  }
};\n`;
      }

      if (preConfigInjection) {
        // Find import statement or beginning of file to insert
        const firstImportMatch = content.match(/^import\s/m);
        if (firstImportMatch && firstImportMatch.index !== undefined) {
          // Insert after all imports
          const lastImportIndex = content.lastIndexOf('import');
          const afterImportLine = content.indexOf('\n', lastImportIndex) + 1;
          content = content.slice(0, afterImportLine) + preConfigInjection + content.slice(afterImportLine);
        } else {
          // Insert at beginning
          content = preConfigInjection + content;
        }
      }
    }

    // Re-scan for config object as content might have changed
    const configObjectMatch = content.match(/(const\s+\w+Config\s*:\s*\w+\s*=\s*\{)|(const\s+\w+Config\s*=\s*\{)/);

    if (configObjectMatch) {
      const matchedPattern = configObjectMatch[0];
      const insertPoint = configObjectMatch.index! + matchedPattern.length;

      let injection = '';

      // Add basePath only if not already present
      if (!hasBasePath) {
        injection += `
  // Only use basePath in production mode, not in dev mode
  basePath: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  assetPrefix: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),`;
      }

      // Add allowedDevOrigins for Next.js 15+ (LAN/IP access)
      if (!hasAllowedDevOrigins) {
        injection += `
  // Allow LAN/IP access to the dev server (Next.js 15+)
  allowedDevOrigins: getLocalIPs(),`;
      }

      // Add TypeScript and ESLint error skipping if not already present
      if (!hasIgnoreBuildErrors) {
        injection += `
  typescript: {
    // Always skip TypeScript errors to prevent blocking on auto-generated files
    ignoreBuildErrors: true,
  },`;
      }

      if (!hasIgnoreDuringBuilds) {
        injection += `
  eslint: {
    // Always skip ESLint errors to prevent blocking on auto-generated files
    ignoreDuringBuilds: true,
  },`;
      }

      // Add experimental.serverActions.allowedOrigins if not present
      if (!hasAllowedOrigins) {
        if (hasExperimental) {
          const hasServerActions = content.includes('serverActions:') || content.includes('serverActions :');
          if (hasServerActions) {
            content = content.replace(/(serverActions\s*:\s*\{)/, `$1\n      allowedOrigins: ['localhost:3000', '127.0.0.1:3000', 'localhost:4000', '127.0.0.1:4000', '*.loca.lt', '*.ngrok.io', '*.ngrok-free.app', '*.trycloudflare.com', '*.gitpod.io', '*.tryhook.io', '*.localto.net'],`);
          } else {
            content = content.replace(/(experimental\s*:\s*\{)/, `$1\n    serverActions: {\n      bodySizeLimit: '10mb',\n      allowedOrigins: ['localhost:3000', '127.0.0.1:3000', 'localhost:4000', '127.0.0.1:4000', '*.loca.lt', '*.ngrok.io', '*.ngrok-free.app', '*.trycloudflare.com', '*.gitpod.io', '*.tryhook.io', '*.localto.net']\n    },`);
          }
        } else {
          injection += `
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        'localhost:4000',
        '127.0.0.1:4000',
        '*.loca.lt',
        '*.ngrok.io',
        '*.ngrok-free.app',
        '*.trycloudflare.com',
        '*.gitpod.io',
        '*.tryhook.io',
        '*.localto.net'
      ]
    }
  },`;
        }
      }

      // Only inject if we have something to add
      if (injection || !hasAllowedOrigins) {
        content = content.slice(0, insertPoint) + injection + content.slice(insertPoint);

        // Add logging after the config object (only if basePath was added)
        if (!hasBasePath) {
          const configEndMatch = content.indexOf('};', insertPoint);
          if (configEndMatch !== -1) {
            const afterConfigEnd = configEndMatch + 2;
            const configLogging = `\n\nconsole.log('🔍 DEBUG next.config: Final config basePath =', nextConfig.basePath);\nconsole.log('🔍 DEBUG next.config: Final config assetPrefix =', nextConfig.assetPrefix);\n`;
            content = content.slice(0, afterConfigEnd) + configLogging + content.slice(afterConfigEnd);
          }
        }

        await fs.promises.writeFile(configPath, this.normalizeLineEndings(content), 'utf8');
        console.log(`✅ Configured ${path.basename(configPath)} with allowedOrigins and TypeScript/ESLint error skipping`);
      } else {
        console.log('✓ next.config already has all required configuration');
      }
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


  public async startServer(folderPath: string, mode?: 'dev' | 'production'): Promise<ServerInfo> {
    const existing = this.servers.get(folderPath);
    if (existing && (existing.status === 'running' || existing.status === 'starting')) {
      console.log(`ℹ️ Server already ${existing.status} for ${path.basename(folderPath)} on port ${existing.port}`);
      return existing;
    }

    const pending = this.pendingStarts.get(folderPath);
    if (pending) {
      console.log(`ℹ️ Waiting for in-progress server start for ${path.basename(folderPath)}`);
      return pending;
    }

    const startPromise = this.doStartServer(folderPath, mode);
    this.pendingStarts.set(folderPath, startPromise);
    try {
      return await startPromise;
    } catch (error) {
      this.servers.delete(folderPath);
      throw error;
    } finally {
      this.pendingStarts.delete(folderPath);
    }
  }

  private async doStartServer(folderPath: string, mode?: 'dev' | 'production'): Promise<ServerInfo> {
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

    // Determine effective mode
    const effectiveMode = mode || this.determineDefaultMode(folderPath);
    const projectName = path.basename(folderPath);

    console.log(`📦 Starting ${projectName} in ${effectiveMode.toUpperCase()} mode`);

    const preferredPort = getPreferredPort(effectiveMode);
    this.servers.set(folderPath, {
      port: preferredPort,
      url: `http://localhost:${preferredPort}`,
      status: 'starting',
      process: null,
      projectPath: folderPath,
      mode: effectiveMode,
      supportsHotReload: true,
      terminalLogs: [],
      maxLogLines: 500,
    });

    // Ensure local MCP server is running (required for both dev and production)
    // This allows projects to talk to EGDesk APIs via localhost:8080
    try {
      const mcpLocalServerManager = getLocalServerManager();
      const mcpStatus = mcpLocalServerManager.getStatus();
      if (!mcpStatus.isRunning) {
        console.log('🚀 Starting local MCP server (port 8080)...');
        await mcpLocalServerManager.startServer({ port: 8080, useHTTPS: false });
      }
    } catch (mcpError) {
      console.error('⚠️ Failed to ensure local MCP server is running:', mcpError);
      // Don't fail the whole operation, but warn the user
    }

    // CHANGE: Only require tunnel for production mode
    const requiresTunnel = effectiveMode === 'production';

    if (requiresTunnel) {
      // For production mode, we need both local MCP server AND tunneling
      const store = getStore();
      const mcpConfig = store.get('mcpConfiguration') as any;
      const tunnelName = this.tunnelId || mcpConfig?.tunnel?.serverName;

      if (!tunnelName) {
        throw new Error('Tunnel name required for production mode. Please register a tunnel name in Settings first.');
      }

      this.tunnelId = tunnelName;

      // 1. Ensure tunnel is running
      try {
        const tunnelStatus = getTunnelStatus(tunnelName);
        if (!tunnelStatus.connected) {
          console.log(`🚀 Starting tunnel for production mode: ${tunnelName}...`);
          const apiKey = mcpConfig?.tunnel?.apiKey;
          const tunnelResult = await startTunnel(tunnelName, 'http://localhost:8080', apiKey);
          
          if (!tunnelResult.success && !tunnelResult.message?.includes('already running')) {
            console.error('❌ Failed to start tunnel for production mode:', tunnelResult.error || tunnelResult.message);
            // We still proceed, but the app might not be accessible externally
          } else {
            console.log('✅ Tunnel started successfully for production mode');
          }
        }
      } catch (tunnelError) {
        console.error('⚠️ Error ensuring tunnel for production mode:', tunnelError);
      }
    }

    if (!this.tunnelId) {
      console.log('ℹ️ Starting in dev mode without tunnel (local development)');
    }

    // Check if folder has no package.json - if so, initialize Next.js
    if (!fs.existsSync(path.join(folderPath, 'package.json'))) {
      console.log('📂 No package.json found - setting up Next.js project...');
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

      // Always configure Next.js for EGDesk features (IP access, basePath, etc.)
      console.log(`🔧 Configuring Next.js for EGDesk features...`);
      await this.backupNextConfig(folderPath);
      await this.configureNextJsBasePath(folderPath);
      
      if (this.tunnelId) {
        this.writeEGDeskReadme(folderPath);
      }
    }

    // Find available port
    const port = await this.findAvailablePort(preferredPort, effectiveMode, folderPath);

    // Determine basePath
    const basePath = this.tunnelId ? `/t/${this.tunnelId}/p/${projectName}` : undefined;

    let serverProcess: ChildProcess;
    let deploymentPath: string | undefined;

    if (effectiveMode === 'dev') {
      // DEV MODE: Skip build, start immediately

      // Dev mode doesn't use basePath - pass undefined
      serverProcess = await this.startDevModeServer(
        folderPath,
        projectInfo.type,
        projectInfo.packageManager,
        port,
        undefined
      );

    } else {
      // PRODUCTION MODE: Build then create deployment snapshot, then start from snapshot
      await this.buildProject(folderPath, projectInfo.packageManager, projectInfo.type, basePath);

      const deploymentManager = getDeploymentManager();
      const deploymentResult = await deploymentManager.createDeploymentSnapshot(
        projectName,
        folderPath,
        projectInfo.type
      );
      if (deploymentResult.success && deploymentResult.deploymentPath) {
        deploymentPath = deploymentResult.deploymentPath;
        console.log(`📂 Production server will serve from: ${deploymentPath}`);
      } else {
        console.warn(`⚠️ Deployment snapshot failed (${deploymentResult.error}), serving from source`);
      }

      serverProcess = await this.startProductionServer(
        folderPath,
        projectInfo.type,
        projectInfo.packageManager,
        port,
        basePath,
        deploymentPath
      );
    }

    const activeCertId = this.getActiveCertificateId();
    const serverInfo: ServerInfo = {
      port,
      url: `${activeCertId ? 'https' : 'http'}://localhost:${port}`,
      status: 'starting',
      process: serverProcess,
      projectPath: folderPath,
      projectType: projectInfo.type,
      packageManager: projectInfo.packageManager,
      mode: effectiveMode,
      supportsHotReload: ['nextjs', 'vite', 'react'].includes(projectInfo.type),
      lastModeChange: new Date().toISOString(),
      terminalLogs: [],
      maxLogLines: 500,
      deploymentPath,
    };

    this.servers.set(folderPath, serverInfo);

    // Register with mode
    const projectRegistry = getProjectRegistry();
    projectRegistry.register(
      folderPath, port, serverInfo.url, 'starting',
      projectInfo.type, effectiveMode, deploymentPath
    );

    // Monitor output for "ready" status and capture logs
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[${effectiveMode.toUpperCase()} Server ${port}]:`, output);

      // Capture logs
      output.split('\n').forEach(line => {
        if (line.trim()) {
          this.addLogLine(folderPath, line.trim(), 'stdout');
        }
      });

      // Detect when server is ready
      const outputLower = output.toLowerCase();
      if (outputLower.includes('ready') ||
          output.includes('started') ||
          output.includes('Local:') ||
          output.includes('Accepting connections') ||
          output.includes('started server')) {
        serverInfo.status = 'running';
        this.servers.set(folderPath, serverInfo);

        // Update registry status
        const projectRegistry = getProjectRegistry();
        const projectName = path.basename(folderPath);
        projectRegistry.updateStatus(projectName, 'running');

        console.log(`${effectiveMode.toUpperCase()} server ready at ${serverInfo.url}`);

        // For Next.js, check if basePath was applied
        if (projectInfo.type === 'nextjs' && this.tunnelId) {
          console.log(`🔍 DEBUG: Next.js started. Expected URL with basePath would be: http://localhost:${port}/t/${this.tunnelId}/p/${projectName}/`);
          console.log(`🔍 DEBUG: If you see just http://localhost:${port}, the env var is NOT being read by Next.js`);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`[${effectiveMode.toUpperCase()} Server ${port} Error]:`, errorOutput);

      // Capture error logs
      errorOutput.split('\n').forEach(line => {
        if (line.trim()) {
          this.addLogLine(folderPath, line.trim(), 'stderr');
        }
      });
    });

    serverProcess.on('error', (error) => {
      console.error(`Failed to start production server:`, error);
      serverInfo.status = 'error';
      this.servers.set(folderPath, serverInfo);

      // Update registry status
      const projectRegistry = getProjectRegistry();
      const projectName = path.basename(folderPath);
      projectRegistry.updateStatus(projectName, 'error');
    });

    serverProcess.on('close', (code) => {
      console.log(`Production server process exited with code ${code}`);
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

    // File watcher ONLY for production mode
    if (effectiveMode === 'production') {
      this.setupFileWatcher(folderPath);
    } else {
      console.log('ℹ️ DEV MODE: Using framework native hot reload');
    }

    return serverInfo;
  }

  public async stopServer(folderPath: string): Promise<void> {
    const serverInfo = this.servers.get(folderPath);

    if (!serverInfo || !serverInfo.process) {
      throw new Error('No server running for this folder');
    }

    // Stop file watcher
    if (serverInfo.watcher) {
      console.log('🛑 Stopping file watcher...');
      await serverInfo.watcher.close();
    }

    // Clear any pending rebuild timers
    if (serverInfo.rebuildTimer) {
      clearTimeout(serverInfo.rebuildTimer);
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
        console.log(`Production server stopped for ${folderPath}`);
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
