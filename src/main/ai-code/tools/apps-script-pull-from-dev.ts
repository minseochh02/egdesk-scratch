/**
 * Apps Script Pull from DEV Tool
 * Pulls the latest code from DEV Google Apps Script to local
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';
import { getAuthService } from '../../auth/auth-service';

export class AppsScriptPullFromDevTool implements ToolExecutor {
  name = 'apps_script_pull_from_dev';
  description = `Pull the latest code from the DEV Google Apps Script project to local.

This overwrites your local changes with the code currently in the DEV environment.
Use this when you want to sync your local copy with what's deployed in DEV.

Parameters:
- scriptId: The project ID (use the one from context)`;
  
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: { scriptId: string }, 
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
        throw new Error(`Project '${params.scriptId}' does not have a DEV script configured.`);
      }

      // Get OAuth token
      const authService = getAuthService();
      const token = await authService.getGoogleWorkspaceToken();
      
      if (!token?.access_token) {
        throw new Error('No Google OAuth token available. Please sign in with Google.');
      }

      console.log(`⬇️ Pulling from DEV script: ${templateCopy.devScriptId}`);

      // Get content from DEV script
      const response = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.devScriptId}/content`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to pull from DEV: ${errorData.error?.message || response.status}`);
      }

      const data = await response.json();
      const files = data.files || [];

      // Update local script content
      const scriptContent = {
        ...templateCopy.scriptContent,
        files: files.map((f: any) => ({
          name: f.name,
          type: f.type,
          source: f.source
        }))
      };

      // Save to database - try both scriptId and devScriptId
      let updated = templateCopiesManager.updateTemplateCopyScriptContent(
        templateCopy.scriptId || templateCopy.devScriptId!,
        scriptContent
      );

      if (!updated && templateCopy.devScriptId) {
        updated = templateCopiesManager.updateTemplateCopyScriptContent(
          templateCopy.devScriptId,
          scriptContent
        );
      }

      if (!updated) {
        throw new Error('Failed to save pulled content to local database');
      }

      const result = `✅ Successfully pulled ${files.length} files from DEV to local!\n\n` +
        `Files: ${files.map((f: any) => f.name).join(', ')}\n\n` +
        `Your local copy now matches the DEV environment.`;

      console.log(result);
      return result;

    } catch (error) {
      const errorMsg = `Failed to pull from DEV: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

