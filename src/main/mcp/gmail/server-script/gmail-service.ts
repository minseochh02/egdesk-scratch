// Gmail MCP Fetcher - Google APIs Implementation
// This file will handle Gmail data fetching through Google APIs
// All data will be saved to sqlite. no mcp will ever attempt to access the google api directly.

import { GmailMessage, GmailStats, GmailConnection } from '../../../types/gmail-types';
import { google } from 'googleapis';
import { GmailDatabase, GmailMessageRecord, GmailStatsRecord, DomainUserRecord } from '../../../sqlite/gmails';

export interface DomainUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  isAdmin: boolean;
  isSuspended: boolean;
  lastLoginTime?: string;
}

export class GmailMCPFetcher {
  private connection: GmailConnection;
  private jwtClient: any;
  private gmail: any;
  private directory: any;
  private database: GmailDatabase;

  constructor(connection: GmailConnection) {
    this.connection = connection;
    this.database = new GmailDatabase();
    this.initializeGoogleClient();
  }

  private async initializeGoogleClient() {
    try {
      console.log('Initializing Google client...');
      console.log('Google object:', google);
      console.log('Google auth:', google.auth);
      
      // Use the service account key from the connection configuration
      const serviceAccountKey = this.connection.serviceAccountKey;
      
      if (!serviceAccountKey || !serviceAccountKey.client_email || !serviceAccountKey.private_key) {
        throw new Error('Invalid service account key in connection configuration');
      }

      console.log('Service account email:', serviceAccountKey.client_email);
      console.log('Admin email for impersonation:', this.connection.adminEmail);

      // Initialize JWT client with domain-wide delegation scopes
      this.jwtClient = new google.auth.JWT({
        email: serviceAccountKey.client_email,
        key: serviceAccountKey.private_key,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/admin.directory.user.readonly'
        ],
        subject: this.connection.adminEmail // This will be the admin user for domain-wide delegation
      });

      console.log('JWT client created, authorizing...');
      await this.jwtClient.authorize();
      
      // Initialize both Gmail and Directory APIs
      this.gmail = google.gmail({ version: 'v1' });
      this.directory = google.admin({ version: 'directory_v1' });
      
      console.log('Gmail API initialized:', !!this.gmail);
      console.log('Directory API initialized:', !!this.directory);
      console.log('Google auth success for domain-wide delegation');
    } catch (err) {
      console.error('Google auth error:', err);
      throw new Error(`Failed to initialize Google client: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all users in the quus.cloud domain
   */
  async fetchAllDomainUsers(): Promise<DomainUser[]> {
    try {
      console.log('Fetching all users in quus.cloud domain...');
      
      if (!this.directory) {
        throw new Error('Directory API not initialized');
      }
      
      const users: DomainUser[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await this.directory.users.list({
          auth: this.jwtClient,
          domain: 'quus.cloud',
          maxResults: 500, // Maximum allowed by API
          pageToken: pageToken,
          orderBy: 'email'
        });

        console.log('Directory API response:', response.data);

        if (response.data && response.data.users) {
          const domainUsers = response.data.users.map((user: any) => ({
            id: user.id,
            email: user.primaryEmail,
            name: user.name?.fullName || user.primaryEmail,
            displayName: user.name?.fullName || user.primaryEmail,
            isAdmin: user.isAdmin || false,
            isSuspended: user.suspended || false,
            lastLoginTime: user.lastLoginTime
          }));
          
          users.push(...domainUsers);
        } else {
          console.log('No users found in response');
        }
        
        pageToken = response.data?.nextPageToken;
      } while (pageToken);

      console.log(`Found ${users.length} users in quus.cloud domain`);

      // Save users to database
      try {
        await this.database.initialize();
        const userRecords: DomainUserRecord[] = users.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          isAdmin: user.isAdmin,
          isSuspended: user.isSuspended,
          lastLoginTime: user.lastLoginTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        await this.database.saveDomainUsers(userRecords);
        console.log('Domain users saved to database');
      } catch (dbError) {
        console.error('Error saving users to database:', dbError);
        // Continue execution even if database save fails
      }

      return users;
    } catch (error) {
      console.error('Error fetching domain users:', error);
      throw new Error(`Failed to fetch domain users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new JWT client for impersonating a specific user
   */
  private createUserJWTClient(userEmail: string) {
    const serviceAccountKey = this.connection.serviceAccountKey;
    
    return new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send'
      ],
      subject: userEmail // Impersonate the specific user
    });
  }

  /**
   * Fetch Gmail messages for a specific user
   */
  async fetchUserMessages(userEmail: string, options: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
    includeSpamTrash?: boolean;
  } = {}): Promise<GmailMessage[]> {
    try {
      console.log(`Fetching Gmail messages for user: ${userEmail}`);
      
      const userJWTClient = this.createUserJWTClient(userEmail);
      await userJWTClient.authorize();
      
      const gmail = google.gmail({ version: 'v1' });
      
      const response = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        maxResults: options.maxResults || 50,
        q: options.query || '',
        labelIds: options.labelIds,
        includeSpamTrash: options.includeSpamTrash || false
      });

      if (!response.data.messages) {
        return [];
      }

      // Fetch detailed message data for each message ID
      const messagePromises = response.data.messages.map(async (msg: any) => {
        return this.getUserMessageDetails(userEmail, userJWTClient, msg.id);
      });

      const messages = await Promise.all(messagePromises);
      const validMessages = messages.filter(msg => msg !== null) as GmailMessage[];

      // Save messages to database
      try {
        await this.database.initialize();
        const messageRecords: GmailMessageRecord[] = validMessages.map(message => ({
          id: message.id,
          userEmail: userEmail,
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
          snippet: message.snippet,
          isRead: message.isRead,
          isImportant: message.isImportant,
          labels: JSON.stringify(message.labels),
          threadId: message.threadId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        await this.database.saveUserMessages(userEmail, messageRecords);
        console.log(`Saved ${validMessages.length} messages to database for ${userEmail}`);
      } catch (dbError) {
        console.error('Error saving messages to database:', dbError);
        // Continue execution even if database save fails
      }

      return validMessages;
    } catch (error) {
      console.error(`Error fetching Gmail messages for ${userEmail}:`, error);
      throw new Error(`Failed to fetch Gmail messages for ${userEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed message information for a specific user
   */
  private async getUserMessageDetails(userEmail: string, userJWTClient: any, messageId: string): Promise<GmailMessage | null> {
    try {
      const gmail = google.gmail({ version: 'v1' });
      
      const response = await gmail.users.messages.get({
        auth: userJWTClient,
        userId: userEmail,
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      const headers = message.payload?.headers || [];
      
      const getHeader = (name: string) => {
        const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };

      const labelIds = message.labelIds || [];

      return {
        id: message.id || '',
        subject: getHeader('Subject') || '',
        from: getHeader('From') || '',
        to: getHeader('To') || '',
        date: new Date(parseInt(message.internalDate || '0')).toISOString(),
        snippet: message.snippet || '',
        isRead: !labelIds.includes('UNREAD'),
        isImportant: labelIds.includes('IMPORTANT'),
        labels: labelIds,
        threadId: message.threadId || ''
      };
    } catch (error) {
      console.error(`Error getting message details for ${userEmail}:`, error);
      return null;
    }
  }

  /**
   * Fetch Gmail statistics for a specific user
   */
  async fetchUserStats(userEmail: string): Promise<GmailStats> {
    try {
      console.log(`Fetching Gmail stats for user: ${userEmail}`);
      
      const userJWTClient = this.createUserJWTClient(userEmail);
      await userJWTClient.authorize();
      
      const gmail = google.gmail({ version: 'v1' });
      
      // Get total messages
      const totalResponse = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        maxResults: 1
      });
      const totalMessages = totalResponse.data.resultSizeEstimate || 0;

      // Get unread messages
      const unreadResponse = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        labelIds: ['UNREAD'],
        maxResults: 1
      });
      const unreadMessages = unreadResponse.data.resultSizeEstimate || 0;

      // Get important messages
      const importantResponse = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        labelIds: ['IMPORTANT'],
        maxResults: 1
      });
      const importantMessages = importantResponse.data.resultSizeEstimate || 0;

      // Get sent messages
      const sentResponse = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        labelIds: ['SENT'],
        maxResults: 1
      });
      const sentMessages = sentResponse.data.resultSizeEstimate || 0;

      // Get recent activity (messages from last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const recentResponse = await gmail.users.messages.list({
        auth: userJWTClient,
        userId: userEmail,
        q: `after:${Math.floor(yesterday.getTime() / 1000)}`,
        maxResults: 1
      });
      const recentActivity = recentResponse.data.resultSizeEstimate || 0;

      const stats: GmailStats = {
        totalMessages,
        unreadMessages,
        importantMessages,
        sentMessages,
        recentActivity
      };

      // Save stats to database
      try {
        await this.database.initialize();
        const statsRecord: GmailStatsRecord = {
          id: `stats-${userEmail}-${Date.now()}`,
          userEmail: userEmail,
          totalMessages: stats.totalMessages,
          unreadMessages: stats.unreadMessages,
          importantMessages: stats.importantMessages,
          sentMessages: stats.sentMessages,
          recentActivity: stats.recentActivity,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await this.database.saveUserStats(userEmail, statsRecord);
        console.log(`Saved Gmail stats to database for ${userEmail}`);
      } catch (dbError) {
        console.error('Error saving stats to database:', dbError);
        // Continue execution even if database save fails
      }

      return stats;
    } catch (error) {
      console.error(`Error fetching Gmail stats for ${userEmail}:`, error);
      throw new Error(`Failed to fetch Gmail stats for ${userEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save user data to SQLite database
   */
  async saveUserDataToDatabase(userEmail: string, messageRecords: GmailMessageRecord[], statsRecord: GmailStatsRecord): Promise<void> {
    try {
      console.log(`Saving Gmail data for ${userEmail} to SQLite database...`);
      
      await this.database.initialize();
      
      // Save messages
      if (messageRecords.length > 0) {
        await this.database.saveUserMessages(userEmail, messageRecords);
        console.log(`Saved ${messageRecords.length} messages for ${userEmail}`);
      }
      
      // Save stats
      await this.database.saveUserStats(userEmail, statsRecord);
      console.log(`Saved stats for ${userEmail}`);
      
    } catch (error) {
      console.error(`Error saving data for ${userEmail}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to Google APIs
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Google APIs connection...');
      
      // Test by fetching domain users (this tests both Directory API and auth)
      await this.fetchAllDomainUsers();
      
      return true;
    } catch (error) {
      console.error('Error testing Google APIs connection:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'online' | 'offline' | 'error' | 'checking' {
    // TODO: Implement actual status checking
    return 'online';
  }
}

// Export utility functions
export const createGmailFetcher = (connection: GmailConnection): GmailMCPFetcher => {
  return new GmailMCPFetcher(connection);
};

export const validateGmailConnection = (connection: GmailConnection): boolean => {
  return !!(connection.email && connection.serviceAccountKey && connection.id);
};

export const validateDomainUser = (user: DomainUser): boolean => {
  return !!(user.id && user.email && user.name);
};
