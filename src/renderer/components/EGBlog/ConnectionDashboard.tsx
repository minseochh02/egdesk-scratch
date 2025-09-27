import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWordpress, 
  faGlobe, 
  faUser, 
  faKey, 
  faCalendarAlt, 
  faCheckCircle, 
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
import SiteStatusChecker from './SiteStatusChecker';
import PostsTab from './components/PostsTab';
import MediaTab from './components/MediaTab';
import CommentsTab from './components/CommentsTab';
import SettingsTab from './components/SettingsTab';
import ScheduledPostsTab from './components/ScheduledPostsTab';
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
  onTestConnection?: (connection: BlogConnection) => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

const ConnectionDashboard: React.FC<ConnectionDashboardProps> = ({
  connection,
  onTestConnection,
  onRefresh,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');
  const [activeTab, setActiveTab] = useState<'scheduled' | 'posts' | 'media' | 'comments' | 'settings'>('scheduled');
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
      
      if (!window.electron?.wordpress) {
        console.warn('WordPress API not available');
        setStats({
          totalPosts: 0,
          publishedPosts: 0,
          draftPosts: 0,
          lastPostDate: null
        });
        return;
      }

      // Get sync statistics from SQLite
      const statsResult = await window.electron.wordpress.getSyncStats(connection.id);
      
      if (statsResult.success && statsResult.stats) {
        const syncStats = statsResult.stats;
        
        // Get detailed post counts by status
        const postsResult = await window.electron.wordpress.getPosts(connection.id, 1000, 0);
        
        let publishedPosts = 0;
        let draftPosts = 0;
        let lastPostDate: string | null = null;
        
        if (postsResult.success && postsResult.posts) {
          // Count posts by status
          postsResult.posts.forEach((post: any) => {
            if (post.status === 'publish') {
              publishedPosts++;
            } else if (post.status === 'draft') {
              draftPosts++;
            }
            
            // Find the most recent post date
            const postDate = post.modified || post.date;
            if (postDate && (!lastPostDate || new Date(postDate) > new Date(lastPostDate))) {
              lastPostDate = postDate;
            }
          });
        }
        
        setStats({
          totalPosts: syncStats.totalPosts || 0,
          publishedPosts,
          draftPosts,
          lastPostDate
        });
        
        console.log(`📊 Loaded stats for ${connection.name}:`, {
          totalPosts: syncStats.totalPosts,
          publishedPosts,
          draftPosts,
          lastPostDate
        });
      } else {
        console.warn('Failed to load sync stats:', statsResult.error);
        setStats({
          totalPosts: 0,
          publishedPosts: 0,
          draftPosts: 0,
          lastPostDate: null
        });
      }
    } catch (err) {
      console.error('Failed to load connection stats:', err);
      setStats({
        totalPosts: 0,
        publishedPosts: 0,
        draftPosts: 0,
        lastPostDate: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisitBlog = () => {
    window.open(connection.url, '_blank', 'noopener,noreferrer');
  };

  const handleRefreshStats = () => {
    loadConnectionStats();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const tabs = [
    { id: 'scheduled', label: 'Scheduled Tasks', icon: faCalendarAlt },
    { id: 'posts', label: 'Posts', icon: faFileAlt },
    { id: 'media', label: 'Media', icon: faImage },
    { id: 'comments', label: 'Comments', icon: faComments },
    { id: 'settings', label: 'Settings', icon: faCog }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scheduled':
        return (
          <ScheduledPostsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={getConnectionTypeName(connection)}
            onStatsUpdate={handleRefreshStats}
          />
        );
      case 'posts':
        return (
          <PostsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={getConnectionTypeName(connection)}
            onStatsUpdate={handleRefreshStats}
          />
        );
      case 'media':
        return (
          <MediaTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={getConnectionTypeName(connection)}
            onStatsUpdate={handleRefreshStats}
          />
        );
      case 'comments':
        return (
          <CommentsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={getConnectionTypeName(connection)}
            onStatsUpdate={handleRefreshStats}
          />
        );
      case 'settings':
        return (
          <SettingsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={getConnectionTypeName(connection)}
            onStatsUpdate={handleRefreshStats}
            onConnectionDeleted={onBack}
          />
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
            {getConnectionIconSrc(connection) ? (
              <img src={getConnectionIconSrc(connection)!} alt={`${getConnectionTypeName(connection)} icon`} />
            ) : (
              <FontAwesomeIcon icon={getConnectionIcon(connection)} />
            )}
          </div>
          <div className="eg-blog-connection-dashboard-connection-title">
            <h2>{connection.name}</h2>
            <p className="eg-blog-connection-dashboard-connection-type">{getConnectionTypeName(connection)}</p>
            <div className="eg-blog-connection-dashboard-connection-status">
              <SiteStatusChecker 
                url={connection.url}
                onStatusChange={(status) => {
                  if (status === 'online') {
                    setConnectionStatus('connected');
                  } else if (status === 'offline' || status === 'error') {
                    setConnectionStatus('disconnected');
                  } else {
                    setConnectionStatus('testing');
                  }
                }}
              />
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
            <div className="eg-blog-connection-dashboard-stats-header">
              <h3>Blog Statistics</h3>
              <button 
                className="eg-blog-connection-dashboard-refresh-stats-btn"
                onClick={handleRefreshStats}
                disabled={isLoading}
                title="Refresh statistics"
              >
                <FontAwesomeIcon icon={faRefresh} spin={isLoading} />
              </button>
            </div>
            <div className="eg-blog-connection-dashboard-stats-grid">
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon">
                  <FontAwesomeIcon icon={faFileAlt} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">
                    {isLoading ? '...' : stats.totalPosts}
                  </span>
                  <span className="eg-blog-connection-dashboard-stat-label">Total Posts</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon eg-blog-connection-dashboard-stat-icon-success">
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">
                    {isLoading ? '...' : stats.publishedPosts}
                  </span>
                  <span className="eg-blog-connection-dashboard-stat-label">Published</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon eg-blog-connection-dashboard-stat-icon-warning">
                  <FontAwesomeIcon icon={faFileAlt} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">
                    {isLoading ? '...' : stats.draftPosts}
                  </span>
                  <span className="eg-blog-connection-dashboard-stat-label">Drafts</span>
                </div>
              </div>
              <div className="eg-blog-connection-dashboard-stat-card">
                <div className="eg-blog-connection-dashboard-stat-icon">
                  <FontAwesomeIcon icon={faChartBar} />
                </div>
                <div className="eg-blog-connection-dashboard-stat-content">
                  <span className="eg-blog-connection-dashboard-stat-value">
                    {isLoading ? '...' : (stats.lastPostDate ? formatDate(stats.lastPostDate) : 'N/A')}
                  </span>
                  <span className="eg-blog-connection-dashboard-stat-label">Last Post</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionDashboard;
