/**
 * EGDesk Dev Spreadsheet Service
 * 
 * Provides functionality to:
 * - Create and manage a development spreadsheet
 * - Sync schema bidirectionally between public and dev spreadsheets
 * - Handle merge conflicts
 * - Create backups before sync operations
 */

import { ipcMain } from 'electron';
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Store from 'electron-store';
import { getAuthService } from './auth/auth-service';

// Types
export interface EGDeskDevFolderConfig {
  folderId: string;
  folderUrl: string;
  parentFolderId: string; // The main EGDesk folder ID
  createdAt: string;
}

export interface EGDeskDevConfig {
  devSpreadsheetId: string;
  devSpreadsheetUrl: string;
  devSheetGid: string;
  publicSpreadsheetId: string;
  publicSheetGid: string;
  lastSyncedAt: string | null;
  syncDirection: 'public-to-dev' | 'dev-to-public' | 'bidirectional';
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetRow {
  name: string;
  description: string;
  url: string;
  scriptID: string;
  rowIndex: number; // Original row index in spreadsheet
}

export interface SchemaDiff {
  added: SpreadsheetRow[];      // Rows in source but not in target
  removed: SpreadsheetRow[];    // Rows in target but not in source  
  modified: MergeConflict[];    // Rows with different values
  unchanged: SpreadsheetRow[];  // Rows that are identical
}

export interface MergeConflict {
  name: string;
  scriptID: string;
  field: string;
  publicValue: string;
  devValue: string;
  publicRow: SpreadsheetRow;
  devRow: SpreadsheetRow;
}

export interface BackupInfo {
  sheetName: string;
  createdAt: string;
  rowCount: number;
}

// Public spreadsheet configuration
const PUBLIC_SPREADSHEET_ID = '1zo30Kke-nyir3tys9HsUMG7QqY3Gi6cnVCbLGdishIU';
const PUBLIC_SHEET_GID = '0';
const SCHEMA_HEADERS = ['name', 'description', 'url', 'scriptID'];
const MAX_BACKUPS = 5;

export class EGDeskDevSpreadsheetService {
  private store: Store;

  constructor() {
    this.store = new Store({
      name: 'egdesk-auth',
      encryptionKey: 'egdesk-auth-encryption-key',
    });
  }

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
   * Get the dev configuration from electron-store
   */
  getDevConfig(): EGDeskDevConfig | null {
    const config = this.store.get('egdeskDevConfig') as EGDeskDevConfig | undefined;
    return config || null;
  }

  /**
   * Save the dev configuration to electron-store
   */
  saveDevConfig(config: EGDeskDevConfig): void {
    config.updatedAt = new Date().toISOString();
    this.store.set('egdeskDevConfig', config);
    console.log('💾 Saved EGDesk dev configuration');
  }

  /**
   * Clear the dev configuration
   */
  clearDevConfig(): void {
    this.store.delete('egdeskDevConfig');
    console.log('🗑️ Cleared EGDesk dev configuration');
  }

  /**
   * Get the dev folder configuration from electron-store
   */
  getDevFolderConfig(): EGDeskDevFolderConfig | null {
    const config = this.store.get('egdeskDevFolderConfig') as EGDeskDevFolderConfig | undefined;
    return config || null;
  }

  /**
   * Save the dev folder configuration to electron-store
   */
  saveDevFolderConfig(config: EGDeskDevFolderConfig): void {
    this.store.set('egdeskDevFolderConfig', config);
    console.log('💾 Saved EGDesk dev folder configuration');
  }

