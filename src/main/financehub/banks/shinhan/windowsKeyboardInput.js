// ============================================================================
// WINDOWS KEYBOARD INPUT MODULE
// ============================================================================

const os = require('os');

/**
 * Windows-specific keyboard input module for NH Bank automation
 * Uses direct keyboard presses instead of virtual keyboard clicking
 */

/**
 * Checks if current platform is Windows
 * @returns {boolean} True if running on Windows
 */
function isWindows() {
  return os.platform() === 'win32';
}

/**
 * Types password using keyboard presses instead of virtual keyboard
 * @param {Object} page - Playwright page object
 * @param {string} password - Password to type
 * @param {Object} delays - Timing configuration
 * @param {Function} log - Logging function
 * @param {string} passwordSelector - XPath selector for password field
 * @returns {Promise<Object>} Result object
 */
async function typePasswordWithKeyboard(page, password, delays, log, passwordSelector) {
  try {
    log('Using Windows keyboard input mode for password entry...');
    
    // Ensure password field is focused
    const passwordField = page.locator(`xpath=${passwordSelector}`);
    await passwordField.focus();
    await page.waitForTimeout(delays.betweenActions || 500);
    
    // Clear any existing content
    await passwordField.fill('');
    await page.waitForTimeout(200);
    
    // Type password character by character with proper delays
    log(`Typing password (${password.length} characters)...`);
    let typedChars = 0;
    const details = [];
    
    for (let i = 0; i < password.length; i++) {
      const char = password[i];
      
      try {
        // Use keyboard.type for more realistic typing
        await page.keyboard.type(char, { delay: delays.keyPress || 200 });
        typedChars++;
        
        details.push({
          char: char,
          position: i + 1,
          success: true,
          method: 'keyboard.type'
        });
        
        log(`Typed character ${i + 1}/${password.length}: ${char}`);
        
        // Small delay between characters to simulate human typing
        if (i < password.length - 1) {
          await page.waitForTimeout(delays.betweenActions || 300);
        }
      } catch (error) {
        log(`Failed to type character ${i + 1}: ${char} - ${error.message}`);
        details.push({
          char: char,
          position: i + 1,
          success: false,
          error: error.message,
          method: 'keyboard.type'
        });
      }
    }
    
    // Verify the password was entered correctly
    const enteredValue = await passwordField.inputValue();
    const isComplete = enteredValue.length === password.length;
    
    log(`Password entry completed: ${typedChars}/${password.length} characters typed`);
    log(`Input field value length: ${enteredValue.length}`);
    
    return {
      success: isComplete,
      totalChars: password.length,
      typedChars: typedChars,
      failedChars: details.filter(d => !d.success),
      shiftClicks: 0, // Not applicable for keyboard input
      details: details,
      method: 'windows_keyboard_input',
      inputLength: enteredValue.length
    };
    
  } catch (error) {
    log(`Windows keyboard input failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      totalChars: password.length,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: [],
      method: 'windows_keyboard_input'
    };
  }
}

/**
 * Alternative keyboard input method using focus + fill
 * @param {Object} page - Playwright page object
 * @param {string} password - Password to type
 * @param {Object} delays - Timing configuration
 * @param {Function} log - Logging function
 * @param {string} passwordSelector - XPath selector for password field
 * @returns {Promise<Object>} Result object
 */
async function typePasswordWithFill(page, password, delays, log, passwordSelector) {
  try {
    log('Using Windows fill method for password entry...');
    
    // Ensure password field is focused
    const passwordField = page.locator(`xpath=${passwordSelector}`);
    await passwordField.focus();
    await page.waitForTimeout(delays.betweenActions || 500);
    
    // Use fill method for faster input
    await passwordField.fill(password);
    await page.waitForTimeout(delays.betweenActions || 300);
    
    // Verify the password was entered
    const enteredValue = await passwordField.inputValue();
    const isComplete = enteredValue.length === password.length;
    
    log(`Password fill completed: ${enteredValue.length}/${password.length} characters`);
    
    return {
      success: isComplete,
      totalChars: password.length,
      typedChars: password.length,
      failedChars: [],
      shiftClicks: 0,
      details: [{
        method: 'fill',
        success: isComplete,
        totalLength: password.length,
        actualLength: enteredValue.length
      }],
      method: 'windows_fill_input',
      inputLength: enteredValue.length
    };
    
  } catch (error) {
    log(`Windows fill input failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      totalChars: password.length,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: [],
      method: 'windows_fill_input'
    };
  }
}

