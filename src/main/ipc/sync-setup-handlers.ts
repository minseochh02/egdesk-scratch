/**
 * Sync Setup IPC Handlers
 *
 * Exposes sync setup functionality to the renderer process
 */

import { ipcMain } from 'electron';
import { AppsScriptService } from '../mcp/apps-script/apps-script-service';
import {
  AutoSyncSetup,
  createAutoSyncSetup,
  AutoSyncSetupOptions,
  AutoSyncSetupResult
} from '../mcp/sheets/auto-sync-setup';

let autoSyncSetup: AutoSyncSetup | null = null;

/**
 * Get or create the AutoSyncSetup instance
 */
function getAutoSyncSetup(): AutoSyncSetup {
  if (!autoSyncSetup) {
    const appsScriptService = AppsScriptService.getInstance();
    autoSyncSetup = createAutoSyncSetup(appsScriptService);
  }
  return autoSyncSetup;
}

/**
 * Register all sync setup IPC handlers
 */
export function registerSyncSetupHandlers(): void {
  console.log('📝 Registering Sync Setup IPC handlers...');

  /**
   * Setup sync for a project
   * Channel: 'sync-setup:setup'
   */
  ipcMain.handle(
    'sync-setup:setup',
    async (
      _event,
      projectId: string,
      options: AutoSyncSetupOptions = {}
    ): Promise<AutoSyncSetupResult> => {
      console.log(`[IPC] sync-setup:setup - projectId: ${projectId}, options:`, options);

      try {
        const autoSync = getAutoSyncSetup();
        const result = await autoSync.setupSyncForProject(projectId, options);

        console.log(`[IPC] sync-setup:setup - result:`, result);
        return result;
      } catch (error) {
        console.error(`[IPC] sync-setup:setup - error:`, error);
        return {
          success: false,
          projectId,
          syncInjected: false,
          message: 'Error setting up sync',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Update tunnel URL for a project
   * Channel: 'sync-setup:update-tunnel-url'
   */
  ipcMain.handle(
    'sync-setup:update-tunnel-url',
    async (
      _event,
      projectId: string,
      tunnelUrl: string
    ): Promise<{ success: boolean; message: string; error?: string }> => {
      console.log(`[IPC] sync-setup:update-tunnel-url - projectId: ${projectId}, url: ${tunnelUrl}`);

      try {
        const autoSync = getAutoSyncSetup();
        const result = await autoSync.updateTunnelUrl(projectId, tunnelUrl);

        console.log(`[IPC] sync-setup:update-tunnel-url - result:`, result);
        return result;
      } catch (error) {
        console.error(`[IPC] sync-setup:update-tunnel-url - error:`, error);
        return {
          success: false,
          message: 'Error updating tunnel URL',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Remove sync from a project
   * Channel: 'sync-setup:remove'
   */
  ipcMain.handle(
    'sync-setup:remove',
    async (
      _event,
      projectId: string
    ): Promise<{ success: boolean; message: string; error?: string }> => {
      console.log(`[IPC] sync-setup:remove - projectId: ${projectId}`);

      try {
        const autoSync = getAutoSyncSetup();
        const result = await autoSync.removeSyncFromProject(projectId);

        console.log(`[IPC] sync-setup:remove - result:`, result);
        return result;
      } catch (error) {
        console.error(`[IPC] sync-setup:remove - error:`, error);
        return {
          success: false,
          message: 'Error removing sync',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Check sync status for a project
   * Channel: 'sync-setup:check-status'
   */
  ipcMain.handle(
    'sync-setup:check-status',
    async (
      _event,
      projectId: string
    ): Promise<{ hasSync: boolean; config?: any; error?: string }> => {
      console.log(`[IPC] sync-setup:check-status - projectId: ${projectId}`);

      try {
        const autoSync = getAutoSyncSetup();
        const result = await autoSync.checkSyncStatus(projectId);

        console.log(`[IPC] sync-setup:check-status - result:`, result);
        return result;
      } catch (error) {
        console.error(`[IPC] sync-setup:check-status - error:`, error);
        return {
          hasSync: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  console.log('✅ Sync Setup IPC handlers registered');
}

/**
 * Unregister all sync setup IPC handlers
 */
export function unregisterSyncSetupHandlers(): void {
  ipcMain.removeHandler('sync-setup:setup');
  ipcMain.removeHandler('sync-setup:update-tunnel-url');
  ipcMain.removeHandler('sync-setup:remove');
  ipcMain.removeHandler('sync-setup:check-status');

  console.log('🗑️ Sync Setup IPC handlers unregistered');
}
