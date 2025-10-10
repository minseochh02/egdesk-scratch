import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faGlobe, faUser, faCalendarAlt, faExclamationTriangle, faArrowRight, faSpinner, faCircleCheck, faCircleXmark, faTriangleExclamation, faEdit, faTrash, faCog, faChartBar } from '../../utils/fontAwesomeIcons';
import GmailDashboard from './GmailDashboard';
import './MCPServer.css';

interface MCPServerConnection {
  id: string;
  name: string;
  type: string;
  email?: string;
  adminEmail?: string;
  url?: string;
  config?: any;
  createdAt: string;
  updatedAt: string;
  status?: 'online' | 'offline' | 'error' | 'checking';
}

interface ServerListsProps {
  onEdit?: (connection: MCPServerConnection) => void;
  onDelete?: (connectionId: string) => void;
  onConnect?: (connection: MCPServerConnection) => void;
  onView?: (connection: MCPServerConnection) => void;
  onBack?: () => void;
}

const ServerLists: React.FC<ServerListsProps> = ({ onEdit, onDelete, onConnect, onView, onBack }) => {
  const [connections, setConnections] = useState<MCPServerConnection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Record<string, 'checking' | 'online' | 'offline' | 'error'>>({});
  const [selectedConnection, setSelectedConnection] = useState<MCPServerConnection | null>(null);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const result = await window.electron.mcpConfig.connections.get();
      
      if (result.success && result.connections) {
        const mcpConnections = result.connections.map((conn: any) => ({
          ...conn,
          status: 'checking' as const
        }));
        setConnections(mcpConnections);
        setError(null);
        
        // Initialize server statuses as checking
        const initialStatuses: Record<string, 'checking' | 'online' | 'offline' | 'error'> = {};
        mcpConnections.forEach(conn => {
          initialStatuses[conn.id] = 'checking';
        });
        setServerStatuses(initialStatuses);
      } else {
        setConnections([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (connectionId: string, status: 'checking' | 'online' | 'offline' | 'error') => {
    setServerStatuses(prev => ({
      ...prev,
      [connectionId]: status
    }));
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this MCP server connection?')) {
      return;
    }

    try {
      const result = await window.electron.mcpConfig.connections.remove(connectionId);
      
      if (result.success) {
        setConnections(prev => prev.filter(conn => conn.id !== connectionId));
        onDelete?.(connectionId);
      } else {
        alert(`Failed to delete connection: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleTestConnection = async (connection: MCPServerConnection) => {
    try {
      // You can implement a test connection function here
      console.log('Testing MCP server connection:', connection.name);
      // For now, just show a placeholder
      alert(`Testing connection to ${connection.name}...`);
    } catch (err) {
      alert(`Error testing connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleViewDashboard = (connection: MCPServerConnection) => {
    setSelectedConnection(connection);
    setShowDashboard(true);
  };

  const handleConnectionClick = (connection: MCPServerConnection) => {
    if (connection.type === 'gmail') {
      handleViewDashboard(connection);
    } else {
      // For other connection types, call the onView prop
      onView?.(connection);
    }
  };

  const handleBackFromDashboard = () => {
    setShowDashboard(false);
    setSelectedConnection(null);
  };

  const getConnectionIcon = (connection: MCPServerConnection): any => {
    if (connection.type === 'gmail') {
      return faEnvelope;
    }
    return faCog;
  };

  const getConnectionColor = (connection: MCPServerConnection) => {
    if (connection.type === 'gmail') {
      return '#ea4335';
    }
    return '#6b7280';
  };

  const getConnectionGradient = (connection: MCPServerConnection) => {
    if (connection.type === 'gmail') {
      return 'linear-gradient(135deg, #ea4335 0%, #d33b2c 100%)';
    }
    return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
  };

  const getConnectionTypeName = (connection: MCPServerConnection) => {
    if (connection.type === 'gmail') {
      return 'Gmail MCP Server';
    }
    return 'MCP Server';
  };

  const getDisplayUrl = (connection: MCPServerConnection) => {
    if (connection.type === 'gmail') {
      return `gmail.com/${connection.email || 'unknown'}`;
    }
    return connection.url || 'No URL';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (connection: MCPServerConnection) => {
    const status = serverStatuses[connection.id] || 'checking';
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'error':
        return 'error';
      case 'checking':
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (connection: MCPServerConnection) => {
    const status = serverStatuses[connection.id] || 'checking';
    switch (status) {
      case 'online':
        return faCircleCheck;
      case 'offline':
        return faCircleXmark;
      case 'error':
        return faTriangleExclamation;
      case 'checking':
      default:
        return faSpinner;
    }
  };

  const getStatusText = (connection: MCPServerConnection) => {
    const status = serverStatuses[connection.id] || 'checking';
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      case 'checking':
      default:
        return 'Checking...';
    }
  };

  // Show Gmail Dashboard if selected
  if (showDashboard && selectedConnection && selectedConnection.type === 'gmail') {
    return (
      <GmailDashboard
        connection={selectedConnection as any}
        onBack={handleBackFromDashboard}
        onRefresh={() => loadConnections()}
      />
    );
  }

  if (loading) {
    return (
      <div className="connection-list">
        <div className="connection-list-loading-state">
          <div className="connection-list-spinner"></div>
          <p>Loading MCP server connections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="connection-list">
        <div className="connection-list-error-state">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <h3>Error Loading Connections</h3>
          <p>{error}</p>
          <button onClick={loadConnections} className="connection-list-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="connection-list">
        <div className="connection-list-empty-state">
          <FontAwesomeIcon icon={faCog} />
          <h3>No MCP Servers Yet</h3>
          <p>You haven't connected any MCP servers yet.</p>
          <p>Click "Add New Connection" to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="connection-list">
      <div className="connection-list-header">
        <div className="connection-list-header-actions">
          {onBack && (
            <button className="connection-list-return-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to MCP Tools</span>
            </button>
          )}
        </div>
        <div className="connection-list-header-content">
          <h2>MCP Server Connections</h2>
        </div>
      </div>

      <div className="connection-list-grid">
        {connections.map((connection) => (
          <div 
            key={connection.id} 
            className="connection-list-card"
            onClick={() => handleConnectionClick(connection)}
            style={{ cursor: 'pointer' }}
          >
            <div className="connection-list-card-header">
              <div className="connection-list-card-header-left">
                <div 
                  className="connection-list-icon"
                  style={{ background: getConnectionColor(connection) }}
                >
                  <FontAwesomeIcon icon={getConnectionIcon(connection)} />
                </div>
                <h3>{connection.name}</h3>
              </div>
              <div className="connection-list-status">
                <span className={`connection-list-status-indicator connection-list-status-indicator-${getStatusColor(connection)}`}>
                  <FontAwesomeIcon 
                    icon={getStatusIcon(connection)} 
                    className={serverStatuses[connection.id] === 'checking' ? 'connection-list-spinning' : ''}
                  />
                </span>
                <span className="connection-list-status-text">{getStatusText(connection)}</span>
              </div>
            </div>

            <div className="connection-list-info">
              <div className="connection-list-details">
                <div className="connection-list-detail-item">
                  <FontAwesomeIcon icon={faGlobe} />
                  <div className="connection-list-detail-text">
                    <span className="connection-list-detail-label">Service:</span>
                    <span className="connection-list-detail-value">{getDisplayUrl(connection)}</span>
                  </div>
                </div>
                {connection.email && (
                  <div className="connection-list-detail-item">
                    <FontAwesomeIcon icon={faUser} />
                    <div className="connection-list-detail-text">
                      <span className="connection-list-detail-label">Email:</span>
                      <span className="connection-list-detail-value">{connection.email}</span>
                    </div>
                  </div>
                )}
                <div className="connection-list-detail-item">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <div className="connection-list-detail-text">
                    <span className="connection-list-detail-label">Created:</span>
                    <span className="connection-list-detail-value">{formatDate(connection.createdAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="connection-list-actions">
                {connection.type === 'gmail' && (
                  <button
                    className="connection-list-action-btn connection-list-dashboard-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDashboard(connection);
                    }}
                    title="View Dashboard"
                  >
                    <FontAwesomeIcon icon={faChartBar} />
                  </button>
                )}
                <button
                  className="connection-list-action-btn connection-list-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(connection);
                  }}
                  title="Edit connection"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  className="connection-list-action-btn connection-list-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(connection.id);
                  }}
                  title="Delete connection"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServerLists;
