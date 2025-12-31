// ============================================================================
// FINANCE HUB - MAIN MODULE EXPORTS
// ============================================================================
// Korean Bank Automation Framework
// 
// This module provides a structured framework for automating Korean bank logins
// with support for virtual keyboards, security popups, and AI-powered key detection.

// Core
const { BaseBankAutomator } = require('./core');

// Banks
const shinhan = require('./banks/shinhan');

// Utils
const utils = require('./utils');

// Bank registry for easy access
const BANKS = {
  shinhan: {
    config: shinhan.SHINHAN_BANK_INFO,
    Automator: shinhan.ShinhanBankAutomator,
    create: shinhan.createShinhanAutomator,
    run: shinhan.runShinhanAutomation,
  },
  // Future banks will be added here:
  // kb: { ... },
  // woori: { ... },
  // hana: { ... },
};

/**
 * Get automator class for a specific bank
 * @param {string} bankId - Bank ID (e.g., 'shinhan', 'kb', 'woori')
 * @returns {Class} Automator class
 */
function getAutomator(bankId) {
  const bank = BANKS[bankId.toLowerCase()];
  if (!bank) {
    throw new Error(`Unknown bank: ${bankId}. Available banks: ${Object.keys(BANKS).join(', ')}`);
  }
  return bank.Automator;
}

/**
 * Create automator instance for a specific bank
 * @param {string} bankId - Bank ID
 * @param {Object} options - Automator options
 * @returns {Object} Automator instance
 */
function createAutomator(bankId, options = {}) {
  const bank = BANKS[bankId.toLowerCase()];
  if (!bank) {
    throw new Error(`Unknown bank: ${bankId}. Available banks: ${Object.keys(BANKS).join(', ')}`);
  }
  return bank.create(options);
}

/**
 * Get bank configuration
 * @param {string} bankId - Bank ID
 * @returns {Object} Bank configuration
 */
function getBankConfig(bankId) {
  const bank = BANKS[bankId.toLowerCase()];
  if (!bank) {
    throw new Error(`Unknown bank: ${bankId}. Available banks: ${Object.keys(BANKS).join(', ')}`);
  }
  return bank.config;
}

/**
 * Get list of supported banks
 * @returns {Array} Array of bank configurations
 */
function getSupportedBanks() {
  return Object.entries(BANKS).map(([id, bank]) => ({
    id,
    ...bank.config,
  }));
}

module.exports = {
  // Core
  BaseBankAutomator,
  
  // Banks (direct access)
  shinhan,
  
  // Bank registry
  BANKS,
  
  // Helper functions
  getAutomator,
  createAutomator,
  getBankConfig,
  getSupportedBanks,
  
  // Utils
  utils,
};
