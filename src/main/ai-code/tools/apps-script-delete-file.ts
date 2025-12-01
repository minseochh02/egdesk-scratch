/**
 * Delete AppsScript File Tool
 * Deletes a file from a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptDeleteFileTool implements ToolExecutor {
  name = 'apps_script_delete_file';
  description = 'Delete a file from a Google AppsScript project. The change is stored in the EGDesk app\'s SQLite database (cloudmcp.db).';
  dangerous = true;
  requiresConfirmation = true;

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
      
      // Get current script content
      const scriptContent = templateCopy.scriptContent || { files: [] };
      const existingFiles = scriptContent.files || [];
      
      // Check if file exists
      const existingFileIndex = existingFiles.findIndex((f: any) => f.name === params.fileName);
      
      if (existingFileIndex < 0) {
        throw new Error(`File '${params.fileName}' not found in AppsScript project '${params.scriptId}'`);
      }
      
      // Create backup before deleting (for undo functionality)
      if (conversationId) {
        await this.createBackup(params.scriptId, params.fileName, existingFiles, conversationId);
      }
      
      // Remove file
      existingFiles.splice(existingFileIndex, 1);
      
      // Update script content in database
      const updatedScriptContent = {
        ...scriptContent,
        files: existingFiles
      };
      
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, updatedScriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const result = `Successfully deleted AppsScript file '${params.fileName}'`;
      console.log(`🗑️ ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to delete AppsScript file '${params.fileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  private async createBackup(
    scriptId: string, 
    fileName: string, 
    files: Array<{ name: string; type: string; source: string }>, 
    conversationId: string
  ): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const { app } = require('electron');
      
      // Get backups directory
      const userDataPath = app.getPath('userData');
      const backupsDir = path.join(userDataPath, 'backups');
      const conversationBackupDir = path.join(backupsDir, `conversation-${conversationId}-backup`);
      
      // Ensure directory exists
      await fs.promises.mkdir(conversationBackupDir, { recursive: true });
      
      // Find existing file content
      const file = files.find(f => f.name === fileName);
      
      if (!file) return;
      
      // Define backup file path
      const safeFileName = fileName.replace(/[\/\\]/g, '_');
      const backupFilePath = path.join(conversationBackupDir, `appsscript_${scriptId}_${safeFileName}`);
      
      // Metadata file
      const metaFilePath = backupFilePath + '.meta.json';
      
      const metadata = {
        originalPath: fileName,
        scriptId: scriptId,
        type: 'appsscript',
        fileType: file.type,
        isNewFile: false // File existed before deletion
      };
      
      await fs.promises.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');
      await fs.promises.writeFile(backupFilePath, file.source || '', 'utf-8');
      console.log(`📚 Backed up AppsScript file before deletion: ${fileName}`);
      
    } catch (error) {
      console.error('❌ Failed to create AppsScript backup:', error);
    }
  }

  async shouldConfirm(params: { scriptId: string; fileName: string }): Promise<ToolCallConfirmationDetails | false> {
    return {
      toolName: this.name,
      parameters: params,
      description: `Delete AppsScript file: ${params.fileName} from project ${params.scriptId}`,
      risks: [
        'File will be permanently deleted',
        'Cannot be undone unless backup is enabled'
      ],
      autoApprove: false
    };
  }
}

