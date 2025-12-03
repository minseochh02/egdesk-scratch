/**
 * Read AppsScript File Tool
 * Reads the contents of a specific file from a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptReadFileTool implements ToolExecutor {
  name = 'apps_script_read_file';
  description = 'Read the contents of a specific file from a Google AppsScript project. The script content is stored in the EGDesk app\'s SQLite database (cloudmcp.db). Returns the source code of the file.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string; fileName: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.fileName) {
      throw new Error('fileName parameter is required');
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
      
      const file = templateCopy.scriptContent.files.find((f: any) => f.name === params.fileName);
      
      if (!file) {
        const availableFiles = templateCopy.scriptContent.files.map((f: any) => f.name).join(', ');
        throw new Error(
          `File '${params.fileName}' not found in AppsScript project '${params.scriptId}'. ` +
          `Available files: ${availableFiles}`
        );
      }
      
      if (!file.source) {
        throw new Error(`File '${params.fileName}' has no source content`);
      }
      
      console.log(`📖 Successfully read AppsScript file: ${params.fileName} (${file.source.length} characters)`);
      return file.source;
    } catch (error) {
      const errorMsg = `Failed to read AppsScript file '${params.fileName}' from project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}


