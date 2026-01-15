/**
 * Auto Sync Setup
 *
 * Automatically sets up sync endpoints when creating or copying
 * Apps Script projects. This module hooks into the project creation
 * flow and injects the necessary sync logic.
 */

import { AppsScriptService } from '../apps-script/apps-script-service';
import { AppsScriptSyncInjector, SyncInjectionConfig, SyncInjectionResult } from './apps-script-sync-injector';
import { getTunnelInfo } from '../server-creator/tunneling-manager';

export interface AutoSyncSetupOptions {
  /** Automatically inject sync endpoints (default: true) */
  autoInject?: boolean;
  /** Sync mode (default: 'manual') */
  syncMode?: 'manual' | 'periodic' | 'realtime';
  /** Tunnel URL (if known) */
  tunnelUrl?: string;
  /** Use existing tunnel for this server name */
  serverName?: string;
  /** Periodic interval in milliseconds (default: 60000) */
  periodicIntervalMs?: number;
}

export interface AutoSyncSetupResult {
  success: boolean;
  projectId: string;
  syncInjected: boolean;
  injectionResult?: SyncInjectionResult;
  tunnelUrl?: string;
  message: string;
  error?: string;
}

/**
 * Auto Sync Setup Manager
 * Manages automatic sync setup for Apps Script projects
 */
export class AutoSyncSetup {
  private appsScriptService: AppsScriptService;
  private syncInjector: AppsScriptSyncInjector;

  constructor(appsScriptService: AppsScriptService) {
    this.appsScriptService = appsScriptService;
    this.syncInjector = new AppsScriptSyncInjector(appsScriptService);
  }

