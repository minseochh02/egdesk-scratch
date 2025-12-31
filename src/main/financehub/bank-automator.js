/**
 * BACKWARD COMPATIBILITY WRAPPER
 * 
 * This file remains for backward compatibility with the existing main process integration.
 * It wraps the new structured ShinhanBankAutomator from the financehub framework.
 */

const { shinhan } = require('./index');

/**
 * Main Shinhan Bank automation function (legacy entry point)
 * @param {string} username - Username (not used)
 * @param {string} password - Password
 * @param {string} id - User ID
 * @param {string} proxyUrl - Optional proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runShinhanAutomation(username, password, id, proxyUrl) {
  return shinhan.runShinhanAutomation(username, password, id, proxyUrl);
}

module.exports = {
  runShinhanAutomation,
};