/**
 * Advanced keyboard input with clipboard support (fallback method)
 * @param {Object} page - Playwright page object
 * @param {string} password - Password to type
 * @param {Object} delays - Timing configuration
 * @param {Function} log - Logging function
 * @param {string} passwordSelector - XPath selector for password field
 * @returns {Promise<Object>} Result object
 */
async function typePasswordWithClipboard(page, password, delays, log, passwordSelector) {
  try {
    log('Using Windows clipboard method for password entry...');
    
    // Focus the password field
    const passwordField = page.locator(`xpath=${passwordSelector}`);
    await passwordField.focus();
    await page.waitForTimeout(delays.betweenActions || 500);
    
    // Clear field first
    await passwordField.fill('');
    await page.waitForTimeout(200);
    
    // Use evaluate to set clipboard and paste
    await page.evaluate(async (pwd) => {
      // Set clipboard content
      await navigator.clipboard.writeText(pwd);
    }, password);
    
    // Paste using Ctrl+V
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(delays.betweenActions || 500);
    
    // Verify
    const enteredValue = await passwordField.inputValue();
    const isComplete = enteredValue.length === password.length;
    
    log(`Clipboard paste completed: ${enteredValue.length}/${password.length} characters`);
    
    // Clear clipboard for security
    try {
      await page.evaluate(() => {
        navigator.clipboard.writeText('');
      });
    } catch (e) {
      log('Could not clear clipboard:', e.message);
    }
    
    return {
      success: isComplete,
      totalChars: password.length,
      typedChars: password.length,
      failedChars: [],
      shiftClicks: 0,
      details: [{
        method: 'clipboard_paste',
        success: isComplete,
        totalLength: password.length,
        actualLength: enteredValue.length
      }],
      method: 'windows_clipboard_input',
      inputLength: enteredValue.length
    };
    
  } catch (error) {
    log(`Windows clipboard input failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      totalChars: password.length,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: [],
      method: 'windows_clipboard_input'
    };
  }
}

/**
 * Main function to handle password input on Windows with fallback methods
 * @param {Object} page - Playwright page object
 * @param {string} password - Password to type
 * @param {Object} delays - Timing configuration
 * @param {Function} log - Logging function
 * @param {string} [preferredMethod] - Preferred input method ('auto', 'keyboard', 'fill', 'clipboard')
 * @param {string} passwordSelector - XPath selector for password field
 * @returns {Promise<Object>} Result object
 */
async function handleWindowsPasswordInput(page, password, delays, log, preferredMethod = 'auto', passwordSelector) {
  if (!isWindows()) {
    throw new Error('This module is only for Windows platform');
  }
  
  log('Attempting Windows keyboard input methods...');
  
  // Define methods based on preference
  let methods;
  
  if (preferredMethod === 'keyboard') {
    methods = [{ name: 'keyboard_typing', func: typePasswordWithKeyboard }];
  } else if (preferredMethod === 'fill') {
    methods = [{ name: 'fill_method', func: typePasswordWithFill }];
  } else if (preferredMethod === 'clipboard') {
    methods = [{ name: 'clipboard_paste', func: typePasswordWithClipboard }];
  } else {
    // Auto mode - try all methods in order of preference
    methods = [
      { name: 'keyboard_typing', func: typePasswordWithKeyboard },
      { name: 'fill_method', func: typePasswordWithFill },
      { name: 'clipboard_paste', func: typePasswordWithClipboard }
    ];
  }
  
  for (const method of methods) {
    log(`Trying ${method.name}...`);
    
    try {
      const result = await method.func(page, password, delays, log, passwordSelector);
      
      if (result.success) {
        log(`${method.name} succeeded!`);
        return result;
      } else {
        log(`${method.name} failed, trying next method...`);
      }
    } catch (error) {
      log(`${method.name} threw error: ${error.message}, trying next method...`);
    }
  }
  
  // All methods failed
  log('All Windows input methods failed');
  return {
    success: false,
    error: 'All Windows keyboard input methods failed',
    totalChars: password.length,
    typedChars: 0,
    failedChars: [],
    shiftClicks: 0,
    details: [],
    method: 'windows_input_all_failed'
  };
}

module.exports = {
  isWindows,
  typePasswordWithKeyboard,
  typePasswordWithFill,
  typePasswordWithClipboard,
  handleWindowsPasswordInput
};