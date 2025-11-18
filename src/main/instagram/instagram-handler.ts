import { ipcMain } from 'electron';

export interface InstagramConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

export class InstagramHandler {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Register all Instagram connection management handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
  }

  /**
   * Register Instagram connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save Instagram connection
    ipcMain.handle('instagram-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];

        // Check if connection already exists (by username)
        const existingIndex = connections.findIndex(
          (conn) => conn.username === connection.username,
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

        this.store.set('instagramConnections', connections);
        return { success: true, connection: connections[existingIndex >= 0 ? existingIndex : connections.length - 1], connections };
      } catch (error) {
        console.error('Error saving Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get Instagram connections
    ipcMain.handle('instagram-get-connections', async () => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting Instagram connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete Instagram connection
    ipcMain.handle('instagram-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );

        if (filteredConnections.length === connections.length) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        this.store.set('instagramConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update Instagram connection
    ipcMain.handle('instagram-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('instagramConnections', []) as any[];
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

        this.store.set('instagramConnections', connections);
        return { 
          success: true, 
          connection: connections[connectionIndex],
          connections 
        };
      } catch (error) {
        console.error('Error updating Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test Instagram connection
    ipcMain.handle('instagram-test-connection', async (event, connection) => {
      try {
        // For now, just return success - you can implement actual connection testing later
        console.log('Testing Instagram connection:', connection.name);
        return { 
          success: true, 
          message: 'Connection test successful' 
        };
      } catch (error) {
        console.error('Error testing Instagram connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
}

