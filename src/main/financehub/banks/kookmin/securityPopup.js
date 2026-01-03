/**
 * Handles security program installation popup for Kookmin Bank
 * @param {Object} page - Playwright page object
 * @param {Function} log - Logging function
 * @param {Function} warn - Warning function
 * @returns {Promise<boolean>} Success status
 */
async function handleSecurityPopup(page, log = console.log, warn = console.warn) {
  try {
    log('Checking for security program installation popup...');
    
    // Wait up to 10 seconds for the popup to appear
    log('Waiting up to 10 seconds for security popup to load...');
    
    let popupLocator = null;
    let popupExists = false;
    let iframe = null;
    
    // First, wait a bit for the page to fully load
    await page.waitForTimeout(3000);
    
    // Check for security popup iframe first
    log('Looking for security popup iframe...');
    try {
      // Wait for iframe with security popup (Kookmin might use different iframe titles)
      const iframeLocator = page.locator('//iframe[contains(@title, "보안") or contains(@src, "security") or contains(@src, "ahnlab")]');
      await iframeLocator.waitFor({ state: 'visible', timeout: 7000 });
      iframe = await iframeLocator.contentFrame();
      log('Security popup iframe found, switching context...');
    } catch (iframeError) {
      log('No security popup iframe found, checking main page...');
    }
    
    // Kookmin Bank specific selectors
    const XPATHS = {
      SECURITY_POPUP: '//div[contains(@class, "layer") and contains(., "보안프로그램")]',
      SECURITY_POPUP_ALT: '//div[contains(@class, "popup") and contains(., "보안")]',
      SECURITY_POPUP_CLOSE: '//a[contains(text(), "설치하지 않음")] | //button[contains(text(), "설치하지 않음")]',
      SECURITY_POPUP_CLOSE_ALT: '//a[contains(@class, "close")] | //button[contains(@class, "close")]',
      SECURITY_POPUP_CLOSE_ID: '//a[@id="btnClose"] | //button[@id="btnClose"]',
    };

    // Try to find popup in iframe or main page
    if (iframe) {
      // Look for popup inside iframe
      try {
        popupLocator = iframe.locator(`xpath=${XPATHS.SECURITY_POPUP}`);
        await popupLocator.waitFor({ state: 'visible', timeout: 3000 });
        popupExists = true;
        log('Security popup found in iframe');
      } catch (iframePopupError) {
        log('Popup not found in iframe, trying alternative selectors...');
        try {
          popupLocator = iframe.locator(`xpath=${XPATHS.SECURITY_POPUP_ALT}`);
          await popupLocator.waitFor({ state: 'visible', timeout: 2000 });
          popupExists = true;
          log('Alternative security popup found in iframe');
        } catch (altIframeError) {
          log('No popup found in iframe');
        }
      }
    } else {
      // Try to find popup in main page
      try {
        popupLocator = page.locator(`xpath=${XPATHS.SECURITY_POPUP}`);
        await popupLocator.waitFor({ state: 'visible', timeout: 5000 });
        popupExists = true;
        log('Primary security popup detected in main page');
      } catch (primaryError) {
        log('Primary popup selector not found, trying alternative...');
        
        try {
          popupLocator = page.locator(`xpath=${XPATHS.SECURITY_POPUP_ALT}`);
          await popupLocator.waitFor({ state: 'visible', timeout: 3000 });
          popupExists = true;
          log('Alternative security popup detected in main page');
        } catch (altError) {
          log('No security popup detected in main page');
        }
      }
    }
    
    if (!popupExists) {
      log('No security popup detected after checking iframe and main page');
      return true;
    }
    
    log('Security popup detected, attempting to close...');
    
    // Determine which context to use (iframe or main page)
    const context = iframe || page;
    log(`Using ${iframe ? 'iframe' : 'main page'} context for popup interaction`);
    
    // Try primary close button selector first
    let closeButtonLocator = context.locator(`xpath=${XPATHS.SECURITY_POPUP_CLOSE}`);
    let closeButtonExists = await closeButtonLocator.count() > 0;
    
    // If primary close button doesn't work, try alternatives
    if (!closeButtonExists) {
      log('Primary close button not found, trying alternative...');
      closeButtonLocator = context.locator(`xpath=${XPATHS.SECURITY_POPUP_CLOSE_ALT}`);
      closeButtonExists = await closeButtonLocator.count() > 0;
      
      if (!closeButtonExists) {
        log('Alternative close button not found, trying ID selector...');
        closeButtonLocator = context.locator(`xpath=${XPATHS.SECURITY_POPUP_CLOSE_ID}`);
        closeButtonExists = await closeButtonLocator.count() > 0;
      }
    }
    
    if (closeButtonExists) {
      log('Found close button, clicking...');
      try {
        await closeButtonLocator.click({ timeout: 5000, force: true });
        await page.waitForTimeout(1000);
        log('Security popup closed successfully');
        return true;
      } catch (clickError) {
        log('Failed to click close button, trying JavaScript click...');
        try {
          await closeButtonLocator.evaluate(button => button.click());
          await page.waitForTimeout(1000);
          log('Security popup closed with JavaScript click');
          return true;
        } catch (jsClickError) {
          log('JavaScript click also failed');
        }
      }
    }
    
    // Fallback: Try Escape key
    log('Trying Escape key to close popup...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Check if popup is still visible
    const stillVisible = await popupLocator.isVisible().catch(() => false);
    if (!stillVisible) {
      log('Security popup closed with Escape key');
      return true;
    }
    
    // Last resort: Try clicking overlay/background
    log('Trying to click overlay to close popup...');
    try {
      const overlay = context.locator('//div[contains(@class, "overlay") or contains(@class, "dimmed") or contains(@class, "backdrop")]');
      if (await overlay.count() > 0) {
        await overlay.click({ force: true });
        await page.waitForTimeout(1000);
        log('Clicked overlay to close popup');
        return true;
      }
    } catch (overlayError) {
      log('Overlay click failed');
    }
    
    warn('Could not close security popup, continuing anyway...');
    return false;
  } catch (error) {
    warn('Failed to handle security popup:', error);
    return false;
  }
}

module.exports = {
  handleSecurityPopup,
};