  /**
   * Find or create the main EGDesk folder in Google Drive
   */
  private async findOrCreateEGDeskFolder(drive: any): Promise<string> {
    console.log('🔍 Searching for EGDesk folder in Google Drive...');
    
    const searchResponse = await drive.files.list({
      q: "name = 'EGDesk' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id!;
      console.log('✅ Found existing EGDesk folder:', folderId);
      return folderId;
    }

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

    console.log('✅ Created EGDesk folder:', createResponse.data.id);
    return createResponse.data.id;
  }

  /**
   * Find or create the Dev folder inside EGDesk folder
   * Structure: Google Drive / EGDesk / Dev / [dev spreadsheets]
   */
  async findOrCreateDevFolder(): Promise<EGDeskDevFolderConfig> {
    // Check if we already have a stored dev folder config
    const existingConfig = this.getDevFolderConfig();
    if (existingConfig) {
      // Verify the folder still exists
      try {
        const auth = await this.getOAuth2Client();
        const drive = google.drive({ version: 'v3', auth });
        
        const folderCheck = await drive.files.get({
          fileId: existingConfig.folderId,
          fields: 'id, trashed',
        });
        
        if (folderCheck.data.id && !folderCheck.data.trashed) {
          console.log('📁 Using existing Dev folder:', existingConfig.folderId);
          return existingConfig;
        }
      } catch (error) {
        console.log('⚠️ Stored Dev folder not accessible, will create new one');
      }
    }

    console.log('📂 Creating Dev folder structure...');
    
    const auth = await this.getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    // Step 1: Find or create the main EGDesk folder
    const egdeskFolderId = await this.findOrCreateEGDeskFolder(drive);

    // Step 2: Check if Dev folder already exists inside EGDesk
    const devFolderSearch = await drive.files.list({
      q: `name = 'Dev' and mimeType = 'application/vnd.google-apps.folder' and '${egdeskFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive',
    });

    let devFolderId: string;
    let devFolderUrl: string;

    if (devFolderSearch.data.files && devFolderSearch.data.files.length > 0) {
      // Dev folder exists
      devFolderId = devFolderSearch.data.files[0].id!;
      devFolderUrl = devFolderSearch.data.files[0].webViewLink || 
                     `https://drive.google.com/drive/folders/${devFolderId}`;
      console.log('✅ Found existing Dev folder:', devFolderId);
    } else {
      // Create Dev folder inside EGDesk
      console.log('📁 Creating Dev folder inside EGDesk...');
      const createDevFolder = await drive.files.create({
        requestBody: {
          name: 'Dev',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [egdeskFolderId],
        },
        fields: 'id, webViewLink',
      });

      if (!createDevFolder.data.id) {
        throw new Error('Failed to create Dev folder');
      }

      devFolderId = createDevFolder.data.id;
      devFolderUrl = createDevFolder.data.webViewLink || 
                     `https://drive.google.com/drive/folders/${devFolderId}`;
      console.log('✅ Created Dev folder:', devFolderId);
    }

    // Save the configuration
    const folderConfig: EGDeskDevFolderConfig = {
      folderId: devFolderId,
      folderUrl: devFolderUrl,
      parentFolderId: egdeskFolderId,
      createdAt: new Date().toISOString(),
    };

    this.saveDevFolderConfig(folderConfig);
    
    console.log('📂 Dev folder structure ready:');
    console.log(`   EGDesk: ${egdeskFolderId}`);
    console.log(`   └── Dev: ${devFolderId}`);

    return folderConfig;
  }

  /**
   * Create a new dev spreadsheet by copying schema from public
   */
  async createDevSpreadsheet(): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    message: string;
    devFolderUrl?: string;
  }> {
    console.log('📝 Creating new dev spreadsheet...');

    // Step 1: Ensure dev folder exists first
    const devFolderConfig = await this.findOrCreateDevFolder();

    const auth = await this.getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Step 2: Create the spreadsheet with schema headers
    const title = `EGDesk MCP Servers (Dev) - ${new Date().toISOString().split('T')[0]}`;
    
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
        },
        sheets: [
          {
            properties: {
              title: 'MCP Servers',
              sheetId: 0,
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: SCHEMA_HEADERS.map(header => ({
                      userEnteredValue: { stringValue: header },
                      userEnteredFormat: {
                        textFormat: { bold: true },
                        backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                      },
                    })),
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    if (!createResponse.data.spreadsheetId) {
      throw new Error('Failed to create dev spreadsheet');
    }

    const spreadsheetId = createResponse.data.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    console.log(`✅ Created dev spreadsheet: ${spreadsheetId}`);

    // Step 3: Move spreadsheet to the Dev folder
    try {
      // Get current parents and move file
      const file = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
      const previousParents = file.data.parents?.join(',') || '';
      
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: devFolderConfig.folderId,
        removeParents: previousParents,
        fields: 'id, parents',
      });

      console.log('📁 Moved dev spreadsheet to Dev folder:', devFolderConfig.folderId);
    } catch (error) {
      console.warn('⚠️ Could not move to Dev folder:', error);
    }

    // Save configuration
    const config: EGDeskDevConfig = {
      devSpreadsheetId: spreadsheetId,
      devSpreadsheetUrl: spreadsheetUrl,
      devSheetGid: '0',
      publicSpreadsheetId: PUBLIC_SPREADSHEET_ID,
      publicSheetGid: PUBLIC_SHEET_GID,
      lastSyncedAt: null,
      syncDirection: 'bidirectional',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveDevConfig(config);

    return {
      spreadsheetId,
      spreadsheetUrl,
      message: `Created dev spreadsheet: ${title}`,
      devFolderUrl: devFolderConfig.folderUrl,
    };
  }

  /**
   * Fetch all rows from a spreadsheet
   */
  async fetchSpreadsheetRows(spreadsheetId: string, sheetName: string = 'Sheet1'): Promise<SpreadsheetRow[]> {
    const auth = await this.getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    // First, get the sheet name if not provided
    if (sheetName === 'Sheet1') {
      const metadata = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });

      if (metadata.data.sheets && metadata.data.sheets.length > 0) {
        sheetName = metadata.data.sheets[0].properties?.title || 'Sheet1';
      }
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`, // name, description, url, scriptID
    });

    const rows = response.data.values || [];
    
    // Skip header row
    return rows.slice(1).map((row, index) => ({
      name: row[0] || '',
      description: row[1] || '',
      url: row[2] || '',
      scriptID: row[3] || '',
      rowIndex: index + 2, // +2 because we skip header and 1-indexed
    })).filter(row => row.name); // Only rows with a name
  }

  /**
   * Write rows to a spreadsheet (clears existing data first)
   */
  async writeSpreadsheetRows(
    spreadsheetId: string, 
    rows: SpreadsheetRow[],
    sheetName: string = 'MCP Servers'
  ): Promise<void> {
    const auth = await this.getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    // Clear existing data (except header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:D`,
    });

