import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faPlus, faCopy, faStop, faTerminal, faTrash, faChevronDown, faChevronUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import './Coding.css';

interface Project {
  id: string;
  name: string;
  serverType: 'appsscript' | 'nodejs';
  port?: number;
  identifier: string; // GitHub repo / appsscript ID / folder name
  status: 'running' | 'stopped' | 'error';
}

interface RegisteredProject {
  projectName: string;
  folderPath: string;
  port: number;
  url: string;
  status: 'running' | 'stopped' | 'error' | 'rebuilding';
  registeredAt: string;
  type?: 'nextjs' | 'vite' | 'react' | 'unknown';
  mode: 'dev' | 'production';
}

const Coding: React.FC = () => {
  const navigate = useNavigate();
  const [registeredProjects, setRegisteredProjects] = useState<RegisteredProject[]>([]);
  const [nodeInstalled, setNodeInstalled] = useState<boolean | null>(null);
  const [nodeVersion, setNodeVersion] = useState<string>('');
  const [npmVersion, setNpmVersion] = useState<string>('');
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string[]>>({});
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState<Record<string, boolean>>({});
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

        // Store folder path in localStorage
        localStorage.setItem('selected-project-folder', result.folderPath);

        // Navigate to developer window
        navigate('/coding/developer');
      } else if (result.error) {
        console.error('Failed to pick folder:', result.error);
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    }
  };

  const handleCopyFromTemplates = () => {
    console.log('Copy from templates');
    // TODO: Implement template selection
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

  const handleModeSwitch = async (project: RegisteredProject, newMode: 'dev' | 'production') => {
    const modeLabel = newMode === 'dev' ? 'Development' : 'Production';
    const modeDesc = newMode === 'dev'
      ? '• Fast startup (~3-5s)\n• Hot reload enabled\n• Skip build step'
      : '• Optimized build (~40-60s)\n• Production ready\n• Better performance';

    const confirmed = window.confirm(
      `Switch ${project.projectName} to ${modeLabel} mode?\n\n` +
      `${modeDesc}\n\n` +
      `Server will restart.`
    );

    if (!confirmed) return;

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
        // Fetch logs when expanding
        fetchLogs(folderPath);
      }
      return next;
    });
  };

  // Poll logs for expanded terminals
  useEffect(() => {
    if (expandedTerminals.size === 0) return;

    const interval = setInterval(() => {
      expandedTerminals.forEach(folderPath => {
        fetchLogs(folderPath);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [expandedTerminals]);

  // Auto-scroll after logs paint (layout effect + rAF matches DeveloperWindow)
  useLayoutEffect(() => {
    expandedTerminals.forEach((folderPath) => {
      if (autoScroll[folderPath]) {
        scrollToBottom(folderPath, false);
      }
    });
  }, [terminalLogs, autoScroll, expandedTerminals, scrollToBottom]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = (folderPath: string) => {
    const el = terminalRefs.current[folderPath];
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledToBottom = distanceFromBottom <= 12;

    setAutoScroll(prev => ({ ...prev, [folderPath]: isScrolledToBottom }));
  };

  return (
    <div className="coding-container">
      <div className="coding-header">
        <h1>Projects</h1>
        <div className="coding-header-actions">
          <button
            className="coding-btn coding-btn-primary"
            onClick={handleCreateNew}
            disabled={nodeInstalled === false}
            title={nodeInstalled === false ? 'Node.js is required to create projects' : ''}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Create New</span>
          </button>
          <button
            className="coding-btn coding-btn-secondary"
            onClick={handleCopyFromTemplates}
          >
            <FontAwesomeIcon icon={faCopy} />
            <span>Copy from Templates</span>
          </button>
        </div>
      </div>

      {nodeInstalled === false && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '16px',
          margin: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#856404' }}>
                Node.js Not Installed
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#856404' }}>
                Node.js and npm are required to use the Coding features. Please install Node.js to continue.
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#856404' }}>
                Detected: Node.js: {nodeVersion} | npm: {npmVersion}
              </p>
            </div>
            <button
              onClick={() => {
                const electron = (window as any).electron;
                if (electron?.shell?.openExternal) {
                  electron.shell.openExternal('https://nodejs.org/');
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#43853d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}
            >
              Download Node.js
            </button>
          </div>
        </div>
      )}

      {nodeInstalled === true && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          padding: '12px 16px',
          margin: '16px 24px',
          fontSize: '14px',
          color: '#155724'
        }}>
          ✅ Node.js {nodeVersion} and npm {npmVersion} detected
        </div>
      )}

      <div className="coding-cards-grid">
        {registeredProjects.length === 0 && (
          <div className="coding-empty-state">
            <p>No active projects. Click "Create New" to start a development server.</p>
          </div>
        )}

        {registeredProjects.map(project => (
          <div key={project.projectName} className="coding-project-card">
            <div className="coding-card-header">
              <h3 className="coding-project-name">{project.projectName}</h3>

              {/* Mode Badge */}
              <span
                className={`mode-badge mode-${project.mode}`}
                title={`Running in ${project.mode} mode`}
              >
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
              <div className="coding-project-detail">
                <span className="coding-detail-label">Port:</span>
                <span className="coding-detail-value">{project.port}</span>
              </div>

              <div className="coding-project-detail">
                <span className="coding-detail-label">Type:</span>
                <span className="coding-detail-value">{project.type || 'unknown'}</span>
              </div>

              <div className="coding-project-detail">
                <span className="coding-detail-label">Mode:</span>
                <span className="coding-detail-value">
                  {project.mode === 'dev'
                    ? 'Development (Hot Reload)'
                    : 'Production (Optimized)'}
                </span>
              </div>

              <div className="coding-project-detail">
                <span className="coding-detail-label">URL:</span>
                <span className="coding-detail-value">
                  <a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a>
                </span>
              </div>

              <div className="coding-card-actions">
                {project.status === 'running' && (
                  <div className="mode-toggle">
                    <button
                      className={`mode-btn ${project.mode === 'dev' ? 'active' : ''}`}
                      onClick={() => handleModeSwitch(project, 'dev')}
                      disabled={project.mode === 'dev'}
                    >
                      ⚡ Dev
                    </button>
                    <button
                      className={`mode-btn ${project.mode === 'production' ? 'active' : ''}`}
                      onClick={() => handleModeSwitch(project, 'production')}
                      disabled={project.mode === 'production'}
                    >
                      🚀 Prod
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="coding-btn coding-btn-secondary coding-btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTerminal(project.folderPath);
                    }}
                  >
                    <FontAwesomeIcon icon={expandedTerminals.has(project.folderPath) ? faChevronUp : faChevronDown} />
                    <FontAwesomeIcon icon={faTerminal} />
                    <span>Logs</span>
                  </button>

                  <button
                    className="coding-btn coding-btn-danger coding-btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStopServer(project.folderPath, project.projectName);
                    }}
                    disabled={project.status !== 'running'}
                  >
                    <FontAwesomeIcon icon={faStop} />
                    <span>Stop Server</span>
                  </button>
                </div>
              </div>

              {/* Terminal Logs Section */}
              {expandedTerminals.has(project.folderPath) && (
                <div className="terminal-section">
                  <div className="terminal-header">
                    <span className="terminal-title">
                      <FontAwesomeIcon icon={faTerminal} /> Terminal Output
                      {!autoScroll[project.folderPath] && (
                        <span className="auto-scroll-indicator" title="Auto-scroll paused (scroll to bottom to resume)">
                          ⏸
                        </span>
                      )}
                    </span>
                    <div className="terminal-actions">
                      {!autoScroll[project.folderPath] && (
                        <button
                          className="terminal-action-btn scroll-to-bottom-btn"
                          onClick={() => {
                            scrollToBottom(project.folderPath, true);
                            setAutoScroll(prev => ({ ...prev, [project.folderPath]: true }));
                          }}
                          title="Scroll to bottom"
                        >
                          <FontAwesomeIcon icon={faArrowDown} />
                        </button>
                      )}
                      <button
                        className="terminal-action-btn"
                        onClick={() => copyLogsToClipboard(project.folderPath)}
                        title="Copy logs to clipboard"
                      >
                        <FontAwesomeIcon icon={faCopy} /> Copy
                      </button>
                      <button
                        className="terminal-action-btn"
                        onClick={() => clearLogs(project.folderPath)}
                        title="Clear logs"
                      >
                        <FontAwesomeIcon icon={faTrash} /> Clear
                      </button>
                    </div>
                  </div>
                  <div
                    className="terminal-content"
                    ref={(el) => { terminalRefs.current[project.folderPath] = el; }}
                    onScroll={() => handleScroll(project.folderPath)}
                  >
                    {(terminalLogs[project.folderPath] || []).length === 0 ? (
                      <div className="terminal-empty">No logs available</div>
                    ) : (
                      (terminalLogs[project.folderPath] || []).map((log, index) => (
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

export default Coding;
