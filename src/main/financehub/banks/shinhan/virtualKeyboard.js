/**
 * Shinhan Bank Virtual Keyboard Utilities
 */

/**
 * Finds a visible virtual keyboard from a list of selectors
 * @param {Object} page - Playwright page object
 * @param {Array} selectors - List of XPaths to try
 * @param {string} label - Label for logging (e.g., 'LOWER', 'UPPER')
 * @param {Function} log - Logging function
 * @returns {Promise<Object|null>} Found locator and selector or null
 */
async function findVisibleKeyboard(page, selectors, label, log = console.log) {
  log(`Looking for ${label} keyboard...`);
  
  for (const selector of selectors) {
    const locator = page.locator(`xpath=${selector}`);
    const count = await locator.count();
    
    if (count > 0) {
      const isVisible = await locator.first().isVisible().catch(() => false);
      if (isVisible) {
        log(`Found visible ${label} keyboard with selector: ${selector}`);
        return {
          locator: locator.first(),
          selector: selector
        };
      }
    }
  }
  
  return null;
}

/**
 * Gets the XPaths for the LOWER keyboard
 * @returns {Array} List of XPaths
 */
function getLowerKeyboardSelectors() {
  return [
    '//div[@id="비밀번호_layoutLower"]',
    '//div[contains(@id, "_layoutLower") and contains(@class, "transkey_lower")]',
    '//div[contains(@class, "transkey_lower")]'
  ];
}

/**
 * Gets the XPaths for the UPPER keyboard
 * @returns {Array} List of XPaths
 */
function getUpperKeyboardSelectors() {
  return [
    '//div[@id="비밀번호_layoutUpper"]',
    '//div[contains(@id, "_layoutUpper") and contains(@class, "transkey_upper")]',
    '//div[contains(@class, "transkey_upper")]'
  ];
}

/**
 * Types password using bilingual keyboard JSON with shift support
 * @param {Object} keyboardJSON - Bilingual keyboard JSON structure
 * @param {string} password - Password to type
 * @param {Object} page - Playwright page object
 * @param {Object} delays - Delay configurations
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} Result with success status and details
 */
async function typePasswordWithKeyboard(keyboardJSON, password, page, delays, log = console.log) {
  try {
    log(`Typing password with JSON... (${password.length} characters)`);
    
    const results = {
      success: true,
      totalChars: password.length,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: []
    };
    
    let shiftActive = false;
    
    for (let i = 0; i < password.length; i++) {
      const char = password[i];
      let keyInfo = keyboardJSON.characterMap[char];
      
      if (!keyInfo) {
        log(`Character '${char}' not found in keyboard mapping`);
        results.failedChars.push({ index: i, char, reason: 'not_found' });
        continue;
      }
      
      const needsShift = keyInfo.requiresShift || false;
      
      // Handle shift state
      if (needsShift && !shiftActive) {
        if (keyboardJSON.shiftKey) {
          log(`Activating shift for '${char}'`);
          await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
          await page.waitForTimeout(delays.mouseMove || 100);
          await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
          await page.waitForTimeout(delays.shiftActivate || 200);
          shiftActive = true;
          results.shiftClicks++;
        }
      } else if (!needsShift && shiftActive) {
        if (keyboardJSON.shiftKey) {
          log(`Deactivating shift for '${char}'`);
          await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
          await page.waitForTimeout(delays.mouseMove || 100);
          await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
          await page.waitForTimeout(delays.shiftDeactivate || 200);
          shiftActive = false;
          results.shiftClicks++;
        }
      }
      
      // Click character key
      await page.mouse.move(keyInfo.position.x, keyInfo.position.y);
      await page.waitForTimeout(delays.mouseMove || 100);
      await page.mouse.click(keyInfo.position.x, keyInfo.position.y);
      await page.waitForTimeout(delays.click || 200);
      
      results.typedChars++;
    }
    
    // Deactivate shift at end if needed
    if (shiftActive && keyboardJSON.shiftKey) {
      await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
      results.shiftClicks++;
    }
    
    return results;
  } catch (error) {
    log(`Error typing password: ${error.message}`);
    return {
      success: false,
      error: error.message,
      totalChars: password.length,
      typedChars: 0,
      failedChars: [],
      shiftClicks: 0,
      details: []
    };
  }
}

module.exports = {
  findVisibleKeyboard,
  getLowerKeyboardSelectors,
  getUpperKeyboardSelectors,
  typePasswordWithKeyboard,
};

