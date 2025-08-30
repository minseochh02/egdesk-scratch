import React, { useState, useEffect } from 'react';
import ProjectContextService, { ProjectInfo } from '../../services/projectContextService';
import './ProjectSelector.css';

interface ProjectSelectorProps {
  onProjectSelect?: (project: ProjectInfo) => void;
  showCurrentProject?: boolean;
  showRecentProjects?: boolean;
  showAvailableProjects?: boolean;
  className?: string;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onProjectSelect,
  showCurrentProject = true,
  showRecentProjects = true,
  showAvailableProjects = false,
  className = ''
}) => {
  const [projectContext, setProjectContext] = useState(ProjectContextService.getInstance().getContext());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = ProjectContextService.getInstance().subscribe(setProjectContext);
    return unsubscribe;
  }, []);

  const handleProjectSelect = async (project: ProjectInfo) => {
    setIsLoading(true);
    try {
      const selectedProject = await ProjectContextService.getInstance().setCurrentProject(project.path);
      if (selectedProject && onProjectSelect) {
        onProjectSelect(selectedProject);
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to select project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProject = async () => {
    try {
      const result = await window.electron.fileSystem.pickFolder();
      if (result.success && result.folderPath) {
        setSelectedProjectPath(result.folderPath);
        const newProject = await ProjectContextService.getInstance().setCurrentProject(result.folderPath);
        if (newProject && onProjectSelect) {
          onProjectSelect(newProject);
        }
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to select new project:', error);
    }
  };

  const getProjectIcon = (project: ProjectInfo): string => {
    switch (project.type) {
      case 'wordpress': return '🐘';
      case 'node': return '🟢';
      case 'python': return '🐍';
      case 'java': return '☕';
      case 'cpp': return '⚙️';
      case 'web': return '🌐';
      default: return '📁';
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString();
  };

  const currentProject = projectContext.currentProject;

  return (
    <div className={`project-selector ${className}`}>
      {/* Compact Current Project Display */}
      {showCurrentProject && currentProject && (
        <div className="current-project compact">
          <span className="project-icon">{getProjectIcon(currentProject)}</span>
          <span className="project-name">{currentProject.name}</span>
          <button 
            className="project-menu-btn"
            onClick={() => setIsOpen(!isOpen)}
            title="Change project"
          >
            ▼
          </button>
        </div>
      )}

      {/* Compact Project Selection Dropdown */}
      {isOpen && (
        <div className="project-dropdown compact">
          <div className="dropdown-header">
            <h3>Projects</h3>
            <button 
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          {/* New Project Button */}
          <div className="new-project-section">
            <button 
              className="new-project-btn"
              onClick={handleNewProject}
              disabled={isLoading}
            >
              {isLoading ? '...' : '➕ New Project'}
            </button>
          </div>

          {/* Recent Projects */}
          {showRecentProjects && projectContext.recentProjects.length > 0 && (
            <div className="project-section">
              <h4>Recent</h4>
              <div className="project-list">
                {projectContext.recentProjects.map(project => (
                  <div
                    key={project.id}
                    className={`project-item ${project.isActive ? 'active' : ''}`}
                    onClick={() => handleProjectSelect(project)}
                  >
                    <span className="project-icon">{getProjectIcon(project)}</span>
                    <div className="project-details">
                      <div className="project-name">{project.name}</div>
                      <div className="project-meta">
                        <span className="project-type">{project.type}</span>
                        <span className="project-date">{formatDate(project.lastAccessed)}</span>
                      </div>
                    </div>
                    {project.isActive && <span className="active-indicator">●</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Projects */}
          {showAvailableProjects && projectContext.availableProjects.length > 0 && (
            <div className="project-section">
              <h4>Available</h4>
              <div className="project-list">
                {projectContext.availableProjects.map(project => (
                  <div
                    key={project.id}
                    className={`project-item ${project.isActive ? 'active' : ''}`}
                    onClick={() => handleProjectSelect(project)}
                  >
                    <span className="project-icon">{getProjectIcon(project)}</span>
                    <div className="project-details">
                      <div className="project-name">{project.name}</div>
                      <div className="project-meta">
                        <span className="project-type">{project.type}</span>
                        {project.metadata.version && (
                          <span className="project-version">v{project.metadata.version}</span>
                        )}
                      </div>
                    </div>
                    {project.isActive && <span className="active-indicator">●</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Projects Message */}
          {projectContext.availableProjects.length === 0 && (
            <div className="no-projects">
              <p>No projects available</p>
            </div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default ProjectSelector;
