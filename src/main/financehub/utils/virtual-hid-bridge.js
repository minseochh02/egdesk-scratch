/**
 * Virtual HID Keyboard Bridge
 *
 * This module provides a bridge to OS-level keyboard input using platform-specific methods.
 * It avoids npm native modules by using Python/system tools directly.
 *
 * Approach:
 * - Spawns Python script with pynput that creates OS-level keyboard events
 * - These events go through the kernel input stack
 * - Indistinguishable from real USB keyboard input
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Check if Python3 and pynput are available
 */
async function checkDependencies() {
  return new Promise((resolve) => {
    // Check Python3
    const python = spawn('python3', ['--version']);

    python.on('error', () => {
      resolve({ hasPython: false, hasPynput: false });
    });

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({ hasPython: false, hasPynput: false });
        return;
      }

      // Check pynput
      const pip = spawn('python3', ['-c', 'import pynput']);
      pip.on('error', () => {
        resolve({ hasPython: true, hasPynput: false });
      });

      pip.on('close', (pipCode) => {
        resolve({ hasPython: true, hasPynput: pipCode === 0 });
      });
    });
  });
}

/**
 * Install pynput if not available
 */
async function installPynput() {
  return new Promise((resolve, reject) => {
    console.log('[Virtual-HID] Installing pynput...');

    const pip = spawn('pip3', ['install', 'pynput']);

    pip.stdout.on('data', (data) => {
      console.log(`[Virtual-HID] ${data.toString().trim()}`);
    });

    pip.stderr.on('data', (data) => {
      console.error(`[Virtual-HID] ${data.toString().trim()}`);
    });

    pip.on('close', (code) => {
      if (code === 0) {
        console.log('[Virtual-HID] pynput installed successfully');
        resolve(true);
      } else {
        reject(new Error(`Failed to install pynput (exit code: ${code})`));
      }
    });

    pip.on('error', (err) => {
      reject(new Error(`Failed to spawn pip3: ${err.message}`));
    });
  });
}

/**
 * Send password via virtual HID keyboard (Python pynput)
 *
 * @param {string} password - Password to type
 * @param {Object} options - Typing options
 * @param {number} options.charDelay - Delay between characters in ms (default: 100)
 * @param {number} options.preDelay - Delay before starting to type in ms (default: 500)
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @param {boolean} options.autoInstall - Auto-install pynput if missing (default: true)
 * @returns {Promise<boolean>} Success status
 */
