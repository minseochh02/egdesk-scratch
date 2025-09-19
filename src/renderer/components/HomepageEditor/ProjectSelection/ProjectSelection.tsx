import React, { useState, useEffect } from 'react';
import './ProjectSelection.css';
import ProjectContextService, { type ProjectInfo } from '../../../services/projectContextService';

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

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectPath.trim()) {
      return;
    }

    try {
      // Use ProjectContextService to set the current project
      // This will automatically analyze the project and add it to availableProjects
      const newProject = await ProjectContextService.getInstance().setCurrentProject(newProjectPath.trim());
      
      if (newProject) {
        // Update the project name if it was auto-generated
        if (newProject.name !== newProjectName.trim()) {
          newProject.name = newProjectName.trim();
          // The context will be updated automatically through the subscription
        }
        
        setNewProjectName('');
        setNewProjectPath('');
        setShowNewProjectForm(false);
      } else {
        console.error('Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleBrowsePath = async () => {
    try {
      // TODO: Open folder picker dialog
      // const result = await window.electron.dialog.openFolder();
      // if (result) {
      //   setNewProjectPath(result);
      // }
    } catch (error) {
      console.error('Failed to browse for folder:', error);
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
            <label htmlFor="project-path">Project Path</label>
            <div className="path-input-group">
              <input
                id="project-path"
                type="text"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                placeholder="Select project folder"
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
          <div className="form-actions">
            <button 
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !newProjectPath.trim()}
              className="create-btn"
            >
              Create Project
            </button>
            <button 
              onClick={() => setShowNewProjectForm(false)}
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
                  {project.type === 'node' ? '📦' : project.type === 'python' ? '🐍' : '📁'}
                </div>
                <div className="project-status">
                  {currentProject?.id === project.id ? (
                    <span className="status-badge active">Active</span>
                  ) : (
                    <span className="status-badge inactive">Inactive</span>
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
                <button className="select-btn">
                  {currentProject?.id === project.id ? '✓ Selected' : 'Select Project'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectSelection;
