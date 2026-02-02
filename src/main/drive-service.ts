/**
 * Unified Drive Service
 *
 * Central service for all Google Drive folder operations with unified caching.
 * Ensures all spreadsheets are automatically organized into structured folders.
 *
 * Folder Structure:
 * Google Drive Root
 * └── EGDesk/
 *     ├── Dev/                    # Development spreadsheets
 *     ├── Transactions/           # Bank & card transaction exports
 *     └── Tax Invoices/           # Sales & purchase tax invoices
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getAuthService } from './auth/auth-service';
import { getStore } from './storage';

export interface FolderConfig {
  folderId: string;
  parentId?: string;
  lastVerified: string;
}

export type SubfolderType = 'Dev' | 'Transactions' | 'Tax Invoices';

export class DriveService {
  /**
   * Get OAuth2 client with stored token
   */
  private async getOAuth2Client(): Promise<OAuth2Client> {
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();

    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: token.expires_at ? token.expires_at * 1000 : undefined,
    });

    return oauth2Client;
  }

  /**
   * Get folder configuration from cache
   */
  private getFolderFromCache(subfolder: 'root' | SubfolderType): FolderConfig | null {
    try {
      const store = getStore();
      const folders = store.get('egdeskFolders') as Record<string, FolderConfig> | undefined;
      return folders?.[subfolder] || null;
    } catch (error) {
      console.warn('Failed to get folder from cache:', error);
      return null;
    }
  }

  /**
   * Save folder configuration to cache
   */
  private saveFolderToCache(subfolder: 'root' | SubfolderType, config: FolderConfig): void {
    try {
      const store = getStore();
      const folders = store.get('egdeskFolders') as Record<string, FolderConfig> | undefined || {};
      folders[subfolder] = config;
      store.set('egdeskFolders', folders);
      console.log(`💾 Cached ${subfolder} folder: ${config.folderId}`);
    } catch (error) {
      console.warn('Failed to save folder to cache:', error);
    }
  }

  /**
   * Verify that a cached folder is still accessible
   */
  private async verifyFolder(folderId: string): Promise<boolean> {
    try {
      const auth = await this.getOAuth2Client();
      const drive = google.drive({ version: 'v3', auth });

      const folderCheck = await drive.files.get({
        fileId: folderId,
        fields: 'id, trashed',
      });

      return !!(folderCheck.data.id && !folderCheck.data.trashed);
    } catch (error) {
      console.warn('Folder verification failed:', error);
      return false;
    }
  }

  /**
   * Find or create the main EGDesk folder in Google Drive
   * Returns the folder ID
   */
  async findOrCreateEGDeskFolder(): Promise<string> {
    // Check cache first
    const cached = this.getFolderFromCache('root');
    if (cached) {
      // Verify folder still exists (skip if verified recently - within 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (cached.lastVerified > oneHourAgo) {
        console.log('📁 Using cached EGDesk folder:', cached.folderId);
        return cached.folderId;
      }

      // Verify folder still exists
      const isValid = await this.verifyFolder(cached.folderId);
      if (isValid) {
        // Update verification timestamp
        this.saveFolderToCache('root', {
          ...cached,
          lastVerified: new Date().toISOString(),
        });
        console.log('📁 Verified cached EGDesk folder:', cached.folderId);
        return cached.folderId;
      }

      console.log('⚠️ Cached EGDesk folder no longer accessible');
    }

    console.log('🔍 Searching for EGDesk folder in Google Drive...');

    const auth = await this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    // Search for existing EGDesk folder
    const searchResponse = await drive.files.list({
      q: "name = 'EGDesk' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let folderId: string;

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      folderId = searchResponse.data.files[0].id!;
      console.log('✅ Found existing EGDesk folder:', folderId);
    } else {
      // Create EGDesk folder
      console.log('📁 EGDesk folder not found, creating...');
      const createResponse = await drive.files.create({
        requestBody: {
          name: 'EGDesk',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, webViewLink',
      });

      if (!createResponse.data.id) {
        throw new Error('Failed to create EGDesk folder');
      }

      folderId = createResponse.data.id;
      console.log('✅ Created EGDesk folder:', folderId);
      console.log('📂 Folder URL:', createResponse.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`);
    }

    // Cache the folder
    this.saveFolderToCache('root', {
      folderId,
      lastVerified: new Date().toISOString(),
    });

    return folderId;
  }

  /**
   * Find or create a subfolder inside the EGDesk folder
   * Structure: Google Drive / EGDesk / [subfolder] / [files]
   */
  async findOrCreateSubfolder(subfolder: SubfolderType): Promise<FolderConfig> {
    // Check cache first
    const cached = this.getFolderFromCache(subfolder);
    if (cached) {
      // Verify folder still exists (skip if verified recently - within 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (cached.lastVerified > oneHourAgo) {
        console.log(`📁 Using cached ${subfolder} folder:`, cached.folderId);
        return cached;
      }

      // Verify folder still exists
      const isValid = await this.verifyFolder(cached.folderId);
      if (isValid) {
        // Update verification timestamp
        const updated = {
          ...cached,
          lastVerified: new Date().toISOString(),
        };
        this.saveFolderToCache(subfolder, updated);
        console.log(`📁 Verified cached ${subfolder} folder:`, cached.folderId);
        return updated;
      }

      console.log(`⚠️ Cached ${subfolder} folder no longer accessible`);
    }

    console.log(`📂 Creating ${subfolder} folder structure...`);

    const auth = await this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    // Step 1: Find or create the main EGDesk folder
    const egdeskFolderId = await this.findOrCreateEGDeskFolder();

    // Step 2: Check if subfolder already exists inside EGDesk
    const subfolderSearch = await drive.files.list({
      q: `name = '${subfolder}' and mimeType = 'application/vnd.google-apps.folder' and '${egdeskFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let subFolderId: string;

    if (subfolderSearch.data.files && subfolderSearch.data.files.length > 0) {
      subFolderId = subfolderSearch.data.files[0].id!;
      console.log(`✅ Found existing ${subfolder} folder:`, subFolderId);
    } else {
      // Create subfolder inside EGDesk
      console.log(`📁 Creating ${subfolder} folder inside EGDesk...`);
      const createSubfolder = await drive.files.create({
        requestBody: {
          name: subfolder,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [egdeskFolderId],
        },
        fields: 'id, webViewLink',
      });

      if (!createSubfolder.data.id) {
        throw new Error(`Failed to create ${subfolder} folder`);
      }

      subFolderId = createSubfolder.data.id;
      console.log(`✅ Created ${subfolder} folder:`, subFolderId);
    }

    // Save the configuration
    const folderConfig: FolderConfig = {
      folderId: subFolderId,
      parentId: egdeskFolderId,
      lastVerified: new Date().toISOString(),
    };

    this.saveFolderToCache(subfolder, folderConfig);

    console.log(`📂 ${subfolder} folder structure ready:`);
    console.log(`   EGDesk: ${egdeskFolderId}`);
    console.log(`   └── ${subfolder}: ${subFolderId}`);

    return folderConfig;
  }

  /**
   * Move a file to a specific folder
   * @param fileId - The ID of the file to move
   * @param subfolder - The subfolder type ('Dev', 'Transactions', or 'Tax Invoices')
   */
  async moveFileToFolder(fileId: string, subfolder: SubfolderType): Promise<void> {
    try {
      const auth = await this.getOAuth2Client();
      const drive = google.drive({ version: 'v3', auth });

      // Get the target folder configuration
      const folderConfig = await this.findOrCreateSubfolder(subfolder);

      // Get current parents of the file
      const file = await drive.files.get({
        fileId: fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents?.join(',') || '';

      // Move the file to the new folder
      await drive.files.update({
        fileId: fileId,
        addParents: folderConfig.folderId,
        removeParents: previousParents,
        fields: 'id, parents',
      });

      console.log(`✅ Moved file ${fileId} to ${subfolder} folder (${folderConfig.folderId})`);
    } catch (error) {
      console.error(`Failed to move file to ${subfolder} folder:`, error);
      throw error;
    }
  }

  /**
   * Create a spreadsheet and automatically organize it into a folder
   * @param title - The title of the spreadsheet
   * @param subfolder - The subfolder type to organize into
   * @param data - Optional initial data for the spreadsheet (rows including headers)
   * @returns Spreadsheet ID and URL
   */
  async createSpreadsheetInFolder(
    title: string,
    subfolder: SubfolderType,
    data?: string[][]
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      const auth = await this.getOAuth2Client();
      const sheets = google.sheets({ version: 'v4', auth });

      // Create the spreadsheet
      const createRequest: any = {
        requestBody: {
          properties: {
            title: title,
          },
        },
      };

      // Add initial data if provided
      if (data && data.length > 0) {
        createRequest.requestBody.sheets = [
          {
            properties: {
              title: 'Sheet1',
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: data.map(row => ({
                  values: row.map(cell => ({
                    userEnteredValue: { stringValue: cell?.toString() || '' },
                  })),
                })),
              },
            ],
          },
        ];
      }

      const response = await sheets.spreadsheets.create(createRequest);

      if (!response.data.spreadsheetId) {
        throw new Error('Failed to create spreadsheet: No spreadsheet ID returned');
      }

      const spreadsheetId = response.data.spreadsheetId;
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      console.log(`✅ Created spreadsheet: ${title} (ID: ${spreadsheetId})`);

      // Move to the appropriate folder
      try {
        await this.moveFileToFolder(spreadsheetId, subfolder);
      } catch (error) {
        console.warn(`⚠️ Could not organize spreadsheet into ${subfolder} folder:`, error);
        // Don't fail the entire operation if folder organization fails
      }

      return {
        spreadsheetId,
        spreadsheetUrl,
      };
    } catch (error) {
      console.error('Failed to create spreadsheet:', error);
      throw error;
    }
  }
}

// Export singleton instance
let driveService: DriveService | null = null;

export function getDriveService(): DriveService {
  if (!driveService) {
    driveService = new DriveService();
  }
  return driveService;
}
