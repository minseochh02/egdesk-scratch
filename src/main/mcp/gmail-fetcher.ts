// Gmail MCP Fetcher - Google APIs Implementation
// This file will handle Gmail data fetching through Google APIs

import { GmailMessage, GmailStats, GmailConnection } from '../types/gmail-types';
import { google } from 'googleapis';

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

  constructor(connection: GmailConnection) {
    this.connection = connection;
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
      return users;
    } catch (error) {
      console.error('Error fetching domain users:', error);
      throw new Error(`Failed to fetch domain users: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
