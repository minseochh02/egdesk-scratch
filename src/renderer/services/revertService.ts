import { fileWriterService } from './fileWriterService';

/**
 * Backup file information structure
 */
export interface BackupFile {
  originalFilePath: string;
  backupFilePath: string;
  timestamp: Date;
  size: number;
  isValid: boolean;
  createdBy?: string; // AI operation that created this backup
  operationId?: string; // Unique ID for the operation
}

/**
 * Revert operation result
 */
export interface RevertResult {
  success: boolean;
  restoredFiles: string[];
  errors: string[];
  summary: string;
}

/**
 * Revert operation options
 */
export interface RevertOptions {
  createBackupOfCurrent?: boolean; // Create backup of current state before reverting
  deleteOriginalBackup?: boolean; // Delete the backup file after successful revert
  validateContent?: boolean; // Validate backup content before reverting
}

/**
 * Comprehensive Revert Service
 * Handles reverting AI-made changes using backup files
 */
export class RevertService {
  private static instance: RevertService;

  private constructor() {}

  static getInstance(): RevertService {
    if (!RevertService.instance) {
      RevertService.instance = new RevertService();
    }
    return RevertService.instance;
  }

  /**
   * Find all backup files for a specific original file
   */
  async findBackupsForFile(originalFilePath: string): Promise<BackupFile[]> {
    try {
      console.log(`🔍 Finding backups for: ${originalFilePath}`);

      // Get the directory of the original file
      const pathParts = originalFilePath.split('/');
      const fileName = pathParts.pop() || '';
      const directory = pathParts.join('/');

      if (!directory) {
        console.warn(`⚠️ No directory found for: ${originalFilePath}`);
        return [];
      }

      // List files in the directory
      const listResult =
        await window.electron.fileSystem.readDirectory(directory);
      if (!listResult.success || !Array.isArray(listResult.items)) {
        console.warn(`⚠️ Could not list directory: ${directory}`);
        return [];
      }

      // Find backup files for this specific file
      const backupFiles: BackupFile[] = [];

      for (const item of listResult.items) {
        if (
          item.isFile &&
          item.name.startsWith(fileName) &&
          item.name.includes('.backup.')
        ) {
          // Parse timestamp from filename
          const timestampMatch = item.name.match(/\.backup\.(.+)$/);
          if (timestampMatch) {
            const timestampStr = timestampMatch[1].replace(/[Z]/g, '');
            const timestamp = this.parseBackupTimestamp(timestampStr);

            // Validate backup file
            const isValid = await this.validateBackupFile(item.path);

            backupFiles.push({
              originalFilePath,
              backupFilePath: item.path,
              timestamp,
              size: item.size || 0,
              isValid,
              createdBy: 'AI Editor', // Could be enhanced to track specific AI operations
            });
          }
        }
      }

      // Sort by timestamp (newest first)
      backupFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      console.log(
        `✅ Found ${backupFiles.length} backup files for ${fileName}`,
      );
      return backupFiles;
    } catch (error) {
      console.error(`❌ Error finding backups for ${originalFilePath}:`, error);
      return [];
    }
  }

  /**
   * Find all backup files in a project directory
   */
  async findAllBackups(
    projectRoot: string,
  ): Promise<Map<string, BackupFile[]>> {
    try {
      console.log(`🔍 Finding all backups in: ${projectRoot}`);

      const allBackups = new Map<string, BackupFile[]>();

      // Set a timeout for the search operation to prevent hanging
      const searchPromise = this.searchBackupsRecursively(
        projectRoot,
        allBackups,
        0,
      );
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(
          () => reject(new Error('Backup search timed out after 30 seconds')),
          30000,
        );
      });

      await Promise.race([searchPromise, timeoutPromise]);

