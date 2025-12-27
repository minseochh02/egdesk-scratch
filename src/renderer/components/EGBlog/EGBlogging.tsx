import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faArrowLeft, faArrowRight, faWordpress } from '../../utils/fontAwesomeIcons';
import BlogConnector from './BlogConnector';
import ConnectionList from './ConnectionList';
import ConnectionDashboard from './ConnectionDashboard';
import tistoryIcon from '../../../../assets/tistory.svg';
import naverblogIcon from '../../../../assets/naverblog.svg';
import './EGBlogging.css';

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

type ViewMode = 'platform-selection' | 'connection-list' | 'connection-dashboard';

/**
 * Helper function to log activities to the activity log system
 */
const logActivity = async (
  type: string,
  action: string,
  status: 'success' | 'failure' | 'pending' | 'info',
  options?: {
    target?: string;
    details?: any;
    errorMessage?: string;
  }
): Promise<void> => {
  try {
    if (window.electron?.invoke) {
      await window.electron.invoke('sqlite-activity-create', {
        type,
        action,
        status,
        target: options?.target,
        details: options?.details,
        errorMessage: options?.errorMessage,
      });
    }
  } catch (error) {
    // Silently fail - don't let logging errors break the app
    console.warn('Failed to log activity:', error);
  }
};

