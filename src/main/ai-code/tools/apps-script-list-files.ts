/**
 * List AppsScript Files Tool
 * Lists all files in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

/**
 * Get display name with extension for user-friendly output
 */
function getDisplayName(file: { name: string; type: string }): string {
  const type = (file.type || 'server_js').toLowerCase();
  if (type === 'server_js') return `${file.name}.gs`;
  if (type === 'html') return `${file.name}.html`;
  if (type === 'json') return `${file.name}.json`;
  return file.name;
}

export class AppsScriptListFilesTool implements ToolExecutor {
  name = 'apps_script_list_files';
  description = 'List all files in a Google Apps Script project. Projects may have both DEV and PROD scripts - use the scriptId provided in the context (defaults to DEV if available). Returns file names with extensions.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<Array<{name: string; displayName: string; type: string; hasSource: boolean}>> {
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
      
      // Return both internal name and display name (with extension)
      return templateCopy.scriptContent.files.map((file: any) => ({
        name: file.name,
        displayName: getDisplayName(file),  // "Code.gs", "index.html", etc.
        type: file.type || 'server_js',
        hasSource: !!file.source
      }));
    } catch (error) {
      const errorMsg = `Failed to list AppsScript files for project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}


