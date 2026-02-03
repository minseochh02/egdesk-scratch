/**
 * Centralized browser configuration
 * Eliminates duplication of launch args across 9+ files
 */

import { BrowserPoolConfig } from './types';

/**
 * Default Chrome launch arguments
 * Used by: SNS modules, file conversion, most automation tasks
 */
export const DEFAULT_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-notifications',
  '--disable-infobars',
  '--window-size=1920,1080',
  '--start-maximized',
];

/**
 * Minimal launch arguments for headless operations
 * Used by: File conversion, SEO analysis, background tasks
 */
export const HEADLESS_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
];

/**
 * Default context viewport (used when not specified)
 */
export const DEFAULT_VIEWPORT = {
  width: 1920,
  height: 1080,
};

/**
 * Default permissions for browser contexts
 */
export const DEFAULT_PERMISSIONS = [
  'clipboard-read',
  'clipboard-write',
];

/**
 * Chrome channel (prefer system Chrome over bundled Chromium)
 */
export const CHROME_CHANNEL = 'chrome';

/**
 * Default browser launch timeout (ms)
 */
export const DEFAULT_LAUNCH_TIMEOUT = 30000;

/**
 * Default headless mode (can be overridden by environment)
 */
export const DEFAULT_HEADLESS = process.env.HEADLESS === 'true';

/**
 * Browser pool configuration
 */
export const DEFAULT_POOL_CONFIG: BrowserPoolConfig = {
  maxSharedBrowsers: 2,
  maxContextsPerBrowser: 8,
  browserIdleTimeout: 60000, // 1 minute
  contextIdleTimeout: 30000, // 30 seconds
};

/**
 * Profile naming prefixes
 */
export const PROFILE_PREFIXES = {
  BROWSER_RECORDER: 'browser-recorder',
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  NAVER: 'naver-blog',
  HOMETAX: 'hometax',
  FILE_CONVERSION: 'file-conversion',
  SEO_ANALYSIS: 'seo-analysis',
  BANK_SHINHAN: 'bank-shinhan',
  BANK_KOOKMIN: 'bank-kookmin',
  BANK_NH: 'bank-nh',
  BANK_NH_BUSINESS: 'bank-nh-business',
} as const;

/**
 * Environment variable names for credentials
 */
export const CREDENTIAL_ENV_VARS: Record<string, { username: string; password: string }> = {
  youtube: {
    username: 'YOUTUBE_USERNAME',
    password: 'YOUTUBE_PASSWORD',
  },
  facebook: {
    username: 'FACEBOOK_USERNAME',
    password: 'FACEBOOK_PASSWORD',
  },
  instagram: {
    username: 'INSTAGRAM_USERNAME',
    password: 'INSTAGRAM_PASSWORD',
  },
  twitter: {
    username: 'TWITTER_USERNAME',
    password: 'TWITTER_PASSWORD',
  },
  naver: {
    username: 'NAVER_USERNAME',
    password: 'NAVER_PASSWORD',
  },
  hometax: {
    username: 'HOMETAX_ID',
    password: 'HOMETAX_PASSWORD',
  },
  shinhan: {
    username: 'SHINHAN_USERNAME',
    password: 'SHINHAN_PASSWORD',
  },
  kookmin: {
    username: 'KOOKMIN_USERNAME',
    password: 'KOOKMIN_PASSWORD',
  },
  nh: {
    username: 'NH_USERNAME',
    password: 'NH_PASSWORD',
  },
  'nh-business': {
    username: 'NH_BUSINESS_USERNAME',
    password: 'NH_BUSINESS_PASSWORD',
  },
};
