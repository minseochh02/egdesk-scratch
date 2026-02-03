/**
 * Browser and profile cleanup utilities
 * Ensures proper cleanup on success, error, and process exit
 * Fixes memory leak in automator.js where browsers aren't closed on error
 */

import { Browser, BrowserContext } from 'playwright-core';
import { cleanupProfile } from './profile';
import { CleanupOptions } from './types';

/**
 * Create a cleanup function for browser resources
 * Ensures browser, context, and profile are properly cleaned up
 *
 * @param options Cleanup options
 * @returns Cleanup function
 *
 * @example
 * const cleanup = createCleanupHandler({
 *   context: myContext,
 *   profileDir: '/path/to/profile'
 * });
 *
 * try {
 *   // Do work...
 * } finally {
 *   await cleanup();
 * }
 */
export function createCleanupHandler(options: CleanupOptions): () => Promise<void> {
  const { browser, context, profileDir, force = true } = options;

  return async () => {
    const errors: Error[] = [];

    // Close context first (if separate from browser)
    if (context && !context.browser()) {
      try {
        await context.close();
        console.log('✅ Closed browser context');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        if (force) {
          console.warn('⚠️ Error closing context:', err.message);
        }
      }
    }

    // Close browser
    if (browser) {
      try {
        await browser.close();
        console.log('✅ Closed browser');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        if (force) {
          console.warn('⚠️ Error closing browser:', err.message);
        }
      }
    }

    // Clean up profile directory
    if (profileDir) {
      try {
        await cleanupProfile(profileDir, { force });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        if (force) {
          console.warn('⚠️ Error cleaning up profile:', err.message);
        }
      }
    }

    // If not forcing and there were errors, throw the first one
    if (!force && errors.length > 0) {
      throw errors[0];
    }
  };
}

/**
 * Setup process exit handlers for cleanup
 * Ensures cleanup runs on SIGTERM, SIGINT, and uncaught errors
 *
 * @param cleanup Cleanup function to call
 *
 * @example
 * const cleanup = createCleanupHandler({ browser, profileDir });
 * setupProcessCleanup(cleanup);
 */
export function setupProcessCleanup(cleanup: () => Promise<void>): void {
  let cleanupCalled = false;

  const safeCleanup = async () => {
    if (cleanupCalled) {
      return;
    }
    cleanupCalled = true;

    try {
      await cleanup();
    } catch (error) {
      console.error('Error during process cleanup:', error);
    }
  };

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, cleaning up...');
    await safeCleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, cleaning up...');
    await safeCleanup();
    process.exit(0);
  });

  // Handle uncaught errors (optional, can be disabled if app has its own handler)
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await safeCleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    await safeCleanup();
    process.exit(1);
  });
}

/**
 * Cleanup multiple resources in parallel
 * Useful when cleaning up multiple browser instances
 *
 * @param cleanupFunctions Array of cleanup functions
 * @param options Cleanup options
 */
export async function cleanupAll(
  cleanupFunctions: Array<() => Promise<void>>,
  options?: { force?: boolean }
): Promise<void> {
  const force = options?.force ?? true;
  const results = await Promise.allSettled(cleanupFunctions.map((fn) => fn()));

  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => (r as PromiseRejectedResult).reason);

  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} cleanup error(s) occurred`);
    if (!force) {
      throw errors[0];
    }
  }
}

/**
 * Create a cleanup wrapper for async functions
 * Ensures cleanup runs even if the function throws
 *
 * @param fn Function to wrap
 * @param cleanup Cleanup function
 * @returns Wrapped function
 *
 * @example
 * const safeAutomation = withCleanup(
 *   async () => {
 *     // automation code
 *   },
 *   async () => {
 *     await browser.close();
 *   }
 * );
 *
 * await safeAutomation();
 */
export function withCleanup<T>(
  fn: () => Promise<T>,
  cleanup: () => Promise<void>
): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } finally {
      await cleanup();
    }
  };
}

/**
 * Cleanup context only (not browser)
 * Used by pool manager when browser is shared
 *
 * @param context Browser context to close
 */
export async function cleanupContext(context: BrowserContext): Promise<void> {
  try {
    await context.close();
    console.log('✅ Closed browser context');
  } catch (error) {
    console.warn('⚠️ Error closing context:', error);
  }
}

/**
 * Cleanup browser only (not profile)
 * Used when profile is persistent
 *
 * @param browser Browser instance to close
 */
export async function cleanupBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
    console.log('✅ Closed browser');
  } catch (error) {
    console.warn('⚠️ Error closing browser:', error);
  }
}
