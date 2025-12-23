/**
 * Delete AppsScript File Tool
 * Deletes a file from a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

/**
 * Normalize file name to Google Apps Script format
 */
function normalizeFileName(fileName: string): { name: string; type: string } {
  let name = fileName;
  let type = 'server_js';
  
  if (fileName.endsWith('.gs')) {
    name = fileName.replace(/\.gs$/, '');
    type = 'server_js';
  } else if (fileName.endsWith('.html')) {
    name = fileName.replace(/\.html$/, '');
    type = 'html';
  } else if (fileName.endsWith('.json')) {
    name = fileName.replace(/\.json$/, '');
    type = 'json';
  }
  
  return { name, type };
}

/**
 * Find file index in files array, handling both formats
 */
function findFileIndex(files: any[], fileName: string): number {
  const normalized = normalizeFileName(fileName);
  
  // Try normalized format first
  let index = files.findIndex((f: any) => 
    f.name === normalized.name && f.type.toLowerCase() === normalized.type.toLowerCase()
  );
  
  if (index >= 0) return index;
  
  // Try exact match (legacy)
  index = files.findIndex((f: any) => f.name === fileName);
  
  if (index >= 0) return index;
  
  // Try just base name
  return files.findIndex((f: any) => f.name === normalized.name);
}

/**
 * Get display name with extension
 */
function getDisplayName(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase();
  if (type === 'server_js') return `${file.name}.gs`;
  if (type === 'html') return `${file.name}.html`;
  if (type === 'json') return `${file.name}.json`;
  return file.name;
}

export class AppsScriptDeleteFileTool implements ToolExecutor {
  name = 'apps_script_delete_file';
  description = 'Delete a file from a Google Apps Script project. Projects may have both DEV and PROD scripts - use the scriptId provided in the context (defaults to DEV if available). CAUTION: This permanently removes the file.';
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
      
      // Check if file exists (handles both normalized and legacy formats)
      const existingFileIndex = findFileIndex(existingFiles, params.fileName);
      
      if (existingFileIndex < 0) {
        const availableFiles = existingFiles.map((f: any) => getDisplayName(f)).join(', ');
        throw new Error(
          `File '${params.fileName}' not found in AppsScript project '${params.scriptId}'. ` +
          `Available files: [${availableFiles || 'none'}]`
        );
      }
      
      // Get actual file name from DB for backup
      const actualFileName = existingFiles[existingFileIndex].name;
      
      // Create backup before deleting (for undo functionality)
      if (conversationId) {
        await this.createBackup(params.scriptId, actualFileName, existingFiles, conversationId);
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
        const errorDetail = `Project not found with scriptId or devScriptId: ${params.scriptId}. Check logs for details.`;
        throw new Error(`Failed to update script content in database: ${errorDetail}`);
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

