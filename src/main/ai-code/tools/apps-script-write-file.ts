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
      
      // Create backup before modifying (for undo functionality)
      if (conversationId) {
        await this.createBackup(params.scriptId, params.fileName, existingFiles, conversationId);
      }
      
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
      
      // Define backup file path (using a safe name to avoid issues with slashes)
      // We prefix with appsscript_ to distinguish from local file backups
      const safeFileName = fileName.replace(/[\/\\]/g, '_');
      const backupFilePath = path.join(conversationBackupDir, `appsscript_${scriptId}_${safeFileName}`);
      
      // Metadata file to store original path/name and context
      const metaFilePath = backupFilePath + '.meta.json';
      
      const metadata = {
        originalPath: fileName, // For AppsScript, this is the file name/path in the project
        scriptId: scriptId,
        type: 'appsscript', // Marker to identify this as an AppsScript file backup
        fileType: file?.type,
        isNewFile: !file // If file didn't exist, it's new
      };
      
      await fs.promises.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');
      
      if (file) {
        // Backup existing content
        await fs.promises.writeFile(backupFilePath, file.source || '', 'utf-8');
        console.log(`📚 Backed up AppsScript file: ${fileName}`);
      } else {
        // New file - just creating metadata implies deletion on revert
        console.log(`📚 Registered new AppsScript file for backup tracking: ${fileName}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create AppsScript backup:', error);
      // Don't throw, just log - backup failure shouldn't block the write
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

