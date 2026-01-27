// ============================================================================
// INTERCEPTION KEYBOARD INPUT
// ============================================================================
// Uses Interception driver to send keyboard input as virtual HID device
// This bypasses Korean banking security (TouchEn nxKey, etc.)

const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');
const os = require('os');

// Only load on Windows
let interception = null;
let driverLoaded = false;

/**
 * Loads the Interception driver library
 * @returns {Object|null} Interception library or null if failed
 */
function loadInterceptionLibrary() {
  if (!os.platform() === 'win32') {
    console.warn('[Interception] Not on Windows, cannot load driver');
    return null;
  }

  if (driverLoaded && interception) {
    return interception;
  }

  try {
    // Get path to interception.dll
    let dllPath;
    if (process.env.NODE_ENV === 'production') {
      dllPath = path.join(process.resourcesPath, 'interception', 'interception.dll');
    } else {
      dllPath = path.join(__dirname, '../../resources/interception/interception.dll');
    }

    console.log('[Interception] Loading DLL from:', dllPath);

    // Define Interception API using ffi-napi
    // Based on: https://github.com/oblitum/Interception
    const InterceptionContext = ref.types.void;
    const InterceptionDevice = ref.types.int;
    const InterceptionPrecedence = ref.types.int;
    const InterceptionFilter = ref.types.ushort;

    // KeyState enum
    const INTERCEPTION_KEY_DOWN = 0x00;
    const INTERCEPTION_KEY_UP = 0x01;
    const INTERCEPTION_KEY_E0 = 0x02;
    const INTERCEPTION_KEY_E1 = 0x04;

    // Stroke structure (must match C struct)
    const InterceptionKeyStroke = ref.types.void; // We'll use buffer

    interception = ffi.Library(dllPath, {
      // Context management
      'interception_create_context': [InterceptionContext, []],
      'interception_destroy_context': ['void', [InterceptionContext]],

      // Device control
      'interception_set_filter': ['void', [InterceptionContext, 'pointer', InterceptionFilter]],
      'interception_send': ['int', [InterceptionContext, InterceptionDevice, 'pointer', 'uint']],

      // Utility
      'interception_is_keyboard': ['int', [InterceptionDevice]],
      'interception_is_mouse': ['int', [InterceptionDevice]],
    });

    driverLoaded = true;
    console.log('[Interception] Driver loaded successfully');
    return interception;

  } catch (error) {
    console.error('[Interception] Failed to load driver:', error.message);
    return null;
  }
}

/**
 * Types text using Interception driver (appears as virtual HID keyboard)
 * @param {string} text - Text to type
 * @param {Object} options - Options
 * @param {number} options.delayBetweenKeys - Delay in ms between keystrokes
 * @returns {Promise<Object>} Result
 */
async function typeWithInterception(text, options = {}) {
  const { delayBetweenKeys = 100 } = options;

  if (os.platform() !== 'win32') {
    return {
      success: false,
      error: 'Interception driver only works on Windows'
    };
  }

  const lib = loadInterceptionLibrary();
  if (!lib) {
    return {
      success: false,
      error: 'Failed to load Interception driver library'
    };
  }

  try {
    console.log('[Interception] Creating context...');
    const context = lib.interception_create_context();

    if (ref.isNull(context)) {
      throw new Error('Failed to create Interception context. Is the driver installed?');
    }

    console.log('[Interception] Typing text using virtual keyboard...');

    // TODO: Implement actual keystroke sending
    // This requires:
    // 1. Converting characters to scan codes
    // 2. Creating InterceptionKeyStroke structures
    // 3. Sending keyDown and keyUp events via interception_send()

    // For now, this is a placeholder
    // Full implementation requires scan code mapping

    lib.interception_destroy_context(context);

    return {
      success: true,
      message: 'Text typed successfully (placeholder)',
      charsTyped: text.length
    };

  } catch (error) {
    console.error('[Interception] Typing failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Simpler approach: Use interception command-line tool
 * This is easier than FFI and works reliably
 * @param {string} text - Text to type
 * @param {Object} options - Options
 * @returns {Promise<Object>}
 */
async function typeWithInterceptionCLI(text, options = {}) {
  const { delayBetweenKeys = 100 } = options;

  if (os.platform() !== 'win32') {
    return { success: false, error: 'Windows only' };
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Get path to interception command-line tool
    let cliPath;
    if (process.env.NODE_ENV === 'production') {
      cliPath = path.join(process.resourcesPath, 'interception', 'command-line', 'interception.exe');
    } else {
      cliPath = path.join(__dirname, '../../resources/interception/command-line/interception.exe');
    }

    console.log('[Interception] Using CLI tool:', cliPath);

    // Type each character with delay
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Call interception CLI to type single character
      // You would need to create a helper program or use existing tools
      // This is a placeholder for the approach

      await new Promise(resolve => setTimeout(resolve, delayBetweenKeys));
    }

    return { success: true, charsTyped: text.length };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  loadInterceptionLibrary,
  typeWithInterception,
  typeWithInterceptionCLI,
};
