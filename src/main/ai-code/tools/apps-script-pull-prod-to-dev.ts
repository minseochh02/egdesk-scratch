/**
 * Apps Script Pull PROD to DEV Tool
 * Syncs DEV with the latest PRODUCTION code
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';
import { getAuthService } from '../../auth/auth-service';

export class AppsScriptPullProdToDevTool implements ToolExecutor {
  name = 'apps_script_pull_prod_to_dev';
  description = `Sync DEV environment with the latest PRODUCTION code.

This copies PROD code to DEV, useful when:
- Starting fresh development based on current production
- Resetting DEV to match PROD after experiments
- Ensuring DEV has the latest production baseline

This will overwrite any changes in DEV that haven't been pushed to PROD.

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

      if (!templateCopy.scriptId) {
        throw new Error(`Project '${params.scriptId}' does not have a PROD script configured.`);
      }

      // Get OAuth token
      const authService = getAuthService();
      const token = await authService.getGoogleWorkspaceToken();
      
      if (!token?.access_token) {
        throw new Error('No Google OAuth token available. Please sign in with Google.');
      }

      console.log(`⬇️ Syncing PROD → DEV`);
      console.log(`   PROD Script: ${templateCopy.scriptId}`);
      console.log(`   DEV Script: ${templateCopy.devScriptId}`);

      // Step 1: Get content from PROD script
      const prodResponse = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.scriptId}/content`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
          },
        }
      );

      if (!prodResponse.ok) {
        const errorData = await prodResponse.json().catch(() => ({}));
        throw new Error(`Failed to get PROD content: ${errorData.error?.message || prodResponse.status}`);
      }

      const prodData = await prodResponse.json();
      const files = prodData.files || [];

      // Step 2: Push content to DEV script
      console.log(`⬆️ Copying ${files.length} files to DEV...`);

      const devResponse = await fetch(
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

      if (!devResponse.ok) {
        const errorData = await devResponse.json().catch(() => ({}));
        throw new Error(`Failed to update DEV: ${errorData.error?.message || devResponse.status}`);
      }

      // Step 3: Also update local copy to match
      const scriptContent = {
        ...templateCopy.scriptContent,
        files: files.map((f: any) => ({
          name: f.name,
          type: f.type,
          source: f.source
        }))
      };

      templateCopiesManager.updateTemplateCopyScriptContent(
        templateCopy.scriptId || templateCopy.devScriptId!,
        scriptContent
      );

      const result = `✅ Successfully synced PROD → DEV!\n\n` +
        `${files.length} files copied from PRODUCTION to DEV\n` +
        `Local copy also updated to match.\n\n` +
        `DEV environment now matches PRODUCTION.`;

      console.log(result);
      return result;

    } catch (error) {
      const errorMsg = `Failed to sync PROD to DEV: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

