/**
 * Write AppsScript File Tool
 * Writes content to a file in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptWriteFileTool implements ToolExecutor {
  name = 'apps_script_write_file';
  description = 'Write content to a file in a Google AppsScript project. Creates the file if it doesn\'t exist, or overwrites it if it does. The script content is stored in the EGDesk app\'s SQLite database (cloudmcp.db).';
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: { scriptId: string; fileName: string; content: string; fileType?: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.fileName) {
      throw new Error('fileName parameter is required');
    }
    
    if (params.content === undefined) {
      throw new Error('content parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      // Get current script content or initialize
      const scriptContent = templateCopy.scriptContent || { files: [] };
      const existingFiles = scriptContent.files || [];
      
      // Check if file exists
      const existingFileIndex = existingFiles.findIndex((f: any) => f.name === params.fileName);
      const fileType = params.fileType || 'SERVER_JS';
      
      // Update or add file
      if (existingFileIndex >= 0) {
        existingFiles[existingFileIndex].source = params.content;
        existingFiles[existingFileIndex].type = fileType;
      } else {
        existingFiles.push({
          name: params.fileName,
          type: fileType,
          source: params.content
        });
      }
      
      // Update script content in database
      const updatedScriptContent = {
        ...scriptContent,
        files: existingFiles
      };
      
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, updatedScriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const action = existingFileIndex >= 0 ? 'updated' : 'created';
      const result = `Successfully ${action} AppsScript file '${params.fileName}' (${params.content.length} characters)`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to write AppsScript file '${params.fileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async shouldConfirm(params: { scriptId: string; fileName: string; content: string }): Promise<ToolCallConfirmationDetails | false> {
    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        return {
          toolName: this.name,
          parameters: params,
          description: `AppsScript project '${params.scriptId}' not found in database`,
          risks: ['Cannot write to a project that does not exist'],
          autoApprove: false
        };
      }
      
      const scriptContent = templateCopy.scriptContent || { files: [] };
      const existingFiles = scriptContent.files || [];
      const fileExists = existingFiles.some((f: any) => f.name === params.fileName);
      
      return {
        toolName: this.name,
        parameters: params,
        description: fileExists 
          ? `Overwrite existing AppsScript file: ${params.fileName} in project ${params.scriptId}`
          : `Create new AppsScript file: ${params.fileName} in project ${params.scriptId}`,
        risks: fileExists 
          ? ['Will overwrite existing file content', 'Original content will be lost']
          : ['Will create a new file in the AppsScript project'],
        autoApprove: false
      };
    } catch (error) {
      return {
        toolName: this.name,
        parameters: params,
        description: `Write AppsScript file: ${params.fileName}`,
        risks: ['Could not verify if file exists'],
        autoApprove: false
      };
    }
  }
}

