/**
 * Edit File Tool for EGDesk AI Integration
 * Based on Gemini CLI's edit.ts implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ipcMain } from 'electron';

/**
 * Parameters for the edit file tool
 */
export interface EditFileParams {
  /**
   * The absolute path to the file to modify
   */
  file_path: string;

  /**
   * The text to replace (use empty string to create new file)
   */
  old_string: string;

  /**
   * The text to replace it with
   */
  new_string: string;

  /**
   * Number of replacements expected. Defaults to 1 if not specified.
   * Use when you want to replace multiple occurrences.
   */
  expected_replacements?: number;

  /**
   * Whether the edit was modified manually by the user.
   */
  modified_by_user?: boolean;

  /**
   * Initially proposed content for context.
   */
  ai_proposed_content?: string;

  /**
   * Description of the edit operation
   */
  description?: string;
}

/**
 * Result of edit file operation
 */
export interface EditFileResult {
  success: boolean;
  file_path?: string;
  is_new_file?: boolean;
  content_preview?: string;
  lines_changed?: number;
  replacements_made?: number;
  file_size?: number;
  error?: string;
}

export class EditFileTool {
  /**
   * Register IPC handlers for the edit file tool
   */
  static registerHandlers(): void {
    ipcMain.handle('edit-file', async (event, params: EditFileParams): Promise<EditFileResult> => {
      return this.editFile(params);
    });
  }

  /**
   * Apply replacement to content
   */
  private static applyReplacement(
    currentContent: string | null,
    oldString: string,
    newString: string,
    isNewFile: boolean,
  ): { content: string; occurrences: number } {
    if (isNewFile) {
      return { content: newString, occurrences: 1 };
    }

    if (currentContent === null) {
      // Should not happen if not a new file, but defensively return
      return { content: oldString === '' ? newString : '', occurrences: 0 };
    }

    // If oldString is empty and it's not a new file, do not modify the content
    if (oldString === '' && !isNewFile) {
      return { content: currentContent, occurrences: 0 };
    }

    // Count occurrences
    const occurrences = (currentContent.match(new RegExp(this.escapeRegExp(oldString), 'g')) || []).length;
    
    // Apply replacement
    const newContent = currentContent.replaceAll(oldString, newString);
    
    return { content: newContent, occurrences };
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate the edit operation without applying it
   */
  private static async calculateEdit(params: EditFileParams): Promise<{
    currentContent: string | null;
    newContent: string;
    occurrences: number;
    isNewFile: boolean;
    error?: string;
  }> {
    const expectedReplacements = params.expected_replacements ?? 1;
    let currentContent: string | null = null;
    let fileExists = false;
    let isNewFile = false;

    // Try to read the existing file
    try {
      currentContent = await fs.readFile(params.file_path, 'utf-8');
      // Normalize line endings to LF for consistent processing
      currentContent = currentContent.replace(/\r\n/g, '\n');
      fileExists = true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        // Rethrow unexpected FS errors (permissions, etc.)
        throw error;
      }
      fileExists = false;
    }

    // Determine if this is a new file creation
    if (params.old_string === '' && !fileExists) {
      isNewFile = true;
    } else if (!fileExists) {
      return {
        currentContent: null,
        newContent: '',
        occurrences: 0,
        isNewFile: false,
        error: 'File not found. Cannot apply edit. Use an empty old_string to create a new file.'
      };
    }

    // Apply the replacement
    const { content: newContent, occurrences } = this.applyReplacement(
      currentContent,
      params.old_string,
      params.new_string,
      isNewFile
    );

    // Validate the edit
    if (!isNewFile) {
      if (params.old_string === '') {
        return {
          currentContent,
          newContent,
          occurrences: 0,
          isNewFile,
          error: 'Failed to edit. Attempted to create a file that already exists.'
        };
      }

      if (occurrences === 0) {
        return {
          currentContent,
          newContent,
          occurrences,
          isNewFile,
          error: 'Failed to edit, could not find the string to replace. The exact text in old_string was not found.'
        };
      }

      if (occurrences !== expectedReplacements) {
        const occurrenceTerm = expectedReplacements === 1 ? 'occurrence' : 'occurrences';
        return {
          currentContent,
          newContent,
          occurrences,
          isNewFile,
          error: `Failed to edit, expected ${expectedReplacements} ${occurrenceTerm} but found ${occurrences}.`
        };
      }

      if (params.old_string === params.new_string) {
        return {
          currentContent,
          newContent,
          occurrences,
          isNewFile,
          error: 'No changes to apply. The old_string and new_string are identical.'
        };
      }
    }

    return {
      currentContent,
      newContent,
      occurrences,
      isNewFile
    };
  }

  /**
   * Edit a file
   */
  static async editFile(params: EditFileParams): Promise<EditFileResult> {
    try {
      // Validate parameters
      if (!params.file_path) {
        return {
          success: false,
          error: 'File path is required'
        };
      }

      if (params.new_string === undefined) {
        return {
          success: false,
          error: 'New string is required'
        };
      }

      // Ensure directory exists
      const dir = path.dirname(params.file_path);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist, ignore error
      }

      // Calculate the edit
      const editResult = await this.calculateEdit(params);
      
      if (editResult.error) {
        return {
          success: false,
          file_path: params.file_path,
          error: editResult.error
        };
      }

      // Write the new content
      await fs.writeFile(params.file_path, editResult.newContent, 'utf-8');

      // Get file stats
      const stats = await fs.stat(params.file_path);
      
      // Calculate lines changed (approximate)
      const oldLines = editResult.currentContent ? editResult.currentContent.split('\n').length : 0;
      const newLines = editResult.newContent.split('\n').length;
      const linesChanged = Math.abs(newLines - oldLines);

      // Create content preview (first 200 characters)
      const contentPreview = editResult.newContent.length > 200 
        ? editResult.newContent.substring(0, 200) + '...'
        : editResult.newContent;

      return {
        success: true,
        file_path: params.file_path,
        is_new_file: editResult.isNewFile,
        content_preview: contentPreview,
        lines_changed: linesChanged,
        replacements_made: editResult.occurrences,
        file_size: stats.size
      };

    } catch (error) {
      console.error('Edit file error:', error);
      return {
        success: false,
        file_path: params.file_path,
        error: error instanceof Error ? error.message : 'Unknown error occurred while editing file'
      };
    }
  }

  /**
   * Get a formatted string representation of edit result (for AI context)
   */
  static formatEditResult(result: EditFileResult): string {
    if (!result.success) {
      return `Error editing file: ${result.error}`;
    }

    let output = '';
    if (result.is_new_file) {
      output += `✅ Created new file: ${result.file_path}\n`;
    } else {
      output += `✅ Successfully edited file: ${result.file_path}\n`;
    }

    if (result.replacements_made !== undefined && result.replacements_made > 0) {
      output += `📝 Replacements made: ${result.replacements_made}\n`;
    }

    if (result.lines_changed !== undefined) {
      output += `📊 Lines changed: ${result.lines_changed}\n`;
    }

    if (result.file_size !== undefined) {
      output += `📏 File size: ${result.file_size} bytes\n`;
    }

    if (result.content_preview) {
      output += `\n📄 Content preview:\n${result.content_preview}`;
    }

    return output;
  }
}
