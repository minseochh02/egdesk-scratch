import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faCheck, 
  faArrowRight, 
  faList, 
  faServer,
  faGlobe, 
  faCircleCheck, 
  faCircleXmark, 
  faSpinner, 
  faTriangleExclamation,
  faRefresh,
  faPlay,
  faStop,
  faCog,
  faChartBar,
  faClock,
  faTerminal,
  faUser,
  faCalendarAlt,
  faLock,
  faWifi,
  faGlobe as faPublic,
  faShieldAlt,
  faExclamationTriangle as faExclamationCircleIcon,
  faTimes,
  faCopy,
  faPlus,
  faTrash,
  faEdit
} from '../../utils/fontAwesomeIcons';
import GmailConnectorForm from './GmailConnectorForm';
import GmailDashboard from './GmailDashboard';
import './MCPServer.css';
import './RunningServers.css';

interface MCPTool {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  isAvailable: boolean;
  features: string[];
  status: 'available' | 'coming-soon' | 'beta';
}

interface MCPServerProps {}

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

interface GmailConnection {
  id: string;
  name: string;
  email: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  accessLevel?: {
    level: 'claude-desktop' | 'local-network' | 'public';
    port: number;
    bindAddress: string;
    requiresAuth: boolean;
    allowedIPs?: string[];
  };
}

