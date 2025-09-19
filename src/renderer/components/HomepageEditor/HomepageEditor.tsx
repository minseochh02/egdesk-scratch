import React, { useState, useEffect } from 'react';
import './HomepageEditor.css';
import ProjectContextService from '../../services/projectContextService';
import { AIChat } from './AIChatInterface/AIChat';
import { ProjectSelection } from './ProjectSelection';

interface HomepageEditorProps {
  // Add any props you need
}

const HomepageEditor: React.FC<HomepageEditorProps> = () => {
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      setShowAIChat(!!context.currentProject);
      // Send project context to main process
      if (context.currentProject) {
        window.electron.projectContext.updateContext(context);
      }
    });
    
    return () => {
      unsubscribeProject();
    };
  }, []);

  const handleProjectSelect = (project: any) => {
    console.log('Project selected:', project);
    setCurrentProject(project);
    setShowAIChat(true);
  };

  const handleBackToProjectSelection = () => {
    setShowAIChat(false);
    setCurrentProject(null);
  };

  return (
    <div className="homepage-editor">
      {!showAIChat ? (
        /* Project Selection Section - Show when no project is selected */
        <div className="project-selection-section full-height">
          <ProjectSelection 
            onProjectSelect={handleProjectSelect}
          />
        </div>
      ) : (
        /* AI Chat Section - Show after project is selected */
        <div className="ai-chat-section full-height">
            <AIChat onBackToProjectSelection={handleBackToProjectSelection} />
        </div>
      )}
    </div>
  );
};

export default HomepageEditor;
