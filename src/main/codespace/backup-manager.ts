/**
 * Backup Manager
 * Handles conversation-based backup creation, tracking, and reversion
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { projectContextBridge } from '../ai-code/project-context-bridge';
import { getSQLiteManager } from '../sqlite/manager';

export interface BackupInfo {
  conversationId: string;
  backupPath: string;
  timestamp: Date;
  files: BackupFileInfo[];
}

export interface BackupFileInfo {
  originalPath: string;
  backupPath: string;
  isNewFile: boolean; // true if file was created (has .init marker)
  exists: boolean; // true if backup file exists
}

export interface RevertResult {
  success: boolean;
  conversationId: string;
  filesReverted: string[];
  filesDeleted: string[];
  errors: string[];
}

export interface RevertSummary {
  success: boolean;
  conversationsReverted: string[];
  totalFilesReverted: number;
  totalFilesDeleted: number;
  errors: string[];
}

export class BackupManager {
  private projectPath: string | null = null;
  private backupBaseDir: string | null = null;
  private globalBackupDir: string | null = null;

  constructor() {
    this.updateProjectContext();
  }

  /**
   * Update project context and backup directory
   */
  private updateProjectContext(): void {
    const hasProject = projectContextBridge.hasCurrentProject();
    this.projectPath = hasProject ? projectContextBridge.getCurrentProjectPath() : null;
    
    if (this.projectPath) {
      this.backupBaseDir = path.join(this.projectPath, '.backup');
    } else {
      this.backupBaseDir = path.join(process.cwd(), '.backup');
    }

    // Set global backup directory (for Apps Script and non-project files)
    try {
      const userDataPath = app.getPath('userData');
      this.globalBackupDir = path.join(userDataPath, 'backups');
    } catch (error) {
      console.warn('Failed to get userData path for global backups:', error);
      this.globalBackupDir = null;
    }
  }

  /**
   * Get all available backup conversations sorted by timestamp (newest first)
   */
  async getAvailableBackups(): Promise<BackupInfo[]> {
    this.updateProjectContext();
    
    const backupDirs = [];
    if (this.backupBaseDir) backupDirs.push(this.backupBaseDir);
    if (this.globalBackupDir) backupDirs.push(this.globalBackupDir);

    const backups: BackupInfo[] = [];
    const processedIds = new Set<string>();

    for (const baseDir of backupDirs) {
      console.log(`🔍 Debug: Scanning backup directory: ${baseDir}`);
    try {
        const backupExists = await fs.promises.access(baseDir).then(() => true).catch(() => false);
      if (!backupExists) {
            console.log(`🔍 Debug: Directory does not exist: ${baseDir}`);
            continue;
      }

        const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
        console.log(`🔍 Debug: Found ${entries.length} entries in ${baseDir}`);

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('conversation-') && entry.name.endsWith('-backup')) {
          const conversationId = entry.name.replace('conversation-', '').replace('-backup', '');
            
            // Avoid duplicates if same conversation exists in multiple locations (unlikely but good safety)
            if (processedIds.has(conversationId)) continue;

            const backupPath = path.join(baseDir, entry.name);
          
          try {
            const stats = await fs.promises.stat(backupPath);
            const files = await this.getBackupFiles(backupPath);
            
            backups.push({
              conversationId,
              backupPath,
              timestamp: stats.birthtime,
              files
            });
              processedIds.add(conversationId);
          } catch (error) {
              console.warn(`Failed to read backup info for ${entry.name} in ${baseDir}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read backups from ${baseDir}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get files in a specific backup directory
   */
  private async getBackupFiles(backupPath: string): Promise<BackupFileInfo[]> {
    const files: BackupFileInfo[] = [];
    
    try {
      await this.walkDirectory(backupPath, backupPath, files);
    } catch (error) {
      console.warn('Failed to walk backup directory:', error);
    }
    
    return files;
  }

  /**
   * Recursively walk directory to find all backup files
   */
  private async walkDirectory(dirPath: string, backupRoot: string, files: BackupFileInfo[]): Promise<void> {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, backupRoot, files);
      } else if (entry.isFile()) {
        // Check if this is a metadata file for AppsScript
        if (entry.name.endsWith('.meta.json')) {
          // Skip adding meta files to the list, they are handled during revert
          continue;
        }

        const relativePath = path.relative(backupRoot, fullPath);
        
        // Handle AppsScript backups
        if (entry.name.startsWith('appsscript_')) {
          const metaPath = fullPath + '.meta.json';
          try {
            const metaContent = await fs.promises.readFile(metaPath, 'utf-8');
            const metadata = JSON.parse(metaContent);
            
            files.push({
              originalPath: metadata.originalPath, // "fileName" in Apps Script project
              backupPath: fullPath,
              isNewFile: metadata.isNewFile,
              exists: true,
              type: 'appsscript',
              scriptId: metadata.scriptId,
              fileType: metadata.fileType
            } as any);
          } catch (error) {
            console.warn(`⚠️ Failed to read metadata for AppsScript backup: ${entry.name}`);
          }
          continue;
        }

        const isNewFile = entry.name.endsWith('.init');
        const originalPath = isNewFile 
          ? path.resolve(this.projectPath || process.cwd(), relativePath.replace('.init', ''))
          : path.resolve(this.projectPath || process.cwd(), relativePath);
        
        files.push({
          originalPath,
          backupPath: fullPath,
          isNewFile,
          exists: true
        });
      }
    }
  }

  /**
   * Revert a single conversation's changes
   */
  async revertConversation(conversationId: string): Promise<RevertResult> {
    console.log(`🔄 Reverting conversation: ${conversationId}`);
    
    const result: RevertResult = {
      success: true,
      conversationId,
      filesReverted: [],
      filesDeleted: [],
      errors: []
    };

    try {
      const backups = await this.getAvailableBackups();
      const backup = backups.find(b => b.conversationId === conversationId);
      
      if (!backup) {
        result.success = false;
        result.errors.push(`Backup not found for conversation: ${conversationId}`);
        return result;
      }

      console.log(`📁 Found backup with ${backup.files.length} files`);

      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();

      for (const fileInfo of backup.files) {
        try {
          // Handle AppsScript reversion
          if ((fileInfo as any).type === 'appsscript') {
            const scriptId = (fileInfo as any).scriptId;
            const fileName = fileInfo.originalPath;
            
            console.log(`🔄 Reverting AppsScript file: ${fileName} in script ${scriptId}`);
            console.log(`🔍 Debug: Backup file info:`, JSON.stringify(fileInfo, null, 2));
            
            // Get current template copy
            const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(scriptId);
            if (!templateCopy) {
              throw new Error(`Template copy not found for script ID: ${scriptId}`);
            }
            
            const scriptContent = templateCopy.scriptContent || { files: [] };
            const existingFiles = scriptContent.files || [];
            console.log(`🔍 Debug: Current DB state for script ${scriptId}: ${existingFiles.length} files`);
            
            const fileIndex = existingFiles.findIndex((f: any) => f.name === fileName);
            if (fileIndex >= 0) {
               console.log(`🔍 Debug: Found existing file '${fileName}' at index ${fileIndex}. Current source length: ${existingFiles[fileIndex].source?.length}`);
            } else {
               console.log(`🔍 Debug: File '${fileName}' not found in current DB state.`);
            }
            
            if (fileInfo.isNewFile) {
              // File was created in this conversation - delete it
              if (fileIndex >= 0) {
                existingFiles.splice(fileIndex, 1);
                result.filesDeleted.push(fileName);
                console.log(`🗑️ Deleted AppsScript file: ${fileName}`);
              }
            } else {
              // File was modified - restore content
              console.log(`🔍 Debug: Reading backup from: ${fileInfo.backupPath}`);
              const backupContent = await fs.promises.readFile(fileInfo.backupPath, 'utf-8');
              const fileType = (fileInfo as any).fileType || 'SERVER_JS';
              
              console.log(`📄 Restoring content for ${fileName} (backup length: ${backupContent.length})`);
              console.log(`📄 Backup content preview (first 100): ${backupContent.substring(0, 100).replace(/\n/g, '\\n')}`);

              if (fileIndex >= 0) {
                existingFiles[fileIndex].source = backupContent;
                existingFiles[fileIndex].type = fileType;
                console.log(`✅ Updated existing file entry at index ${fileIndex}`);
              } else {
                // File was deleted? Restore it
                existingFiles.push({
                  name: fileName,
                  type: fileType,
                  source: backupContent
                });
                console.log(`✅ Added new file entry for restored file. Total files now: ${existingFiles.length}`);
              }
              result.filesReverted.push(fileName);
              console.log(`📝 Restored AppsScript file: ${fileName}`);
            }
            
            // Update database
            // IMPORTANT: When updating script content, we must ensure we're updating the FULL structure
            // including all other files that might exist.
            // The templateCopy fetched above contains the CURRENT state from DB.
            // We modified 'existingFiles' array in-place, so we can use it directly.
            
            console.log(`🔍 Debug: About to update DB for script ${scriptId}. Files count: ${existingFiles.length}`);
            const updated = templateCopiesManager.updateTemplateCopyScriptContent(scriptId, { ...scriptContent, files: existingFiles });
            console.log(`🔍 Debug: Update operation result: ${updated}`);
            
            if (!updated) {
              throw new Error('Failed to update script content in database during revert');
            } else {
              console.log(`✅ Successfully updated database for ${fileName}`);
              
              // Verify update
              const verifiedCopy = templateCopiesManager.getTemplateCopyByScriptId(scriptId);
              const verifiedFile = verifiedCopy?.scriptContent?.files?.find((f: any) => f.name === fileName);
              if (verifiedFile) {
                console.log(`🔍 Verification: File in DB has length ${verifiedFile.source?.length}`);
                console.log(`🔍 Verification: Content match: ${verifiedFile.source === (fileInfo.isNewFile ? undefined : await fs.promises.readFile(fileInfo.backupPath, 'utf-8'))}`);
              } else {
                if (!fileInfo.isNewFile) {
                    console.warn(`⚠️ Verification failed: File ${fileName} not found in DB after update`);
                } else {
                    console.log(`🔍 Verification: File ${fileName} correctly removed from DB (was new file)`);
                }
              }
            }
            
            continue;
          }

          if (fileInfo.isNewFile) {
            // File was created in this conversation - delete it
            const fileExists = await fs.promises.access(fileInfo.originalPath).then(() => true).catch(() => false);
            if (fileExists) {
              await fs.promises.unlink(fileInfo.originalPath);
              result.filesDeleted.push(fileInfo.originalPath);
              console.log(`🗑️ Deleted file: ${fileInfo.originalPath}`);
            }
          } else {
            // File was modified - restore from backup
            const backupContent = await fs.promises.readFile(fileInfo.backupPath, 'utf-8');
            
            // Ensure directory exists
            const dir = path.dirname(fileInfo.originalPath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            await fs.promises.writeFile(fileInfo.originalPath, backupContent, 'utf-8');
            result.filesReverted.push(fileInfo.originalPath);
            console.log(`📝 Restored file: ${fileInfo.originalPath}`);
          }
        } catch (error) {
          const errorMsg = `Failed to revert ${fileInfo.originalPath}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      // Remove the backup directory after successful reversion
      if (result.errors.length === 0) {
        try {
          await fs.promises.rm(backup.backupPath, { recursive: true, force: true });
          console.log(`🗑️ Removed backup directory: ${backup.backupPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to remove backup directory: ${error}`);
        }
      }

      result.success = result.errors.length === 0;
      
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to revert conversation: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Revert to a specific conversation (reverting all conversations after it chronologically)
   */
  async revertToConversation(targetConversationId: string): Promise<RevertSummary> {
    console.log(`🔄 Reverting to conversation: ${targetConversationId}`);
    
    const summary: RevertSummary = {
      success: true,
      conversationsReverted: [],
      totalFilesReverted: 0,
      totalFilesDeleted: 0,
      errors: []
    };

    try {
      const backups = await this.getAvailableBackups();
      const targetIndex = backups.findIndex(b => b.conversationId === targetConversationId);
      
      if (targetIndex === -1) {
        summary.success = false;
        summary.errors.push(`Target conversation not found: ${targetConversationId}`);
        return summary;
      }

      // Get conversations to revert (from newest to target, inclusive)
      const conversationsToRevert = backups.slice(0, targetIndex + 1);
      console.log(`📋 Found ${conversationsToRevert.length} conversations to revert:`, 
        conversationsToRevert.map(c => c.conversationId));

      // Revert conversations in chronological order (newest first)
      for (const backup of conversationsToRevert) {
        console.log(`🔄 Reverting conversation: ${backup.conversationId}`);
        const result = await this.revertConversation(backup.conversationId);
        
        summary.conversationsReverted.push(backup.conversationId);
        summary.totalFilesReverted += result.filesReverted.length;
        summary.totalFilesDeleted += result.filesDeleted.length;
        
        if (!result.success) {
          summary.success = false;
          summary.errors.push(...result.errors);
        }
      }

    } catch (error) {
      summary.success = false;
      summary.errors.push(`Failed to revert to conversation: ${error instanceof Error ? error.message : String(error)}`);
    }

    return summary;
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalFiles: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    totalSizeBytes: number;
  }> {
    const backups = await this.getAvailableBackups();
    
    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalFiles: 0,
        totalSizeBytes: 0
      };
    }

    let totalFiles = 0;
    let totalSizeBytes = 0;

    for (const backup of backups) {
      totalFiles += backup.files.length;
      
      // Calculate backup size
      for (const file of backup.files) {
        try {
          const stats = await fs.promises.stat(file.backupPath);
          totalSizeBytes += stats.size;
        } catch (error) {
          // Ignore files that can't be stat'd
        }
      }
    }

    return {
      totalBackups: backups.length,
      totalFiles,
      oldestBackup: backups[backups.length - 1]?.timestamp,
      newestBackup: backups[0]?.timestamp,
      totalSizeBytes
    };
  }

  /**
   * Clean up old backups (keep only the N most recent)
   */
  async cleanupOldBackups(keepCount: number = 10): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    const result = { cleaned: 0, errors: [] };
    
    try {
      const backups = await this.getAvailableBackups();
      const toDelete = backups.slice(keepCount); // Keep only the first N (newest)
      
      for (const backup of toDelete) {
        try {
          await fs.promises.rm(backup.backupPath, { recursive: true, force: true });
          result.cleaned++;
          console.log(`🗑️ Cleaned up old backup: ${backup.conversationId}`);
        } catch (error) {
          const errorMsg = `Failed to delete backup ${backup.conversationId}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup backups: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }
}

// Export singleton instance
export const backupManager = new BackupManager();
