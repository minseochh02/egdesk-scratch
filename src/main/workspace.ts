/**
 * Google Workspace Service
 * Handles Google Sheets and Apps Script operations
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Store from 'electron-store';
import { ipcMain } from 'electron';

interface GoogleWorkspaceToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  saved_at?: number;
  supabase_session?: boolean;
  user_id?: string;
}

export class GoogleWorkspaceService {
  private store: Store;
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    this.store = new Store({
      name: 'egdesk-auth',
      encryptionKey: 'egdesk-auth-encryption-key',
    });
  }

  /**
   * Get Google OAuth token from electron-store
   */
  private getGoogleToken(): GoogleWorkspaceToken | null {
    const token = this.store.get('google_workspace_token') as GoogleWorkspaceToken | undefined;
    return token || null;
  }

  /**
   * Initialize OAuth2 client with stored token
   */
  private async initializeOAuthClient(): Promise<OAuth2Client> {
    const token = this.getGoogleToken();

    if (!token || !token.access_token) {
      throw new Error('Google OAuth token not found. Please grant permission first.');
    }

    // Check if token is expired
    if (token.expires_at && token.expires_at * 1000 < Date.now()) {
      throw new Error('Google OAuth token has expired. Please re-authorize.');
    }

    // Create OAuth2 client
    // Note: Client ID and Secret are not needed when using access token directly
    // But we'll use a placeholder for the client
    const oauth2Client = new OAuth2Client();

    // Set credentials with the access token
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: token.expires_at ? token.expires_at * 1000 : undefined,
    });

    this.oauth2Client = oauth2Client;
    return oauth2Client;
  }

  /**
   * Create a new Google Sheets spreadsheet
   */
  async createSpreadsheet(title: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      const auth = await this.initializeOAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title,
          },
        },
      });

      if (!response.data.spreadsheetId) {
        throw new Error('Failed to create spreadsheet: No spreadsheet ID returned');
      }

      const spreadsheetId = response.data.spreadsheetId;
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      console.log(`✅ Created spreadsheet: ${title} (ID: ${spreadsheetId})`);

      return {
        spreadsheetId,
        spreadsheetUrl,
      };
    } catch (error: any) {
      console.error('Error creating spreadsheet:', error);
      throw new Error(`Failed to create spreadsheet: ${error.message}`);
    }
  }

  /**
   * Add Apps Script to a spreadsheet
   */
  async addAppsScriptToSpreadsheet(
    spreadsheetId: string,
    scriptCode: string,
    scriptTitle: string = 'My Script'
  ): Promise<{ scriptId: string }> {
    try {
      const auth = await this.initializeOAuthClient();
      const script = google.script({ version: 'v1', auth });

      // First, we need to create a standalone Apps Script project
      // Then attach it to the spreadsheet
      // Note: The Apps Script API requires creating a project first, then we can deploy it

      // Create a new Apps Script project
      const createResponse = await script.projects.create({
        requestBody: {
          title: scriptTitle,
          parentId: spreadsheetId, // Link to the spreadsheet
        },
      });

      if (!createResponse.data.scriptId) {
        throw new Error('Failed to create Apps Script project: No script ID returned');
      }

      const scriptId = createResponse.data.scriptId;

      // Update the script content
      // The Apps Script API requires a manifest file (appsscript.json) along with script files
      await script.projects.updateContent({
        scriptId: scriptId,
        requestBody: {
          files: [
            {
              name: 'appsscript',
              type: 'JSON',
              source: JSON.stringify({
                timeZone: 'America/New_York',
                dependencies: {},
                exceptionLogging: 'STACKDRIVER',
                runtimeVersion: 'V8',
              }),
            },
            {
              name: 'Code',
              type: 'SERVER_JS',
              source: scriptCode,
            },
          ],
        },
      });

      console.log(`✅ Added Apps Script to spreadsheet (Script ID: ${scriptId})`);

      return {
        scriptId,
      };
    } catch (error: any) {
      console.error('Error adding Apps Script:', error);
      throw new Error(`Failed to add Apps Script: ${error.message}`);
    }
  }

  /**
   * Create a spreadsheet with Apps Script in one call
   */
  async createSpreadsheetWithAppsScript(
    title: string,
    scriptCode: string,
    scriptTitle: string = 'My Script'
  ): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    scriptId: string;
  }> {
    try {
      // Create the spreadsheet first
      const { spreadsheetId, spreadsheetUrl } = await this.createSpreadsheet(title);

      // Add Apps Script to the spreadsheet
      const { scriptId } = await this.addAppsScriptToSpreadsheet(
        spreadsheetId,
        scriptCode,
        scriptTitle
      );

      return {
        spreadsheetId,
        spreadsheetUrl,
        scriptId,
      };
    } catch (error: any) {
      console.error('Error creating spreadsheet with Apps Script:', error);
      throw error;
    }
  }

  /**
   * Get spreadsheet by ID
   */
  async getSpreadsheet(spreadsheetId: string): Promise<any> {
    try {
      const auth = await this.initializeOAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error getting spreadsheet:', error);
      throw new Error(`Failed to get spreadsheet: ${error.message}`);
    }
  }

  /**
   * Execute an Apps Script function
   */
  async executeScriptFunction(
    scriptId: string,
    functionName: string,
    parameters: any[] = []
  ): Promise<any> {
    try {
      const auth = await this.initializeOAuthClient();
      const script = google.script({ version: 'v1', auth });

      const response = await script.scripts.run({
        scriptId: scriptId,
        requestBody: {
          function: functionName,
          parameters: parameters,
        },
      });

      if (response.data.error) {
        throw new Error(`Script execution error: ${JSON.stringify(response.data.error)}`);
      }

      return response.data.response?.result;
    } catch (error: any) {
      console.error('Error executing script function:', error);
      throw new Error(`Failed to execute script function: ${error.message}`);
    }
  }

  /**
   * Register IPC handlers for the renderer process
   */
  registerIPCHandlers(): void {
    // Create spreadsheet
    ipcMain.handle('workspace:create-spreadsheet', async (_, title: string) => {
      try {
        const result = await this.createSpreadsheet(title);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Add Apps Script to spreadsheet
    ipcMain.handle(
      'workspace:add-apps-script',
      async (_, spreadsheetId: string, scriptCode: string, scriptTitle?: string) => {
        try {
          const result = await this.addAppsScriptToSpreadsheet(
            spreadsheetId,
            scriptCode,
            scriptTitle
          );
          return { success: true, data: result };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    );

    // Create spreadsheet with Apps Script
    ipcMain.handle(
      'workspace:create-spreadsheet-with-script',
      async (_, title: string, scriptCode: string, scriptTitle?: string) => {
        try {
          const result = await this.createSpreadsheetWithAppsScript(title, scriptCode, scriptTitle);
          return { success: true, data: result };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    );

    // Get spreadsheet
    ipcMain.handle('workspace:get-spreadsheet', async (_, spreadsheetId: string) => {
      try {
        const result = await this.getSpreadsheet(spreadsheetId);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Execute script function
    ipcMain.handle(
      'workspace:execute-script',
      async (_, scriptId: string, functionName: string, parameters?: any[]) => {
        try {
          const result = await this.executeScriptFunction(scriptId, functionName, parameters || []);
          return { success: true, data: result };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    );

    console.log('✅ Google Workspace service IPC handlers registered');
  }
}

// Export singleton instance
export const googleWorkspaceService = new GoogleWorkspaceService();

