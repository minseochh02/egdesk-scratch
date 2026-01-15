// ============================================================================
// CARD COMPANIES - MAIN MODULE EXPORTS
// ============================================================================
// Korean Card Company Automation Framework
//
// This module provides a structured framework for automating Korean card company logins
// with support for virtual keyboards, security popups, and transaction retrieval.

// Core
const { BaseCardAutomator } = require('../core');

// Card Companies
const shinhanCard = require('./shinhan-card');
const samsungCard = require('./samsung-card');
const hyundaiCard = require('./hyundai-card');
const kbCard = require('./kb-card');
const lotteCard = require('./lotte-card');
const hanaCard = require('./hana-card');

// Card registry for easy access
const CARDS = {
  'shinhan-card': {
    config: shinhanCard.SHINHAN_CARD_INFO,
    Automator: shinhanCard.ShinhanCardAutomator,
    create: shinhanCard.createShinhanCardAutomator,
    run: shinhanCard.runShinhanCardAutomation,
  },
  'samsung-card': {
    config: samsungCard.SAMSUNG_CARD_INFO,
    Automator: samsungCard.SamsungCardAutomator,
    create: samsungCard.createSamsungCardAutomator,
    run: samsungCard.runSamsungCardAutomation,
  },
  'hyundai-card': {
    config: hyundaiCard.HYUNDAI_CARD_INFO,
    Automator: hyundaiCard.HyundaiCardAutomator,
    create: hyundaiCard.createHyundaiCardAutomator,
    run: hyundaiCard.runHyundaiCardAutomation,
  },
  'kb-card': {
    config: kbCard.KB_CARD_INFO,
    Automator: kbCard.KBCardAutomator,
    create: kbCard.createKBCardAutomator,
    run: kbCard.runKBCardAutomation,
  },
  'lotte-card': {
    config: lotteCard.LOTTE_CARD_INFO,
    Automator: lotteCard.LotteCardAutomator,
    create: lotteCard.createLotteCardAutomator,
    run: lotteCard.runLotteCardAutomation,
  },
  'hana-card': {
    config: hanaCard.HANA_CARD_INFO,
    Automator: hanaCard.HanaCardAutomator,
    create: hanaCard.createHanaCardAutomator,
    run: hanaCard.runHanaCardAutomation,
  },
  // Future card companies will be added here:
  // 'bc-card': { ... },
  // 'woori-card': { ... },
  // 'nh-card': { ... },
  // 'citi-card': { ... },
};

/**
 * Get automator class for a specific card company
 * @param {string} cardId - Card company ID (e.g., 'shinhan-card', 'samsung-card')
 * @returns {Class} Automator class
 */
function getCardAutomator(cardId) {
  const card = CARDS[cardId.toLowerCase()];
  if (!card) {
    throw new Error(`Unknown card company: ${cardId}. Available cards: ${Object.keys(CARDS).join(', ')}`);
  }
  return card.Automator;
}

/**
 * Create automator instance for a specific card company
 * @param {string} cardId - Card company ID
 * @param {Object} options - Automator options
 * @returns {Object} Automator instance
 */
function createCardAutomator(cardId, options = {}) {
  const card = CARDS[cardId.toLowerCase()];
  if (!card) {
    throw new Error(`Unknown card company: ${cardId}. Available cards: ${Object.keys(CARDS).join(', ')}`);
  }
  return card.create(options);
}

/**
 * Get card company configuration
 * @param {string} cardId - Card company ID
 * @returns {Object} Card configuration
 */
function getCardConfig(cardId) {
  const card = CARDS[cardId.toLowerCase()];
  if (!card) {
    throw new Error(`Unknown card company: ${cardId}. Available cards: ${Object.keys(CARDS).join(', ')}`);
  }
  return card.config;
}

/**
 * Get list of supported card companies
 * @returns {Array} Array of card configurations
 */
function getSupportedCards() {
  return Object.entries(CARDS).map(([id, card]) => ({
    id,
    ...card.config,
  }));
}

module.exports = {
  // Core
  BaseCardAutomator,

  // Card Companies (direct access)
  shinhanCard,
  samsungCard,
  hyundaiCard,
  kbCard,
  lotteCard,
  hanaCard,

  // Card registry
  CARDS,

  // Helper functions
  getCardAutomator,
  createCardAutomator,
  getCardConfig,
  getSupportedCards,
};
