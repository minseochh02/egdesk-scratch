/**
 * Rename AppsScript File Tool
 * Renames a file in a Google AppsScript project stored in SQLite
 */

import type { ToolExecutor } from '../../types/ai-types';
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

export class AppsScriptRenameFileTool implements ToolExecutor {
  name = 'apps_script_rename_file';
  description = 'Rename a file in a Google Apps Script project. Projects may have both DEV and PROD scripts - use the scriptId provided in the context (defaults to DEV if available).';
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
      
      // Find the file to rename (handles both normalized and legacy formats)
      const fileIndex = findFileIndex(templateCopy.scriptContent.files, params.oldFileName);
      if (fileIndex < 0) {
        const availableFiles = templateCopy.scriptContent.files
          .map((f: any) => getDisplayName(f))
          .join(', ');
        throw new Error(
          `File '${params.oldFileName}' not found in AppsScript project '${params.scriptId}'. ` +
          `Available files: [${availableFiles || 'none'}]`
        );
      }
      
      // Normalize the new name
      const normalizedNew = normalizeFileName(params.newFileName);
      
      // Check if new name already exists
      const existingNewIndex = findFileIndex(templateCopy.scriptContent.files, params.newFileName);
      if (existingNewIndex >= 0 && existingNewIndex !== fileIndex) {
        throw new Error(`File '${params.newFileName}' already exists in AppsScript project '${params.scriptId}'`);
      }
      
      // Rename the file using normalized format
      templateCopy.scriptContent.files[fileIndex].name = normalizedNew.name;
      templateCopy.scriptContent.files[fileIndex].type = normalizedNew.type;
      
      // Update script content in database
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, templateCopy.scriptContent);
      
      if (!updated) {
        const errorDetail = `Project not found with scriptId or devScriptId: ${params.scriptId}. Check logs for details.`;
        throw new Error(`Failed to update script content in database: ${errorDetail}`);
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


