// ============================================================================
// NATIVE KEYBOARD INPUT
// ============================================================================
// Provides native OS-level keyboard input using multiple methods
// Automatically selects best available method for the platform

const os = require('os');
const path = require('path');

let robot = null;
let nutjs = null;
let interception = null;
let interceptionAvailable = false;

/**
 * Initialize keyboard libraries
 */
function init() {
  // Try loading robotjs
  try {
    robot = require('robotjs');
    console.log('[NativeKeyboard] robotjs loaded');
  } catch (e) {
    console.warn('[NativeKeyboard] robotjs not available:', e.message);
  }

  // Try loading nut.js
  try {
    const { keyboard } = require('@nut-tree-fork/nut-js');
    nutjs = keyboard;
    console.log('[NativeKeyboard] nut.js loaded');
  } catch (e) {
    console.warn('[NativeKeyboard] nut.js not available:', e.message);
  }

  // Try loading node-interception (Windows only)
  if (os.platform() === 'win32') {
    try {
      interception = require('node-interception');
      interceptionAvailable = true;
      console.log('[NativeKeyboard] node-interception loaded');
    } catch (e) {
      console.warn('[NativeKeyboard] node-interception not available:', e.message);

      // Also check if driver is installed
      try {
        const { isDriverInstalled } = require('./interceptionDriver');
        isDriverInstalled().then(installed => {
          console.log('[NativeKeyboard] Interception driver installed:', installed);
        });
      } catch (e2) {
        console.warn('[NativeKeyboard] Could not check driver status:', e2.message);
      }
    }
  }
}

/**
 * Types text using the best available native keyboard method
 * @param {string} text - Text to type
 * @param {Object} options - Options
 * @param {number} options.delayBetweenKeys - Delay in ms between keys (default 100)
 * @param {boolean} options.slowTyping - Use slow human-like typing (default false)
 * @param {string} options.preferredMethod - 'robotjs', 'nutjs', 'interception', or 'auto'
 * @param {Function} options.onProgress - Progress callback
 * @param {Object} options.page - Playwright page (fallback if no native keyboard)
 * @returns {Promise<Object>}
 */
async function typeText(text, options = {}) {
  const {
    delayBetweenKeys = 100,
    slowTyping = false,
    preferredMethod = 'auto',
    onProgress = () => {},
    page = null
  } = options;

  // Initialize if not done
  if (!robot && !nutjs) {
    init();
  }

  // Determine which method to use
  let method = preferredMethod;
  if (method === 'auto') {
    if (robot) method = 'robotjs';
    else if (nutjs) method = 'nutjs';
    else if (interceptionAvailable) method = 'interception';
    else if (page) method = 'playwright-fallback';
    else throw new Error('No keyboard input method available');
  }

  onProgress(`Using ${method} for keyboard input`);

  try {
    if (method === 'robotjs' && robot) {
      return await typeWithRobotJS(text, delayBetweenKeys, slowTyping, onProgress);
    } else if (method === 'nutjs' && nutjs) {
      return await typeWithNutJS(text, delayBetweenKeys, slowTyping, onProgress);
    } else if (method === 'interception') {
      return await typeWithInterception(text, delayBetweenKeys, slowTyping, onProgress);
    } else if (method === 'playwright-fallback' && page) {
      return await typeWithPlaywrightFallback(page, text, delayBetweenKeys, slowTyping, onProgress);
    } else {
      throw new Error(`Method ${method} not available`);
    }
  } catch (error) {
    console.error('[NativeKeyboard] Typing failed:', error);
    return {
      success: false,
      error: error.message,
      method: method
    };
  }
}

/**
 * Types text using robotjs
 */
