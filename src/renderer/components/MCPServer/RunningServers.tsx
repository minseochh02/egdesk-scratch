import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer, 
  faGlobe, 
  faCircleCheck, 
  faCircleXmark, 
  faSpinner, 
  faTriangleExclamation,
  faArrowRight,
  faRefresh,
  faPlay,
  faStop,
  faCog,
  faChartBar,
  faClock,
  faMemory,
  faNetworkWired,
  faTerminal
} from '../../utils/fontAwesomeIcons';
import './RunningServers.css';

interface RunningMCPServer {
  id: string;
  name: string;
  type: 'gmail' | 'custom' | 'builtin';
  address: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  uptime: number; // in seconds
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
  lastActivity: string;
  version: string;
  description?: string;
  healthCheck: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: string;
    responseTime: number; // in ms
  };
  tools: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }>;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
  }>;
}

interface RunningServersProps {
  onBack?: () => void;
  onViewDetails?: (server: RunningMCPServer) => void;
  onRestart?: (serverId: string) => void;
  onStop?: (serverId: string) => void;
  onStart?: (serverId: string) => void;
}

const RunningServers: React.FC<RunningServersProps> = ({ 
  onBack, 
  onViewDetails, 
  onRestart, 
  onStop, 
  onStart 
}) => {
  const [servers, setServers] = useState<RunningMCPServer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<RunningMCPServer | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  useEffect(() => {
    loadRunningServers();
    
    // Auto-refresh every 5 seconds if enabled
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadRunningServers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadRunningServers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for now - replace with actual API call
      const mockServers: RunningMCPServer[] = [
        {
          id: 'gmail-server-1',
          name: 'Gmail MCP Server',
          type: 'gmail',
          address: 'localhost',
          port: 3001,
          protocol: 'http',
          status: 'running',
          uptime: 3600, // 1 hour
          memoryUsage: 45.2,
          cpuUsage: 12.5,
          lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          version: '1.2.0',
          description: 'Gmail integration server for EG Blogging',
          healthCheck: {
            status: 'healthy',
            lastCheck: new Date().toISOString(),
            responseTime: 45
          },
          tools: [
            { name: 'fetch_emails', description: 'Fetch user emails', enabled: true },
            { name: 'send_email', description: 'Send emails', enabled: true },
            { name: 'manage_labels', description: 'Manage email labels', enabled: true }
          ],
          logs: [
            { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: 'Server started successfully' },
            { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'Health check passed' },
            { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info', message: 'Processing email request' }
          ]
        },
        {
          id: 'custom-server-1',
          name: 'Custom Blog Server',
          type: 'custom',
          address: '192.168.1.100',
          port: 8080,
          protocol: 'https',
          status: 'running',
          uptime: 7200, // 2 hours
          memoryUsage: 78.9,
          cpuUsage: 25.3,
          lastActivity: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          version: '2.1.0',
          description: 'Custom blog management server',
          healthCheck: {
            status: 'healthy',
            lastCheck: new Date().toISOString(),
            responseTime: 120
          },
          tools: [
            { name: 'create_post', description: 'Create blog posts', enabled: true },
            { name: 'update_post', description: 'Update blog posts', enabled: true },
            { name: 'delete_post', description: 'Delete blog posts', enabled: false }
          ],
          logs: [
            { timestamp: new Date(Date.now() - 30000).toISOString(), level: 'info', message: 'Blog post created successfully' },
            { timestamp: new Date(Date.now() - 90000).toISOString(), level: 'warn', message: 'High memory usage detected' },
            { timestamp: new Date(Date.now() - 150000).toISOString(), level: 'info', message: 'Server health check passed' }
          ]
        },
        {
          id: 'builtin-server-1',
          name: 'File System Server',
          type: 'builtin',
          address: 'localhost',
          port: 3002,
          protocol: 'http',
          status: 'error',
          uptime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          lastActivity: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          version: '1.0.0',
          description: 'Built-in file system operations server',
          healthCheck: {
            status: 'unhealthy',
            lastCheck: new Date(Date.now() - 300000).toISOString(),
            responseTime: 0
          },
          tools: [
            { name: 'read_file', description: 'Read files', enabled: false },
            { name: 'write_file', description: 'Write files', enabled: false },
            { name: 'list_directory', description: 'List directory contents', enabled: false }
          ],
          logs: [
            { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'error', message: 'Server crashed due to memory error' },
            { timestamp: new Date(Date.now() - 600000).toISOString(), level: 'warn', message: 'Memory usage exceeded threshold' },
            { timestamp: new Date(Date.now() - 900000).toISOString(), level: 'info', message: 'Server started' }
          ]
        }
      ];

      setServers(mockServers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load running servers');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadRunningServers();
  };

  const handleServerAction = async (serverId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      // Mock action - replace with actual API call
      console.log(`${action} server ${serverId}`);
      
      // Update server status optimistically
      setServers(prev => prev.map(server => {
        if (server.id === serverId) {
          return {
            ...server,
            status: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'starting'
          };
        }
        return server;
      }));

      // Simulate action completion after 2 seconds
      setTimeout(() => {
        setServers(prev => prev.map(server => {
          if (server.id === serverId) {
            return {
              ...server,
              status: action === 'stop' ? 'stopped' : 'running',
              uptime: action === 'start' ? 0 : server.uptime
            };
          }
          return server;
        }));
      }, 2000);

      // Call the appropriate handler
      if (action === 'start') onStart?.(serverId);
      else if (action === 'stop') onStop?.(serverId);
      else if (action === 'restart') onRestart?.(serverId);
    } catch (err) {
      console.error(`Error ${action}ing server:`, err);
    }
  };

  const handleViewLogs = (server: RunningMCPServer) => {
    setSelectedServer(server);
    setShowLogs(true);
  };

  const handleCloseLogs = () => {
    setShowLogs(false);
    setSelectedServer(null);
  };

  const formatUptime = (seconds: number) => {
    if (seconds === 0) return 'Not running';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatLastActivity = (timestamp: string) => {
    const now = new Date();
    const activity = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activity.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return activity.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'error';
      case 'error':
        return 'error';
      case 'starting':
      case 'stopping':
        return 'warning';
      default:
        return 'unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return faCircleCheck;
      case 'stopped':
        return faCircleXmark;
      case 'error':
        return faTriangleExclamation;
      case 'starting':
      case 'stopping':
        return faSpinner;
      default:
        return faCog;
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      case 'unknown':
      default:
        return 'warning';
    }
  };

  const getServerIcon = (type: string) => {
    switch (type) {
      case 'gmail':
        return faServer;
      case 'custom':
        return faCog;
      case 'builtin':
        return faTerminal;
      default:
        return faServer;
    }
  };

  if (loading) {
    return (
      <div className="running-servers">
        <div className="running-servers-loading">
          <div className="running-servers-spinner"></div>
          <p>Loading running servers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="running-servers">
        <div className="running-servers-error">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <h3>Error Loading Servers</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="running-servers-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="running-servers">
      {/* Header */}
      <div className="running-servers-header">
        <div className="running-servers-header-left">
          {onBack && (
            <button className="running-servers-back-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to MCP Tools</span>
            </button>
          )}
          <div className="running-servers-title">
            <div className="running-servers-icon">
              <FontAwesomeIcon icon={faServer} />
            </div>
            <div>
              <h2>Running MCP Servers</h2>
              <p>Monitor and manage your active MCP servers</p>
            </div>
          </div>
        </div>
        <div className="running-servers-header-right">
          <div className="running-servers-controls">
            <label className="running-servers-auto-refresh">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh</span>
            </label>
            <button className="running-servers-refresh-btn" onClick={handleRefresh}>
              <FontAwesomeIcon icon={faRefresh} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="running-servers-stats">
        <div className="running-servers-stat-card">
          <div className="running-servers-stat-icon">
            <FontAwesomeIcon icon={faServer} />
          </div>
          <div className="running-servers-stat-content">
            <div className="running-servers-stat-number">{servers.length}</div>
            <div className="running-servers-stat-label">Total Servers</div>
          </div>
        </div>
        <div className="running-servers-stat-card">
          <div className="running-servers-stat-icon">
            <FontAwesomeIcon icon={faCircleCheck} />
          </div>
          <div className="running-servers-stat-content">
            <div className="running-servers-stat-number">{servers.filter(s => s.status === 'running').length}</div>
            <div className="running-servers-stat-label">Running</div>
          </div>
        </div>
        <div className="running-servers-stat-card">
          <div className="running-servers-stat-icon">
            <FontAwesomeIcon icon={faCircleXmark} />
          </div>
          <div className="running-servers-stat-content">
            <div className="running-servers-stat-number">{servers.filter(s => s.status === 'stopped').length}</div>
            <div className="running-servers-stat-label">Stopped</div>
          </div>
        </div>
        <div className="running-servers-stat-card">
          <div className="running-servers-stat-icon">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <div className="running-servers-stat-content">
            <div className="running-servers-stat-number">{servers.filter(s => s.status === 'error').length}</div>
            <div className="running-servers-stat-label">Errors</div>
          </div>
        </div>
      </div>

      {/* Servers List */}
      <div className="running-servers-list">
        {servers.length === 0 ? (
          <div className="running-servers-empty">
            <FontAwesomeIcon icon={faServer} />
            <h3>No Running Servers</h3>
            <p>No MCP servers are currently running.</p>
          </div>
        ) : (
          servers.map((server) => (
            <div key={server.id} className="running-servers-card">
              <div className="running-servers-card-header">
                <div className="running-servers-card-header-left">
                  <div 
                    className="running-servers-card-icon"
                    style={{ 
                      background: server.type === 'gmail' ? '#ea4335' : 
                                 server.type === 'custom' ? '#667eea' : '#6b7280'
                    }}
                  >
                    <FontAwesomeIcon icon={getServerIcon(server.type)} />
                  </div>
                  <div className="running-servers-card-info">
                    <h3>{server.name}</h3>
                    <p>{server.description || `${server.type} MCP server`}</p>
                    <div className="running-servers-card-meta">
                      <span className="running-servers-card-version">v{server.version}</span>
                      <span className="running-servers-card-address">
                        {server.protocol}://{server.address}:{server.port}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="running-servers-card-status">
                  <span className={`running-servers-status-indicator running-servers-status-${getStatusColor(server.status)}`}>
                    <FontAwesomeIcon 
                      icon={getStatusIcon(server.status)} 
                      className={server.status === 'starting' || server.status === 'stopping' ? 'running-servers-spinning' : ''}
                    />
                  </span>
                  <span className="running-servers-status-text">{server.status}</span>
                </div>
              </div>

              <div className="running-servers-card-body">
                <div className="running-servers-card-metrics">
                  <div className="running-servers-metric">
                    <FontAwesomeIcon icon={faClock} />
                    <span className="running-servers-metric-label">Uptime:</span>
                    <span className="running-servers-metric-value">{formatUptime(server.uptime)}</span>
                  </div>
                  <div className="running-servers-metric">
                    <FontAwesomeIcon icon={faMemory} />
                    <span className="running-servers-metric-label">Memory:</span>
                    <span className="running-servers-metric-value">{server.memoryUsage.toFixed(1)} MB</span>
                  </div>
                  <div className="running-servers-metric">
                    <FontAwesomeIcon icon={faChartBar} />
                    <span className="running-servers-metric-label">CPU:</span>
                    <span className="running-servers-metric-value">{server.cpuUsage.toFixed(1)}%</span>
                  </div>
                  <div className="running-servers-metric">
                    <FontAwesomeIcon icon={faNetworkWired} />
                    <span className="running-servers-metric-label">Response:</span>
                    <span className="running-servers-metric-value">{server.healthCheck.responseTime}ms</span>
                  </div>
                </div>

                <div className="running-servers-card-health">
                  <div className="running-servers-health-status">
                    <span className={`running-servers-health-indicator running-servers-health-${getHealthColor(server.healthCheck.status)}`}>
                      <FontAwesomeIcon icon={faCircleCheck} />
                    </span>
                    <span className="running-servers-health-text">{server.healthCheck.status}</span>
                  </div>
                  <div className="running-servers-last-activity">
                    Last activity: {formatLastActivity(server.lastActivity)}
                  </div>
                </div>

                <div className="running-servers-card-tools">
                  <div className="running-servers-tools-header">
                    <span>Available Tools ({server.tools.filter(t => t.enabled).length}/{server.tools.length})</span>
                  </div>
                  <div className="running-servers-tools-list">
                    {server.tools.slice(0, 3).map((tool, index) => (
                      <span 
                        key={index} 
                        className={`running-servers-tool ${tool.enabled ? 'enabled' : 'disabled'}`}
                      >
                        {tool.name}
                      </span>
                    ))}
                    {server.tools.length > 3 && (
                      <span className="running-servers-tool-more">
                        +{server.tools.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="running-servers-card-actions">
                <button
                  className="running-servers-action-btn running-servers-logs-btn"
                  onClick={() => handleViewLogs(server)}
                  title="View logs"
                >
                  <FontAwesomeIcon icon={faTerminal} />
                  Logs
                </button>
                <button
                  className="running-servers-action-btn running-servers-details-btn"
                  onClick={() => onViewDetails?.(server)}
                  title="View details"
                >
                  <FontAwesomeIcon icon={faCog} />
                  Details
                </button>
                {server.status === 'running' ? (
                  <>
                    <button
                      className="running-servers-action-btn running-servers-restart-btn"
                      onClick={() => handleServerAction(server.id, 'restart')}
                      title="Restart server"
                    >
                      <FontAwesomeIcon icon={faRefresh} />
                      Restart
                    </button>
                    <button
                      className="running-servers-action-btn running-servers-stop-btn"
                      onClick={() => handleServerAction(server.id, 'stop')}
                      title="Stop server"
                    >
                      <FontAwesomeIcon icon={faStop} />
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    className="running-servers-action-btn running-servers-start-btn"
                    onClick={() => handleServerAction(server.id, 'start')}
                    title="Start server"
                  >
                    <FontAwesomeIcon icon={faPlay} />
                    Start
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logs Modal */}
      {showLogs && selectedServer && (
        <div className="running-servers-logs-modal">
          <div className="running-servers-logs-modal-content">
            <div className="running-servers-logs-modal-header">
              <h3>{selectedServer.name} - Logs</h3>
              <button
                className="running-servers-logs-modal-close"
                onClick={handleCloseLogs}
              >
                ×
              </button>
            </div>
            <div className="running-servers-logs-modal-body">
              <div className="running-servers-logs-list">
                {selectedServer.logs.map((log, index) => (
                  <div key={index} className={`running-servers-log running-servers-log-${log.level}`}>
                    <span className="running-servers-log-timestamp">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="running-servers-log-level">{log.level.toUpperCase()}</span>
                    <span className="running-servers-log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunningServers;
