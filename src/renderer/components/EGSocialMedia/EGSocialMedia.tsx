import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faArrowLeft, faArrowRight } from '../../utils/fontAwesomeIcons';
import SocialMediaConnector from './SocialMediaConnector';
import SocialMediaConnectionList from './SocialMediaConnectionList';
import SocialMediaConnectionDashboard from './SocialMediaConnectionDashboard';
import './EGSocialMedia.css';

interface InstagramConnection {
  id: string;
  name: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'instagram';
}

interface FacebookConnection {
  id: string;
  name: string;
  username: string;
  password: string;
  pageId?: string;
  accessToken?: string;
  createdAt: string;
  updatedAt: string;
  type: 'facebook';
}

interface YouTubeConnection {
  id: string;
  name: string;
  username: string;
  password: string;
  channelId?: string;
  createdAt: string;
  updatedAt: string;
  type: 'youtube';
}

type SocialMediaConnection = InstagramConnection | FacebookConnection | YouTubeConnection;

type ViewMode = 'platform-selection' | 'connection-list' | 'connection-dashboard';

const EGSocialMedia: React.FC = () => {
  const location = useLocation();
  const [currentView, setCurrentView] = useState<ViewMode>('platform-selection');
  const [editingConnection, setEditingConnection] = useState<SocialMediaConnection | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<SocialMediaConnection | null>(null);
  const [hasConnections, setHasConnections] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initialTab, setInitialTab] = useState<'scheduled' | 'posts' | 'analytics' | 'settings' | undefined>(undefined);

  // Function to load a specific connection by ID and type
  const loadConnectionById = async (connectionId: string, connectionType: string): Promise<SocialMediaConnection | null> => {
    try {
      const normalizedType = connectionType.toLowerCase();
      if (normalizedType === 'instagram') {
        const instagramResult = await window.electron.instagram.getConnections();
        if (instagramResult.success && instagramResult.connections) {
          const connection = instagramResult.connections.find(conn => conn.id === connectionId);
          if (connection) {
            return {
              ...connection,
              type: 'instagram' as const
            };
          }
        }
      } else if (normalizedType === 'youtube' || normalizedType === 'yt') {
        const youtubeResult = await window.electron.youtube.getConnections();
        if (youtubeResult.success && youtubeResult.connections) {
          const connection = youtubeResult.connections.find(conn => conn.id === connectionId);
          if (connection) {
            return {
              ...connection,
              type: 'youtube' as const
            };
          }
        }
        return null;
      } else if (normalizedType === 'facebook' || normalizedType === 'fb') {
        const facebookResult = await window.electron.facebook.getConnections();
        if (facebookResult.success && facebookResult.connections) {
          const connection = facebookResult.connections.find(conn => conn.id === connectionId);
          if (connection) {
            return {
              ...connection,
              type: 'facebook' as const
            };
          }
        }
        return null;
      }
      return null;
    } catch (err) {
      console.error('Failed to load connection:', err);
      return null;
    }
  };

  // Function to refresh connection check
  const checkExistingConnections = async () => {
    try {
      const allConnections: SocialMediaConnection[] = [];
      
      // Load Instagram connections
      try {
        const instagramResult = await window.electron.instagram.getConnections();
        if (instagramResult.success && instagramResult.connections) {
          const instagramConnections = instagramResult.connections.map(conn => ({
            ...conn,
            type: 'instagram' as const
          }));
          allConnections.push(...instagramConnections);
        }
      } catch (err) {
        console.warn('Failed to load Instagram connections:', err);
      }
      
      // TODO: Load YouTube connections when handler is implemented
      // TODO: Load Facebook connections when implemented
      
      const hasAnyConnections = allConnections.length > 0;
      setHasConnections(hasAnyConnections);
      
      // If user has connections, show the connection list by default
      if (hasAnyConnections) {
        setCurrentView('connection-list');
      } else {
        setCurrentView('platform-selection');
      }
    } catch (err) {
      console.error('Failed to check existing connections:', err);
    }
  };

  // Check for existing connections on component mount and handle navigation from location state
  useEffect(() => {
    const loadConnections = async () => {
      try {
        setIsLoading(true);
        
        // Check if location state has connection info (from Business Identity navigation)
        const locationState = location.state as { connectionId?: string; connectionName?: string; connectionType?: string; activeTab?: 'scheduled' | 'posts' | 'analytics' | 'settings' } | null;
        
        if (locationState?.connectionId && locationState?.connectionType) {
          // Try to load the specific connection
          const connection = await loadConnectionById(locationState.connectionId, locationState.connectionType);
          if (connection) {
            setSelectedConnection(connection);
            setCurrentView('connection-dashboard');
            // Set initial tab if provided, default to 'scheduled'
            setInitialTab(locationState.activeTab || 'scheduled');
            setIsLoading(false);
            return;
          }
        }
        
        // Otherwise, load all connections normally
        await checkExistingConnections();
      } finally {
        setIsLoading(false);
      }
    };

    loadConnections();
  }, [location.state]);

  const handleShowConnectionList = () => {
    setCurrentView('connection-list');
  };

  const handleBackFromConnectionList = () => {
    setCurrentView('platform-selection');
  };

  const handleViewConnection = (connection: SocialMediaConnection) => {
    setSelectedConnection(connection);
    setCurrentView('connection-dashboard');
  };

  const handleBackFromDashboard = () => {
    setSelectedConnection(null);
    setCurrentView('connection-list');
  };

  const handleTestConnection = async (connection: SocialMediaConnection) => {
    console.log('Testing connection:', connection.name);
    // TODO: Implement actual connection testing
    alert(`Testing connection to ${connection.name}...`);
  };

  const handleRefreshDashboard = () => {
    // TODO: Implement dashboard refresh logic
    console.log('Refreshing dashboard...');
  };

  const handleEditConnection = (connection: SocialMediaConnection) => {
    setEditingConnection(connection);
    // This will be handled by SocialMediaConnector
  };

  const handleDeleteConnection = async (connectionId: string) => {
    // The SocialMediaConnectionList component handles the actual deletion
    // After deletion, refresh the connection list
    await checkExistingConnections();
  };

  const handleAddAccount = () => {
    setCurrentView('platform-selection');
  };

  // Show loading state while checking for connections
  if (isLoading) {
    return (
      <div className="eg-social-media">
        <div className="eg-social-media-scroll">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your social media connections...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render connection dashboard
  if (currentView === 'connection-dashboard' && selectedConnection) {
    return (
      <div className="eg-social-media connection-dashboard-view">
        <div className="eg-social-media-scroll">
          <SocialMediaConnectionDashboard
            connection={selectedConnection}
            onEdit={handleEditConnection}
            onDelete={handleDeleteConnection}
            onTestConnection={handleTestConnection}
            onRefresh={handleRefreshDashboard}
            onBack={handleBackFromDashboard}
            initialTab={initialTab}
          />
        </div>
      </div>
    );
  }

  // Render connection list
  if (currentView === 'connection-list') {
    return (
      <div className="eg-social-media connection-list-view">
        <div className="eg-social-media-scroll">
          <SocialMediaConnectionList
            onConnect={handleViewConnection}
            onView={handleViewConnection}
            onBack={handleBackFromConnectionList}
            onAddAccount={handleAddAccount}
          />
        </div>
      </div>
    );
  }

  // Render platform selection (default view)
  return (
    <div className="eg-social-media">
      <div className="eg-social-media-scroll">
        {/* Hero Section */}
        <div className="social-media-hero">
          <div className="hero-content">
            <div className="hero-badge">
              <FontAwesomeIcon icon={faRocket} />
              <span>EG Social Media</span>
            </div>
            <h1>{hasConnections ? 'Add New Social Platform' : 'Connect Your Social Media'}</h1>
            <p>
              {hasConnections 
                ? 'Add another social media platform to your collection or manage your existing connections'
                : 'Seamlessly integrate with your favorite social media platforms and unlock powerful automation features'
              }
            </p>
            <div className="hero-actions">
              {hasConnections && (
                <button className="view-connections-btn" onClick={handleShowConnectionList}>
                  <FontAwesomeIcon icon={faArrowRight} />
                  <span>See my accounts</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Platform Selection */}
        <SocialMediaConnector 
          onShowConnectionList={handleShowConnectionList}
        />
      </div>
    </div>
  );
};

export default EGSocialMedia;

