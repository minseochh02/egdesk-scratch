import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWordpress, 
  faGlobe, 
  faUser, 
  faKey, 
  faCalendarAlt, 
  faCheckCircle, 
  faExclamationTriangle, 
  faEdit, 
  faTrash, 
  faRefresh,
  faChartBar,
  faFileAlt,
  faCog,
  faExternalLinkAlt,
  faArrowLeft
} from '../../utils/fontAwesomeIcons';
import naverBlogIcon from '../../../../assets/naverblog.svg';
import tistoryIcon from '../../../../assets/tistory.svg';
import './ConnectionDashboard.css';

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

interface ConnectionDashboardProps {
  connection: BlogConnection;
  onEdit?: (connection: BlogConnection) => void;
  onDelete?: (connectionId: string) => void;
  onTestConnection?: (connection: BlogConnection) => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

const ConnectionDashboard: React.FC<ConnectionDashboardProps> = ({
  connection,
  onEdit,
  onDelete,
  onTestConnection,
  onRefresh,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');
  const [lastTested, setLastTested] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    lastPostDate: null as string | null
  });

  useEffect(() => {
    loadConnectionStats();
  }, [connection.id]);

  const loadConnectionStats = async () => {
    try {
      setIsLoading(true);
      // TODO: Implement actual stats loading based on connection type
      // This is a placeholder for now
      setStats({
        totalPosts: 0,
        publishedPosts: 0,
        draftPosts: 0,
        lastPostDate: null
      });
    } catch (err) {
      console.error('Failed to load connection stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setConnectionStatus('testing');
      await onTestConnection?.(connection);
      setConnectionStatus('connected');
      setLastTested(new Date().toISOString());
    } catch (err) {
      setConnectionStatus('disconnected');
      console.error('Connection test failed:', err);
    }
  };

  const handleEdit = () => {
    onEdit?.(connection);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the connection "${connection.name}"?`)) {
      onDelete?.(connection.id);
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

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return faCheckCircle;
      case 'disconnected':
        return faExclamationTriangle;
      case 'testing':
        return faRefresh;
      default:
        return faCheckCircle;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'error';
      case 'testing':
        return 'warning';
      default:
        return 'success';
    }
  };

  return (
    <div className="connection-dashboard">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-actions">
          {onBack && (
            <button className="return-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back to Connections</span>
            </button>
          )}
        </div>
        <div className="connection-info-header">
          <div 
            className="connection-icon-large"
            style={{ background: getConnectionGradient(connection) }}
          >
            {typeof getConnectionIcon(connection) === 'string' || getConnectionIcon(connection) === naverBlogIcon || getConnectionIcon(connection) === tistoryIcon ? (
              <img src={getConnectionIcon(connection)} alt={`${getConnectionTypeName(connection)} icon`} />
            ) : (
              <FontAwesomeIcon icon={getConnectionIcon(connection)} />
            )}
          </div>
          <div className="connection-title">
            <h2>{connection.name}</h2>
            <p className="connection-type">{getConnectionTypeName(connection)}</p>
            <div className="connection-status">
              <span className={`status-indicator ${getStatusColor()}`}>
                <FontAwesomeIcon icon={getStatusIcon()} />
                {connectionStatus === 'testing' ? 'Testing...' : connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </span>
              {lastTested && (
                <span className="last-tested">
                  Last tested: {formatDate(lastTested)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="dashboard-actions">
          <button
            className="action-btn test-btn"
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            title="Test Connection"
          >
            <FontAwesomeIcon icon={faCheckCircle} />
            Test
          </button>
          <button
            className="action-btn edit-btn"
            onClick={handleEdit}
            title="Edit Connection"
          >
            <FontAwesomeIcon icon={faEdit} />
            Edit
          </button>
          <button
            className="action-btn delete-btn"
            onClick={handleDelete}
            title="Delete Connection"
          >
            <FontAwesomeIcon icon={faTrash} />
            Delete
          </button>
        </div>
      </div>

      {/* Connection Details Section */}
      <div className="dashboard-section">
        <h3>Connection Details</h3>
        <div className="connection-details-grid">
          <div className="detail-item">
            <FontAwesomeIcon icon={faGlobe} />
            <div className="detail-content">
              <span className="detail-label">URL</span>
              <span className="detail-value">
                <a href={connection.url} target="_blank" rel="noopener noreferrer">
                  {connection.url}
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </span>
            </div>
          </div>
          <div className="detail-item">
            <FontAwesomeIcon icon={faUser} />
            <div className="detail-content">
              <span className="detail-label">Username</span>
              <span className="detail-value">{connection.username}</span>
            </div>
          </div>
          <div className="detail-item">
            <FontAwesomeIcon icon={faCalendarAlt} />
            <div className="detail-content">
              <span className="detail-label">Created</span>
              <span className="detail-value">{formatDate(connection.createdAt)}</span>
            </div>
          </div>
          <div className="detail-item">
            <FontAwesomeIcon icon={faCalendarAlt} />
            <div className="detail-content">
              <span className="detail-label">Last Updated</span>
              <span className="detail-value">{formatDate(connection.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="dashboard-section">
        <h3>Blog Statistics</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faFileAlt} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalPosts}</span>
              <span className="stat-label">Total Posts</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.publishedPosts}</span>
              <span className="stat-label">Published</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning">
              <FontAwesomeIcon icon={faEdit} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.draftPosts}</span>
              <span className="stat-label">Drafts</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faChartBar} />
            </div>
            <div className="stat-content">
              <span className="stat-value">
                {stats.lastPostDate ? formatDate(stats.lastPostDate) : 'N/A'}
              </span>
              <span className="stat-label">Last Post</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="dashboard-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions">
          <button className="quick-action-btn">
            <FontAwesomeIcon icon={faFileAlt} />
            <span>View Posts</span>
          </button>
          <button className="quick-action-btn">
            <FontAwesomeIcon icon={faEdit} />
            <span>Create Post</span>
          </button>
          <button className="quick-action-btn">
            <FontAwesomeIcon icon={faCog} />
            <span>Settings</span>
          </button>
          <button className="quick-action-btn" onClick={onRefresh}>
            <FontAwesomeIcon icon={faRefresh} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDashboard;
