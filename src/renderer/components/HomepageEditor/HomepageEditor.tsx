import React, { useState, useEffect, useRef } from 'react';
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
  const [serverStatus, setServerStatus] = useState<{
    isRunning: boolean;
    port?: number;
    url?: string;
    error?: string;
  }>({ isRunning: false });
  const [lastServerFolderPath, setLastServerFolderPath] = useState<string | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(() => {
    // Load from localStorage, default to true
    const saved = localStorage.getItem('homepage-editor-auto-start');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const originalBoundsRef = useRef<any | null>(null);

  useEffect(() => {
    // Capture original main window bounds on mount, restore on unmount
    (async () => {
      try {
        if (!originalBoundsRef.current) {
          const result = await window.electron.mainWindow.getBounds();
          if (result?.success && result.bounds) {
            originalBoundsRef.current = result.bounds;
          }
        }
      } catch (e) {
        console.warn('Failed to capture original window bounds:', e);
      }
    })();

    return () => {
      (async () => {
        try {
          const bounds = originalBoundsRef.current;
          if (bounds) {
            await window.electron.mainWindow.setBounds(bounds);
          }
        } catch (e) {
          console.warn('Failed to restore original window bounds:', e);
        }
      })();
    };
  }, []);

  useEffect(() => {
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      setShowAIChat(!!context.currentProject);
      // Send project context to main process
      if (context.currentProject) {
        window.electron.projectContext.updateContext(context);
        // Auto-start server for appropriate projects
        handleAutoStartServer(context.currentProject);
      }
    });
    
    return () => {
      unsubscribeProject();
    };
  }, []);

  // Check server status on component mount
  useEffect(() => {
    checkServerStatus();
  }, []);

  // Check if project is suitable for local server
  const isProjectSuitableForServer = (project: any): boolean => {
    if (!project) return false;
    
    // Check if it's a web-related project
    const suitableTypes = ['wordpress', 'web'];
    const hasWebContent = project.metadata?.hasWordPress || 
                         project.metadata?.hasPackageJson || 
                         project.type === 'web';
    
    return suitableTypes.includes(project.type) || hasWebContent;
  };

  // Auto-start server for appropriate projects
  const handleAutoStartServer = async (project: any) => {
    if (!autoStartEnabled) {
      console.log('Auto-start disabled by user preference');
      return;
    }

    if (!isProjectSuitableForServer(project)) {
      console.log('Project not suitable for local server:', project.type);
      return;
    }

    // Check if server is already running
    const status = await checkServerStatus();
    if (status.isRunning) {
      const runningFolder = (status as any).folderPath || lastServerFolderPath;
      if (runningFolder && runningFolder === project.path) {
        console.log('Server already running for this project');
        openPreviewWindow(status.port || 8000);
        return;
      }
      console.log('Project changed, restarting local server for new project');
      try {
        await stopLocalServer();
      } catch (e) {
        console.warn('Failed to stop existing server before restart:', e);
      }
      await startLocalServer(project.path);
      return;
    }

    console.log('Auto-starting local server for project:', project.name);
    await startLocalServer(project.path);
  };

  // Toggle auto-start preference
  const toggleAutoStart = () => {
    const newValue = !autoStartEnabled;
    setAutoStartEnabled(newValue);
    localStorage.setItem('homepage-editor-auto-start', JSON.stringify(newValue));
  };

  // Check server status
  const checkServerStatus = async () => {
    try {
      const result = await window.electron.wordpressServer.getServerStatus();
      if (result.success && result.status) {
        setServerStatus({
          isRunning: result.status.isRunning,
          port: result.status.port,
          url: result.status.url,
          error: undefined,
        });
        if ((result.status as any).folderPath) {
          setLastServerFolderPath((result.status as any).folderPath as string);
        }
        return result.status;
      }
    } catch (error) {
      console.error('Error checking server status:', error);
      setServerStatus(prev => ({ ...prev, error: 'Failed to check server status' }));
    }
    return { isRunning: false };
  };

  // Start local server
  const startLocalServer = async (folderPath: string) => {
    if (isStartingServer) return;
    
    setIsStartingServer(true);
    try {
      const result = await window.electron.wordpressServer.startServer(folderPath, 8000);
      if (result.success) {
        setServerStatus({
          isRunning: true,
          port: result.port,
          url: `http://localhost:${result.port}`,
          error: undefined,
        });
        setLastServerFolderPath(folderPath);
        console.log(`Local server started successfully on port ${result.port}`);
        // Open preview window after successful start
        openPreviewWindow(result.port || 8000);
      } else {
        setServerStatus(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to start server' 
        }));
        console.error('Failed to start server:', result.error);
      }
    } catch (error) {
      setServerStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      console.error('Error starting server:', error);
    } finally {
      setIsStartingServer(false);
    }
  };

  // Open a new Electron browser window pointing to the local server
  const openPreviewWindow = (port: number) => {
    try {
      const url = `http://localhost:${port}`;
      window.electron.browserWindow.createWindow({
        url,
        title: 'Local Preview',
        width: 1200,
        height: 800,
        show: true,
      });
    } catch (err) {
      console.error('Failed to open preview window:', err);
    }
  };

  // Stop local server
  const stopLocalServer = async () => {
    try {
      const result = await window.electron.wordpressServer.stopServer();
      if (result.success) {
        setServerStatus({ isRunning: false });
        setLastServerFolderPath(null);
        console.log('Local server stopped');
      }
    } catch (error) {
      console.error('Error stopping server:', error);
    }
  };

  const handleProjectSelect = async (project: any) => {
    console.log('Project selected:', project);
    setCurrentProject(project);
    setShowAIChat(true);
    // Auto-start server for appropriate projects
    await handleAutoStartServer(project);
  };

  const handleBackToProjectSelection = async () => {
    // Stop server when going back to project selection
    if (serverStatus.isRunning) {
      await stopLocalServer();
    }
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
          {/* Server controller UI removed for silent start */}
          <AIChat onBackToProjectSelection={handleBackToProjectSelection} />
        </div>
      )}
    </div>
  );
};

export default HomepageEditor;
