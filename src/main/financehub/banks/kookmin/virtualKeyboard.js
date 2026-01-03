/**
 * Kookmin Bank Virtual Keyboard Utilities
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
  
  // Also check in iframes (Kookmin might use iframes for virtual keyboard)
  log(`Checking iframes for ${label} keyboard...`);
  const frames = page.frames();
  for (const frame of frames) {
    for (const selector of selectors) {
      try {
        const locator = frame.locator(`xpath=${selector}`);
        const count = await locator.count();
        
        if (count > 0) {
          const isVisible = await locator.first().isVisible().catch(() => false);
          if (isVisible) {
            log(`Found visible ${label} keyboard in iframe with selector: ${selector}`);
            return {
              locator: locator.first(),
              selector: selector,
              frame: frame
            };
          }
        }
      } catch (err) {
        // Frame might be detached, continue
      }
    }
  }
  
  return null;
}

/**
 * Gets the XPaths for the LOWER keyboard (Kookmin specific)
 * @returns {Array} List of XPaths
 */
function getLowerKeyboardSelectors() {
  return [
    // Kookmin specific selectors
    '//div[@id="vk_layout_lower"]',
    '//div[contains(@class, "keyboard_lower")]',
    '//div[contains(@id, "_layoutLower")]',
    '//div[contains(@class, "vk_lower")]',
    // Generic virtual keyboard selectors
    '//div[contains(@class, "transkey_lower")]',
    '//div[contains(@class, "virtual") and contains(@class, "lower")]',
    '//div[@id="virtualKeyboard" and contains(@class, "lower")]',
    // Kookmin might use different naming
    '//div[contains(@id, "kbdLower")]',
    '//div[contains(@class, "kbd") and contains(@class, "lower")]'
  ];
}

/**
 * Gets the XPaths for the UPPER keyboard (Kookmin specific)
 * @returns {Array} List of XPaths
 */
function getUpperKeyboardSelectors() {
  return [
    // Kookmin specific selectors
    '//div[@id="vk_layout_upper"]',
    '//div[contains(@class, "keyboard_upper")]',
    '//div[contains(@id, "_layoutUpper")]',
    '//div[contains(@class, "vk_upper")]',
    // Generic virtual keyboard selectors
    '//div[contains(@class, "transkey_upper")]',
    '//div[contains(@class, "virtual") and contains(@class, "upper")]',
    '//div[@id="virtualKeyboard" and contains(@class, "upper")]',
    // Kookmin might use different naming
    '//div[contains(@id, "kbdUpper")]',
    '//div[contains(@class, "kbd") and contains(@class, "upper")]'
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
        } else {
          log(`Shift key required for '${char}' but not found in keyboard`);
          results.failedChars.push({ index: i, char, reason: 'shift_not_found' });
          continue;
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
      try {
        await page.mouse.move(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(delays.mouseMove || 100);
        await page.mouse.click(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(delays.click || 200);
        
        results.typedChars++;
        results.details.push({
          index: i,
          char: char,
          position: keyInfo.position,
          shiftUsed: needsShift
        });
        
        log(`Typed character ${i + 1}/${password.length}: '${char}' at (${keyInfo.position.x}, ${keyInfo.position.y})`);
      } catch (clickError) {
        log(`Failed to click character '${char}': ${clickError.message}`);
        results.failedChars.push({ index: i, char, reason: 'click_failed', error: clickError.message });
      }
    }
    
    // Deactivate shift at end if needed
    if (shiftActive && keyboardJSON.shiftKey) {
      log('Deactivating shift at end');
      await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
      await page.waitForTimeout(delays.keyboardReturn || 300);
      results.shiftClicks++;
    }
    
    // Log summary
    log(`Password typing completed: ${results.typedChars}/${results.totalChars} characters typed`);
    if (results.failedChars.length > 0) {
      log(`Failed characters: ${results.failedChars.map(f => f.char).join(', ')}`);
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

/**
 * Waits for virtual keyboard to appear
 * @param {Object} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} True if keyboard appeared
 */
async function waitForVirtualKeyboard(page, timeout = 5000, log = console.log) {
  log('Waiting for virtual keyboard to appear...');
  
  const allSelectors = [...getLowerKeyboardSelectors(), ...getUpperKeyboardSelectors()];
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    for (const selector of allSelectors) {
      const count = await page.locator(`xpath=${selector}`).count();
      if (count > 0) {
        log('Virtual keyboard detected');
        return true;
      }
    }
    
    // Also check in frames
    const frames = page.frames();
    for (const frame of frames) {
      for (const selector of allSelectors) {
        try {
          const count = await frame.locator(`xpath=${selector}`).count();
          if (count > 0) {
            log('Virtual keyboard detected in iframe');
            return true;
          }
        } catch (err) {
          // Frame might be detached
        }
      }
    }
    
    await page.waitForTimeout(100);
  }
  
  log('Virtual keyboard did not appear within timeout');
  return false;
}

module.exports = {
  findVisibleKeyboard,
  getLowerKeyboardSelectors,
  getUpperKeyboardSelectors,
  typePasswordWithKeyboard,
  waitForVirtualKeyboard,
};