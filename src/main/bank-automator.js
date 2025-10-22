const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeKeyboardAndType } = require('./ai-keyboard-analyzer');
const { generateKeyboardVisualization } = require('./keyboard-visualization');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('./bilingual-keyboard-parser');


// Roboflow Custom Vision API
// API Key should be set in environment variable: ROBOFLOW_API_KEY

// Simple debug visualization without external dependencies

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const CONFIG = {
  TARGET_URL: 'https://www.shinhan.com/hpe/index.jsp#252400000000',
  UNDESIRED_HOSTNAMES: ['wooribank.com', 'www.wooribank.com'],
  HEADLESS: false, // Set to true for production/headless mode
  CHROME_PROFILE: null, // Set to Chrome profile path, e.g., '/Users/username/Library/Application Support/Google/Chrome/Default'
  XPATHS: {
    ID_INPUT: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[6]/div[3]/div[2]/div[1]/div/input',
    PASSWORD_INPUT: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[6]/div[3]/div[2]/div[1]/div/div/input[1]',
    KEYBOARD: '/html/body/div[6]/div[1]',
    SECURITY_POPUP: '//div[@id="wq_uuid_28" and contains(@class, "layerContent")]',
    SECURITY_POPUP_CLOSE: '//a[@id="no_install" and contains(@class, "btnTyGray02")]',
    SECURITY_POPUP_ALT: '//div[contains(@class, "layerContent") and contains(., "보안프로그램")]',
    SECURITY_POPUP_CLOSE_ALT: '//a[contains(text(), "설치하지 않음")]'
  },
  TIMEOUTS: {
    ELEMENT_WAIT: 10000,
    CLICK: 5000,
    FRAME_SEARCH: 3000,
    PASSWORD_WAIT: 30000,
    PAGE_LOAD: 3000,
    SCROLL_WAIT: 500  // Added for scroll animations
  },
  DELAYS: {
    MOUSE_MOVE: 100,
    CLICK: 200,
    SHIFT_ACTIVATE: 200,
    SHIFT_DEACTIVATE: 200,
    KEYBOARD_UPDATE: 500,
    KEYBOARD_RETURN: 300
  },
};

// ============================================================================
// DEBUG FUNCTIONS (moved to ./debug/html-debug-output.js)
// ============================================================================

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Ensures output directory exists
 * @param {string} dirPath - Directory path to ensure exists
 */
function ensureOutputDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log('[SHINHAN] Created output directory:', dirPath);
    }
  } catch (error) {
    console.warn('[SHINHAN] Failed to create output directory:', error);
  }
}

/**
 * Generates timestamp string for filenames
 * @returns {string} Timestamp string
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Gets the default Chrome profile path for the current OS
 * @returns {string|null} Chrome profile path or null if not found
 */
function getDefaultChromeProfilePath() {
  const os = require('os');
  const platform = os.platform();
  
  let profilePath = null;
  
  switch (platform) {
    case 'darwin': // macOS
      profilePath = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
      break;
    case 'win32': // Windows
      profilePath = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
      break;
    case 'linux': // Linux
      profilePath = path.join(os.homedir(), '.config', 'google-chrome', 'Default');
      break;
  }
  
  // Check if profile directory exists
  if (profilePath && fs.existsSync(profilePath)) {
    console.log('[SHINHAN] Found Chrome profile at:', profilePath);
    return profilePath;
  }
  
  console.log('[SHINHAN] Chrome profile not found at expected location');
  return null;
}

/**
 * Builds proxy configuration from URL string
 * @param {string} proxyUrl - Proxy URL string
 * @returns {Object|undefined} Proxy configuration object
 */
function buildProxyOption(proxyUrl) {
    try {
      if (!proxyUrl) return undefined;
      const u = new URL(String(proxyUrl));
      const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
      const proxy = { server };
      if (u.username) proxy.username = decodeURIComponent(u.username);
      if (u.password) proxy.password = decodeURIComponent(u.password);
      return proxy;
    } catch {
      return undefined;
    }
  }

