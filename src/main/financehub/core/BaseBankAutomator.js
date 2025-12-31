// ============================================================================
// BASE BANK AUTOMATOR
// ============================================================================
// Abstract base class that all bank automators should extend

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * @typedef {import('../types').BankAutomationConfig} BankAutomationConfig
 * @typedef {import('../types').BankCredentials} BankCredentials
 * @typedef {import('../types').AutomationResult} AutomationResult
 * @typedef {import('../types').ProxyConfig} ProxyConfig
 * @typedef {import('../types').BrowserSetupResult} BrowserSetupResult
 */

class BaseBankAutomator {
  /**
   * @param {BankAutomationConfig} config
   */
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Builds proxy configuration from URL string
   * @param {string} proxyUrl - Proxy URL string
   * @returns {ProxyConfig|undefined}
   */
  buildProxyOption(proxyUrl) {
    try {
      if (!proxyUrl) return undefined;
      const u = new URL(String(proxyUrl));
      const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
      const proxy = { server };
      if (u.username) proxy.username = decodeURIComponent(u.username);
      if (u.password) proxy.password = decodeURIComponent(u.password);
      return proxy;
    } catch {
      return undefined;
    }
  }

  /**
   * Ensures output directory exists
   * @param {string} dirPath - Directory path
   */
  ensureOutputDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log('Created output directory:', dirPath);
      }
    } catch (error) {
      this.warn('Failed to create output directory:', error);
    }
  }

  /**
   * Generates timestamp string for filenames
   * @returns {string}
   */
  generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  /**
   * Gets element bounding box
   * @param {Object} pageOrFrame - Playwright page or frame
   * @param {string} selector - XPath or CSS selector
   * @returns {Promise<Object|null>}
   */
  async getElementBox(pageOrFrame, selector) {
    try {
      const locator = pageOrFrame.locator(selector);
      if (await locator.count()) {
        await locator.scrollIntoViewIfNeeded();
        await pageOrFrame.waitForTimeout(this.config.timeouts.scrollWait);

        const handle = await locator.first().elementHandle();
        if (handle) {
          const box = await handle.boundingBox();
          if (box) return { x: box.x, y: box.y, width: box.width, height: box.height };
          
          const rect = await handle.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          return rect;
        }
      }
    } catch {}
    return null;
  }

  // ============================================================================
  // LOGGING METHODS
  // ============================================================================

  /**
   * Log with bank prefix
   * @param  {...any} args
   */
  log(...args) {
    console.log(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  /**
   * Warn with bank prefix
   * @param  {...any} args
   */
  warn(...args) {
    console.warn(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  /**
   * Error with bank prefix
   * @param  {...any} args
   */
  error(...args) {
    console.error(`[${this.config.bank.id.toUpperCase()}]`, ...args);
  }

  // ============================================================================
  // BROWSER SETUP
  // ============================================================================

  /**
   * Creates and configures browser instance
   * @param {ProxyConfig} [proxy] - Proxy configuration
   * @returns {Promise<BrowserSetupResult>}
   */
  async createBrowser(proxy) {
    const explicitProfilePath = this.config.chromeProfile?.trim() || null;
    let persistentProfileDir = explicitProfilePath;

    if (!persistentProfileDir) {
      try {
        const tempPrefix = path.join(os.tmpdir(), `egdesk-chrome-${this.config.bank.id}-`);
        persistentProfileDir = fs.mkdtempSync(tempPrefix);
        this.log('Using temporary Chrome profile directory:', persistentProfileDir);
      } catch (e) {
        this.warn('Failed to create temp Chrome profile:', e?.message || e);
      }
    }

    const launchOptions = {
      headless: this.config.headless,
      channel: 'chrome',
      proxy,
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 },
      permissions: ['clipboard-read', 'clipboard-write'],
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-features=PrivateNetworkAccessSendPreflights',
        '--disable-features=PrivateNetworkAccessRespectPreflightResults',
      ]
    };

    if (persistentProfileDir) {
      const context = await chromium.launchPersistentContext(persistentProfileDir, launchOptions);
      return { browser: context, context };
    }

    // Fallback non-persistent context
    const browser = await chromium.launch({
      headless: this.config.headless,
      channel: 'chrome',
      proxy,
      args: launchOptions.args
    });

    const context = await browser.newContext({
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 }
    });

    return { browser, context };
  }

  /**
   * Sets up browser context with routing and navigation handling
   * @param {Object} context - Playwright browser context
   * @param {Object} [page] - Playwright page object
   */
  async setupBrowserContext(context, page = null) {
    const { targetUrl, undesiredHostnames } = this.config;

    // Intercept unwanted hostnames
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        const isDocument = request.resourceType() === 'document';
        const url = new URL(request.url());
        if (isDocument && undesiredHostnames.includes(url.hostname)) {
          return route.fulfill({ status: 302, headers: { location: targetUrl } });
        }
      } catch {}
      return route.continue();
    });

    // Handle frame navigation
    if (page) {
      page.on('framenavigated', (frame) => {
        try {
          if (frame === page.mainFrame()) {
            const u = new URL(frame.url());
            if (undesiredHostnames.includes(u.hostname)) {
              page.goto(targetUrl).catch(() => {});
            }
          }
        } catch {}
      });
    }
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  /**
   * Fills input field with fallback to frames
   * @param {Object} page - Playwright page object
   * @param {string} xpath - XPath selector
   * @param {string} value - Value to fill
   * @param {string} fieldName - Field name for logging
   * @returns {Promise<boolean>}
   */
  async fillInputField(page, xpath, value, fieldName) {
    try {
      this.log(`Attempting to fill ${fieldName} input field...`);
      await page.waitForSelector(`xpath=${xpath}`, { timeout: this.config.timeouts.elementWait });
      const locator = page.locator(`xpath=${xpath}`);

      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(this.config.timeouts.scrollWait);

      await locator.click({ timeout: this.config.timeouts.click }).catch(() => {});
      await locator.fill(value).catch(async () => {
        await locator.type(value).catch(() => {});
      });
      this.log(`Successfully filled ${fieldName} input field`);
      return true;
    } catch (error) {
      this.warn(`Failed to fill ${fieldName} input field:`, error.message);

      // Fallback: search in frames
      try {
        const frames = page.frames();
        for (const frame of frames) {
          try {
            const handle = await frame.waitForSelector(`xpath=${xpath}`, { 
              timeout: this.config.timeouts.frameSearch 
            });
            if (handle) {
              await handle.click({ timeout: this.config.timeouts.frameSearch }).catch(() => {});
              try {
                await handle.fill(value);
                this.log(`Successfully filled ${fieldName} input field in frame`);
                return true;
              } catch {
                await handle.type(value).catch(() => {});
                return true;
              }
            }
          } catch {}
        }
      } catch {}
      return false;
    }
  }

  /**
   * Clicks a button/element with fallbacks
   * @param {Object} page - Playwright page object
   * @param {string} xpath - XPath selector
   * @param {string} buttonName - Button name for logging
   * @returns {Promise<boolean>}
   */
  async clickButton(page, xpath, buttonName) {
    try {
      this.log(`Attempting to click ${buttonName}...`);
      const locator = page.locator(`xpath=${xpath}`);

      await locator.waitFor({ state: 'visible', timeout: this.config.timeouts.elementWait });
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(this.config.timeouts.scrollWait);
      await locator.click({ timeout: this.config.timeouts.click });

      this.log(`Successfully clicked ${buttonName}`);
      return true;
    } catch (error) {
      this.warn(`Failed to click ${buttonName}:`, error.message);

      // Fallback: force click
      try {
        this.log('Trying force click...');
        const locator = page.locator(`xpath=${xpath}`);
        await locator.click({ force: true, timeout: this.config.timeouts.click });
        this.log('Force click succeeded');
        return true;
      } catch (forceError) {
        this.warn('Force click failed:', forceError.message);
      }

      // Fallback: JavaScript click
      try {
        this.log('Trying JavaScript click...');
        await page.evaluate((xp) => {
          const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const element = result.singleNodeValue;
          if (element) {
            element.click();
            return true;
          }
          throw new Error('Element not found');
        }, xpath);
        this.log('JavaScript click succeeded');
        return true;
      } catch (jsError) {
        this.error('JavaScript click failed:', jsError.message);
      }

      return false;
    }
  }

  // ============================================================================
  // ABSTRACT METHODS (to be implemented by subclasses)
  // ============================================================================

  /**
   * Main login method - MUST be implemented by subclasses
   * @param {BankCredentials} credentials
   * @param {string} [proxyUrl]
   * @returns {Promise<AutomationResult>}
   */
  async login(credentials, proxyUrl) {
    throw new Error('login() must be implemented by subclass');
  }

  /**
   * Handle security popup - can be overridden by subclasses
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async handleSecurityPopup(page) {
    // Default implementation - no popup handling
    return true;
  }

  /**
   * Handle virtual keyboard - can be overridden by subclasses
   * @param {Object} page - Playwright page object
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async handleVirtualKeyboard(page, password) {
    // Default implementation - no virtual keyboard
    return { success: true, typedChars: 0, totalChars: password.length };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Closes browser and cleans up resources
   */
  async cleanup() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.log('Browser closed');
      } catch (error) {
        this.warn('Failed to close browser:', error.message);
      }
    }
  }
}

module.exports = { BaseBankAutomator };
