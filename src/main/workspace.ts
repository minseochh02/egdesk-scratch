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
   * Copy template content to a new spreadsheet
   * Creates a new spreadsheet and copies all sheets, data, formatting, and Apps Script
   */
  async copyTemplateContent(templateContent: any): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    scriptId?: string;
    appsScriptError?: {
      code: string;
      message: string;
      action?: string;
      url?: string;
    };
  }> {
    try {
      const auth = await this.initializeOAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      const script = google.script({ version: 'v1', auth });

      // Step 1: Prepare sheets array with all data and formatting
      // Create spreadsheet with all content in one request
      const title = templateContent.properties?.title || 'Copied Spreadsheet';
      
      const sheetsArray: any[] = [];
      
      if (templateContent.sheets && templateContent.sheets.length > 0) {
        for (const templateSheet of templateContent.sheets) {
          const sheetData: any = {
            properties: {
              title: templateSheet.properties.title,
              sheetType: templateSheet.properties.sheetType,
              gridProperties: templateSheet.properties.gridProperties,
            },
          };

          // Include data with formatting if present
          if (templateSheet.data && templateSheet.data.length > 0) {
            sheetData.data = templateSheet.data.map((gridData: any) => ({
              startRow: gridData.startRow || 0,
              startColumn: gridData.startColumn || 0,
              rowData: gridData.rowData || [],
            }));
          }

          sheetsArray.push(sheetData);
        }
      }

      // Step 2: Create spreadsheet with all sheets, data, and formatting in one request
      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title,
            locale: templateContent.properties?.locale,
            timeZone: templateContent.properties?.timeZone,
          },
          sheets: sheetsArray,
        },
      });

      if (!createResponse.data.spreadsheetId) {
        throw new Error('Failed to create spreadsheet: No spreadsheet ID returned');
      }

      const spreadsheetId = createResponse.data.spreadsheetId;
      console.log(`✅ Created spreadsheet with ${sheetsArray.length} sheets and all data/formatting: ${spreadsheetId}`);

      // Step 6: Add Apps Script if present
      let scriptId: string | undefined;
      let appsScriptError: { code: string; message: string; action?: string; url?: string } | undefined;

      if (templateContent.appsScript && templateContent.appsScript.files) {
        console.log('📜 Starting Apps Script creation...', {
          platform: process.platform,
          spreadsheetId: spreadsheetId,
          hasFiles: !!templateContent.appsScript.files,
          filesCount: templateContent.appsScript.files.length,
          scriptId: templateContent.appsScript.scriptId,
        });
        try {
          // Create Apps Script project
          console.log('📜 Creating Apps Script project...', {
            title: templateContent.appsScript.scriptId || 'Copied Script',
            parentId: spreadsheetId,
          });
          const createScriptResponse = await script.projects.create({
            requestBody: {
              title: templateContent.appsScript.scriptId || 'Copied Script',
              parentId: spreadsheetId,
            },
          });
          
          console.log('📜 Apps Script project create response:', {
            hasScriptId: !!createScriptResponse.data?.scriptId,
            scriptId: createScriptResponse.data?.scriptId,
            status: createScriptResponse.status,
            statusText: createScriptResponse.statusText,
          });

          if (createScriptResponse.data.scriptId) {
            scriptId = createScriptResponse.data.scriptId;
            console.log('📜 Apps Script project created successfully:', scriptId);

            // Update script content with all files from template
            const scriptFiles = templateContent.appsScript.files.map((file: any) => ({
              name: file.name,
              type: file.type,
              source: file.source || '',
              functionSet: file.functionSet,
            }));

            console.log('📜 Updating Apps Script content...', {
              scriptId: scriptId,
              filesCount: scriptFiles.length,
              fileNames: scriptFiles.map((f: any) => f.name),
            });

            await script.projects.updateContent({
              scriptId: scriptId,
              requestBody: {
                files: scriptFiles,
              },
            });

            console.log(`✅ Copied Apps Script with ${scriptFiles.length} files`);
          } else {
            console.warn('⚠️ Apps Script project created but no scriptId returned:', createScriptResponse.data);
          }
        } catch (scriptError: any) {
          // Check for the specific "User has not enabled the Apps Script API" error
          const errorMessage = scriptError.message || '';
          if (errorMessage.includes('User has not enabled the Apps Script API')) {
            console.warn('⚠️ Apps Script API disabled by user');
            appsScriptError = {
              code: 'APPS_SCRIPT_API_DISABLED',
              message: 'Google Apps Script API is disabled for your account.',
              action: 'Enable Google Apps Script API',
              url: 'https://script.google.com/home/usersettings',
            };
          } else {
          // Log full error details for debugging (especially on Windows)
          console.error('❌ Failed to copy Apps Script:', {
            message: scriptError.message,
            code: scriptError.code,
            status: scriptError.response?.status,
            statusText: scriptError.response?.statusText,
            data: scriptError.response?.data,
            errors: scriptError.errors,
            stack: scriptError.stack,
            platform: process.platform,
            spreadsheetId: spreadsheetId,
            hasFiles: !!templateContent.appsScript?.files,
            filesCount: templateContent.appsScript?.files?.length || 0,
          });
            appsScriptError = {
              code: scriptError.code || 'UNKNOWN_ERROR',
              message: scriptError.message || 'Failed to copy Apps Script',
            };
          }
          console.warn('⚠️ Continuing without Apps Script - it\'s optional');
          // Continue without Apps Script - it's optional
        }
      }

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      return {
        spreadsheetId,
        spreadsheetUrl,
        scriptId,
        appsScriptError,
      };
    } catch (error: any) {
      console.error('Error copying template content:', error);
      throw new Error(`Failed to copy template content: ${error.message}`);
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

    // Copy template content to new spreadsheet
    ipcMain.handle('workspace:copy-template-content', async (_, templateContent: any) => {
      try {
        const result = await this.copyTemplateContent(templateContent);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    console.log('✅ Google Workspace service IPC handlers registered');
  }
}

// Export singleton instance
export const googleWorkspaceService = new GoogleWorkspaceService();