const EGBlogging: React.FC = () => {
  const location = useLocation();
  const [currentView, setCurrentView] = useState<ViewMode>('platform-selection');
  const [editingConnection, setEditingConnection] = useState<BlogConnection | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<BlogConnection | null>(null);
  const [hasConnections, setHasConnections] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initialTab, setInitialTab] = useState<'scheduled' | 'posts' | 'media' | 'comments' | 'settings' | undefined>(undefined);

  // Function to load a specific connection by ID and type
  const loadConnectionById = async (connectionId: string, connectionType: string): Promise<BlogConnection | null> => {
    await logActivity('system', 'load_connection_by_id', 'pending', {
      target: connectionId,
      details: { connectionType }
    });

    try {
      if (connectionType === 'wordpress' || connectionType === 'WordPress') {
        const wpResult = await window.electron.wordpress.getConnections();
        if (wpResult.success && wpResult.connections) {
          const connection = wpResult.connections.find(conn => conn.id === connectionId);
          if (connection) {
            await logActivity('system', 'load_connection_by_id', 'success', {
              target: connectionId,
              details: { connectionType, connectionName: connection.name }
            });
            return {
              ...connection,
              type: 'wordpress' as const
            };
          }
        }
      } else if (connectionType === 'naver' || connectionType === 'Naver Blog' || connectionType === 'Naver') {
        // TODO: Implement Naver connections loading
        const naverResult = await window.electron.naver?.getConnections();
        if (naverResult?.success && naverResult.connections) {
          const connection = naverResult.connections.find(conn => conn.id === connectionId);
          if (connection) {
            await logActivity('system', 'load_connection_by_id', 'success', {
              target: connectionId,
              details: { connectionType, connectionName: connection.name }
            });
            return {
              id: connection.id || '',
              name: connection.name,
              username: connection.username,
              password: connection.password,
              url: 'https://blog.naver.com', // Default Naver Blog URL
              type: 'naver' as const,
              createdAt: connection.createdAt || new Date().toISOString(),
              updatedAt: connection.updatedAt || new Date().toISOString(),
            };
          }
        }
      } else if (connectionType === 'tistory' || connectionType === 'Tistory') {
        // TODO: Implement Tistory connections loading
      }
      
      await logActivity('system', 'load_connection_by_id', 'failure', {
        target: connectionId,
        errorMessage: 'Connection not found',
        details: { connectionType }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load connection:', err);
      await logActivity('error', 'load_connection_by_id', 'failure', {
        target: connectionId,
        errorMessage,
        details: { connectionType, stack: err instanceof Error ? err.stack : undefined }
      });
    }
    return null;
  };

  // Function to refresh connection check (can be called from child components)
  const checkExistingConnections = async () => {
    await logActivity('system', 'check_existing_connections', 'pending');
    
    try {
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
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('Failed to load WordPress connections:', err);
        await logActivity('error', 'load_wordpress_connections', 'failure', {
          errorMessage,
          details: { platform: 'wordpress' }
        });
      }
      
      // Load Naver connections (placeholder - you'll need to implement this)
      try {
        // TODO: Implement Naver connections loading
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('Failed to load Naver connections:', err);
        await logActivity('error', 'load_naver_connections', 'failure', {
          errorMessage,
          details: { platform: 'naver' }
        });
      }
      
      // Load Tistory connections (placeholder - you'll need to implement this)
      try {
        // TODO: Implement Tistory connections loading
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('Failed to load Tistory connections:', err);
        await logActivity('error', 'load_tistory_connections', 'failure', {
          errorMessage,
          details: { platform: 'tistory' }
        });
      }
      
      const hasAnyConnections = allConnections.length > 0;
      setHasConnections(hasAnyConnections);
      
      // If user has connections, show the connection list by default
      if (hasAnyConnections) {
        setCurrentView('connection-list');
      } else {
        setCurrentView('platform-selection');
      }
      
      await logActivity('system', 'check_existing_connections', 'success', {
        details: {
          totalConnections: allConnections.length,
          wordpressCount: allConnections.filter(c => c.type === 'wordpress').length,
          naverCount: allConnections.filter(c => c.type === 'naver').length,
          tistoryCount: allConnections.filter(c => c.type === 'tistory').length
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to check existing connections:', err);
      await logActivity('error', 'check_existing_connections', 'failure', {
        errorMessage,
        details: { stack: err instanceof Error ? err.stack : undefined }
      });
    }
  };

  // Check for existing connections on component mount and handle navigation from location state
  useEffect(() => {
    const loadConnections = async () => {
      await logActivity('system', 'egblogging_component_mount', 'pending');
      
      try {
        setIsLoading(true);
        
        // Check if location state has connection info (from Business Identity navigation)
        const locationState = location.state as { connectionId?: string; connectionName?: string; connectionType?: string; activeTab?: 'scheduled' | 'posts' | 'media' | 'comments' | 'settings' } | null;
        
        if (locationState?.connectionId && locationState?.connectionType) {
          await logActivity('user', 'navigate_to_connection', 'pending', {
            target: locationState.connectionId,
            details: {
              connectionType: locationState.connectionType,
              connectionName: locationState.connectionName,
              activeTab: locationState.activeTab,
              source: 'business_identity'
            }
          });
          
          // Try to load the specific connection
          const connection = await loadConnectionById(locationState.connectionId, locationState.connectionType);
          if (connection) {
            setSelectedConnection(connection);
            setCurrentView('connection-dashboard');
            // Set initial tab if provided, default to 'scheduled'
            setInitialTab(locationState.activeTab || 'scheduled');
            setIsLoading(false);
            
            await logActivity('user', 'navigate_to_connection', 'success', {
              target: locationState.connectionId,
              details: {
                connectionType: locationState.connectionType,
                connectionName: connection.name,
                activeTab: locationState.activeTab || 'scheduled'
              }
            });
            return;
          } else {
            await logActivity('user', 'navigate_to_connection', 'failure', {
              target: locationState.connectionId,
              errorMessage: 'Connection not found',
              details: { connectionType: locationState.connectionType }
            });
          }
        }
        
        // Otherwise, load all connections normally
        await checkExistingConnections();
        
        await logActivity('system', 'egblogging_component_mount', 'success');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await logActivity('error', 'egblogging_component_mount', 'failure', {
          errorMessage,
          details: { stack: err instanceof Error ? err.stack : undefined }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadConnections();
  }, [location.state]);

  const handleShowConnectionList = () => {
    logActivity('user', 'show_connection_list', 'info', {
      details: { view: 'connection-list' }
    });
    setCurrentView('connection-list');
  };

  const handleBackFromConnectionList = () => {
    logActivity('user', 'navigate_back', 'info', {
      details: { from: 'connection-list', to: 'platform-selection' }
    });
    setCurrentView('platform-selection');
  };

  const handleViewConnection = (connection: BlogConnection) => {
    logActivity('user', 'view_connection', 'info', {
      target: connection.id,
      details: {
        connectionName: connection.name,
        connectionType: connection.type
      }
    });
    setSelectedConnection(connection);
    setCurrentView('connection-dashboard');
  };

  const handleBackFromDashboard = () => {
    logActivity('user', 'navigate_back', 'info', {
      target: selectedConnection?.id,
      details: {
        from: 'connection-dashboard',
        to: 'connection-list',
        connectionName: selectedConnection?.name
      }
    });
    setSelectedConnection(null);
    setCurrentView('connection-list');
  };

  const handleTestConnection = async (connection: BlogConnection) => {
    await logActivity('user', 'test_connection', 'pending', {
      target: connection.id,
      details: {
        connectionName: connection.name,
        connectionType: connection.type
      }
    });
    
    console.log('Testing connection:', connection.name);
    // TODO: Implement actual connection testing
    try {
      alert(`Testing connection to ${connection.name}...`);
      // When actual testing is implemented, log success/failure here
      await logActivity('user', 'test_connection', 'info', {
        target: connection.id,
        details: {
          connectionName: connection.name,
          connectionType: connection.type,
          note: 'Connection test not yet implemented'
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await logActivity('user', 'test_connection', 'failure', {
        target: connection.id,
        errorMessage,
        details: {
          connectionName: connection.name,
          connectionType: connection.type
        }
      });
    }
  };

  const handleRefreshDashboard = () => {
    logActivity('user', 'refresh_dashboard', 'info', {
      target: selectedConnection?.id,
      details: {
        connectionName: selectedConnection?.name,
        connectionType: selectedConnection?.type
      }
    });
    // TODO: Implement dashboard refresh logic
    console.log('Refreshing dashboard...');
  };

  const handleEditConnection = (connection: BlogConnection) => {
    logActivity('user', 'edit_connection', 'info', {
      target: connection.id,
      details: {
        connectionName: connection.name,
        connectionType: connection.type
      }
    });
    setEditingConnection(connection);
    // This will be handled by BlogConnector
  };

  const handleDeleteConnection = (connectionId: string) => {
    logActivity('user', 'delete_connection', 'pending', {
      target: connectionId,
      details: { action: 'initiated' }
    });
    console.log('Delete connection:', connectionId);
    // The ConnectionList component handles the actual deletion
    // After deletion, check if we still have connections
    setTimeout(() => {
      checkExistingConnections();
    }, 1000);
  };

  // Show loading state while checking for connections
  if (isLoading) {
    return (
      <div className="eg-blogging">
        <div className="eg-blogging-scroll">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your blog connections...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render connection dashboard
  if (currentView === 'connection-dashboard' && selectedConnection) {
    return (
      <div className="eg-blogging connection-dashboard-view">
        <div className="eg-blogging-scroll">
          <ConnectionDashboard
            connection={selectedConnection}
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
      <div className="eg-blogging connection-list-view">
        <div className="eg-blogging-scroll">
          <ConnectionList
            onEdit={() => {}}
            onDelete={() => {}}
            onConnect={handleViewConnection}
            onView={handleViewConnection}
            onBack={handleBackFromConnectionList}
          />
        </div>
      </div>
    );
  }


  // Render platform selection (default view)
  return (
    <div className="eg-blogging">
      <div className="eg-blogging-scroll">
        {/* Hero Section */}
        <div className="blogging-hero">
          <div className="hero-content">
            <div className="hero-badge">
              <FontAwesomeIcon icon={faRocket} />
              <span>EG Blogging</span>
            </div>
            <h1>{hasConnections ? 'Add New Blog Platform' : 'Connect Your Blog Platform'}</h1>
            <p>
              {hasConnections 
                ? 'Add another blog platform to your collection or manage your existing connections'
                : 'Seamlessly integrate with your favorite blogging platform and unlock powerful automation features'
              }
            </p>
            <div className="hero-actions">
              {hasConnections && (
                <button className="view-connections-btn" onClick={handleShowConnectionList}>
                  <FontAwesomeIcon icon={faArrowRight} />
                  <span>See my blogs</span>
                </button>
              )}
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-cards">
              <div className="floating-card card-1">
                <FontAwesomeIcon icon={faWordpress} />
              </div>
              <div className="floating-card card-2">
                <img src={naverblogIcon} alt="Naver Blog" style={{ width: '24px', height: '24px' }} />
              </div>
              <div className="floating-card card-3">
                <img src={tistoryIcon} alt="Tistory" style={{ width: '24px', height: '24px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Platform Selection - Use BlogConnector with navigation handlers */}
        <BlogConnector 
          onShowConnectionList={handleShowConnectionList}
          onConnectionCreated={checkExistingConnections}
        />
      </div>
    </div>
  );
};

export default EGBlogging;
