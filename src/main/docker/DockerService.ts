import Docker from 'dockerode';
import { ipcMain } from 'electron';

// Docker connection options by platform
const getDockerOptions = (): Docker.DockerOptions => {
  if (process.platform === 'win32') {
    // Windows: Use named pipe
    return { socketPath: '//./pipe/docker_engine' };
  }
  // macOS and Linux: Use Unix socket
  return { socketPath: '/var/run/docker.sock' };
};

class DockerService {
  private docker: Docker | null = null;
  private isConnected = false;

  constructor() {
    this.initializeDocker();
    this.registerIPCHandlers();
  }

  private initializeDocker(): void {
    try {
      this.docker = new Docker(getDockerOptions());
      this.isConnected = true;
      console.log('🐳 Docker service initialized');
    } catch (error) {
      console.error('Failed to initialize Docker:', error);
      this.isConnected = false;
    }
  }

  private registerIPCHandlers(): void {
    // Check Docker connection
    ipcMain.handle('docker:check-connection', async () => {
      return this.checkConnection();
    });

    // Get Docker info
    ipcMain.handle('docker:info', async () => {
      return this.getInfo();
    });

    // List containers
    ipcMain.handle(
      'docker:list-containers',
      async (_, options?: Docker.ContainerListOptions) => {
        return this.listContainers(options);
      },
    );

    // Get container by ID
    ipcMain.handle('docker:get-container', async (_, containerId: string) => {
      return this.getContainer(containerId);
    });

    // Start container
    ipcMain.handle('docker:start-container', async (_, containerId: string) => {
      return this.startContainer(containerId);
    });

    // Stop container
    ipcMain.handle('docker:stop-container', async (_, containerId: string) => {
      return this.stopContainer(containerId);
    });

    // Restart container
    ipcMain.handle(
      'docker:restart-container',
      async (_, containerId: string) => {
        return this.restartContainer(containerId);
      },
    );

    // Remove container
    ipcMain.handle(
      'docker:remove-container',
      async (
        _,
        containerId: string,
        options?: Docker.ContainerRemoveOptions,
      ) => {
        return this.removeContainer(containerId, options);
      },
    );

    // Get container logs
    ipcMain.handle(
      'docker:container-logs',
      async (
        _,
        containerId: string,
        options?: Docker.ContainerLogsOptions,
      ) => {
        return this.getContainerLogs(containerId, options);
      },
    );

    // List images
    ipcMain.handle('docker:list-images', async () => {
      return this.listImages();
    });

    // Pull image
    ipcMain.handle('docker:pull-image', async (event, imageName: string) => {
      return this.pullImage(imageName, event.sender);
    });

    // Remove image
    ipcMain.handle('docker:remove-image', async (_, imageId: string) => {
      return this.removeImage(imageId);
    });

    // Create container
    ipcMain.handle(
      'docker:create-container',
      async (_, options: Docker.ContainerCreateOptions) => {
        return this.createContainer(options);
      },
    );

    // Get container stats
    ipcMain.handle(
      'docker:container-stats',
      async (_, containerId: string) => {
        return this.getContainerStats(containerId);
      },
    );

    // List networks
    ipcMain.handle('docker:list-networks', async () => {
      return this.listNetworks();
    });

    // List volumes
    ipcMain.handle('docker:list-volumes', async () => {
      return this.listVolumes();
    });

    // Execute command in container
    ipcMain.handle(
      'docker:exec',
      async (_, containerId: string, cmd: string[]) => {
        return this.execInContainer(containerId, cmd);
      },
    );
  }

