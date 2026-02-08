/**
 * IPC handlers for Skillset operations
 * Exposes Skillset functionality to the renderer process
 */

import { ipcMain } from 'electron';
import * as SkillsetManager from './skillset-manager';
import * as SkillsetLearning from './skillset-learning';
import { CapabilityQueryOptions, ExecutionFeedback, ExplorerResult } from './types';

/**
 * Register all Skillset IPC handlers
 */
export function registerSkillsetHandlers(): void {
  console.log('[Skillset IPC] Registering IPC handlers...');

  // Website operations
  ipcMain.handle('skillset:list-websites', handleListWebsites);
  ipcMain.handle('skillset:get-website', handleGetWebsite);
  ipcMain.handle('skillset:get-website-by-url', handleGetWebsiteByUrl);
  ipcMain.handle('skillset:create-website', handleCreateWebsite);
  ipcMain.handle('skillset:update-website', handleUpdateWebsite);
  ipcMain.handle('skillset:delete-website', handleDeleteWebsite);
  ipcMain.handle('skillset:update-last-used', handleUpdateLastUsed);

  // Capability operations
  ipcMain.handle('skillset:get-capabilities', handleGetCapabilities);
  ipcMain.handle('skillset:query-capabilities', handleQueryCapabilities);
  ipcMain.handle('skillset:add-capability', handleAddCapability);
  ipcMain.handle('skillset:get-capability', handleGetCapability);

  // Learning operations
  ipcMain.handle('skillset:record-success', handleRecordSuccess);
  ipcMain.handle('skillset:record-failure', handleRecordFailure);
  ipcMain.handle('skillset:process-feedback', handleProcessFeedback);
  ipcMain.handle('skillset:get-website-health', handleGetWebsiteHealth);
  ipcMain.handle('skillset:get-improvement-recommendations', handleGetImprovementRecommendations);
  ipcMain.handle('skillset:should-re-explore', handleShouldReExplore);

  // Exploration integration
  ipcMain.handle('skillset:save-exploration-results', handleSaveExplorationResults);

  // Credential operations
  ipcMain.handle('skillset:save-credentials', handleSaveCredentials);
  ipcMain.handle('skillset:get-credentials', handleGetCredentials);
  ipcMain.handle('skillset:has-credentials', handleHasCredentials);
  ipcMain.handle('skillset:delete-credentials', handleDeleteCredentials);
  ipcMain.handle('skillset:invalidate-credentials', handleInvalidateCredentials);
  ipcMain.handle('skillset:get-credential-status', handleGetCredentialStatus);

  console.log('[Skillset IPC] Handlers registered successfully');
}

// Website handlers

async function handleListWebsites(): Promise<any> {
  try {
    return SkillsetManager.listWebsites();
  } catch (error) {
    console.error('[Skillset IPC] Error listing websites:', error);
    throw error;
  }
}

