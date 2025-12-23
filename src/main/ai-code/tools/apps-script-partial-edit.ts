/**
 * Partial Edit AppsScript File Tool
 * Edits a file in a Google AppsScript project with search/replace functionality
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

/**
 * Get display name with extension for user-friendly output
 */
function getDisplayName(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase();
  if (type === 'server_js') return `${file.name}.gs`;
  if (type === 'html') return `${file.name}.html`;
  if (type === 'json') return `${file.name}.json`;
  return file.name;
}

export interface AppsScriptPartialEditParams {
  scriptId: string;
  fileName: string;
  oldString: string;
  newString: string;
  expectedReplacements?: number;
  flexibleMatching?: boolean;
}

export class AppsScriptPartialEditTool implements ToolExecutor {
  name = 'apps_script_partial_edit';
  description = 'Replace text within a file in a Google Apps Script project. Supports partial edits with exact or flexible matching. Projects may have both DEV and PROD scripts - use the scriptId provided in the context (defaults to DEV if available). Changes to DEV should be tested before pushing to PROD.';
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: AppsScriptPartialEditParams, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId || !params.fileName || params.oldString === undefined || params.newString === undefined) {
      throw new Error('scriptId, fileName, oldString, and newString parameters are required');
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
      
      // Find the file (handles both normalized and legacy formats)
      const fileIndex = findFileIndex(templateCopy.scriptContent.files, params.fileName);
      if (fileIndex < 0) {
        // List available files with display names (with extensions) to help the AI
        const availableFiles = templateCopy.scriptContent.files
          .map((f: any) => getDisplayName(f))
          .join(', ');
        throw new Error(
          `File '${params.fileName}' not found in AppsScript project. ` +
          `Available files: [${availableFiles || 'none'}]. ` +
          `Use 'apps_script_write_file' to create new files first.`
        );
      }
      
      const file = templateCopy.scriptContent.files[fileIndex];
      if (!file.source) {
        throw new Error(`File '${params.fileName}' has no source content`);
      }
      
      const currentContent = file.source;
      
      // Create backup before modifying (use the actual file name from DB)
      const actualFileName = templateCopy.scriptContent.files[fileIndex].name;
      if (conversationId) {
        await this.createBackup(params.scriptId, actualFileName, templateCopy.scriptContent.files, conversationId);
      }
      
      // Perform replacement (similar to partial-edit.ts logic)
      const replacementResult = this.calculateReplacement(
        currentContent,
        params.oldString,
        params.newString,
        params.flexibleMatching ?? true
      );
      
      const expectedReplacements = params.expectedReplacements ?? 1;
      
      if (replacementResult.occurrences === 0) {
        throw new Error(`Failed to edit: Could not find the string to replace in ${params.fileName}`);
      }
      
      if (replacementResult.occurrences !== expectedReplacements) {
        throw new Error(`Failed to edit: Expected ${expectedReplacements} occurrence(s) but found ${replacementResult.occurrences}`);
      }
      
      // Update the file
      templateCopy.scriptContent.files[fileIndex].source = replacementResult.newContent;
      
      // Update script content in database
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, templateCopy.scriptContent);
      
      if (!updated) {
        const errorDetail = `Project not found with scriptId or devScriptId: ${params.scriptId}. Check logs for details.`;
        throw new Error(`Failed to update script content in database: ${errorDetail}`);
      }
      
      const result = `Successfully replaced ${replacementResult.occurrences} occurrence(s) in AppsScript file ${params.fileName}`;
      console.log(`✏️ ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to edit AppsScript file '${params.fileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  private async createBackup(
    scriptId: string, 
    fileName: string,  // This is the actual name from the DB (normalized, no extension)
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
      
      // Find existing file content (fileName is the actual DB name)
      const file = files.find(f => f.name === fileName);
      
      if (!file) return; // Should be handled by caller validation, but safe guard
      
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
        isNewFile: false
      };
      
      await fs.promises.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');
      await fs.promises.writeFile(backupFilePath, file.source || '', 'utf-8');
      console.log(`📚 Backed up AppsScript file for partial edit: ${fileName}`);
      
    } catch (error) {
      console.error('❌ Failed to create AppsScript backup:', error);
    }
  }

  private calculateReplacement(
    currentContent: string,
    oldString: string,
    newString: string,
    flexibleMatching: boolean
  ): { newContent: string; occurrences: number } {
    // Normalize line endings
    const normalizedCode = currentContent.replace(/\r\n/g, '\n');
    const normalizedSearch = oldString.replace(/\r\n/g, '\n');
    const normalizedReplace = newString.replace(/\r\n/g, '\n');

    // Try exact replacement first
    const exactOccurrences = normalizedCode.split(normalizedSearch).length - 1;
    if (exactOccurrences > 0) {
      const modifiedCode = normalizedCode.replaceAll(normalizedSearch, normalizedReplace);
      return {
        newContent: this.restoreTrailingNewline(currentContent, modifiedCode),
        occurrences: exactOccurrences
      };
    }

    // Try flexible matching if enabled
    if (flexibleMatching) {
      const sourceLines = normalizedCode.split('\n');
      const searchLinesStripped = normalizedSearch.split('\n').map(l => l.trim());
      const replaceLines = normalizedReplace.split('\n');
      
      let flexibleOccurrences = 0;
      let i = 0;
      
      while (i <= sourceLines.length - searchLinesStripped.length) {
        const window = sourceLines.slice(i, i + searchLinesStripped.length);
        const windowStripped = window.map((line: string) => line.trim());
        const isMatch = windowStripped.every(
          (line: string, index: number) => line === searchLinesStripped[index]
        );

        if (isMatch) {
          flexibleOccurrences++;
          const firstLineInMatch = window[0];
          const indentationMatch = firstLineInMatch.match(/^(\s*)/);
          const indentation = indentationMatch ? indentationMatch[1] : '';
          const newBlockWithIndent = replaceLines.map(
            (line: string) => `${indentation}${line}`
          );
          sourceLines.splice(
            i,
            searchLinesStripped.length,
            newBlockWithIndent.join('\n')
          );
          i += replaceLines.length;
        } else {
          i++;
        }
      }

      if (flexibleOccurrences > 0) {
        let modifiedCode = sourceLines.join('\n');
        modifiedCode = this.restoreTrailingNewline(currentContent, modifiedCode);
        return {
          newContent: modifiedCode,
          occurrences: flexibleOccurrences
        };
      }
    }

    return { newContent: currentContent, occurrences: 0 };
  }

  private restoreTrailingNewline(originalContent: string, modifiedContent: string): string {
    const hadTrailingNewline = originalContent.endsWith('\n');
    if (hadTrailingNewline && !modifiedContent.endsWith('\n')) {
      return modifiedContent + '\n';
    } else if (!hadTrailingNewline && modifiedContent.endsWith('\n')) {
      return modifiedContent.replace(/\n$/, '');
    }
    return modifiedContent;
  }

  async shouldConfirm(params: AppsScriptPartialEditParams): Promise<ToolCallConfirmationDetails | false> {
    return {
      toolName: this.name,
      parameters: params,
      description: `Edit AppsScript file: ${params.fileName} in project ${params.scriptId}\n\nReplace:\n${params.oldString}\n\nWith:\n${params.newString}`,
      risks: [
        'Will modify existing file content',
        'Original content will be changed',
        'Make sure oldString matches exactly including whitespace'
      ],
      autoApprove: false
    };
  }
}

