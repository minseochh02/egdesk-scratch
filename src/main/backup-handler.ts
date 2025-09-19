/**
 * Backup Handler
 * Handles IPC communication for backup management and reversion
 */

import { ipcMain } from 'electron';
import { backupManager, BackupInfo, RevertResult, RevertSummary } from './backup-manager';

export class BackupHandler {
  constructor() {
    this.registerHandlers();
  }

  /**
   * Register all backup-related IPC handlers
   */
  private registerHandlers(): void {
    // Get available backups
    ipcMain.handle('backup-get-available', async () => {
      try {
        const backups = await backupManager.getAvailableBackups();
        return { success: true, backups };
      } catch (error) {
        console.error('Failed to get available backups:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          backups: []
        };
      }
    });

    // Get backup statistics
    ipcMain.handle('backup-get-stats', async () => {
      try {
        const stats = await backupManager.getBackupStats();
        return { success: true, stats };
      } catch (error) {
        console.error('Failed to get backup stats:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Revert a single conversation
    ipcMain.handle('backup-revert-conversation', async (event, conversationId: string) => {
      try {
        console.log(`🔄 IPC: Reverting conversation ${conversationId}`);
        const result = await backupManager.revertConversation(conversationId);
        return { success: true, result };
      } catch (error) {
        console.error('Failed to revert conversation:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Revert to a specific conversation (chronological reversion)
    ipcMain.handle('backup-revert-to-conversation', async (event, targetConversationId: string) => {
      try {
        console.log(`🔄 IPC: Reverting to conversation ${targetConversationId}`);
        const summary = await backupManager.revertToConversation(targetConversationId);
        return { success: true, summary };
      } catch (error) {
        console.error('Failed to revert to conversation:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Clean up old backups
    ipcMain.handle('backup-cleanup-old', async (event, keepCount: number = 10) => {
      try {
        console.log(`🧹 IPC: Cleaning up old backups, keeping ${keepCount}`);
        const result = await backupManager.cleanupOldBackups(keepCount);
        return { success: true, result };
      } catch (error) {
        console.error('Failed to cleanup old backups:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    console.log('✅ Backup IPC handlers registered');
  }
}

// Create and export singleton instance
export const backupHandler = new BackupHandler();
