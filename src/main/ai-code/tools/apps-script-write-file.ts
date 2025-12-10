/**
 * Write AppsScript File Tool
 * Writes content to a file in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

/**
 * Normalize file name to Google Apps Script format
 * "Code.gs" → { name: "Code", type: "server_js" }
 * "index.html" → { name: "index", type: "html" }
 * "appsscript.json" → { name: "appsscript", type: "json" }
 */
function normalizeFileName(fileName: string): { name: string; type: string } {
  // Strip extension and determine type
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
  // If no extension, keep as-is (already normalized)
  
  return { name, type };
}

/**
 * Find file in files array, handling both formats:
 * - Normalized: { name: "Code", type: "server_js" }
 * - Legacy: { name: "Code.gs", type: "SERVER_JS" }
 */
function findFileIndex(files: any[], fileName: string): number {
  const normalized = normalizeFileName(fileName);
  
  // Try normalized format first (preferred)
  let index = files.findIndex((f: any) => 
    f.name === normalized.name && f.type.toLowerCase() === normalized.type.toLowerCase()
  );
  
  if (index >= 0) return index;
  
  // Try exact match (legacy format with extension)
  index = files.findIndex((f: any) => f.name === fileName);
  
  if (index >= 0) return index;
  
  // Try matching just the base name (fallback)
  index = files.findIndex((f: any) => f.name === normalized.name);
  
  return index;
}

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
      
      // Normalize the file name to Google's format (strip extension, determine type)
      const normalized = normalizeFileName(params.fileName);
      const fileType = params.fileType?.toLowerCase() || normalized.type;
      
      // Check if file exists (handles both normalized and legacy formats)
      const existingFileIndex = findFileIndex(existingFiles, params.fileName);
      
      // Create backup before modifying (for undo functionality)
      if (conversationId) {
        await this.createBackup(params.scriptId, normalized.name, existingFiles, conversationId);
      }
      
      // Update or add file using normalized format (Google's format)
      if (existingFileIndex >= 0) {
        existingFiles[existingFileIndex].source = params.content;
        existingFiles[existingFileIndex].type = fileType;
        // Also normalize the name if it was in legacy format
        existingFiles[existingFileIndex].name = normalized.name;
      } else {
        existingFiles.push({
          name: normalized.name,  // Store without extension (Google's format)
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
    fileName: string,  // Already normalized (no extension)
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
      
      // Find existing file content (fileName is already normalized)
      const file = files.find(f => f.name === fileName || f.name === fileName.replace(/\.(gs|html|json)$/, ''));
      
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
      const fileExists = findFileIndex(existingFiles, params.fileName) >= 0;
      
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

