/**
 * Apps Script Push to DEV Tool
 * Pushes local changes to the DEV Google Apps Script project
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';
import { getAuthService } from '../../auth/auth-service';

export class AppsScriptPushToDevTool implements ToolExecutor {
  name = 'apps_script_push_to_dev';
  description = `Push local changes to the DEV Google Apps Script project. This makes your local edits LIVE in the DEV environment.

IMPORTANT: This tool syncs your local code to the DEV Google Apps Script. After pushing:
- Changes are immediately live in the DEV spreadsheet
- You can test the code in the DEV environment
- Use this after making edits with apps_script_write_file or apps_script_partial_edit

Parameters:
- scriptId: The project ID (use the one from context)
- createVersion: (optional) Create an immutable version snapshot (default: false)
- versionDescription: (optional) Description for the version`;
  
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: { 
      scriptId: string; 
      createVersion?: boolean;
      versionDescription?: string;
    }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`Project '${params.scriptId}' not found in database`);
      }

      if (!templateCopy.devScriptId) {
        throw new Error(`Project '${params.scriptId}' does not have a DEV script configured. Please set up DEV environment first.`);
      }

      if (!templateCopy.scriptContent?.files) {
        throw new Error(`No local script content found. Please edit files first.`);
      }

      // Get OAuth token
      const authService = getAuthService();
      const token = await authService.getGoogleWorkspaceToken();
      
      if (!token?.access_token) {
        throw new Error('No Google OAuth token available. Please sign in with Google.');
      }

      // Push content to DEV script
      const files = templateCopy.scriptContent.files.map((f: any) => ({
        name: f.name,
        type: f.type,
        source: f.source
      }));

      console.log(`⬆️ Pushing ${files.length} files to DEV script: ${templateCopy.devScriptId}`);

      const updateResponse = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.devScriptId}/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files }),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(`Failed to push to DEV: ${errorData.error?.message || updateResponse.status}`);
      }

      let versionNumber: number | null = null;

      // Create version if requested
      if (params.createVersion) {
        const versionResponse = await fetch(
          `https://script.googleapis.com/v1/projects/${templateCopy.devScriptId}/versions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: params.versionDescription || `Push from AI at ${new Date().toISOString()}`
            }),
          }
        );

        if (versionResponse.ok) {
          const versionData = await versionResponse.json();
          versionNumber = versionData.versionNumber;
          console.log(`✅ Created DEV version ${versionNumber}`);
        }
      }

      const result = `✅ Successfully pushed ${files.length} files to DEV environment!` +
        (versionNumber ? ` Created version v${versionNumber}.` : '') +
        `\n\nYour changes are now LIVE in the DEV spreadsheet. You can test them there.`;

      console.log(result);
      return result;

    } catch (error) {
      const errorMsg = `Failed to push to DEV: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