    if (rows.length === 0) {
      console.log('ℹ️ No rows to write');
      return;
    }

    // Write new data
    const values = rows.map(row => [row.name, row.description, row.url, row.scriptID]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2:D`,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log(`✅ Wrote ${rows.length} rows to spreadsheet`);
  }

  /**
   * Create a backup sheet before sync
   */
  async createBackup(spreadsheetId: string): Promise<BackupInfo> {
    const auth = await this.getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupSheetName = `_backup_${timestamp}`;

    // Get current data
    const rows = await this.fetchSpreadsheetRows(spreadsheetId, 'MCP Servers');

    // Get spreadsheet metadata to find existing sheets
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.sheetId,sheets.properties.title',
    });

    const existingSheets = metadata.data.sheets || [];
    const backupSheets = existingSheets
      .filter(s => s.properties?.title?.startsWith('_backup_'))
      .sort((a, b) => (a.properties?.title || '').localeCompare(b.properties?.title || ''));

    // Delete oldest backups if exceeding MAX_BACKUPS
    if (backupSheets.length >= MAX_BACKUPS) {
      const sheetsToDelete = backupSheets.slice(0, backupSheets.length - MAX_BACKUPS + 1);
      
      for (const sheet of sheetsToDelete) {
        if (sheet.properties?.sheetId !== undefined) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteSheet: {
                    sheetId: sheet.properties.sheetId,
                  },
                },
              ],
            },
          });
          console.log(`🗑️ Deleted old backup: ${sheet.properties?.title}`);
        }
      }
    }

    // Create new backup sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: backupSheetName,
              },
            },
          },
        ],
      },
    });

    // Write header and data to backup sheet
    const allValues = [
      SCHEMA_HEADERS,
      ...rows.map(row => [row.name, row.description, row.url, row.scriptID]),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${backupSheetName}!A1:D`,
      valueInputOption: 'RAW',
      requestBody: {
        values: allValues,
      },
    });