/**
 * Gets element bounding box for any selector/xpath
 * @param {Object} pageOrFrame - Playwright page or frame object
 * @param {string} selector - XPath or CSS selector
 * @returns {Object|null} Bounding box object {x, y, width, height}
 */
async function getElementBox(pageOrFrame, selector) {
  try {
    const locator = pageOrFrame.locator(selector);
    if (await locator.count()) {
      // Ensure element is in viewport first
      await locator.scrollIntoViewIfNeeded();
      await pageOrFrame.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
      
      const handle = await locator.first().elementHandle();
      if (handle) {
        const box = await handle.boundingBox();
        if (box) return { x: box.x, y: box.y, width: box.width, height: box.height };
        // Fallback to DOM API
        const rect = await handle.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        return rect;
      }
    }
  } catch {}
  return null;
}

// ============================================================================
// BROWSER SETUP AND CONFIGURATION
// ============================================================================

/**
 * Sets up browser context with routing and navigation handling
 * @param {Object} context - Playwright browser context
 * @param {string} targetUrl - Target URL to redirect to
 * @param {Object} page - Playwright page object
 */
async function setupBrowserContext(context, targetUrl, page) {
  // Intercept unwanted hostnames
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        const isDocument = request.resourceType() === 'document';
        const url = new URL(request.url());
      if (isDocument && CONFIG.UNDESIRED_HOSTNAMES.includes(url.hostname)) {
          return route.fulfill({ status: 302, headers: { location: targetUrl } });
        }
      } catch {}
      return route.continue();
    });

  // Handle frame navigation
    if (page) {
      page.on('framenavigated', (frame) => {
        try {
          if (frame === page.mainFrame()) {
            const u = new URL(frame.url());
          if (CONFIG.UNDESIRED_HOSTNAMES.includes(u.hostname)) {
              page.goto(targetUrl).catch(() => {});
            }
          }
        } catch {}
      });
    }
}

/**
 * Creates and configures browser instance
 * @param {Object} proxy - Proxy configuration
 * @returns {Promise<Object>} Browser and context objects
 */
async function createBrowser(proxy) {
  // Use explicit profile only if provided. Otherwise, create an isolated temp profile
  const explicitProfilePath = (CONFIG.CHROME_PROFILE && String(CONFIG.CHROME_PROFILE).trim()) ? CONFIG.CHROME_PROFILE : null;

  let persistentProfileDir = explicitProfilePath;

  if (!persistentProfileDir) {
    const os = require('os');
    try {
      const tempPrefix = path.join(os.tmpdir(), 'egdesk-chrome-');
      persistentProfileDir = fs.mkdtempSync(tempPrefix);
      console.log('[SHINHAN] Using temporary Chrome profile directory:', persistentProfileDir);
    } catch (e) {
      console.warn('[SHINHAN] Failed to create temp Chrome profile, falling back to non-persistent context:', e && e.message ? e.message : e);
    }
  }

  if (persistentProfileDir) {
    // Preferred: persistent context with isolated profile to avoid ProcessSingleton conflicts
    const context = await chromium.launchPersistentContext(persistentProfileDir, {
      headless: CONFIG.HEADLESS,
      channel: 'chrome',
      proxy,
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 }
    });
    return { browser: context, context: context };
  }

  // Fallback: non-persistent browser/context
  const browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    channel: 'chrome',
    proxy
  });
  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1280, height: 1024 }
  });
  return { browser, context };
}

// ============================================================================
// SECURITY POPUP HANDLING
// ============================================================================

/**
 * Handles security program installation popup
 * @param {Object} page - Playwright page object
 * @returns {Promise<boolean>} Success status
 */
