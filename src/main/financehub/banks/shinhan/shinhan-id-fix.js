// ============================================================================
// SHINHAN BANK ID INPUT FIX
// ============================================================================

/**
 * Enhanced ID input handling for Shinhan Bank
 * Addresses production issues where ID field is selected but not filled
 */

/**
 * Fills ID input with enhanced error handling and retries
 * @param {Object} page - Playwright page object
 * @param {string} xpath - XPath selector for ID input
 * @param {string} userId - User ID to fill
 * @param {Object} config - Configuration object
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} Success status
 */
async function fillIdInputEnhanced(page, xpath, userId, config, log) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    log(`Attempting to fill User ID (attempt ${attempt}/${maxRetries})...`);
    
    try {
      // Wait for the element to be present
      const locator = page.locator(`xpath=${xpath}`);
      await locator.waitFor({ 
        state: 'attached', 
        timeout: config.timeouts.elementWait || 10000 
      });
      
      // Additional wait to ensure element is ready
      await page.waitForTimeout(1000);
      
      // Check if element is visible
      const isVisible = await locator.isVisible();
      if (!isVisible) {
        log('ID input not visible, waiting...');
        await locator.waitFor({ 
          state: 'visible', 
          timeout: config.timeouts.elementWait || 10000 
        });
      }
      
      // Check if element is enabled
      const isEnabled = await locator.isEnabled();
      if (!isEnabled) {
        log('ID input not enabled, waiting...');
        await page.waitForTimeout(2000);
      }
      
      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(config.timeouts.scrollWait || 500);
      
      // Click to focus
      log('Clicking ID input to focus...');
      await locator.click({ timeout: config.timeouts.click || 5000 });
      await page.waitForTimeout(500);
      
      // Clear any existing value
      await locator.clear().catch(() => {
        // Fallback: select all and delete
        log('Clear failed, trying select all and delete...');
        return locator.press('Control+a').then(() => locator.press('Delete'));
      });
      
      // Try multiple fill methods
      let filled = false;
      
      // Method 1: Direct fill
      try {
        log('Trying direct fill method...');
        await locator.fill(userId);
        filled = true;
      } catch (fillError) {
        log('Direct fill failed:', fillError.message);
        
        // Method 2: Type character by character
        try {
          log('Trying type method...');
          await locator.type(userId, { delay: 100 });
          filled = true;
        } catch (typeError) {
          log('Type method failed:', typeError.message);
          
          // Method 3: Use page.type
          try {
            log('Trying page.type method...');
            await page.type(`xpath=${xpath}`, userId, { delay: 100 });
            filled = true;
          } catch (pageTypeError) {
            log('Page.type method failed:', pageTypeError.message);
          }
        }
      }
      
      if (filled) {
        // Verify the value was actually entered
        await page.waitForTimeout(500);
        const actualValue = await locator.inputValue();
        
        if (actualValue === userId) {
          log(`Successfully filled User ID: ${userId}`);
          return true;
        } else {
          log(`Value mismatch - Expected: ${userId}, Actual: ${actualValue}`);
          if (attempt < maxRetries) {
            log('Retrying...');
            continue;
          }
        }
      }
      
    } catch (error) {
      log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        log(`Waiting ${2 * attempt} seconds before retry...`);
        await page.waitForTimeout(2000 * attempt);
        continue;
      }
    }
  }
  
  log('All attempts to fill User ID failed');
  return false;
}

/**
 * Alternative approach using evaluate for direct DOM manipulation
 * @param {Object} page - Playwright page object
 * @param {string} xpath - XPath selector for ID input
 * @param {string} userId - User ID to fill
 * @param {Function} log - Logging function
 * @returns {Promise<boolean>} Success status
 */
async function fillIdInputWithEvaluate(page, xpath, userId, log) {
  try {
    log('Trying evaluate method for ID input...');
    
    const result = await page.evaluate(({ xpath, userId }) => {
      // Find element using XPath
      const xpathResult = document.evaluate(
        xpath, 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      );
      
      const element = xpathResult.singleNodeValue;
      
      if (!element) {
        return { success: false, error: 'Element not found' };
      }
      
      if (element.tagName !== 'INPUT') {
        return { success: false, error: 'Element is not an input' };
      }
      
      // Focus the element
      element.focus();
      
      // Set value directly
      element.value = userId;
      
      // Trigger events to notify frameworks
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      // Verify value was set
      return { 
        success: element.value === userId, 
        actualValue: element.value 
      };
      
    }, { xpath, userId });
    
    if (result.success) {
      log('Successfully filled User ID using evaluate method');
      return true;
    } else {
      log('Evaluate method failed:', result.error || `Value mismatch: ${result.actualValue}`);
      return false;
    }
    
  } catch (error) {
    log('Evaluate method error:', error.message);
    return false;
  }
}

/**
 * Diagnose why ID input might not be working
 * @param {Object} page - Playwright page object
 * @param {string} xpath - XPath selector for ID input
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} Diagnostic information
 */
async function diagnoseIdInput(page, xpath, log) {
  log('Running ID input diagnostics...');
  
  const diagnostics = {
    elementFound: false,
    isVisible: false,
    isEnabled: false,
    isEditable: false,
    tagName: null,
    type: null,
    readOnly: false,
    disabled: false,
    hasValue: false,
    currentValue: null,
    attributes: {},
    computedStyles: {},
    parentInfo: null
  };
  
  try {
    const locator = page.locator(`xpath=${xpath}`);
    
    // Check if element exists
    const count = await locator.count();
    diagnostics.elementFound = count > 0;
    
    if (count === 0) {
      log('Element not found with given XPath');
      return diagnostics;
    }
    
    // Basic properties
    diagnostics.isVisible = await locator.isVisible();
    diagnostics.isEnabled = await locator.isEnabled();
    diagnostics.isEditable = await locator.isEditable();
    
    // Get detailed info using evaluate
    const details = await page.evaluate((xpath) => {
      const xpathResult = document.evaluate(
        xpath, 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      );
      
      const element = xpathResult.singleNodeValue;
      if (!element) return null;
      
      const computedStyles = window.getComputedStyle(element);
      
      return {
        tagName: element.tagName,
        type: element.type,
        readOnly: element.readOnly,
        disabled: element.disabled,
        hasValue: !!element.value,
        currentValue: element.value,
        attributes: {
          id: element.id,
          name: element.name,
          class: element.className,
          placeholder: element.placeholder,
          maxLength: element.maxLength,
          autocomplete: element.autocomplete
        },
        computedStyles: {
          display: computedStyles.display,
          visibility: computedStyles.visibility,
          opacity: computedStyles.opacity,
          pointerEvents: computedStyles.pointerEvents,
          position: computedStyles.position,
          zIndex: computedStyles.zIndex
        },
        parentInfo: {
          tagName: element.parentElement?.tagName,
          className: element.parentElement?.className,
          id: element.parentElement?.id
        }
      };
    }, xpath);
    
    if (details) {
      Object.assign(diagnostics, details);
    }
    
    log('Diagnostics complete:', JSON.stringify(diagnostics, null, 2));
    
  } catch (error) {
    log('Diagnostic error:', error.message);
  }
  
  return diagnostics;
}

module.exports = {
  fillIdInputEnhanced,
  fillIdInputWithEvaluate,
  diagnoseIdInput
};