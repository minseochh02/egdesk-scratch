/**
 * Hybrid Browser Pool Manager
 * Provides 60-80% resource savings by sharing browser processes
 *
 * Architecture:
 * - Standard Pool: Non-headless browsers for SNS, interactive tasks
 * - Headless Pool: Headless browsers for file conversion, background tasks
 * - Dedicated Browsers: Extensions, custom args, long-running operations
 *
 * Key Constraint: Launch args must be unified within each pool.
 * Extensions are a "hard separator" - always get dedicated browser.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import {
  BrowserPoolContextOptions,
  BrowserContextResult,
  BrowserSignature,
  BrowserPoolConfig,
} from './types';
import {
  DEFAULT_LAUNCH_ARGS,
  HEADLESS_LAUNCH_ARGS,
  DEFAULT_POOL_CONFIG,
  CHROME_CHANNEL,
  DEFAULT_LAUNCH_TIMEOUT,
  DEFAULT_VIEWPORT,
  DEFAULT_PERMISSIONS,
} from './config';
import { getOrCreatePage } from './factory';
import { cleanupContext } from './cleanup';
import path from 'path';
import { app } from 'electron';

/**
 * Browser pool for managing shared browser instances
 */
class BrowserPool {
  private browsers: Browser[] = [];
  private contextCounts: Map<Browser, number> = new Map();
  private lastUsed: Map<Browser, number> = new Map();
  private signature: BrowserSignature;
  private config: BrowserPoolConfig;

  constructor(signature: BrowserSignature, config: BrowserPoolConfig) {
    this.signature = signature;
    this.config = config;
  }

  /**
   * Get or create a browser from the pool
   */
  async getBrowser(): Promise<Browser> {
    // Find browser with available capacity
    for (const browser of this.browsers) {
      if (!browser.isConnected()) {
        // Browser died, remove it
        this.browsers = this.browsers.filter((b) => b !== browser);
        this.contextCounts.delete(browser);
        this.lastUsed.delete(browser);
        continue;
      }

      const contextCount = this.contextCounts.get(browser) || 0;
      if (contextCount < this.config.maxContextsPerBrowser) {
        this.lastUsed.set(browser, Date.now());
        return browser;
      }
    }

    // Create new browser if under limit
    if (this.browsers.length < this.config.maxSharedBrowsers) {
      const browser = await this.createBrowser();
      this.browsers.push(browser);
      this.contextCounts.set(browser, 0);
      this.lastUsed.set(browser, Date.now());
      return browser;
    }

    // Return least loaded browser
    return this.getLeastLoadedBrowser();
  }

  /**
   * Create a new browser with this pool's signature
   */
  private async createBrowser(): Promise<Browser> {
    const browser = await chromium.launch({
      headless: this.signature.headless,
      channel: this.signature.channel || CHROME_CHANNEL,
      args: this.signature.args,
      timeout: DEFAULT_LAUNCH_TIMEOUT,
    });

    console.log(
      `🌐 Created new browser in pool (headless: ${this.signature.headless}, contexts: ${this.browsers.length + 1}/${this.config.maxSharedBrowsers})`
    );

    return browser;
  }

  /**
   * Get the least loaded browser
   */
  private getLeastLoadedBrowser(): Browser {
    let leastBrowser = this.browsers[0];
    let leastCount = this.contextCounts.get(leastBrowser) || 0;

    for (const browser of this.browsers) {
      const count = this.contextCounts.get(browser) || 0;
      if (count < leastCount) {
        leastBrowser = browser;
        leastCount = count;
      }
    }

    return leastBrowser;
  }

  /**
   * Increment context count for a browser
   */
  incrementContextCount(browser: Browser): void {
    const count = this.contextCounts.get(browser) || 0;
    this.contextCounts.set(browser, count + 1);
  }

  /**
   * Decrement context count for a browser
   */
  decrementContextCount(browser: Browser): void {
    const count = this.contextCounts.get(browser) || 1;
    this.contextCounts.set(browser, count - 1);

    // Check if we should close idle browser
    this.maybeCloseIdleBrowser(browser);
  }

  /**
   * Close browser if it's idle and has no contexts
   */
  private async maybeCloseIdleBrowser(browser: Browser): Promise<void> {
    const count = this.contextCounts.get(browser) || 0;
    if (count > 0) {
      return;
    }

    const lastUsedTime = this.lastUsed.get(browser) || Date.now();
    const idleTime = Date.now() - lastUsedTime;

    if (idleTime > this.config.browserIdleTimeout) {
      console.log(`🗑️ Closing idle browser (idle: ${Math.round(idleTime / 1000)}s)`);
      await browser.close();
      this.browsers = this.browsers.filter((b) => b !== browser);
      this.contextCounts.delete(browser);
      this.lastUsed.delete(browser);
    }
  }

