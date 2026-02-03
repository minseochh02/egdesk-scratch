/**
 * Browser and context factory
 * High-level functions for creating browsers with profiles
 * Handles both launch() and launchPersistentContext() patterns
 */

import { chromium, BrowserContext, Page } from 'playwright-core';
import { app } from 'electron';
import path from 'path';
import {
  BrowserLaunchOptions,
  ContextOptions,
  ProfileOptions,
  BrowserContextResult,
} from './types';
import {
  DEFAULT_LAUNCH_ARGS,
  HEADLESS_LAUNCH_ARGS,
  DEFAULT_VIEWPORT,
  DEFAULT_PERMISSIONS,
  CHROME_CHANNEL,
  DEFAULT_LAUNCH_TIMEOUT,
} from './config';
import { createProfileDirectory } from './profile';
import { createCleanupHandler } from './cleanup';

/**
 * Create a browser with a unique profile
 * Use this for most automation tasks that need profile isolation
 *
 * @param options Combined browser launch and context options
 * @returns Browser context result with cleanup function
 *
 * @example
 * const { context, page, cleanup } = await createBrowserWithProfile({
 *   profilePrefix: 'youtube-login',
 *   downloadsPath: '/custom/path',
 *   headless: false
 * });
 *
 * try {
 *   await page.goto('https://youtube.com');
 *   // ... automation logic
 * } finally {
 *   await cleanup();
 * }
 */
export async function createBrowserWithProfile(
  options: BrowserLaunchOptions & ContextOptions & ProfileOptions
): Promise<BrowserContextResult> {
  const {
    // Profile options
    profilePrefix,
    baseDir,
    persistent = false,

    // Launch options
    args,
    extensions,
    headless = false,
    channel = CHROME_CHANNEL,
    executablePath,
    proxy,
    timeout = DEFAULT_LAUNCH_TIMEOUT,

    // Context options
    viewport = DEFAULT_VIEWPORT,
    permissions = DEFAULT_PERMISSIONS,
    acceptDownloads = true,
    downloadsPath,
    userAgent,
    locale,
    timezoneId,
    geolocation,
    extraHTTPHeaders,
  } = options;

  // Create unique profile directory
  const profileDir = createProfileDirectory({
    profilePrefix,
    baseDir,
    persistent,
  });

  console.log(`🌐 Creating browser with profile: ${profileDir}`);

  try {
    // Determine launch args
    const launchArgs = args || (headless ? HEADLESS_LAUNCH_ARGS : DEFAULT_LAUNCH_ARGS);

    // Add extensions to args if provided
    const finalArgs = [...launchArgs];
    if (extensions && extensions.length > 0) {
      for (const ext of extensions) {
        finalArgs.push(`--disable-extensions-except=${ext}`);
        finalArgs.push(`--load-extension=${ext}`);
      }
    }

    // Launch persistent context
    const context = await chromium.launchPersistentContext(profileDir, {
      headless,
      channel,
      executablePath,
      args: finalArgs,
      proxy,
      timeout,
      viewport,
      permissions,
      acceptDownloads,
      downloadsPath: downloadsPath || path.join(app.getPath('downloads'), `EGDesk-${profilePrefix}`),
      userAgent,
      locale,
      timezoneId,
      geolocation,
      extraHTTPHeaders,
    });

    // Get or create page
    const page = await getOrCreatePage(context);

    // Create cleanup handler
    const cleanup = createCleanupHandler({
      context,
      profileDir: persistent ? undefined : profileDir, // Don't delete persistent profiles
    });

    console.log(`✅ Browser created with profile: ${profilePrefix}`);

    return {
      context,
      page,
      cleanup,
    };
  } catch (error) {
    console.error(`Failed to create browser with profile ${profilePrefix}:`, error);
    throw error;
  }
}

/**
 * Create a browser context without profile (ephemeral)
 * Use this for quick operations that don't need profile persistence
 *
 * @param options Combined browser launch and context options
 * @returns Browser context result with cleanup function
 *
 * @example
 * const { browser, context, page, cleanup } = await createEphemeralContext({
 *   headless: true
 * });
 *
 * try {
 *   await page.goto('https://example.com');
 * } finally {
 *   await cleanup();
 * }
 */
export async function createEphemeralContext(
  options: BrowserLaunchOptions & ContextOptions = {}
): Promise<BrowserContextResult> {
  const {
    // Launch options
    args,
    extensions,
    headless = false,
    channel = CHROME_CHANNEL,
    executablePath,
    proxy,
    timeout = DEFAULT_LAUNCH_TIMEOUT,

    // Context options
    viewport = DEFAULT_VIEWPORT,
    permissions = DEFAULT_PERMISSIONS,
    acceptDownloads = true,
    downloadsPath,
    userAgent,
    locale,
    timezoneId,
    geolocation,
    extraHTTPHeaders,
  } = options;

  console.log('🌐 Creating ephemeral browser context');

  try {
    // Determine launch args
    const launchArgs = args || (headless ? HEADLESS_LAUNCH_ARGS : DEFAULT_LAUNCH_ARGS);

    // Add extensions to args if provided
    const finalArgs = [...launchArgs];
    if (extensions && extensions.length > 0) {
      for (const ext of extensions) {
        finalArgs.push(`--disable-extensions-except=${ext}`);
        finalArgs.push(`--load-extension=${ext}`);
      }
    }

    // Launch browser
    const browser = await chromium.launch({
      headless,
      channel,
      executablePath,
      args: finalArgs,
      proxy,
      timeout,
    });

    // Create context
    const context = await browser.newContext({
      viewport,
      permissions,
      acceptDownloads,
      downloadsPath,
      userAgent,
      locale,
      timezoneId,
      geolocation,
      extraHTTPHeaders,
    });

    // Get or create page
    const page = await getOrCreatePage(context);

    // Create cleanup handler
    const cleanup = createCleanupHandler({
      browser,
      context,
    });

    console.log('✅ Ephemeral browser context created');

    return {
      browser,
      context,
      page,
      cleanup,
    };
  } catch (error) {
    console.error('Failed to create ephemeral browser context:', error);
    throw error;
  }
}

/**
 * Get existing page or create new one
 * Common pattern across all browser automation
 *
 * @param context Browser context
 * @returns Page
 */
export async function getOrCreatePage(context: BrowserContext): Promise<Page> {
  const pages = context.pages();
  if (pages.length > 0) {
    return pages[0];
  }
  return await context.newPage();
}

/**
 * Create context with specific window size and position
 * Used by browser recorder and hometax automation
 *
 * @param options Launch options with window bounds
 * @returns Browser context result
 */
export async function createBrowserWithWindow(
  options: BrowserLaunchOptions &
    ContextOptions &
    ProfileOptions & {
      windowWidth?: number;
      windowHeight?: number;
      windowX?: number;
      windowY?: number;
    }
): Promise<BrowserContextResult> {
  const { windowWidth, windowHeight, windowX, windowY, args = [], ...restOptions } = options;

  // Add window size/position to args
  const finalArgs = [...args];
  if (windowWidth && windowHeight) {
    finalArgs.push(`--window-size=${windowWidth},${windowHeight}`);
  }
  if (windowX !== undefined && windowY !== undefined) {
    finalArgs.push(`--window-position=${windowX},${windowY}`);
  }

  return await createBrowserWithProfile({
    ...restOptions,
    args: finalArgs,
  });
}
