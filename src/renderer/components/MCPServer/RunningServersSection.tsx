import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faCheck, 
  faServer,
  faCircleCheck, 
  faCircleXmark, 
  faSpinner, 
  faTriangleExclamation,
  faChartBar,
  faClock,
  faWifi,
  faGlobe as faPublic,
  faShieldAlt,
  faExclamationTriangle as faExclamationCircleIcon,
  faTimes,
  faCopy,
  faEdit
} from '../../utils/fontAwesomeIcons';
import './RunningServers.css';

export type AccessLevel = 'claude-desktop' | 'local-network' | 'public';

export interface AccessLevelConfig {
  level: AccessLevel;
  port?: number;
  bindAddress?: string;
  requiresAuth?: boolean;
  allowedIPs?: string[];
  networkInterface?: string;
}

export interface RunningMCPServer {
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

interface RunningServersSectionProps {
  servers: RunningMCPServer[];
  loading: boolean;
  error: string | null;
  editingServerName: string | null;
  editingServerNameValue: string;
  claudeDesktopStatus: {
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
  };
  supabaseConfig: {
    hasSupabaseKey: boolean;
    supabaseAnonKey: string | null;
    supabaseUrl: string | null;
    isLoading: boolean;
  };
  loadRunningServers: (isManualRefresh?: boolean) => Promise<void>;
  setEditingServerNameValue: (value: string) => void;
  handleSaveServerName: (serverId: string) => Promise<void>;
  handleCancelEditServerName: () => void;
  handleEditServerName: (server: RunningMCPServer) => void;
  formatUptime: (seconds: number) => string;
  getStatusIcon: (status: string) => any;
  getStatusColor: (status: string) => string;
  getAccessLevelIcon: (level: string) => any;
  getAccessLevelColor: (level: string) => string;
  getAccessLevelDisplayName: (level: string) => string;
  generateMCPSchema: (server: RunningMCPServer) => string;
  generateNetworkMCPSchema: (server: RunningMCPServer) => string;
  generatePublicMCPSchema: (server: RunningMCPServer) => string;
  handleCopySchema: (server: RunningMCPServer) => void;
  handleCopyNetworkSchema: (server: RunningMCPServer) => void;
  handleCopyPublicSchema: (server: RunningMCPServer) => void;
  handleConfigureClaudeDesktop: (server: RunningMCPServer) => Promise<void>;
  handleUnconfigureClaudeDesktop: (server: RunningMCPServer) => Promise<void>;
  handleEditAccessLevel: (server: RunningMCPServer) => void;
  handleViewDashboard: (server: RunningMCPServer) => void;
  hideHeader?: boolean;
}

const RunningServersSection: React.FC<RunningServersSectionProps> = ({
  servers,
  loading,
  error,
  editingServerName,
  editingServerNameValue,
  claudeDesktopStatus,
  supabaseConfig,
  loadRunningServers,
  setEditingServerNameValue,
  handleSaveServerName,
  handleCancelEditServerName,
  handleEditServerName,
  formatUptime,
  getStatusIcon,
  getStatusColor,
  getAccessLevelIcon,
  getAccessLevelColor,
  getAccessLevelDisplayName,
  generateMCPSchema,
  generateNetworkMCPSchema,
  generatePublicMCPSchema,
  handleCopySchema,
  handleCopyNetworkSchema,
  handleCopyPublicSchema,
  handleConfigureClaudeDesktop,
  handleUnconfigureClaudeDesktop,
  handleEditAccessLevel,
  handleViewDashboard,
  hideHeader = false
}) => {
  return (
    <div className="running-servers-section">
      {!hideHeader && (
      <div className="section-header">
        <h2>Running MCP Servers</h2>
        <p>Monitor and manage your active MCP server connections</p>
      </div>
      )}

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
          {servers.filter(server => server && server.id).map((server) => (
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

              {/* Show MCP configuration for claude-desktop and local-network modes */}
              {(server.accessLevel?.level === 'claude-desktop' || server.accessLevel?.level === 'local-network') && (
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
              )}

              {/* Show additional network MCP configuration for local-network mode */}
              {server.accessLevel?.level === 'local-network' && (
                <div className="running-servers-card-schema">
                  <div className="running-servers-schema-header">
                    <span className="running-servers-schema-label">Network MCP Configuration:</span>
                    <div className="running-servers-schema-status">
                      <span className="running-servers-status-configured">
                        <FontAwesomeIcon icon={faWifi} />
                        Network Access
                      </span>
                    </div>
                    <div className="running-servers-schema-buttons">
                      <button 
                        className="running-servers-schema-copy-btn"
                        onClick={() => handleCopyNetworkSchema(server)}
                        title="Copy network MCP configuration to clipboard"
                      >
                        <FontAwesomeIcon icon={faCopy} />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="running-servers-schema-code">
                    <code>{generateNetworkMCPSchema(server)}</code>
                  </div>
                </div>
              )}

              {/* Show all three MCP configurations for public mode */}
              {server.accessLevel?.level === 'public' && (
                <>
                  {/* 1. Claude Desktop MCP Configuration */}
                  <div className="running-servers-card-schema">
                    <div className="running-servers-schema-header">
                      <span className="running-servers-schema-label">Claude Desktop MCP:</span>
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

                  {/* 2. Local Network MCP Configuration */}
                  <div className="running-servers-card-schema">
                    <div className="running-servers-schema-header">
                      <span className="running-servers-schema-label">Local Network MCP:</span>
                      <div className="running-servers-schema-status">
                        <span className="running-servers-status-configured">
                          <FontAwesomeIcon icon={faWifi} />
                          Network Access
                        </span>
                      </div>
                      <div className="running-servers-schema-buttons">
                        <button 
                          className="running-servers-schema-copy-btn"
                          onClick={() => handleCopyNetworkSchema(server)}
                          title="Copy network MCP configuration to clipboard"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="running-servers-schema-code">
                      <code>{generateNetworkMCPSchema(server)}</code>
                    </div>
                  </div>

                  {/* 3. Public Tunnel MCP Configuration */}
                  <div className="running-servers-card-schema">
                    <div className="running-servers-schema-header">
                      <span className="running-servers-schema-label">Public Tunnel MCP:</span>
                      <div className="running-servers-schema-status">
                        <span className="running-servers-status-configured" style={{ color: '#f59e0b' }}>
                          <FontAwesomeIcon icon={faPublic} />
                          Tunnel Required
                        </span>
                      </div>
                      <div className="running-servers-schema-buttons">
                        <button 
                          className="running-servers-schema-copy-btn"
                          onClick={() => handleCopyPublicSchema(server)}
                          title="Copy public MCP configuration to clipboard"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="running-servers-schema-code">
                      <code>{generatePublicMCPSchema(server)}</code>
                    </div>
                    {supabaseConfig.supabaseUrl ? (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#10b981'
                      }}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: '6px' }} />
                        Tunnel URL configured: {supabaseConfig.supabaseUrl}/functions/v1/r?name={server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                        {supabaseConfig.hasSupabaseKey && (
                          <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
                            ⚠️ Remember to set SUPABASE_ANON_KEY environment variable
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px 12px', 
                        background: 'rgba(245, 158, 11, 0.1)', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#f59e0b'
                      }}>
                        <FontAwesomeIcon icon={faExclamationCircleIcon} style={{ marginRight: '6px' }} />
                        Configure SUPABASE_URL in your .env file to enable tunnel routing
                      </div>
                    )}
                  </div>
                </>
              )}

              {server.type === 'gmail' && (
                <div className="running-servers-card-actions">
                  <button
                    className="running-servers-action-btn running-servers-dashboard-btn"
                    onClick={() => handleViewDashboard(server)}
                    title="View Gmail dashboard"
                  >
                    <FontAwesomeIcon icon={faChartBar} />
                    Dashboard
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RunningServersSection;