async function typeWithRobotJS(text, delayBetweenKeys, slowTyping, onProgress) {
  onProgress(`Typing ${text.length} characters with robotjs...`);

  if (slowTyping) {
    // Type character by character with human-like delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      robot.typeString(char);

      // Human-like delays (200-500ms)
      const baseDelay = 200;
      const randomVariation = Math.random() * 300;
      const shouldPause = Math.random() < 0.15;
      const extraPause = shouldPause ? Math.random() * 400 : 0;
      const totalDelay = Math.floor(baseDelay + randomVariation + extraPause);

      onProgress(`Typed char ${i + 1}/${text.length}, waiting ${totalDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  } else {
    // Fast typing with consistent delay
    robot.setKeyboardDelay(delayBetweenKeys);
    robot.typeString(text);
  }

  return {
    success: true,
    method: 'robotjs',
    charsTyped: text.length
  };
}

/**
 * Types text using nut.js
 */
async function typeWithNutJS(text, delayBetweenKeys, slowTyping, onProgress) {
  onProgress(`Typing ${text.length} characters with nut.js...`);

  if (slowTyping) {
    // Type character by character with human-like delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await nutjs.type(char);

      // Human-like delays (200-500ms)
      const baseDelay = 200;
      const randomVariation = Math.random() * 300;
      const shouldPause = Math.random() < 0.15;
      const extraPause = shouldPause ? Math.random() * 400 : 0;
      const totalDelay = Math.floor(baseDelay + randomVariation + extraPause);

      onProgress(`Typed char ${i + 1}/${text.length}, waiting ${totalDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  } else {
    // Fast typing with consistent delay
    nutjs.config.autoDelayMs = delayBetweenKeys;
    await nutjs.type(text);
  }

  return {
    success: true,
    method: 'nutjs',
    charsTyped: text.length
  };
}

/**
 * Types text using Interception driver (Windows only)
 * Uses interception-type.exe helper program
 */
async function typeWithInterception(text, delayBetweenKeys, slowTyping, onProgress) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    // Get path to interception-type.exe
    let helperPath;
    if (process.env.NODE_ENV === 'production') {
      helperPath = path.join(process.resourcesPath, 'interception', 'interception-type.exe');
    } else {
      helperPath = path.join(__dirname, '../../resources/interception/interception-type.exe');
    }

    // Check if helper exists
    const fs = require('fs');
    if (!fs.existsSync(helperPath)) {
      throw new Error(`Interception helper not found: ${helperPath}\nCompile interception-type.cpp on Windows first.`);
    }

    onProgress(`Typing ${text.length} characters with Interception driver...`);

    // Calculate delay (slower for human-like typing)
    const delay = slowTyping ? 200 : delayBetweenKeys;

    // Call helper program
    // Note: This requires user to press a key first to detect keyboard device
    const { stdout, stderr } = await execAsync(`"${helperPath}" "${text}" ${delay}`);

    console.log('[Interception] Output:', stdout);
    if (stderr) console.warn('[Interception] Errors:', stderr);

    return {
      success: true,
      method: 'interception',
      charsTyped: text.length,
      output: stdout
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      method: 'interception'
    };
  }
}

/**
 * Fallback to Playwright keyboard if no native keyboard available
 * This will likely be blocked by Korean banking security
 */
async function typeWithPlaywrightFallback(page, text, delayBetweenKeys, slowTyping, onProgress) {
  onProgress(`Typing ${text.length} characters with Playwright (may be blocked)...`);

  if (slowTyping) {
    // Type character by character with human-like delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await page.keyboard.type(char);

      // Human-like delays (200-500ms)
      const baseDelay = 200;
      const randomVariation = Math.random() * 300;
      const shouldPause = Math.random() < 0.15;
      const extraPause = shouldPause ? Math.random() * 400 : 0;
      const totalDelay = Math.floor(baseDelay + randomVariation + extraPause);

      onProgress(`Typed char ${i + 1}/${text.length}, waiting ${totalDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  } else {
    await page.keyboard.type(text, { delay: delayBetweenKeys });
  }

  return {
    success: true,
    method: 'playwright-fallback',
    charsTyped: text.length,
    warning: 'Using Playwright keyboard - may be blocked by security'
  };
}

/**
 * Gets available keyboard input methods
 * @returns {Object}
 */
function getAvailableMethods() {
  if (!robot && !nutjs) {
    init();
  }

  return {
    robotjs: robot !== null,
    nutjs: nutjs !== null,
    interception: interceptionAvailable,
    platform: os.platform()
  };
}

module.exports = {
  init,
  typeText,
  getAvailableMethods,
};
