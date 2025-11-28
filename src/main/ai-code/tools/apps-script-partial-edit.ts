/**
 * Partial Edit AppsScript File Tool
 * Edits a file in a Google AppsScript project with search/replace functionality
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

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
  description = 'Replace text within a file in a Google AppsScript project. Supports partial edits with exact or flexible matching. The script content is stored in the EGDesk app\'s SQLite database (cloudmcp.db).';
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
      
      // Find the file
      const fileIndex = templateCopy.scriptContent.files.findIndex((f: any) => f.name === params.fileName);
      if (fileIndex < 0) {
        throw new Error(`File '${params.fileName}' not found in AppsScript project '${params.scriptId}'`);
      }
      
      const file = templateCopy.scriptContent.files[fileIndex];
      if (!file.source) {
        throw new Error(`File '${params.fileName}' has no source content`);
      }
      
      const currentContent = file.source;
      
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
        throw new Error(`Failed to update script content in database`);
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

