// ============================================================================
// BASE CARD AUTOMATOR
// ============================================================================
// Abstract base class that all card company automators should extend
// Very similar to BaseBankAutomator but tailored for card companies

const { BaseBankAutomator } = require('./BaseBankAutomator');
const path = require('path');

/**
 * @typedef {import('../types').CardAutomationConfig} CardAutomationConfig
 * @typedef {import('../types').CardCredentials} CardCredentials
 * @typedef {import('../types').AutomationResult} AutomationResult
 */

class BaseCardAutomator extends BaseBankAutomator {
  /**
   * @param {CardAutomationConfig} config
   */
  constructor(config) {
    super(config);
    this.cardConfig = config.card;
  }

  // ============================================================================
  // CARD-SPECIFIC UTILITY METHODS
  // ============================================================================

  /**
   * Formats card number for display (masks middle digits)
   * @param {string} cardNumber - Full or partial card number
   * @returns {string} Masked card number (e.g., "1234-****-****-5678")
   */
  formatCardNumber(cardNumber) {
    if (!cardNumber) return '';

    // Remove any existing formatting
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 8) return cardNumber;

    // Format as 1234-****-****-5678
    const first4 = digits.substring(0, 4);
    const last4 = digits.substring(digits.length - 4);

    return `${first4}-****-****-${last4}`;
  }

  /**
   * Parses card type from card number or name
   * @param {string} cardNumber - Card number
   * @param {string} cardName - Card name
   * @returns {string} Card type: 'credit', 'debit', or 'check'
   */
  parseCardType(cardNumber, cardName = '') {
    const nameLower = cardName.toLowerCase();

    if (nameLower.includes('체크') || nameLower.includes('debit')) {
      return 'debit';
    }

    if (nameLower.includes('직불') || nameLower.includes('check')) {
      return 'check';
    }

    // Default to credit card
    return 'credit';
  }

  // ============================================================================
  // ABSTRACT METHODS (to be implemented by subclasses)
  // ============================================================================

  /**
   * Main login method - MUST be implemented by subclasses
   * @param {CardCredentials} credentials
   * @param {string} [proxyUrl]
   * @returns {Promise<AutomationResult>}
   */
  async login(credentials, proxyUrl) {
    throw new Error('login() must be implemented by card company subclass');
  }

  /**
   * Get list of cards - MUST be implemented by subclasses
   * @returns {Promise<Array>} Array of card objects with cardNumber, cardName, etc.
   */
  async getCards() {
    throw new Error('getCards() must be implemented by card company subclass');
  }

  /**
   * Get card transactions for a specific date range
   * @param {string} cardNumber - Card number (last 4 digits or full number)
   * @param {string} startDate - Start date in YYYYMMDD format
   * @param {string} endDate - End date in YYYYMMDD format
   * @returns {Promise<Object>} Transaction data with { success, transactions, metadata }
   */
  async getTransactions(cardNumber, startDate, endDate) {
    throw new Error('getTransactions() must be implemented by card company subclass');
  }

  /**
   * Login and get cards in one operation
   * @param {CardCredentials} credentials
   * @param {string} [proxyUrl]
   * @returns {Promise<Object>} Result with { success, isLoggedIn, userName, cards }
   */
  async loginAndGetCards(credentials, proxyUrl) {
    try {
      // Step 1: Login
      this.log('Step 1: Logging in to card company...');
      const loginResult = await this.login(credentials, proxyUrl);

      if (!loginResult.success || !loginResult.isLoggedIn) {
        this.error('Login failed:', loginResult.error);
        return {
          success: false,
          isLoggedIn: false,
          error: loginResult.error || 'Login failed',
        };
      }

      this.log('Login successful, userName:', loginResult.userName);

      // Step 2: Get cards
      this.log('Step 2: Retrieving card list...');
      const cards = await this.getCards();

      this.log(`Found ${cards.length} card(s)`);

      return {
        success: true,
        isLoggedIn: true,
        userName: loginResult.userName,
        cards: cards,
      };
    } catch (error) {
      this.error('loginAndGetCards failed:', error);
      return {
        success: false,
        isLoggedIn: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Handle security popup - can be overridden by subclasses
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async handleSecurityPopup(page) {
    // Default implementation - no popup handling
    // Card company subclasses should override this if they have security popups
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
    // Card company subclasses should override this if they use virtual keyboards
    return { success: true, typedChars: 0, totalChars: password.length };
  }

  // ============================================================================
  // ENHANCED POPUP DETECTION AND HANDLING
  // ============================================================================

  /**
   * Universal popup detector and handler
   * Detects common Korean banking/card popups and handles them automatically
   * @param {Object} page - Playwright page object
   * @param {Object} options - Detection options
   * @param {number} options.timeout - Timeout for each selector check (default: 2000ms)
   * @param {boolean} options.continueOnFail - Continue checking other patterns if one fails (default: true)
   * @param {boolean} options.logDetection - Log detected popups (default: true)
   * @param {number} options.waitBeforeCheck - Wait time before checking for popups (default: 2000ms)
   * @param {number} options.retries - Number of retry attempts (default: 2)
   * @param {number} options.retryDelay - Delay between retries (default: 1000ms)
   * @returns {Promise<{detected: boolean, handled: boolean, popups: Array}>}
   */
  async detectAndHandlePopups(page, options = {}) {
    const {
      timeout = 2000,
      continueOnFail = true,
      logDetection = true,
      waitBeforeCheck = 2000,
      retries = 2,
      retryDelay = 1000
    } = options;

    // Wait for popups to appear (they often load asynchronously)
    if (waitBeforeCheck > 0) {
      if (logDetection) {
        this.log(`Waiting ${waitBeforeCheck}ms for popups to appear...`);
      }
      await page.waitForTimeout(waitBeforeCheck);
    }

    const popupsHandled = [];
    let attempt = 0;

    try {
      if (logDetection) {
        this.log('Starting popup detection...');
      }

      // Common popup patterns in Korean banking/card sites
      const POPUP_PATTERNS = [
        // Session extension popups (HIGH PRIORITY - handle these immediately)
        {
          type: 'session-extension',
          selectors: [
            '//button[contains(text(), "연장")]',
            '//button[contains(text(), "세션연장")]',
            '//button[contains(text(), "계속")]',
            '//button[contains(text(), "예")]',
          ],
          priority: 'high'
        },

        // Main popup patterns (Shinhan Card mainPop, pop_wrap)
        {
          type: 'main-popup',
          selectors: [
            // X close button (top-right corner)
            '//div[@id="mainPop"]//button[contains(@class, "close") or @title="닫기" or @aria-label="닫기"]',
            '//div[contains(@class, "pop_wrap")]//button[contains(@class, "close") or @title="닫기"]',
            '//div[@id="mainPop"]//a[contains(@class, "close") or @title="닫기"]',
            // Confirm buttons
            '//div[@id="mainPop"]//button[contains(text(), "확인")]',
            '//div[@id="main_pop"]//button[contains(text(), "확인")]',
            '//div[contains(@class, "pop_wrap")]//button[contains(text(), "확인")]',
            // Close text buttons
            '//div[@id="mainPop"]//button[contains(text(), "닫기")]',
            '//div[@id="mainPop"]//a[contains(text(), "닫기")]',
            '//div[contains(@class, "pop_wrap")]//button[contains(text(), "닫기")]',
            // Generic fallbacks
            '//div[@id="mainPop"]//button[@type="button"]',
            '//div[@class="pop_wrap type2"]//button',
          ],
          priority: 'high'
        },

        // Security/Certificate popups
        {
          type: 'security-notice',
          selectors: [
            '//button[contains(text(), "확인")]',
            '//button[contains(text(), "닫기")]',
            '//a[contains(text(), "닫기")]',
            '//button[@id="btnClose"]',
            '//button[@class*="close"]',
            '//a[@class*="close"]',
            '//button[contains(@class, "btn-close")]',
            '//a[contains(@class, "btn-close")]',
            '//button[contains(@class, "close")]',
            '//a[contains(@class, "close")]',
          ],
        },

        // Terms/Agreement popups
        {
          type: 'terms-agreement',
          selectors: [
            '//button[contains(text(), "동의")]',
            '//button[contains(text(), "동의하고 계속")]',
          ],
          requiresCheckbox: true
        },

        // Event/Promotion popups (dismiss)
        {
          type: 'promotion',
          selectors: [
            '//button[contains(text(), "오늘 하루 보지 않기")]',
            '//a[contains(text(), "오늘 하루 보지 않기")]',
            '//button[contains(text(), "오늘 하루 열지 않기")]',
            '//button[contains(text(), "다시 보지 않기")]',
            '//a[contains(@class, "layer-close")]',
          ]
        },

        // Alert dialogs
        {
          type: 'alert',
          selectors: [
            '//div[contains(@class, "alert")]//button[contains(text(), "확인")]',
            '//div[contains(@class, "modal")]//button[contains(text(), "확인")]',
          ]
        }
      ];

      // Try multiple times to catch late-loading popups
      for (attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) {
          if (logDetection) {
            this.log(`Retry attempt ${attempt}/${retries} after ${retryDelay}ms...`);
          }
          await page.waitForTimeout(retryDelay);
        }

        const attemptPopups = [];

        // Check main page for popups
        if (logDetection) {
          this.log(`Checking main page for popups (attempt ${attempt + 1})...`);
        }

        for (const pattern of POPUP_PATTERNS) {
          const result = await this.tryHandlePopup(page, pattern, timeout);
          if (result.handled) {
            attemptPopups.push(result);
            popupsHandled.push(result);
            if (logDetection) {
              this.log(`✓ Handled ${pattern.type} popup`);
            }
          }
        }

        // Check iframes/frames for popups
        const frames = page.frames();
        if (frames.length > 1 && logDetection) {
          this.log(`Checking ${frames.length} frames for popups...`);
        }

        for (const frame of frames) {
          if (frame === page.mainFrame()) continue; // Skip main frame (already checked)

          for (const pattern of POPUP_PATTERNS) {
            const result = await this.tryHandlePopup(frame, pattern, timeout / 2);
            if (result.handled) {
              attemptPopups.push(result);
              popupsHandled.push(result);
              if (logDetection) {
                this.log(`✓ Handled ${pattern.type} popup in frame: ${frame.name() || 'unnamed'}`);
              }
            }
          }
        }

        // If we found popups this attempt, break (don't retry)
        if (attemptPopups.length > 0) {
          if (logDetection) {
            this.log(`Found and handled ${attemptPopups.length} popup(s) on attempt ${attempt + 1}`);
          }
          break;
        }

        // If no popups found and this is the last retry, log it
        if (attempt === retries && logDetection) {
          this.log('No popups detected after all attempts');
        }
      }

      // Setup dialog event listener if not already set
      if (!this._dialogListenerAttached) {
        page.on('dialog', async dialog => {
          this.log(`Dialog detected: ${dialog.type()} - ${dialog.message()}`);
          await dialog.accept();
          popupsHandled.push({ type: 'dialog', message: dialog.message() });
        });
        this._dialogListenerAttached = true;
      }

      return {
        detected: popupsHandled.length > 0,
        handled: popupsHandled.length > 0,
        popups: popupsHandled
      };

    } catch (error) {
      if (continueOnFail) {
        this.warn('Popup detection error (non-fatal):', error.message);
        return {
          detected: false,
          handled: false,
          error: error.message
        };
      } else {
        throw error;
      }
    }
  }

  /**
   * Try to handle a single popup pattern
   * @param {Object} pageOrFrame - Playwright page or frame object
   * @param {Object} pattern - Popup pattern object with type and selectors
   * @param {number} timeout - Timeout for selector checks
   * @returns {Promise<{handled: boolean, type?: string, selector?: string, error?: string}>}
   */
  async tryHandlePopup(pageOrFrame, pattern, timeout) {
    try {
      for (const selector of pattern.selectors) {
        try {
          const locator = pageOrFrame.locator(`xpath=${selector}`);
          const count = await locator.count();

          if (count > 0) {
            // Check if visible
            const isVisible = await locator.first().isVisible({ timeout: 500 }).catch(() => false);
            if (!isVisible) {
              this.log(`Selector found element but not visible: ${selector.substring(0, 60)}...`);
              continue;
            }

            this.log(`Found visible popup element with selector: ${selector.substring(0, 80)}...`);

            // Check if checkbox needs to be clicked first (for terms agreements)
            if (pattern.requiresCheckbox) {
              const checkbox = pageOrFrame.locator('//input[@type="checkbox" and (contains(@id, "agree") or contains(@name, "agree"))]');
              const checkboxCount = await checkbox.count();
              if (checkboxCount > 0) {
                this.log('Checking agreement checkbox first...');
                await checkbox.first().check({ timeout });
                await pageOrFrame.waitForTimeout(300);
              }
            }

            // Click the button/link to dismiss popup
            this.log('Clicking popup close button...');
            await locator.first().click({ timeout, force: true });
            await pageOrFrame.waitForTimeout(500);

            this.log(`Successfully closed popup using: ${selector.substring(0, 80)}`);

            return {
              handled: true,
              type: pattern.type,
              selector: selector
            };
          }
        } catch (selectorError) {
          // Log error but continue to next selector
          if (selectorError.message.includes('Timeout')) {
            this.log(`Selector timed out: ${selector.substring(0, 60)}...`);
          }
          continue;
        }
      }

      return { handled: false };

    } catch (error) {
      return { handled: false, error: error.message };
    }
  }

  /**
   * Start continuous popup monitoring (background task)
   * Useful during long operations like transaction loading
   * @param {Object} page - Playwright page object
   * @param {number} intervalMs - Check interval in milliseconds (default: 3000)
   */
  async startPopupMonitoring(page, intervalMs = 3000) {
    if (this.popupMonitoringInterval) {
      this.log('Popup monitoring already running');
      return;
    }

    this.popupMonitoringInterval = setInterval(async () => {
      try {
        await this.detectAndHandlePopups(page, { logDetection: true });
      } catch (error) {
        this.warn('Error in popup monitoring:', error.message);
      }
    }, intervalMs);

    this.log(`Started popup monitoring (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop continuous popup monitoring
   */
  async stopPopupMonitoring() {
    if (this.popupMonitoringInterval) {
      clearInterval(this.popupMonitoringInterval);
      this.popupMonitoringInterval = null;
      this.log('Stopped popup monitoring');
    }
  }

  /**
   * Debug method to see all visible buttons and links on the page
   * Useful for identifying popup selectors
   * @param {Object} page - Playwright page object
   * @returns {Promise<Array>} List of visible interactive elements
   */
  async debugPopupElements(page) {
    this.log('=== POPUP DEBUG MODE ===');
    this.log('Scanning page for visible buttons and links...');

    try {
      // Get all visible buttons
      const buttons = await page.locator('button:visible').all();
      this.log(`\nFound ${buttons.length} visible buttons:`);
      for (let i = 0; i < Math.min(buttons.length, 20); i++) {
        const text = await buttons[i].textContent().catch(() => '');
        const classes = await buttons[i].getAttribute('class').catch(() => '');
        const id = await buttons[i].getAttribute('id').catch(() => '');
        this.log(`  ${i + 1}. "${text.trim()}" [id="${id}", class="${classes}"]`);
      }

      // Get all visible links
      const links = await page.locator('a:visible').all();
      this.log(`\nFound ${links.length} visible links:`);
      for (let i = 0; i < Math.min(links.length, 20); i++) {
        const text = await links[i].textContent().catch(() => '');
        const classes = await links[i].getAttribute('class').catch(() => '');
        const href = await links[i].getAttribute('href').catch(() => '');
        this.log(`  ${i + 1}. "${text.trim()}" [href="${href}", class="${classes}"]`);
      }

      // Check frames
      const frames = page.frames();
      this.log(`\nFound ${frames.length} frames:`);
      for (const frame of frames) {
        const url = frame.url();
        const name = frame.name();
        this.log(`  - Frame: "${name}" (${url})`);
      }

      // Take screenshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(this.outputDir, `popup-debug-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      this.log(`\nScreenshot saved: ${screenshotPath}`);

      this.log('=== END POPUP DEBUG ===\n');
    } catch (error) {
      this.log(`Debug failed: ${error.message}`, 'error');
    }
  }
}

module.exports = { BaseCardAutomator };