  // ============================================
  // Docker Methods
  // ============================================

  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.docker) {
      return { connected: false, error: 'Docker not initialized' };
    }

    try {
      await this.docker.ping();
      this.isConnected = true;
      return { connected: true };
    } catch (error: unknown) {
      this.isConnected = false;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to connect to Docker daemon';
      return {
        connected: false,
        error: errorMessage,
      };
    }
  }

  async getInfo(): Promise<Docker.DockerInfo | null> {
    if (!this.docker) return null;
    try {
      return await this.docker.info();
    } catch (error) {
      console.error('Failed to get Docker info:', error);
      return null;
    }
  }

  async listContainers(
    options: Docker.ContainerListOptions = { all: true },
  ): Promise<Docker.ContainerInfo[]> {
    if (!this.docker) return [];
    try {
      return await this.docker.listContainers(options);
    } catch (error) {
      console.error('Failed to list containers:', error);
      return [];
    }
  }

  async getContainer(
    containerId: string,
  ): Promise<Docker.ContainerInspectInfo | null> {
    if (!this.docker) return null;
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      console.error(`Failed to get container ${containerId}:`, error);
      return null;
    }
  }

  async startContainer(
    containerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // HTTP 304 means container is already started - treat as success
      if (errorMessage.includes('304') || errorMessage.includes('already started')) {
        return { success: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  async stopContainer(
    containerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      // HTTP 304 means container is already stopped - treat as success
      if (errorMessage.includes('304') || errorMessage.includes('already stopped')) {
        return { success: true };
      }
      return { success: false, error: errorMessage };
    }
  }

  async restartContainer(
    containerId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async removeContainer(
    containerId: string,
    options: Docker.ContainerRemoveOptions = { force: false, v: false },
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove(options);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async getContainerLogs(
    containerId: string,
    options: Docker.ContainerLogsOptions = {
      follow: false,
      stdout: true,
      stderr: true,
      tail: 100,
    },
  ): Promise<string> {
    if (!this.docker) return '';
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs(options);
      // Convert buffer to string
      return logs.toString('utf8');
    } catch (error) {
      console.error(`Failed to get logs for ${containerId}:`, error);
      return '';
    }
  }

  async listImages(): Promise<Docker.ImageInfo[]> {
    if (!this.docker) return [];
    try {
      return await this.docker.listImages();
    } catch (error) {
      console.error('Failed to list images:', error);
      return [];
    }
  }

  async pullImage(
    imageName: string,
    sender?: Electron.WebContents,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const stream = await this.docker.pull(imageName);

      return new Promise((resolve) => {
        this.docker!.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              resolve({ success: false, error: err.message });
            } else {
              resolve({ success: true });
            }
          },
          (event: unknown) => {
            // Send progress updates to renderer
            if (sender) {
              sender.send('docker:pull-progress', { imageName, ...event });
            }
          },
        );
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async removeImage(
    imageId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const image = this.docker.getImage(imageId);
      await image.remove();
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async createContainer(
    options: Docker.ContainerCreateOptions,
  ): Promise<{ success: boolean; containerId?: string; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = await this.docker.createContainer(options);
      return { success: true, containerId: container.id };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async getContainerStats(
    containerId: string,
  ): Promise<Docker.ContainerStats | null> {
    if (!this.docker) return null;
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      return stats;
    } catch (error) {
      console.error(`Failed to get stats for ${containerId}:`, error);
      return null;
    }
  }

  async listNetworks(): Promise<Docker.NetworkInspectInfo[]> {
    if (!this.docker) return [];
    try {
      return await this.docker.listNetworks();
    } catch (error) {
      console.error('Failed to list networks:', error);
      return [];
    }
  }

  async listVolumes(): Promise<{
    Volumes: Docker.VolumeInspectInfo[];
    Warnings: string[];
  } | null> {
    if (!this.docker) return null;
    try {
      return await this.docker.listVolumes();
    } catch (error) {
      console.error('Failed to list volumes:', error);
      return null;
    }
  }

  async execInContainer(
    containerId: string,
    cmd: string[],
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.docker)
      return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false, Tty: false });

      return new Promise((resolve) => {
        let output = '';
        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf8');
        });
        stream.on('end', () => {
          resolve({ success: true, output });
        });
        stream.on('error', (err: Error) => {
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();

