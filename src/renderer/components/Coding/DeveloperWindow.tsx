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
  type?: 'nextjs' | 'vite' | 'react' | 'unknown';
}

const DeveloperWindow: React.FC<DeveloperWindowProps> = ({ projectId }) => {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [registeredProject, setRegisteredProject] = useState<RegisteredProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCheckDone, setNodeCheckDone] = useState(false);
  const [tunnelId, setTunnelId] = useState<string | null>(null);

  // Removed automatic window creation on mount
  // Windows will be created after dev server starts successfully

  // Check Node.js installation on mount
  useEffect(() => {
    const checkNode = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('dev-server:check-node');

        if (!result.success) {
          setError('Failed to check Node.js installation');
          return;
        }

        if (!result.hasNode || !result.hasNpm) {
          const missing = [];
          if (!result.hasNode) missing.push('Node.js');
          if (!result.hasNpm) missing.push('npm');

          const errorMessage = `${missing.join(' and ')} not installed.\n\n` +
            `Please install Node.js from https://nodejs.org/\n` +
            `Download the LTS version and restart EGDesk after installation.\n\n` +
            `Detected versions:\n` +
            `Node.js: ${result.nodeVersion || 'Not found'}\n` +
            `npm: ${result.npmVersion || 'Not found'}`;

          setError(errorMessage);
          setNodeCheckDone(true);
          return;
        }

        console.log(`✅ Node.js ${result.nodeVersion} and npm ${result.npmVersion} available`);
        setNodeCheckDone(true);
      } catch (err) {
        console.error('Failed to check Node.js:', err);
        setNodeCheckDone(true);
      }
    };

    checkNode();
  }, []);

  // Get tunnel ID from Electron Store
  useEffect(() => {
    const fetchTunnelId = async () => {
      try {
        const electron = (window as any).electron;
        if (!electron?.ipcRenderer) return;

        const result = await electron.ipcRenderer.invoke('get-mcp-tunnel-config');
        if (result.success && result.config?.tunnel?.tunnelId) {
          setTunnelId(result.config.tunnel.tunnelId);
        }
      } catch (err) {
        console.error('Failed to fetch tunnel config:', err);
      }
    };

    fetchTunnelId();

    // Poll every 5 seconds to update tunnel status
    const interval = setInterval(fetchTunnelId, 5000);
    return () => clearInterval(interval);
  }, []);

  // Get folder path from localStorage if user selected one
  useEffect(() => {
    // Don't start server until Node check is done
    if (!nodeCheckDone) return;

    const storedPath = localStorage.getItem('selected-project-folder');
    if (storedPath) {
      setFolderPath(storedPath);
      startDevServer(storedPath);
    }
  }, [nodeCheckDone]);

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

          // Update WebsiteViewer URL if this is a Next.js project with active tunnel
          if (result.project.type === 'nextjs' && tunnelId) {
            const tunnelUrl = `https://tunneling-service.onrender.com/t/${tunnelId}/p/${result.project.projectName}/`;
            localStorage.setItem('dev-server-url', tunnelUrl);
            console.log('📡 Updated viewer URL to tunnel:', tunnelUrl);
          }
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
  }, [folderPath, tunnelId]);

  const killPortProcess = async (port: number) => {
    try {
      const electron = (window as any).electron;
      if (!electron?.ipcRenderer) return;

      console.log(`Attempting to kill process on port ${port}...`);
      const result = await electron.ipcRenderer.invoke('dev-server:kill-port', port);

      if (result.success) {
        alert(`✅ Successfully killed process on port ${port}`);
        setError(null);
      } else {
        alert(`❌ Failed to kill process: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Error killing port process:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

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

      // For Next.js projects, use tunnel URL instead of localhost
      let viewerUrl = startResult.serverInfo.url;

      if (analyzeResult.projectInfo.type === 'nextjs') {
        // Get tunnel config
        const tunnelConfigResult = await electron.ipcRenderer.invoke('get-mcp-tunnel-config');
        if (tunnelConfigResult.success && tunnelConfigResult.config?.tunnel?.tunnelId) {
          const projectName = require('path').basename(path);
          const tunnelUrl = `https://tunneling-service.onrender.com/t/${tunnelConfigResult.config.tunnel.tunnelId}/p/${projectName}/`;
          viewerUrl = tunnelUrl;
          console.log('📡 Using tunnel URL for Next.js project:', tunnelUrl);
        }
      }

      // Store server URL for WebsiteViewer to access
      localStorage.setItem('dev-server-url', viewerUrl);

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
          <p>🚀 Starting development server...</p>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            If this is a new project, we're setting up Next.js for you. This may take a few minutes...
          </p>
        </div>
      )}

      {error && (
        <div className="developer-error">
          <p><strong>Error:</strong></p>
          <pre className="developer-error-detail">{error}</pre>
          {(error.includes('Node.js') || error.includes('npm')) && (
            <div style={{ marginTop: '16px' }}>
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
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Download Node.js (LTS)
              </button>
            </div>
          )}
          {(error.includes('EADDRINUSE') || error.includes('port') || error.includes('3000')) && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                Port may be in use. Click below to force kill any process on port 3000:
              </p>
              <button
                onClick={() => killPortProcess(3000)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Kill Process on Port 3000
              </button>
            </div>
          )}
        </div>
      )}

      {registeredProject && (
        <div className="developer-status">
          <p><strong>Project Name:</strong> {registeredProject.projectName}</p>
          <p><strong>Type:</strong> {registeredProject.type || 'unknown'}</p>
          <p><strong>Status:</strong> {registeredProject.status}</p>

          {tunnelId && registeredProject.type === 'nextjs' ? (
            <>
              <p><strong>Tunnel URL:</strong> <a
                href={`https://tunneling-service.onrender.com/t/${tunnelId}/p/${registeredProject.projectName}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0070f3' }}
              >
                https://tunneling-service.onrender.com/t/{tunnelId}/p/{registeredProject.projectName}/
              </a></p>
              <p style={{ fontSize: '12px', color: '#f5a623', marginTop: '8px' }}>
                ⚠️ Note: For Next.js projects, localhost access is disabled to support tunnel routing. Use the tunnel URL above.
              </p>
            </>
          ) : tunnelId ? (
            <>
              <p><strong>Local URL:</strong> <a href={registeredProject.url} target="_blank" rel="noopener noreferrer">{registeredProject.url}</a></p>
              <p><strong>Tunnel URL:</strong> <a
                href={`https://tunneling-service.onrender.com/t/${tunnelId}/p/${registeredProject.projectName}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0070f3' }}
              >
                https://tunneling-service.onrender.com/t/{tunnelId}/p/{registeredProject.projectName}/
              </a></p>
            </>
          ) : (
            <p><strong>Local URL:</strong> <a href={registeredProject.url} target="_blank" rel="noopener noreferrer">{registeredProject.url}</a></p>
          )}

          <p><strong>Port:</strong> {registeredProject.port}</p>
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

      {/* Port utilities section */}
      {folderPath && (
        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>🔧 Port Utilities</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => killPortProcess(3000)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              Kill Port 3000
            </button>
            <span style={{ fontSize: '12px', color: '#666' }}>
              Use this if dev server fails to start due to port conflict
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperWindow;
