import React, { useState, useEffect } from 'react';
import ProjectSelector from './ProjectSelector';
import ProjectContextService, { ProjectInfo } from '../services/projectContextService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faTimes, faQuestion, faRefresh, faCode } from '@fortawesome/free-solid-svg-icons';
import './LocalServer.css';

interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  pid?: number;
  error?: string;
}

interface FolderInfo {
  path: string;
  exists: boolean;
  hasWordPress: boolean;
  hasIndexPhp: boolean;
  hasWpContent: boolean;
  hasHtmlFiles: boolean;
  htmlFileCount: number;
  phpFileCount: number;
  folderType: 'www' | 'wordpress' | 'mixed' | 'unknown';
  detectedRoot?: string;
  availableFiles?: string[];
}

interface LocalServerProps {
  onStatusChange?: (status: ServerStatus) => void;
}

const LocalServer: React.FC<LocalServerProps> = ({ onStatusChange }) => {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isRunning: false,
    port: 8000,
    url: 'http://localhost:8000'
  });
  
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [folderInfo, setFolderInfo] = useState<FolderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);

  // Subscribe to project context changes
  useEffect(() => {
    const unsubscribe = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      
      // If current project changes and we have folder info, update the folder
      if (context.currentProject && context.currentProject.path !== currentFolder) {
        setCurrentFolder(context.currentProject.path);
        analyzeFolder(context.currentProject.path);
      }
    });

    return unsubscribe;
  }, [currentFolder]);

  // Check if server is running on component mount
  useEffect(() => {
    checkServerStatus();
    // Check every 5 seconds
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Emit status to parent when it changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(serverStatus);
    }
  }, [serverStatus, onStatusChange]);

  const checkServerStatus = async () => {
    try {
      const result = await window.electron.wordpressServer.getServerStatus();
      if (result.success && result.status) {
        setServerStatus(result.status);
      }
    } catch (error) {
      console.error('Error checking server status:', error);
    }
  };

  const analyzeFolder = async (folderPath: string) => {
    try {
      const result = await window.electron.wordpressServer.analyzeFolder(folderPath);
      if (result.success && result.info) {
        setFolderInfo(result.info);
        setCurrentFolder(folderPath);
        
        if (result.info.hasWordPress) {
          addLog(`✅ Server-compatible folder detected: ${folderPath}`);
          addLog(`📁 Folder type: ${result.info.folderType}`);
          if (result.info.detectedRoot && result.info.detectedRoot !== folderPath) {
            addLog(`🎯 Will serve from: ${result.info.detectedRoot}`);
          }
          if (result.info.htmlFileCount > 0) {
            addLog(`HTML files: ${result.info.htmlFileCount}`);
          }
          if (result.info.phpFileCount > 0) {
            addLog(`🐘 PHP files: ${result.info.phpFileCount}`);
          }
        } else {
          addLog(`⚠️  Folder structure not recognized, but server can still try to serve it: ${folderPath}`);
        }
      } else {
        addLog(`Error analyzing folder: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error analyzing folder: ${error}`);
    }
  };

  const selectFolder = async () => {
    try {
      const result = await window.electron.wordpressServer.pickFolder();
      if (result.success && result.folderPath) {
        // Set as current project
        await ProjectContextService.getInstance().setCurrentProject(result.folderPath);
        await analyzeFolder(result.folderPath);
      } else {
        addLog(`No folder selected: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error selecting folder: ${error}`);
    }
  };

  const startServer = async () => {
    if (!folderInfo) {
      addLog('Please select a folder first');
      return;
    }
    
    // Allow any folder that exists - the server can handle various structures
    if (!folderInfo.exists) {
      addLog('Selected folder does not exist');
      return;
    }

    setIsLoading(true);
    addLog('🚀 Starting WordPress server...');

    try {
      const result = await window.electron.wordpressServer.startServer(currentFolder, serverStatus.port);
      if (result.success) {
        addLog(`✅ Server started successfully on port ${result.port}`);
        addLog(`📁 Serving from: ${currentFolder}`);
        
        // Update server status
        setServerStatus(prev => ({
          ...prev,
          isRunning: true,
          port: result.port || prev.port,
          url: `http://localhost:${result.port || prev.port}`,
          error: undefined
        }));
      } else {
        const errorMsg = `Failed to start server: ${result.error}`;
        addLog(errorMsg);
        setServerStatus(prev => ({ ...prev, error: errorMsg }));
      }
    } catch (error) {
      const errorMsg = `Failed to start server: ${error}`;
      addLog(errorMsg);
      setServerStatus(prev => ({ ...prev, error: errorMsg }));
    } finally {
      setIsLoading(false);
    }
  };

  const stopServer = async () => {
    setIsLoading(true);
    addLog('🛑 Stopping WordPress server...');

    try {
      const result = await window.electron.wordpressServer.stopServer();
      if (result.success) {
        addLog('✅ Server stopped successfully');
        setServerStatus(prev => ({
          ...prev,
          isRunning: false
        }));
      } else {
        addLog(`Error stopping server: ${result.error}`);
      }
    } catch (error) {
      addLog(`Error stopping server: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openInBrowser = () => {
    if (serverStatus.isRunning) {
      window.open(serverStatus.url, '_blank');
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleProjectSelect = (project: ProjectInfo) => {
    setCurrentFolder(project.path);
    analyzeFolder(project.path);
    addLog(`📁 Switched to project: ${project.name} (${project.path})`);
  };

  return (
    <div className="local-server">
      <div className="server-header">
        <h2>🖥️ Local WordPress Server</h2>
        <p>Manage your local PHP server for WordPress development</p>
      </div>

      {/* Project Context Section */}
      <div className="project-context-section">
        <h3>📁 Project Context</h3>
        <div className="project-context-content">
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            showCurrentProject={true}
            showRecentProjects={true}
            showAvailableProjects={false}
            className="server-project-selector"
          />
          
          {currentProject && (
            <div className="project-details">
              <div className="project-metadata">
                <div className="metadata-item">
                  <strong>Type:</strong> {currentProject.type}
                </div>
                <div className="metadata-item">
                  <strong>Language:</strong> {currentProject.metadata.language}
                </div>
                <div className="metadata-item">
                  <strong>Framework:</strong> {currentProject.metadata.framework}
                </div>
                {currentProject.metadata.version && (
                  <div className="metadata-item">
                    <strong>Version:</strong> {currentProject.metadata.version}
                  </div>
                )}
                <div className="metadata-item">
                  <strong>Last Accessed:</strong> {currentProject.lastAccessed.toLocaleDateString()}
                </div>
              </div>
              
              <div className="project-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => ProjectContextService.getInstance().updateProjectMetadata(currentProject.id)}
                >
                  <FontAwesomeIcon icon={faRefresh} /> Refresh Metadata
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => ProjectContextService.getInstance().refreshAllProjects()}
                >
                  <FontAwesomeIcon icon={faRefresh} /> Refresh All Projects
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="server-controls">
        <div className="folder-section">
          <h3>📁 WordPress Folder</h3>
          <div className="folder-input">
            <input
              type="text"
              value={currentFolder}
              onChange={(e) => setCurrentFolder(e.target.value)}
              placeholder="Enter WordPress folder path or click Select Folder"
              disabled={isLoading}
            />
            <button 
              onClick={selectFolder}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              Select Folder
            </button>
          </div>
          
          {folderInfo && (
            <div className="folder-info">
              <div className={`status-indicator ${folderInfo.hasWordPress ? 'success' : 'warning'}`}>
                {folderInfo.hasWordPress ? '✅' : '⚠️'} Server Compatible
              </div>
              <div className={`status-indicator ${folderInfo.folderType === 'www' ? 'success' : folderInfo.folderType === 'wordpress' ? 'success' : folderInfo.folderType === 'mixed' ? 'success' : 'warning'}`}>
                {folderInfo.folderType === 'www' ? <FontAwesomeIcon icon={faGlobe} /> : folderInfo.folderType === 'wordpress' ? <FontAwesomeIcon icon={faCode} /> : folderInfo.folderType === 'mixed' ? <FontAwesomeIcon icon={faRefresh} /> : <FontAwesomeIcon icon={faQuestion} />} {folderInfo.folderType}
              </div>
              {folderInfo.htmlFileCount > 0 && (
                <div className="status-indicator success">
                  <FontAwesomeIcon icon={faGlobe} /> {folderInfo.htmlFileCount} HTML files
                </div>
              )}
              {folderInfo.phpFileCount > 0 && (
                <div className="status-indicator success">
                  <FontAwesomeIcon icon={faCode} /> {folderInfo.phpFileCount} PHP files
                </div>
              )}
              {folderInfo.folderType === 'wordpress' || folderInfo.folderType === 'mixed' ? (
                <>
                  <div className={`status-indicator ${folderInfo.hasIndexPhp ? 'success' : 'error'}`}>
                    {folderInfo.hasIndexPhp ? '✅' : '❌'} index.php
                  </div>
                  <div className={`status-indicator ${folderInfo.hasWpContent ? 'success' : 'error'}`}>
                    {folderInfo.hasWpContent ? '✅' : '❌'} wp-content
                  </div>
                </>
              ) : (
                <div className="status-indicator success">
                  ✅ Ready to serve files
                </div>
              )}
              {folderInfo.detectedRoot && folderInfo.detectedRoot !== currentFolder && (
                <div className="status-indicator success">
                  🎯 Will serve: {folderInfo.detectedRoot}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="server-section">
          <h3>🚀 Server Controls</h3>
          <div className="server-buttons">
            {!serverStatus.isRunning ? (
              <button
                onClick={startServer}
                disabled={isLoading || !folderInfo?.exists}
                className="btn btn-primary"
              >
                {isLoading ? 'Starting...' : 'Start Server'}
              </button>
            ) : (
              <button
                onClick={stopServer}
                disabled={isLoading}
                className="btn btn-danger"
              >
                {isLoading ? 'Stopping...' : 'Stop Server'}
              </button>
            )}
            
            {serverStatus.isRunning && (
              <button
                onClick={openInBrowser}
                className="btn btn-success"
              >
                Open in Browser
              </button>
            )}
          </div>
        </div>

        <div className="server-status">
          <h3>📊 Server Status</h3>
          <div className={`status ${serverStatus.isRunning ? 'running' : 'stopped'}`}>
            <span className="status-dot"></span>
            {serverStatus.isRunning ? 'Running' : 'Stopped'}
          </div>
          
          {serverStatus.isRunning && (
            <div className="status-details">
              <p><strong>Port:</strong> {serverStatus.port}</p>
              <p><strong>URL:</strong> <a href={serverStatus.url} target="_blank" rel="noopener noreferrer">{serverStatus.url}</a></p>
              <p><strong>Folder:</strong> {currentFolder}</p>
              {currentProject && (
                <p><strong>Project:</strong> {currentProject.name} ({currentProject.type})</p>
              )}
            </div>
          )}
          
          {serverStatus.error && (
            <div className="error-message">
              <strong>Error:</strong> {serverStatus.error}
            </div>
          )}
        </div>
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <h3>📝 Server Logs</h3>
          <button onClick={clearLogs} className="btn btn-small">
            Clear Logs
          </button>
        </div>
        <div className="logs-container">
          {logs.length === 0 ? (
            <p className="no-logs">No logs yet. Start the server to see activity.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="server-info">
        <h3>ℹ️ Server Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>PHP Version:</strong> 8.4.11
          </div>
          <div className="info-item">
            <strong>Default Port:</strong> 8000
          </div>
          <div className="info-item">
            <strong>Document Root:</strong> {currentFolder || 'Not set'}
          </div>
          <div className="info-item">
            <strong>Server Type:</strong> PHP Built-in Server
          </div>
          {folderInfo && (
            <>
              <div className="info-item">
                <strong>Folder Type:</strong> {folderInfo.folderType}
              </div>
              {folderInfo.htmlFileCount > 0 && (
                <div className="info-item">
                  <strong>HTML Files:</strong> {folderInfo.htmlFileCount}
                </div>
              )}
              {folderInfo.phpFileCount > 0 && (
                <div className="info-item">
                  <strong>PHP Files:</strong> {folderInfo.phpFileCount}
                </div>
              )}
              {folderInfo.detectedRoot && (
                <div className="info-item">
                  <strong>Detected Root:</strong> {folderInfo.detectedRoot}
                </div>
              )}
            </>
          )}
          {currentProject && (
            <>
              <div className="info-item">
                <strong>Current Project:</strong> {currentProject.name}
              </div>
              <div className="info-item">
                <strong>Project Type:</strong> {currentProject.type}
              </div>
              <div className="info-item">
                <strong>Project Language:</strong> {currentProject.metadata.language}
              </div>
              {currentProject.metadata.version && (
                <div className="info-item">
                  <strong>Project Version:</strong> {currentProject.metadata.version}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalServer;
