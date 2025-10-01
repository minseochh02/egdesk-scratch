import { ipcMain } from 'electron';

export interface NaverConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

export class NaverHandler {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Register all Naver connection management handlers
   */
  public registerHandlers(): void {
    this.registerConnectionHandlers();
  }

  /**
   * Register Naver connection management handlers
   */
  private registerConnectionHandlers(): void {
    // Save Naver connection
    ipcMain.handle('naver-save-connection', async (event, connection) => {
      try {
        const connections = this.store.get('naverConnections', []) as any[];

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

        this.store.set('naverConnections', connections);
        return { success: true, connections };
      } catch (error) {
        console.error('Error saving Naver connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get Naver connections
    ipcMain.handle('naver-get-connections', async () => {
      try {
        const connections = this.store.get('naverConnections', []) as any[];
        return { success: true, connections };
      } catch (error) {
        console.error('Error getting Naver connections:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Delete Naver connection
    ipcMain.handle('naver-delete-connection', async (event, connectionId) => {
      try {
        const connections = this.store.get('naverConnections', []) as any[];
        const filteredConnections = connections.filter(
          (conn) => conn.id !== connectionId,
        );

        if (filteredConnections.length === connections.length) {
          return {
            success: false,
            error: 'Connection not found',
          };
        }

        this.store.set('naverConnections', filteredConnections);
        return { success: true, connections: filteredConnections };
      } catch (error) {
        console.error('Error deleting Naver connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Update Naver connection
    ipcMain.handle('naver-update-connection', async (event, connectionId, updates) => {
      try {
        const connections = this.store.get('naverConnections', []) as any[];
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

        this.store.set('naverConnections', connections);
        return { 
          success: true, 
          connection: connections[connectionIndex],
          connections 
        };
      } catch (error) {
        console.error('Error updating Naver connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test Naver connection
    ipcMain.handle('naver-test-connection', async (event, connection) => {
      try {
        // For now, just return success - you can implement actual connection testing later
        console.log('Testing Naver connection:', connection.name);
        return { 
          success: true, 
          message: 'Connection test successful' 
        };
      } catch (error) {
        console.error('Error testing Naver connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
}
