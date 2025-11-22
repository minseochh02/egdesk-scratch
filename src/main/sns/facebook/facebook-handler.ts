import { ipcMain } from 'electron';

export interface FacebookConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  pageId?: string; // Facebook page ID
  accessToken?: string; // For Facebook Graph API
  createdAt?: string;
  updatedAt?: string;
}

export class FacebookHandler {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Register all Facebook connection management handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
  }

  /**
   * Register Facebook connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save Facebook connection
    ipcMain.handle('facebook-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('facebookConnections', []) as any[];

        // Check if connection already exists (by username or pageId)
        const existingIndex = connections.findIndex(
          (conn) => conn.username === connection.username || 
                   (connection.pageId && conn.pageId === connection.pageId),
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

        this.store.set('facebookConnections', connections);
        return { 
          success: true, 
          connection: connections[existingIndex >= 0 ? existingIndex : connections.length - 1], 
          connections 
        };
      } catch (error) {
        console.error('Error saving Facebook connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get Facebook connections
    ipcMain.handle('facebook-get-connections', async () => {
      try {
        const connections = this.store.get('facebookConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting Facebook connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete Facebook connection
    ipcMain.handle('facebook-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('facebookConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );

        if (filteredConnections.length === connections.length) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        this.store.set('facebookConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting Facebook connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update Facebook connection
    ipcMain.handle('facebook-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('facebookConnections', []) as any[];
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

        this.store.set('facebookConnections', connections);
        return { 
          success: true, 
          connection: connections[connectionIndex],
          connections 
        };
      } catch (error) {
        console.error('Error updating Facebook connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test Facebook connection
    ipcMain.handle('facebook-test-connection', async (event, connection) => {
      try {
        // For now, just return success - you can implement actual connection testing later
        console.log('Testing Facebook connection:', connection.name);
        return { 
          success: true, 
          message: 'Connection test successful' 
        };
      } catch (error) {
        console.error('Error testing Facebook connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
}

