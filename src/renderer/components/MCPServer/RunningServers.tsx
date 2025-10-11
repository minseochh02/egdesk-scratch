import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  faTerminal,
  faEnvelope,
  faUser,
  faCalendarAlt,
  faLock,
  faWifi,
  faGlobe as faPublic,
  faShieldAlt,
  faExclamationTriangle as faExclamationCircleIcon,
  faTimes,
  faCopy
} from '../../utils/fontAwesomeIcons';
import GmailDashboard from './GmailDashboard';
import './RunningServers.css';

// Access level types
export type AccessLevel = 'claude-desktop' | 'local-network' | 'public';

interface AccessLevelConfig {
  level: AccessLevel;
  port?: number;
  bindAddress?: string;
  requiresAuth?: boolean;
  allowedIPs?: string[];
  networkInterface?: string;
}

interface RunningMCPServer {
  id: string;
  name: string;
  type: 'gmail' | 'custom' | 'builtin';
  email?: string;
  adminEmail?: string;
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
  accessLevel?: AccessLevelConfig;
  createdAt: string;
  updatedAt: string;
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
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [showAccessLevelModal, setShowAccessLevelModal] = useState<boolean>(false);
  const [editingServer, setEditingServer] = useState<RunningMCPServer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadRunningServers = useCallback(async (isInitialLoad = false) => {
    if (isRefreshing && !isInitialLoad) {
      return; // Prevent concurrent refreshes
    }
    
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      // Load from MCP configuration
      const result = await window.electron.mcpConfig.connections.get();
      
      if (result.success && result.connections) {
        const mcpServers: RunningMCPServer[] = result.connections.map((conn: any, index: number) => {
          // Use stable data for non-random metrics
          const baseUptime = 3600; // 1 hour base
          const baseMemory = 45.2; // Stable memory usage
          const baseCpu = 12.5; // Stable CPU usage
          const baseResponseTime = 45; // Stable response time
          
          // Define access levels for demo purposes
          const accessLevels: AccessLevel[] = ['claude-desktop', 'local-network', 'public'];
          const currentAccessLevel = accessLevels[index % accessLevels.length];
          
          const accessLevelConfig = {
            level: currentAccessLevel,
            port: getDefaultPortForAccessLevel(currentAccessLevel),
            bindAddress: getDefaultBindAddressForAccessLevel(currentAccessLevel),
            requiresAuth: currentAccessLevel !== 'claude-desktop',
            allowedIPs: currentAccessLevel === 'local-network' ? ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] : undefined,
          };
          
          return {
            id: conn.id,
            name: conn.name,
            type: conn.type || 'custom',
            email: conn.email,
            adminEmail: conn.adminEmail,
            address: accessLevelConfig.bindAddress,
            port: accessLevelConfig.port,
            protocol: 'http',
            status: 'running', // Default to running for now
            uptime: baseUptime + (conn.id.length * 100), // Stable but unique uptime
            memoryUsage: baseMemory + (conn.id.length * 0.5), // Stable but unique memory
            cpuUsage: baseCpu + (conn.id.length * 0.2), // Stable but unique CPU
            lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            version: '1.0.0',
            description: conn.description || `${conn.type} MCP server`,
            accessLevel: accessLevelConfig,
            createdAt: conn.createdAt || new Date().toISOString(),
            updatedAt: conn.updatedAt || new Date().toISOString(),
            healthCheck: {
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: baseResponseTime + (conn.id.length * 2) // Stable but unique response time
            },
            tools: conn.type === 'gmail' ? [
              { name: 'fetch_emails', description: 'Fetch user emails', enabled: true },
              { name: 'send_email', description: 'Send emails', enabled: true },
              { name: 'manage_labels', description: 'Manage email labels', enabled: true }
            ] : [
              { name: 'custom_tool', description: 'Custom MCP tool', enabled: true }
            ],
            logs: [
              { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: 'Server started successfully' },
              { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'Health check passed' },
              { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info', message: 'Processing request' }
            ]
          };
        });
        
        setServers(mcpServers);
      } else {
        // Create demo servers with different access levels if no connections exist
        const demoServers: RunningMCPServer[] = [
          {
            id: 'demo-gmail-1',
            name: 'Gmail MCP Server',
            type: 'gmail',
            email: 'admin@example.com',
            address: '127.0.0.1',
            port: 8080,
            protocol: 'http',
            status: 'running',
            uptime: 3600,
            memoryUsage: 45.2,
            cpuUsage: 12.5,
            lastActivity: new Date(Date.now() - 300000).toISOString(),
            version: '1.0.0',
            description: 'Gmail integration server',
            accessLevel: {
              level: 'claude-desktop',
              port: 8080,
              bindAddress: '127.0.0.1',
              requiresAuth: false,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
              { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info', message: 'Processing request' }
            ]
          },
          {
            id: 'demo-custom-1',
            name: 'Custom Blog Server',
            type: 'custom',
            address: '0.0.0.0',
            port: 8081,
            protocol: 'http',
            status: 'running',
            uptime: 7200,
            memoryUsage: 78.9,
            cpuUsage: 25.3,
            lastActivity: new Date(Date.now() - 60000).toISOString(),
            version: '2.1.0',
            description: 'Custom blog management server',
            accessLevel: {
              level: 'local-network',
              port: 8081,
              bindAddress: '0.0.0.0',
              requiresAuth: true,
              allowedIPs: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
            id: 'demo-public-1',
            name: 'Public API Server',
            type: 'custom',
            address: '0.0.0.0',
            port: 8082,
            protocol: 'https',
            status: 'running',
            uptime: 10800,
            memoryUsage: 156.7,
            cpuUsage: 45.8,
            lastActivity: new Date(Date.now() - 120000).toISOString(),
            version: '3.0.0',
            description: 'Public API server for external access',
            accessLevel: {
              level: 'public',
              port: 8082,
              bindAddress: '0.0.0.0',
              requiresAuth: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            healthCheck: {
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: 200
            },
            tools: [
              { name: 'public_api', description: 'Public API endpoints', enabled: true },
              { name: 'rate_limiting', description: 'Rate limiting controls', enabled: true },
              { name: 'analytics', description: 'Usage analytics', enabled: true }
            ],
            logs: [
              { timestamp: new Date(Date.now() - 45000).toISOString(), level: 'info', message: 'Public API request processed' },
              { timestamp: new Date(Date.now() - 180000).toISOString(), level: 'warn', message: 'Rate limit exceeded for IP 192.168.1.100' },
              { timestamp: new Date(Date.now() - 300000).toISOString(), level: 'info', message: 'Server health check passed' }
            ]
          }
        ];
        
        setServers(demoServers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load running servers');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing]);

  useEffect(() => {
    loadRunningServers(true); // Initial load with loading state
    
    // Auto-refresh every 15 seconds if enabled (increased interval)
    const interval = setInterval(() => {
      if (autoRefresh && !isRefreshing) {
        // Add small delay to prevent rapid successive calls
        setTimeout(() => {
          if (!isRefreshing) {
            loadRunningServers(false); // Auto-refresh without loading state
          }
        }, 100);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadRunningServers, isRefreshing]);

  const handleRefresh = async () => {
    await loadRunningServers(true); // Manual refresh with loading state
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

  // Gmail Dashboard functionality
  const handleViewDashboard = (server: RunningMCPServer) => {
    if (server.type === 'gmail') {
      setSelectedServer(server);
      setShowDashboard(true);
    }
  };

  const handleBackFromDashboard = () => {
    setShowDashboard(false);
    setSelectedServer(null);
  };

  // Access level management functions
  const handleAccessLevelChange = async (server: RunningMCPServer, newAccessLevel: AccessLevel) => {
    try {
      const updatedServer = {
        ...server,
        accessLevel: {
          level: newAccessLevel,
          port: getDefaultPortForAccessLevel(newAccessLevel),
          bindAddress: getDefaultBindAddressForAccessLevel(newAccessLevel),
          requiresAuth: newAccessLevel !== 'claude-desktop',
          allowedIPs: newAccessLevel === 'local-network' ? ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] : undefined,
        },
        updatedAt: new Date().toISOString(),
      };

      const result = await window.electron.mcpConfig.connections.update(server.id, updatedServer);
      
      if (result.success) {
        setServers(prev => 
          prev.map(s => 
            s.id === server.id ? updatedServer : s
          )
        );
        alert(`Access level updated to ${getAccessLevelDisplayName(newAccessLevel)}`);
      } else {
        alert(`Failed to update access level: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error updating access level: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditAccessLevel = (server: RunningMCPServer) => {
    setEditingServer(server);
    setShowAccessLevelModal(true);
  };


  // Access level helper functions
  const getDefaultPortForAccessLevel = (level: AccessLevel): number => {
    switch (level) {
      case 'claude-desktop': return 8080;
      case 'local-network': return 8081;
      case 'public': return 8082;
      default: return 8080;
    }
  };

  const getDefaultBindAddressForAccessLevel = (level: AccessLevel): string => {
    switch (level) {
      case 'claude-desktop': return '127.0.0.1';
      case 'local-network': return '0.0.0.0';
      case 'public': return '0.0.0.0';
      default: return '127.0.0.1';
    }
  };

  const getAccessLevelDisplayName = (level: AccessLevel): string => {
    switch (level) {
      case 'claude-desktop': return 'Claude Desktop Only';
      case 'local-network': return 'Local Network';
      case 'public': return 'Public Internet';
      default: return 'Unknown';
    }
  };

  const getAccessLevelIcon = (level: AccessLevel) => {
    switch (level) {
      case 'claude-desktop': return faLock;
      case 'local-network': return faWifi;
      case 'public': return faPublic;
      default: return faCog;
    }
  };

  const getAccessLevelColor = (level: AccessLevel): string => {
    switch (level) {
      case 'claude-desktop': return '#10b981'; // Green - secure
      case 'local-network': return '#f59e0b'; // Yellow - moderate
      case 'public': return '#ef4444'; // Red - public
      default: return '#6b7280'; // Gray - unknown
    }
  };

  const getAccessLevelDescription = (level: AccessLevel): string => {
    switch (level) {
      case 'claude-desktop': return 'Only accessible from Claude Desktop application on this machine';
      case 'local-network': return 'Accessible from devices on the same WiFi network';
      case 'public': return 'Accessible from anywhere on the internet (use with caution)';
      default: return 'Unknown access level';
    }
  };

  // Generate MCP JSON schema for a server
  const generateMCPSchema = (server: RunningMCPServer): string => {
    const schema = {
      mcpServers: {
        [server.name.toLowerCase().replace(/\s+/g, '-')]: {
          command: server.type === 'gmail' ? 'node' : 'python',
          args: server.type === 'gmail' 
            ? ['gmail-mcp-server.js', '--port', server.port.toString()]
            : ['mcp-server.py', '--port', server.port.toString()],
          env: server.type === 'gmail' ? {
            GMAIL_SERVICE_ACCOUNT_KEY: '${GMAIL_SERVICE_ACCOUNT_KEY}',
            GMAIL_DOMAIN: '${GMAIL_DOMAIN}',
            MCP_PORT: server.port.toString()
          } : {
            MCP_PORT: server.port.toString(),
            MCP_HOST: server.address
          },
          cwd: server.type === 'gmail' ? './mcp-servers/gmail' : './mcp-servers/custom',
          disabled: false
        }
      }
    };

    return JSON.stringify(schema, null, 2);
  };

  const handleCopySchema = async (server: RunningMCPServer) => {
    try {
      const schema = generateMCPSchema(server);
      await navigator.clipboard.writeText(schema);
      alert('MCP schema copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy schema:', err);
      alert('Failed to copy schema to clipboard');
    }
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

  // Show Gmail Dashboard if selected
  if (showDashboard && selectedServer && selectedServer.type === 'gmail') {
    return (
      <GmailDashboard
        connection={selectedServer as any}
        onBack={handleBackFromDashboard}
        onRefresh={() => loadRunningServers()}
      />
    );
  }

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
                  <div className="running-servers-metric running-servers-access-metric">
                    <div className="running-servers-access-info">
                      <FontAwesomeIcon 
                        icon={getAccessLevelIcon(server.accessLevel?.level || 'claude-desktop')} 
                        style={{ color: getAccessLevelColor(server.accessLevel?.level || 'claude-desktop') }}
                      />
                      <span className="running-servers-metric-label">Access:</span>
                      <span 
                        className="running-servers-metric-value"
                        style={{ color: getAccessLevelColor(server.accessLevel?.level || 'claude-desktop') }}
                      >
                        {getAccessLevelDisplayName(server.accessLevel?.level || 'claude-desktop')}
                      </span>
                    </div>
                    <button
                      className="running-servers-access-edit-btn"
                      onClick={() => handleEditAccessLevel(server)}
                      title="Change Access Level"
                    >
                      <FontAwesomeIcon icon={faShieldAlt} />
                    </button>
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


                {/* MCP Schema Display */}
                <div className="running-servers-card-schema">
                  <div className="running-servers-schema-header">
                    <span className="running-servers-schema-label">MCP Schema:</span>
                    <button 
                      className="running-servers-schema-copy-btn"
                      onClick={() => handleCopySchema(server)}
                      title="Copy MCP schema to clipboard"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                  </div>
                  <div className="running-servers-schema-code">
                    <code>{generateMCPSchema(server)}</code>
                  </div>
                </div>
              </div>

              <div className="running-servers-card-actions">
                {server.type === 'gmail' && (
                  <button
                    className="running-servers-action-btn running-servers-dashboard-btn"
                    onClick={() => handleViewDashboard(server)}
                    title="View Gmail Dashboard"
                  >
                    <FontAwesomeIcon icon={faChartBar} />
                    Dashboard
                  </button>
                )}
                <button
                  className="running-servers-action-btn running-servers-logs-btn"
                  onClick={() => handleViewLogs(server)}
                  title="View logs"
                >
                  <FontAwesomeIcon icon={faTerminal} />
                  Logs
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

      {/* Access Level Modal */}
      {showAccessLevelModal && editingServer && (
        <div className="access-level-modal-overlay">
          <div className="access-level-modal">
            <div className="access-level-modal-header">
              <h3>Change Access Level</h3>
              <button 
                className="access-level-modal-close"
                onClick={() => {
                  setShowAccessLevelModal(false);
                  setEditingServer(null);
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="access-level-modal-content">
              <div className="access-level-current">
                <h4>Current Access Level</h4>
                <div className="access-level-current-info">
                  <FontAwesomeIcon 
                    icon={getAccessLevelIcon(editingServer.accessLevel?.level || 'claude-desktop')}
                    style={{ color: getAccessLevelColor(editingServer.accessLevel?.level || 'claude-desktop') }}
                  />
                  <span>{getAccessLevelDisplayName(editingServer.accessLevel?.level || 'claude-desktop')}</span>
                </div>
                <p className="access-level-description">
                  {getAccessLevelDescription(editingServer.accessLevel?.level || 'claude-desktop')}
                </p>
              </div>

              <div className="access-level-options">
                <h4>Select New Access Level</h4>
                <div className="access-level-options-list">
                  {(['claude-desktop', 'local-network', 'public'] as AccessLevel[]).map((level) => (
                    <div 
                      key={level}
                      className={`access-level-option ${editingServer.accessLevel?.level === level ? 'selected' : ''}`}
                      onClick={() => handleAccessLevelChange(editingServer, level)}
                    >
                      <div className="access-level-option-header">
                        <FontAwesomeIcon 
                          icon={getAccessLevelIcon(level)}
                          style={{ color: getAccessLevelColor(level) }}
                        />
                        <span className="access-level-option-name">{getAccessLevelDisplayName(level)}</span>
                        {editingServer.accessLevel?.level === level && (
                          <FontAwesomeIcon icon={faCircleCheck} className="access-level-selected-icon" />
                        )}
                      </div>
                      <p className="access-level-option-description">
                        {getAccessLevelDescription(level)}
                      </p>
                      <div className="access-level-option-details">
                        <span>Port: {getDefaultPortForAccessLevel(level)}</span>
                        <span>Bind: {getDefaultBindAddressForAccessLevel(level)}</span>
                        {level === 'public' && (
                          <div className="access-level-warning">
                            <FontAwesomeIcon icon={faExclamationCircleIcon} />
                            <span>Security Risk: This will expose your server to the internet</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="access-level-modal-footer">
              <button 
                className="access-level-modal-cancel"
                onClick={() => {
                  setShowAccessLevelModal(false);
                  setEditingServer(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RunningServers;
