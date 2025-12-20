import React, { useState, useEffect } from 'react';
import './ProjectSelection.css';
import ProjectContextService, { type ProjectInfo } from '../../../services/projectContextService';
import { AIService } from '../../../services/ai-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

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

  return (
    <div className={`project-selection ${className}`}>
      <div className="project-selection-header">
        <h2>Select Project</h2>
        <button 
          className="new-project-btn"
          onClick={() => setShowNewProjectForm(true)}
        >
          + New Project
        </button>
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
        {projects.length === 0 ? (
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
