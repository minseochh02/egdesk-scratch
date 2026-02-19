import { ChildProcess, spawn } from 'child_process';
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectRegistry } from './project-registry';

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

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Set the tunnel ID for generating Vite base paths
   */
  public setTunnelId(tunnelId: string) {
    this.tunnelId = tunnelId;
    console.log(`DevServerManager: Tunnel ID set to ${tunnelId}`);
  }

  private setupIpcHandlers() {
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

      const installProcess = spawn(packageManager, args, {
        cwd: folderPath,
        shell: true,
        env: cleanEnv
      });

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

  private async startServer(folderPath: string): Promise<ServerInfo> {
    // Check if server already running
    const existing = this.servers.get(folderPath);
    if (existing && existing.status === 'running') {
      return existing;
    }

    // Analyze folder
    const projectInfo = await this.analyzeFolder(folderPath);

    if (!projectInfo.hasPackageJson) {
      throw new Error('No package.json found in folder');
    }

    // Install dependencies if needed
    if (!projectInfo.hasNodeModules) {
      await this.installDependencies(folderPath, projectInfo.packageManager);
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

    // Spawn the dev server process
    const serverProcess = spawn(command, args, {
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

  private async stopServer(folderPath: string): Promise<void> {
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
