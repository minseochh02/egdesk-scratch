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
  faSpinner,
  faExclamationTriangle,
  faSync
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
  // Auto-start settings
  autoStartEnabled?: boolean;
  autoStartTunnelEnabled?: boolean;
  toggleAutoStart?: () => void;
  toggleAutoStartTunnel?: () => void;
  // OAuth Props
  tokenNeedsRefresh?: boolean;
  handleReSignIn?: () => Promise<void>;
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
  isTunnelStopping = false,
  autoStartEnabled = true,
  autoStartTunnelEnabled = true,
  toggleAutoStart,
  toggleAutoStartTunnel,
  tokenNeedsRefresh = false,
  handleReSignIn
}) => {
  const handleCopyPublicUrl = () => {
    if (activeTunnelConfig.publicUrl) {
      navigator.clipboard.writeText(activeTunnelConfig.publicUrl);
      alert('Public URL copied to clipboard!');
    }
  };

  // Helper to check if a service requires Google OAuth
  const isCloudService = (serverName: string) => {
    const name = serverName.toLowerCase();
    return name.includes('gmail') || name.includes('apps-script') || name.includes('sheets') || name.includes('drive');
  };

  // Sort MCP servers to put 'conversation' at the top
  const sortedMcpServers = [...mcpServers].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    
    // Move 'conversation' to top
    if (aName.includes('conversation') && !bName.includes('conversation')) return -1;
    if (!aName.includes('conversation') && bName.includes('conversation')) return 1;
    
    return 0; // Keep original order for others
  });

  return (
    <>
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

            {/* Claude Desktop Installation */}
            <div style={{ 
              marginTop: '16px', 
              paddingTop: '16px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', opacity: 0.9 }}>
                <FontAwesomeIcon icon={faServer} style={{ marginRight: '8px' }} />
                Claude Desktop Integration
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '12px', lineHeight: '1.5' }}>
                Install all 5 EGDesk MCP services to Claude Desktop:<br/>
                • User Data • Gmail • Sheets • Apps Script • File Conversion
              </div>
              <button
                onClick={async () => {
                  const confirmed = confirm(
                    'Install EGDesk MCP Services to Claude Desktop?\n\n' +
                    'This will add 5 services:\n' +
                    '• User Data - Query imported tables (Excel, CSV)\n' +
                    '• Gmail - Email operations and search\n' +
                    '• Sheets - Google Sheets sync and management\n' +
                    '• Apps Script - Google Apps Script tools\n' +
                    '• File Conversion - Convert between file formats\n\n' +
                    'After installation:\n' +
                    '1. Restart Claude Desktop (Cmd+Q then reopen)\n' +
                    '2. Look for the 🔨 icon in Claude Desktop\n' +
                    '3. All EGDesk services will be available\n\n' +
                    'Continue?'
                  );
                  
                  if (!confirmed) return;
                  
                  try {
                    const result = await (window as any).electron.mcpServer.configureClaude();
                    
                    if (result.success) {
                      alert(
                        '✅ Successfully configured Claude Desktop!\n\n' +
                        'All 5 EGDesk MCP services have been installed:\n' +
                        '✓ User Data\n' +
                        '✓ Gmail\n' +
                        '✓ Sheets\n' +
                        '✓ Apps Script\n' +
                        '✓ File Conversion\n\n' +
                        'Next steps:\n' +
                        '1. Quit Claude Desktop completely (Cmd+Q)\n' +
                        '2. Reopen Claude Desktop\n' +
                        '3. Look for the 🔨 icon to access services\n\n' +
                        'Make sure EGDesk is running for Claude to access the services.'
                      );
                    } else {
                      alert(`Failed to configure Claude Desktop: ${result.error || 'Unknown error'}`);
                    }
                  } catch (err) {
                    console.error('Error configuring Claude Desktop:', err);
                    alert(`Error configuring Claude Desktop: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: '600'
                }}
              >
                <FontAwesomeIcon icon={faServer} />
                Install to Claude Desktop
              </button>
            </div>

            {/* Auto-start Settings */}
            <div style={{ 
              marginTop: '16px', 
              paddingTop: '16px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', opacity: 0.9 }}>
                <FontAwesomeIcon icon={faCog} style={{ marginRight: '8px' }} />
                Auto-start Settings
              </div>
              
              {/* Auto-start HTTP Server Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: toggleAutoStart ? 'pointer' : 'default',
                marginBottom: '10px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                transition: 'background 0.2s ease'
              }}>
                <input
                  type="checkbox"
                  checked={autoStartEnabled}
                  onChange={toggleAutoStart}
                  disabled={!toggleAutoStart}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: toggleAutoStart ? 'pointer' : 'default',
                    accentColor: '#10b981'
                  }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>Auto-start HTTP Server</div>
                  <div style={{ fontSize: '11px', opacity: 0.6 }}>Automatically start server when app opens</div>
                </div>
              </label>

              {/* Auto-start Tunnel Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: toggleAutoStartTunnel ? 'pointer' : 'default',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                transition: 'background 0.2s ease'
              }}>
                <input
                  type="checkbox"
                  checked={autoStartTunnelEnabled}
                  onChange={toggleAutoStartTunnel}
                  disabled={!toggleAutoStartTunnel}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: toggleAutoStartTunnel ? 'pointer' : 'default',
                    accentColor: '#10b981'
                  }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>Auto-start Tunnel</div>
                  <div style={{ fontSize: '11px', opacity: 0.6 }}>Reconnect tunnel if previously registered</div>
                </div>
              </label>
            </div>

            {/* Tunnel Configuration Section (Embedded in Server Status) */}
            <div style={{
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h4 style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                marginBottom: '16px', 
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FontAwesomeIcon icon={faGlobe} style={{ color: '#3b82f6' }} />
                Tunnel Configuration
              </h4>

              {/* MCP Server Name Input */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  marginBottom: '8px',
                  opacity: 0.7
                }}>
                  MCP Server Name
                </div>
                {isEditingMcpServerName ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      value={editingMcpServerNameValue}
                      onChange={(e) => setEditingMcpServerNameValue(e.target.value)}
                      placeholder="my-mcp-server"
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'white',
                        fontSize: '13px',
                        fontFamily: 'monospace'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveMcpServerName();
                        else if (e.key === 'Escape') handleCancelEditMcpServerName();
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
                          borderRadius: '4px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} /> Save
                      </button>
                      <button
                        onClick={handleCancelEditMcpServerName}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '4px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      {mcpServerName}
                    </span>
                    <button
                      onClick={handleEditMcpServerName}
                      style={{
                        background: 'transparent',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        opacity: 0.7,
                        padding: '4px'
                      }}
                      title="Edit server name"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </div>
                )}
              </div>

              {/* Tunnel Controls */}
              <div style={{ marginBottom: '16px' }}>
                {!activeTunnelConfig.publicUrl ? (
                  <button
                    onClick={handleStartTunnel}
                    disabled={!httpServerStatus.isRunning || isTunnelStarting}
                    style={{
                      width: '100%',
                      background: httpServerStatus.isRunning 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: httpServerStatus.isRunning 
                        ? '1px solid rgba(16, 185, 129, 0.3)' 
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '10px',
                      cursor: (httpServerStatus.isRunning && !isTunnelStarting) ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: (httpServerStatus.isRunning && !isTunnelStarting) ? 1 : 0.5
                    }}
                  >
                    <FontAwesomeIcon icon={isTunnelStarting ? faSpinner : faPlay} spin={isTunnelStarting} />
                    {isTunnelStarting ? 'Starting Tunnel...' : 'Start Tunnel'}
                  </button>
                ) : (
                  <button
                    onClick={handleStopTunnel}
                    disabled={(!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '10px',
                      cursor: ((!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping) ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: ((!activeTunnelConfig.isConnected && !activeTunnelConfig.isServiceAvailable) || isTunnelStopping) ? 0.6 : 1
                    }}
                  >
                    <FontAwesomeIcon icon={isTunnelStopping ? faSpinner : faStop} spin={isTunnelStopping} />
                    {isTunnelStopping ? 'Stopping...' : 'Stop Tunnel'}
                  </button>
                )}
              </div>

              {/* Active Tunnel Info - Compact View */}
              {activeTunnelConfig.registered && activeTunnelConfig.publicUrl && (
                <div style={{
                  fontSize: '12px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '8px',
                    color: activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable ? '#10b981' : '#ef4444'
                  }}>
                    <FontAwesomeIcon 
                      icon={activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable ? faCircleCheck : faCircleXmark} 
                    />
                    <span style={{ fontWeight: '600' }}>
                      {activeTunnelConfig.isConnected && activeTunnelConfig.isServiceAvailable 
                        ? 'Tunnel Active' 
                        : 'Tunnel Disconnected'}
                    </span>
                  </div>

                  {/* Public URL - Compact */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}>
                    <FontAwesomeIcon icon={faGlobe} style={{ color: '#10b981', fontSize: '10px' }} />
                    <code style={{ 
                      flex: 1, 
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#10b981',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {activeTunnelConfig.publicUrl}
                    </code>
                    <button
                      onClick={handleCopyPublicUrl}
                      style={{
                        background: 'transparent',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Copy URL"
                    >
                      <FontAwesomeIcon icon={faCopy} style={{ fontSize: '12px' }} />
                    </button>
                  </div>

                  {/* Errors & Info */}
                  {(!activeTunnelConfig.isConnected || !activeTunnelConfig.isServiceAvailable) && (
                    <div style={{
                      padding: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}>
                      {activeTunnelConfig.healthError || 'Connection issue detected'}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Invite Manager - Moved under Server Status */}
            {activeTunnelConfig.registered && activeTunnelConfig.publicUrl && mcpServerName && (
               <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <InviteManager 
                  serverKey={mcpServerName}
                  serverName={activeTunnelConfig.serverName || mcpServerName}
                />
               </div>
            )}
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
              {sortedMcpServers.map(server => {
                const isCloud = isCloudService(server.name);
                const hasTokenIssue = isCloud && tokenNeedsRefresh;
                
                return (
                  <div key={server.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: hasTokenIssue ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    border: hasTokenIssue ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {server.name}
                        {hasTokenIssue && (
                          <span style={{ 
                            fontSize: '10px', 
                            background: 'rgba(239, 68, 68, 0.1)', 
                            color: '#ef4444', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Token Expired
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>{server.description}</div>
                    </div>
                    {hasTokenIssue && handleReSignIn ? (
                      <button
                        onClick={handleReSignIn}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
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
                        <FontAwesomeIcon icon={faSync} />
                        Fix
                      </button>
                    ) : (
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
                    )}
                  </div>
                );
              })}
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