      console.log(`✅ Found backups for ${allBackups.size} original files`);
      return allBackups;
    } catch (error) {
      console.error(`❌ Error finding all backups in ${projectRoot}:`, error);
      return new Map();
    }
  }

  /**
   * Revert a single file from its backup
   */
  async revertFile(
    originalFilePath: string,
    backupFilePath: string,
    options: RevertOptions = {},
  ): Promise<RevertResult> {
    const {
      createBackupOfCurrent = true,
      deleteOriginalBackup = false,
      validateContent = true,
    } = options;

    console.log(
      `🔄 Reverting file: ${originalFilePath} from backup: ${backupFilePath}`,
    );

    try {
      const restoredFiles: string[] = [];
      const errors: string[] = [];

      // Validate backup file exists and is readable
      if (validateContent && !(await this.validateBackupFile(backupFilePath))) {
        return {
          success: false,
          restoredFiles: [],
          errors: [`Backup file is invalid or corrupted: ${backupFilePath}`],
          summary: 'Revert failed: Invalid backup file',
        };
      }

      // Create backup of current state if requested
      let currentStateBackupPath: string | null = null;
      if (createBackupOfCurrent) {
        try {
          const readResult =
            await window.electron.fileSystem.readFile(originalFilePath);
          if (readResult.success) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            currentStateBackupPath = `${originalFilePath}.pre-revert-backup.${timestamp}`;

            const writeResult = await window.electron.fileSystem.writeFile(
              currentStateBackupPath,
              readResult.content || '',
            );

            if (writeResult.success) {
              console.log(
                `💾 Created pre-revert backup: ${currentStateBackupPath}`,
              );
            } else {
              console.warn(
                `⚠️ Failed to create pre-revert backup: ${writeResult.error}`,
              );
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to create pre-revert backup:`, error);
        }
      }

      // Read backup content
      console.log(`📖 Reading backup file: ${backupFilePath}`);
      const backupResult =
        await window.electron.fileSystem.readFile(backupFilePath);
      if (!backupResult.success) {
        console.error(`❌ Failed to read backup file: ${backupResult.error}`);
        return {
          success: false,
          restoredFiles: [],
          errors: [`Failed to read backup file: ${backupResult.error}`],
          summary: 'Revert failed: Could not read backup',
        };
      }
      console.log(
        `✅ Successfully read backup file: ${backupFilePath} (${backupResult.content?.length || 0} characters)`,
      );

      // Restore the original file content
      console.log(
        `✍️ Writing restored content to: ${originalFilePath} (${backupResult.content?.length || 0} characters)`,
      );
      const restoreResult = await window.electron.fileSystem.writeFile(
        originalFilePath,
        backupResult.content || '',
      );

      if (restoreResult.success) {
        restoredFiles.push(originalFilePath);
        console.log(`✅ Successfully reverted: ${originalFilePath}`);

        // Delete original backup if requested and revert was successful
        if (deleteOriginalBackup) {
          try {
            const deleteResult =
              await window.electron.fileSystem.deleteItem(backupFilePath);
            if (deleteResult.success) {
              console.log(`🗑️ Deleted original backup: ${backupFilePath}`);
            } else {
              console.warn(`⚠️ Failed to delete backup: ${deleteResult.error}`);
            }
          } catch (error) {
            console.warn(`⚠️ Error deleting backup:`, error);
          }
        }

        return {
          success: true,
          restoredFiles,
          errors,
          summary: `Successfully reverted ${originalFilePath}${currentStateBackupPath ? ` (current state backed up to ${currentStateBackupPath})` : ''}`,
        };
      }
      console.error(`❌ Failed to restore file: ${restoreResult.error}`);
      errors.push(`Failed to restore file: ${restoreResult.error}`);

      return {
        success: false,
        restoredFiles,
        errors,
        summary: 'Revert failed: Could not write restored content',
      };
    } catch (error) {
      const errorMessage = `Revert operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);

      return {
        success: false,
        restoredFiles: [],
        errors: [errorMessage],
        summary: 'Revert failed: Unexpected error',
      };
    }
  }

  /**
   * Revert multiple files from their backups
   */
  async revertMultipleFiles(
    revertOperations: Array<{
      originalFilePath: string;
      backupFilePath: string;
    }>,
    options: RevertOptions = {},
  ): Promise<RevertResult> {
    console.log(`🔄 Reverting ${revertOperations.length} files...`);

    const restoredFiles: string[] = [];
    const errors: string[] = [];

    for (const operation of revertOperations) {
      try {
        const result = await this.revertFile(
          operation.originalFilePath,
          operation.backupFilePath,
          options,
        );

        restoredFiles.push(...result.restoredFiles);
        errors.push(...result.errors);
      } catch (error) {
        const errorMessage = `Failed to revert ${operation.originalFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error('❌', errorMessage);
      }
    }

    const success = errors.length === 0;
    const summary = success
      ? `Successfully reverted ${restoredFiles.length} files`
      : `Reverted ${restoredFiles.length} files with ${errors.length} errors`;

    return {
      success,
      restoredFiles,
      errors,
      summary,
    };
  }

  /**
   * Get revert preview for a backup file
   */
  async getRevertPreview(
    originalFilePath: string,
    backupFilePath: string,
  ): Promise<{
    success: boolean;
    currentContent?: string;
    backupContent?: string;
    diff?: {
      added: number;
      removed: number;
      modified: number;
    };
    error?: string;
  }> {
    try {
      // Read current file content
      const currentResult =
        await window.electron.fileSystem.readFile(originalFilePath);
      const currentContent = currentResult.success
        ? currentResult.content || ''
        : '';

      // Read backup content
      const backupResult =
        await window.electron.fileSystem.readFile(backupFilePath);
      if (!backupResult.success) {
        return {
          success: false,
          error: `Failed to read backup file: ${backupResult.error}`,
        };
      }

      const backupContent = backupResult.content || '';

      // Calculate basic diff statistics
      const currentLines = currentContent.split('\n');
      const backupLines = backupContent.split('\n');

      const diff = {
        added: Math.max(0, currentLines.length - backupLines.length),
        removed: Math.max(0, backupLines.length - currentLines.length),
        modified: this.calculateModifiedLines(currentLines, backupLines),
      };

      return {
        success: true,
        currentContent,
        backupContent,
        diff,
      };
    } catch (error) {
      return {
        success: false,
        error: `Preview generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clean up old backup files based on age or count
   */
  async cleanupBackups(
    projectRoot: string,
    options: {
      maxAge?: number; // Max age in days
      maxCount?: number; // Max number of backups per file
      dryRun?: boolean; // Just report what would be deleted
    } = {},
  ): Promise<{
    success: boolean;
    deletedFiles: string[];
    errors: string[];
    summary: string;
  }> {
    const { maxAge = 30, maxCount = 10, dryRun = false } = options;

    console.log(
      `🧹 Cleaning up backups in: ${projectRoot} (maxAge: ${maxAge} days, maxCount: ${maxCount}, dryRun: ${dryRun})`,
    );

    const deletedFiles: string[] = [];
    const errors: string[] = [];

    try {
      const allBackups = await this.findAllBackups(projectRoot);

      for (const [originalFile, backups] of allBackups.entries()) {
        // Sort by timestamp (newest first)
        const sortedBackups = backups.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );

        // Find backups to delete based on count
        const excessBackups = sortedBackups.slice(maxCount);

        // Find backups to delete based on age
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);
        const oldBackups = sortedBackups.filter(
          (backup) => backup.timestamp < cutoffDate,
        );

        // Combine and deduplicate
        const toDelete = new Set([...excessBackups, ...oldBackups]);

        for (const backup of toDelete) {
          try {
            if (dryRun) {
              console.log(`🗑️ Would delete: ${backup.backupFilePath}`);
              deletedFiles.push(backup.backupFilePath);
            } else {
              const deleteResult = await window.electron.fileSystem.deleteItem(
                backup.backupFilePath,
              );
              if (deleteResult.success) {
                deletedFiles.push(backup.backupFilePath);
                console.log(`🗑️ Deleted old backup: ${backup.backupFilePath}`);
              } else {
                errors.push(
                  `Failed to delete ${backup.backupFilePath}: ${deleteResult.error}`,
                );
              }
            }
          } catch (error) {
            errors.push(
              `Error deleting ${backup.backupFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }

      const summary = dryRun
        ? `Would delete ${deletedFiles.length} backup files`
        : `Deleted ${deletedFiles.length} backup files with ${errors.length} errors`;

      return {
        success: errors.length === 0,
        deletedFiles,
        errors,
        summary,
      };
    } catch (error) {
      const errorMessage = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return {
        success: false,
        deletedFiles,
        errors: [errorMessage],
        summary: errorMessage,
      };
    }
  }

  /**
   * Private helper methods
   */

  private async searchBackupsRecursively(
    directory: string,
    allBackups: Map<string, BackupFile[]>,
    depth: number = 0,
  ): Promise<void> {
    try {
      // Limit recursion depth to prevent infinite loops and improve performance
      const MAX_DEPTH = 10;
      if (depth > MAX_DEPTH) {
        console.log(`⚠️ Maximum search depth reached at: ${directory}`);
        return;
      }

      // Skip common directories that are unlikely to contain backup files
      const directoryName = directory.split('/').pop()?.toLowerCase() || '';
      const skipDirectories = [
        'node_modules',
        '.git',
        '.svn',
        '.hg',
        'dist',
        'build',
        'coverage',
        '.next',
        '.nuxt',
        'target',
        'vendor',
        '__pycache__',
        '.pytest_cache',
        '.vscode',
        '.idea',
        'logs',
        'tmp',
        'temp',
      ];

      if (skipDirectories.includes(directoryName)) {
        console.log(`⏭️ Skipping directory: ${directory}`);
        return;
      }

      const listResult =
        await window.electron.fileSystem.readDirectory(directory);
      if (!listResult.success || !Array.isArray(listResult.items)) {
        return;
      }

      // Process files first (backup files)
      const files = listResult.items.filter(
        (item) => item.isFile && item.name.includes('.backup.'),
      );
      for (const item of files) {
        try {
          // Extract original file path
          const backupName = item.name;
          const backupMatch = backupName.match(/^(.+)\.backup\.(.+)$/);

          if (backupMatch) {
            const originalFileName = backupMatch[1];
            const timestampStr = backupMatch[2];
            const originalFilePath = `${directory}/${originalFileName}`;

            const timestamp = this.parseBackupTimestamp(timestampStr);
            const isValid = await this.validateBackupFile(item.path);

            const backupFile: BackupFile = {
              originalFilePath,
              backupFilePath: item.path,
              timestamp,
              size: item.size || 0,
              isValid,
              createdBy: 'AI Editor',
            };

            if (!allBackups.has(originalFilePath)) {
              allBackups.set(originalFilePath, []);
            }
            allBackups.get(originalFilePath)!.push(backupFile);
          }
        } catch (error) {
          console.warn(`⚠️ Error processing backup file ${item.path}:`, error);
        }
      }

      // Then process directories (recursive search)
      const directories = listResult.items.filter((item) => item.isDirectory);
      for (const item of directories) {
        await this.searchBackupsRecursively(item.path, allBackups, depth + 1);
      }
    } catch (error) {
      console.warn(`⚠️ Error searching directory ${directory}:`, error);
    }
  }

  private parseBackupTimestamp(timestampStr: string): Date {
    try {
      // Handle format like "2025-09-06T09-30-22-151Z"
      const normalizedStr = timestampStr
        .replace(/[Z]/g, '')
        .replace(/-(\d{3})$/, '.$1');
      const isoStr = normalizedStr.replace(/-/g, (match, offset) => {
        // Replace dashes with colons for time part, but keep date dashes
        return offset > 10 ? ':' : match;
      });

      return new Date(`${isoStr}Z`);
    } catch (error) {
      console.warn(`⚠️ Could not parse timestamp: ${timestampStr}`, error);
      return new Date(0); // Fallback to epoch
    }
  }

  private async validateBackupFile(backupFilePath: string): Promise<boolean> {
    try {
      const result = await window.electron.fileSystem.readFile(backupFilePath);
      return result.success && typeof result.content === 'string';
    } catch (error) {
      return false;
    }
  }

  private calculateModifiedLines(lines1: string[], lines2: string[]): number {
    const minLength = Math.min(lines1.length, lines2.length);
    let modified = 0;

    for (let i = 0; i < minLength; i++) {
      if (lines1[i] !== lines2[i]) {
        modified++;
      }
    }

    return modified;
  }
}

// Export singleton instance
export const revertService = RevertService.getInstance();
