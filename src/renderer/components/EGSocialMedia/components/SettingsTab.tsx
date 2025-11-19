import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrash, 
  faCheckCircle,
  faInfoCircle,
  faUndo,
  faSave
} from '../../../utils/fontAwesomeIcons';
import '../SocialMediaConnectionDashboard.css';

interface SocialMediaConnection {
  id: string;
  name: string;
  type: 'instagram' | 'facebook' | 'youtube';
  username: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SettingsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: 'instagram' | 'facebook' | 'youtube';
  onStatsUpdate?: () => void;
  onConnectionDeleted?: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate,
  onConnectionDeleted
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Current connection state
  const [currentConnection, setCurrentConnection] = useState<SocialMediaConnection | null>(null);

  useEffect(() => {
    loadSettings();
  }, [connectionId, connectionType]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      // Load current connection by ID based on connection type
      let connection = null;
      
      if (connectionType === 'instagram' && window.electron?.instagram) {
        const connectionsResult = await window.electron.instagram.getConnections();
        if (connectionsResult.success && connectionsResult.connections) {
          connection = connectionsResult.connections.find(conn => conn.id === connectionId);
        }
      } else if (connectionType === 'facebook' && window.electron?.facebook) {
        const connectionsResult = await window.electron.facebook.getConnections();
        if (connectionsResult.success && connectionsResult.connections) {
          connection = connectionsResult.connections.find(conn => conn.id === connectionId);
        }
      } else if (connectionType === 'youtube' && window.electron?.youtube) {
        const connectionsResult = await window.electron.youtube.getConnections();
        if (connectionsResult.success && connectionsResult.connections) {
          connection = connectionsResult.connections.find(conn => conn.id === connectionId);
        }
      }
      
      if (connection) {
        setCurrentConnection({
          id: connection.id || connectionId,
          name: connection.name || connectionName,
          type: connectionType,
          username: connection.username || '',
          password: connection.password || '',
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
        });
      }

    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConnection = async (updates: Partial<SocialMediaConnection>) => {
    try {
      let result;
      
      if (connectionType === 'instagram' && window.electron?.instagram) {
        result = await window.electron.instagram.updateConnection(connectionId, updates);
      } else if (connectionType === 'facebook' && window.electron?.facebook) {
        result = await window.electron.facebook.updateConnection(connectionId, updates);
      } else if (connectionType === 'youtube' && window.electron?.youtube) {
        result = await window.electron.youtube.updateConnection(connectionId, updates);
      } else {
        throw new Error(`${connectionType} API not available`);
      }
      
      if (result.success && result.connection) {
        setCurrentConnection({
          id: result.connection.id || connectionId,
          name: result.connection.name || '',
          type: connectionType,
          username: result.connection.username || '',
          password: result.connection.password || '',
          createdAt: result.connection.createdAt,
          updatedAt: result.connection.updatedAt,
        });
        setMessage({ type: 'success', text: 'Connection updated successfully' });
        onStatsUpdate?.();
        return true;
      } else {
        throw new Error(result.error || 'Failed to update connection');
      }
    } catch (error) {
      console.error('Failed to update connection:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update connection' 
      });
      return false;
    }
  };

