import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ScheduledPostsTab from '../EGBlog/components/ScheduledPostsTab';
import SettingsTab from './components/SettingsTab';
import { 
  faGlobe, 
  faUser, 
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
import { faInstagram as faInstagramBrand, faYoutube, faFacebook } from '@fortawesome/free-brands-svg-icons';
// TODO: Import Instagram thumbnail when provided
// import instagramIcon from '../../../../assets/instagram.svg';
import './SocialMediaConnectionDashboard.css';

interface SocialMediaConnection {
  id: string;
  name: string;
  type: 'instagram' | 'facebook' | 'youtube';
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

interface SocialMediaConnectionDashboardProps {
  connection: SocialMediaConnection;
  onTestConnection?: (connection: SocialMediaConnection) => void;
  onRefresh?: () => void;
  onBack?: () => void;
  onEdit?: (connection: SocialMediaConnection) => void;
  onDelete?: (connectionId: string) => void;
  initialTab?: 'scheduled' | 'posts' | 'analytics' | 'settings';
}

const SocialMediaConnectionDashboard: React.FC<SocialMediaConnectionDashboardProps> = ({
  connection,
  onTestConnection,
  onRefresh,
  onBack,
  onEdit,
  onDelete,
  initialTab
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');
  const [activeTab, setActiveTab] = useState<'scheduled' | 'posts' | 'analytics' | 'settings'>(initialTab || 'scheduled');
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalScheduled: 0,
    totalFollowers: 0,
    totalLikes: 0
  });

  useEffect(() => {
    loadConnectionStats();
  }, [connection.id]);

  // Update activeTab when initialTab changes (from navigation)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadConnectionStats = async () => {
    try {
      setIsLoading(true);
      
      // Initialize default stats
      const defaultStats = {
        totalPosts: 0,
        totalScheduled: 0,
        totalFollowers: 0,
        totalLikes: 0
      };

      // Handle different connection types
      if (connection.type === 'instagram') {
        // Get scheduled count
        const scheduledResult = await window.electron.scheduledPosts.getByConnection(connection.id);
        const totalScheduled = scheduledResult.success && scheduledResult.data ? scheduledResult.data.length : 0;
        
        setStats({
          ...defaultStats,
          totalScheduled
        });
        
        console.log(`📊 Loaded Instagram stats for ${connection.name}:`, {
          totalScheduled
        });
      }
      // TODO: Handle other social media platforms
    } catch (err) {
      console.error('Failed to load connection stats:', err);
      setStats({
        totalPosts: 0,
        totalScheduled: 0,
        totalFollowers: 0,
        totalLikes: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisitProfile = () => {
    if (connection.type === 'instagram') {
      window.open(`https://instagram.com/${connection.username}`, '_blank', 'noopener,noreferrer');
    }
    // TODO: Handle other platforms
  };

  const handleRefreshStats = () => {
    loadConnectionStats();
  };

  const getConnectionIcon = (connection: SocialMediaConnection): any => {
    if (connection.type === 'instagram') {
      return faInstagramBrand;
    }
    if (connection.type === 'youtube') {
      return faYoutube;
    }
    if (connection.type === 'facebook') {
      return faFacebook;
    }
    // TODO: Add icons for other platforms
    return faGlobe;
  };

  const getConnectionIconSrc = (connection: SocialMediaConnection): string | null => {
    if (connection.type === 'instagram') {
      // TODO: Return Instagram thumbnail when provided
      // return instagramIcon;
      return null;
    }
    // TODO: Add icons for other platforms
    return null;
  };

  const getConnectionColor = (connection: SocialMediaConnection) => {
    if (connection.type === 'instagram') {
      return '#E4405F';
    }
    if (connection.type === 'youtube') {
      return '#FF0000';
    }
    if (connection.type === 'facebook') {
      return '#1877F2';
    }
    // TODO: Add colors for other platforms
    return '#6b7280';
  };

  const getConnectionGradient = (connection: SocialMediaConnection) => {
    if (connection.type === 'instagram') {
      return 'linear-gradient(135deg, #E4405F 0%, #C13584 100%)';
    }
    if (connection.type === 'youtube') {
      return 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)';
    }
    if (connection.type === 'facebook') {
      return 'linear-gradient(135deg, #1877F2 0%, #0e5fc7 100%)';
    }
    // TODO: Add gradients for other platforms
    return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
  };

  const getConnectionTypeName = (connection: SocialMediaConnection) => {
    if (connection.type === 'instagram') {
      return 'Instagram';
    }
    if (connection.type === 'youtube') {
      return 'YouTube';
    }
    if (connection.type === 'facebook') {
      return 'Facebook';
    }
    // TODO: Add names for other platforms
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
    { id: 'scheduled', label: `Scheduled (${stats.totalScheduled})`, icon: faCalendarAlt },
    { id: 'posts', label: `Posts (${stats.totalPosts})`, icon: faFileAlt },
    { id: 'analytics', label: 'Analytics', icon: faChartBar },
    { id: 'settings', label: 'Settings', icon: faCog }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scheduled':
        return (
          <ScheduledPostsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={connection.type}
            onStatsUpdate={loadConnectionStats}
          />
        );
      case 'posts':
        return (
          <div className="social-media-connection-dashboard-tab-content">
            <div className="social-media-coming-soon">
              <div className="social-media-coming-soon-icon">
                <FontAwesomeIcon icon={faFileAlt} />
              </div>
            <h4>Posts</h4>
            <p>View and manage your published posts.</p>
              <p className="social-media-coming-soon-message">Coming Soon</p>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="social-media-connection-dashboard-tab-content">
            <div className="social-media-coming-soon">
              <div className="social-media-coming-soon-icon">
                <FontAwesomeIcon icon={faChartBar} />
              </div>
            <h4>Analytics</h4>
            <p>View insights and analytics for your account.</p>
              <p className="social-media-coming-soon-message">Coming Soon</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <SettingsTab
            connectionId={connection.id}
            connectionName={connection.name}
            connectionType={connection.type}
            onStatsUpdate={loadConnectionStats}
            onConnectionDeleted={onBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="social-media-connection-dashboard">
      {/* Header Section */}
      <div className="social-media-connection-dashboard-header">
        <div className="social-media-connection-dashboard-header-actions">
          {onBack && (
            <button className="social-media-connection-dashboard-return-btn" onClick={onBack} title="Back to Connections">
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
        </div>
        <div className="social-media-connection-dashboard-connection-info-header">
          <div 
            className="social-media-connection-dashboard-connection-icon-large"
            style={{ background: getConnectionGradient(connection) }}
          >
            {getConnectionIconSrc(connection) ? (
              <img src={getConnectionIconSrc(connection)!} alt={`${getConnectionTypeName(connection)} icon`} />
            ) : (
              <FontAwesomeIcon icon={getConnectionIcon(connection)} />
            )}
          </div>
          <div className="social-media-connection-dashboard-connection-title">
            <h2>{connection.name}</h2>
            <p className="social-media-connection-dashboard-connection-type">{getConnectionTypeName(connection)}</p>
            <div className="social-media-connection-dashboard-connection-status">
              <span className={`social-media-connection-dashboard-status-indicator social-media-connection-dashboard-status-indicator-success`}>
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>Connected</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="social-media-connection-dashboard-actions">
          <button
            className="social-media-connection-dashboard-action-btn social-media-connection-dashboard-visit-btn"
            onClick={handleVisitProfile}
            title="Visit Profile"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            Visit
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="social-media-connection-dashboard-main">
        {/* Left Content - Tabs */}
        <div className="social-media-connection-dashboard-content">
          <div className="social-media-connection-dashboard-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`social-media-connection-dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <FontAwesomeIcon icon={tab.icon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="social-media-connection-dashboard-tab-panel">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaConnectionDashboard;
