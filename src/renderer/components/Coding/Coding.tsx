import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faPlus, faCopy, faStop, faTerminal, faTrash, faChevronDown, faChevronUp, faArrowDown, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
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

import ModeSelectionModal from './ModeSelectionModal';

const TEMPLATES = [
  {
    name: 'Excel to DB',
    repoUrl: 'https://github.com/Charismagreat/ExcelToDB.git',
    description: 'Excel to DB visualization dashboard'
  }
];

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
  const [killLoading, setKillLoading] = useState(false);

  // Modal state
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<RegisteredProject | null>(null);
  const [pendingMode, setPendingMode] = useState<'dev' | 'production' | null>(null);

  // Template state
  const [isCloning, setIsCloning] = useState(false);

  type StepStatus = 'pending' | 'active' | 'done' | 'error';
  type CloneStep = { label: string; status: StepStatus; detail?: string };
  const [cloneSteps, setCloneSteps] = useState<CloneStep[] | null>(null);

  const updateStep = (index: number, status: StepStatus, detail?: string) => {
    setCloneSteps(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], status, ...(detail !== undefined ? { detail } : {}) };
      return next;
    });
  };

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

  const handleSelectTemplate = async (template: typeof TEMPLATES[0]) => {
    const STEPS = [
      { label: 'Cloning repository' },
      { label: 'Starting HTTP server' },
      { label: 'Starting tunnel' },
      { label: 'Starting server' },
    ];
    setCloneSteps(STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));

    try {
      const electron = (window as any).electron;

      // Determine base directory
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      let baseDir: string;
      if (isMac) {
        const homeDir = await electron.fileSystem.getHomeDirectory();
        baseDir = `${homeDir}/Desktop/EGDesk-Templates`;
      } else {
        baseDir = 'C:\\EGDesk-Templates';
      }

      const repoName = template.repoUrl.split('/').pop()?.replace('.git', '') || 'template-project';
      const destPath = `${baseDir}/${repoName}`;

      // Step 0: Clone (or reuse existing)
      setIsCloning(true);
      const cloneResult = await electron.git.clone(template.repoUrl, destPath);
      setIsCloning(false);

      const alreadyExists =
        !cloneResult.success &&
        (cloneResult.error?.includes('already exists') ||
          cloneResult.message?.includes('already exists'));

      if (!cloneResult.success && !alreadyExists) {
        updateStep(0, 'error', cloneResult.message || cloneResult.error || 'Clone failed');
        return;
      }
      updateStep(0, 'done', alreadyExists ? `Already exists — reusing ${destPath}` : destPath);

      // Step 1: HTTP server
      updateStep(1, 'active');
      const httpResult = await electron.httpsServer.start({ port: 8080, useHTTPS: false });
      const httpPort = httpResult.port || 8080;
      if (httpResult.success) {
        updateStep(1, 'done', `Port ${httpPort}`);
      } else if (httpResult.error?.includes('already running')) {
        updateStep(1, 'done', `Already running on port ${httpPort}`);
      } else {
        updateStep(1, 'error', httpResult.error || 'Failed to start HTTP server');
        // Non-fatal — tunnel can still attempt connection
      }

      // Step 2: Tunnel
      updateStep(2, 'active');
      const serverNameResult = await electron.ipcRenderer.invoke('get-mcp-server-name');
      const tunnelName = serverNameResult?.serverName;
      console.log('[TEMPLATE] tunnelName:', tunnelName);

      let tunnelIsUp = false;
      if (tunnelName) {
        const localServerUrl = `http://localhost:${httpPort}`;
        const tunnelResult = await electron.ipcRenderer.invoke('mcp-tunnel-start', tunnelName, localServerUrl);
        console.log('[TEMPLATE] tunnel result:', tunnelResult.success, tunnelResult.message, tunnelResult.error);

        const alreadyRunning = !tunnelResult.success &&
          typeof tunnelResult.message === 'string' &&
          tunnelResult.message.includes('already running');
        tunnelIsUp = tunnelResult.success || alreadyRunning;

        if (tunnelIsUp) {
          updateStep(2, 'done', tunnelResult.publicUrl || tunnelName);
        } else {
          updateStep(2, 'error', tunnelResult.error || tunnelResult.message || 'Tunnel failed — using dev mode');
        }
      } else {
        updateStep(2, 'error', 'No server name — using dev mode');
      }

      // Step 3: Start server
      updateStep(3, 'active');
      const mode = tunnelIsUp ? 'production' : 'dev';

      if (tunnelIsUp) {
        await electron.ipcRenderer.invoke('dev-server:set-tunnel-id', tunnelName);
      }

      const startResult = await electron.ipcRenderer.invoke('dev-server:start', destPath, mode);
      console.log('[TEMPLATE] server start:', startResult.success, startResult.error);

      if (startResult.success) {
        updateStep(3, 'done', mode === 'production' ? 'Production mode' : 'Dev mode (no tunnel)');
      } else {
        updateStep(3, 'error', startResult.error || 'Failed to start server');
        return;
      }

      // Store flags and navigate after a brief pause so the user sees the final state
      localStorage.setItem('selected-project-folder', destPath);
      localStorage.setItem(`template-cloning-${destPath}`, 'true');
      await new Promise(resolve => setTimeout(resolve, 1200));
      setCloneSteps(null);
      navigate('/coding/developer');
    } catch (error: any) {
      setIsCloning(false);
      console.error('Error cloning template:', error);
      setCloneSteps(prev => {
        if (!prev) return prev;
        const activeIdx = prev.findIndex(s => s.status === 'active');
        if (activeIdx === -1) return prev;
        const next = [...prev];
        next[activeIdx] = { ...next[activeIdx], status: 'error', detail: error?.message || 'Unknown error' };
        return next;
      });
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

  const stepIcon = (status: StepStatus) => {
    switch (status) {
      case 'active':  return <span className="clone-step-spinner" />;
      case 'done':    return <span className="clone-step-icon done">✓</span>;
      case 'error':   return <span className="clone-step-icon error">✗</span>;
      default:        return <span className="clone-step-icon pending">○</span>;
    }
  };

  return (
    <div className="coding-container">
      {cloneSteps && (
        <div className="clone-overlay">
          <div className="clone-overlay-card">
            <h3 className="clone-overlay-title">Setting up template…</h3>
            <div className="clone-steps">
              {cloneSteps.map((step, i) => (
                <div key={i} className={`clone-step clone-step-${step.status}`}>
                  <div className="clone-step-left">{stepIcon(step.status)}</div>
                  <div className="clone-step-right">
                    <div className="clone-step-label">{step.label}</div>
                    {step.detail && <div className="clone-step-detail">{step.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
        <h1>Projects</h1>
        <div className="coding-header-actions">
          <button
            className="coding-btn coding-btn-primary"
            onClick={handleCreateNew}
            disabled={nodeInstalled === false}
            title={nodeInstalled === false ? 'Node.js is required to open projects' : ''}
          >
            <span>Open Project</span>
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
              If a project fails to start because port 3000 is in use, you can force kill it here.
            </p>
          </div>
        </div>
        <button
          onClick={() => killPortProcess(3000)}
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
          {killLoading ? 'Killing...' : 'Kill Port 3000'}
        </button>
      </div>

      <div className="coding-cards-grid">
        {/* New Project Card */}
        <div
          className="coding-project-card create-new-card"
          onClick={handleCreateNew}
        >
          <div className="create-new-content">
            <div className="create-new-icon">
              <FontAwesomeIcon icon={faPlus} />
            </div>
            <div className="create-new-text">New Project</div>
          </div>
        </div>

        {/* Template Cards */}
        {TEMPLATES.map(template => (
          <div
            key={template.repoUrl}
            className="coding-project-card create-new-card template-card"
            onClick={() => handleSelectTemplate(template)}
          >
            <div className="create-new-content">
              <div className="create-new-icon"><FontAwesomeIcon icon={faLayerGroup} /></div>
              <div className="create-new-text">{template.name}</div>
              <div className="template-card-desc">{template.description}</div>
            </div>
          </div>
        ))}

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
