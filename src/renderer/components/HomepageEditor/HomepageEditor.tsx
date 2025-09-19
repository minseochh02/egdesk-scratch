import React, { useState, useEffect } from 'react';
import './HomepageEditor.css';
import ProjectContextService from '../../services/projectContextService';
import { AIChat } from './AIChatInterface/AIChat';

interface HomepageEditorProps {
  // Add any props you need
}

const HomepageEditor: React.FC<HomepageEditorProps> = () => {
  const [currentProject, setCurrentProject] = useState<any>(null);

  useEffect(() => {
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      // Send project context to main process
      if (context.currentProject) {
        window.electron.projectContext.updateContext(context);
      }
    });
    
    return () => {
      unsubscribeProject();
    };
  }, []);


  return (
    <div className="homepage-editor">
      {/* AI Chat Section */}
      <div className="ai-chat-section">
        <div className="ai-chat-container">
          <AIChat />
        </div>
      </div>
    </div>
  );
};

export default HomepageEditor;
