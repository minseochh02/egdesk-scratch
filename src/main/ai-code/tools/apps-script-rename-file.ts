/**
 * Rename AppsScript File Tool
 * Renames a file in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptRenameFileTool implements ToolExecutor {
  name = 'apps_script_rename_file';
  description = 'Rename a file in a Google AppsScript project. The script content is stored in the EGDesk app\'s SQLite database (cloudmcp.db).';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string; oldFileName: string; newFileName: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.oldFileName) {
      throw new Error('oldFileName parameter is required');
    }
    
    if (!params.newFileName) {
      throw new Error('newFileName parameter is required');
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
        throw new Error(`No files found in AppsScript project '${params.scriptId}'`);
      }
      
      // Find the file to rename
      const fileIndex = templateCopy.scriptContent.files.findIndex((f: any) => f.name === params.oldFileName);
      if (fileIndex < 0) {
        throw new Error(`File '${params.oldFileName}' not found in AppsScript project '${params.scriptId}'`);
      }
      
      // Check if new name already exists
      if (templateCopy.scriptContent.files.some((f: any) => f.name === params.newFileName)) {
        throw new Error(`File '${params.newFileName}' already exists in AppsScript project '${params.scriptId}'`);
      }
      
      // Rename the file
      templateCopy.scriptContent.files[fileIndex].name = params.newFileName;
      
      // Update script content in database
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, templateCopy.scriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const result = `Successfully renamed AppsScript file from '${params.oldFileName}' to '${params.newFileName}'`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to rename AppsScript file '${params.oldFileName}' to '${params.newFileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}


