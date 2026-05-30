import React, { useState, useEffect } from 'react';
import './ProjectSelection.css';
import ProjectContextService, { type ProjectInfo } from '../../../services/projectContextService';
import { AIService } from '../../../services/ai-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faLayerGroup, faRefresh, faCircle, faStop } from '@fortawesome/free-solid-svg-icons';
import { CODING_PORTS, type ActivePortInfo } from '../../../../shared/coding-ports';
import { requireAntigravity } from '../../../utils/requireAntigravity';

const TEMPLATES = [
  {
    name: 'Excel to DB',
    repoUrl: 'https://github.com/Charismagreat/ExcelToDB.git',
    description: 'Excel to DB visualization dashboard'
  }
];

interface Project extends ProjectInfo {
  // Additional properties specific to the component can be added here
}

interface ProjectSelectionProps {
  onProjectSelect?: (project: Project) => void;
  className?: string;
}

const ProjectSelection: React.FC<ProjectSelectionProps> = ({ 
  onProjectSelect, 
  className = '' 
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [showGitMissingModal, setShowGitMissingModal] = useState(false);

  // Template state
  const [isCloning, setIsCloning] = useState(false);
  type StepStatus = 'pending' | 'active' | 'done' | 'error';
  type CloneStep = { label: string; status: StepStatus; detail?: string };
  const [cloneSteps, setCloneSteps] = useState<CloneStep[] | null>(null);
  const [activePorts, setActivePorts] = useState<ActivePortInfo[]>([]);
  const [portsScanning, setPortsScanning] = useState(false);
  const [killingPort, setKillingPort] = useState<number | null>(null);

  const updateStep = (index: number, status: StepStatus, detail?: string) => {
    setCloneSteps(prev => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], status, ...(detail !== undefined ? { detail } : {}) };
      return next;
    });
  };

  const handleSelectTemplate = async (template: typeof TEMPLATES[0]) => {
    if (!(await requireAntigravity())) return;

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
      
      // Check for active SSL certificate to enable HTTPS
      const httpsEnabled = localStorage.getItem('https-enabled') === 'true';
      const certListResult = await electron.sslCertificate.list();
      const activeIdResult = await electron.invoke('ssl-certificate-get-active-id');
      const activeCertId = activeIdResult.success ? activeIdResult.id : null;
      const activeCert = (httpsEnabled && certListResult.success) ? certListResult.certificates.find((c: any) => c.id === activeCertId) : null;

      const httpResult = await electron.httpsServer.start({ 
        port: 8080, 
        useHTTPS: !!activeCert,
        certificateId: activeCert?.id
      });
      const httpPort = httpResult.port || 8080;
      const protocol = !!activeCert ? 'https' : 'http';

      if (httpResult.success) {
        updateStep(1, 'done', `${protocol.toUpperCase()} Port ${httpPort}`);
      } else if (httpResult.error?.includes('already running')) {
        updateStep(1, 'done', `Already running on ${protocol} port ${httpPort}`);
      } else {
        updateStep(1, 'error', httpResult.error || 'Failed to start HTTP server');
      }

      // Step 2: Tunnel
      updateStep(2, 'active');
      const serverNameResult = await electron.ipcRenderer.invoke('get-mcp-server-name');
      const tunnelName = serverNameResult?.serverName;
      console.log('[TEMPLATE] tunnelName:', tunnelName);

      let tunnelIsUp = false;
      if (tunnelName) {
        const localServerUrl = `${protocol}://localhost:${httpPort}`;
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
      const mode = 'dev';

      if (tunnelIsUp) {
        await electron.ipcRenderer.invoke('dev-server:set-tunnel-id', tunnelName);
      }

      const startResult = await electron.ipcRenderer.invoke('dev-server:start', destPath, mode);
      console.log('[TEMPLATE] server start:', startResult.success, startResult.error);

      if (startResult.success) {
        updateStep(3, 'done', 'Dev mode');
      } else {
        updateStep(3, 'error', startResult.error || 'Failed to start server');
        return;
      }

      // Store flags and navigate after a brief pause so the user sees the final state
      localStorage.setItem('selected-project-folder', destPath);
      localStorage.setItem(`template-cloning-${destPath}`, 'true');
      await new Promise(resolve => setTimeout(resolve, 1200));
      setCloneSteps(null);
      
      // Update project context and select the new project
      await ProjectContextService.getInstance().setCurrentProject(destPath);
      if (onProjectSelect) {
        const context = ProjectContextService.getInstance().getContext();
        const newProject = context.availableProjects.find(p => p.path === destPath);
        if (newProject) {
          onProjectSelect(newProject);
        }
      }
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

  const isGithubUrl = (path: string) => {
    return path.startsWith('https://github.com/') || path.startsWith('git@github.com');
  };

  useEffect(() => {
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      setProjects(context.availableProjects);
    });

    // Load projects from storage or API
    loadProjects();

    return () => {
      unsubscribeProject();
    };
  }, []);

  const scanActivePorts = async () => {
    try {
      setPortsScanning(true);
      const electron = (window as any).electron;
      const result = await electron.ipcRenderer.invoke('dev-server:scan-ports');
      if (result.success) {
        setActivePorts(result.ports ?? []);
      }
    } catch (error) {
      console.error('Failed to scan active ports:', error);
    } finally {
      setPortsScanning(false);
    }
  };

  const rescanAfterKill = async (removedPorts: number[]) => {
    setActivePorts((prev) => prev.filter((entry) => !removedPorts.includes(entry.port)));

    await new Promise((resolve) => setTimeout(resolve, 700));

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const electron = (window as any).electron;
        const result = await electron.ipcRenderer.invoke('dev-server:scan-ports');
        if (result.success) {
          const ports: ActivePortInfo[] = result.ports ?? [];
          setActivePorts(ports);
          if (!removedPorts.some((port) => ports.some((entry) => entry.port === port))) {
            return;
          }
        }
      } catch (error) {
        console.error('Failed to rescan ports after kill:', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };

  useEffect(() => {
    scanActivePorts();
    const interval = setInterval(scanActivePorts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleKillPort = async (port: number) => {
    try {
      setKillingPort(port);
      const electron = (window as any).electron;
      const result = await electron.ipcRenderer.invoke('dev-server:kill-port', port);
      if (!result.success) {
        alert(result.error || `Failed to stop port ${port}`);
        await scanActivePorts();
        return;
      }
      await rescanAfterKill([port]);
    } catch (error) {
      console.error(`Failed to kill port ${port}:`, error);
      alert(`Failed to stop port ${port}`);
      await scanActivePorts();
    } finally {
      setKillingPort(null);
    }
  };

  const handleKillAllPorts = async () => {
    if (activePorts.length === 0) return;
    if (!confirm(`Stop all ${activePorts.length} active server port(s)?`)) return;

    const portsToKill = activePorts.map((entry) => entry.port);
    setKillingPort(portsToKill[0] ?? null);
    setActivePorts([]);

    try {
      const electron = (window as any).electron;
      for (const port of portsToKill) {
        setKillingPort(port);
        try {
          await electron.ipcRenderer.invoke('dev-server:kill-port', port);
        } catch (error) {
          console.error(`Failed to kill port ${port}:`, error);
        }
      }
      await rescanAfterKill(portsToKill);
    } finally {
      setKillingPort(null);
    }
  };

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      // Load projects from ProjectContextService
      const context = ProjectContextService.getInstance().getContext();
      setProjects(context.availableProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSelect = async (project: Project) => {
    if (!(await requireAntigravity())) return;

    setCurrentProject(project);
    onProjectSelect?.(project);

    // Update project context
    await ProjectContextService.getInstance().setCurrentProject(project.path);
  };

  const handleRemoveProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent card selection
    if (confirm('Are you sure you want to remove this project from the list?')) {
      ProjectContextService.getInstance().removeProject(projectId);
    }
  };

  const handleCreateProject = async () => {
    const isUrl = isGithubUrl(newProjectPath);
    const targetPath = isUrl ? destinationPath : newProjectPath;

    if (!newProjectName.trim() || !newProjectPath.trim() || (isUrl && !destinationPath.trim())) {
      return;
    }

    if (!(await requireAntigravity())) return;

      try {
        setIsInitializing(true);

        let finalProjectPath = targetPath.trim();

        if (isUrl) {
          // For GitHub URLs, create a subdirectory within the destinationPath for the clone
          const projectNameSlug = newProjectName.trim().replace(/[^a-zA-Z0-9-_]/g, '_'); // Sanitize project name for directory
          const joinedPathResult = await window.electron.fileSystem.joinPaths(finalProjectPath, projectNameSlug);

          if (!joinedPathResult.success || !joinedPathResult.joinedPath) {
            throw new Error(joinedPathResult.error || 'Failed to construct clone path');
          }
          finalProjectPath = joinedPathResult.joinedPath;
          
          // Ensure the new subdirectory exists before cloning
          await window.electron.fileSystem.createFolder(finalProjectPath);

          // Perform git clone directly via IPC
          console.log(`📡 Cloning repository ${newProjectPath.trim()} into ${finalProjectPath}...`);
          const cloneResult = await window.electron.git.clone(
            newProjectPath.trim(),
            finalProjectPath,
          );

          if (!cloneResult.success) {
            if (cloneResult.error === 'GIT_NOT_INSTALLED') {
              setShowGitMissingModal(true);
              return;
            }
            throw new Error(cloneResult.error || 'Git clone failed');
          }
          console.log('✅ Repository cloned successfully.');
        } else {
          // For local paths, ensure the directory exists
          await window.electron.fileSystem.createFolder(finalProjectPath);
        }
        
        // Now, create the project in the context (this will analyze and save it)
        const newProject = await ProjectContextService.getInstance().setCurrentProject(
          finalProjectPath,
          isUrl, // Explicitly mark as Git project if it's a URL
          isUrl ? newProjectPath.trim() : undefined, // Pass the GitHub URL as repositoryUrl
        );

        if (!newProject) {
          console.error('Failed to create project');
          alert('Failed to create project');
          return;
        }

      // Update the project name if it was auto-generated
      if (newProject.name !== newProjectName.trim()) {
        newProject.name = newProjectName.trim();
        // The context will be updated automatically through the subscription
           }

           // Mark project as pending initialization
           ProjectContextService.getInstance().updateProjectInitializationStatus(newProject.id, 'pending');

           // For local projects, we still use AI for initialization tasks like installing dependencies
           // For GitHub projects, the cloning is now handled directly above, so AI only for post-clone setup
           let initMessage = `Please initialize a new project in the folder: ${finalProjectPath.trim()}`;
           if (isUrl) {
            initMessage = `Please perform post-clone initialization for the repository cloned into ${finalProjectPath.trim()}. This might include installing dependencies or other setup.`;
           }
           
           // Use AI service to call the init-project tool
      const { conversationId } = await AIService.startAutonomousConversation(
        initMessage,
        {
          autoExecuteTools: true,
          maxTurns: 1,
          timeoutMs: 30000
        },
        (event) => {
          console.log('Init project event:', event);
          if (event.type === 'tool_call_response') {
            const response = event.response;
            if (response.success) {
              console.log('Project initialized successfully:', response.result);
              // Mark project as successfully initialized
              ProjectContextService.getInstance().markProjectAsInitialized(newProject.id);
            } else {
              console.error('Project initialization failed:', response.error);
              // Mark project as failed initialization
              ProjectContextService.getInstance().updateProjectInitializationStatus(newProject.id, 'failed');
              alert(`Project initialization failed: ${response.error}`);
              setIsInitializing(false);
              return;
            }
          }
        }
      );

      // Wait a moment for the tool execution to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setNewProjectName('');
      setNewProjectPath('');
      setDestinationPath('');
      setShowNewProjectForm(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleBrowsePath = async () => {
    try {
      const result = await window.electron.fileSystem.pickFolder();
      if (result.success && result.folderPath) {
        setNewProjectPath(result.folderPath);
      }
    } catch (error) {
      console.error('Failed to browse for folder:', error);
    }
  };

  const handleBrowseDestination = async () => {
    try {
      const result = await window.electron.fileSystem.pickFolder();
      if (result.success && result.folderPath) {
        setDestinationPath(result.folderPath);
      }
    } catch (error) {
      console.error('Failed to browse for destination folder:', error);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const electron = (window as any).electron;
      if (!electron?.fileSystem?.pickFolder) {
        console.error('Electron file system API not available');
        return;
      }

      const result = await electron.fileSystem.pickFolder();

      if (result.success && result.folderPath) {
        console.log('Opening folder:', result.folderPath);

        if (!(await requireAntigravity())) return;

        // Add to history and select it
        const project = await ProjectContextService.getInstance().setCurrentProject(result.folderPath);
        if (project && onProjectSelect) {
          onProjectSelect(project);
        }
      }
    } catch (error) {
      console.error('Error opening folder:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`project-selection ${className}`}>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  const stepIcon = (status: StepStatus) => {
    switch (status) {
      case 'active':  return <span className="clone-step-spinner" />;
      case 'done':    return <span className="clone-step-icon done">✓</span>;
      case 'error':   return <span className="clone-step-icon error">✗</span>;
      default:        return <span className="clone-step-icon pending">○</span>;
    }
  };

  return (
    <div className={`project-selection ${className}`}>
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
            {cloneSteps.some(s => s.status === 'error') && (
              <button className="close-overlay-btn" onClick={() => setCloneSteps(null)}>Close</button>
            )}
          </div>
        </div>
      )}
      <div className="project-selection-header">
        <h2>Select Project</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="new-project-btn"
            onClick={handleOpenFolder}
            style={{ background: '#6c757d' }}
          >
            Open Folder
          </button>
          <button 
            className="new-project-btn"
            onClick={() => setShowNewProjectForm(true)}
          >
            + New Project
          </button>
        </div>
      </div>

      <div className="port-status-panel">
        <div className="port-status-header">
          <div>
            <h3 className="port-status-title">Active Server Ports</h3>
            <p className="port-status-subtitle">
              Scanning {CODING_PORTS.production.range.start}–{CODING_PORTS.production.range.end} (hosting)
              and {CODING_PORTS.dev.range.start}–{CODING_PORTS.dev.range.end} (coding dev)
            </p>
          </div>
          <div className="port-status-actions">
            <button
              type="button"
              className="port-refresh-btn"
              onClick={scanActivePorts}
              disabled={portsScanning}
              title="Refresh port scan"
            >
              <FontAwesomeIcon icon={faRefresh} spin={portsScanning} />
              {portsScanning ? 'Scanning…' : 'Refresh'}
            </button>
            {activePorts.length > 0 && (
              <button
                type="button"
                className="port-kill-all-btn"
                onClick={handleKillAllPorts}
                disabled={killingPort !== null}
              >
                Stop All
              </button>
            )}
          </div>
        </div>

        {activePorts.length === 0 ? (
          <div className="port-status-empty">
            <FontAwesomeIcon icon={faCircle} className="port-status-ok-icon" />
            <span>No active ports in the coding or hosting ranges</span>
          </div>
        ) : (
          <div className="port-status-list">
            {activePorts.map((entry) => (
              <div key={entry.port} className={`port-status-item port-status-item--${entry.mode}`}>
                <div className="port-status-item-info">
                  <span className="port-status-badge">{entry.mode === 'dev' ? 'Coding' : 'Hosting'}</span>
                  <span className="port-status-number">:{entry.port}</span>
                  {entry.projectName ? (
                    <span className="port-status-project">{entry.projectName}</span>
                  ) : entry.processName ? (
                    <span className="port-status-project port-status-unknown">{entry.processName}</span>
                  ) : (
                    <span className="port-status-project port-status-unknown">Unknown process</span>
                  )}
                  {entry.status && (
                    <span className="port-status-state">{entry.status}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="port-kill-btn"
                  onClick={() => handleKillPort(entry.port)}
                  disabled={killingPort === entry.port}
                  title={`Stop port ${entry.port}`}
                >
                  <FontAwesomeIcon icon={faStop} />
                  {killingPort === entry.port ? 'Stopping…' : 'Stop'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewProjectForm && (
        <div className="new-project-form">
          <h3>Create New Project</h3>
          {isInitializing && (
            <div className="initialization-status">
              <div className="spinner"></div>
              <p>Initializing project...</p>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="project-path">Project Path or GitHub URL</label>
            <div className="path-input-group">
              <input
                id="project-path"
                type="text"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                placeholder="Select project folder or paste GitHub URL"
              />
              <button 
                type="button"
                onClick={handleBrowsePath}
                className="browse-btn"
              >
                Browse
              </button>
            </div>
          </div>

          {isGithubUrl(newProjectPath) && (
            <div className="form-group">
              <label htmlFor="destination-path">Destination Folder</label>
              <div className="path-input-group">
                <input
                  id="destination-path"
                  type="text"
                  value={destinationPath}
                  onChange={(e) => setDestinationPath(e.target.value)}
                  placeholder="Select folder to clone into"
                />
                <button 
                  type="button"
                  onClick={handleBrowseDestination}
                  className="browse-btn"
                >
                  Browse
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !newProjectPath.trim() || (isGithubUrl(newProjectPath) && !destinationPath.trim()) || isInitializing}
              className="create-btn"
            >
              {isInitializing ? 'Initializing...' : 'Create Project'}
            </button>
            <button 
              onClick={() => setShowNewProjectForm(false)}
              disabled={isInitializing}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="projects-grid">
        {/* Template Cards */}
        {TEMPLATES.map(template => (
          <div
            key={template.repoUrl}
            className="project-card template-card"
            onClick={() => handleSelectTemplate(template)}
          >
            <div className="project-card-header">
              <div className="project-icon">
                <FontAwesomeIcon icon={faLayerGroup} />
              </div>
              <div className="project-status">
                <span className="status-badge template">Template</span>
              </div>
            </div>
            <div className="project-card-content">
              <h3 className="project-name">{template.name}</h3>
              <p className="project-description">{template.description}</p>
            </div>
            <div className="project-card-actions">
              <button className="select-btn">Use Template</button>
            </div>
          </div>
        ))}

        {projects.length === 0 && TEMPLATES.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <h3>No projects found</h3>
            <p>Create a new project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`project-card ${currentProject?.id === project.id ? 'selected' : ''}`}
              onClick={() => handleProjectSelect(project)}
            >
              <div className="project-card-header">
                <div className="project-icon">
                  {project.isGit ? '🐙' : project.type === 'node' ? '📦' : project.type === 'python' ? '🐍' : '📁'}
                </div>
                <div className="project-status">
                  {currentProject?.id === project.id ? (
                    <span className="status-badge active">Active</span>
                  ) : (
                    <span className="status-badge inactive">Inactive</span>
                  )}
                  {project.isInitialized && (
                    <span className="status-badge initialized">✓ Initialized</span>
                  )}
                  {project.metadata?.isHosted && (
                    <span className="status-badge hosted" title={`Last pushed: ${project.metadata.lastPushedAt?.toLocaleString()}`}>🚀 Hosted v{project.metadata.pushedVersion}</span>
                  )}
                </div>
              </div>
              
              <div className="project-card-content">
                <h3 className="project-name">{project.name || 'Untitled Project'}</h3>
                <p className="project-description">{project.description || 'No description available'}</p>
                <div className="project-meta">
                  <div className="meta-item">
                    <span className="meta-label">Type:</span>
                    <span className="meta-value">{project.metadata?.framework || project.type || 'Unknown'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Language:</span>
                    <span className="meta-value">{project.metadata?.language || 'Unknown'}</span>
                  </div>
                  {project.metadata?.version && (
                    <div className="meta-item">
                      <span className="meta-label">Version:</span>
                      <span className="meta-value">{project.metadata.version}</span>
                    </div>
                  )}
                </div>
                <div className="project-path">
                  <span className="path-icon">📂</span>
                  <span className="path-text">{project.path || 'No path specified'}</span>
                </div>
                {project.lastAccessed && (
                  <div className="project-last-accessed">
                    <span className="time-icon">🕒</span>
                    <span>Last accessed: {(() => {
                      try {
                        const date = project.lastAccessed instanceof Date ? project.lastAccessed : new Date(project.lastAccessed);
                        return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
                      } catch (error) {
                        return 'Unknown';
                      }
                    })()}</span>
                  </div>
                )}
              </div>
              
              <div className="project-card-actions">
                <button 
                  className="select-btn"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent handleRemoveProject from triggering if select is also clicked
                    handleProjectSelect(project);
                  }}
                >
                  {currentProject?.id === project.id ? '✓ Selected' : 'Select Project'}
                </button>
                <button 
                  className="remove-project-btn"
                  onClick={(e) => handleRemoveProject(e, project.id)}
                  title="Remove from list"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showGitMissingModal && (
        <div className="git-missing-modal-overlay">
          <div className="git-missing-modal">
            <div className="modal-header">
              <h2>⚠️ Git Not Found</h2>
              <button className="close-btn" onClick={() => setShowGitMissingModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                To clone projects from GitHub, Git must be installed on your system and available in your PATH.
              </p>
              
              <div className="installation-steps">
                <h3>Installation Steps:</h3>
                <ol>
                  <li>Download Git from <button className="link-btn" onClick={() => window.electron.shell.openExternal('https://git-scm.com/downloads')}>git-scm.com/downloads</button></li>
                  <li>Run the installer with default settings</li>
                  <li>Restart this application</li>
                </ol>
              </div>
            </div>
            <div className="modal-footer">
              <button className="download-btn" onClick={() => window.electron.shell.openExternal('https://git-scm.com/downloads')}>
                Download Git
              </button>
              <button className="secondary-btn" onClick={() => setShowGitMissingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelection;
