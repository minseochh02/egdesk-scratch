// ============================================================================
// FINANCE HUB - MAIN MODULE EXPORTS
// ============================================================================
// Korean Bank Automation Framework
// 
// This module provides a structured framework for automating Korean bank logins
// with support for virtual keyboards, security popups, and AI-powered key detection.

// Core
const { BaseBankAutomator, BaseCardAutomator } = require('./core');

// Banks
const shinhan = require('./banks/shinhan');
const kookmin = require('./banks/kookmin');
const nh = require('./banks/nh');

// Cards
const cards = require('./cards');

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
  kookmin: {
    config: kookmin.KOOKMIN_BANK_INFO,
    Automator: kookmin.KookminBankAutomator,
    create: kookmin.createKookminAutomator,
    run: kookmin.runKookminAutomation,
  },
  nh: {
    config: nh.NH_BANK_INFO,
    Automator: nh.NHBankAutomator,
    create: nh.createNHAutomator,
    run: async (username, password, id, proxyUrl) => {
      const automator = nh.createNHAutomator();
      return automator.login({ userId: id, password }, proxyUrl);
    },
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
  BaseCardAutomator,

  // Banks (direct access)
  shinhan,
  kookmin,
  nh,

  // Cards (full module)
  cards,

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
