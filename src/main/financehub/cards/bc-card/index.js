/**
 * BC Card Module
 * Exports BC Card automator and configuration
 */

const { BCCardAutomator, createBCCardAutomator, runBCCardAutomation } = require('./BCCardAutomator');
const { BC_CARD_INFO, BC_CARD_CONFIG } = require('./config');

module.exports = {
  BC_CARD_INFO,
  BC_CARD_CONFIG,
  BCCardAutomator,
  createBCCardAutomator,
  runBCCardAutomation,
};
