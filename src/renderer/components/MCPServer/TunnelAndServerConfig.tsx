import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer,
  faGlobe,
  faCircleCheck,
  faCircleXmark,
  faRefresh,
  faPlay,
  faStop,
  faCog,
  faCheck,
  faCopy,
  faEdit,
  faTimes,
  faSpinner
} from '../../utils/fontAwesomeIcons';
import InviteManager from './InviteManager';

interface TunnelAndServerConfigProps {
  mcpServerName: string;
  isEditingMcpServerName: boolean;
  editingMcpServerNameValue: string;
  setEditingMcpServerNameValue: (value: string) => void;
  handleEditMcpServerName: () => void;
  handleSaveMcpServerName: () => Promise<void>;
  handleCancelEditMcpServerName: () => void;
  activeTunnelConfig: {
    registered: boolean;
    registrationId: string;
    serverName: string;
    publicUrl: string;
    registeredAt: string;
    lastConnectedAt: string;
    // Health status fields
    isConnected: boolean;        // Is there an active WebSocket tunnel connection?
    isServiceAvailable: boolean; // Is the tunneling service reachable?
    lastHealthCheck: string;
    healthError?: string;
    // Auto-reconnection tracking
    wasAutoDisconnected: boolean;
    autoReconnectAttempts: number;
  };
  tunnelConfigs: Array<{
    name: string;
    tunnelUrl: string;
    registeredAt: string;
    id?: string;
    ip?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  httpServerStatus: {
    isRunning: boolean;
    port: number | null;
    isLoading: boolean;
  };
  mcpServers: Array<{
    name: string;
    enabled: boolean;
    description: string;
  }>;
  handleStartHttpServer: () => Promise<void>;
  handleStopHttpServer: () => Promise<void>;
  loadHttpServerStatus: () => Promise<void>;
  handleEnableMCPServer: (serverName: string) => Promise<void>;
  handleDisableMCPServer: (serverName: string) => Promise<void>;
  handleStartTunnel: () => Promise<void>;
  handleStopTunnel: () => Promise<void>;
  loadActiveTunnelConfig: () => Promise<void>;
  checkTunnelHealth: (serverName: string) => Promise<{
    isConnected: boolean;
    isServiceAvailable: boolean;
    lastHealthCheck: string;
    healthError?: string;
  }>;
  isTunnelStarting?: boolean;
  isTunnelStopping?: boolean;
}

const TunnelAndServerConfig: React.FC<TunnelAndServerConfigProps> = ({
  mcpServerName,
  isEditingMcpServerName,
  editingMcpServerNameValue,
  setEditingMcpServerNameValue,
  handleEditMcpServerName,
  handleSaveMcpServerName,
  handleCancelEditMcpServerName,
  activeTunnelConfig,
  tunnelConfigs,
  httpServerStatus,
  mcpServers,
  handleStartHttpServer,
  handleStopHttpServer,
  loadHttpServerStatus,
  handleEnableMCPServer,
  handleDisableMCPServer,
  handleStartTunnel,
  handleStopTunnel,
  loadActiveTunnelConfig,
  checkTunnelHealth,
  isTunnelStarting = false,
  isTunnelStopping = false
}) => {
  const handleCopyPublicUrl = () => {
    if (activeTunnelConfig.publicUrl) {
      navigator.clipboard.writeText(activeTunnelConfig.publicUrl);
      alert('Public URL copied to clipboard!');
    }
  };
  return (
    <>
      {/* Tunnel Configuration Section */}
      <div className="supabase-config-section" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
        borderRadius: '16px',
        padding: '24px',
        margin: '24px 0',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FontAwesomeIcon icon={faGlobe} />
            Tunnel Configuration
          </h2>
          <p>Configuration for public MCP server tunneling and registered tunnels</p>
        </div>

        {/* MCP Server Name Card */}
        <div style={{ marginTop: '24px', marginBottom: '24px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px',
              opacity: 0.9
            }}>
              MCP Server Name
            </div>
            {isEditingMcpServerName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  value={editingMcpServerNameValue}
                  onChange={(e) => setEditingMcpServerNameValue(e.target.value)}
                  placeholder="my-mcp-server"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveMcpServerName();
                    } else if (e.key === 'Escape') {
                      handleCancelEditMcpServerName();
                    }
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSaveMcpServerName}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditMcpServerName}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                    Cancel
                  </button>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                  Use lowercase letters, numbers, and hyphens only
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FontAwesomeIcon icon={faServer} style={{ color: '#10b981', fontSize: '20px' }} />
                  <span style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '15px',
                    fontWeight: '600'
                  }}>
                    {mcpServerName}
                  </span>
                </div>
                <button
                  onClick={handleEditMcpServerName}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Edit server name"
                >
                  <FontAwesomeIcon icon={faEdit} />
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tunnel Control Buttons */}
        <div style={{ marginTop: '20px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!activeTunnelConfig.publicUrl ? (
            <button
              onClick={handleStartTunnel}
              disabled={!httpServerStatus.isRunning || isTunnelStarting}
              style={{
                background: httpServerStatus.isRunning 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: httpServerStatus.isRunning 
                  ? '1px solid rgba(16, 185, 129, 0.3)' 
                  : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: (httpServerStatus.isRunning && !isTunnelStarting) ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (httpServerStatus.isRunning && !isTunnelStarting) ? 1 : 0.5,
                transition: 'all 0.2s ease'
              }}
              title={httpServerStatus.isRunning 
                ? 'Start tunnel for local MCP server' 
                : 'Start HTTP server first to enable tunneling'}
            >
              <FontAwesomeIcon icon={isTunnelStarting ? faSpinner : faPlay} spin={isTunnelStarting} />
              {isTunnelStarting ? 'Starting Tunnel...' : 'Start Tunnel'}
              {!httpServerStatus.isRunning && !isTunnelStarting && (
                <span style={{ fontSize: '12px', opacity: 0.8 }}>
                  (HTTP server must be running)
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleStopTunnel}
              disabled={(!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: ((!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: ((!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping) ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              title={(!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) 
                ? "Cannot stop tunnel - service unavailable. Use refresh button to sync state." 
                : "Stop tunnel connection"}
            >
              <FontAwesomeIcon icon={isTunnelStopping ? faSpinner : faStop} spin={isTunnelStopping} />
              {isTunnelStopping ? 'Stopping Tunnel...' : (activeTunnelConfig.isConnected || activeTunnelConfig.isServiceAvailable ? 'Stop Tunnel' : 'Force Stop')}
            </button>
          )}
          
          {/* Reset Auto-Reconnection button - only show if auto-reconnection failed */}
          {activeTunnelConfig.wasAutoDisconnected && activeTunnelConfig.autoReconnectAttempts >= 3 && (
            <button
              onClick={() => {
                // Reset auto-reconnection state to allow manual retry
                loadActiveTunnelConfig();
              }}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              title="Reset auto-reconnection state and try manual reconnection"
            >
              <FontAwesomeIcon icon={faRefresh} />
              Reset Auto-Reconnect
            </button>
          )}

          {/* Refresh button to clear stale state */}
          <button
            onClick={loadActiveTunnelConfig}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            title="Refresh tunnel status (use this if state is stuck)"
          >
            <FontAwesomeIcon icon={faRefresh} />
          </button>
        </div>

        {/* Local Server Warning for Tunnel */}
        {activeTunnelConfig.publicUrl && !httpServerStatus.isRunning && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#f59e0b'
          }}>
            <FontAwesomeIcon icon={faCircleXmark} style={{ fontSize: '18px' }} />
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                Local HTTP Server is Down
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                Tunnel is configured but won't work until you start the HTTP server. 
                {activeTunnelConfig.wasAutoDisconnected 
                  ? 'The tunnel will automatically reconnect when the server starts.'
                  : 'The tunnel will automatically disconnect to prevent resource waste.'}
              </div>
            </div>
          </div>
        )}

        {/* Auto-Reconnection Info */}
        {activeTunnelConfig.publicUrl && activeTunnelConfig.isServiceAvailable && !activeTunnelConfig.isConnected && 
         activeTunnelConfig.autoReconnectAttempts === 0 && !activeTunnelConfig.wasAutoDisconnected && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#3b82f6'
          }}>
            <FontAwesomeIcon icon={faRefresh} style={{ fontSize: '18px' }} />
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                Auto-Reconnection Active
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                WebSocket connection lost but tunneling service is available. 
                The system will automatically attempt to restore the connection.
              </div>
            </div>
          </div>
        )}

        {/* Active Tunnel Status */}
        {activeTunnelConfig.registered && activeTunnelConfig.publicUrl && (
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <div style={{
              background: activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
              borderRadius: '12px',
              padding: '20px',
              border: activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                marginBottom: '16px',
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FontAwesomeIcon 
                  icon={activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable ? faCircleCheck : faCircleXmark} 
                  style={{ 
                    color: activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable ? '#10b981' : '#ef4444' 
                  }} 
                />
                {activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable 
                  ? 'Active Tunnel Connection' 
                  : !activeTunnelConfig.isServiceAvailable
                    ? 'Tunneling Service Unavailable'
                    : 'No Active Tunnel Connection'}
              </div>

              {/* Connection Status Details */}
              {(!activeTunnelConfig.isConnected || !activeTunnelConfig.isServiceAvailable) && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginBottom: '8px',
                    color: '#ef4444'
                  }}>
                    <FontAwesomeIcon icon={faCircleXmark} />
                    <span style={{ fontWeight: '600' }}>
                      {activeTunnelConfig.healthError?.includes('Local HTTP server is not running')
                        ? 'Local Server Down - Tunnel Disconnected'
                        : !activeTunnelConfig.isServiceAvailable 
                          ? 'Tunneling Service Unavailable' 
                          : activeTunnelConfig.isServiceAvailable && !activeTunnelConfig.isConnected
                            ? 'WebSocket Connection Lost'
                            : 'Tunnel Connection Issue'}
                    </span>
                  </div>
                  {activeTunnelConfig.healthError && (
                    <div style={{ fontSize: '13px', opacity: 0.9, marginLeft: '20px' }}>
                      {activeTunnelConfig.healthError}
                      {activeTunnelConfig.healthError?.includes('Local HTTP server is not running') && !activeTunnelConfig.wasAutoDisconnected && (
                        <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8 }}>
                          💡 Start the HTTP server to restore tunnel connectivity
                        </div>
                      )}
                      {activeTunnelConfig.wasAutoDisconnected && (
                        <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8, color: '#3b82f6' }}>
                          🔄 Tunnel will automatically reconnect when HTTP server starts
                        </div>
                      )}
                      {(activeTunnelConfig.healthError?.includes('Auto-reconnection') || 
                        activeTunnelConfig.healthError?.includes('WebSocket auto-reconnection')) && (
                        <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8 }}>
                          ⚠️ Auto-reconnection attempts: {activeTunnelConfig.autoReconnectAttempts}/3
                          {activeTunnelConfig.healthError?.includes('WebSocket') && (
                            <span style={{ marginLeft: '8px', color: '#3b82f6' }}>
                              (WebSocket reconnection)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {activeTunnelConfig.lastHealthCheck && (
                    <div style={{ fontSize: '12px', opacity: 0.7, marginLeft: '20px', marginTop: '4px' }}>
                      Last checked: {new Date(activeTunnelConfig.lastHealthCheck).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {/* Public URL */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>
                  Public URL
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px'
                }}>
                  <FontAwesomeIcon icon={faGlobe} style={{ color: '#10b981' }} />
                  <code style={{ 
                    flex: 1, 
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#10b981'
                  }}>
                    {activeTunnelConfig.publicUrl}
                  </code>
                  <button
                    onClick={handleCopyPublicUrl}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Copy public URL"
                  >
                    <FontAwesomeIcon icon={faCopy} />
                    Copy
                  </button>
                </div>
              </div>

              {/* Connection Details */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                fontSize: '12px'
              }}>
                <div>
                  <div style={{ opacity: 0.7, marginBottom: '4px' }}>Server Name</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                    {activeTunnelConfig.serverName}
                  </div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, marginBottom: '4px' }}>Tunnel Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Service Availability */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '11px',
                      color: activeTunnelConfig.isServiceAvailable ? '#10b981' : '#ef4444'
                    }}>
                      <FontAwesomeIcon 
                        icon={activeTunnelConfig.isServiceAvailable ? faCircleCheck : faCircleXmark} 
                        style={{ fontSize: '10px' }}
                      />
                      Service: {activeTunnelConfig.isServiceAvailable ? 'Available' : 'Unavailable'}
                    </div>
                    {/* Connection Status */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '11px', 
                      color: activeTunnelConfig.isConnected ? '#10b981' : '#6b7280'
                    }}>
                      <FontAwesomeIcon 
                        icon={activeTunnelConfig.isConnected ? faCircleCheck : faCircleXmark} 
                        style={{ fontSize: '10px' }}
                      />
                      WebSocket: {activeTunnelConfig.isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>
                </div>
                
                {activeTunnelConfig.registrationId && (
                  <div>
                    <div style={{ opacity: 0.7, marginBottom: '4px' }}>Registration ID</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {activeTunnelConfig.registrationId}
                    </div>
                  </div>
                )}
                
                {activeTunnelConfig.registeredAt && (
                  <div>
                    <div style={{ opacity: 0.7, marginBottom: '4px' }}>Registered</div>
                    <div>
                      {new Date(activeTunnelConfig.registeredAt).toLocaleDateString()} {new Date(activeTunnelConfig.registeredAt).toLocaleTimeString()}
                    </div>
                  </div>
                )}

                {activeTunnelConfig.lastConnectedAt && (
                  <div>
                    <div style={{ opacity: 0.7, marginBottom: '4px' }}>Last Connected</div>
                    <div>
                      {new Date(activeTunnelConfig.lastConnectedAt).toLocaleDateString()} {new Date(activeTunnelConfig.lastConnectedAt).toLocaleTimeString()}
                    </div>
                  </div>
                )}

                {activeTunnelConfig.lastHealthCheck && (
                  <div>
                    <div style={{ opacity: 0.7, marginBottom: '4px' }}>Last Health Check</div>
                    <div>
                      {new Date(activeTunnelConfig.lastHealthCheck).toLocaleTimeString()}
                    </div>
                  </div>
                )}

                {activeTunnelConfig.wasAutoDisconnected && activeTunnelConfig.autoReconnectAttempts >= 3 && (
                  <div>
                    <div style={{ opacity: 0.7, marginBottom: '4px' }}>Auto-Reconnection</div>
                    <div style={{ color: '#ef4444', fontSize: '11px' }}>
                      Failed after 3 attempts
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invite Manager - Only show when tunnel is active */}
        {activeTunnelConfig.registered && activeTunnelConfig.publicUrl && mcpServerName && (
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <InviteManager 
              serverKey={mcpServerName}
              serverName={activeTunnelConfig.serverName || mcpServerName}
            />
          </div>
        )}

        {/* Registered Tunnels */}
        {tunnelConfigs.length > 0 && (
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px',
              opacity: 0.9
            }}>
              Registered Tunnels ({tunnelConfigs.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tunnelConfigs.map((config, index) => (
                <div key={index} style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                      <span style={{ fontWeight: '600', fontSize: '15px' }}>{config.name}</span>
                    </div>
                    <span style={{ 
                      fontSize: '11px', 
                      opacity: 0.6,
                      fontFamily: 'monospace'
                    }}>
                      {new Date(config.registeredAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ 
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    wordBreak: 'break-all',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ flex: 1 }}>
                      {config.tunnelUrl}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(config.tunnelUrl);
                        alert('Tunnel URL copied to clipboard!');
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '11px',
                        flexShrink: 0
                      }}
                      title="Copy to clipboard"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                  </div>
                  {config.id && (
                    <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.6 }}>
                      ID: {config.id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* HTTP Server Control Section */}
      <div className="http-server-control-section" style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
        borderRadius: '16px',
        padding: '24px',
        margin: '24px 0',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FontAwesomeIcon icon={faServer} />
            HTTP Server Control
          </h2>
          <p>Manage your MCP HTTP server and enabled services</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
          {/* HTTP Server Status */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FontAwesomeIcon icon={faGlobe} />
              Server Status
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <FontAwesomeIcon 
                  icon={httpServerStatus.isRunning ? faCircleCheck : faCircleXmark}
                  style={{ color: httpServerStatus.isRunning ? '#10b981' : '#6b7280', fontSize: '20px' }}
                />
                <span style={{ fontSize: '18px', fontWeight: '600' }}>
                  {httpServerStatus.isLoading ? 'Checking...' : httpServerStatus.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              {httpServerStatus.isRunning && httpServerStatus.port && (
                <div style={{ marginLeft: '32px', opacity: 0.8 }}>
                  <div>Port: {httpServerStatus.port}</div>
                  <div>Local: http://localhost:{httpServerStatus.port}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {httpServerStatus.isRunning ? (
                <button
                  onClick={handleStopHttpServer}
                  disabled={httpServerStatus.isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: httpServerStatus.isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: httpServerStatus.isLoading ? 0.5 : 1
                  }}
                >
                  <FontAwesomeIcon icon={faStop} />
                  Stop Server
                </button>
              ) : (
                <button
                  onClick={handleStartHttpServer}
                  disabled={httpServerStatus.isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: httpServerStatus.isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: httpServerStatus.isLoading ? 0.5 : 1
                  }}
                >
                  <FontAwesomeIcon icon={faPlay} />
                  Start Server
                </button>
              )}
              <button
                onClick={loadHttpServerStatus}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faRefresh} />
              </button>
            </div>
          </div>

          {/* MCP Servers Configuration */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FontAwesomeIcon icon={faCog} />
              MCP Services
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mcpServers.map(server => (
                <div key={server.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{server.name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{server.description}</div>
                  </div>
                  <button
                    onClick={() => server.enabled ? handleDisableMCPServer(server.name) : handleEnableMCPServer(server.name)}
                    style={{
                      background: server.enabled 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: server.enabled ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      minWidth: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <FontAwesomeIcon icon={server.enabled ? faCheck : faPlay} />
                    {server.enabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              ))}
              {mcpServers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                  No MCP services configured
                </div>
              )}
            </div>
          </div>
        </div>

        {httpServerStatus.isRunning && mcpServers.some(s => s.enabled) && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
              <strong>MCP Server Ready!</strong>
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Enabled services: {mcpServers.filter(s => s.enabled).map(s => s.name).join(', ')}
              <br />
              View documentation at: http://localhost:{httpServerStatus.port}/
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TunnelAndServerConfig;

