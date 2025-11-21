import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faPlus, faSpinner, faGlobe, faUser, faCalendarAlt, faExclamationTriangle, faCircleCheck } from '../../utils/fontAwesomeIcons';
import { faInstagram as faInstagramBrand, faYoutube, faFacebook } from '@fortawesome/free-brands-svg-icons';
import './SocialMediaConnectionList.css';

interface SocialMediaConnection {
  id: string;
  name: string;
  type: 'instagram' | 'facebook' | 'youtube';
  username: string;
  createdAt: string;
}

interface SocialMediaConnectionListProps {
  onConnect?: (connection: SocialMediaConnection) => void;
  onView?: (connection: SocialMediaConnection) => void;
  onBack?: () => void;
  onAddAccount?: () => void;
}

const SocialMediaConnectionList: React.FC<SocialMediaConnectionListProps> = ({
  onConnect,
  onView,
  onBack,
  onAddAccount
}) => {
  const [connections, setConnections] = useState<SocialMediaConnection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      const allConnections: SocialMediaConnection[] = [];

      // Load Instagram connections
      try {
        const instagramResult = await window.electron.instagram.getConnections();
        if (instagramResult.success && instagramResult.connections) {
          const instagramConnections = instagramResult.connections.map(conn => ({
            id: conn.id || '',
            name: conn.name,
            type: 'instagram' as const,
            username: conn.username,
            createdAt: conn.createdAt || new Date().toISOString(),
          }));
          allConnections.push(...instagramConnections);
        }
      } catch (err) {
        console.warn('Failed to load Instagram connections:', err);
      }

      // Load YouTube connections
      try {
        const youtubeResult = await window.electron.youtube.getConnections();
        if (youtubeResult.success && youtubeResult.connections) {
          const youtubeConnections = youtubeResult.connections.map(conn => ({
            id: conn.id || '',
            name: conn.name,
            type: 'youtube' as const,
            username: conn.username,
            createdAt: conn.createdAt || new Date().toISOString(),
          }));
          allConnections.push(...youtubeConnections);
        }
      } catch (err) {
        console.warn('Failed to load YouTube connections:', err);
      }

      // Load Facebook connections
      try {
        const facebookResult = await window.electron.facebook.getConnections();
        if (facebookResult.success && facebookResult.connections) {
          const facebookConnections = facebookResult.connections.map(conn => ({
            id: conn.id || '',
            name: conn.name,
            type: 'facebook' as const,
            username: conn.username,
            createdAt: conn.createdAt || new Date().toISOString(),
          }));
          allConnections.push(...facebookConnections);
        }
      } catch (err) {
        console.warn('Failed to load Facebook connections:', err);
      }

      setConnections(allConnections);
    } catch (err) {
      console.error('Failed to load connections:', err);
      setError('Failed to load connections. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleView = (connection: SocialMediaConnection) => {
    if (onView) {
      onView(connection);
    } else if (onConnect) {
      onConnect(connection);
    }
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

  const getConnectionColor = (connection: SocialMediaConnection): string => {
    if (connection.type === 'instagram') {
      return 'linear-gradient(135deg, #E4405F 0%, #C13584 100%)';
    }
    if (connection.type === 'youtube') {
      return 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)';
    }
    if (connection.type === 'facebook') {
      return 'linear-gradient(135deg, #1877F2 0%, #0e5fc7 100%)';
    }
    // TODO: Add colors for other platforms
    return '#667eea';
  };

  const getConnectionTypeName = (connection: SocialMediaConnection): string => {
    if (connection.type === 'instagram') {
      return 'Instagram';
    }
    if (connection.type === 'youtube') {
      return 'YouTube';
    }
    if (connection.type === 'facebook') {
      return 'Facebook';
    }
    return connection.type.charAt(0).toUpperCase() + connection.type.slice(1);
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

  const getStatusColor = (): 'success' => {
    // For now, all connections are considered successful
    return 'success';
  };

  const getStatusIcon = () => {
    return faCircleCheck;
  };

  const getStatusText = (): string => {
    return 'Connected';
  };

  if (loading) {
    return (
      <div className="social-media-connection-list">
        <div className="social-media-connection-list-header">
          <div className="social-media-connection-list-header-actions">
            {onBack && (
              <button className="social-media-connection-list-return-btn" onClick={onBack}>
                <FontAwesomeIcon icon={faArrowRight} />
                <span>Back to Platform Selection</span>
              </button>
            )}
          </div>
          <div className="social-media-connection-list-header-content">
            <h2>My Social Media Accounts</h2>
          </div>
          {onAddAccount && (
            <button className="social-media-connection-list-add-btn" onClick={onAddAccount}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Add Account</span>
            </button>
          )}
        </div>
        <div className="social-media-connection-list-loading-state">
          <div className="social-media-connection-list-spinner"></div>
          <p>Loading connections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="social-media-connection-list">
        <div className="social-media-connection-list-header">
          <div className="social-media-connection-list-header-actions">
            {onBack && (
              <button className="social-media-connection-list-return-btn" onClick={onBack}>
                <FontAwesomeIcon icon={faArrowRight} />
                <span>Back to Platform Selection</span>
              </button>
            )}
          </div>
          <div className="social-media-connection-list-header-content">
            <h2>My Social Media Accounts</h2>
          </div>
          {onAddAccount && (
            <button className="social-media-connection-list-add-btn" onClick={onAddAccount}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Add Account</span>
            </button>
          )}
        </div>
        <div className="social-media-connection-list-error-state">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <h3>Error Loading Connections</h3>
          <p>{error}</p>
          <button onClick={loadConnections} className="social-media-connection-list-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="social-media-connection-list">
        <div className="social-media-connection-list-header">
          <div className="social-media-connection-list-header-actions">
            {onBack && (
              <button className="social-media-connection-list-return-btn" onClick={onBack}>
                <FontAwesomeIcon icon={faArrowRight} />
                <span>Back to Platform Selection</span>
              </button>
            )}
          </div>
          <div className="social-media-connection-list-header-content">
            <h2>My Social Media Accounts</h2>
          </div>
          {onAddAccount && (
            <button className="social-media-connection-list-add-btn" onClick={onAddAccount}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Add Account</span>
            </button>
          )}
        </div>
        <div className="social-media-connection-list-empty-state">
          <FontAwesomeIcon icon={faGlobe} />
          <h3>No Social Media Accounts Yet</h3>
          <p>You haven't connected any social media platforms yet.</p>
          <p>Click "Add Account" to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-media-connection-list">
      <div className="social-media-connection-list-header">
        <div className="social-media-connection-list-header-actions">
          {onBack && (
            <button className="social-media-connection-list-return-btn" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>Back to Platform Selection</span>
            </button>
          )}
        </div>
        <div className="social-media-connection-list-header-content">
          <h2>My Social Media Accounts</h2>
        </div>
        {onAddAccount && (
          <button className="social-media-connection-list-add-btn" onClick={onAddAccount}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Account</span>
          </button>
        )}
      </div>

      <div className="social-media-connection-list-grid">
        {connections.map((connection) => (
          <div 
            key={connection.id} 
            className="social-media-connection-list-card"
            onClick={() => handleView(connection)}
            style={{ cursor: 'pointer' }}
          >
            <div className="social-media-connection-list-card-header">
              <div className="social-media-connection-list-card-header-left">
                <div 
                  className="social-media-connection-list-icon"
                  style={{ background: getConnectionColor(connection) }}
                >
                  <FontAwesomeIcon icon={getConnectionIcon(connection)} />
                </div>
                <h3>{connection.name}</h3>
              </div>
              <div className="social-media-connection-list-status">
                <span className={`social-media-connection-list-status-indicator social-media-connection-list-status-indicator-${getStatusColor()}`}>
                  <FontAwesomeIcon icon={getStatusIcon()} />
                </span>
                <span className="social-media-connection-list-status-text">{getStatusText()}</span>
              </div>
            </div>

            <div className="social-media-connection-list-info">
              <div className="social-media-connection-list-details">
                <div className="social-media-connection-list-detail-item">
                  <FontAwesomeIcon icon={faGlobe} />
                  <div className="social-media-connection-list-detail-text">
                    <span className="social-media-connection-list-detail-label">Platform:</span>
                    <span className="social-media-connection-list-detail-value">{getConnectionTypeName(connection)}</span>
                  </div>
                </div>
                <div className="social-media-connection-list-detail-item">
                  <FontAwesomeIcon icon={faUser} />
                  <div className="social-media-connection-list-detail-text">
                    <span className="social-media-connection-list-detail-label">Username:</span>
                    <span className="social-media-connection-list-detail-value">@{connection.username}</span>
                  </div>
                </div>
                <div className="social-media-connection-list-detail-item">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                  <div className="social-media-connection-list-detail-text">
                    <span className="social-media-connection-list-detail-label">Created:</span>
                    <span className="social-media-connection-list-detail-value">{formatDate(connection.createdAt)}</span>
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

export default SocialMediaConnectionList;