const MCPServer: React.FC<MCPServerProps> = () => {
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [showGmailTool, setShowGmailTool] = useState<boolean>(false);
  
  // Running servers state
  const [servers, setServers] = useState<RunningMCPServer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<RunningMCPServer | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [showAccessLevelModal, setShowAccessLevelModal] = useState<boolean>(false);
  const [editingServer, setEditingServer] = useState<RunningMCPServer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Server name editing state
  const [editingServerName, setEditingServerName] = useState<string | null>(null);
  const [editingServerNameValue, setEditingServerNameValue] = useState<string>('');
  
  // Claude Desktop configuration state
  const [claudeDesktopStatus, setClaudeDesktopStatus] = useState<{
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isConfigured: false,
    isLoading: true,
    error: null
  });

  // Load running servers
  const loadRunningServers = useCallback(async (isManualRefresh = false) => {
    if (isRefreshing && !isManualRefresh) return;
    
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await window.electron.mcpConfig.connections.get();
      
      if (result.success && result.connections) {
        // Convert connections to running servers format
        const runningServers: RunningMCPServer[] = result.connections.map((conn: any) => ({
          id: conn.id,
          name: conn.name,
          type: conn.type,
          email: conn.email,
          adminEmail: conn.adminEmail,
          address: conn.accessLevel?.bindAddress || '127.0.0.1',
          port: conn.accessLevel?.port || 8080,
          protocol: 'http' as const,
          status: 'running' as const,
          uptime: Math.floor((Date.now() - new Date(conn.createdAt).getTime()) / 1000),
          memoryUsage: Math.floor(Math.random() * 100) + 20, // Mock data
          cpuUsage: Math.floor(Math.random() * 30) + 5, // Mock data
          lastActivity: new Date().toISOString(),
          version: '1.0.0',
          description: `MCP server for ${conn.type}`,
          accessLevel: conn.accessLevel,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          healthCheck: {
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: Math.floor(Math.random() * 50) + 10
          },
          tools: [
            { name: 'gmail', description: 'Gmail integration', enabled: true },
            { name: 'search', description: 'Search functionality', enabled: true }
          ],
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info' as const,
              message: 'Server started successfully'
            }
          ]
        }));

        setServers(runningServers);
      } else {
        // Create demo servers if no connections exist
        const demoServers: RunningMCPServer[] = [
          {
            id: 'demo-gmail-1',
            name: 'Gmail MCP Server',
            type: 'gmail',
            email: 'demo@example.com',
            adminEmail: 'admin@example.com',
            address: '127.0.0.1',
            port: 8080,
            protocol: 'http',
            status: 'running',
            uptime: 3600,
            memoryUsage: 45,
            cpuUsage: 12,
            lastActivity: new Date().toISOString(),
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
              responseTime: 25
            },
            tools: [
              { name: 'gmail', description: 'Gmail integration', enabled: true },
              { name: 'search', description: 'Search functionality', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
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
            memoryUsage: 32,
            cpuUsage: 8,
            lastActivity: new Date().toISOString(),
            version: '1.0.0',
            description: 'Custom blog automation server',
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
              responseTime: 18
            },
            tools: [
              { name: 'blog', description: 'Blog management', enabled: true },
              { name: 'content', description: 'Content generation', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
            ]
          },
          {
            id: 'demo-public-1',
            name: 'Public API Server',
            type: 'custom',
            address: '0.0.0.0',
            port: 8082,
            protocol: 'http',
            status: 'running',
            uptime: 1800,
            memoryUsage: 28,
            cpuUsage: 15,
            lastActivity: new Date().toISOString(),
            version: '1.0.0',
            description: 'Public API server',
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
              responseTime: 35
            },
            tools: [
              { name: 'api', description: 'API endpoints', enabled: true },
              { name: 'webhook', description: 'Webhook handling', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
            ]
          }
        ];
        setServers(demoServers);
      }
    } catch (err) {
      console.error('Error loading running servers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Load servers on mount
  useEffect(() => {
    loadRunningServers();
  }, [loadRunningServers]);

  const checkClaudeDesktopStatus = async () => {
    try {
      setClaudeDesktopStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Check if Claude Desktop is configured
      const result = await window.electron.mcpServer.getStatus();
      
      if (result.success) {
        setClaudeDesktopStatus({
          isConfigured: result.status?.isConfigured || false,
          isLoading: false,
          error: null
        });
      } else {
        setClaudeDesktopStatus({
          isConfigured: false,
          isLoading: false,
          error: result.error || 'Failed to check Claude Desktop status'
        });
      }
    } catch (err) {
      console.error('Error checking Claude Desktop status:', err);
      setClaudeDesktopStatus({
        isConfigured: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  // Check Claude Desktop status on mount
  useEffect(() => {
    checkClaudeDesktopStatus();
  }, []);

  const mcpTools: MCPTool[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Connect to Gmail with AI-powered automation for EG Blogging',
      icon: faEnvelope,
      color: '#ea4335',
      gradient: 'linear-gradient(135deg, #ea4335 0%, #d33b2c 100%)',
      isAvailable: true,
      features: ['Email Integration', 'AI Content Generation', 'Automated Workflows', 'Message Management'],
      status: 'available'
    }
  ];

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    if (toolId === 'gmail') {
      setShowGmailTool(true);
    }
  };

  const handleGmailConnect = async (connectionData: any) => {
    // Gmail connection logic here
    console.log('Gmail MCP tool connected:', connectionData);
    alert(`Successfully connected to Gmail: ${connectionData.name}`);
    
    // Refresh servers list
    await loadRunningServers(true);
    
    setShowGmailTool(false);
    setSelectedTool('');
  };

  const handleBackFromTool = () => {
    setShowGmailTool(false);
    setSelectedTool('');
  };


  // Helper functions for running servers
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return faCircleCheck;
      case 'stopped': return faCircleXmark;
      case 'error': return faTriangleExclamation;
      case 'starting': return faSpinner;
      case 'stopping': return faSpinner;
      default: return faCircleXmark;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'stopped': return '#6b7280';
      case 'error': return '#ef4444';
      case 'starting': return '#f59e0b';
      case 'stopping': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getAccessLevelIcon = (level: string) => {
    switch (level) {
      case 'claude-desktop': return faShieldAlt;
      case 'local-network': return faWifi;
      case 'public': return faPublic;
      default: return faShieldAlt;
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'claude-desktop': return '#3b82f6';
      case 'local-network': return '#f59e0b';
      case 'public': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAccessLevelDisplayName = (level: string) => {
    switch (level) {
      case 'claude-desktop': return 'Claude Desktop Only';
      case 'local-network': return 'Local Network';
      case 'public': return 'Public Access';
      default: return 'Unknown';
    }
  };

  const generateMCPSchema = (server: RunningMCPServer): string => {
    // Generate server name from the actual server name
    const serverKey = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Determine the server path based on server type
    let serverPath: string;
    if (server.type === 'gmail') {
      // For Gmail servers, use the built server path
      serverPath = `./dist-mcp/server.js`;
    } else {
      // For custom servers, use a generic path
      serverPath = `./mcp-servers/${serverKey}.js`;
    }

    // Generate the actual Claude Desktop MCP configuration
    const mcpConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'node',
          args: [serverPath]
        }
      }
    };

    return JSON.stringify(mcpConfig, null, 2);
  };

  const handleCopySchema = (server: RunningMCPServer) => {
    const schema = generateMCPSchema(server);
    navigator.clipboard.writeText(schema).then(() => {
      alert('MCP schema copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy schema:', err);
      alert('Failed to copy schema to clipboard');
    });
  };

  const handleServerAction = (serverId: string, action: string) => {
    console.log(`Server action: ${action} for server ${serverId}`);
    // Implement server actions here
  };

  const handleViewLogs = (server: RunningMCPServer) => {
    setSelectedServer(server);
    setShowLogs(true);
  };

  const handleViewDashboard = (server: RunningMCPServer) => {
    setSelectedServer(server);
    setShowDashboard(true);
  };

  const handleEditAccessLevel = (server: RunningMCPServer) => {
    setEditingServer(server);
    setShowAccessLevelModal(true);
  };

  const handleAccessLevelChange = async (newLevel: AccessLevel) => {
    if (!editingServer) return;

    try {
      const updates = {
        accessLevel: {
          level: newLevel,
          port: getDefaultPortForAccessLevel(newLevel),
          bindAddress: getDefaultBindAddressForAccessLevel(newLevel),
          requiresAuth: newLevel !== 'claude-desktop',
          allowedIPs: newLevel === 'local-network' ? ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] : undefined
        }
      };

      const result = await window.electron.mcpConfig.connections.update(editingServer.id, updates);
      
      if (result.success) {
        // Update the local state
        setServers(prev => prev.map(server => 
          server.id === editingServer.id 
            ? { ...server, ...updates }
            : server
        ));
        
        setShowAccessLevelModal(false);
        setEditingServer(null);
        alert(`Access level changed to ${getAccessLevelDisplayName(newLevel)}`);
      } else {
        alert(`Failed to update access level: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating access level:', err);
      alert(`Error updating access level: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

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

  const handleDeleteServer = async (serverId: string) => {
    if (!window.confirm('Are you sure you want to delete this MCP server connection?')) {
      return;
    }

    try {
      const result = await window.electron.mcpConfig.connections.remove(serverId);
      
      if (result.success) {
        setServers(prev => prev.filter(s => s.id !== serverId));
        alert('Server deleted successfully');
      } else {
        alert(`Failed to delete server: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditServerName = (server: RunningMCPServer) => {
    setEditingServerName(server.id);
    setEditingServerNameValue(server.name);
  };

  const handleSaveServerName = async (serverId: string) => {
    if (!editingServerNameValue.trim()) {
      alert('Server name cannot be empty');
      return;
    }

    try {
      const result = await window.electron.mcpConfig.connections.update(serverId, {
        name: editingServerNameValue.trim()
      });
      
      if (result.success) {
        setServers(prev => prev.map(server => 
          server.id === serverId 
            ? { ...server, name: editingServerNameValue.trim() }
            : server
        ));
        setEditingServerName(null);
        setEditingServerNameValue('');
        alert('Server name updated successfully');
      } else {
        alert(`Failed to update server name: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error updating server name: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCancelEditServerName = () => {
    setEditingServerName(null);
    setEditingServerNameValue('');
  };

  const handleConfigureClaudeDesktop = async (server: RunningMCPServer) => {
    try {
      // Call the automatic Claude Desktop configuration
      const result = await window.electron.mcpServer.configureClaude();
      
      if (result.success) {
        alert('Successfully configured Claude Desktop! The MCP server is now available in Claude Desktop.');
        // Refresh status after successful configuration
        await checkClaudeDesktopStatus();
      } else {
        alert(`Failed to configure Claude Desktop: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error configuring Claude Desktop:', err);
      alert(`Error configuring Claude Desktop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUnconfigureClaudeDesktop = async (server: RunningMCPServer) => {
    try {
      // Call the automatic Claude Desktop unconfiguration
      const result = await window.electron.mcpServer.unconfigureClaude();
      
      if (result.success) {
        alert('Successfully removed from Claude Desktop! The MCP server is no longer available in Claude Desktop.');
        // Refresh status after successful unconfiguration
        await checkClaudeDesktopStatus();
      } else {
        alert(`Failed to remove from Claude Desktop: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error removing from Claude Desktop:', err);
      alert(`Error removing from Claude Desktop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };


  // Show Gmail tool if selected
  if (showGmailTool) {
    return (
      <GmailConnectorForm
        onBack={handleBackFromTool}
        onConnect={handleGmailConnect}
      />
    );
  }


  return (
    <div className="mcp-server">
      {/* Hero Section */}
      <div className="connector-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <FontAwesomeIcon icon={faEnvelope} />
            <span>EG Blogging Integration</span>
          </div>
          <h1>MCP Server Management</h1>
          <p>Manage your Model Context Protocol servers and create new connections for enhanced AI-powered blogging workflows</p>
          <div className="hero-actions">
            <button 
              className="hero-action-btn"
              onClick={() => handleToolSelect('gmail')}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Add MCP Server</span>
            </button>
            <button 
              className="hero-action-btn"
              onClick={() => loadRunningServers(true)}
            >
              <FontAwesomeIcon icon={faRefresh} />
              <span>Refresh Servers</span>
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="floating-card card-2">
              <FontAwesomeIcon icon={faServer} />
            </div>
            <div className="floating-card card-3">
              <FontAwesomeIcon icon={faGlobe} />
            </div>
          </div>
        </div>
      </div>

      {/* Running Servers Section */}
      <div className="running-servers-section">
        <div className="section-header">
          <h2>Running MCP Servers</h2>
          <p>Monitor and manage your active MCP server connections</p>
        </div>

        {loading && (
          <div className="loading-state">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Loading servers...</span>
          </div>
        )}

        {error && (
          <div className="error-state">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <span>{error}</span>
            <button onClick={() => loadRunningServers(true)}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="running-servers-grid">
            {servers.map((server) => (
              <div key={server.id} className="running-servers-card">
                <div className="running-servers-card-header">
                  <div className="mcp-server-info-container">
                    <div className={`mcp-server-icon-box ${server.type === 'gmail' ? 'gmail-icon-box' : ''}`}>
                      <FontAwesomeIcon icon={server.type === 'gmail' ? faEnvelope : faServer} />
                    </div>
                    <div className="mcp-server-text-details">
                      <div className="mcp-server-name-container">
                        {editingServerName === server.id ? (
                          <div className="mcp-server-name-edit">
                            <input
                              type="text"
                              value={editingServerNameValue}
                              onChange={(e) => setEditingServerNameValue(e.target.value)}
                              className="mcp-server-name-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveServerName(server.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditServerName();
                                }
                              }}
                            />
                            <div className="mcp-server-name-edit-buttons">
                              <button
                                className="mcp-server-name-save-btn"
                                onClick={() => handleSaveServerName(server.id)}
                                title="Save"
                              >
                                <FontAwesomeIcon icon={faCheck} />
                              </button>
                              <button
                                className="mcp-server-name-cancel-btn"
                                onClick={handleCancelEditServerName}
                                title="Cancel"
                              >
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mcp-server-name-display">
                            <h3 className="mcp-server-name">{server.name}</h3>
                            <button
                              className="mcp-server-name-edit-btn"
                              onClick={() => handleEditServerName(server)}
                              title="Edit server name"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mcp-server-description">{server.description}</p>
                      <div className="mcp-server-meta">
                        <span className="mcp-server-type">{server.type}</span>
                        <span className="mcp-server-version">v{server.version}</span>
                      </div>
                    </div>
                  </div>
                  <div className="running-servers-status">
                    <FontAwesomeIcon 
                      icon={getStatusIcon(server.status)} 
                      style={{ color: getStatusColor(server.status) }}
                    />
                    <span style={{ color: getStatusColor(server.status) }}>
                      {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                    </span>
                  </div>
                </div>

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

                <div className="running-servers-card-schema">
                  <div className="running-servers-schema-header">
                    <span className="running-servers-schema-label">MCP Schema:</span>
                    <div className="running-servers-schema-status">
                      {claudeDesktopStatus.isLoading ? (
                        <span className="running-servers-status-loading">
                          <FontAwesomeIcon icon={faSpinner} spin />
                          Checking...
                        </span>
                      ) : claudeDesktopStatus.error ? (
                        <span className="running-servers-status-error">
                          <FontAwesomeIcon icon={faTriangleExclamation} />
                          Error
                        </span>
                      ) : claudeDesktopStatus.isConfigured ? (
                        <span className="running-servers-status-configured">
                          <FontAwesomeIcon icon={faCircleCheck} />
                          In Claude Desktop
                        </span>
                      ) : (
                        <span className="running-servers-status-not-configured">
                          <FontAwesomeIcon icon={faCircleXmark} />
                          Not in Claude Desktop
                        </span>
                      )}
                    </div>
                    <div className="running-servers-schema-buttons">
                      <button 
                        className="running-servers-schema-copy-btn"
                        onClick={() => handleCopySchema(server)}
                        title="Copy MCP schema to clipboard"
                      >
                        <FontAwesomeIcon icon={faCopy} />
                        Copy
                      </button>
                      {claudeDesktopStatus.isConfigured ? (
                        <button 
                          className="running-servers-schema-remove-btn"
                          onClick={() => handleUnconfigureClaudeDesktop(server)}
                          title="Remove from Claude Desktop app"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                          Remove from Claude Desktop
                        </button>
                      ) : (
                        <button 
                          className="running-servers-schema-configure-btn"
                          onClick={() => handleConfigureClaudeDesktop(server)}
                          title="Add to Claude Desktop app"
                        >
                          <FontAwesomeIcon icon={faServer} />
                          Add to Claude Desktop
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="running-servers-schema-code">
                    <code>{generateMCPSchema(server)}</code>
                  </div>
                </div>

                <div className="running-servers-card-actions">
                  {server.type === 'gmail' && (
                    <button
                      className="running-servers-action-btn running-servers-dashboard-btn"
                      onClick={() => handleViewDashboard(server)}
                      title="View Gmail dashboard"
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
                  <button
                    className="running-servers-action-btn running-servers-delete-btn"
                    onClick={() => handleDeleteServer(server.id)}
                    title="Delete server"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


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
              </div>

              <div className="access-level-options">
                <h4>Select New Access Level</h4>
                <div className="access-level-options-list">
                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('claude-desktop')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#3b82f6' }} />
                      <span className="access-level-option-name">Claude Desktop Only</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Only accessible from Claude Desktop application. Most secure option.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8080</span>
                      <span>Bind: 127.0.0.1</span>
                      <span>Auth: Not required</span>
                    </div>
                  </div>

                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('local-network')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faWifi} style={{ color: '#f59e0b' }} />
                      <span className="access-level-option-name">Local Network</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Accessible from devices on the same WiFi network. Requires authentication.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8081</span>
                      <span>Bind: 0.0.0.0</span>
                      <span>Auth: Required</span>
                    </div>
                  </div>

                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('public')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faPublic} style={{ color: '#ef4444' }} />
                      <span className="access-level-option-name">Public Access</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Accessible from anywhere on the internet. Requires authentication.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8082</span>
                      <span>Bind: 0.0.0.0</span>
                      <span>Auth: Required</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="access-level-warning">
                <FontAwesomeIcon icon={faExclamationCircleIcon} />
                <span>Changing access level will restart the server and may affect active connections.</span>
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

export default MCPServer;