  /**
   * Close all browsers in the pool
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      this.browsers.map(async (browser) => {
        try {
          await browser.close();
        } catch (error) {
          console.warn('Error closing browser:', error);
        }
      })
    );
    this.browsers = [];
    this.contextCounts.clear();
    this.lastUsed.clear();
  }
}

/**
 * Hybrid Browser Pool Manager
 * Main API for getting browser contexts with optimal resource usage
 */
export class BrowserPoolManager {
  private standardPool: BrowserPool;
  private headlessPool: BrowserPool;
  private customBrowsers: Map<string, { browser: Browser; signature: BrowserSignature }> = new Map();
  private config: BrowserPoolConfig;

  constructor(config: BrowserPoolConfig = DEFAULT_POOL_CONFIG) {
    this.config = config;

    // Initialize predefined pools
    this.standardPool = new BrowserPool(
      {
        args: DEFAULT_LAUNCH_ARGS,
        extensions: [],
        headless: false,
        channel: CHROME_CHANNEL,
      },
      config
    );

    this.headlessPool = new BrowserPool(
      {
        args: HEADLESS_LAUNCH_ARGS,
        extensions: [],
        headless: true,
        channel: CHROME_CHANNEL,
      },
      config
    );
  }

  /**
   * Get a browser context with optimal resource usage
   * Main API - automatically routes to appropriate pool/browser
   *
   * @param options Context options
   * @returns Browser context result with cleanup function
   *
   * @example
   * // Use standard pool (shares browser)
   * const { context, page, cleanup } = await poolManager.getContext({
   *   profile: 'standard'
   * });
   *
   * // Use headless pool (shares browser)
   * const result = await poolManager.getContext({
   *   profile: 'headless'
   * });
   *
   * // Extensions = dedicated browser (not shared)
   * const result = await poolManager.getContext({
   *   extensions: ['/path/to/extension']
   * });
   */
  async getContext(options: BrowserPoolContextOptions = {}): Promise<BrowserContextResult> {
    const {
      profile = 'standard',
      extensions = [],
      args,
      headless,
      purpose,
      ...contextOptions
    } = options;

    // Case 1: Extensions specified → ALWAYS dedicated browser
    if (extensions.length > 0) {
      console.log(`🔒 Extensions detected, using dedicated browser (${purpose || 'custom'})`);
      return await this.getDedicatedBrowser({
        ...options,
        extensions,
      });
    }

    // Case 2: Use predefined profile (90% of operations)
    if (profile === 'standard') {
      return await this.getPooledContext(this.standardPool, contextOptions, purpose);
    } else if (profile === 'headless') {
      return await this.getPooledContext(this.headlessPool, contextOptions, purpose);
    }

    // Case 3: Custom args → Try to find compatible browser or launch new
    if (profile === 'custom' || args || headless !== undefined) {
      const signature = this.computeSignature({
        args: args || (headless ? HEADLESS_LAUNCH_ARGS : DEFAULT_LAUNCH_ARGS),
        extensions: [],
        headless: headless ?? false,
        channel: CHROME_CHANNEL,
      });

      const compatible = this.findCompatibleBrowser(signature);

      if (compatible) {
        console.log(`♻️ Reusing compatible browser (${purpose || 'custom'})`);
        return await this.createContextInBrowser(compatible, contextOptions, purpose);
      } else {
        console.log(`🆕 Launching dedicated browser for custom args (${purpose || 'custom'})`);
        return await this.getDedicatedBrowser(options);
      }
    }

    // Default: use standard pool
    return await this.getPooledContext(this.standardPool, contextOptions, purpose);
  }

  /**
   * Get context from a specific pool
   */
  private async getPooledContext(
    pool: BrowserPool,
    contextOptions: any,
    purpose?: string
  ): Promise<BrowserContextResult> {
    const browser = await pool.getBrowser();
    pool.incrementContextCount(browser);

    const context = await browser.newContext({
      viewport: contextOptions.viewport ?? DEFAULT_VIEWPORT,
      permissions: contextOptions.permissions ?? DEFAULT_PERMISSIONS,
      acceptDownloads: contextOptions.acceptDownloads ?? true,
      downloadsPath:
        contextOptions.downloadsPath ||
        path.join(app.getPath('downloads'), `EGDesk-${purpose || 'automation'}`),
      userAgent: contextOptions.userAgent,
      locale: contextOptions.locale,
      timezoneId: contextOptions.timezoneId,
      geolocation: contextOptions.geolocation,
      extraHTTPHeaders: contextOptions.extraHTTPHeaders,
    });

    const page = await getOrCreatePage(context);

    const cleanup = async () => {
      await cleanupContext(context);
      pool.decrementContextCount(browser);
    };

    console.log(`✅ Created pooled context (${purpose || 'automation'})`);

    return {
      browser,
      context,
      page,
      cleanup,
    };
  }

