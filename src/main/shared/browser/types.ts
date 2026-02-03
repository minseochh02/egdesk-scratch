/**
 * Shared TypeScript types for browser automation
 */

import { Browser, BrowserContext, Page, LaunchOptions } from 'playwright-core';

/**
 * Browser pool profile type
 */
export type BrowserPoolProfile = 'standard' | 'headless' | 'custom';

/**
 * Options for browser launch
 */
export interface BrowserLaunchOptions {
  /** Browser launch arguments */
  args?: string[];
  /** Chrome extensions to load (forces dedicated browser) */
  extensions?: string[];
  /** Headless mode */
  headless?: boolean;
  /** Chrome channel (chrome, msedge, etc.) */
  channel?: string;
  /** Executable path override */
  executablePath?: string;
  /** Proxy configuration */
  proxy?: {
    server: string;
    username?: string;
    password?: string;
    bypass?: string;
  };
  /** Launch timeout in ms */
  timeout?: number;
}

/**
 * Options for browser context creation
 */
export interface ContextOptions {
  /** Viewport size (null for native size) */
  viewport?: { width: number; height: number } | null;
  /** Permissions to grant */
  permissions?: string[];
  /** Accept downloads */
  acceptDownloads?: boolean;
  /** Downloads path (caller-specified) */
  downloadsPath?: string;
  /** User agent override */
  userAgent?: string;
  /** Locale */
  locale?: string;
  /** Timezone */
  timezoneId?: string;
  /** Geolocation */
  geolocation?: { latitude: number; longitude: number };
  /** Extra HTTP headers */
  extraHTTPHeaders?: Record<string, string>;
}

/**
 * Options for profile management
 */
export interface ProfileOptions {
  /** Profile name prefix (e.g., 'youtube-login', 'facebook-post') */
  profilePrefix: string;
  /** Base directory for profiles (defaults to userData/chrome-profiles) */
  baseDir?: string;
  /** Whether to use persistent profile (saved between sessions) */
  persistent?: boolean;
}

/**
 * Options for credential resolution
 */
export interface CredentialOptions {
  /** Username override */
  username?: string;
  /** Password override */
  password?: string;
}

/**
 * Resolved credentials
 */
export interface Credentials {
  username: string;
  password: string;
}

/**
 * Browser pool context request options
 */
export interface BrowserPoolContextOptions extends BrowserLaunchOptions, ContextOptions {
  /** Pool profile type */
  profile?: BrowserPoolProfile;
  /** Purpose description for logging */
  purpose?: string;
}

/**
 * Browser context result with cleanup function
 */
export interface BrowserContextResult {
  /** Browser instance (may be shared in pool) */
  browser?: Browser;
  /** Browser context */
  context: BrowserContext;
  /** Primary page */
  page: Page;
  /** Cleanup function to close context/browser and remove profile */
  cleanup: () => Promise<void>;
}

/**
 * Browser signature for compatibility matching
 */
export interface BrowserSignature {
  /** Launch arguments */
  args: string[];
  /** Extensions loaded */
  extensions: string[];
  /** Headless mode */
  headless: boolean;
  /** Chrome channel */
  channel?: string;
}

/**
 * Browser pool configuration
 */
export interface BrowserPoolConfig {
  /** Maximum shared browsers per pool */
  maxSharedBrowsers: number;
  /** Maximum contexts per browser */
  maxContextsPerBrowser: number;
  /** Browser idle timeout (ms) - close if idle */
  browserIdleTimeout: number;
  /** Context idle timeout (ms) - close if idle */
  contextIdleTimeout: number;
}

/**
 * Cleanup options
 */
export interface CleanupOptions {
  /** Profile directory to clean up */
  profileDir?: string;
  /** Browser to close */
  browser?: Browser;
  /** Context to close */
  context?: BrowserContext;
  /** Force cleanup even on error */
  force?: boolean;
}

/**
 * Service type for credential resolution
 */
export type ServiceType =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'naver'
  | 'hometax'
  | 'shinhan'
  | 'kookmin'
  | 'nh'
  | 'nh-business';
