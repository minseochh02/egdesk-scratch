import React, { useEffect, useState } from 'react';
import './DeveloperWindow.css';

interface DeveloperWindowProps {
  projectId?: string;
}

interface ServerInfo {
  port: number;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  projectPath: string;
}

interface RegisteredProject {
  projectName: string;
  folderPath: string;
  port: number;
  url: string;
  status: 'running' | 'stopped' | 'error';
  registeredAt: string;
}

const DeveloperWindow: React.FC<DeveloperWindowProps> = ({ projectId }) => {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [registeredProject, setRegisteredProject] = useState<RegisteredProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Removed automatic window creation on mount
  // Windows will be created after dev server starts successfully

  // Get folder path from localStorage if user selected one
  useEffect(() => {
    const storedPath = localStorage.getItem('selected-project-folder');
    if (storedPath) {
      setFolderPath(storedPath);
      startDevServer(storedPath);
    }
  }, []);

  // Poll for registered project info
  useEffect(() => {
    if (!folderPath) return;

    const checkRegisteredProject = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('project-registry:get-by-path', folderPath);
        if (result.success && result.project) {
          setRegisteredProject(result.project);
        }
      } catch (err) {
        console.error('Failed to fetch registered project:', err);
      }
    };

    // Check immediately
    checkRegisteredProject();

    // Poll every 2 seconds
    const interval = setInterval(checkRegisteredProject, 2000);

    return () => clearInterval(interval);
  }, [folderPath]);

  const startDevServer = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const electron = (window as any).electron;
      if (!electron) {
        throw new Error('Electron API not available');
      }

      // Analyze folder first
      console.log('Analyzing folder:', path);
      const analyzeResult = await electron.ipcRenderer.invoke('dev-server:analyze-folder', path);

      if (!analyzeResult.success) {
        throw new Error(analyzeResult.error || 'Failed to analyze folder');
      }

      console.log('Project info:', analyzeResult.projectInfo);

      // Start dev server
      console.log('Starting dev server...');
      const startResult = await electron.ipcRenderer.invoke('dev-server:start', path);

      if (!startResult.success) {
        throw new Error(startResult.error || 'Failed to start dev server');
      }

      console.log('Dev server started:', startResult.serverInfo);
      setServerInfo(startResult.serverInfo);

      // Store server URL for WebsiteViewer to access
      localStorage.setItem('dev-server-url', startResult.serverInfo.url);

      // Now that server is ready, create the developer windows
      try {
        const result = await electron.ipcRenderer.invoke('create-developer-windows');
        if (result.success) {
          console.log('Developer windows created successfully');
        } else {
          console.error('Failed to create developer windows:', result.error);
        }
      } catch (windowError) {
        console.error('Error creating developer windows:', windowError);
        // Don't fail the whole flow if window creation fails
      }
    } catch (err: any) {
      console.error('Error starting dev server:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="developer-window">
      <h2>Developer Window</h2>

      {folderPath && (
        <div className="developer-info">
          <p><strong>Project Folder:</strong> {folderPath}</p>
        </div>
      )}

      {loading && (
        <div className="developer-status">
          <p>Starting development server...</p>
        </div>
      )}

      {error && (
        <div className="developer-error">
          <p><strong>Error:</strong></p>
          <pre className="developer-error-detail">{error}</pre>
        </div>
      )}

      {registeredProject && (
        <div className="developer-status">
          <p><strong>Project Name:</strong> {registeredProject.projectName}</p>
          <p><strong>Status:</strong> {registeredProject.status}</p>
          <p><strong>Local URL:</strong> <a href={registeredProject.url} target="_blank" rel="noopener noreferrer">{registeredProject.url}</a></p>
          <p><strong>Port:</strong> {registeredProject.port}</p>
          <p className="developer-tunnel-info">
            <strong>Public Access:</strong> When tunnel is active, your project will be accessible at:
            <br />
            <code>https://tunneling-service.onrender.com/t/&#123;tunnel_id&#125;/p/{registeredProject.projectName}/</code>
          </p>
        </div>
      )}

      {!registeredProject && serverInfo && (
        <div className="developer-status">
          <p><strong>Status:</strong> {serverInfo.status}</p>
          <p><strong>URL:</strong> <a href={serverInfo.url} target="_blank" rel="noopener noreferrer">{serverInfo.url}</a></p>
          <p><strong>Port:</strong> {serverInfo.port}</p>
        </div>
      )}

      {!folderPath && !loading && (
        <div className="developer-empty">
          <p>No project folder selected. Please go back and select a folder.</p>
        </div>
      )}
    </div>
  );
};

export default DeveloperWindow;
