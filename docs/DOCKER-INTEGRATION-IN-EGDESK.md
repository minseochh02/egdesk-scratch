# Docker Integration in EGDesk

This guide explains how to integrate Docker management functionality directly INTO the EGDesk Electron application, allowing users to manage Docker containers from within the app.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Implementation Guide](#implementation-guide)
  - [1. Main Process - Docker Service](#1-main-process---docker-service)
  - [2. Preload Script - IPC Bridge](#2-preload-script---ipc-bridge)
  - [3. Renderer Process - React Components](#3-renderer-process---react-components)
- [API Reference](#api-reference)
- [UI Component Examples](#ui-component-examples)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Overview

By integrating Docker into EGDesk, users can:
- **List all containers** (running and stopped)
- **Start/Stop/Restart containers**
- **View container logs** in real-time
- **Pull Docker images**
- **Create new containers**
- **View system information** (Docker version, disk usage, etc.)
- **Manage Docker networks and volumes**

This is achieved using the **`dockerode`** library, which provides a Node.js wrapper around the Docker Engine API.

---

## Prerequisites

1. **Docker Desktop** must be installed on the user's machine
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
   
2. **Docker daemon** must be running
   - On macOS/Windows: Docker Desktop handles this
   - On Linux: `sudo systemctl start docker`

3. **User permissions** to access Docker socket
   - On Linux: User must be in the `docker` group
   ```bash
   sudo usermod -aG docker $USER
   ```

---

## Installation

### Step 1: Install Dependencies

```bash
# Navigate to the egdesk-scratch directory
cd egdesk-scratch

# Install dockerode and its TypeScript types
npm install dockerode
npm install --save-dev @types/dockerode
```

### Step 2: Add to release/app/package.json

Make sure `dockerode` is also in the release app's dependencies:

```json
{
  "dependencies": {
    "dockerode": "^4.0.2"
  }
}
```

Then run:
```bash
cd release/app && npm install
```

---

## Implementation Guide

### 1. Main Process - Docker Service

Create a new Docker service in the main process to handle all Docker operations.

**Create file: `src/main/services/DockerService.ts`**

```typescript
import Docker from 'dockerode';
import { ipcMain, BrowserWindow } from 'electron';

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
    ipcMain.handle('docker:list-containers', async (_, options?: Docker.ContainerListOptions) => {
      return this.listContainers(options);
    });

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
    ipcMain.handle('docker:restart-container', async (_, containerId: string) => {
      return this.restartContainer(containerId);
    });

    // Remove container
    ipcMain.handle('docker:remove-container', async (_, containerId: string, options?: Docker.ContainerRemoveOptions) => {
      return this.removeContainer(containerId, options);
    });

    // Get container logs
    ipcMain.handle('docker:container-logs', async (_, containerId: string, options?: Docker.ContainerLogsOptions) => {
      return this.getContainerLogs(containerId, options);
    });

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
    ipcMain.handle('docker:create-container', async (_, options: Docker.ContainerCreateOptions) => {
      return this.createContainer(options);
    });

    // Get container stats
    ipcMain.handle('docker:container-stats', async (_, containerId: string) => {
      return this.getContainerStats(containerId);
    });

    // List networks
    ipcMain.handle('docker:list-networks', async () => {
      return this.listNetworks();
    });

    // List volumes
    ipcMain.handle('docker:list-volumes', async () => {
      return this.listVolumes();
    });

    // Execute command in container
    ipcMain.handle('docker:exec', async (_, containerId: string, cmd: string[]) => {
      return this.execInContainer(containerId, cmd);
    });
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
    } catch (error: any) {
      this.isConnected = false;
      return { 
        connected: false, 
        error: error.message || 'Failed to connect to Docker daemon' 
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

  async listContainers(options: Docker.ContainerListOptions = { all: true }): Promise<Docker.ContainerInfo[]> {
    if (!this.docker) return [];
    try {
      return await this.docker.listContainers(options);
    } catch (error) {
      console.error('Failed to list containers:', error);
      return [];
    }
  }

  async getContainer(containerId: string): Promise<Docker.ContainerInspectInfo | null> {
    if (!this.docker) return null;
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      console.error(`Failed to get container ${containerId}:`, error);
      return null;
    }
  }

  async startContainer(containerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async stopContainer(containerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async restartContainer(containerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async removeContainer(
    containerId: string, 
    options: Docker.ContainerRemoveOptions = { force: false, v: false }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove(options);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getContainerLogs(
    containerId: string,
    options: Docker.ContainerLogsOptions = { follow: false, stdout: true, stderr: true, tail: 100 }
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

  async pullImage(imageName: string, sender?: Electron.WebContents): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
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
          (event: any) => {
            // Send progress updates to renderer
            if (sender) {
              sender.send('docker:pull-progress', { imageName, ...event });
            }
          }
        );
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async removeImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const image = this.docker.getImage(imageId);
      await image.remove();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createContainer(options: Docker.ContainerCreateOptions): Promise<{ success: boolean; containerId?: string; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
    try {
      const container = await this.docker.createContainer(options);
      return { success: true, containerId: container.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getContainerStats(containerId: string): Promise<Docker.ContainerStats | null> {
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

  async listVolumes(): Promise<{ Volumes: Docker.VolumeInspectInfo[] } | null> {
    if (!this.docker) return null;
    try {
      return await this.docker.listVolumes();
    } catch (error) {
      console.error('Failed to list volumes:', error);
      return null;
    }
  }

  async execInContainer(containerId: string, cmd: string[]): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!this.docker) return { success: false, error: 'Docker not initialized' };
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
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const dockerService = new DockerService();
```

### 2. Preload Script - IPC Bridge

Add Docker-related IPC channels to your preload script.

**Add to `src/main/preload.ts`:**

```typescript
// Add to your existing preload.ts contextBridge.exposeInMainWorld

// Docker API
docker: {
  // Connection
  checkConnection: () => ipcRenderer.invoke('docker:check-connection'),
  getInfo: () => ipcRenderer.invoke('docker:info'),
  
  // Containers
  listContainers: (options?: any) => ipcRenderer.invoke('docker:list-containers', options),
  getContainer: (containerId: string) => ipcRenderer.invoke('docker:get-container', containerId),
  startContainer: (containerId: string) => ipcRenderer.invoke('docker:start-container', containerId),
  stopContainer: (containerId: string) => ipcRenderer.invoke('docker:stop-container', containerId),
  restartContainer: (containerId: string) => ipcRenderer.invoke('docker:restart-container', containerId),
  removeContainer: (containerId: string, options?: any) => ipcRenderer.invoke('docker:remove-container', containerId, options),
  getContainerLogs: (containerId: string, options?: any) => ipcRenderer.invoke('docker:container-logs', containerId, options),
  getContainerStats: (containerId: string) => ipcRenderer.invoke('docker:container-stats', containerId),
  execInContainer: (containerId: string, cmd: string[]) => ipcRenderer.invoke('docker:exec', containerId, cmd),
  
  // Images
  listImages: () => ipcRenderer.invoke('docker:list-images'),
  pullImage: (imageName: string) => ipcRenderer.invoke('docker:pull-image', imageName),
  removeImage: (imageId: string) => ipcRenderer.invoke('docker:remove-image', imageId),
  
  // Create
  createContainer: (options: any) => ipcRenderer.invoke('docker:create-container', options),
  
  // Networks & Volumes
  listNetworks: () => ipcRenderer.invoke('docker:list-networks'),
  listVolumes: () => ipcRenderer.invoke('docker:list-volumes'),
  
  // Events
  onPullProgress: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('docker:pull-progress', subscription);
    return () => ipcRenderer.removeListener('docker:pull-progress', subscription);
  },
},
```

**Update `src/main/preload.d.ts` (TypeScript declarations):**

```typescript
// Add to ElectronHandler interface
docker: {
  checkConnection: () => Promise<{ connected: boolean; error?: string }>;
  getInfo: () => Promise<any>;
  listContainers: (options?: any) => Promise<any[]>;
  getContainer: (containerId: string) => Promise<any>;
  startContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  stopContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  restartContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  removeContainer: (containerId: string, options?: any) => Promise<{ success: boolean; error?: string }>;
  getContainerLogs: (containerId: string, options?: any) => Promise<string>;
  getContainerStats: (containerId: string) => Promise<any>;
  execInContainer: (containerId: string, cmd: string[]) => Promise<{ success: boolean; output?: string; error?: string }>;
  listImages: () => Promise<any[]>;
  pullImage: (imageName: string) => Promise<{ success: boolean; error?: string }>;
  removeImage: (imageId: string) => Promise<{ success: boolean; error?: string }>;
  createContainer: (options: any) => Promise<{ success: boolean; containerId?: string; error?: string }>;
  listNetworks: () => Promise<any[]>;
  listVolumes: () => Promise<any>;
  onPullProgress: (callback: (data: any) => void) => () => void;
};
```

### 3. Renderer Process - React Components

**Create file: `src/renderer/components/DockerManager/DockerManager.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import './DockerManager.css';

interface Container {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: Array<{ PublicPort?: number; PrivatePort: number; Type: string }>;
  Created: number;
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

export const DockerManager: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [selectedTab, setSelectedTab] = useState<'containers' | 'images' | 'logs'>('containers');
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [isPulling, setIsPulling] = useState(false);

  // Check Docker connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    const result = await window.electron.docker.checkConnection();
    setIsConnected(result.connected);
    setConnectionError(result.error || null);
    if (result.connected) {
      await refreshContainers();
      await refreshImages();
    }
    setLoading(false);
  };

  const refreshContainers = async () => {
    const containerList = await window.electron.docker.listContainers({ all: true });
    setContainers(containerList);
  };

  const refreshImages = async () => {
    const imageList = await window.electron.docker.listImages();
    setImages(imageList);
  };

  const handleStartContainer = async (containerId: string) => {
    const result = await window.electron.docker.startContainer(containerId);
    if (result.success) {
      await refreshContainers();
    } else {
      alert(`Failed to start container: ${result.error}`);
    }
  };

  const handleStopContainer = async (containerId: string) => {
    const result = await window.electron.docker.stopContainer(containerId);
    if (result.success) {
      await refreshContainers();
    } else {
      alert(`Failed to stop container: ${result.error}`);
    }
  };

  const handleRestartContainer = async (containerId: string) => {
    const result = await window.electron.docker.restartContainer(containerId);
    if (result.success) {
      await refreshContainers();
    } else {
      alert(`Failed to restart container: ${result.error}`);
    }
  };

  const handleRemoveContainer = async (containerId: string) => {
    if (!confirm('Are you sure you want to remove this container?')) return;
    const result = await window.electron.docker.removeContainer(containerId, { force: true });
    if (result.success) {
      await refreshContainers();
      if (selectedContainer === containerId) {
        setSelectedContainer(null);
        setLogs('');
      }
    } else {
      alert(`Failed to remove container: ${result.error}`);
    }
  };

  const handleViewLogs = async (containerId: string) => {
    setSelectedContainer(containerId);
    setSelectedTab('logs');
    const containerLogs = await window.electron.docker.getContainerLogs(containerId, {
      stdout: true,
      stderr: true,
      tail: 200,
    });
    setLogs(containerLogs);
  };

  const handlePullImage = async () => {
    if (!pullImageName.trim()) return;
    setIsPulling(true);
    const result = await window.electron.docker.pullImage(pullImageName);
    if (result.success) {
      await refreshImages();
      setPullImageName('');
    } else {
      alert(`Failed to pull image: ${result.error}`);
    }
    setIsPulling(false);
  };

  const handleRemoveImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to remove this image?')) return;
    const result = await window.electron.docker.removeImage(imageId);
    if (result.success) {
      await refreshImages();
    } else {
      alert(`Failed to remove image: ${result.error}`);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getContainerName = (container: Container): string => {
    return container.Names[0]?.replace(/^\//, '') || container.Id.slice(0, 12);
  };

  if (loading) {
    return (
      <div className="docker-manager">
        <div className="docker-loading">
          <span className="spinner"></span>
          Checking Docker connection...
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="docker-manager">
        <div className="docker-disconnected">
          <div className="icon">🐳</div>
          <h2>Docker Not Connected</h2>
          <p>{connectionError || 'Unable to connect to Docker daemon'}</p>
          <p className="hint">
            Make sure Docker Desktop is installed and running.
          </p>
          <button onClick={checkConnection} className="btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="docker-manager">
      <div className="docker-header">
        <h1>🐳 Docker Manager</h1>
        <div className="connection-status connected">
          <span className="status-dot"></span>
          Connected
        </div>
      </div>

      <div className="docker-tabs">
        <button
          className={`tab ${selectedTab === 'containers' ? 'active' : ''}`}
          onClick={() => setSelectedTab('containers')}
        >
          Containers ({containers.length})
        </button>
        <button
          className={`tab ${selectedTab === 'images' ? 'active' : ''}`}
          onClick={() => setSelectedTab('images')}
        >
          Images ({images.length})
        </button>
        {selectedContainer && (
          <button
            className={`tab ${selectedTab === 'logs' ? 'active' : ''}`}
            onClick={() => setSelectedTab('logs')}
          >
            Logs
          </button>
        )}
      </div>

      <div className="docker-content">
        {selectedTab === 'containers' && (
          <div className="containers-panel">
            <div className="panel-header">
              <h2>Containers</h2>
              <button onClick={refreshContainers} className="btn-secondary">
                🔄 Refresh
              </button>
            </div>
            <div className="container-list">
              {containers.length === 0 ? (
                <div className="empty-state">No containers found</div>
              ) : (
                containers.map((container) => (
                  <div key={container.Id} className={`container-card ${container.State}`}>
                    <div className="container-info">
                      <div className="container-name">{getContainerName(container)}</div>
                      <div className="container-image">{container.Image}</div>
                      <div className="container-status">
                        <span className={`state-badge ${container.State}`}>
                          {container.State}
                        </span>
                        <span className="status-text">{container.Status}</span>
                      </div>
                      {container.Ports.length > 0 && (
                        <div className="container-ports">
                          {container.Ports.filter(p => p.PublicPort).map((port, i) => (
                            <span key={i} className="port-badge">
                              {port.PublicPort}:{port.PrivatePort}/{port.Type}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="container-actions">
                      {container.State === 'running' ? (
                        <>
                          <button onClick={() => handleStopContainer(container.Id)} className="btn-stop">
                            ⏹ Stop
                          </button>
                          <button onClick={() => handleRestartContainer(container.Id)} className="btn-restart">
                            🔄 Restart
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleStartContainer(container.Id)} className="btn-start">
                          ▶ Start
                        </button>
                      )}
                      <button onClick={() => handleViewLogs(container.Id)} className="btn-logs">
                        📄 Logs
                      </button>
                      <button onClick={() => handleRemoveContainer(container.Id)} className="btn-remove">
                        🗑 Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'images' && (
          <div className="images-panel">
            <div className="panel-header">
              <h2>Images</h2>
              <div className="pull-image-form">
                <input
                  type="text"
                  placeholder="Image name (e.g., nginx:latest)"
                  value={pullImageName}
                  onChange={(e) => setPullImageName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePullImage()}
                />
                <button onClick={handlePullImage} disabled={isPulling} className="btn-primary">
                  {isPulling ? '⏳ Pulling...' : '⬇ Pull'}
                </button>
              </div>
              <button onClick={refreshImages} className="btn-secondary">
                🔄 Refresh
              </button>
            </div>
            <div className="image-list">
              {images.length === 0 ? (
                <div className="empty-state">No images found</div>
              ) : (
                images.map((image) => (
                  <div key={image.Id} className="image-card">
                    <div className="image-info">
                      <div className="image-tags">
                        {image.RepoTags?.map((tag, i) => (
                          <span key={i} className="tag-badge">{tag}</span>
                        )) || <span className="tag-badge none">&lt;none&gt;</span>}
                      </div>
                      <div className="image-meta">
                        <span>Size: {formatBytes(image.Size)}</span>
                        <span>Created: {formatDate(image.Created)}</span>
                      </div>
                    </div>
                    <div className="image-actions">
                      <button onClick={() => handleRemoveImage(image.Id)} className="btn-remove">
                        🗑 Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'logs' && selectedContainer && (
          <div className="logs-panel">
            <div className="panel-header">
              <h2>Container Logs</h2>
              <button onClick={() => handleViewLogs(selectedContainer)} className="btn-secondary">
                🔄 Refresh
              </button>
            </div>
            <pre className="logs-content">{logs || 'No logs available'}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
```

**Create file: `src/renderer/components/DockerManager/DockerManager.css`**

```css
.docker-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #1a1a2e);
  color: var(--text-primary, #eee);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.docker-loading,
.docker-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;
}

.docker-disconnected .icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.docker-disconnected h2 {
  margin: 0 0 0.5rem;
  color: #ff6b6b;
}

.docker-disconnected .hint {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #333;
  border-top-color: #0984e3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.docker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary, #16213e);
  border-bottom: 1px solid var(--border-color, #2a2a4a);
}

.docker-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.connection-status.connected {
  color: #00b894;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.docker-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1.5rem;
  background: var(--bg-secondary, #16213e);
  border-bottom: 1px solid var(--border-color, #2a2a4a);
}

.tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.tab.active {
  background: var(--accent-color, #0984e3);
  color: #fff;
}

.docker-content {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  flex: 1;
}

.pull-image-form {
  display: flex;
  gap: 0.5rem;
}

.pull-image-form input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 4px;
  background: var(--bg-input, #0f0f1a);
  color: inherit;
  width: 250px;
}

.btn-primary,
.btn-secondary,
.btn-start,
.btn-stop,
.btn-restart,
.btn-logs,
.btn-remove {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-color, #0984e3);
  color: #fff;
}

.btn-secondary {
  background: var(--bg-secondary, #2a2a4a);
  color: #fff;
}

.btn-start {
  background: #00b894;
  color: #fff;
}

.btn-stop {
  background: #ff7675;
  color: #fff;
}

.btn-restart {
  background: #fdcb6e;
  color: #333;
}

.btn-logs {
  background: #74b9ff;
  color: #fff;
}

.btn-remove {
  background: transparent;
  color: #ff7675;
  border: 1px solid #ff7675;
}

.btn-primary:hover,
.btn-secondary:hover,
.btn-start:hover,
.btn-stop:hover,
.btn-restart:hover,
.btn-logs:hover {
  filter: brightness(1.1);
}

.btn-remove:hover {
  background: #ff7675;
  color: #fff;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.container-list,
.image-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.container-card,
.image-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-card, #1e1e3a);
  border-radius: 8px;
  border-left: 4px solid #888;
}

.container-card.running {
  border-left-color: #00b894;
}

.container-card.exited {
  border-left-color: #ff7675;
}

.container-card.paused {
  border-left-color: #fdcb6e;
}

.container-info,
.image-info {
  flex: 1;
}

.container-name {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.container-image {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.container-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.state-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}

.state-badge.running {
  background: rgba(0, 184, 148, 0.2);
  color: #00b894;
}

.state-badge.exited {
  background: rgba(255, 118, 117, 0.2);
  color: #ff7675;
}

.state-badge.paused {
  background: rgba(253, 203, 110, 0.2);
  color: #fdcb6e;
}

.status-text {
  color: #888;
  font-size: 0.85rem;
}

.container-ports {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.port-badge {
  padding: 0.2rem 0.5rem;
  background: rgba(116, 185, 255, 0.2);
  color: #74b9ff;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
}

.container-actions,
.image-actions {
  display: flex;
  gap: 0.5rem;
}

.image-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.tag-badge {
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary, #2a2a4a);
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: monospace;
}

.tag-badge.none {
  color: #888;
}

.image-meta {
  display: flex;
  gap: 1.5rem;
  color: #888;
  font-size: 0.85rem;
}

.logs-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.logs-content {
  flex: 1;
  background: var(--bg-input, #0f0f1a);
  border-radius: 8px;
  padding: 1rem;
  overflow: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #888;
}
```

---

## API Reference

### Containers

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `listContainers(options?)` | `{ all?: boolean }` | `Container[]` | List all containers |
| `getContainer(id)` | `string` | `ContainerInfo` | Get container details |
| `startContainer(id)` | `string` | `{ success, error? }` | Start a container |
| `stopContainer(id)` | `string` | `{ success, error? }` | Stop a container |
| `restartContainer(id)` | `string` | `{ success, error? }` | Restart a container |
| `removeContainer(id, options?)` | `string, { force?, v? }` | `{ success, error? }` | Remove a container |
| `getContainerLogs(id, options?)` | `string, { tail?, stdout?, stderr? }` | `string` | Get container logs |
| `getContainerStats(id)` | `string` | `Stats` | Get container resource stats |
| `execInContainer(id, cmd)` | `string, string[]` | `{ success, output?, error? }` | Execute command in container |

### Images

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `listImages()` | - | `Image[]` | List all images |
| `pullImage(name)` | `string` | `{ success, error? }` | Pull an image from registry |
| `removeImage(id)` | `string` | `{ success, error? }` | Remove an image |

### System

| Method | Returns | Description |
|--------|---------|-------------|
| `checkConnection()` | `{ connected, error? }` | Check Docker daemon connection |
| `getInfo()` | `DockerInfo` | Get Docker system info |
| `listNetworks()` | `Network[]` | List Docker networks |
| `listVolumes()` | `{ Volumes: Volume[] }` | List Docker volumes |

---

## Security Considerations

### 1. Docker Socket Access
The app requires access to the Docker socket:
- **Unix**: `/var/run/docker.sock`
- **Windows**: `//./pipe/docker_engine`

This gives full Docker access - users should understand the implications.

### 2. User Permissions
- On Linux, users must be in the `docker` group
- On Windows/macOS, Docker Desktop handles permissions

### 3. Container Operations
- Implement confirmation dialogs for destructive operations
- Consider adding role-based access for team environments

### 4. Network Access
- Containers may expose ports - warn users about security implications
- Consider implementing port whitelisting

---

## Troubleshooting

### "Cannot connect to Docker daemon"
1. Ensure Docker Desktop is running
2. Check socket path:
   - macOS/Linux: `ls -la /var/run/docker.sock`
   - Windows: Check Docker Desktop settings
3. On Linux, ensure user is in docker group:
   ```bash
   sudo usermod -aG docker $USER
   # Then log out and back in
   ```

### "Permission denied"
- On Linux: Add user to docker group (see above)
- On macOS: Restart Docker Desktop
- On Windows: Run as administrator or check Docker Desktop settings

### "ENOENT: no such file or directory"
Docker socket not found - Docker may not be installed or running.

### Containers not appearing
- Ensure `all: true` option is passed to `listContainers`
- Check Docker Desktop dashboard to compare

### Logs not loading
- Container may not have any logs yet
- Try increasing the `tail` option value

---

## Summary

This guide covers integrating Docker management INTO your EGDesk app using:

1. **`dockerode`** - Node.js Docker SDK
2. **IPC communication** - Main ↔ Renderer bridge
3. **React components** - User interface

Users can now manage Docker containers, images, and view logs directly within EGDesk without leaving the app!

## Resources

- [Dockerode GitHub](https://github.com/apocas/dockerode)
- [Dockerode Documentation](https://www.npmjs.com/package/dockerode)
- [Docker Engine API](https://docs.docker.com/engine/api/)
- [Dockeron - Electron Docker App](https://dockeron.github.io/dockeron/)

