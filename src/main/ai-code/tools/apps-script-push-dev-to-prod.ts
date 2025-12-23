/**
 * Apps Script Push DEV to PROD Tool
 * Pushes code from DEV to PRODUCTION - DANGEROUS operation
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';
import { getAuthService } from '../../auth/auth-service';

export class AppsScriptPushDevToProdTool implements ToolExecutor {
  name = 'apps_script_push_dev_to_prod';
  description = `⚠️ DANGEROUS: Push code from DEV to PRODUCTION Google Apps Script.

This makes DEV changes LIVE in PRODUCTION. Use with extreme caution!

ONLY use this tool when:
1. The user has explicitly requested to push to production
2. Changes have been tested in DEV
3. You've confirmed with the user they want to deploy

This will:
- Copy all code from DEV script to PROD script
- Make changes immediately live in the production spreadsheet
- Create a version snapshot for rollback

Parameters:
- scriptId: The project ID (use the one from context)
- versionDescription: (optional) Description for the production version`;
  
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: { 
      scriptId: string;
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

      console.log(`🚨 DEPLOYING DEV → PROD`);
      console.log(`   DEV Script: ${templateCopy.devScriptId}`);
      console.log(`   PROD Script: ${templateCopy.scriptId}`);

      // Step 1: Get content from DEV script
      const devResponse = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.devScriptId}/content`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
          },
        }
      );

      if (!devResponse.ok) {
        const errorData = await devResponse.json().catch(() => ({}));
        throw new Error(`Failed to get DEV content: ${errorData.error?.message || devResponse.status}`);
      }

      const devData = await devResponse.json();
      const files = devData.files || [];

      // Step 2: Push content to PROD script
      console.log(`⬆️ Pushing ${files.length} files to PROD...`);

      const prodResponse = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.scriptId}/content`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files }),
        }
      );

      if (!prodResponse.ok) {
        const errorData = await prodResponse.json().catch(() => ({}));
        throw new Error(`Failed to push to PROD: ${errorData.error?.message || prodResponse.status}`);
      }

      // Step 3: Create version in PROD for rollback capability
      let versionNumber: number | null = null;
      const versionResponse = await fetch(
        `https://script.googleapis.com/v1/projects/${templateCopy.scriptId}/versions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: params.versionDescription || `Deploy from DEV at ${new Date().toISOString()}`
          }),
        }
      );

      if (versionResponse.ok) {
        const versionData = await versionResponse.json();
        versionNumber = versionData.versionNumber;
        console.log(`✅ Created PROD version ${versionNumber}`);
      }

      const result = `🚀 Successfully deployed DEV → PROD!\n\n` +
        `✅ ${files.length} files pushed to PRODUCTION\n` +
        (versionNumber ? `✅ Created version v${versionNumber} for rollback\n` : '') +
        `\n⚠️ Changes are now LIVE in the production spreadsheet!`;

      console.log(result);
      return result;

    } catch (error) {
      const errorMsg = `Failed to push DEV to PROD: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

