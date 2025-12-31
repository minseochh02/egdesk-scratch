const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeKeyboardAndType } = require('./ai-keyboard-analyzer');
const { generateKeyboardVisualization } = require('./keyboard-visualization');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('./bilingual-keyboard-parser');
const { getStore } = require('../storage');


// Gemini 3 Vision API for keyboard detection
// API Key can be set via:
// 1. Environment variable: GEMINI_API_KEY
// 2. Debug panel / AI Keys Manager (stored in electron-store)

/**
 * Gets the Gemini API key from environment or electron-store
 * Uses the same pattern as other parts of the codebase (ai-search.ts, gemini/index.ts)
 * @returns {string|null} API key or null if not found
 */
function getGeminiApiKey() {
  // Try environment variable first
  if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
    console.log('[SHINHAN] Using Gemini API key from environment variable');
    return process.env.GEMINI_API_KEY.trim();
  }
  
  // Try electron-store via getStore helper (same pattern as gemini/index.ts)
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[SHINHAN] Store not available');
      return null;
    }
    
    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[SHINHAN] AI keys not found or not an array');
      return null;
    }
    
    // Find preferred key: egdesk > active > any google key (same logic as gemini/index.ts)
    const preferred =
      aiKeys.find(k => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find(k => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find(k => k?.providerId === 'google' && k?.fields?.apiKey);
    
    if (preferred) {
      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const keyPreview = `${apiKey.trim().substring(0, 8)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`;
        console.log('[SHINHAN] Using Gemini API key from AI Keys Manager:', preferred.name || 'unnamed', '- Key:', keyPreview);
        return apiKey.trim();
      }
    }
    
    console.warn('[SHINHAN] No Google API key found in AI Keys Manager');
  } catch (error) {
    console.warn('[SHINHAN] Failed to get API key from store:', error.message);
  }
  
  return null;
}

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
    // Transkey virtual keyboard - LOWER keyboard (default, lowercase letters)
    KEYBOARD_LOWER: '//div[@id="비밀번호_layoutLower"]',
    KEYBOARD_LOWER_ALT: '//div[contains(@id, "_layoutLower") and contains(@class, "transkey_lower")]',
    KEYBOARD_LOWER_CLASS: '//div[contains(@class, "transkey_lower")]',
    // Transkey virtual keyboard - UPPER keyboard (after pressing shift, uppercase letters)
    KEYBOARD_UPPER: '//div[@id="비밀번호_layoutUpper"]',
    KEYBOARD_UPPER_ALT: '//div[contains(@id, "_layoutUpper") and contains(@class, "transkey_upper")]',
    KEYBOARD_UPPER_CLASS: '//div[contains(@class, "transkey_upper")]',
    SECURITY_POPUP: '//div[@id="wq_uuid_28" and contains(@class, "layerContent")]',
    SECURITY_POPUP_CLOSE: '//a[@id="no_install" and contains(@class, "btnTyGray02")]',
    SECURITY_POPUP_ALT: '//div[contains(@class, "layerContent") and contains(., "보안프로그램")]',
    SECURITY_POPUP_CLOSE_ALT: '//a[contains(text(), "설치하지 않음")]',
    LOGIN_BUTTON: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[6]/div[3]/div[2]/div[1]/div/a',
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
  const explicitProfilePath = (CONFIG.CHROME_PROFILE && String(CONFIG.CHROME_PROFILE).trim()) ? CONFIG.CHROME_PROFILE : null;

  let persistentProfileDir = explicitProfilePath;

  if (!persistentProfileDir) {
    const os = require('os');
    try {
      const tempPrefix = path.join(os.tmpdir(), 'egdesk-chrome-');
      persistentProfileDir = fs.mkdtempSync(tempPrefix);
      console.log('[SHINHAN] Using temporary Chrome profile directory:', persistentProfileDir);
    } catch (e) {
      console.warn('[SHINHAN] Failed to create temp Chrome profile:', e?.message || e);
    }
  }

  if (persistentProfileDir) {
    const context = await chromium.launchPersistentContext(persistentProfileDir, {
      headless: CONFIG.HEADLESS,
      channel: 'chrome',
      proxy,
      locale: 'ko-KR',
      viewport: { width: 1280, height: 1024 },
      // Grant permissions including local network access
      permissions: ['clipboard-read', 'clipboard-write'],
      // Chrome flags to allow local network access and disable security prompts
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        // This flag helps with local network access in enterprise environments
        '--disable-features=PrivateNetworkAccessSendPreflights',
        '--disable-features=PrivateNetworkAccessRespectPreflightResults',
      ]
    });
    return { browser: context, context: context };
  }

  // Fallback non-persistent context
  const browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    channel: 'chrome',
    proxy,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-features=PrivateNetworkAccessSendPreflights',
      '--disable-features=PrivateNetworkAccessRespectPreflightResults',
    ]
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