  const deleteConnection = async () => {
    const confirmMessage = `Are you sure you want to delete this ${connectionType} connection?\n\n` +
      'This will:\n' +
      '• Delete the connection settings\n' +
      '• Remove all scheduled posts for this connection\n\n' +
      'This action cannot be undone!';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      setMessage({ type: 'info', text: 'Deleting connection...' });

      let result;

      if (connectionType === 'instagram' && window.electron?.instagram) {
        result = await window.electron.instagram.deleteConnection(connectionId);
      } else if (connectionType === 'facebook' && window.electron?.facebook) {
        result = await window.electron.facebook.deleteConnection(connectionId);
      } else if (connectionType === 'youtube' && window.electron?.youtube) {
        result = await window.electron.youtube.deleteConnection(connectionId);
      } else {
        throw new Error(`${connectionType} API not available`);
      }
      
      if (result.success) {
        setCurrentConnection(null);
        setMessage({ type: 'success', text: 'Connection deleted successfully' });
        onStatsUpdate?.();
        
        // Navigate back to connection list after successful deletion
        setTimeout(() => {
          onConnectionDeleted?.();
        }, 1500); // Give user time to see the success message
      } else {
        throw new Error(result.error || 'Failed to delete connection');
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to delete connection' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConnection = async () => {
    if (!currentConnection) return;

    await updateConnection({
      name: currentConnection.name,
      username: currentConnection.username,
      password: currentConnection.password,
    });
  };

  const resetConnection = () => {
    // Reload the original connection data
    loadSettings();
  };

  const getConnectionTypeLabel = () => {
    switch (connectionType) {
      case 'instagram':
        return 'Instagram';
      case 'facebook':
        return 'Facebook';
      case 'youtube':
        return 'YouTube';
      default:
        return connectionType;
    }
  };

  const renderConnection = () => (
    <div className="social-media-connection-dashboard-tab-content">
      <div className="social-media-settings-section">
        <div className="social-media-settings-connection">
          <div className="social-media-settings-connection-header">
            <h5>Account Information</h5>
            <div className="social-media-settings-connection-actions">
              <button
                className="social-media-settings-btn social-media-settings-btn-primary"
                onClick={saveConnection}
                disabled={isLoading || !currentConnection}
              >
                <FontAwesomeIcon icon={faSave} />
                Save Changes
              </button>
              <button
                className="social-media-settings-btn social-media-settings-btn-secondary"
                onClick={resetConnection}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faUndo} />
                Reset
              </button>
            </div>
          </div>

          <div className="social-media-settings-connection-content">
            <div className="social-media-settings-connection-editor">
              <div className="social-media-settings-connection-form">
                <div className="social-media-settings-field">
                  <label htmlFor="connection-name">Connection Name</label>
                  <input
                    id="connection-name"
                    type="text"
                    value={currentConnection?.name || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder={`Enter ${getConnectionTypeLabel()} connection name`}
                    disabled={isLoading}
                  />
                </div>
                <div className="social-media-settings-field">
                  <label htmlFor="connection-username">Username</label>
                  <input
                    id="connection-username"
                    type="text"
                    value={currentConnection?.username || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, username: e.target.value } : null)}
                    placeholder={`${getConnectionTypeLabel()} username`}
                    disabled={isLoading}
                  />
                </div>
                <div className="social-media-settings-field">
                  <label htmlFor="connection-password">Password</label>
                  <input
                    id="connection-password"
                    type="password"
                    value={currentConnection?.password || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, password: e.target.value } : null)}
                    placeholder={`${getConnectionTypeLabel()} password`}
                    disabled={isLoading}
                  />
                </div>
                
                {currentConnection?.createdAt && (
                  <div className="social-media-settings-info">
                    <div className="social-media-settings-info-item">
                      <strong>Created:</strong> {new Date(currentConnection.createdAt).toLocaleString()}
                    </div>
                    {currentConnection.updatedAt && (
                      <div className="social-media-settings-info-item">
                        <strong>Last Updated:</strong> {new Date(currentConnection.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="social-media-settings-delete-section">
                  <button
                    className="social-media-settings-delete-btn"
                    onClick={deleteConnection}
                    disabled={isLoading}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    {isLoading ? 'Deleting...' : 'Delete Connection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading && !currentConnection) {
    return (
      <div className="social-media-connection-dashboard-tab-content">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading connection settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-media-connection-dashboard-tab-content">
      {message && (
        <div className={`social-media-settings-message social-media-settings-message-${message.type}`}>
          <FontAwesomeIcon 
            icon={message.type === 'success' ? faCheckCircle : faInfoCircle} 
          />
          {message.text}
        </div>
      )}

      {currentConnection ? renderConnection() : (
        <div className="social-media-settings-empty-state">
          <p>Connection not found. Please try refreshing or go back to the connection list.</p>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;

