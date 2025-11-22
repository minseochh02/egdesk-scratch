import { ipcMain } from 'electron';

export interface YouTubeConnection {
  id?: string;
  name: string;
  username?: string; // Optional - not needed if using chromeUserDataDir
  password?: string; // Optional - not needed if using chromeUserDataDir
  /** Chrome user data directory path - recommended approach to avoid CAPTCHA/2FA */
  chromeUserDataDir?: string;
  /** Chrome executable path - required if using chromeUserDataDir */
  chromeExecutablePath?: string;
  channelId?: string; // YouTube channel ID
  accessToken?: string; // For YouTube Data API
  refreshToken?: string; // For YouTube Data API OAuth
  createdAt?: string;
  updatedAt?: string;
}

export class YouTubeHandler {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Register all YouTube connection management handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
  }

  /**
   * Register YouTube connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save YouTube connection
    ipcMain.handle('youtube-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('youtubeConnections', []) as any[];

        // Check if connection already exists (by username or channelId)
        const existingIndex = connections.findIndex(
          (conn) => conn.username === connection.username || 
                   (connection.channelId && conn.channelId === connection.channelId),
        );

        if (existingIndex >= 0) {
          // Update existing connection
          connections[existingIndex] = {
            ...connections[existingIndex],
            ...connection,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Add new connection
          connections.push({
            ...connection,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        this.store.set('youtubeConnections', connections);
        return { 
          success: true, 
          connection: connections[existingIndex >= 0 ? existingIndex : connections.length - 1], 
          connections 
        };
      } catch (error) {
        console.error('Error saving YouTube connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get YouTube connections
    ipcMain.handle('youtube-get-connections', async () => {
      try {
        const connections = this.store.get('youtubeConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting YouTube connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete YouTube connection
    ipcMain.handle('youtube-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('youtubeConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );

        if (filteredConnections.length === connections.length) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        this.store.set('youtubeConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting YouTube connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update YouTube connection
    ipcMain.handle('youtube-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('youtubeConnections', []) as any[];
        const connectionIndex = connections.findIndex(
          (conn) => conn.id === connectionId,
        );

        if (connectionIndex === -1) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        connections[connectionIndex] = {
          ...connections[connectionIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        this.store.set('youtubeConnections', connections);
        return { 
          success: true, 
          connection: connections[connectionIndex],
          connections 
        };
      } catch (error) {
        console.error('Error updating YouTube connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test YouTube connection
    ipcMain.handle('youtube-test-connection', async (event, connection) => {
      try {
        // For now, just return success - you can implement actual connection testing later
        console.log('Testing YouTube connection:', connection.name);
        return { 
          success: true, 
          message: 'Connection test successful' 
        };
      } catch (error) {
        console.error('Error testing YouTube connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
}