async function sendPasswordViaVirtualHID(password, options = {}) {
  const {
    charDelay = 100,
    preDelay = 500,
    debug = false,
    autoInstall = true
  } = options;

  try {
    // Check dependencies
    if (debug) {
      console.log('[Virtual-HID] Checking dependencies...');
    }

    const deps = await checkDependencies();

    if (!deps.hasPython) {
      throw new Error('Python3 is not installed. Please install Python 3.');
    }

    if (!deps.hasPynput) {
      if (autoInstall) {
        console.log('[Virtual-HID] pynput not found, attempting to install...');
        await installPynput();
      } else {
        throw new Error('pynput is not installed. Run: pip3 install pynput');
      }
    }

    if (debug) {
      console.log('[Virtual-HID] Dependencies OK');
    }

    // Path to Python script
    const scriptPath = path.join(__dirname, 'virtual-hid-keyboard.py');

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Python script not found: ${scriptPath}`);
    }

    if (debug) {
      console.log(`[Virtual-HID] Using script: ${scriptPath}`);
      console.log(`[Virtual-HID] Password length: ${password.length}`);
      console.log(`[Virtual-HID] Char delay: ${charDelay}ms, Pre-delay: ${preDelay}ms`);
    }

    // Make script executable
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (e) {
      // Ignore chmod errors
    }

    // Spawn Python script with timeout protection
    return new Promise((resolve, reject) => {
      // Use 'python' on Windows, 'python3' on Unix
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

      const python = spawn(pythonCmd, [
        scriptPath,
        password,
        '--delay', charDelay.toString(),
        '--pre-delay', preDelay.toString()
      ]);

      let stdout = '';
      let stderr = '';
      let completed = false;

      // Timeout to kill hanging processes (15 seconds should be plenty)
      const timeout = setTimeout(() => {
        if (!completed) {
          console.error('[Virtual-HID] ⚠️  Timeout - killing Python process');
          try {
            python.kill('SIGTERM');
            setTimeout(() => {
              if (!python.killed) {
                python.kill('SIGKILL');
              }
            }, 1000);
          } catch (e) {
            console.error(`[Virtual-HID] Error killing process: ${e.message}`);
          }
          reject(new Error('Virtual HID typing timeout (15s)'));
        }
      }, 15000);

      python.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (debug) {
          console.log(output.trim());
        }
      });

      python.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (debug) {
          console.error(output.trim());
        }
      });

      python.on('close', (code) => {
        completed = true;
        clearTimeout(timeout);

        if (code === 0 && stdout.includes('SUCCESS')) {
          if (debug) {
            console.log('[Virtual-HID] ✅ Password typed successfully via virtual HID');
          }
          resolve(true);
        } else {
          const error = `Virtual HID typing failed (exit code: ${code})\nStderr: ${stderr}`;
          console.error(`[Virtual-HID] ❌ ${error}`);
          reject(new Error(error));
        }
      });

      python.on('error', (err) => {
        completed = true;
        clearTimeout(timeout);
        const error = `Failed to spawn Python: ${err.message}`;
        console.error(`[Virtual-HID] ❌ ${error}`);
        reject(new Error(error));
      });

      // Cleanup on process exit
      process.on('exit', () => {
        if (!completed) {
          try {
            python.kill();
          } catch (e) {
            // Ignore
          }
        }
      });
    });
  } catch (error) {
    console.error('[Virtual-HID] Error:', error.message);
    return false;
  }
}

/**
 * Get system information for debugging
 */
async function getSystemInfo() {
  const deps = await checkDependencies();

  return {
    platform: process.platform,
    arch: process.arch,
    hasPython3: deps.hasPython,
    hasPynput: deps.hasPynput,
  };
}

/**
 * Send password character-by-character with app-controlled timing
 * This gives you full control over delays for more natural typing
 *
 * @param {string} password - Password to type
 * @param {Object} options - Typing options
 * @param {number} options.minDelay - Minimum delay between characters in ms (default: 50)
 * @param {number} options.maxDelay - Maximum delay between characters in ms (default: 150)
 * @param {number} options.preDelay - Delay before starting to type in ms (default: 500)
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @param {Function} options.onProgress - Callback for progress (index, char, total)
 * @returns {Promise<boolean>} Success status
 */
async function sendPasswordWithNaturalTiming(password, options = {}) {
  const {
    minDelay = 50,
    maxDelay = 150,
    preDelay = 500,
    debug = false,
    onProgress = null
  } = options;

  try {
    // Check dependencies first
    if (debug) {
      console.log('[Virtual-HID] Checking dependencies...');
    }

    const deps = await checkDependencies();

    if (!deps.hasPython) {
      throw new Error('Python3 is not installed. Please install Python 3.');
    }

    if (!deps.hasPynput) {
      console.log('[Virtual-HID] pynput not found, attempting to install...');
      await installPynput();
    }

    if (debug) {
      console.log('[Virtual-HID] Dependencies OK');
      console.log(`[Virtual-HID] Typing ${password.length} characters with delays ${minDelay}-${maxDelay}ms`);
    }

    // Initial delay before starting
    await new Promise(resolve => setTimeout(resolve, preDelay));

    // Type each character with variable delays
    for (let i = 0; i < password.length; i++) {
      const char = password[i];

      // Call sendPasswordViaVirtualHID with single character and no delays
      // (the Python script will handle the character immediately)
      const success = await sendPasswordViaVirtualHID(char, {
        charDelay: 0,
        preDelay: 0,
        debug: false,
        autoInstall: false // Already checked above
      });

      if (!success) {
        throw new Error(`Failed to type character at position ${i}`);
      }

      // Progress callback
      if (onProgress) {
        onProgress(i, char, password.length);
      }

      if (debug && (i + 1) % 10 === 0) {
        console.log(`[Virtual-HID] Progress: ${i + 1}/${password.length}`);
      }

      // Add variable delay before next character (except after last char)
      if (i < password.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (debug) {
      console.log('[Virtual-HID] ✅ All characters typed successfully');
    }

    return true;
  } catch (error) {
    console.error('[Virtual-HID] Error:', error.message);
    return false;
  }
}

module.exports = {
  sendPasswordViaVirtualHID,
  sendPasswordWithNaturalTiming,
  checkDependencies,
  installPynput,
  getSystemInfo
};
