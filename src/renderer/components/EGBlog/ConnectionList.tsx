import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWordpress, faTrash, faEdit, faGlobe, faUser, faKey, faCalendarAlt, faCheckCircle, faExclamationTriangle, faFileAlt, faEye, faArrowLeft, faArrowRight } from '../../utils/fontAwesomeIcons';
import naverBlogIcon from '../../../../assets/naverblog.svg';
import tistoryIcon from '../../../../assets/tistory.svg';
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
      
      // Load Naver connections (placeholder - you'll need to implement this)
      try {
        // TODO: Implement Naver connections loading
        // const naverResult = await window.electron.naver.getConnections();
        // if (naverResult.success && naverResult.connections) {
        //   const naverConnections = naverResult.connections.map(conn => ({
        //     ...conn,
        //     type: 'naver' as const
        //   }));
        //   allConnections.push(...naverConnections);
        // }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
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
        // TODO: Implement Naver connection deletion
        // result = await window.electron.naver.deleteConnection(connectionId);
        alert('Naver connection deletion not yet implemented');
        return;
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

  const getConnectionIcon = (connection: BlogConnection) => {
    if (connection.type === 'wordpress') {
      return faWordpress;
    } else if (connection.type === 'naver') {
      return naverBlogIcon;
    } else if (connection.type === 'tistory') {
      return tistoryIcon;
    }
    return faGlobe;
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
    // You can implement actual connection testing logic here
    // For now, return a default status
    return 'success';
  };

  if (loading) {
    return (
      <div className="connection-list">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading connections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="connection-list">
        <div className="error-state">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <h3>Error Loading Connections</h3>
          <p>{error}</p>
          <button onClick={loadConnections} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="connection-list">
        <div className="empty-state">
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
      <div className="connection-header">
        <div className="header-actions">
          {onBack && (
            <button className="return-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to Platform Selection</span>
            </button>
          )}
        </div>
        <div className="header-content">
          <h2>My Blogs</h2>
        </div>
      </div>

      <div className="connections-grid">
        {connections.map((connection) => (
          <div 
            key={connection.id} 
            className="connection-card"
            onClick={() => onView?.(connection)}
            style={{ cursor: 'pointer' }}
          >
            <div className="connection-card-header">
              <div className="connection-card-header-left">
              <div 
                className="connection-list-icon"
                style={{ background: getConnectionColor(connection) }}
              >
                {typeof getConnectionIcon(connection) === 'string' || getConnectionIcon(connection) === naverBlogIcon || getConnectionIcon(connection) === tistoryIcon ? (
                  <img src={getConnectionIcon(connection)} alt={`${getConnectionTypeName(connection)} icon`} />
                ) : (
                  <FontAwesomeIcon icon={getConnectionIcon(connection)} />
                )}
              </div>
              <h3>{connection.name}</h3>
              </div>
              <div className="connection-status">
                <span className={`status-indicator ${getStatusColor(connection)}`}>
                  <FontAwesomeIcon icon={faCheckCircle} />
                </span>
              </div>
            </div>

            <div className="connection-info">
              <div className="connection-details">
                <div className="detail-item">
                  <FontAwesomeIcon icon={faGlobe} />
                  <div className="detail-text">
                    <span className="detail-label">URL:</span>
                    <span className="detail-value">{connection.url}</span>
                  </div>
                </div>
                <div className="detail-item">
                  <FontAwesomeIcon icon={faUser} />
                  <div className="detail-text">
                    <span className="detail-label">User:</span>
                    <span className="detail-value">{connection.username}</span>
                  </div>
                </div>
                <div className="detail-item">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <div className="detail-text">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">{formatDate(connection.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionList;
