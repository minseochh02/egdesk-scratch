import { AIEdit } from '../components/AIEditor/types';

/**
 * Comprehensive File Writer Service
 * Handles safe file modifications with backup, validation, and atomic operations
 */
export class FileWriterService {
  private static instance: FileWriterService;

  private backupEnabled = true;

  private maxBackups = 10;

  private constructor() {}

  static getInstance(): FileWriterService {
    if (!FileWriterService.instance) {
      FileWriterService.instance = new FileWriterService();
      // Ensure backup is enabled by default
      FileWriterService.instance.setBackupEnabled(true);
    }
    return FileWriterService.instance;
  }

  /**
   * Apply code changes to files safely with backup and validation
   */
  async applyChangesToFiles(
    edits: AIEdit[],
    projectRoot?: string,
  ): Promise<{
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
    backupPaths?: string[];
  }> {
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    const backupPaths: string[] = [];

    console.log(`🔄 Starting to apply ${edits.length} edits to files...`);

    try {
      // Group edits by file path for efficient processing
      const editsByFile = this.groupEditsByFile(edits);

      for (const [filePath, fileEdits] of editsByFile.entries()) {
        try {
          // Resolve relative paths to absolute paths
          const absoluteFilePath = this.resolveFilePath(filePath, projectRoot);
          console.log(
            `📝 Processing ${fileEdits.length} edits for file: ${filePath} -> ${absoluteFilePath}`,
          );

          // Create backup if enabled
          let backupPath: string | null = null;
          if (this.backupEnabled) {
            console.log(`💾 Creating backup for file: ${absoluteFilePath}`);
            backupPath = await this.createBackup(absoluteFilePath);
            if (backupPath) {
              backupPaths.push(backupPath);
              console.log(`✅ Backup created successfully: ${backupPath}`);
            } else {
              console.error(
                `❌ FAILED TO CREATE BACKUP for: ${absoluteFilePath}`,
              );
              console.error(
                `❌ This means your file changes will NOT be backed up!`,
              );
            }
          } else {
            console.warn(
              `⚠️ BACKUP DISABLED - No backup created for: ${absoluteFilePath}`,
            );
          }

          // Apply edits to the file
          const result = await this.applyEditsToSingleFile(
            absoluteFilePath,
            fileEdits,
          );

          if (result.success) {
            modifiedFiles.push(absoluteFilePath);
            console.log(
              `✅ Successfully applied ${fileEdits.length} edits to: ${absoluteFilePath}`,
            );
          } else {
            errors.push(
              `Failed to apply edits to ${filePath}: ${result.error}`,
            );
            console.error(
              `❌ Failed to apply edits to ${filePath}:`,
              result.error,
            );

            // Restore from backup if available
            if (backupPath) {
              await this.restoreFromBackup(absoluteFilePath, backupPath);
              console.log(
                `🔄 Restored ${absoluteFilePath} from backup due to error`,
              );
            }
          }
        } catch (error) {
          const errorMessage = `Error processing ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          console.error('❌', errorMessage);
        }
      }

      const success = errors.length === 0;
      console.log(
        `🎯 File writing completed. Success: ${success}, Modified: ${modifiedFiles.length}, Errors: ${errors.length}`,
      );

      return {
        success,
        modifiedFiles,
        errors,
        backupPaths: this.backupEnabled ? backupPaths : undefined,
      };
    } catch (error) {
      const errorMessage = `Fatal error applying changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥', errorMessage);
      return {
        success: false,
        modifiedFiles,
        errors: [errorMessage],
        backupPaths: this.backupEnabled ? backupPaths : undefined,
      };
    }
  }

  /**
   * Apply a single edit operation to content
   */
  applyEditToContent(
    content: string,
    edit: AIEdit,
  ): { success: boolean; content: string; error?: string } {
    try {
      console.log(`🔧 Applying ${edit.type} edit: ${edit.description}`);

      switch (edit.type) {
        case 'replace':
          return this.applyReplaceEdit(content, edit);

        case 'insert':
          return this.applyInsertEdit(content, edit);

        case 'delete':
          return this.applyDeleteEdit(content, edit);

        case 'create':
          // For create operations, return the new content directly
          return {
            success: true,
            content: edit.newText || '',
          };

        default:
          return {
            success: false,
            content,
            error: `Unsupported edit type: ${edit.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        content,
        error: `Error applying edit: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Apply multiple edits to content in sequence
   */
  applyEditsToContent(
    originalContent: string,
    edits: AIEdit[],
  ): { success: boolean; content: string; errors: string[] } {
    let currentContent = originalContent;
    const errors: string[] = [];

    console.log(`🔄 Applying ${edits.length} edits to content...`);

    // Sort edits by position (reverse order for safe application)
    const sortedEdits = this.sortEditsForApplication(edits);

    for (const edit of sortedEdits) {
      const result = this.applyEditToContent(currentContent, edit);
      if (result.success) {
        currentContent = result.content;
        console.log(`✅ Applied edit: ${edit.description}`);
      } else {
        errors.push(
          result.error || `Failed to apply edit: ${edit.description}`,
        );
        console.error(
          `❌ Failed to apply edit: ${edit.description}`,
          result.error,
        );
      }
    }

    return {
      success: errors.length === 0,
      content: currentContent,
      errors,
    };
  }

  /**
   * Write content to file with atomic operation
   */
  async writeFileAtomic(
    filePath: string,
    content: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`💾 Writing ${content.length} characters to: ${filePath}`);

      // Validate file path
      if (!filePath || filePath.trim() === '') {
        throw new Error('Invalid file path provided');
      }

      // Validate content
      if (typeof content !== 'string') {
        throw new Error('Content must be a string');
      }

      // Check if we can write to the file (basic permission check)
      const canWrite = await this.checkWritePermissions(filePath);
      if (!canWrite) {
        throw new Error('No write permissions for file');
      }

      // Use electron's file system API for atomic write
      const result = await window.electron.fileSystem.writeFile(
        filePath,
        content,
      );

      if (result.success) {
        console.log(`✅ Successfully wrote file: ${filePath}`);
        return { success: true };
      }
      throw new Error(result.error || 'Write operation failed');
    } catch (error) {
      const errorMessage = `Failed to write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create a backup of a file before modification
   */
  private async createBackup(filePath: string): Promise<string | null> {
    try {
      console.log(`🔍 DEBUG: Starting backup creation for: ${filePath}`);

      // Check if file exists
      const readResult = await window.electron.fileSystem.readFile(filePath);
      if (!readResult.success) {
        console.log(`ℹ️ File doesn't exist, no backup needed: ${filePath}`);
        return null;
      }

      console.log(
        `📖 DEBUG: Successfully read file content (${readResult.content?.length || 0} characters)`,
      );

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup.${timestamp}`;

      console.log(`📝 DEBUG: Creating backup at: ${backupPath}`);

      // Create backup
      const writeResult = await window.electron.fileSystem.writeFile(
        backupPath,
        readResult.content || '',
      );

      if (writeResult.success) {
        console.log(`✅ Backup created successfully: ${backupPath}`);
        // Clean up old backups
        await this.cleanupOldBackups(filePath);
        return backupPath;
      }
      console.error(
        `❌ Failed to create backup for ${filePath}:`,
        writeResult.error,
      );
      return null;
    } catch (error) {
      console.error(`❌ Error creating backup for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Restore a file from backup
   */
  private async restoreFromBackup(
    filePath: string,
    backupPath: string,
  ): Promise<boolean> {
    try {
      const readResult = await window.electron.fileSystem.readFile(backupPath);
      if (!readResult.success) {
        console.error(`❌ Failed to read backup file: ${backupPath}`);
        return false;
      }

      const writeResult = await window.electron.fileSystem.writeFile(
        filePath,
        readResult.content || '',
      );
      return writeResult.success;
    } catch (error) {
      console.error(`❌ Error restoring from backup:`, error);
      return false;
    }
  }

  /**
   * Apply edits to a single file
   */
  private async applyEditsToSingleFile(
    filePath: string,
    edits: AIEdit[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Handle file creation
      if (edits.length === 1 && edits[0].type === 'create') {
        return await this.writeFileAtomic(filePath, edits[0].newText || '');
      }

      // Handle file deletion
      if (edits.length === 1 && edits[0].type === 'delete_file') {
        const result = await window.electron.fileSystem.deleteItem(filePath);
        return { success: result.success, error: result.error };
      }

      // Read current file content
      const readResult = await window.electron.fileSystem.readFile(filePath);
      if (!readResult.success) {
        return {
          success: false,
          error: `Failed to read file: ${readResult.error}`,
        };
      }

      const originalContent = readResult.content || '';

      // Apply all edits to content
      const editResult = this.applyEditsToContent(originalContent, edits);

      if (!editResult.success) {
        return {
          success: false,
          error: `Edit application failed: ${editResult.errors.join(', ')}`,
        };
      }

      // Write modified content back to file
      return await this.writeFileAtomic(filePath, editResult.content);
    } catch (error) {
      return {
        success: false,
        error: `Error processing file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Apply a replace edit operation
   */
  private applyReplaceEdit(
    content: string,
    edit: AIEdit,
  ): { success: boolean; content: string; error?: string } {
    if (!edit.oldText || edit.newText === undefined) {
      return {
        success: false,
        content,
        error: 'Replace edit missing oldText or newText',
      };
    }

    console.log('🔧 Attempting replace edit:', {
      oldTextLength: edit.oldText.length,
      newTextLength: edit.newText.length,
      oldTextPreview: edit.oldText.substring(0, 100),
      newTextPreview: edit.newText.substring(0, 100),
      contentLength: content.length,
      contentIncludes: content.includes(edit.oldText),
    });

    // Try exact string replacement first
    if (content.includes(edit.oldText)) {
      const newContent = content.replace(edit.oldText, edit.newText);
      console.log('✅ Exact string replacement successful');
      return { success: true, content: newContent };
    }

    // Try line-based replacement if range is provided
    if (edit.range && edit.range.startLine && edit.range.endLine) {
      const lines = content.split('\n');
      const startLine = edit.range.startLine - 1; // Convert to 0-based
      const endLine = edit.range.endLine - 1; // Convert to 0-based

      if (
        startLine >= 0 &&
        startLine < lines.length &&
        endLine >= 0 &&
        endLine < lines.length
      ) {
        // Replace the specified line range
        const beforeLines = lines.slice(0, startLine);
        const afterLines = lines.slice(endLine + 1);
        const newLines = edit.newText.split('\n');

        const result = [...beforeLines, ...newLines, ...afterLines].join('\n');
        return { success: true, content: result };
      }
    }

    console.warn('❌ Replace edit failed - text not found:', {
      searchText: edit.oldText?.substring(0, 100),
      hasRange: !!edit.range,
      startLine: edit.range?.startLine,
      endLine: edit.range?.endLine,
    });
    return {
      success: false,
      content,
      error: `Could not find text to replace: "${edit.oldText?.substring(0, 50)}..."`,
    };
  }

  /**
   * Apply an insert edit operation
   */
  private applyInsertEdit(
    content: string,
    edit: AIEdit,
  ): { success: boolean; content: string; error?: string } {
    if (!edit.newText) {
      return { success: false, content, error: 'Insert edit missing newText' };
    }

    if (edit.range && typeof edit.range.start === 'number') {
      // Insert at specific position
      const before = content.substring(0, edit.range.start);
      const after = content.substring(edit.range.start);
      return { success: true, content: before + edit.newText + after };
    }

    if (edit.range && edit.range.startLine) {
      // Insert at specific line
      const lines = content.split('\n');
      const lineIndex = edit.range.startLine - 1; // Convert to 0-based

      if (lineIndex >= 0 && lineIndex <= lines.length) {
        const newLines = edit.newText.split('\n');
        lines.splice(lineIndex, 0, ...newLines);
        return { success: true, content: lines.join('\n') };
      }
    }

    // Default: append to end
    return { success: true, content: content + edit.newText };
  }

  /**
   * Apply a delete edit operation
   */
  private applyDeleteEdit(
    content: string,
    edit: AIEdit,
  ): { success: boolean; content: string; error?: string } {
    if (edit.oldText && content.includes(edit.oldText)) {
      // Delete specific text
      const newContent = content.replace(edit.oldText, '');
      return { success: true, content: newContent };
    }

    if (edit.range) {
      if (
        typeof edit.range.start === 'number' &&
        typeof edit.range.end === 'number'
      ) {
        // Delete by character range
        const before = content.substring(0, edit.range.start);
        const after = content.substring(edit.range.end);
        return { success: true, content: before + after };
      }

      if (edit.range.startLine && edit.range.endLine) {
        // Delete by line range
        const lines = content.split('\n');
        const startLine = edit.range.startLine - 1; // Convert to 0-based
        const endLine = edit.range.endLine - 1; // Convert to 0-based

        if (
          startLine >= 0 &&
          startLine < lines.length &&
          endLine >= 0 &&
          endLine < lines.length
        ) {
          lines.splice(startLine, endLine - startLine + 1);
          return { success: true, content: lines.join('\n') };
        }
      }
    }

    return {
      success: false,
      content,
      error: 'Could not determine what to delete',
    };
  }

  /**
   * Group edits by file path for efficient processing
   */
  private groupEditsByFile(edits: AIEdit[]): Map<string, AIEdit[]> {
    const grouped = new Map<string, AIEdit[]>();

    for (const edit of edits) {
      const filePath = edit.filePath || '';
      if (!grouped.has(filePath)) {
        grouped.set(filePath, []);
      }
      grouped.get(filePath)!.push(edit);
    }

    return grouped;
  }

  /**
   * Sort edits for safe application (reverse order by position)
   */
  private sortEditsForApplication(edits: AIEdit[]): AIEdit[] {
    return edits.slice().sort((a, b) => {
      // Sort by line number (descending) then by character position (descending)
      const aLine = a.range?.startLine || 0;
      const bLine = b.range?.startLine || 0;

      if (aLine !== bLine) {
        return bLine - aLine; // Descending order
      }

      const aChar = a.range?.start || 0;
      const bChar = b.range?.start || 0;

      return bChar - aChar; // Descending order
    });
  }

  /**
   * Check write permissions for a file
   */
  private async checkWritePermissions(filePath: string): Promise<boolean> {
    try {
      // Try to read the file first to check if it exists
      const readResult = await window.electron.fileSystem.readFile(filePath);

      // If file doesn't exist, check if we can create it by checking the directory
      if (!readResult.success) {
        // For new files, assume we can write (the actual write will fail if we can't)
        return true;
      }

      // If file exists and we can read it, assume we can write to it
      // (More sophisticated permission checking would require additional API methods)
      return true;
    } catch (error) {
      console.warn(
        `⚠️ Could not check write permissions for ${filePath}:`,
        error,
      );
      return true; // Optimistic approach - let the write operation handle the error
    }
  }

  /**
   * Clean up old backup files to prevent accumulation
   */
  private async cleanupOldBackups(originalFilePath: string): Promise<void> {
    try {
      console.log(`🧹 DEBUG: Starting backup cleanup for: ${originalFilePath}`);

      // Get the directory of the original file
      const pathParts = originalFilePath.split('/');
      const fileName = pathParts.pop() || '';
      const directory = pathParts.join('/');

      if (!directory) {
        console.log(`ℹ️ No directory found for cleanup: ${originalFilePath}`);
        return;
      }

      // List files in the directory to find backup files
      const listResult =
        await window.electron.fileSystem.readDirectory(directory);
      if (!listResult.success || !Array.isArray(listResult.items)) {
        console.log(`ℹ️ Could not list directory for cleanup: ${directory}`);
        return;
      }

      // Find backup files for this specific file
      const backupFiles = listResult.items
        .filter(
          (item) =>
            item.isFile &&
            item.name.startsWith(fileName) &&
            item.name.includes('.backup.'),
        )
        .map((item) => item.path)
        .sort(); // Sort by name (which includes timestamp)

      console.log(
        `🔍 DEBUG: Found ${backupFiles.length} backup files for ${fileName}`,
      );

      // Keep only the most recent backups (up to maxBackups)
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(
          0,
          backupFiles.length - this.maxBackups,
        );

        console.log(
          `🗑️ DEBUG: Deleting ${filesToDelete.length} old backup files`,
        );

        for (const backupFile of filesToDelete) {
          try {
            const deleteResult =
              await window.electron.fileSystem.deleteItem(backupFile);
            if (deleteResult.success) {
              console.log(`✅ Deleted old backup: ${backupFile}`);
            } else {
              console.warn(
                `⚠️ Failed to delete old backup ${backupFile}:`,
                deleteResult.error,
              );
            }
          } catch (error) {
            console.warn(`⚠️ Error deleting backup ${backupFile}:`, error);
          }
        }
      } else {
        console.log(
          `ℹ️ No cleanup needed - only ${backupFiles.length} backup files (max: ${this.maxBackups})`,
        );
      }
    } catch (error) {
      console.warn(`⚠️ Error cleaning up backups:`, error);
    }
  }

  /**
   * Resolve file path to absolute path
   */
  private resolveFilePath(filePath: string, projectRoot?: string): string {
    // If it's already an absolute path, return as-is
    if (filePath.startsWith('/') || filePath.startsWith('C:\\')) {
      return filePath;
    }

    // If we have a project root, prepend it
    if (projectRoot) {
      return `${projectRoot}/${filePath}`;
    }

    // Fallback: try to find the project root from the current working directory
    const cwd = process.cwd();
    if (cwd.includes('EGDesk-scratch') || cwd.includes('egdesk-scratch')) {
      return `${cwd}/${filePath}`;
    }

    // Last resort: return the path as-is (might fail)
    console.warn(`⚠️ Could not resolve absolute path for: ${filePath}`);
    return filePath;
  }

  /**
   * Configuration methods
   */
  setBackupEnabled(enabled: boolean): void {
    this.backupEnabled = enabled;
    console.log(`💾 Backup ${enabled ? 'enabled' : 'disabled'}`);
  }

  setMaxBackups(max: number): void {
    this.maxBackups = Math.max(1, max);
    console.log(`💾 Max backups set to: ${this.maxBackups}`);
  }

  isBackupEnabled(): boolean {
    return this.backupEnabled;
  }
}

// Export singleton instance
export const fileWriterService = FileWriterService.getInstance();
