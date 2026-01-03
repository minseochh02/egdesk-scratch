/**
 * Kookmin Bank Module Entry Point
 * Exports all public interfaces for Kookmin Bank automation
 */

const {
  KookminBankAutomator,
  createKookminAutomator,
  runKookminAutomation,
} = require('./KookminBankAutomator');

const {
  KOOKMIN_BANK_INFO,
  KOOKMIN_CONFIG,
} = require('./config');

// Export everything
module.exports = {
  // Main classes and functions
  KookminBankAutomator,
  createKookminAutomator,
  runKookminAutomation,
  
  // Configuration
  KOOKMIN_BANK_INFO,
  KOOKMIN_CONFIG,
  
  // Convenience export for bank info
  bankInfo: KOOKMIN_BANK_INFO,
};