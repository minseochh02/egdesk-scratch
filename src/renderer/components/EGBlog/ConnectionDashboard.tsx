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
  faArrowLeft,
  faImage,
  faComments,
  faSettings
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
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'media' | 'comments' | 'settings'>('overview');
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

  const handleVisitBlog = () => {
    window.open(connection.url, '_blank', 'noopener,noreferrer');
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: faChartBar },
    { id: 'posts', label: 'Posts', icon: faFileAlt },
    { id: 'media', label: 'Media', icon: faImage },
    { id: 'comments', label: 'Comments', icon: faComments },
    { id: 'settings', label: 'Settings', icon: faCog }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="eg-blog-connection-dashboard-tab-content">
            <h4>Connection Overview</h4>
            <p>Welcome to your {getConnectionTypeName(connection)} dashboard. Here you can manage your blog content, media, and settings.</p>
            
            <div className="eg-blog-connection-dashboard-connection-details-grid">
              <div className="eg-blog-connection-dashboard-detail-item">
                <FontAwesomeIcon icon={faGlobe} />
                <div className="eg-blog-connection-dashboard-detail-content">
                  <span className="eg-blog-connection-dashboard-detail-label">URL</span>
                  <span className="eg-blog-connection-dashboard-detail-value">
                    <a href={connection.url} target="_blank" rel="noopener noreferrer">
                      {connection.url}
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  </span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-detail-item">
                <FontAwesomeIcon icon={faUser} />
                <div className="eg-blog-connection-dashboard-detail-content">
                  <span className="eg-blog-connection-dashboard-detail-label">Username</span>
                  <span className="eg-blog-connection-dashboard-detail-value">{connection.username}</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-detail-item">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <div className="eg-blog-connection-dashboard-detail-content">
                  <span className="eg-blog-connection-dashboard-detail-label">Created</span>
                  <span className="eg-blog-connection-dashboard-detail-value">{formatDate(connection.createdAt)}</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-detail-item">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <div className="eg-blog-connection-dashboard-detail-content">
                  <span className="eg-blog-connection-dashboard-detail-label">Last Updated</span>
                  <span className="eg-blog-connection-dashboard-detail-value">{formatDate(connection.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'posts':
        return (
          <div className="eg-blog-connection-dashboard-tab-content">
            <h4>Blog Posts</h4>
            <p>Manage your blog posts and content.</p>
            <div className="eg-blog-connection-dashboard-placeholder">
              <FontAwesomeIcon icon={faFileAlt} />
              <p>Post management interface coming soon...</p>
            </div>
          </div>
        );
      case 'media':
        return (
          <div className="eg-blog-connection-dashboard-tab-content">
            <h4>Media Library</h4>
            <p>Upload and manage your media files.</p>
            <div className="eg-blog-connection-dashboard-placeholder">
              <FontAwesomeIcon icon={faImage} />
              <p>Media management interface coming soon...</p>
            </div>
          </div>
        );
      case 'comments':
        return (
          <div className="eg-blog-connection-dashboard-tab-content">
            <h4>Comments</h4>
            <p>Moderate and manage comments on your blog.</p>
            <div className="eg-blog-connection-dashboard-placeholder">
              <FontAwesomeIcon icon={faComments} />
              <p>Comment management interface coming soon...</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="eg-blog-connection-dashboard-tab-content">
            <h4>Settings</h4>
            <p>Configure your blog connection settings.</p>
            <div className="eg-blog-connection-dashboard-placeholder">
              <FontAwesomeIcon icon={faCog} />
              <p>Settings interface coming soon...</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="eg-blog-connection-dashboard">
      {/* Header Section */}
      <div className="eg-blog-connection-dashboard-header">
        <div className="eg-blog-connection-dashboard-header-actions">
          {onBack && (
            <button className="eg-blog-connection-dashboard-return-btn" onClick={onBack} title="Back to Connections">
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
        </div>
        <div className="eg-blog-connection-dashboard-connection-info-header">
          <div 
            className="eg-blog-connection-dashboard-connection-icon-large"
            style={{ background: getConnectionGradient(connection) }}
          >
            {typeof getConnectionIcon(connection) === 'string' || getConnectionIcon(connection) === naverBlogIcon || getConnectionIcon(connection) === tistoryIcon ? (
              <img src={getConnectionIcon(connection)} alt={`${getConnectionTypeName(connection)} icon`} />
            ) : (
              <FontAwesomeIcon icon={getConnectionIcon(connection)} />
            )}
          </div>
          <div className="eg-blog-connection-dashboard-connection-title">
            <h2>{connection.name}</h2>
            <p className="eg-blog-connection-dashboard-connection-type">{getConnectionTypeName(connection)}</p>
            <div className="eg-blog-connection-dashboard-connection-status">
              <span className={`eg-blog-connection-dashboard-status-indicator eg-blog-connection-dashboard-status-indicator-${getStatusColor()}`}>
                <FontAwesomeIcon icon={getStatusIcon()} />
                {connectionStatus === 'testing' ? 'Testing...' : connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </span>
              {lastTested && (
                <span className="eg-blog-connection-dashboard-last-tested">
                  Last tested: {formatDate(lastTested)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="eg-blog-connection-dashboard-actions">
          <button
            className="eg-blog-connection-dashboard-action-btn eg-blog-connection-dashboard-visit-btn"
            onClick={handleVisitBlog}
            title="Visit Blog"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            Visit
          </button>
          <button
            className="eg-blog-connection-dashboard-action-btn eg-blog-connection-dashboard-edit-btn"
            onClick={handleEdit}
            title="Edit Connection"
          >
            <FontAwesomeIcon icon={faEdit} />
          </button>
          <button
            className="eg-blog-connection-dashboard-action-btn eg-blog-connection-dashboard-delete-btn"
            onClick={handleDelete}
            title="Delete Connection"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="eg-blog-connection-dashboard-main">
        {/* Left Content - Tabs */}
        <div className="eg-blog-connection-dashboard-content">
          <div className="eg-blog-connection-dashboard-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`eg-blog-connection-dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <FontAwesomeIcon icon={tab.icon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="eg-blog-connection-dashboard-tab-panel">
            {renderTabContent()}
          </div>
        </div>

        {/* Right Sidebar - Stats */}
        <div className="eg-blog-connection-dashboard-sidebar">
          <div className="eg-blog-connection-dashboard-stats-card">
            <h3>Blog Statistics</h3>
            <div className="eg-blog-connection-dashboard-stats-grid">
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon">
                  <FontAwesomeIcon icon={faFileAlt} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">{stats.totalPosts}</span>
                  <span className="eg-blog-connection-dashboard-stat-label">Total Posts</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon eg-blog-connection-dashboard-stat-icon-success">
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">{stats.publishedPosts}</span>
                  <span className="eg-blog-connection-dashboard-stat-label">Published</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon eg-blog-connection-dashboard-stat-icon-warning">
                  <FontAwesomeIcon icon={faEdit} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">{stats.draftPosts}</span>
                  <span className="eg-blog-connection-dashboard-stat-label">Drafts</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon">
                  <FontAwesomeIcon icon={faChartBar} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">
                    {stats.lastPostDate ? formatDate(stats.lastPostDate) : 'N/A'}
                  </span>
                  <span className="eg-blog-connection-dashboard-stat-label">Last Post</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="eg-blog-connection-dashboard-quick-actions-card">
            <h3>Quick Actions</h3>
            <div className="eg-blog-connection-dashboard-quick-actions">
              <button className="eg-blog-connection-dashboard-quick-action-btn" onClick={() => setActiveTab('posts')}>
                <FontAwesomeIcon icon={faFileAlt} />
                <span>View Posts</span>
              </button>
              <button className="eg-blog-connection-dashboard-quick-action-btn" onClick={() => setActiveTab('media')}>
                <FontAwesomeIcon icon={faImage} />
                <span>Media Library</span>
              </button>
              <button className="eg-blog-connection-dashboard-quick-action-btn" onClick={() => setActiveTab('settings')}>
                <FontAwesomeIcon icon={faCog} />
                <span>Settings</span>
              </button>
              <button className="eg-blog-connection-dashboard-quick-action-btn" onClick={onRefresh}>
                <FontAwesomeIcon icon={faRefresh} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDashboard;