async function handleSecurityPopup(page) {
  try {
    console.log('[SHINHAN] Checking for security program installation popup...');
    
    // Wait up to 10 seconds for the popup to appear using proper wait conditions
    console.log('[SHINHAN] Waiting up to 10 seconds for security popup to load...');
    
    let popupLocator = null;
    let popupExists = false;
    let iframe = null;
    
    // First, wait a bit for the page to fully load
    await page.waitForTimeout(3000);
    
    // Check for security popup iframe first
    console.log('[SHINHAN] Looking for security popup iframe...');
    try {
      // Wait for iframe with security popup
      const iframeLocator = page.locator('//iframe[contains(@title, "보안프로그램") or contains(@src, "popup.jsp")]');
      await iframeLocator.waitFor({ state: 'visible', timeout: 7000 });
      iframe = await iframeLocator.contentFrame();
      console.log('[SHINHAN] Security popup iframe found, switching context...');
      
      // Debug: Check iframe content
      const iframeTitle = await iframeLocator.getAttribute('title');
      const iframeSrc = await iframeLocator.getAttribute('src');
      console.log(`[SHINHAN] Iframe title: ${iframeTitle}`);
      console.log(`[SHINHAN] Iframe src: ${iframeSrc}`);
    } catch (iframeError) {
      console.log('[SHINHAN] No security popup iframe found, checking main page...');
      
      // Debug: Check what iframes are available
      const allIframes = await page.locator('//iframe').count();
      console.log(`[SHINHAN] Debug: Found ${allIframes} iframes on the page`);
    }
    
    // Try to find popup in iframe or main page
    if (iframe) {
      // Look for popup inside iframe
      try {
        popupLocator = iframe.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP}`);
        await popupLocator.waitFor({ state: 'visible', timeout: 3000 });
        popupExists = true;
        console.log('[SHINHAN] Security popup found in iframe');
      } catch (iframePopupError) {
        console.log('[SHINHAN] Popup not found in iframe, trying alternative selectors...');
        try {
          popupLocator = iframe.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP_ALT}`);
          await popupLocator.waitFor({ state: 'visible', timeout: 2000 });
          popupExists = true;
          console.log('[SHINHAN] Alternative security popup found in iframe');
        } catch (altIframeError) {
          console.log('[SHINHAN] No popup found in iframe either');
        }
      }
    } else {
      // Try to find popup in main page
      try {
        popupLocator = page.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP}`);
        await popupLocator.waitFor({ state: 'visible', timeout: 5000 });
        popupExists = true;
        console.log('[SHINHAN] Primary security popup detected in main page');
      } catch (primaryError) {
        console.log('[SHINHAN] Primary popup selector not found, trying alternative...');
        
        try {
          popupLocator = page.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP_ALT}`);
          await popupLocator.waitFor({ state: 'visible', timeout: 3000 });
          popupExists = true;
          console.log('[SHINHAN] Alternative security popup detected in main page');
        } catch (altError) {
          console.log('[SHINHAN] No security popup detected in main page');
        }
      }
    }
    
    if (!popupExists) {
      console.log('[SHINHAN] No security popup detected after checking iframe and main page');
      return true;
    }
    
    if (!popupExists) {
      console.log('[SHINHAN] No security popup detected');
      return true;
    }
    
    console.log('[SHINHAN] Security popup detected, attempting to close...');
    
    // Determine which context to use (iframe or main page)
    const context = iframe || page;
    console.log(`[SHINHAN] Using ${iframe ? 'iframe' : 'main page'} context for popup interaction`);
    
    // Check if popup is visible, if not try to make it visible
    const isVisible = await popupLocator.isVisible();
    if (!isVisible) {
      console.log('[SHINHAN] Popup is hidden, trying to make it visible...');
      // Try clicking on the context to trigger the popup
      await context.click('body', { position: { x: 100, y: 100 } });
      await page.waitForTimeout(1000);
    }
    
    // Wait for the popup to be visible (with shorter timeout)
    try {
      await popupLocator.waitFor({ state: 'visible', timeout: 3000 });
    } catch (visibilityError) {
      console.log('[SHINHAN] Popup still not visible, proceeding with close attempt anyway...');
    }
    
    // Try primary close button selector first (in the correct context)
    let closeButtonLocator = context.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP_CLOSE}`);
    let closeButtonExists = await closeButtonLocator.count() > 0;
    
    // If primary close button doesn't work, try alternative
    if (!closeButtonExists) {
      console.log('[SHINHAN] Primary close button not found, trying alternative...');
      closeButtonLocator = context.locator(`xpath=${CONFIG.XPATHS.SECURITY_POPUP_CLOSE_ALT}`);
      closeButtonExists = await closeButtonLocator.count() > 0;
    }
    
    if (closeButtonExists) {
      console.log('[SHINHAN] Found "Don\'t install" button, clicking...');
      try {
        // Try to click even if not visible
        await closeButtonLocator.click({ timeout: CONFIG.TIMEOUTS.CLICK, force: true });
        await page.waitForTimeout(1000); // Wait for popup to close
        console.log('[SHINHAN] Security popup closed successfully');
        return true;
      } catch (clickError) {
        console.log('[SHINHAN] Failed to click close button, trying alternative methods...');
        // Try JavaScript click as fallback
        try {
          await closeButtonLocator.evaluate(button => button.click());
          await page.waitForTimeout(1000);
          console.log('[SHINHAN] Security popup closed with JavaScript click');
          return true;
        } catch (jsClickError) {
          console.log('[SHINHAN] JavaScript click also failed, trying other methods...');
        }
      }
    } else {
      console.log('[SHINHAN] "Don\'t install" button not found, trying alternative methods...');
      
      // Try to find any close button within the popup (using correct context)
      const anyCloseButton = popupLocator.locator('//a[contains(text(), "설치하지 않음") or contains(@class, "btnTyGray02") or contains(@id, "no_install")]');
      const anyCloseExists = await anyCloseButton.count() > 0;
      
      if (anyCloseExists) {
        console.log('[SHINHAN] Found close button within popup, clicking...');
        try {
          await anyCloseButton.click({ force: true });
          await page.waitForTimeout(1000);
          console.log('[SHINHAN] Security popup closed with popup-internal button');
          return true;
        } catch (internalClickError) {
          console.log('[SHINHAN] Failed to click internal close button, trying JavaScript...');
          try {
            await anyCloseButton.evaluate(button => button.click());
            await page.waitForTimeout(1000);
            console.log('[SHINHAN] Security popup closed with JavaScript internal click');
            return true;
          } catch (jsInternalError) {
            console.log('[SHINHAN] JavaScript internal click also failed...');
          }
        }
      }
      
      // Try pressing Escape key as alternative
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      
      // Check if popup is still visible
      const stillVisible = await popupLocator.isVisible();
      if (!stillVisible) {
        console.log('[SHINHAN] Security popup closed with Escape key');
        return true;
      }
      
      // Try clicking outside the popup as last resort
      console.log('[SHINHAN] Trying to click outside popup to close it...');
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(1000);
      
      const finalCheck = await popupLocator.isVisible();
      if (!finalCheck) {
        console.log('[SHINHAN] Security popup closed by clicking outside');
        return true;
      }
      
      console.warn('[SHINHAN] Could not close security popup, continuing anyway...');
      return false;
    }
  } catch (error) {
    console.warn('[SHINHAN] Failed to handle security popup:', error);
    return false;
  }
}

// ============================================================================
// INPUT FIELD HANDLING
// ============================================================================

/**
 * Fills input field with fallback to frames
 * @param {Object} page - Playwright page object
 * @param {string} xpath - XPath selector
 * @param {string} value - Value to fill
 * @param {string} fieldName - Field name for logging
 * @returns {Promise<boolean>} Success status
 */
async function fillInputField(page, xpath, value, fieldName) {
  try {
    console.log(`[SHINHAN] Attempting to fill ${fieldName} input field...`);
    await page.waitForSelector(`xpath=${xpath}`, { timeout: CONFIG.TIMEOUTS.ELEMENT_WAIT });
    const locator = page.locator(`xpath=${xpath}`);
    
    // Scroll into view first
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
    
    await locator.click({ timeout: CONFIG.TIMEOUTS.CLICK }).catch(() => {});
    await locator.fill(value).catch(async () => {
      await locator.type(value).catch(() => {});
    });
    console.log(`[SHINHAN] Successfully filled ${fieldName} input field with:`, value);
    return true;
  } catch (error) {
    console.warn(`[SHINHAN] Failed to fill ${fieldName} input field:`, error);
    
    // Fallback: search in frames
      try {
        const frames = page.frames();
      for (const frame of frames) {
          try {
          const handle = await frame.waitForSelector(`xpath=${xpath}`, { timeout: CONFIG.TIMEOUTS.FRAME_SEARCH });
            if (handle) {
            await handle.click({ timeout: CONFIG.TIMEOUTS.FRAME_SEARCH }).catch(() => {});
              try {
              await handle.fill(value);
              console.log(`[SHINHAN] Successfully filled ${fieldName} input field in frame with:`, value);
              return true;
              } catch {
              await handle.type(value).catch(() => {});
              return true;
            }
        }
      } catch {}
      }
    } catch {}
    return false;
  }
}

// ============================================================================
// PASSWORD TYPING WITH JSON
// ============================================================================

/**
 * Presses or unpresses the shift key
 * @param {Object} page - Playwright page object
 * @param {Object} shiftKey - Shift key info from keyboard JSON
 * @param {boolean} activate - True to activate shift, false to deactivate
 * @returns {Promise<boolean>} Success status
 */
async function toggleShiftKey(page, shiftKey, activate) {
  try {
    if (!shiftKey || !shiftKey.position) {
      console.warn('[SHINHAN] Cannot toggle shift - shift key info missing');
      return false;
    }
    
    const action = activate ? 'Activating' : 'Deactivating';
    console.log(`[SHINHAN] ${action} shift key at (${shiftKey.position.x}, ${shiftKey.position.y})`);
    
    // Move to shift key position
    await page.mouse.move(shiftKey.position.x, shiftKey.position.y);
    await page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
    
    // Click shift key
    await page.mouse.click(shiftKey.position.x, shiftKey.position.y);
    
    // Wait appropriate time based on action
    const delay = activate ? CONFIG.DELAYS.SHIFT_ACTIVATE : CONFIG.DELAYS.SHIFT_DEACTIVATE;
    await page.waitForTimeout(delay);
    
    console.log(`[SHINHAN] Shift ${activate ? 'activated' : 'deactivated'} successfully`);
    return true;
  } catch (error) {
    console.error(`[SHINHAN] Failed to toggle shift key:`, error.message);
    return false;
  }
}

/**
 * Presses the shift key (convenience wrapper)
 * @param {Object} page - Playwright page object
 * @param {Object} shiftKey - Shift key info from keyboard JSON
 * @returns {Promise<boolean>} Success status
 */
async function pressShiftKey(page, shiftKey) {
  return await toggleShiftKey(page, shiftKey, true);
}

/**
 * Unpresses the shift key (convenience wrapper)
 * @param {Object} page - Playwright page object
 * @param {Object} shiftKey - Shift key info from keyboard JSON
 * @returns {Promise<boolean>} Success status
 */
async function unpressShiftKey(page, shiftKey) {
  return await toggleShiftKey(page, shiftKey, false);
}

/**
 * Types password using bilingual keyboard JSON with shift support
 * @param {Object} keyboardJSON - Bilingual keyboard JSON structure
 * @param {string} password - Password to type
 * @param {Object} page - Playwright page object
 * @returns {Promise<Object>} Result with success status and details
 */
async function typePasswordWithJSON(keyboardJSON, password, page) {
  try {
    console.log('\n[SHINHAN] ===== TYPING PASSWORD WITH JSON =====');
    console.log(`[SHINHAN] Password length: ${password.length} characters`);
    console.log(`[SHINHAN] Available characters in JSON: ${Object.keys(keyboardJSON.characterMap).length}`);
    console.log(`[SHINHAN] Shift key available: ${keyboardJSON.shiftKey ? 'Yes' : 'No'}`);
    
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
      
      // Try to find the character in the character map (exact match first)
      let keyInfo = keyboardJSON.characterMap[char];
      
      if (!keyInfo) {
        console.warn(`[SHINHAN] [${i + 1}/${password.length}] Character '${char}' not found in keyboard JSON`);
        results.failedChars.push({ index: i, char, reason: 'not_found' });
        results.details.push({
          index: i,
          char,
          success: false,
          reason: 'Character not found in keyboard mapping'
        });
        continue;
      }
      
      const needsShift = keyInfo.requiresShift || false;
      console.log(`[SHINHAN] [${i + 1}/${password.length}] Typing '${char}' (type: ${keyInfo.type}, requiresShift: ${needsShift})`);
      
      try {
        // Handle shift key state
        if (needsShift && !shiftActive) {
          // Need to activate shift
          if (keyboardJSON.shiftKey) {
            console.log(`[SHINHAN] Activating shift for '${char}'`);
            const success = await pressShiftKey(page, keyboardJSON.shiftKey);
            if (success) {
              shiftActive = true;
              results.shiftClicks++;
            }
          } else {
            console.warn(`[SHINHAN] Shift required but shift key not found in JSON`);
          }
        } else if (!needsShift && shiftActive) {
          // Need to deactivate shift
          console.log(`[SHINHAN] Deactivating shift before '${char}'`);
          const success = await unpressShiftKey(page, keyboardJSON.shiftKey);
          if (success) {
            shiftActive = false;
            results.shiftClicks++;
          }
        }
        
        // Click the character key
        await page.mouse.move(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
        await page.mouse.click(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(CONFIG.DELAYS.CLICK);
        
        console.log(`[SHINHAN] Successfully clicked '${char}' at (${keyInfo.position.x}, ${keyInfo.position.y})`);
        
        results.typedChars++;
        results.details.push({
          index: i,
          char,
          success: true,
          position: keyInfo.position,
          keyLabel: keyInfo.label,
          type: keyInfo.type,
          usedShift: needsShift
        });
        
      } catch (clickError) {
        console.error(`[SHINHAN] Failed to click '${char}':`, clickError.message);
        results.failedChars.push({ index: i, char, reason: clickError.message });
        results.details.push({
          index: i,
          char,
          success: false,
          reason: clickError.message
        });
      }
    }
    
    // Deactivate shift if it's still active at the end
    if (shiftActive && keyboardJSON.shiftKey) {
      console.log('[SHINHAN] Deactivating shift at end of password');
      const success = await unpressShiftKey(page, keyboardJSON.shiftKey);
      if (success) {
        results.shiftClicks++;
      }
    }
    
    // Summary
    console.log('\n[SHINHAN] ===== PASSWORD TYPING SUMMARY =====');
    console.log(`[SHINHAN] Total characters: ${results.totalChars}`);
    console.log(`[SHINHAN] Successfully typed: ${results.typedChars}`);
    console.log(`[SHINHAN] Shift clicks: ${results.shiftClicks}`);
    console.log(`[SHINHAN] Failed: ${results.failedChars.length}`);
    
    if (results.failedChars.length > 0) {
      console.warn('[SHINHAN] Failed characters:', results.failedChars.map(f => f.char).join(', '));
      results.success = false;
    }
    
    return results;
    
  } catch (error) {
    console.error('[SHINHAN] Error typing password with JSON:', error);
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

// ============================================================================
// MAIN AUTOMATION FUNCTION
// ============================================================================

/**
 * Main Shinhan Bank automation function
 * @param {string} username - Username (not used in current implementation)
 * @param {string} password - Password to type
 * @param {string} id - User ID to fill
 * @param {string} proxyUrl - Proxy URL
 * @returns {Promise<Object>} Automation result
 */
async function runShinhanAutomation(username, password, id, proxyUrl) {
  const proxy = buildProxyOption(proxyUrl);
  let browser = null;
  
  try {
    // Create browser and context
    const { browser: browserInstance, context } = await createBrowser(proxy);
    browser = browserInstance;
    
    // Setup context routing
    await setupBrowserContext(context, CONFIG.TARGET_URL, null);
    
    const page = await context.newPage();
    await setupBrowserContext(context, CONFIG.TARGET_URL, page);
    
    // Navigate to target URL
    await page.goto(CONFIG.TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(CONFIG.TIMEOUTS.PAGE_LOAD);
    
    // Handle security program installation popup first
    console.log('[SHINHAN] Checking for security popup before proceeding...');
    await handleSecurityPopup(page);
    
    // Wait a bit more for any remaining popups to settle
    await page.waitForTimeout(2000);
    
    // Fill input fields
    await fillInputField(page, CONFIG.XPATHS.ID_INPUT, id, 'Sinhan ID');
    await fillInputField(page, CONFIG.XPATHS.PASSWORD_INPUT, password, 'Sinhan Password');
    
    // Handle keyboard screenshot and AI analysis
    let screenshotPath = null;
    let keyboardAnalysisResult = null;
    
    try {
      const keyboardLocator = page.locator(`xpath=${CONFIG.XPATHS.KEYBOARD}`);
      if (await keyboardLocator.count()) {
        
        const keyboardBox = await getElementBox(page, `xpath=${CONFIG.XPATHS.KEYBOARD}`);
        console.log('[SHINHAN] Keyboard element bounds after scroll:', keyboardBox);
        
        // Ensure output directory exists
        const outputDir = path.join(process.cwd(), 'output');
        ensureOutputDirectory(outputDir);
        
        const timestamp = generateTimestamp();
        const filename = `sinhan-keyboard-${timestamp}.png`;
        screenshotPath = path.join(outputDir, filename);
        
        // Take screenshot of the keyboard element
        await keyboardLocator.screenshot({ path: screenshotPath });
        console.log('[SHINHAN] Screenshot saved to:', screenshotPath);
        
        // Get Roboflow API key from environment
        const roboflowApiKey = process.env.ROBOFLOW_API_KEY;
        
        // Use AI to analyze the keyboard (but don't type yet - we'll use JSON for typing)
        if (roboflowApiKey && screenshotPath) {
          console.log('[SHINHAN] Starting AI keyboard analysis with Roboflow...');
          try {
            // Pass null for password and page to only analyze, not type
            // But pass page with options to enable shift keyboard capture
            keyboardAnalysisResult = await analyzeKeyboardAndType(
              screenshotPath,
              roboflowApiKey,
              keyboardBox,
              null,  // Don't pass password to prevent typing
              page,  // Pass page for shift keyboard capture
              {      // Options for shift keyboard capture
                keyboardXPath: CONFIG.XPATHS.KEYBOARD,
                outputDir: outputDir
              }
            );
            
            if (keyboardAnalysisResult.success) {
              console.log('[SHINHAN] AI keyboard analysis completed successfully');
              console.log('[SHINHAN] Processed', keyboardAnalysisResult.processed, 'keyboard keys');
              
              // Generate HTML visualization
              try {
                const visualizationFilename = `keyboard-visualization-${timestamp}.html`;
                const visualizationPath = path.join(outputDir, visualizationFilename);
                
                generateKeyboardVisualization({
                  screenshotPath: screenshotPath,
                  keyboardBox: keyboardBox,
                  keyboardKeys: keyboardAnalysisResult.keyboardKeys,
                  segmentationResults: keyboardAnalysisResult.segmentationResults,
                  password: password,
                  outputPath: visualizationPath
                });
                
                console.log('[SHINHAN] HTML visualization saved to:', visualizationPath);
                
                // Build and export bilingual keyboard JSON
                try {
                  // Process shifted keyboard if it was captured
                  let shiftedKeyboardKeys = null;
                  if (keyboardAnalysisResult.shiftedKeyboard && keyboardAnalysisResult.shiftedKeyboard.success) {
                    console.log('[SHINHAN] Analyzing shifted keyboard screenshot...');
                    const shiftedScreenshotPath = keyboardAnalysisResult.shiftedKeyboard.screenshotPath;
                    
                    // Analyze shifted keyboard with AI
                    const shiftedAnalysisResult = await analyzeKeyboardAndType(
                      shiftedScreenshotPath,
                      roboflowApiKey,
                      keyboardBox,
                      null,  // Don't type
                      null,  // Don't pass page to avoid another shift capture
                      {}     // Empty options
                    );
                    
                    if (shiftedAnalysisResult.success) {
                      shiftedKeyboardKeys = shiftedAnalysisResult.keyboardKeys;
                      console.log('[SHINHAN] Shifted keyboard analyzed successfully');
                      console.log('[SHINHAN] Shifted keyboard has', Object.keys(shiftedKeyboardKeys).length, 'keys');
                    } else {
                      console.warn('[SHINHAN] Failed to analyze shifted keyboard:', shiftedAnalysisResult.error);
                    }
                  }
                  
                  // Build keyboard JSON with both normal and shifted layouts
                  const keyboardJSON = buildBilingualKeyboardJSON(
                    keyboardAnalysisResult.keyboardKeys,
                    shiftedKeyboardKeys
                  );
                  
                  const jsonFilename = `keyboard-layout-${timestamp}.json`;
                  const jsonPath = path.join(outputDir, jsonFilename);
                  exportKeyboardJSON(
                    keyboardAnalysisResult.keyboardKeys,
                    jsonPath,
                    shiftedKeyboardKeys
                  );
                  
                  console.log('[SHINHAN] Keyboard JSON exported to:', jsonPath);
                  console.log('[SHINHAN] JSON contains', keyboardJSON.metadata.totalKeys, 'keys');
                  console.log('[SHINHAN] Character map has', Object.keys(keyboardJSON.characterMap).length, 'characters');
                  console.log('[SHINHAN] Shift required for', keyboardJSON.metadata.shiftRequiredKeys, 'characters');
                  
                  // Use JSON to type the password
                  console.log('\n[SHINHAN] Using keyboard JSON to type password...');
                  const typingResult = await typePasswordWithJSON(keyboardJSON, password, page);
                  
                  if (typingResult.success) {
                    console.log('[SHINHAN] Successfully typed password using JSON!');
                    console.log(`[SHINHAN] Typed ${typingResult.typedChars}/${typingResult.totalChars} characters`);
                  } else {
                    console.warn('[SHINHAN] Password typing completed with errors');
                    console.warn(`[SHINHAN] Typed ${typingResult.typedChars}/${typingResult.totalChars} characters`);
                    console.warn('[SHINHAN] Failed characters:', typingResult.failedChars.map(f => `'${f.char}'`).join(', '));
                  }
                  
                  // Store typing result
                  keyboardAnalysisResult.typingResult = typingResult;
                  ``
                } catch (jsonError) {
                  console.warn('[SHINHAN] Failed to export keyboard JSON or type password:', jsonError);
                }
              } catch (vizError) {
                console.warn('[SHINHAN] Failed to generate HTML visualization:', vizError);
              }
            } else {
              console.warn('[SHINHAN] AI keyboard analysis failed:', keyboardAnalysisResult.error);
            }
          } catch (aiError) {
            console.warn('[SHINHAN] AI keyboard analysis error:', aiError);
          }
        } else {
          if (!roboflowApiKey) {
            console.warn('[SHINHAN] Skipping AI analysis - ROBOFLOW_API_KEY environment variable not set');
          } else {
            console.log('[SHINHAN] Skipping AI analysis - no screenshot available');
          }
        }
        }
    } catch (error) {
      console.warn('[SHINHAN] Failed to take screenshot of Sinhan keyboard:', error);
    }
    
    return { 
      success: true, 
      boxes: null, 
      clickedPoint: null, 
      screenshotPath,
      keyboardAnalysis: keyboardAnalysisResult
    };
    
  } finally {
    console.log('[SHINHAN] Keeping browser open for debugging... Press Ctrl+C to close');
    // Keep browser open indefinitely for debugging
    return;
    // await browser.close();
  }
}

module.exports = { 
  runShinhanAutomation,
  toggleShiftKey,
  pressShiftKey,
  unpressShiftKey,
  typePasswordWithJSON
};