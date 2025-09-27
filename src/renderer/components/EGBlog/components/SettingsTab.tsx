import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrash, 
  faDownload, 
  faCheckCircle,
  faInfoCircle,
  faDatabase,
  faUndo,
  faSave
} from '../../../utils/fontAwesomeIcons';
import './SettingsTab.css';


interface WordPressConnection {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
}


interface SettingsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: string;
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
  const [currentConnection, setCurrentConnection] = useState<WordPressConnection | null>(null);
  

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      // Load current connection by ID
      if (window.electron?.wordpress) {
        const connectionsResult = await window.electron.wordpress.getConnections();
        if (connectionsResult.success && connectionsResult.connections) {
          const connection = connectionsResult.connections.find(conn => conn.id === connectionId);
          setCurrentConnection(connection || null);
        }
      }


    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };


  const updateConnection = async (updates: Partial<WordPressConnection>) => {
    try {
      if (!window.electron?.wordpress) {
        throw new Error('WordPress API not available');
      }

      const result = await window.electron.wordpress.updateConnection(connectionId, updates);
      
      if (result.success && result.connection) {
        setCurrentConnection(result.connection);
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
    if (!window.confirm(
      'Are you sure you want to delete this connection?\n\n' +
      'This will:\n' +
      '• Delete the connection settings\n' +
      '• Remove all synced posts, media, and comments for this connection\n' +
      '• Clear sync history for this connection\n\n' +
      'This action cannot be undone!'
    )) {
      return;
    }

    try {
      setIsLoading(true);
      setMessage({ type: 'info', text: 'Deleting connection and clearing data...' });

      if (!window.electron?.wordpress) {
        throw new Error('WordPress API not available');
      }

      // Step 1: Clear WordPress data for this specific connection
      const clearResult = await window.electron.wordpress.clearSiteData(connectionId);
      if (!clearResult.success) {
        console.warn('Failed to clear site data:', clearResult.error);
        // Continue with deletion even if data clearing fails
      }

      // Step 2: Delete the connection
      const result = await window.electron.wordpress.deleteConnection(connectionId);
      
      if (result.success) {
        setCurrentConnection(null);
        setMessage({ type: 'success', text: 'Connection and all associated data deleted successfully' });
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

    await updateConnection(currentConnection);
  };

  const resetConnection = () => {
    // Reload the original connection data
    loadSettings();
  };

  const exportConnection = () => {
    if (!currentConnection) return;

    try {
      const dataStr = JSON.stringify(currentConnection, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wordpress-connection-${currentConnection.name || 'backup'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Connection exported successfully' });
    } catch (error) {
      console.error('Failed to export connection:', error);
      setMessage({ type: 'error', text: 'Failed to export connection' });
    }
  };




  const renderConnection = () => (
    <div className="eg-blog-settings-section">
        <div className="eg-blog-settings-connection">
          <div className="eg-blog-settings-connection-header">
            <h5>Connection Settings</h5>
            <div className="eg-blog-settings-connection-actions">
              <button
                className="eg-blog-settings-btn eg-blog-settings-btn-primary"
                onClick={saveConnection}
              >
                <FontAwesomeIcon icon={faSave} />
                Save Changes
              </button>
              <button
                className="eg-blog-settings-btn eg-blog-settings-btn-secondary"
                onClick={resetConnection}
              >
                <FontAwesomeIcon icon={faUndo} />
                Reset
              </button>
            </div>
          </div>

          <div className="eg-blog-settings-connection-content">
            <div className="eg-blog-settings-connection-editor">
              <div className="eg-blog-settings-connection-form">
                <div className="eg-blog-settings-field">
                  <label htmlFor="connection-name">Connection Name</label>
                  <input
                    id="connection-name"
                    type="text"
                    value={currentConnection?.name || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter connection name"
                  />
                </div>
                <div className="eg-blog-settings-field">
                  <label htmlFor="connection-url">WordPress URL</label>
                  <input
                    id="connection-url"
                    type="url"
                    value={currentConnection?.url || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, url: e.target.value } : null)}
                    placeholder="https://yoursite.com"
                  />
                </div>
                <div className="eg-blog-settings-field">
                  <label htmlFor="connection-username">Username</label>
                  <input
                    id="connection-username"
                    type="text"
                    value={currentConnection?.username || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, username: e.target.value } : null)}
                    placeholder="WordPress username"
                  />
                </div>
                <div className="eg-blog-settings-field">
                  <label htmlFor="connection-password">Password</label>
                  <input
                    id="connection-password"
                    type="password"
                    value={currentConnection?.password || ''}
                    onChange={(e) => setCurrentConnection(prev => prev ? { ...prev, password: e.target.value } : null)}
                    placeholder="WordPress password or app password"
                  />
                </div>
                
                <div className="eg-blog-settings-delete-section">
                  <button
                    className="eg-blog-settings-delete-btn"
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
  );


  return (
    <div className="eg-blog-settings-tab">

      {message && (
        <div className={`eg-blog-settings-message eg-blog-settings-message-${message.type}`}>
          <FontAwesomeIcon 
            icon={message.type === 'success' ? faCheckCircle : faInfoCircle} 
          />
          {message.text}
        </div>
      )}

      <div className="eg-blog-settings-content">
        {renderConnection()}
      </div>
    </div>
  );
};

export default SettingsTab;