/**
 * Clicks the login (로그인) button on Shinhan Bank
 * @param {Object} page - Playwright page object
 * @returns {Promise<boolean>} Success status
 */
async function clickLoginButton(page) {
  const LOGIN_BUTTON_XPATH = CONFIG.XPATHS.LOGIN_BUTTON;
  
  try {
    console.log('[SHINHAN] Attempting to click 로그인 button...');
    
    const loginLocator = page.locator(`xpath=${LOGIN_BUTTON_XPATH}`);
    
    // Wait for the button to be visible
    await loginLocator.waitFor({ state: 'visible', timeout: 10000 });
    
    // Scroll into view if needed
    await loginLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // Click the button
    await loginLocator.click({ timeout: 5000 });
    
    console.log('[SHINHAN] Successfully clicked 로그인 button');
    return true;
    
  } catch (error) {
    console.error('[SHINHAN] Failed to click 로그인 button:', error.message);
    
    // Fallback: try force click
    try {
      console.log('[SHINHAN] Trying force click...');
      const loginLocator = page.locator(`xpath=${LOGIN_BUTTON_XPATH}`);
      await loginLocator.click({ force: true, timeout: 5000 });
      console.log('[SHINHAN] Force click succeeded');
      return true;
    } catch (forceError) {
      console.error('[SHINHAN] Force click also failed:', forceError.message);
    }
    
    // Fallback: JavaScript click
    try {
      console.log('[SHINHAN] Trying JavaScript click...');
      await page.evaluate((xpath) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue;
        if (element) {
          element.click();
          return true;
        }
        throw new Error('Element not found');
      }, LOGIN_BUTTON_XPATH);
      console.log('[SHINHAN] JavaScript click succeeded');
      return true;
    } catch (jsError) {
      console.error('[SHINHAN] JavaScript click also failed:', jsError.message);
    }
    
    return false;
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
    
    // Step 1: Fill only the ID field (can be filled directly)
    await fillInputField(page, CONFIG.XPATHS.ID_INPUT, id, 'Sinhan ID');
    
    // Step 2: Click on password field to trigger virtual keyboard
    console.log('[SHINHAN] Clicking on password field to trigger virtual keyboard...');
    try {
      const passwordLocator = page.locator(`xpath=${CONFIG.XPATHS.PASSWORD_INPUT}`);
      await passwordLocator.click({ timeout: CONFIG.TIMEOUTS.CLICK });
      await page.waitForTimeout(1000); // Wait for keyboard to appear
      console.log('[SHINHAN] Password field clicked, waiting for virtual keyboard...');
    } catch (pwClickError) {
      console.warn('[SHINHAN] Failed to click password field:', pwClickError.message);
    }
    
    // Handle keyboard screenshot and AI analysis
    let lowerScreenshotPath = null;
    let upperScreenshotPath = null;
    let keyboardAnalysisResult = null;
    
    try {
      // Step 3: Find the LOWER keyboard first (default state)
      const lowerKeyboardSelectors = [
        CONFIG.XPATHS.KEYBOARD_LOWER,
        CONFIG.XPATHS.KEYBOARD_LOWER_ALT,
        CONFIG.XPATHS.KEYBOARD_LOWER_CLASS
      ].filter(Boolean);
      
      let lowerKeyboardLocator = null;
      let lowerUsedSelector = null;
      
      console.log('[SHINHAN] Looking for LOWER keyboard (default state)...');
      for (const selector of lowerKeyboardSelectors) {
        console.log(`[SHINHAN] Trying LOWER keyboard selector: ${selector}`);
        const locator = page.locator(`xpath=${selector}`);
        const count = await locator.count();
        console.log(`[SHINHAN] Found ${count} elements with selector: ${selector}`);
        
        if (count > 0) {
          // Check if element is visible (has display: block)
          const isVisible = await locator.first().isVisible().catch(() => false);
          console.log(`[SHINHAN] LOWER keyboard visibility: ${isVisible}`);
          
          if (isVisible) {
            lowerKeyboardLocator = locator.first();
            lowerUsedSelector = selector;
            console.log(`[SHINHAN] Found visible LOWER keyboard: ${selector}`);
            break;
          }
        }
      }
      
      if (!lowerKeyboardLocator) {
        console.warn('[SHINHAN] LOWER keyboard not found or not visible');
        console.warn('[SHINHAN] Make sure password field is clicked and keyboard is showing');
        throw new Error('LOWER keyboard not found');
      }
      
      const lowerKeyboardBox = await getElementBox(page, `xpath=${lowerUsedSelector}`);
      console.log('[SHINHAN] LOWER keyboard bounds:', lowerKeyboardBox);
        
        // Ensure output directory exists
        const outputDir = path.join(process.cwd(), 'output');
        ensureOutputDirectory(outputDir);
        
        const timestamp = generateTimestamp();
      
      // Step 4: Screenshot the LOWER keyboard
      const lowerFilename = `sinhan-keyboard-LOWER-${timestamp}.png`;
      lowerScreenshotPath = path.join(outputDir, lowerFilename);
      
      await lowerKeyboardLocator.screenshot({ path: lowerScreenshotPath });
      console.log('[SHINHAN] LOWER keyboard screenshot saved to:', lowerScreenshotPath);
      
      // Get Gemini API key
      const geminiApiKey = getGeminiApiKey();
      
      if (!geminiApiKey) {
        console.warn('[SHINHAN] Skipping AI analysis - GEMINI_API_KEY not set');
        throw new Error('Gemini API key not found');
      }
      
      // Step 5: Analyze LOWER keyboard with Gemini 3
      console.log('[SHINHAN] Analyzing LOWER keyboard with Gemini 3...');
      const lowerAnalysisResult = await analyzeKeyboardAndType(
        lowerScreenshotPath,
        geminiApiKey,
        lowerKeyboardBox,
        null,  // Don't type yet
        null,  // Don't pass page yet
        {}
      );
      
      if (!lowerAnalysisResult.success) {
        console.warn('[SHINHAN] LOWER keyboard analysis failed:', lowerAnalysisResult.error);
        throw new Error('LOWER keyboard analysis failed');
      }
      
      console.log('[SHINHAN] LOWER keyboard analysis completed, found', lowerAnalysisResult.processed, 'keys');
      
      // Step 6: Find the SHIFT key in the lower keyboard
      const shiftKey = Object.entries(lowerAnalysisResult.keyboardKeys).find(([label, data]) => {
        const labelLower = label.toLowerCase();
        return labelLower.includes('shift');
      });
      
      if (!shiftKey) {
        console.warn('[SHINHAN] SHIFT key not found in LOWER keyboard');
        throw new Error('SHIFT key not found');
      }
      
      const [shiftLabel, shiftData] = shiftKey;
      console.log(`[SHINHAN] Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);
      
      // Step 7: Click SHIFT to switch to UPPER keyboard
      console.log('[SHINHAN] Clicking SHIFT to switch to UPPER keyboard...');
      await page.mouse.move(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
      await page.mouse.click(shiftData.position.x, shiftData.position.y);
      await page.waitForTimeout(CONFIG.DELAYS.KEYBOARD_UPDATE);
      
      // Step 8: Find and screenshot the UPPER keyboard
      const upperKeyboardSelectors = [
        CONFIG.XPATHS.KEYBOARD_UPPER,
        CONFIG.XPATHS.KEYBOARD_UPPER_ALT,
        CONFIG.XPATHS.KEYBOARD_UPPER_CLASS
      ].filter(Boolean);
      
      let upperKeyboardLocator = null;
      let upperUsedSelector = null;
      
      console.log('[SHINHAN] Looking for UPPER keyboard...');
      for (const selector of upperKeyboardSelectors) {
        const locator = page.locator(`xpath=${selector}`);
        const count = await locator.count();
        if (count > 0) {
          const isVisible = await locator.first().isVisible().catch(() => false);
          if (isVisible) {
            upperKeyboardLocator = locator.first();
            upperUsedSelector = selector;
            console.log(`[SHINHAN] Found visible UPPER keyboard: ${selector}`);
            break;
          }
        }
      }
      
      let upperAnalysisResult = null;
      if (upperKeyboardLocator) {
        const upperKeyboardBox = await getElementBox(page, `xpath=${upperUsedSelector}`);
        console.log('[SHINHAN] UPPER keyboard bounds:', upperKeyboardBox);
        
        const upperFilename = `sinhan-keyboard-UPPER-${timestamp}.png`;
        upperScreenshotPath = path.join(outputDir, upperFilename);
        
        await upperKeyboardLocator.screenshot({ path: upperScreenshotPath });
        console.log('[SHINHAN] UPPER keyboard screenshot saved to:', upperScreenshotPath);
        
        // Step 9: Analyze UPPER keyboard with Gemini 3
        console.log('[SHINHAN] Analyzing UPPER keyboard with Gemini 3...');
        upperAnalysisResult = await analyzeKeyboardAndType(
          upperScreenshotPath,
          geminiApiKey,
          upperKeyboardBox,
          null,
          null,
          {}
        );
        
        if (upperAnalysisResult.success) {
          console.log('[SHINHAN] UPPER keyboard analysis completed, found', upperAnalysisResult.processed, 'keys');
                    } else {
          console.warn('[SHINHAN] UPPER keyboard analysis failed:', upperAnalysisResult.error);
        }
        
        // Click SHIFT again to return to LOWER state
        console.log('[SHINHAN] Clicking SHIFT to return to LOWER keyboard...');
        await page.mouse.click(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(CONFIG.DELAYS.KEYBOARD_UPDATE);
      } else {
        console.warn('[SHINHAN] UPPER keyboard not found, continuing with LOWER only');
      }
      
      // Step 10: Build combined keyboard map and type password
      console.log('[SHINHAN] Building keyboard map and typing password...');
      
      try {
        // Build bilingual keyboard JSON with both LOWER and UPPER
                  const keyboardJSON = buildBilingualKeyboardJSON(
          lowerAnalysisResult.keyboardKeys,
          upperAnalysisResult?.keyboardKeys || null
                  );
                  
        // Export for debugging
                  const jsonFilename = `keyboard-layout-${timestamp}.json`;
                  const jsonPath = path.join(outputDir, jsonFilename);
                  exportKeyboardJSON(
          lowerAnalysisResult.keyboardKeys,
                    jsonPath,
          upperAnalysisResult?.keyboardKeys || null
                  );
                  console.log('[SHINHAN] Keyboard JSON exported to:', jsonPath);
                  
        // Step 11: Type the password using the virtual keyboard
        console.log(`[SHINHAN] Typing password (${password.length} characters) using virtual keyboard...`);
                  const typingResult = await typePasswordWithJSON(keyboardJSON, password, page);
                  
                  if (typingResult.success) {
                    console.log('[SHINHAN] Successfully typed password using virtual keyboard!');
                    console.log(`[SHINHAN] Typed ${typingResult.typedChars}/${typingResult.totalChars} characters`);

                    // After typing password, click login button
                    console.log('[SHINHAN] Password typed, clicking login button...');
                    await page.waitForTimeout(500); // Small delay before clicking login

                    const loginSuccess = await clickLoginButton(page);

                    if (loginSuccess) {
                      console.log('[SHINHAN] Login button clicked, waiting for response...');
                      await page.waitForTimeout(3000); // Wait for login to process
                    } else {
                      console.warn('[SHINHAN] Could not click login button');
                    }
                  } else {
                    console.warn('[SHINHAN] Password typing completed with errors');
                    console.warn(`[SHINHAN] Typed ${typingResult.typedChars}/${typingResult.totalChars} characters`);
          if (typingResult.failedChars.length > 0) {
                    console.warn('[SHINHAN] Failed characters:', typingResult.failedChars.map(f => `'${f.char}'`).join(', '));
                  }
        }
        
        keyboardAnalysisResult = {
          success: true,
          lowerKeyboard: lowerAnalysisResult,
          upperKeyboard: upperAnalysisResult,
          typingResult: typingResult
        };
              
              // Generate HTML visualization
              try {
                const visualizationFilename = `keyboard-visualization-${timestamp}.html`;
                const visualizationPath = path.join(outputDir, visualizationFilename);
                
                generateKeyboardVisualization({
            screenshotPath: lowerScreenshotPath,
            keyboardBox: lowerKeyboardBox,
            keyboardKeys: lowerAnalysisResult.keyboardKeys,
            segmentationResults: lowerAnalysisResult.segmentationResults,
                  password: password,
                  outputPath: visualizationPath
                });
                
          console.log('[SHINHAN] HTML visualization saved to:', visualizationPath);
              } catch (vizError) {
                console.warn('[SHINHAN] Failed to generate HTML visualization:', vizError);
              }
      } catch (jsonError) {
        console.warn('[SHINHAN] Failed to build keyboard JSON or type password:', jsonError);
      }
    } catch (error) {
      console.warn('[SHINHAN] Keyboard analysis/typing error:', error);
    }
    
    return { 
      success: true, 
      boxes: null, 
      clickedPoint: null, 
      lowerScreenshotPath,
      upperScreenshotPath,
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
  typePasswordWithJSON,
  clickLoginButton
};