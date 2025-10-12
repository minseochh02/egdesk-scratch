// Gmail MCP Handler - IPC handlers for Gmail MCP operations
import { ipcMain } from 'electron';
import { GmailMCPFetcher } from './gmail-service';
import { GmailConnection } from '../../../types/gmail-types';
import { getStore } from '../../../storage';

// Store active fetcher instances
const fetcherInstances = new Map<string, GmailMCPFetcher>();

/**
 * Get or create a Gmail MCP fetcher instance for a connection
 */
async function getFetcherInstance(connectionId: string, connection?: GmailConnection): Promise<GmailMCPFetcher> {
  if (!fetcherInstances.has(connectionId)) {
    if (!connection) {
      throw new Error('Connection not found');
    }
    const fetcher = new GmailMCPFetcher(connection);
    // Wait for initialization to complete
    await fetcher.waitForInitialization();
    fetcherInstances.set(connectionId, fetcher);
  }
  return fetcherInstances.get(connectionId)!;
}

/**
 * Get connection by ID from MCP configuration store
 */
async function getConnectionById(connectionId: string): Promise<GmailConnection | null> {
  try {
    // Get the connection from MCP configuration store
    const store = getStore();
    
    const config = store.get('mcpConfiguration', { connections: [] });
    const connections = config.connections || [];
    const connection = connections.find((conn: any) => conn.id === connectionId);
    
    if (!connection) {
      console.error('Connection not found:', connectionId);
      console.error('Available connections:', connections.map((c: any) => c.id));
      return null;
    }
    
    return connection as GmailConnection;
  } catch (error) {
    console.error('Error getting connection:', error);
    return null;
  }
}

/**
 * Register Gmail MCP IPC handlers
 */
export function registerGmailMCPHandlers() {
  // Fetch all domain users
  ipcMain.handle('gmail-mcp-fetch-domain-users', async (event, connectionId: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const users = await fetcher.fetchAllDomainUsers();
      
      return { success: true, users };
    } catch (error) {
      console.error('Error fetching domain users:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Fetch Gmail messages for a specific user
  ipcMain.handle('gmail-mcp-fetch-user-messages', async (event, connectionId: string, userEmail: string, options?: any) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const messages = await fetcher.fetchUserMessages(userEmail, options);
      
      return { success: true, messages };
    } catch (error) {
      console.error('Error fetching user Gmail messages:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Fetch Gmail messages - DISABLED: Method not available in current GmailMCPFetcher
  // ipcMain.handle('gmail-mcp-fetch-messages', async (event, connectionId: string, options?: any) => {
  //   try {
  //     const connection = await getConnectionById(connectionId);
  //     if (!connection) {
  //       return { success: false, error: 'Connection not found' };
  //     }

  //     const fetcher = getFetcherInstance(connectionId, connection);
  //     const messages = await fetcher.fetchMessages(options);
      
  //     return { success: true, messages };
  //   } catch (error) {
  //     console.error('Error fetching Gmail messages:', error);
  //     return { 
  //       success: false, 
  //       error: error instanceof Error ? error.message : 'Unknown error' 
  //     };
  //   }
  // });

  // Fetch Gmail statistics for a specific user
  ipcMain.handle('gmail-mcp-fetch-user-stats', async (event, connectionId: string, userEmail: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const stats = await fetcher.fetchUserStats(userEmail);
      
      return { success: true, stats };
    } catch (error) {
      console.error('Error fetching user Gmail stats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Fetch Gmail statistics - DISABLED: Method not available in current GmailMCPFetcher
  // ipcMain.handle('gmail-mcp-fetch-stats', async (event, connectionId: string) => {
  //   try {
  //     const connection = await getConnectionById(connectionId);
  //     if (!connection) {
  //       return { success: false, error: 'Connection not found' };
  //     }

  //     const fetcher = getFetcherInstance(connectionId, connection);
  //     const stats = await fetcher.fetchStats();
      
  //     return { success: true, stats };
  //   } catch (error) {
  //     console.error('Error fetching Gmail stats:', error);
  //     return { 
  //       success: false, 
  //       error: error instanceof Error ? error.message : 'Unknown error' 
  //     };
  //   }
  // });

  // Mark message as read
  ipcMain.handle('gmail-mcp-mark-as-read', async (event, connectionId: string, messageId: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const success = await fetcher.markAsRead(messageId);
      
      return { success };
    } catch (error) {
      console.error('Error marking message as read:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Delete message
  ipcMain.handle('gmail-mcp-delete-message', async (event, connectionId: string, messageId: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const success = await fetcher.deleteMessage(messageId);
      
      return { success };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Send reply
  ipcMain.handle('gmail-mcp-send-reply', async (event, connectionId: string, messageId: string, replyText: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const success = await fetcher.sendReply(messageId, replyText);
      
      return { success };
    } catch (error) {
      console.error('Error sending reply:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Forward message
  ipcMain.handle('gmail-mcp-forward-message', async (event, connectionId: string, messageId: string, toEmail: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const success = await fetcher.forwardMessage(messageId, toEmail);
      
      return { success };
    } catch (error) {
      console.error('Error forwarding message:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Search messages
  ipcMain.handle('gmail-mcp-search-messages', async (event, connectionId: string, query: string, maxResults?: number) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const messages = await fetcher.searchMessages(query, maxResults);
      
      return { success: true, messages };
    } catch (error) {
      console.error('Error searching messages:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get specific message
  ipcMain.handle('gmail-mcp-get-message', async (event, connectionId: string, messageId: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const message = await fetcher.getMessage(messageId);
      
      return { success: true, message };
    } catch (error) {
      console.error('Error getting message:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Save user data to database
  ipcMain.handle('gmail-mcp-save-user-data', async (event, connectionId: string, userEmail: string, messageRecords: any[], statsRecord: any) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      await fetcher.saveUserDataToDatabase(userEmail, messageRecords, statsRecord);
      
      return { success: true };
    } catch (error) {
      console.error('Error saving user data to database:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Test connection
  ipcMain.handle('gmail-mcp-test-connection', async (event, connectionId: string) => {
    try {
      const connection = await getConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      const fetcher = await getFetcherInstance(connectionId, connection);
      const isConnected = await fetcher.testConnection();
      
      return { success: isConnected };
    } catch (error) {
      console.error('Error testing connection:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  console.log('Gmail MCP handlers registered');
}

/**
 * Clean up fetcher instances
 */
export function cleanupFetcherInstances() {
  fetcherInstances.clear();
}
