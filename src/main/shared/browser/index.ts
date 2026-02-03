/**
 * Centralized Browser Management Module
 *
 * Provides unified browser automation utilities:
 * - Profile management (creation, cleanup)
 * - Browser/context factories
 * - Hybrid browser pool (60-80% resource savings)
 * - Anti-detection measures
 * - Credential resolution
 * - Cleanup handlers
 *
 * Usage Examples:
 *
 * 1. Quick automation (shared pool):
 *    import { browserPoolManager } from './shared/browser';
 *    const { context, page, cleanup } = await browserPoolManager.getContext({
 *      profile: 'standard'
 *    });
 *
 * 2. With profile (isolated):
 *    import { createBrowserWithProfile, applyAntiDetectionMeasures } from './shared/browser';
 *    const { context, page, cleanup } = await createBrowserWithProfile({
 *      profilePrefix: 'youtube-login',
 *      headless: false
 *    });
 *    await applyAntiDetectionMeasures(page);
 *
 * 3. Ephemeral (no profile):
 *    import { createEphemeralContext } from './shared/browser';
 *    const { browser, context, page, cleanup } = await createEphemeralContext({
 *      headless: true
 *    });
 *
 * 4. Credentials:
 *    import { resolveCredentials } from './shared/browser';
 *    const creds = resolveCredentials('youtube', { username: 'user@example.com' });
 */

// Types
export * from './types';

// Configuration
export {
  DEFAULT_LAUNCH_ARGS,
  HEADLESS_LAUNCH_ARGS,
  DEFAULT_VIEWPORT,
  DEFAULT_PERMISSIONS,
  CHROME_CHANNEL,
  DEFAULT_LAUNCH_TIMEOUT,
  DEFAULT_HEADLESS,
  DEFAULT_POOL_CONFIG,
  PROFILE_PREFIXES,
  CREDENTIAL_ENV_VARS,
} from './config';

// Profile Management
export {
  getProfilesDirectory,
  createProfileDirectory,
  cleanupProfile,
  cleanupOldProfiles,
  getProfilesDiskUsage,
  listProfiles,
} from './profile';

// Credential Resolution
export {
  resolveCredentials,
  hasCredentials,
  getCredentialEnvVars,
} from './credentials';

// Anti-Detection
export {
  applyAntiDetectionMeasures,
  applyMinimalAntiDetection,
} from './anti-detection';

// Cleanup Utilities
export {
  createCleanupHandler,
  setupProcessCleanup,
  cleanupAll,
  withCleanup,
  cleanupContext,
  cleanupBrowser,
} from './cleanup';

// Browser Factory
export {
  createBrowserWithProfile,
  createEphemeralContext,
  getOrCreatePage,
  createBrowserWithWindow,
} from './factory';

// Browser Pool Manager
export {
  BrowserPoolManager,
  browserPoolManager, // Singleton instance
} from './pool-manager';
