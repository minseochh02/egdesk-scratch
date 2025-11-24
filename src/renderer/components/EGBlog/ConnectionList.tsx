import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWordpress, faGlobe, faUser, faCalendarAlt, faExclamationTriangle, faArrowRight, faSpinner, faCircleCheck, faCircleXmark, faTriangleExclamation } from '../../utils/fontAwesomeIcons';
import naverBlogIcon from '../../../../assets/naverblog.svg';
import tistoryIcon from '../../../../assets/tistory.svg';
import SiteStatusChecker from './SiteStatusChecker';
import './ConnectionList.css';

interface WordPressConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'wordpress';
}

interface NaverConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'naver';
}

interface TistoryConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'tistory';
}

type BlogConnection = WordPressConnection | NaverConnection | TistoryConnection;

interface ConnectionListProps {
  onEdit?: (connection: BlogConnection) => void;
  onDelete?: (connectionId: string) => void;
  onConnect?: (connection: BlogConnection) => void;
  onView?: (connection: BlogConnection) => void;
  onBack?: () => void;
}

const ConnectionList: React.FC<ConnectionListProps> = ({ onEdit, onDelete, onConnect, onView, onBack }) => {
  const [connections, setConnections] = useState<BlogConnection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [siteStatuses, setSiteStatuses] = useState<Record<string, 'checking' | 'online' | 'offline' | 'error'>>({});

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const allConnections: BlogConnection[] = [];
      
      // Load WordPress connections
      try {
        const wpResult = await window.electron.wordpress.getConnections();
        if (wpResult.success && wpResult.connections) {
          const wpConnections = wpResult.connections.map(conn => ({
            ...conn,
            type: 'wordpress' as const
          }));
          allConnections.push(...wpConnections);
        }
      } catch (err) {
        console.warn('Failed to load WordPress connections:', err);
      }
      
      // Load Naver connections
      try {
        const naverResult = await window.electron.naver.getConnections();
        if (naverResult.success && naverResult.connections) {
          const naverConnections = naverResult.connections.map(conn => ({
            id: conn.id || '',
            name: conn.name,
            username: conn.username,
            password: conn.password,
            url: 'https://blog.naver.com', // Default Naver Blog URL
            type: 'naver' as const,
            createdAt: conn.createdAt || new Date().toISOString(),
            updatedAt: conn.updatedAt || new Date().toISOString(),
          }));
          allConnections.push(...naverConnections);
        }
      } catch (err) {
        console.warn('Failed to load Naver connections:', err);
      }
      
      // Load Tistory connections (placeholder - you'll need to implement this)
      try {
        // TODO: Implement Tistory connections loading
        // const tistoryResult = await window.electron.tistory.getConnections();
        // if (tistoryResult.success && tistoryResult.connections) {
        //   const tistoryConnections = tistoryResult.connections.map(conn => ({
        //     ...conn,
        //     type: 'tistory' as const
        //   }));
        //   allConnections.push(...tistoryConnections);
        // }
      } catch (err) {
        console.warn('Failed to load Tistory connections:', err);
      }
      
      setConnections(allConnections);
      setError(null);
      
      // Initialize site statuses as checking
      const initialStatuses: Record<string, 'checking' | 'online' | 'offline' | 'error'> = {};
      allConnections.forEach(conn => {
        initialStatuses[conn.id] = 'checking';
      });
      setSiteStatuses(initialStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (connectionId: string, status: 'checking' | 'online' | 'offline' | 'error') => {
    setSiteStatuses(prev => ({
      ...prev,
      [connectionId]: status
    }));
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      const connection = connections.find(conn => conn.id === connectionId);
      if (!connection) return;

      let result;
      if (connection.type === 'wordpress') {
        result = await window.electron.wordpress.deleteConnection(connectionId);
      } else if (connection.type === 'naver') {
        result = await window.electron.naver.deleteConnection(connectionId);
      } else if (connection.type === 'tistory') {
        // TODO: Implement Tistory connection deletion
        // result = await window.electron.tistory.deleteConnection(connectionId);
        alert('Tistory connection deletion not yet implemented');
        return;
      } else {
        alert('Unknown connection type');
        return;
      }
      
      if (result?.success) {
        setConnections(prev => prev.filter(conn => conn.id !== connectionId));
        onDelete?.(connectionId);
      } else {
        alert(`Failed to delete connection: ${result?.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleTestConnection = async (connection: BlogConnection) => {
    try {
      // You can implement a test connection function here
      console.log('Testing connection:', connection.name);
      // For now, just show a placeholder
      alert(`Testing connection to ${connection.name}...`);
    } catch (err) {
      alert(`Error testing connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getConnectionIcon = (connection: BlogConnection): any => {
    if (connection.type === 'wordpress') {
      return faWordpress;
    } else if (connection.type === 'naver') {
      return naverBlogIcon;
    } else if (connection.type === 'tistory') {
      return tistoryIcon;
    }
    return faGlobe;
  };

  const getConnectionIconSrc = (connection: BlogConnection): string | null => {
    if (connection.type === 'naver') {
      return naverBlogIcon;
    } else if (connection.type === 'tistory') {
      return tistoryIcon;
    }
    return null;
  };

  const getConnectionColor = (connection: BlogConnection) => {
    if (connection.type === 'wordpress') {
      return '#21759b';
    } else if (connection.type === 'naver') {
      return '#03c75a';
    } else if (connection.type === 'tistory') {
      return '#FF5A4A';
    }
    return '#6b7280';
  };

  const getConnectionGradient = (connection: BlogConnection) => {
    if (connection.type === 'wordpress') {
      return 'linear-gradient(135deg, #21759b 0%, #1e6a8c 100%)';
    } else if (connection.type === 'naver') {
      return 'linear-gradient(135deg, #03c75a 0%, #02a54f 100%)';
    } else if (connection.type === 'tistory') {
      return 'linear-gradient(135deg, #FF5A4A 0%, #e04a3a 100%)';
    }
    return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
  };

  const getConnectionTypeName = (connection: BlogConnection) => {
    if (connection.type === 'wordpress') {
      return 'WordPress';
    } else if (connection.type === 'naver') {
      return 'Naver Blog';
    } else if (connection.type === 'tistory') {
      return 'Tistory';
    }
    return 'Unknown';
  };

  const getDisplayUrl = (connection: BlogConnection) => {
    if (connection.type === 'naver') {
      return `blog.naver.com/${connection.username}`;
    }
    return connection.url;
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

  const getStatusColor = (connection: BlogConnection) => {
    const status = siteStatuses[connection.id] || 'checking';
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

  const getStatusIcon = (connection: BlogConnection) => {
    const status = siteStatuses[connection.id] || 'checking';
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

  const getStatusText = (connection: BlogConnection) => {
    const status = siteStatuses[connection.id] || 'checking';
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

  if (loading) {
    return (
      <div className="connection-list">
        <div className="connection-list-loading-state">
          <div className="connection-list-spinner"></div>
          <p>Loading connections...</p>
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
          <FontAwesomeIcon icon={faGlobe} />
          <h3>No Blogs Yet</h3>
          <p>You haven't connected any blog platforms yet.</p>
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
              <span>Back to Platform Selection</span>
            </button>
          )}
        </div>
        <div className="connection-list-header-content">
          <h2>My Blogs</h2>
        </div>
      </div>

      <div className="connection-list-grid">
        {connections.map((connection) => (
          <div 
            key={connection.id} 
            className="connection-list-card"
            onClick={() => onView?.(connection)}
            style={{ cursor: 'pointer' }}
          >
            <div className="connection-list-card-header">
              <div className="connection-list-card-header-left">
              <div 
                className="connection-list-icon"
                style={{ background: getConnectionColor(connection) }}
              >
                {getConnectionIconSrc(connection) ? (
                  <img src={getConnectionIconSrc(connection)!} alt={`${getConnectionTypeName(connection)} icon`} />
                ) : (
                  <FontAwesomeIcon icon={getConnectionIcon(connection)} />
                )}
              </div>
              <h3>{connection.name}</h3>
              </div>
              <div className="connection-list-status">
                <span className={`connection-list-status-indicator connection-list-status-indicator-${getStatusColor(connection)}`}>
                  <FontAwesomeIcon 
                    icon={getStatusIcon(connection)} 
                    className={siteStatuses[connection.id] === 'checking' ? 'connection-list-spinning' : ''}
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
                    <span className="connection-list-detail-label">URL:</span>
                    <span className="connection-list-detail-value">{getDisplayUrl(connection)}</span>
                  </div>
                </div>
                <div className="connection-list-detail-item">
                  <FontAwesomeIcon icon={faUser} />
                  <div className="connection-list-detail-text">
                    <span className="connection-list-detail-label">User:</span>
                    <span className="connection-list-detail-value">{connection.username}</span>
                  </div>
                </div>
                <div className="connection-list-detail-item">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <div className="connection-list-detail-text">
                    <span className="connection-list-detail-label">Created:</span>
                    <span className="connection-list-detail-value">{formatDate(connection.createdAt)}</span>
                  </div>
                </div>
              </div>
              
              {/* Site Status Checker */}
              <div className="connection-list-site-status-section">
                <SiteStatusChecker
                  url={getDisplayUrl(connection)}
                  onStatusChange={(status) => handleStatusChange(connection.id, status)}
                  className="connection-list-status-checker"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionList;
