/**
 * Google Sheets Service for Sync Operations
 * Uses Service Account authentication for reliable, automated spreadsheet sync
 * Separate from user-facing SheetsService which uses OAuth
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from '../../storage';

export class SheetsSyncService {
  private jwtClient: OAuth2Client | null = null;
  private sheetsApi: any = null;
  private driveApi: any = null;
  private isInitialized = false;

  constructor() {
    // Initialize with service account credentials
    this.initializeServiceAccount();
  }

  /**
   * Initialize service account authentication for sync operations
   * Now uses edge function to get OAuth tokens instead of storing credentials locally
   */
  private async initializeServiceAccount(): Promise<void> {
    try {
      console.log('🔧 Initializing service account for spreadsheet sync via edge function...');

      // Test getting a service account token
      const tokenResult = await this.getServiceAccountToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]);

      if (!tokenResult) {
        console.warn('⚠️ Unable to get service account token - sync operations will be disabled');
        this.isInitialized = false;
        return;
      }

      // Create OAuth2 client with the token
      const { OAuth2Client } = google.auth;
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials({
        access_token: tokenResult.access_token,
        expiry_date: new Date(tokenResult.expires_at).getTime()
      });

      this.jwtClient = oauth2Client;

      // Initialize Google APIs
      this.sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client });
      this.driveApi = google.drive({ version: 'v3', auth: oauth2Client });

      this.isInitialized = true;
      console.log('✅ Service account initialized for spreadsheet sync via edge function');
    } catch (error) {
      console.error('❌ Failed to initialize service account for spreadsheet sync:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Get service account OAuth token from Supabase edge function
   */
  private async getServiceAccountToken(scopes?: string[]): Promise<{
    access_token: string;
    expires_at: string;
    expires_in: number;
  } | null> {
    try {
      const { getAuthService } = await import('../../auth/auth-service');
      const authService = getAuthService();
      
      // Get current user session for authentication
      const { session } = await authService.getSession();
      if (!session?.access_token) {
        console.error('No active session for service account token request');
        return null;
      }

      const supabaseUrl = process.env.SUPABASE_URL || 'https://cbptgzaubhcclkmvkiua.supabase.co';
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/get-service-account-token`;

      console.log('🔑 Requesting service account token from edge function...');

      const requestBody = scopes ? { scopes } : {};
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Service account token request failed:', response.status, errorData);
        return null;
      }

      const data = await response.json();
      console.log('✅ Service account token obtained, expires:', data.expires_at);

      return {
        access_token: data.access_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in
      };
    } catch (error) {
      console.error('❌ Failed to get service account token:', error);
      return null;
    }
  }

  /**
   * Check if service account sync is available
   */
  isServiceAccountAvailable(): boolean {
    return this.isInitialized && !!this.jwtClient;
  }

  /**
   * Refresh service account token if needed
   */
  private async ensureValidToken(): Promise<boolean> {
    if (!this.jwtClient) {
      console.log('No JWT client, reinitializing...');
      await this.initializeServiceAccount();
      return this.isInitialized;
    }

    // Check if token is expired or about to expire (5 minute buffer)
    const credentials = this.jwtClient.credentials;
    const expiryTime = credentials.expiry_date;
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiryTime && (now + bufferTime) >= expiryTime) {
      console.log('🔄 Service account token expired, refreshing...');
      
      const tokenResult = await this.getServiceAccountToken([
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]);

      if (!tokenResult) {
        console.error('❌ Failed to refresh service account token');
        this.isInitialized = false;
        return false;
      }

      // Update credentials with new token
      this.jwtClient.setCredentials({
        access_token: tokenResult.access_token,
        expiry_date: new Date(tokenResult.expires_at).getTime()
      });

      console.log('✅ Service account token refreshed');
    }

    return true;
  }

  /**
   * Get or create spreadsheet for sync operations
   * This creates a spreadsheet that the service account owns and can write to
   */
  async getOrCreateSyncSpreadsheet(title: string, folderId?: string): Promise<string> {
    if (!await this.ensureValidToken()) {
      throw new Error('Service account not available for sync operations');
    }

    try {
      // Check if we already have a sync spreadsheet stored
      const syncSpreadsheets = storage.get('syncSpreadsheets') || {};
      const existingId = syncSpreadsheets[title];

      if (existingId) {
        // Verify the spreadsheet still exists and is accessible
        try {
          await this.sheetsApi.spreadsheets.get({ spreadsheetId: existingId });
          console.log(`✅ Using existing sync spreadsheet: ${existingId}`);
          return existingId;
        } catch (error) {
          console.warn(`Existing sync spreadsheet ${existingId} not accessible, creating new one`);
        }
      }

      // Create new spreadsheet
      console.log(`📊 Creating new sync spreadsheet: ${title}`);
      const createResponse = await this.sheetsApi.spreadsheets.create({
        requestBody: {
          properties: {
            title: `${title} (Sync)`,
            locale: 'en_US',
          },
          sheets: [
            {
              properties: {
                title: 'Data',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 26
                }
              }
            }
          ]
        }
      });

      const spreadsheetId = createResponse.data.spreadsheetId;
      console.log(`✅ Created sync spreadsheet: ${spreadsheetId}`);

      // Move to folder if specified
      if (folderId && this.driveApi) {
        try {
          await this.driveApi.files.update({
            fileId: spreadsheetId,
            addParents: folderId,
            removeParents: 'root'
          });
          console.log(`📁 Moved sync spreadsheet to folder: ${folderId}`);
        } catch (error) {
          console.warn('Failed to move sync spreadsheet to folder:', error);
        }
      }

      // Store the spreadsheet ID for future use
      syncSpreadsheets[title] = spreadsheetId;
      storage.set('syncSpreadsheets', syncSpreadsheets);

      return spreadsheetId;
    } catch (error) {
      console.error('❌ Failed to get or create sync spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Update spreadsheet with sync data
   * Optimized for bulk data updates during sync operations
   */
  async updateSyncData(spreadsheetId: string, sheetName: string, data: any[][]): Promise<void> {
    if (!await this.ensureValidToken()) {
      throw new Error('Service account not available for sync operations');
    }

    // Ensure service account has access to the spreadsheet
    const hasAccess = await this.ensureSpreadsheetAccess(spreadsheetId, 'writer');
    if (!hasAccess) {
      throw new Error(`Service account cannot access spreadsheet ${spreadsheetId}. Please share it with spreadsheetsync@egdesk-474603.iam.gserviceaccount.com`);
    }

    try {
      // Clear existing data
      await this.sheetsApi.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A:ZZ`
      });

      // Update with new data
      if (data.length > 0) {
        await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: data
          }
        });

        console.log(`✅ Updated sync spreadsheet ${spreadsheetId} with ${data.length} rows`);
      }
    } catch (error) {
      console.error('❌ Failed to update sync data:', error);
      throw error;
    }
  }

  /**
   * Append data to sync spreadsheet (for incremental updates)
   */
  async appendSyncData(spreadsheetId: string, sheetName: string, data: any[][]): Promise<void> {
    if (!await this.ensureValidToken()) {
      throw new Error('Service account not available for sync operations');
    }

    // Ensure service account has access to the spreadsheet
    const hasAccess = await this.ensureSpreadsheetAccess(spreadsheetId, 'writer');
    if (!hasAccess) {
      throw new Error(`Service account cannot access spreadsheet ${spreadsheetId}. Please share it with spreadsheetsync@egdesk-474603.iam.gserviceaccount.com`);
    }

    try {
      if (data.length > 0) {
        await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A:ZZ`,
          valueInputOption: 'RAW',
          requestBody: {
            values: data
          }
        });

        console.log(`✅ Appended ${data.length} rows to sync spreadsheet ${spreadsheetId}`);
      }
    } catch (error) {
      console.error('❌ Failed to append sync data:', error);
      throw error;
    }
  }

  /**
   * Format spreadsheet headers for better readability
   */
  async formatSyncHeaders(spreadsheetId: string, sheetName: string, headerCount: number): Promise<void> {
    if (!await this.ensureValidToken()) {
      return; // Skip formatting if service account not available
    }

    // Ensure service account has access to the spreadsheet
    const hasAccess = await this.ensureSpreadsheetAccess(spreadsheetId, 'writer');
    if (!hasAccess) {
      console.warn(`Service account cannot access spreadsheet ${spreadsheetId} for formatting. Skipping header formatting.`);
      return; // Skip formatting if no access
    }

    try {
      // Get sheet ID
      const spreadsheet = await this.sheetsApi.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetName);
      
      if (!sheet) {
        console.warn(`Sheet ${sheetName} not found for formatting`);
        return;
      }

      const sheetId = sheet.properties.sheetId;

      // Apply header formatting
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headerCount
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.2,
                      green: 0.6,
                      blue: 0.9
                    },
                    textFormat: {
                      bold: true,
                      foregroundColor: {
                        red: 1,
                        green: 1,
                        blue: 1
                      }
                    }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            }
          ]
        }
      });

      console.log(`✅ Formatted headers for sync spreadsheet ${spreadsheetId}`);
    } catch (error) {
      console.warn('Failed to format sync headers:', error);
      // Don't throw - formatting is optional
    }
  }

  /**
   * Check if spreadsheet is accessible to service account, and share if needed
   */
  async ensureSpreadsheetAccess(spreadsheetId: string, role: 'reader' | 'writer' = 'writer'): Promise<boolean> {
    if (!await this.ensureValidToken() || !this.driveApi || !this.sheetsApi) {
      console.error('Service account or APIs not available for access check');
      return false;
    }

    try {
      // First, try to access the spreadsheet to see if we already have permission
      console.log(`🔍 Checking service account access to spreadsheet ${spreadsheetId}...`);
      
      try {
        await this.sheetsApi.spreadsheets.get({ spreadsheetId });
        console.log(`✅ Service account already has access to spreadsheet ${spreadsheetId}`);
        return true;
      } catch (accessError: any) {
        if (accessError.code === 403 || accessError.code === 404) {
          console.log(`⚠️ Service account lacks access to spreadsheet ${spreadsheetId}, attempting to share...`);
          
          // Get service account email from token request
          const serviceAccountEmail = 'spreadsheetsync@egdesk-474603.iam.gserviceaccount.com';
          
          // We need to use the user's OAuth token to share the spreadsheet with the service account
          const { getAuthService } = await import('../../auth/auth-service');
          const authService = getAuthService();
          const userToken = await authService.getGoogleWorkspaceToken();
          
          if (!userToken?.access_token) {
            console.error('❌ No user OAuth token available to share spreadsheet with service account');
            return false;
          }

          // Use user's token to share with service account
          const { google } = require('googleapis');
          const userAuth = new google.auth.OAuth2();
          userAuth.setCredentials({ access_token: userToken.access_token });
          const userDriveApi = google.drive({ version: 'v3', auth: userAuth });

          await userDriveApi.permissions.create({
            fileId: spreadsheetId,
            requestBody: {
              role,
              type: 'user',
              emailAddress: serviceAccountEmail
            },
            sendNotificationEmail: false // Don't spam notifications
          });

          console.log(`✅ Shared spreadsheet ${spreadsheetId} with service account as ${role}`);
          
          // Verify access after sharing
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait for permission propagation
          await this.sheetsApi.spreadsheets.get({ spreadsheetId });
          console.log(`✅ Verified service account access to spreadsheet ${spreadsheetId}`);
          
          return true;
        } else {
          console.error('❌ Unexpected error checking spreadsheet access:', accessError);
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Failed to ensure spreadsheet access:', error);
      return false;
    }
  }

  /**
   * Share sync spreadsheet with specific users (if needed)
   */
  async shareSyncSpreadsheet(spreadsheetId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
    if (!await this.ensureValidToken() || !this.driveApi) {
      throw new Error('Service account or Drive API not available');
    }

    try {
      await this.driveApi.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role,
          type: 'user',
          emailAddress: email
        }
      });

      console.log(`✅ Shared sync spreadsheet ${spreadsheetId} with ${email} as ${role}`);
    } catch (error) {
      console.error('❌ Failed to share sync spreadsheet:', error);
      throw error;
    }
  }

  /**
   * Get sync spreadsheet URL
   */
  getSyncSpreadsheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }
}

// Singleton instance
let sheetsSyncService: SheetsSyncService | null = null;

export function getSheetsSyncService(): SheetsSyncService {
  if (!sheetsSyncService) {
    sheetsSyncService = new SheetsSyncService();
  }
  return sheetsSyncService;
}