  /**
   * Set up sync for a newly created Apps Script project
   *
   * This is the main entry point called after creating a project.
   * It handles:
   * 1. Checking if sync should be injected
   * 2. Resolving tunnel URL
   * 3. Injecting sync endpoints
   * 4. Pushing changes to Google
   *
   * @param projectId - The Apps Script project ID
   * @param options - Setup options
   */
  async setupSyncForProject(
    projectId: string,
    options: AutoSyncSetupOptions = {}
  ): Promise<AutoSyncSetupResult> {
    const {
      autoInject = true,
      syncMode = 'manual',
      tunnelUrl,
      serverName,
      periodicIntervalMs = 60000
    } = options;

    try {
      console.log(`[AutoSyncSetup] Setting up sync for project: ${projectId}`);
      console.log(`[AutoSyncSetup] Options:`, { autoInject, syncMode, serverName });

      // Step 1: Check if we should inject
      if (!autoInject) {
        return {
          success: true,
          projectId,
          syncInjected: false,
          message: 'Auto-inject disabled, skipping sync setup',
        };
      }

      // Step 2: Check if project already has sync endpoints
      const hasSync = await this.syncInjector.hasSyncEndpoints(projectId);
      if (hasSync) {
        console.log(`[AutoSyncSetup] Project already has sync endpoints`);
        return {
          success: true,
          projectId,
          syncInjected: false,
          message: 'Project already has sync endpoints',
        };
      }

      // Step 3: Resolve tunnel URL
      let resolvedTunnelUrl = tunnelUrl;
      if (!resolvedTunnelUrl && serverName) {
        const tunnelInfo = getTunnelInfo(serverName);
        if (tunnelInfo.isActive && tunnelInfo.publicUrl) {
          resolvedTunnelUrl = tunnelInfo.publicUrl;
          console.log(`[AutoSyncSetup] Using tunnel URL from active tunnel: ${resolvedTunnelUrl}`);
        } else {
          console.log(`[AutoSyncSetup] No active tunnel found for: ${serverName}`);
        }
      }

      // Step 4: Build injection config
      const config: SyncInjectionConfig = {
        syncMode,
        tunnelUrl: resolvedTunnelUrl,
        periodicIntervalMs
      };

      // Step 5: Inject sync endpoints
      console.log(`[AutoSyncSetup] Injecting sync endpoints with config:`, config);
      const injectionResult = await this.syncInjector.injectSyncEndpoints(projectId, config);

      if (!injectionResult.success) {
        console.error(`[AutoSyncSetup] Failed to inject sync endpoints:`, injectionResult.error);
        return {
          success: false,
          projectId,
          syncInjected: false,
          injectionResult,
          message: 'Failed to inject sync endpoints',
          error: injectionResult.error,
        };
      }

      console.log(`[AutoSyncSetup] Successfully injected sync endpoints`);

      // Step 6: Push changes to Google (optional, auto-save)
      try {
        console.log(`[AutoSyncSetup] Pushing changes to Google Apps Script...`);
        const pushResult = await this.appsScriptService.pushToGoogle(projectId, false);
        if (pushResult.success) {
          console.log(`[AutoSyncSetup] Successfully pushed sync endpoints to Google`);
        } else {
          console.warn(`[AutoSyncSetup] Failed to push to Google:`, pushResult.message);
        }
      } catch (pushError) {
        console.warn(`[AutoSyncSetup] Could not push to Google (continuing anyway):`, pushError);
      }

      return {
        success: true,
        projectId,
        syncInjected: true,
        injectionResult,
        tunnelUrl: resolvedTunnelUrl,
        message: `Successfully set up sync with ${injectionResult.filesCreated.length} files`,
      };
    } catch (error) {
      console.error(`[AutoSyncSetup] Error setting up sync:`, error);
      return {
        success: false,
        projectId,
        syncInjected: false,
        message: 'Error setting up sync',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update tunnel URL for an existing project with sync
   *
   * @param projectId - The Apps Script project ID
   * @param tunnelUrl - New tunnel URL
   */
  async updateTunnelUrl(
    projectId: string,
    tunnelUrl: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log(`[AutoSyncSetup] Updating tunnel URL for project: ${projectId}`);

      // Check if project has sync endpoints
      const hasSync = await this.syncInjector.hasSyncEndpoints(projectId);
      if (!hasSync) {
        return {
          success: false,
          message: 'Project does not have sync endpoints',
          error: 'No sync endpoints found',
        };
      }

      // Read and update the config file
      const configContent = await this.appsScriptService.readFile(`${projectId}/SyncConfig.gs`);

      // Simple string replacement (could be more robust with AST parsing)
      const updatedContent = configContent.replace(
        /tunnelUrl:\s*'[^']*'/,
        `tunnelUrl: '${tunnelUrl}'`
      );

      // Write back
      await this.appsScriptService.writeFile(`${projectId}/SyncConfig.gs`, updatedContent);

      console.log(`[AutoSyncSetup] Updated tunnel URL to: ${tunnelUrl}`);

      // Optionally push to Google
      try {
        await this.appsScriptService.pushToGoogle(projectId, false);
        console.log(`[AutoSyncSetup] Pushed updated config to Google`);
      } catch (pushError) {
        console.warn(`[AutoSyncSetup] Could not push to Google:`, pushError);
      }

      return {
        success: true,
        message: `Updated tunnel URL to: ${tunnelUrl}`,
      };
    } catch (error) {
      console.error(`[AutoSyncSetup] Error updating tunnel URL:`, error);
      return {
        success: false,
        message: 'Failed to update tunnel URL',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove sync endpoints from a project
   *
   * @param projectId - The Apps Script project ID
   */
  async removeSyncFromProject(
    projectId: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log(`[AutoSyncSetup] Removing sync from project: ${projectId}`);

      const result = await this.syncInjector.removeSyncEndpoints(projectId);

      if (result.success) {
        // Push changes to Google
        try {
          await this.appsScriptService.pushToGoogle(projectId, false);
          console.log(`[AutoSyncSetup] Pushed removal to Google`);
        } catch (pushError) {
          console.warn(`[AutoSyncSetup] Could not push to Google:`, pushError);
        }
      }

      return {
        success: result.success,
        message: result.message,
        error: result.error,
      };
    } catch (error) {
      console.error(`[AutoSyncSetup] Error removing sync:`, error);
      return {
        success: false,
        message: 'Failed to remove sync',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a project has sync endpoints installed
   *
   * @param projectId - The Apps Script project ID
   */
  async checkSyncStatus(
    projectId: string
  ): Promise<{ hasSync: boolean; config?: any; error?: string }> {
    try {
      const hasSync = await this.syncInjector.hasSyncEndpoints(projectId);

      if (!hasSync) {
        return { hasSync: false };
      }

      // Try to read config
      try {
        const configContent = await this.appsScriptService.readFile(`${projectId}/SyncConfig.gs`);

        // Parse config (simple regex extraction)
        const modeMatch = configContent.match(/mode:\s*'([^']*)'/);
        const urlMatch = configContent.match(/tunnelUrl:\s*'([^']*)'/);
        const intervalMatch = configContent.match(/periodicIntervalMs:\s*(\d+)/);

        return {
          hasSync: true,
          config: {
            mode: modeMatch ? modeMatch[1] : 'unknown',
            tunnelUrl: urlMatch ? urlMatch[1] : '',
            periodicIntervalMs: intervalMatch ? parseInt(intervalMatch[1]) : 60000
          }
        };
      } catch (error) {
        return {
          hasSync: true,
          config: { mode: 'unknown' }
        };
      }
    } catch (error) {
      console.error(`[AutoSyncSetup] Error checking sync status:`, error);
      return {
        hasSync: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Factory function to create auto sync setup
 */
export function createAutoSyncSetup(appsScriptService: AppsScriptService): AutoSyncSetup {
  return new AutoSyncSetup(appsScriptService);
}

/**
 * Convenience function: Set up sync when creating a new project
 *
 * This can be called right after creating an Apps Script project copy
 * to automatically inject sync endpoints.
 */
export async function setupSyncOnProjectCreation(
  projectId: string,
  options: AutoSyncSetupOptions = {}
): Promise<AutoSyncSetupResult> {
  const appsScriptService = AppsScriptService.getInstance();
  const autoSync = new AutoSyncSetup(appsScriptService);
  return await autoSync.setupSyncForProject(projectId, options);
}