    console.log(`💾 Created backup: ${backupSheetName} with ${rows.length} rows`);

    return {
      sheetName: backupSheetName,
      createdAt: new Date().toISOString(),
      rowCount: rows.length,
    };
  }

  /**
   * Validate that both spreadsheets have the same schema
   */
  async validateSchema(publicId: string, devId: string): Promise<{
    isValid: boolean;
    publicHeaders: string[];
    devHeaders: string[];
    errors: string[];
  }> {
    const auth = await this.getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get headers from both spreadsheets
    const [publicResponse, devResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: publicId,
        range: 'A1:Z1', // Get first row
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: devId,
        range: 'MCP Servers!A1:Z1',
      }),
    ]);

    const publicHeaders = (publicResponse.data.values?.[0] || []).map(h => String(h).toLowerCase().trim());
    const devHeaders = (devResponse.data.values?.[0] || []).map(h => String(h).toLowerCase().trim());

    const errors: string[] = [];

    // Check for required columns
    for (const required of SCHEMA_HEADERS) {
      if (!publicHeaders.includes(required.toLowerCase())) {
        errors.push(`Public spreadsheet missing required column: ${required}`);
      }
      if (!devHeaders.includes(required.toLowerCase())) {
        errors.push(`Dev spreadsheet missing required column: ${required}`);
      }
    }

    // Check column order matches
    const publicRequired = publicHeaders.filter(h => SCHEMA_HEADERS.map(s => s.toLowerCase()).includes(h));
    const devRequired = devHeaders.filter(h => SCHEMA_HEADERS.map(s => s.toLowerCase()).includes(h));

    if (JSON.stringify(publicRequired) !== JSON.stringify(devRequired)) {
      errors.push('Column order differs between spreadsheets');
    }

    return {
      isValid: errors.length === 0,
      publicHeaders,
      devHeaders,
      errors,
    };
  }

  /**
   * Compare schemas and detect differences/conflicts
   */
  async compareSchemas(): Promise<SchemaDiff> {
    const config = this.getDevConfig();
    if (!config) {
      throw new Error('Dev spreadsheet not configured. Please create one first.');
    }

    // Fetch rows from both spreadsheets
    const [publicRows, devRows] = await Promise.all([
      this.fetchSpreadsheetRows(config.publicSpreadsheetId),
      this.fetchSpreadsheetRows(config.devSpreadsheetId, 'MCP Servers'),
    ]);

    // Build maps for comparison (use name or scriptID as key)
    const publicMap = new Map<string, SpreadsheetRow>();
    const devMap = new Map<string, SpreadsheetRow>();

    for (const row of publicRows) {
      const key = row.scriptID || row.name;
      publicMap.set(key, row);
    }

    for (const row of devRows) {
      const key = row.scriptID || row.name;
      devMap.set(key, row);
    }

    const added: SpreadsheetRow[] = [];
    const removed: SpreadsheetRow[] = [];
    const modified: MergeConflict[] = [];
    const unchanged: SpreadsheetRow[] = [];

    // Find rows in public but not in dev (added)
    for (const [key, publicRow] of publicMap) {
      if (!devMap.has(key)) {
        added.push(publicRow);
      }
    }

    // Find rows in dev but not in public (would be removed if syncing public->dev)
    for (const [key, devRow] of devMap) {
      if (!publicMap.has(key)) {
        removed.push(devRow);
      }
    }

    // Find modified rows
    for (const [key, publicRow] of publicMap) {
      const devRow = devMap.get(key);
      if (devRow) {
        const conflicts: MergeConflict[] = [];

        // Compare each field
        if (publicRow.name !== devRow.name) {
          conflicts.push({
            name: publicRow.name || devRow.name,
            scriptID: key,
            field: 'name',
            publicValue: publicRow.name,
            devValue: devRow.name,
            publicRow,
            devRow,
          });
        }

        if (publicRow.description !== devRow.description) {
          conflicts.push({
            name: publicRow.name || devRow.name,
            scriptID: key,
            field: 'description',
            publicValue: publicRow.description,
            devValue: devRow.description,
            publicRow,
            devRow,
          });
        }

        if (publicRow.url !== devRow.url) {
          conflicts.push({
            name: publicRow.name || devRow.name,
            scriptID: key,
            field: 'url',
            publicValue: publicRow.url,
            devValue: devRow.url,
            publicRow,
            devRow,
          });
        }

        if (conflicts.length > 0) {
          modified.push(...conflicts);
        } else {
          unchanged.push(publicRow);
        }
      }
    }

    return { added, removed, modified, unchanged };
  }

  /**
   * Sync from public to dev spreadsheet
   */
  async syncPublicToDev(createBackupFirst: boolean = true): Promise<{
    success: boolean;
    message: string;
    backup?: BackupInfo;
    rowsSynced: number;
  }> {
    const config = this.getDevConfig();
    if (!config) {
      throw new Error('Dev spreadsheet not configured. Please create one first.');
    }

    console.log('📥 Syncing public → dev...');

    // Create backup first if requested
    let backup: BackupInfo | undefined;
    if (createBackupFirst) {
      backup = await this.createBackup(config.devSpreadsheetId);
    }

    // Fetch public rows
    const publicRows = await this.fetchSpreadsheetRows(config.publicSpreadsheetId);

    // Write to dev spreadsheet
    await this.writeSpreadsheetRows(config.devSpreadsheetId, publicRows, 'MCP Servers');

    // Update last synced
    config.lastSyncedAt = new Date().toISOString();
    this.saveDevConfig(config);

    console.log(`✅ Synced ${publicRows.length} rows from public to dev`);

    return {
      success: true,
      message: `Successfully synced ${publicRows.length} rows from public to dev`,
      backup,
      rowsSynced: publicRows.length,
    };
  }

  /**
   * Sync from dev to public spreadsheet (with confirmation requirement)
   */
  async syncDevToPublic(createBackupFirst: boolean = true): Promise<{
    success: boolean;
    message: string;
    backup?: BackupInfo;
    rowsSynced: number;
  }> {
    const config = this.getDevConfig();
    if (!config) {
      throw new Error('Dev spreadsheet not configured. Please create one first.');
    }

    console.log('📤 Syncing dev → public...');

    // Create backup first if requested
    let backup: BackupInfo | undefined;
    if (createBackupFirst) {
      // Note: For public spreadsheet, we need write access to create backup
      // This will fail if user doesn't have edit access to public spreadsheet
      try {
        backup = await this.createBackup(config.publicSpreadsheetId);
      } catch (error) {
        console.warn('⚠️ Could not create backup on public spreadsheet (may not have edit access):', error);
      }
    }

    // Fetch dev rows
    const devRows = await this.fetchSpreadsheetRows(config.devSpreadsheetId, 'MCP Servers');

    // Write to public spreadsheet
    await this.writeSpreadsheetRows(config.publicSpreadsheetId, devRows);

    // Update last synced
    config.lastSyncedAt = new Date().toISOString();
    this.saveDevConfig(config);

    console.log(`✅ Synced ${devRows.length} rows from dev to public`);

    return {
      success: true,
      message: `Successfully synced ${devRows.length} rows from dev to public`,
      backup,
      rowsSynced: devRows.length,
    };
  }

  /**
   * Apply merge resolution for a specific row
   */
  async applyMergeResolution(
    targetSpreadsheet: 'public' | 'dev',
    resolvedRows: SpreadsheetRow[]
  ): Promise<{ success: boolean; message: string }> {
    const config = this.getDevConfig();
    if (!config) {
      throw new Error('Dev spreadsheet not configured.');
    }

    const spreadsheetId = targetSpreadsheet === 'public' 
      ? config.publicSpreadsheetId 
      : config.devSpreadsheetId;

    const sheetName = targetSpreadsheet === 'public' ? 'Sheet1' : 'MCP Servers';

    // Create backup first
    await this.createBackup(spreadsheetId);

    // Write resolved rows
    await this.writeSpreadsheetRows(spreadsheetId, resolvedRows, sheetName);

    // Update last synced
    config.lastSyncedAt = new Date().toISOString();
    this.saveDevConfig(config);

    return {
      success: true,
      message: `Successfully applied ${resolvedRows.length} resolved rows to ${targetSpreadsheet}`,
    };
  }

  /**
   * Register IPC handlers
   */
  registerIPCHandlers(): void {
    // Get dev configuration
    ipcMain.handle('egdesk-dev-config-get', async () => {
      try {
        const config = this.getDevConfig();
        return { success: true, config };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Save dev configuration
    ipcMain.handle('egdesk-dev-config-set', async (_, config: EGDeskDevConfig) => {
      try {
        this.saveDevConfig(config);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Clear dev configuration
    ipcMain.handle('egdesk-dev-config-clear', async () => {
      try {
        this.clearDevConfig();
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Get dev folder configuration
    ipcMain.handle('egdesk-dev-folder-get', async () => {
      try {
        const config = this.getDevFolderConfig();
        return { success: true, config };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Create/get dev folder
    ipcMain.handle('egdesk-dev-folder-create', async () => {
      try {
        const config = await this.findOrCreateDevFolder();
        return { success: true, ...config };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Create dev spreadsheet
    ipcMain.handle('egdesk-dev-spreadsheet-create', async () => {
      try {
        const result = await this.createDevSpreadsheet();
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Validate schema
    ipcMain.handle('egdesk-validate-schema', async () => {
      try {
        const config = this.getDevConfig();
        if (!config) {
          return { success: false, error: 'Dev spreadsheet not configured' };
        }
        const result = await this.validateSchema(config.publicSpreadsheetId, config.devSpreadsheetId);
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Compare schemas
    ipcMain.handle('egdesk-compare-schemas', async () => {
      try {
        const diff = await this.compareSchemas();
        return { success: true, diff };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Sync public to dev
    ipcMain.handle('egdesk-sync-public-to-dev', async (_, createBackup: boolean = true) => {
      try {
        const result = await this.syncPublicToDev(createBackup);
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Sync dev to public
    ipcMain.handle('egdesk-sync-dev-to-public', async (_, createBackup: boolean = true) => {
      try {
        const result = await this.syncDevToPublic(createBackup);
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Apply merge resolution
    ipcMain.handle('egdesk-apply-merge-resolution', async (_, targetSpreadsheet: 'public' | 'dev', resolvedRows: SpreadsheetRow[]) => {
      try {
        const result = await this.applyMergeResolution(targetSpreadsheet, resolvedRows);
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Fetch rows from a specific spreadsheet
    ipcMain.handle('egdesk-fetch-spreadsheet-rows', async (_, spreadsheetId: string, sheetName?: string) => {
      try {
        const rows = await this.fetchSpreadsheetRows(spreadsheetId, sheetName);
        return { success: true, rows };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Create backup
    ipcMain.handle('egdesk-create-backup', async (_, spreadsheetId: string) => {
      try {
        const backup = await this.createBackup(spreadsheetId);
        return { success: true, backup };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    console.log('✅ EGDesk Dev Spreadsheet service IPC handlers registered');
  }
}

// Export singleton instance
let egdeskDevSpreadsheetService: EGDeskDevSpreadsheetService | null = null;

export function getEGDeskDevSpreadsheetService(): EGDeskDevSpreadsheetService {
  if (!egdeskDevSpreadsheetService) {
    egdeskDevSpreadsheetService = new EGDeskDevSpreadsheetService();
  }
  return egdeskDevSpreadsheetService;
}

