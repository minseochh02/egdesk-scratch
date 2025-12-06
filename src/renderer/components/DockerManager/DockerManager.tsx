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

interface RunContainerConfig {
  imageName: string;
  containerName: string;
  hostPort: string;
  containerPort: string;
  envVars: string;
}

export const DockerManager: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    'containers' | 'images' | 'logs'
  >('containers');
  const [selectedContainer, setSelectedContainer] = useState<string | null>(
    null,
  );
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Run container modal state
  const [showRunModal, setShowRunModal] = useState(false);
  const [runConfig, setRunConfig] = useState<RunContainerConfig>({
    imageName: '',
    containerName: '',
    hostPort: '',
    containerPort: '',
    envVars: '',
  });
  const [isRunning, setIsRunning] = useState(false);

  // Check Docker connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const result = await window.electron.docker.checkConnection();
      setIsConnected(result.connected);
      setConnectionError(result.error || null);
      if (result.connected) {
        await refreshContainers();
        await refreshImages();
      }
    } catch (error: any) {
      setIsConnected(false);
      setConnectionError(error.message || 'Failed to connect');
    }
    setLoading(false);
  };

  const refreshContainers = async () => {
    try {
      const containerList = await window.electron.docker.listContainers({
        all: true,
      });
      setContainers(containerList || []);
    } catch (error) {
      console.error('Failed to list containers:', error);
    }
  };

  const refreshImages = async () => {
    try {
      const imageList = await window.electron.docker.listImages();
      setImages(imageList || []);
    } catch (error) {
      console.error('Failed to list images:', error);
    }
  };

  const handleStartContainer = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      const result = await window.electron.docker.startContainer(containerId);
      if (result.success) {
        await refreshContainers();
      } else {
        alert(`Failed to start container: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setActionLoading(null);
  };

  const handleStopContainer = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      const result = await window.electron.docker.stopContainer(containerId);
      if (result.success) {
        await refreshContainers();
      } else {
        alert(`Failed to stop container: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setActionLoading(null);
  };

  const handleRestartContainer = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      const result = await window.electron.docker.restartContainer(containerId);
      if (result.success) {
        await refreshContainers();
      } else {
        alert(`Failed to restart container: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setActionLoading(null);
  };

  const handleRemoveContainer = async (containerId: string) => {
    if (!confirm('Are you sure you want to remove this container?')) return;
    setActionLoading(containerId);
    try {
      const result = await window.electron.docker.removeContainer(containerId, {
        force: true,
      });
      if (result.success) {
        await refreshContainers();
        if (selectedContainer === containerId) {
          setSelectedContainer(null);
          setLogs('');
        }
      } else {
        alert(`Failed to remove container: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setActionLoading(null);
  };

  const handleViewLogs = async (containerId: string) => {
    setSelectedContainer(containerId);
    setSelectedTab('logs');
    try {
      const containerLogs = await window.electron.docker.getContainerLogs(
        containerId,
        {
          stdout: true,
          stderr: true,
          tail: 200,
        },
      );
      setLogs(containerLogs || 'No logs available');
    } catch (error: any) {
      setLogs(`Error fetching logs: ${error.message}`);
    }
  };

  const handlePullImage = async () => {
    if (!pullImageName.trim()) return;
    setIsPulling(true);
    try {
      const result = await window.electron.docker.pullImage(pullImageName);
      if (result.success) {
        await refreshImages();
        setPullImageName('');
      } else {
        alert(`Failed to pull image: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setIsPulling(false);
  };

  const handleRemoveImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to remove this image?')) return;
    try {
      const result = await window.electron.docker.removeImage(imageId);
      if (result.success) {
        await refreshImages();
      } else {
        alert(`Failed to remove image: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const openRunModal = (imageName: string) => {
    const baseName = imageName.split(':')[0].split('/').pop() || 'container';
    setRunConfig({
      imageName,
      containerName: `${baseName}-${Date.now().toString(36)}`,
      hostPort: '',
      containerPort: '',
      envVars: '',
    });
    setShowRunModal(true);
  };

  const handleRunContainer = async () => {
    if (!runConfig.imageName) return;
    
    setIsRunning(true);
    try {
      // Build container options
      const options: any = {
        Image: runConfig.imageName,
        name: runConfig.containerName || undefined,
        HostConfig: {},
      };

      // Add port bindings if specified
      if (runConfig.hostPort && runConfig.containerPort) {
        options.ExposedPorts = {
          [`${runConfig.containerPort}/tcp`]: {},
        };
        options.HostConfig.PortBindings = {
          [`${runConfig.containerPort}/tcp`]: [{ HostPort: runConfig.hostPort }],
        };
      }

      // Add environment variables if specified
      if (runConfig.envVars.trim()) {
        options.Env = runConfig.envVars
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && line.includes('='));
      }

      // Create the container
      const createResult = await window.electron.docker.createContainer(options);
      if (!createResult.success) {
        alert(`Failed to create container: ${createResult.error}`);
        setIsRunning(false);
        return;
      }

      // Start the container
      const startResult = await window.electron.docker.startContainer(
        createResult.containerId!,
      );
      if (!startResult.success) {
        alert(`Container created but failed to start: ${startResult.error}`);
      } else {
        setShowRunModal(false);
        setSelectedTab('containers');
      }

      await refreshContainers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
    setIsRunning(false);
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

  const getRunningCount = (): number => {
    return containers.filter((c) => c.State === 'running').length;
  };

  if (loading) {
    return (
      <div className="docker-manager">
        <div className="docker-loading">
          <div className="docker-spinner"></div>
          <p>Checking Docker connection...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="docker-manager">
        <div className="docker-disconnected">
          <div className="docker-icon">🐳</div>
          <h2>Docker Not Connected</h2>
          <p className="docker-error-message">
            {connectionError || 'Unable to connect to Docker daemon'}
          </p>
          <p className="docker-hint">
            Make sure Docker Desktop is installed and running.
          </p>
          <button onClick={checkConnection} className="docker-btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="docker-manager">
      <div className="docker-header">
        <div className="docker-header-left">
          <h1>🐳 Docker Manager</h1>
          <span className="docker-stats">
            {getRunningCount()} running / {containers.length} total
          </span>
        </div>
        <div className="docker-connection-status connected">
          <span className="docker-status-dot"></span>
          Connected
        </div>
      </div>

      <div className="docker-tabs">
        <button
          className={`docker-tab ${selectedTab === 'containers' ? 'active' : ''}`}
          onClick={() => setSelectedTab('containers')}
        >
          📦 Containers ({containers.length})
        </button>
        <button
          className={`docker-tab ${selectedTab === 'images' ? 'active' : ''}`}
          onClick={() => setSelectedTab('images')}
        >
          💿 Images ({images.length})
        </button>
        {selectedContainer && (
          <button
            className={`docker-tab ${selectedTab === 'logs' ? 'active' : ''}`}
            onClick={() => setSelectedTab('logs')}
          >
            📄 Logs
          </button>
        )}
      </div>

      <div className="docker-content">
        {selectedTab === 'containers' && (
          <div className="docker-panel">
            <div className="docker-panel-header">
              <h2>Containers</h2>
              <button onClick={refreshContainers} className="docker-btn-icon">
                🔄 Refresh
              </button>
            </div>
            <div className="docker-list">
              {containers.length === 0 ? (
                <div className="docker-empty-state">
                  <p>No containers found</p>
                  <p className="docker-hint">
                    Pull an image and create a container to get started
                  </p>
                </div>
              ) : (
                containers.map((container) => (
                  <div
                    key={container.Id}
                    className={`docker-card docker-card-${container.State}`}
                  >
                    <div className="docker-card-info">
                      <div className="docker-card-header">
                        <span className="docker-card-name">
                          {getContainerName(container)}
                        </span>
                        <span
                          className={`docker-state-badge docker-state-${container.State}`}
                        >
                          {container.State}
                        </span>
                      </div>
                      <div className="docker-card-image">{container.Image}</div>
                      <div className="docker-card-status">
                        {container.Status}
                      </div>
                      {container.Ports.length > 0 && (
                        <div className="docker-card-ports">
                          {container.Ports.filter((p) => p.PublicPort).map(
                            (port, i) => (
                              <span key={i} className="docker-port-badge">
                                {port.PublicPort}:{port.PrivatePort}/
                                {port.Type}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                    <div className="docker-card-actions">
                      {actionLoading === container.Id ? (
                        <div className="docker-action-loading">
                          <div className="docker-spinner-small"></div>
                        </div>
                      ) : (
                        <>
                          {container.State === 'running' ? (
                            <>
                              <button
                                onClick={() =>
                                  handleStopContainer(container.Id)
                                }
                                className="docker-btn-stop"
                                title="Stop"
                              >
                                ⏹
                              </button>
                              <button
                                onClick={() =>
                                  handleRestartContainer(container.Id)
                                }
                                className="docker-btn-restart"
                                title="Restart"
                              >
                                🔄
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                handleStartContainer(container.Id)
                              }
                              className="docker-btn-start"
                              title="Start"
                            >
                              ▶
                            </button>
                          )}
                          <button
                            onClick={() => handleViewLogs(container.Id)}
                            className="docker-btn-logs"
                            title="View Logs"
                          >
                            📄
                          </button>
                          <button
                            onClick={() => handleRemoveContainer(container.Id)}
                            className="docker-btn-remove"
                            title="Remove"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'images' && (
          <div className="docker-panel">
            <div className="docker-panel-header">
              <h2>Images</h2>
              <div className="docker-pull-form">
                <input
                  type="text"
                  placeholder="Image name (e.g., nginx:latest)"
                  value={pullImageName}
                  onChange={(e) => setPullImageName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePullImage()}
                  className="docker-input"
                />
                <button
                  onClick={handlePullImage}
                  disabled={isPulling || !pullImageName.trim()}
                  className="docker-btn-primary"
                >
                  {isPulling ? '⏳ Pulling...' : '⬇ Pull'}
                </button>
              </div>
              <button onClick={refreshImages} className="docker-btn-icon">
                🔄 Refresh
              </button>
            </div>
            <div className="docker-list">
              {images.length === 0 ? (
                <div className="docker-empty-state">
                  <p>No images found</p>
                  <p className="docker-hint">
                    Pull an image using the form above
                  </p>
                </div>
              ) : (
                images.map((image) => (
                  <div key={image.Id} className="docker-card docker-card-image">
                    <div className="docker-card-info">
                      <div className="docker-image-tags">
                        {image.RepoTags?.map((tag, i) => (
                          <span key={i} className="docker-tag-badge">
                            {tag}
                          </span>
                        )) || (
                          <span className="docker-tag-badge docker-tag-none">
                            &lt;none&gt;
                          </span>
                        )}
                      </div>
                      <div className="docker-image-meta">
                        <span>Size: {formatBytes(image.Size)}</span>
                        <span>Created: {formatDate(image.Created)}</span>
                      </div>
                    </div>
                    <div className="docker-card-actions">
                      <button
                        onClick={() =>
                          openRunModal(image.RepoTags?.[0] || image.Id)
                        }
                        className="docker-btn-run"
                        title="Run Container"
                      >
                        ▶
                      </button>
                      <button
                        onClick={() => handleRemoveImage(image.Id)}
                        className="docker-btn-remove"
                        title="Remove Image"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'logs' && selectedContainer && (
          <div className="docker-panel docker-logs-panel">
            <div className="docker-panel-header">
              <h2>
                Container Logs:{' '}
                {containers.find((c) => c.Id === selectedContainer)?.Names[0]?.replace(/^\//, '') || selectedContainer.slice(0, 12)}
              </h2>
              <button
                onClick={() => handleViewLogs(selectedContainer)}
                className="docker-btn-icon"
              >
                🔄 Refresh
              </button>
            </div>
            <pre className="docker-logs-content">{logs}</pre>
          </div>
        )}
      </div>

      {/* Run Container Modal */}
      {showRunModal && (
        <div className="docker-modal-overlay" onClick={() => !isRunning && setShowRunModal(false)}>
          <div className="docker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="docker-modal-header">
              <h2>▶ Run Container</h2>
              <button
                className="docker-modal-close"
                onClick={() => !isRunning && setShowRunModal(false)}
                disabled={isRunning}
              >
                ✕
              </button>
            </div>
            <div className="docker-modal-body">
              <div className="docker-form-group">
                <label>Image</label>
                <input
                  type="text"
                  value={runConfig.imageName}
                  readOnly
                  className="docker-input docker-input-readonly"
                />
              </div>
              <div className="docker-form-group">
                <label>Container Name (optional)</label>
                <input
                  type="text"
                  placeholder="my-container"
                  value={runConfig.containerName}
                  onChange={(e) =>
                    setRunConfig({ ...runConfig, containerName: e.target.value })
                  }
                  className="docker-input"
                  disabled={isRunning}
                />
              </div>
              <div className="docker-form-row">
                <div className="docker-form-group">
                  <label>Host Port</label>
                  <input
                    type="text"
                    placeholder="8080"
                    value={runConfig.hostPort}
                    onChange={(e) =>
                      setRunConfig({ ...runConfig, hostPort: e.target.value })
                    }
                    className="docker-input"
                    disabled={isRunning}
                  />
                </div>
                <span className="docker-form-separator">:</span>
                <div className="docker-form-group">
                  <label>Container Port</label>
                  <input
                    type="text"
                    placeholder="80"
                    value={runConfig.containerPort}
                    onChange={(e) =>
                      setRunConfig({ ...runConfig, containerPort: e.target.value })
                    }
                    className="docker-input"
                    disabled={isRunning}
                  />
                </div>
              </div>
              <div className="docker-form-group">
                <label>Environment Variables (one per line, KEY=VALUE)</label>
                <textarea
                  placeholder="NODE_ENV=production&#10;PORT=3000"
                  value={runConfig.envVars}
                  onChange={(e) =>
                    setRunConfig({ ...runConfig, envVars: e.target.value })
                  }
                  className="docker-textarea"
                  rows={3}
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="docker-modal-footer">
              <button
                onClick={() => setShowRunModal(false)}
                className="docker-btn-secondary"
                disabled={isRunning}
              >
                Cancel
              </button>
              <button
                onClick={handleRunContainer}
                className="docker-btn-primary docker-btn-run-confirm"
                disabled={isRunning}
              >
                {isRunning ? '⏳ Starting...' : '▶ Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerManager;

