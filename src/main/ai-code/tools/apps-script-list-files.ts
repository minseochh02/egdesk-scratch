/**
 * List AppsScript Files Tool
 * Lists all files in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptListFilesTool implements ToolExecutor {
  name = 'apps_script_list_files';
  description = 'List all files in a Google AppsScript project. The script content is stored in the EGDesk app\'s SQLite database (cloudmcp.db).';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<Array<{name: string; type: string; hasSource: boolean}>> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      if (!templateCopy.scriptContent || !templateCopy.scriptContent.files) {
        return [];
      }
      
      return templateCopy.scriptContent.files.map((file: any) => ({
        name: file.name,
        type: file.type || 'SERVER_JS',
        hasSource: !!file.source
      }));
    } catch (error) {
      const errorMsg = `Failed to list AppsScript files for project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

