// ============================================================================
// BASE CARD AUTOMATOR
// ============================================================================
// Abstract base class that all card company automators should extend
// Very similar to BaseBankAutomator but tailored for card companies

const { BaseBankAutomator } = require('./BaseBankAutomator');

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
}

module.exports = { BaseCardAutomator };
