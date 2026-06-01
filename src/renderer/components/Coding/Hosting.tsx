import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faPlus, faCopy, faStop, faPlay, faTerminal, faTrash, faChevronDown, faChevronUp, faArrowDown, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import '../Coding/Coding.css';
import { CODING_PORTS } from '../../../shared/coding-ports';
import ProjectContextService, { type ProjectInfo } from '../../services/projectContextService';

interface RegisteredProject {
  projectName: string;
  folderPath: string;
  port: number;
  url: string;
  status: 'running' | 'stopped' | 'error' | 'rebuilding' | 'starting';
  registeredAt: string;
  type?: 'nextjs' | 'vite' | 'react' | 'unknown';
  mode: 'dev' | 'production';
}

import ModeSelectionModal from '../Coding/ModeSelectionModal';

const Hosting: React.FC = () => {
  const navigate = useNavigate();
  const [registeredProjects, setRegisteredProjects] = useState<RegisteredProject[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectInfo[]>([]);
  const [nodeInstalled, setNodeInstalled] = useState<boolean | null>(null);
  const [nodeVersion, setNodeVersion] = useState<string>('');
  const [npmVersion, setNpmVersion] = useState<string>('');
  const [localIP, setLocalIP] = useState<string>('localhost');
  const [tunnelId, setTunnelId] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string[]>>({});
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState<Record<string, boolean>>({});
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [killLoading, setKillLoading] = useState(false);

  // Modal state
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<RegisteredProject | null>(null);
  const [pendingMode, setPendingMode] = useState<'dev' | 'production' | null>(null);

  // Check Node.js installation
  useEffect(() => {
    const checkNode = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('dev-server:check-node');
        if (result.success) {
          const hasNode = result.hasNode && result.hasNpm;
          setNodeInstalled(hasNode);
          setNodeVersion(result.nodeVersion || 'Not found');
          setNpmVersion(result.npmVersion || 'Not found');
        }
      } catch (error) {
        console.error('Failed to check Node.js:', error);
      }
    };

    checkNode();
  }, []);

  // Fetch local IP address
  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.httpsServer?.getNetworkInfo) return;

        const result = await electron.httpsServer.getNetworkInfo();
        if (result && result.localIP) {
          setLocalIP(result.localIP);
        }
      } catch (error) {
        console.error('Failed to fetch network info:', error);
      }
    };

    fetchNetworkInfo();
  }, []);

  // Get tunnel ID from Electron Store
  useEffect(() => {
    const fetchTunnelId = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('get-mcp-tunnel-config');
        const id = result.tunnel?.serverName;

        if (result.success && id) {
          setTunnelId(id);
        }
      } catch (err) {
        console.error('Failed to fetch tunnel config:', err);
      }
    };

    fetchTunnelId();

    // Poll every 5 seconds
    const interval = setInterval(fetchTunnelId, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to project context changes
  useEffect(() => {
    const unsubscribe = ProjectContextService.getInstance().subscribe((context) => {
      setAvailableProjects(context.availableProjects);
    });
    return () => unsubscribe();
  }, []);

  // Sync hosted project paths to electron-store so main process can auto-start on next launch
  useEffect(() => {
    const paths = availableProjects.map(p => p.path);
    const electron = (window as any).electron;
    if (electron?.ipcRenderer) {
      electron.ipcRenderer.invoke('hosting:persist-project-paths', paths).catch(console.error);
    }
  }, [availableProjects]);

  // Fetch projects from registry
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('project-registry:get-all');
        if (result.success && result.projects) {
          setRegisteredProjects(result.projects);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };

    // Fetch immediately
    fetchProjects();

    // Poll every 3 seconds to keep list updated
    const interval = setInterval(fetchProjects, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#4caf50';
      case 'starting':
      case 'rebuilding':
        return '#ff9800';
      case 'stopped':
        return '#9e9e9e';
      case 'error':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const handleCreateNew = async () => {
    try {
      const electron = (window as any).electron;
      if (!electron?.fileSystem?.pickFolder) {
        console.error('Electron file system API not available');
        return;
      }

      // Use Electron's folder picker
      const result = await electron.fileSystem.pickFolder();

      if (result.success && result.folderPath) {
        console.log('Selected folder:', result.folderPath);

        // Add to history
        await ProjectContextService.getInstance().setCurrentProject(result.folderPath);

        // Store folder path in localStorage for DeveloperWindow
        localStorage.setItem('selected-project-folder', result.folderPath);

        // Navigate to developer window
        navigate('/hosting/developer');
      } else if (result.error) {
        console.error('Failed to pick folder:', result.error);
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    }
  };

  const handleStartServer = async (folderPath: string) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) return;

      // Add to history
      await ProjectContextService.getInstance().setCurrentProject(folderPath);

      // Start in production mode for Hosting
      const result = await electron.ipcRenderer.invoke('dev-server:start', folderPath, 'production');
      if (!result.success) {
        alert(`Failed to start server: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting server:', error);
    }
  };

  const handleStopServer = async (folderPath: string, projectName: string) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) {
        console.error('Electron IPC not available');
        return;
      }

      const result = await electron.ipcRenderer.invoke('dev-server:stop', folderPath);

      if (result.success) {
        console.log(`Server stopped successfully for ${projectName}`);
      } else {
        console.error('Failed to stop server:', result.error);
      }
    } catch (error) {
      console.error('Error stopping server:', error);
    }
  };

  const handleRemoveFromHistory = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this project from history?')) {
      ProjectContextService.getInstance().removeProject(projectId);
    }
  };

  const killPortProcess = async (port: number) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) return;

      setKillLoading(true);
      console.log(`Attempting to kill process on port ${port}...`);
      const result = await electron.ipcRenderer.invoke('dev-server:kill-port', port);

      if (result.success) {
        alert(`✅ Successfully killed process on port ${port}`);
      } else {
        alert(`❌ Failed to kill process: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Error killing port process:', err);
      alert(`❌ Error: ${err.message}`);
    } finally {
      setKillLoading(false);
    }
  };

  const handleModeSwitch = async (project: RegisteredProject, newMode: 'dev' | 'production') => {
    setPendingProject(project);
    setPendingMode(newMode);
    setIsModeModalOpen(true);
  };

  const executeModeSwitch = async (project: RegisteredProject, newMode: 'dev' | 'production') => {
    try {
      const electron = (window as any).electron;
      const result = await electron.ipcRenderer.invoke(
        'dev-server:switch-mode',
        project.folderPath,
        newMode
      );

      if (!result.success) {
        alert(`Failed to switch mode: ${result.error}`);
      }
    } catch (error) {
      console.error('Mode switch error:', error);
      alert('Failed to switch mode.');
    }
  };

  const fetchLogs = async (folderPath: string) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) return;

      const result = await electron.ipcRenderer.invoke('dev-server:get-logs', folderPath);
      if (result.success && result.logs) {
        setTerminalLogs(prev => ({ ...prev, [folderPath]: result.logs }));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const copyLogsToClipboard = async (folderPath: string) => {
    const logs = terminalLogs[folderPath] || [];
    const logsText = logs.join('\n');

    try {
      await navigator.clipboard.writeText(logsText);
      alert('Logs copied to clipboard! You can now paste them to your AI assistant.');
    } catch (error) {
      console.error('Failed to copy logs:', error);
      alert('Failed to copy logs to clipboard.');
    }
  };

  const clearLogs = async (folderPath: string) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) return;

      const result = await electron.ipcRenderer.invoke('dev-server:clear-logs', folderPath);
      if (result.success) {
        setTerminalLogs(prev => ({ ...prev, [folderPath]: [] }));
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const scrollToBottom = useCallback((folderPath: string, smooth = false) => {
    const el = terminalRefs.current[folderPath];
    if (!el) return;

    const apply = () => {
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
  }, []);

  const toggleTerminal = (folderPath: string) => {
    setExpandedTerminals(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
        setAutoScroll(prevAuto => ({ ...prevAuto, [folderPath]: false }));
      } else {
        next.add(folderPath);
        setAutoScroll(prevAuto => ({ ...prevAuto, [folderPath]: true }));
        fetchLogs(folderPath);
      }
      return next;
    });
  };

  useEffect(() => {
    if (expandedTerminals.size === 0) return;

    const interval = setInterval(() => {
      expandedTerminals.forEach(folderPath => {
        fetchLogs(folderPath);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [expandedTerminals]);

  useLayoutEffect(() => {
    expandedTerminals.forEach((folderPath) => {
      if (autoScroll[folderPath]) {
        scrollToBottom(folderPath, false);
      }
    });
  }, [terminalLogs, autoScroll, expandedTerminals, scrollToBottom]);

  const handleScroll = (folderPath: string) => {
    const el = terminalRefs.current[folderPath];
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledToBottom = distanceFromBottom <= 12;

    setAutoScroll(prev => ({ ...prev, [folderPath]: isScrolledToBottom }));
  };

  // Combine running projects and history
  const allDisplayProjects = useMemo(() => {
    const combined = [...registeredProjects.map(p => ({
      id: p.folderPath,
      name: p.projectName,
      path: p.folderPath,
      port: p.port,
      url: p.url,
      status: p.status,
      mode: p.mode,
      isHistory: false,
      pushedVersion: availableProjects.find(ap => ap.path === p.folderPath)?.metadata?.pushedVersion
    }))];

    // Add projects from history that aren't already in combined
    availableProjects.forEach(histProj => {
      if (!combined.some(p => p.path === histProj.path)) {
        combined.push({
          id: histProj.id,
          name: histProj.name,
          path: histProj.path,
          port: undefined as any,
          url: '',
          status: 'stopped',
          mode: 'production',
          isHistory: true,
          pushedVersion: histProj.metadata?.pushedVersion
        });
      }
    });

    return combined;
  }, [registeredProjects, availableProjects]);

  return (
    <div className="coding-container">
      <ModeSelectionModal
        isOpen={isModeModalOpen}
        title="Switch Hosting Mode"
        message={pendingProject ? `Switch ${pendingProject.projectName} to ${pendingMode === 'dev' ? 'Development' : 'Production'} mode? Server will restart.` : ''}
        onSelect={(mode) => {
          setIsModeModalOpen(false);
          if (pendingProject) {
            executeModeSwitch(pendingProject, mode);
          }
        }}
        onCancel={() => {
          setIsModeModalOpen(false);
          setPendingProject(null);
          setPendingMode(null);
        }}
      />
      <div className="coding-header">
        <h1>Hosting Projects</h1>
        <div className="coding-header-actions">
          <button
            className="coding-btn coding-btn-primary"
            onClick={handleCreateNew}
            disabled={nodeInstalled === false}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Host New Project</span>
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '16px',
        margin: '0 24px 24px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔧</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#495057' }}>
              Port Utilities
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6c757d' }}>
              If a project fails to start because port {CODING_PORTS.production.preferred} is in use, you can force kill it here.
            </p>
          </div>
        </div>
        <button
          onClick={() => killPortProcess(CODING_PORTS.production.preferred)}
          disabled={killLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: killLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            opacity: killLoading ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {killLoading ? 'Killing...' : `Kill Port ${CODING_PORTS.production.preferred}`}
        </button>
      </div>

      <div className="coding-cards-grid">
        {allDisplayProjects.map(project => (
          <div key={project.path} className="coding-project-card">
            <div className="coding-card-header">
              <h3 className="coding-project-name">{project.name}</h3>
              <span className={`mode-badge mode-${project.mode}`}>
                {project.mode === 'dev' ? '⚡ DEV' : '🚀 PROD'}
              </span>
              <div className="coding-status" title={project.status}>
                <FontAwesomeIcon
                  icon={faCircle}
                  style={{ color: getStatusColor(project.status) }}
                />
              </div>
            </div>

            <div className="coding-card-body">
              {project.pushedVersion && (
                <div className="coding-project-detail">
                  <span className="coding-detail-label">Pushed Version:</span>
                  <span className="coding-detail-value">v{project.pushedVersion}</span>
                </div>
              )}
              <div className="coding-project-detail">
                <span className="coding-detail-label">Path:</span>
                <span className="coding-detail-value" style={{ fontSize: '11px', opacity: 0.7 }}>{project.path}</span>
              </div>

              {project.port && (
                <div className="coding-project-detail">
                  <span className="coding-detail-label">Port:</span>
                  <span className="coding-detail-value">{project.port}</span>
                </div>
              )}

              {project.url && (
                <div className="coding-project-detail">
                  <span className="coding-detail-label">URL:</span>
                  <span className="coding-detail-value">
                    <a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a>
                  </span>
                </div>
              )}

              <div className="coding-card-actions">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
                  {project.status === 'running' ? (
                    <button
                      className="coding-btn coding-btn-danger coding-btn-small"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStopServer(project.path, project.name);
                      }}
                    >
                      <FontAwesomeIcon icon={faStop} />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      className="coding-btn coding-btn-primary coding-btn-small"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartServer(project.path);
                      }}
                      disabled={project.status === 'starting' || project.status === 'rebuilding'}
                    >
                      <FontAwesomeIcon icon={faPlay} />
                      <span>{project.status === 'starting' ? 'Starting...' : 'Start'}</span>
                    </button>
                  )}

                  <button
                    className="coding-btn coding-btn-secondary coding-btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTerminal(project.path);
                    }}
                  >
                    <FontAwesomeIcon icon={expandedTerminals.has(project.path) ? faChevronUp : faChevronDown} />
                    <FontAwesomeIcon icon={faTerminal} />
                  </button>

                  <button
                    className="coding-btn coding-btn-secondary coding-btn-small"
                    onClick={(e) => handleRemoveFromHistory(e, project.id)}
                    title="Remove from history"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              {expandedTerminals.has(project.path) && (
                <div className="terminal-section">
                  <div className="terminal-header">
                    <span className="terminal-title">
                      <FontAwesomeIcon icon={faTerminal} /> Terminal Output
                    </span>
                    <div className="terminal-actions">
                      <button className="terminal-action-btn" onClick={() => copyLogsToClipboard(project.path)}>Copy</button>
                      <button className="terminal-action-btn" onClick={() => clearLogs(project.path)}>Clear</button>
                    </div>
                  </div>
                  <div
                    className="terminal-content"
                    ref={(el) => { terminalRefs.current[project.path] = el; }}
                    onScroll={() => handleScroll(project.path)}
                  >
                    {(terminalLogs[project.path] || []).length === 0 ? (
                      <div className="terminal-empty">No logs available</div>
                    ) : (
                      (terminalLogs[project.path] || []).map((log, index) => (
                        <div key={index} className={`terminal-line ${log.includes('[ERROR]') ? 'error' : ''}`}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Hosting;