  /**
   * Create context in an existing browser
   */
  private async createContextInBrowser(
    browser: Browser,
    contextOptions: any,
    purpose?: string
  ): Promise<BrowserContextResult> {
    const context = await browser.newContext({
      viewport: contextOptions.viewport ?? DEFAULT_VIEWPORT,
      permissions: contextOptions.permissions ?? DEFAULT_PERMISSIONS,
      acceptDownloads: contextOptions.acceptDownloads ?? true,
      downloadsPath:
        contextOptions.downloadsPath ||
        path.join(app.getPath('downloads'), `EGDesk-${purpose || 'automation'}`),
      userAgent: contextOptions.userAgent,
      locale: contextOptions.locale,
      timezoneId: contextOptions.timezoneId,
      geolocation: contextOptions.geolocation,
      extraHTTPHeaders: contextOptions.extraHTTPHeaders,
    });

    const page = await getOrCreatePage(context);

    const cleanup = async () => {
      await cleanupContext(context);
    };

    return {
      browser,
      context,
      page,
      cleanup,
    };
  }

  /**
   * Launch a dedicated browser (not shared)
   */
  private async getDedicatedBrowser(
    options: BrowserPoolContextOptions
  ): Promise<BrowserContextResult> {
    const {
      args,
      extensions = [],
      headless = false,
      channel = CHROME_CHANNEL,
      executablePath,
      proxy,
      timeout = DEFAULT_LAUNCH_TIMEOUT,
      ...contextOptions
    } = options;

    const launchArgs = args || (headless ? HEADLESS_LAUNCH_ARGS : DEFAULT_LAUNCH_ARGS);
    const finalArgs = [...launchArgs];

    // Add extensions
    if (extensions.length > 0) {
      for (const ext of extensions) {
        finalArgs.push(`--disable-extensions-except=${ext}`);
        finalArgs.push(`--load-extension=${ext}`);
      }
    }

    const browser = await chromium.launch({
      headless,
      channel,
      executablePath,
      args: finalArgs,
      proxy,
      timeout,
    });

    const context = await browser.newContext({
      viewport: contextOptions.viewport ?? DEFAULT_VIEWPORT,
      permissions: contextOptions.permissions ?? DEFAULT_PERMISSIONS,
      acceptDownloads: contextOptions.acceptDownloads ?? true,
      downloadsPath:
        contextOptions.downloadsPath ||
        path.join(app.getPath('downloads'), `EGDesk-${options.purpose || 'automation'}`),
      userAgent: contextOptions.userAgent,
      locale: contextOptions.locale,
      timezoneId: contextOptions.timezoneId,
      geolocation: contextOptions.geolocation,
      extraHTTPHeaders: contextOptions.extraHTTPHeaders,
    });

    const page = await getOrCreatePage(context);

    const cleanup = async () => {
      await context.close();
      await browser.close();
    };

    return {
      browser,
      context,
      page,
      cleanup,
    };
  }

  /**
   * Compute signature for browser matching
   */
  private computeSignature(options: {
    args: string[];
    extensions: string[];
    headless: boolean;
    channel?: string;
  }): BrowserSignature {
    return {
      args: [...options.args].sort(),
      extensions: [...options.extensions].sort(),
      headless: options.headless,
      channel: options.channel,
    };
  }

  /**
   * Find a compatible browser for the given signature
   */
  private findCompatibleBrowser(requestSignature: BrowserSignature): Browser | null {
    for (const [, entry] of this.customBrowsers) {
      if (this.isCompatible(entry.signature, requestSignature)) {
        return entry.browser;
      }
    }
    return null;
  }

  /**
   * Check if two signatures are compatible
   */
  private isCompatible(
    browserSig: BrowserSignature,
    requestSig: BrowserSignature
  ): boolean {
    // Extensions must match exactly (hard separator)
    if (!this.arraysEqual(browserSig.extensions, requestSig.extensions)) {
      return false;
    }

    // Browser must have all requested flags
    if (!this.hasAllFlags(browserSig.args, requestSig.args)) {
      return false;
    }

    // Headless mode must match
    if (browserSig.headless !== requestSig.headless) {
      return false;
    }

    return true;
  }

  /**
   * Check if browserArgs contains all requestArgs
   */
  private hasAllFlags(browserArgs: string[], requestArgs: string[]): boolean {
    return requestArgs.every((arg) => browserArgs.includes(arg));
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  /**
   * Close all pools and browsers
   */
  async closeAll(): Promise<void> {
    await this.standardPool.closeAll();
    await this.headlessPool.closeAll();

    for (const [, entry] of this.customBrowsers) {
      try {
        await entry.browser.close();
      } catch (error) {
        console.warn('Error closing custom browser:', error);
      }
    }
    this.customBrowsers.clear();

    console.log('✅ Closed all browser pools');
  }
}

// Export singleton instance
export const browserPoolManager = new BrowserPoolManager();