async function handleGetWebsite(_event: any, websiteId: string): Promise<any> {
  try {
    return SkillsetManager.getWebsite(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting website:', error);
    throw error;
  }
}

async function handleGetWebsiteByUrl(_event: any, url: string): Promise<any> {
  try {
    return SkillsetManager.getWebsiteByUrl(url);
  } catch (error) {
    console.error('[Skillset IPC] Error getting website by URL:', error);
    throw error;
  }
}

async function handleCreateWebsite(
  _event: any,
  params: {
    url: string;
    siteName: string;
    siteType?: string;
    loginMethod?: any;
  }
): Promise<any> {
  try {
    return SkillsetManager.createWebsite(params);
  } catch (error) {
    console.error('[Skillset IPC] Error creating website:', error);
    throw error;
  }
}

async function handleUpdateWebsite(
  _event: any,
  websiteId: string,
  updates: any
): Promise<void> {
  try {
    SkillsetManager.updateWebsite(websiteId, updates);
  } catch (error) {
    console.error('[Skillset IPC] Error updating website:', error);
    throw error;
  }
}

async function handleDeleteWebsite(_event: any, websiteId: string): Promise<void> {
  try {
    SkillsetManager.deleteWebsite(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error deleting website:', error);
    throw error;
  }
}

async function handleUpdateLastUsed(_event: any, websiteId: string): Promise<void> {
  try {
    SkillsetManager.updateLastUsed(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error updating last used:', error);
    throw error;
  }
}

// Capability handlers

async function handleGetCapabilities(
  _event: any,
  websiteId: string,
  options?: CapabilityQueryOptions
): Promise<any> {
  try {
    return SkillsetManager.getCapabilities(websiteId, options);
  } catch (error) {
    console.error('[Skillset IPC] Error getting capabilities:', error);
    throw error;
  }
}

async function handleQueryCapabilities(
  _event: any,
  options: CapabilityQueryOptions
): Promise<any> {
  try {
    return SkillsetManager.queryCapabilities(options);
  } catch (error) {
    console.error('[Skillset IPC] Error querying capabilities:', error);
    throw error;
  }
}

async function handleAddCapability(_event: any, params: any): Promise<any> {
  try {
    return SkillsetManager.addCapability(params);
  } catch (error) {
    console.error('[Skillset IPC] Error adding capability:', error);
    throw error;
  }
}

async function handleGetCapability(_event: any, capabilityId: string): Promise<any> {
  try {
    return SkillsetManager.getCapability(capabilityId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting capability:', error);
    throw error;
  }
}

// Learning handlers

async function handleRecordSuccess(
  _event: any,
  capabilityId: string,
  pathId?: string
): Promise<void> {
  try {
    SkillsetManager.recordSuccess(capabilityId, pathId);
  } catch (error) {
    console.error('[Skillset IPC] Error recording success:', error);
    throw error;
  }
}

async function handleRecordFailure(
  _event: any,
  capabilityId: string,
  pathId?: string
): Promise<void> {
  try {
    SkillsetManager.recordFailure(capabilityId, pathId);
  } catch (error) {
    console.error('[Skillset IPC] Error recording failure:', error);
    throw error;
  }
}

async function handleProcessFeedback(
  _event: any,
  feedback: ExecutionFeedback
): Promise<void> {
  try {
    SkillsetLearning.processExecutionFeedback(feedback);
  } catch (error) {
    console.error('[Skillset IPC] Error processing feedback:', error);
    throw error;
  }
}

async function handleGetWebsiteHealth(_event: any, websiteId: string): Promise<any> {
  try {
    return SkillsetLearning.getWebsiteHealth(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting website health:', error);
    throw error;
  }
}

async function handleGetImprovementRecommendations(
  _event: any,
  websiteId: string
): Promise<string[]> {
  try {
    return SkillsetLearning.getImprovementRecommendations(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting recommendations:', error);
    throw error;
  }
}

async function handleShouldReExplore(_event: any, websiteId: string): Promise<any> {
  try {
    return SkillsetLearning.shouldReExploreWebsite(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error checking re-explore:', error);
    throw error;
  }
}

// Exploration handlers

async function handleSaveExplorationResults(
  _event: any,
  url: string,
  result: ExplorerResult
): Promise<any> {
  try {
    return SkillsetManager.saveExplorationResults(url, result);
  } catch (error) {
    console.error('[Skillset IPC] Error saving exploration results:', error);
    throw error;
  }
}

// Credential handlers

async function handleSaveCredentials(
  _event: any,
  websiteId: string,
  credentials: Record<string, string>
): Promise<void> {
  try {
    SkillsetManager.saveCredentials(websiteId, credentials);
  } catch (error) {
    console.error('[Skillset IPC] Error saving credentials:', error);
    throw error;
  }
}

async function handleGetCredentials(
  _event: any,
  websiteId: string
): Promise<Record<string, string> | null> {
  try {
    return SkillsetManager.getCredentials(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting credentials:', error);
    throw error;
  }
}

async function handleHasCredentials(
  _event: any,
  websiteId: string
): Promise<boolean> {
  try {
    return SkillsetManager.hasCredentials(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error checking credentials:', error);
    throw error;
  }
}

async function handleDeleteCredentials(
  _event: any,
  websiteId: string
): Promise<void> {
  try {
    SkillsetManager.deleteCredentials(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error deleting credentials:', error);
    throw error;
  }
}

async function handleInvalidateCredentials(
  _event: any,
  websiteId: string,
  error?: string
): Promise<void> {
  try {
    SkillsetManager.invalidateCredentials(websiteId, error);
  } catch (error) {
    console.error('[Skillset IPC] Error invalidating credentials:', error);
    throw error;
  }
}

async function handleGetCredentialStatus(
  _event: any,
  websiteId: string
): Promise<any> {
  try {
    return SkillsetManager.getCredentialStatus(websiteId);
  } catch (error) {
    console.error('[Skillset IPC] Error getting credential status:', error);
    throw error;
  }
}
