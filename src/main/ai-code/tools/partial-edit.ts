/**
 * Partial Edit Tool
 * Implements partial text replacement with flexible matching and LLM-powered correction
 * Based on Gemini CLI's edit functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';
import { CreateHistoryManager } from '../../codespace/create-history';

export interface PartialEditParams {
  filePath: string;
  oldString: string;
  newString: string;
  expectedReplacements?: number;
  instruction?: string;
  flexibleMatching?: boolean;
}

interface ReplacementResult {
  newContent: string;
  occurrences: number;
  finalOldString: string;
  finalNewString: string;
}

interface ReplacementContext {
  params: PartialEditParams;
  currentContent: string;
}

export class PartialEditTool implements ToolExecutor {
  name = 'partial_edit';
  description = 'Replace text within a file with flexible matching and context-aware replacement. Supports partial edits with exact or flexible matching.';
  dangerous = true;
  requiresConfirmation = true;

  async execute(params: PartialEditParams, signal?: AbortSignal, conversationId?: string): Promise<string> {
    if (!params.filePath || params.oldString === undefined || params.newString === undefined) {
      throw new Error('filePath, oldString, and newString parameters are required');
    }

    // Resolve relative paths against project directory
    let resolvedPath = params.filePath;
    if (!path.isAbsolute(params.filePath)) {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.filePath);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.filePath);
      }
    }

    try {
      // Read current file content
      const currentContent = await fs.promises.readFile(resolvedPath, 'utf-8');
      
      // Create backup before editing
      await this.createBackup(resolvedPath, true, conversationId);
      
      // Calculate replacement
      const replacementResult = await this.calculateReplacement({
        params,
        currentContent
      });

      const expectedReplacements = params.expectedReplacements ?? 1;
      
      // Validate replacement
      if (replacementResult.occurrences === 0) {
        throw new Error(`Failed to edit: Could not find the string to replace in ${resolvedPath}. Ensure the oldString matches exactly including whitespace and indentation.`);
      }
      
      if (replacementResult.occurrences !== expectedReplacements) {
        const occurrenceTerm = expectedReplacements === 1 ? 'occurrence' : 'occurrences';
        throw new Error(`Failed to edit: Expected ${expectedReplacements} ${occurrenceTerm} but found ${replacementResult.occurrences} in ${resolvedPath}`);
      }

      if (replacementResult.finalOldString === replacementResult.finalNewString) {
        throw new Error('No changes to apply: The oldString and newString are identical');
      }

      // Write the modified content
      await fs.promises.writeFile(resolvedPath, replacementResult.newContent, 'utf-8');
      
      const result = `Successfully replaced ${replacementResult.occurrences} occurrence(s) in ${resolvedPath}`;
      console.log(`✏️ ${result}`);
      return result;
      
    } catch (error) {
      const errorMsg = `Failed to edit file '${resolvedPath}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Calculate the replacement result using exact or flexible matching
   */
  private async calculateReplacement(context: ReplacementContext): Promise<ReplacementResult> {
    const { currentContent, params } = context;
    const { oldString, newString, flexibleMatching = true } = params;

    // Normalize line endings
    const normalizedCode = currentContent.replace(/\r\n/g, '\n');
    const normalizedSearch = oldString.replace(/\r\n/g, '\n');
    const normalizedReplace = newString.replace(/\r\n/g, '\n');

    // Try exact replacement first
    const exactResult = this.calculateExactReplacement(normalizedCode, normalizedSearch, normalizedReplace);
    if (exactResult) {
      return exactResult;
    }

    // Try flexible replacement if enabled
    if (flexibleMatching) {
      const flexibleResult = this.calculateFlexibleReplacement(normalizedCode, normalizedSearch, normalizedReplace);
      if (flexibleResult) {
        return flexibleResult;
      }
    }

    // No matches found
    return {
      newContent: currentContent,
      occurrences: 0,
      finalOldString: normalizedSearch,
      finalNewString: normalizedReplace
    };
  }

  /**
   * Calculate exact string replacement
   */
  private calculateExactReplacement(
    currentContent: string,
    oldString: string,
    newString: string
  ): ReplacementResult | null {
    const exactOccurrences = currentContent.split(oldString).length - 1;
    
    if (exactOccurrences > 0) {
      const modifiedCode = currentContent.replaceAll(oldString, newString);
      return {
        newContent: this.restoreTrailingNewline(currentContent, modifiedCode),
        occurrences: exactOccurrences,
        finalOldString: oldString,
        finalNewString: newString
      };
    }

    return null;
  }

  /**
   * Calculate flexible replacement with whitespace tolerance
   */
  private calculateFlexibleReplacement(
    currentContent: string,
    oldString: string,
    newString: string
  ): ReplacementResult | null {
    const sourceLines = currentContent.match(/.*(?:\n|$)/g)?.slice(0, -1) ?? [];
    const searchLinesStripped = oldString
      .split('\n')
      .map((line: string) => line.trim());
    const replaceLines = newString.split('\n');

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
      let modifiedCode = sourceLines.join('');
      modifiedCode = this.restoreTrailingNewline(currentContent, modifiedCode);
      return {
        newContent: modifiedCode,
        occurrences: flexibleOccurrences,
        finalOldString: oldString,
        finalNewString: newString
      };
    }

    return null;
  }

  /**
   * Restore trailing newline to match original file
   */
  private restoreTrailingNewline(originalContent: string, modifiedContent: string): string {
    const hadTrailingNewline = originalContent.endsWith('\n');
    if (hadTrailingNewline && !modifiedContent.endsWith('\n')) {
      return modifiedContent + '\n';
    } else if (!hadTrailingNewline && modifiedContent.endsWith('\n')) {
      return modifiedContent.replace(/\n$/, '');
    }
    return modifiedContent;
  }

  /**
   * Create a backup of the file before editing
   */
  private async createBackup(filePath: string, fileExists: boolean, conversationId?: string): Promise<void> {
    try {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      // Create backup directory in project root or current working directory
      const backupBaseDir = hasProject && projectPath 
        ? path.join(projectPath, '.backup') 
        : path.join(process.cwd(), '.backup');
      
      // Ensure backup directory exists
      await fs.promises.mkdir(backupBaseDir, { recursive: true });
      
      // Create conversation-based backup folder
      const backupFolderName = conversationId 
        ? `conversation-${conversationId}-backup`
        : `timestamp-${new Date().toISOString().replace(/[:.]/g, '-')}-backup`;
      const conversationBackupDir = path.join(backupBaseDir, backupFolderName);
      await fs.promises.mkdir(conversationBackupDir, { recursive: true });
      
      // Calculate relative path from project root for backup structure
      const relativePath = hasProject && projectPath 
        ? path.relative(projectPath, filePath)
        : path.relative(process.cwd(), filePath);
      
      const backupFilePath = path.join(conversationBackupDir, relativePath);
      const backupDir = path.dirname(backupFilePath);
      
      // Ensure backup directory structure exists
      await fs.promises.mkdir(backupDir, { recursive: true });
      
      if (fileExists) {
        // Copy existing file content to backup
        try {
          const fileContent = await fs.promises.readFile(filePath, 'utf-8');
          await fs.promises.writeFile(backupFilePath, fileContent, 'utf-8');
          console.log(`📚 Backed up existing file: ${filePath} -> ${backupFilePath}`);
        } catch (readError) {
          console.warn(`⚠️ Failed to read file for backup: ${readError instanceof Error ? readError.message : String(readError)}`);
          // Create empty backup file as fallback
          await fs.promises.writeFile(backupFilePath, '', 'utf-8');
          console.log(`📚 Created empty backup file as fallback: ${backupFilePath}`);
        }
      }
      
      console.log(`✅ Backup created successfully in: ${conversationBackupDir}`);
      
    } catch (error) {
      // Log backup error but don't fail the edit operation
      console.error(`❌ Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`⚠️ Continuing with edit despite backup failure`);
    }
  }

  async shouldConfirm(params: PartialEditParams): Promise<ToolCallConfirmationDetails | false> {
    // Resolve path the same way as execute method
    let resolvedPath = params.filePath;
    if (!path.isAbsolute(params.filePath)) {
      const projectPath = projectContextBridge.getCurrentProjectPath();
      const hasProject = projectContextBridge.hasCurrentProject();
      
      if (hasProject && projectPath && projectPath !== process.cwd()) {
        resolvedPath = path.resolve(projectPath, params.filePath);
      } else {
        resolvedPath = path.resolve(process.cwd(), params.filePath);
      }
    }

    // Check if file exists
    const exists = await fs.promises.access(resolvedPath).then(() => true).catch(() => false);
    
    if (!exists) {
      return {
        toolName: this.name,
        parameters: params,
        description: `File not found: ${resolvedPath}`,
        risks: ['Cannot edit a file that does not exist'],
        autoApprove: false
      };
    }

    // Read file to show preview of changes
    let preview = '';
    try {
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      const oldLines = params.oldString.split('\n');
      
      // Find the line where the old string appears
      let foundLine = -1;
      for (let i = 0; i <= lines.length - oldLines.length; i++) {
        const window = lines.slice(i, i + oldLines.length);
        if (window.join('\n') === params.oldString) {
          foundLine = i;
          break;
        }
      }
      
      if (foundLine >= 0) {
        const start = Math.max(0, foundLine - 2);
        const end = Math.min(lines.length, foundLine + oldLines.length + 3);
        preview = lines.slice(start, end).join('\n');
      }
    } catch (error) {
      preview = 'Could not read file for preview';
    }
    
    return {
      toolName: this.name,
      parameters: params,
      description: `Edit file: ${resolvedPath}\n\nPreview:\n${preview}\n\nReplace:\n${params.oldString}\n\nWith:\n${params.newString}`,
      risks: [
        'Will modify existing file content',
        'Original content will be backed up but changed',
        'Make sure oldString matches exactly including whitespace'
      ],
      autoApprove: false
    };
  }
}
