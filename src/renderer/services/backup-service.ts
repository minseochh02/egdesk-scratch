/**
 * Backup Service
 * Handles communication with the main process for backup management
 */

export interface BackupInfo {
  conversationId: string;
  backupPath: string;
  timestamp: Date;
  files: BackupFileInfo[];
}

export interface BackupFileInfo {
  originalPath: string;
  backupPath: string;
  isNewFile: boolean;
  exists: boolean;
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

export interface BackupStats {
  totalBackups: number;
  totalFiles: number;
  oldestBackup?: Date;
  newestBackup?: Date;
  totalSizeBytes: number;
}

export class BackupService {
  /**
   * Get all available backups
   */
  static async getAvailableBackups(): Promise<BackupInfo[]> {
    try {
      const result = await window.electron.backup.getAvailableBackups();
      if (result.success) {
        // Convert timestamp strings back to Date objects
        return result.backups.map((backup: any) => ({
          ...backup,
          timestamp: new Date(backup.timestamp)
        }));
      } else {
        console.error('Failed to get available backups:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error getting available backups:', error);
      return [];
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStats(): Promise<BackupStats | null> {
    try {
      const result = await window.electron.backup.getBackupStats();
      if (result.success) {
        const stats = result.stats;
        return {
          ...stats,
          oldestBackup: stats.oldestBackup ? new Date(stats.oldestBackup) : undefined,
          newestBackup: stats.newestBackup ? new Date(stats.newestBackup) : undefined
        };
      } else {
        console.error('Failed to get backup stats:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting backup stats:', error);
      return null;
    }
  }

  /**
   * Revert a single conversation
   */
  static async revertConversation(conversationId: string): Promise<RevertResult | null> {
    try {
      const result = await window.electron.backup.revertConversation(conversationId);
      if (result.success) {
        return result.result;
      } else {
        console.error('Failed to revert conversation:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error reverting conversation:', error);
      return null;
    }
  }

  /**
   * Revert to a specific conversation (chronological reversion)
   */
  static async revertToConversation(targetConversationId: string): Promise<RevertSummary | null> {
    try {
      const result = await window.electron.backup.revertToConversation(targetConversationId);
      if (result.success) {
        return result.summary;
      } else {
        console.error('Failed to revert to conversation:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error reverting to conversation:', error);
      return null;
    }
  }

  /**
   * Clean up old backups
   */
  static async cleanupOldBackups(keepCount: number = 10): Promise<{ cleaned: number; errors: string[] } | null> {
    try {
      const result = await window.electron.backup.cleanupOldBackups(keepCount);
      if (result.success) {
        return result.result;
      } else {
        console.error('Failed to cleanup old backups:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
      return null;
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format relative time for display
   */
  static formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString();
  }
}
