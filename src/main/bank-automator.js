const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImageSegmentation } = require('./ai-vision/test');

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const CONFIG = {
  TARGET_URL: 'https://www.shinhan.com/hpe/index.jsp#252400000000',
  UNDESIRED_HOSTNAMES: ['wooribank.com', 'www.wooribank.com'],
  XPATHS: {
    ID_INPUT: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[6]/div[3]/div[2]/div[1]/div/input',
    PASSWORD_INPUT: '/html/body/div[1]/div[2]/div/div/div[2]/div/div[6]/div[3]/div[2]/div[1]/div/div/input[1]',
    KEYBOARD: '/html/body/div[6]/div[1]'
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
// UTILITY FUNCTIONS
// ============================================================================

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

/**
 * Ensures element is visible in viewport before interaction
 * @param {Object} page - Playwright page object
 * @param {Object} bounds - Element bounds {x, y, width, height}
 * @returns {Promise<Object>} Updated bounds after scrolling
 */
async function ensureElementInViewport(page, bounds) {
  if (!bounds) return bounds;
  
  const viewport = await page.viewportSize();
  if (!viewport) return bounds;
  
  console.log(`[SHINHAN] Checking if element is in viewport. Element: y=${bounds.y}, height=${bounds.height}, Viewport height=${viewport.height}`);
  
  // Check if element is outside viewport
  if (bounds.y < 0 || bounds.y + bounds.height > viewport.height || 
      bounds.x < 0 || bounds.x + bounds.width > viewport.width) {
    
    console.log('[SHINHAN] Element is outside viewport, scrolling to center it...');
    
    // Calculate scroll position to center the element
    const scrollY = bounds.y - (viewport.height / 2) + (bounds.height / 2);
    const scrollX = bounds.x - (viewport.width / 2) + (bounds.width / 2);
    
    // Scroll to position
    await page.evaluate(({ x, y }) => {
      window.scrollTo(x, y);
    }, { x: Math.max(0, scrollX), y: Math.max(0, scrollY) });
    
    await page.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
    
    // Get updated bounds after scrolling
    const newBounds = await page.evaluate((oldBounds) => {
      // Calculate the new position after scroll
      const scrolledY = oldBounds.y - window.scrollY;
      const scrolledX = oldBounds.x - window.scrollX;
      return {
        x: scrolledX,
        y: scrolledY,
        width: oldBounds.width,
        height: oldBounds.height
      };
    }, bounds);
    
    console.log(`[SHINHAN] Element repositioned after scroll: y=${newBounds.y}`);
    return newBounds;
  }
  
  return bounds;
}

/**
 * Ensures output directory exists
 * @param {string} outputDir - Directory path
 */
function ensureOutputDirectory(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Generates timestamp for file naming
 * @returns {string} Formatted timestamp
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ============================================================================
// KEYBOARD TYPING CLASS
// ============================================================================

class KeyboardTyper {
  constructor(page) {
    this.page = page;
  }

  /**
   * Extracts character from keyboard key label
   * @param {string} label - Key label text
   * @returns {string} Extracted character
   */
  extractCharacterFromLabel(label) {
    if (label.toLowerCase().includes('key:')) {
      const match = label.match(/key:\s*([a-zA-Z0-9])/i);
      return match ? match[1] : '';
    } else if (label.match(/^[a-zA-Z]\s*\/\s*[ㅁ-ㅣ]/i)) {
      const match = label.match(/^([a-zA-Z])/i);
      return match ? match[1] : '';
    } else if (label.toLowerCase().includes('enter')) {
      return 'enter';
    } else if (label.toLowerCase().includes('shift')) {
      return 'shift';
    } else if (label.toLowerCase().includes('space')) {
      return ' ';
    } else {
      const singleCharMatch = label.match(/\b([a-zA-Z0-9])\b/i);
      return singleCharMatch ? singleCharMatch[1] : '';
    }
  }

  /**
   * Creates character mapping from keyboard keys
   * @param {Object} keyboardKeys - Keyboard keys object
   * @returns {Object} Character mapping and shift key reference
   */
  createCharacterMapping(keyboardKeys) {
    const charMap = {};
    let shiftKey = null;
    
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
      const char = this.extractCharacterFromLabel(keyData.label || '');
      
      if (char && ((char.length === 1 && /[a-zA-Z0-9]/.test(char)) || char === 'enter' || char === 'shift' || char === ' ')) {
        charMap[char] = keyData;
        if (char === 'shift') {
          shiftKey = keyData;
        }
        // Also map lowercase version for case-insensitive matching
        if (char.length === 1 && /[a-zA-Z]/.test(char)) {
          charMap[char.toLowerCase()] = keyData;
        }
      }
    });
    
    return { charMap, shiftKey };
  }

  /**
   * Handles shift key operations
   * @param {Object} shiftKey - Shift key data
   * @param {string} operation - 'press' or 'release'
   * @returns {Promise<boolean>} Success status
   */
  async handleShiftKey(shiftKey, operation = 'press') {
    if (!shiftKey || !this.page) return false;
    
    try {
      console.log(`[SHINHAN] ${operation === 'press' ? 'Pressing' : 'Releasing'} shift key...`);
      
      // Ensure shift key is in viewport
      const updatedBounds = await ensureElementInViewport(this.page, shiftKey.bounds);
      const centerX = updatedBounds.x + (updatedBounds.width / 2);
      const centerY = updatedBounds.y + (updatedBounds.height / 2);
      
      // Click at the updated position
      await this.page.mouse.move(centerX, centerY);
      await this.page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
      await this.page.mouse.click(centerX, centerY);
      
      await this.page.waitForTimeout(operation === 'press' ? CONFIG.DELAYS.SHIFT_ACTIVATE : CONFIG.DELAYS.SHIFT_DEACTIVATE);
      return true;
    } catch (error) {
      console.warn(`[SHINHAN] Failed to ${operation} shift key:`, error);
      return false;
    }
  }

  /**
   * Takes screenshot of key bounds for debugging
   * @param {string} char - Character being typed
   * @param {number} index - Character index
   * @param {Object} keyData - Key data with bounds
   * @param {string} type - 'before' or 'after'
   * @returns {Promise<string|null>} Screenshot path
   */
  async takeKeyScreenshot(char, index, keyData, type = 'before') {
    if (!this.page) return null;
    
    try {
      // Ensure element is in viewport first
      const updatedBounds = await ensureElementInViewport(this.page, keyData.bounds);
      
      const timestamp = generateTimestamp();
      const screenshotPath = path.join(process.cwd(), 'output', `key-${char}-${index + 1}-${type}-${timestamp}.png`);
      
      // Check if bounds are valid
      if (updatedBounds.width <= 0 || updatedBounds.height <= 0) {
        console.warn(`[SHINHAN] Invalid bounds for key '${char}': width=${updatedBounds.width}, height=${updatedBounds.height}`);
        return null;
      }
      
      await this.page.screenshot({
        path: screenshotPath,
        clip: {
          x: Math.max(0, updatedBounds.x),
          y: Math.max(0, updatedBounds.y),
          width: updatedBounds.width,
          height: updatedBounds.height
        }
      });
      
      console.log(`[SHINHAN] ${type === 'before' ? 'Pre' : 'Post'}-click screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      console.warn(`[SHINHAN] Failed to take ${type} screenshot for '${char}':`, error.message);
      return null;
    }
  }

  /**
   * Takes screenshot of the entire keyboard with key bounds highlighted
   * @param {string} char - Character being typed
   * @param {number} index - Character index
   * @param {Object} keyData - Key data with bounds
   * @param {string} type - 'before' or 'after'
   * @returns {Promise<string|null>} Screenshot path
   */
  async takeKeyboardWithKeyHighlight(char, index, keyData, type = 'before') {
    if (!this.page) return null;
    
    try {
      const timestamp = generateTimestamp();
      const screenshotPath = path.join(process.cwd(), 'output', `keyboard-${char}-${index + 1}-${type}-${timestamp}.png`);
      
      // First ensure keyboard is in viewport
      const keyboardLocator = this.page.locator(`xpath=${CONFIG.XPATHS.KEYBOARD}`);
      await keyboardLocator.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
      
      // Take screenshot of the entire keyboard area
      await keyboardLocator.first().screenshot({ path: screenshotPath });
      
      console.log(`[SHINHAN] Keyboard with highlighted key '${char}' screenshot saved: ${screenshotPath}`);
      console.log(`[SHINHAN] Key bounds: x=${keyData.bounds.x}, y=${keyData.bounds.y}, w=${keyData.bounds.width}, h=${keyData.bounds.height}`);
      console.log(`[SHINHAN] Key center: x=${keyData.position.x}, y=${keyData.position.y}`);
      
      return screenshotPath;
    } catch (error) {
      console.warn(`[SHINHAN] Failed to take keyboard screenshot for '${char}':`, error.message);
      return null;
    }
  }

  /**
   * Types a single character
   * @param {string} char - Character to type
   * @param {number} index - Character index
   * @param {Object} charMap - Character mapping
   * @param {Object} shiftKey - Shift key data
   * @param {boolean} isShiftKeyboard - Whether using shift keyboard
   * @returns {Promise<boolean>} Success status
   */
  async typeCharacter(char, index, charMap, shiftKey, isShiftKeyboard) {
    const charLower = char.toLowerCase();
    const isUppercase = /[A-Z]/.test(char);
    
    // Handle shift for uppercase characters
    if (isShiftKeyboard && isUppercase && shiftKey) {
      await this.handleShiftKey(shiftKey, 'press');
    }
    
    // Find character in mapping
    const keyData = charMap[char] || charMap[charLower];
    
    if (!keyData) {
      console.warn(`[SHINHAN] Character '${char}' not found in keyboard mapping`);
      return false;
    }
    
    // Ensure key is in viewport before interaction
    const updatedBounds = await ensureElementInViewport(this.page, keyData.bounds);
    const centerX = updatedBounds.x + (updatedBounds.width / 2);
    const centerY = updatedBounds.y + (updatedBounds.height / 2);
    
    console.log(`[SHINHAN] Clicking '${char}' at position (${centerX}, ${centerY})`);
    
    if (this.page) {
      try {
        // Take pre-click screenshots with updated bounds
        const updatedKeyData = { ...keyData, bounds: updatedBounds, position: { x: centerX, y: centerY } };
        await this.takeKeyScreenshot(char, index, updatedKeyData, 'before');
        await this.takeKeyboardWithKeyHighlight(char, index, updatedKeyData, 'before');
        
        // Click the key at updated position
        await this.page.mouse.move(centerX, centerY);
        await this.page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
        await this.page.mouse.click(centerX, centerY);
        await this.page.waitForTimeout(CONFIG.DELAYS.CLICK);
        
        console.log(`[SHINHAN] Successfully clicked '${char}' at (${centerX}, ${centerY})`);
        
        // Take post-click screenshots
        await this.takeKeyScreenshot(char, index, updatedKeyData, 'after');
        await this.takeKeyboardWithKeyHighlight(char, index, updatedKeyData, 'after');
        
        return true;
      } catch (error) {
        console.error(`[SHINHAN] Failed to click '${char}':`, error);
        return false;
      }
    } else {
      console.log(`[SHINHAN] No page object available, would click at (${centerX}, ${centerY})`);
      return true;
    }
  }

  /**
   * Types text using keyboard coordinates
   * @param {Object} keyboardKeys - Keyboard keys mapping
   * @param {string} text - Text to type
   * @returns {Promise<void>}
   */
  async typeText(keyboardKeys, text) {
    try {
      console.log(`[SHINHAN] Attempting to type "${text}" using keyboard coordinates...`);
      
      const isShiftKeyboard = Object.values(keyboardKeys).some(key => key.isShiftKeyboard);
      console.log(`[SHINHAN] Using ${isShiftKeyboard ? 'shift' : 'normal'} keyboard layout`);
      
      const { charMap, shiftKey } = this.createCharacterMapping(keyboardKeys);
      console.log('[SHINHAN] Available characters:', Object.keys(charMap));
      console.log(`[SHINHAN] Clicking on all characters: "${text}"`);
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isUppercase = /[A-Z]/.test(char);
        
        await this.typeCharacter(char, i, charMap, shiftKey, isShiftKeyboard);
        
        // Handle shift release for uppercase characters
        if (isShiftKeyboard && isUppercase && shiftKey) {
          await this.handleShiftKey(shiftKey, 'release');
        }
      }
      
      console.log(`[SHINHAN] Finished typing "${text}"`);
    } catch (error) {
      console.error('[SHINHAN] Error typing text:', error);
    }
  }
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
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    proxy
  });
  
  const context = await browser.newContext({
    locale: 'ko-KR',
    // Set a larger viewport to accommodate the keyboard
    viewport: { width: 1280, height: 1024 }
  });
  
  return { browser, context };
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
// AI ANALYSIS AND KEYBOARD MAPPING
// ============================================================================

/**
 * Converts AI box coordinates to screen coordinates
 * @param {Array} aiBox - AI box coordinates [ymin, xmin, ymax, xmax]
 * @param {Object} keyboardBox - Keyboard element bounding box
 * @returns {Object} Screen coordinates and dimensions
 */
function convertAiBoxToScreen(aiBox, keyboardBox) {
  const [ymin, xmin, ymax, xmax] = aiBox;
  
  // Debug logging
  console.log('[SHINHAN] AI Box coordinates (normalized 0-1000):', { ymin, xmin, ymax, xmax });
  console.log('[SHINHAN] Keyboard box (screen position and size):', keyboardBox);
  
  // Validate keyboard box
  if (!keyboardBox || !keyboardBox.width || !keyboardBox.height) {
    console.warn('[SHINHAN] Invalid keyboard box, using fallback dimensions');
    keyboardBox = { x: 0, y: 0, width: 1000, height: 1000 };
  }
  
  // AI gives us normalized coordinates (0-1000 range) that need to be scaled to image dimensions
  // First normalize to 0-1 range by dividing by 1000 (like spatial understanding does)
  const normalizedXmin = xmin / 1000;
  const normalizedYmin = ymin / 1000;
  const normalizedXmax = xmax / 1000;
  const normalizedYmax = ymax / 1000;
  
  // Then scale to actual image dimensions
  const imageX = normalizedXmin * keyboardBox.width;
  const imageY = normalizedYmin * keyboardBox.height;
  const imageWidth = (normalizedXmax - normalizedXmin) * keyboardBox.width;
  const imageHeight = (normalizedYmax - normalizedYmin) * keyboardBox.height;
  
  // Convert from keyboard-relative coordinates to absolute screen coordinates
  const screenX = keyboardBox.x + imageX;
  const screenY = keyboardBox.y + imageY;
  const screenWidth = imageWidth;
  const screenHeight = imageHeight;
  
  // Calculate center point for clicking
  const centerX = screenX + (screenWidth / 2);
  const centerY = screenY + (screenHeight / 2);

  const result = {
    position: { x: Math.round(centerX), y: Math.round(centerY) },
    bounds: {
      x: Math.round(screenX),
      y: Math.round(screenY),
      width: Math.round(screenWidth),
      height: Math.round(screenHeight)
    }
  };
  
  console.log('[SHINHAN] Final screen coordinates:', result);
  console.log('[SHINHAN] Calculation: Normalized (', normalizedXmin, ',', normalizedYmin, ') * Image size (', keyboardBox.width, ',', keyboardBox.height, ') + Image pos (', keyboardBox.x, ',', keyboardBox.y, ') = Screen (', screenX, ',', screenY, ')');
  
  return result;
}

/**
 * Creates keyboard mapping from AI segmentation results
 * @param {Array} aiSegmentation - AI segmentation results
 * @param {Object} keyboardBox - Keyboard element bounding box
 * @param {boolean} isShiftKeyboard - Whether this is shift keyboard
 * @returns {Object} Keyboard keys mapping
 */
function createKeyboardMapping(aiSegmentation, keyboardBox, isShiftKeyboard = false) {
  const keyboardKeys = {};
  
  aiSegmentation.forEach((obj, index) => {
    const keyLabel = obj.label || `${isShiftKeyboard ? 'shift_key' : 'key'}_${index}`;
    const screenCoords = convertAiBoxToScreen(obj.box_2d, keyboardBox);
    
    keyboardKeys[keyLabel] = {
      ...screenCoords,
      label: obj.label,
      mask: obj.mask,
      aiBox: obj.box_2d,
      isShiftKeyboard
    };
  });
  
  return keyboardKeys;
}

/**
 * Analyzes keyboard screenshot with AI and creates mapping
 * @param {string} screenshotPath - Path to screenshot
 * @param {string} geminiApiKey - Gemini API key
 * @param {Object} keyboardBox - Keyboard element bounding box
 * @returns {Promise<Object>} Keyboard mapping object
 */
async function analyzeKeyboardWithAI(screenshotPath, geminiApiKey, keyboardBox) {
  if (!geminiApiKey) return {};
  
  try {
    console.log('[SHINHAN] Analyzing Sinhan keyboard screenshot with AI...');
    const aiSegmentation = await analyzeImageSegmentation(screenshotPath, geminiApiKey);
    
    if (!aiSegmentation || aiSegmentation.length === 0) return {};
    
    console.log('[SHINHAN] Processing AI segmentation results...');
    console.log('[SHINHAN] Found', aiSegmentation.length, 'objects in the image');
    
    const keyboardKeys = createKeyboardMapping(aiSegmentation, keyboardBox);
    console.log('[SHINHAN] Keyboard keys mapped:', Object.keys(keyboardKeys).length);
    
    return keyboardKeys;
  } catch (error) {
    console.warn('[SHINHAN] Failed to analyze Sinhan keyboard screenshot with AI:', error);
    return {};
  }
}

/**
 * Analyzes shift keyboard layout
 * @param {Object} page - Playwright page object
 * @param {Object} keyboardKeys - Normal keyboard keys
 * @param {Object} keyboardBox - Keyboard element bounding box
 * @param {string} geminiApiKey - Gemini API key
 * @returns {Promise<Object>} Shift keyboard mapping
 */
async function analyzeShiftKeyboard(page, keyboardKeys, keyboardBox, geminiApiKey) {
  if (Object.keys(keyboardKeys).length === 0) return {};
  
  try {
    console.log('[SHINHAN] Pressing shift key to analyze shift layout...');
    
    const shiftKey = Object.values(keyboardKeys).find(key => 
      key.label && key.label.toLowerCase().includes('shift')
    );
    
    if (!shiftKey) {
      console.warn('[SHINHAN] Shift key not found in keyboard mapping');
      return {};
    }
    
    console.log('[SHINHAN] Clicking shift key at position:', shiftKey.position);
    
    // Ensure shift key is in viewport
    const updatedBounds = await ensureElementInViewport(page, shiftKey.bounds);
    const centerX = updatedBounds.x + (updatedBounds.width / 2);
    const centerY = updatedBounds.y + (updatedBounds.height / 2);
    
    // Click shift key
    await page.mouse.move(centerX, centerY);
    await page.waitForTimeout(CONFIG.DELAYS.MOUSE_MOVE);
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(CONFIG.DELAYS.KEYBOARD_UPDATE);
    
    // Take shift keyboard screenshot
    const shiftTimestamp = generateTimestamp();
    const outputDir = path.join(process.cwd(), 'output');
    ensureOutputDirectory(outputDir);
    
    const shiftFilename = `sinhan-keyboard-shift-${shiftTimestamp}.png`;
    const shiftScreenshotPath = path.join(outputDir, shiftFilename);
    
    const keyboardLocator = page.locator(`xpath=${CONFIG.XPATHS.KEYBOARD}`);
    await keyboardLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
    await keyboardLocator.first().screenshot({ path: shiftScreenshotPath });
    console.log('[SHINHAN] Shift keyboard screenshot saved:', shiftScreenshotPath);
    
    // Get updated keyboard box after potential scrolling
    const updatedKeyboardBox = await getElementBox(page, `xpath=${CONFIG.XPATHS.KEYBOARD}`);
    
    // Analyze shift keyboard with AI
    const shiftKeyboardKeys = await analyzeKeyboardWithAI(shiftScreenshotPath, geminiApiKey, updatedKeyboardBox || keyboardBox);
    console.log('[SHINHAN] Shift keyboard keys mapped:', Object.keys(shiftKeyboardKeys).length);
    
    return shiftKeyboardKeys;
  } catch (error) {
    console.warn('[SHINHAN] Failed to press shift key and analyze:', error);
    return {};
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
 * @param {string} geminiApiKey - Gemini API key for AI analysis
 * @returns {Promise<Object>} Automation result
 */
async function runShinhanAutomation(username, password, id, proxyUrl, geminiApiKey) {
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
    
    // Fill input fields
    await fillInputField(page, CONFIG.XPATHS.ID_INPUT, id, 'Sinhan ID');
    await fillInputField(page, CONFIG.XPATHS.PASSWORD_INPUT, password, 'Sinhan Password');
    
    // Handle keyboard screenshot and AI analysis
    let screenshotPath = null;
    try {
      const keyboardLocator = page.locator(`xpath=${CONFIG.XPATHS.KEYBOARD}`);
      if (await keyboardLocator.count()) {
        // Scroll keyboard into view first
        console.log('[SHINHAN] Scrolling keyboard into view...');
        await keyboardLocator.scrollIntoViewIfNeeded();
        await page.waitForTimeout(CONFIG.TIMEOUTS.SCROLL_WAIT);
        
        const keyboardBox = await getElementBox(page, `xpath=${CONFIG.XPATHS.KEYBOARD}`);
        console.log('[SHINHAN] Keyboard element bounds after scroll:', keyboardBox);
        
        // Ensure output directory exists
        const outputDir = path.join(process.cwd(), 'output');
        ensureOutputDirectory(outputDir);
        
        const timestamp = generateTimestamp();
        const filename = `sinhan-keyboard-${timestamp}.png`;
        screenshotPath = path.join(outputDir, filename);
        
        await keyboardLocator.first().screenshot({ path: screenshotPath });
        console.log('[SHINHAN] Sinhan keyboard screenshot saved:', screenshotPath);
        
        // Analyze with AI
        const keyboardKeys = await analyzeKeyboardWithAI(screenshotPath, geminiApiKey, keyboardBox);
        
        if (Object.keys(keyboardKeys).length > 0) {
          // Analyze shift keyboard
          const shiftKeyboardKeys = await analyzeShiftKeyboard(page, keyboardKeys, keyboardBox, geminiApiKey);
          
          // Type password using appropriate keyboard layout
          console.log(`[SHINHAN] ===== TYPING PASSWORD "${password.toUpperCase()}" =====`);
          
          // Lower shift key before typing
          const shiftKey = Object.values(keyboardKeys).find(key => 
            key.label && (
              key.label.toLowerCase().includes('shift') ||
              key.label.toLowerCase().includes('shift key') ||
              key.label.toLowerCase().includes('shiftkey') ||
              key.label.toLowerCase().includes('shift_key')
            )
          );
          
          console.log('[SHINHAN] Available keyboard keys:', Object.keys(keyboardKeys));
          console.log('[SHINHAN] Looking for shift key in:', Object.values(keyboardKeys).map(k => k.label));
          console.log('[SHINHAN] Found shift key:', shiftKey ? `"${shiftKey.label}" at (${shiftKey.position.x}, ${shiftKey.position.y})` : 'NOT FOUND');
          
          if (shiftKey) {
            const typer = new KeyboardTyper(page);
            
            // Take screenshot of shift key area for debugging
            console.log('[SHINHAN] Taking screenshot of shift key area...');
            try {
              const shiftTimestamp = generateTimestamp();
              const shiftScreenshotPath = path.join(process.cwd(), 'output', `shift-key-area-${shiftTimestamp}.png`);
              
              // Ensure shift key is in viewport before screenshot
              const updatedBounds = await ensureElementInViewport(page, shiftKey.bounds);
              
              await page.screenshot({
                path: shiftScreenshotPath,
                clip: {
                  x: Math.max(0, updatedBounds.x),
                  y: Math.max(0, updatedBounds.y),
                  width: updatedBounds.width,
                  height: updatedBounds.height
                }
              });
              
              console.log('[SHINHAN] Shift key area screenshot saved:', shiftScreenshotPath);
              console.log('[SHINHAN] Shift key bounds used:', updatedBounds);
            } catch (error) {
              console.warn('[SHINHAN] Failed to take shift key area screenshot:', error);
            }
            
            // Press shift key to analyze shift layout
            const shiftSuccess = await typer.handleShiftKey(shiftKey, 'press');
            if (shiftSuccess) {
              await page.waitForTimeout(CONFIG.DELAYS.KEYBOARD_RETURN);
              console.log('[SHINHAN] Shift key pressed successfully to analyze shift layout');
              
              // Take screenshot of shift key after clicking
              console.log('[SHINHAN] Taking post-shift screenshot...');
              await typer.takeKeyScreenshot('shift', 0, shiftKey, 'after');
              await typer.takeKeyboardWithKeyHighlight('shift', 0, shiftKey, 'after');
            } else {
              console.warn('[SHINHAN] Failed to press shift key, continuing without shift...');
            }
          } else {
            console.warn('[SHINHAN] No shift key found in keyboard mapping, continuing without shift...');
          }
          
          // Complete keyboard mapping and typing
          const finalKeyboardKeys = { ...keyboardKeys, ...shiftKeyboardKeys };
          console.log('[SHINHAN] Final keyboard mapping ready with', Object.keys(finalKeyboardKeys).length, 'keys');
          
          const typer = new KeyboardTyper(page);
          await typer.typeText(finalKeyboardKeys, password);
        }
      }
    } catch (error) {
      console.warn('[SHINHAN] Failed to take screenshot of Sinhan keyboard:', error);
    }
    
    return { success: true, boxes: null, clickedPoint: null, screenshotPath };
    
  } catch (error) {
    // Fallback to bundled Chromium
    try {
      console.log('[SHINHAN] Attempting fallback with bundled Chromium...');
      const { browser: fallbackBrowser, context: fallbackContext } = await createBrowser(proxy);
      browser = fallbackBrowser;
      
      await setupBrowserContext(fallbackContext, CONFIG.TARGET_URL, null);
      
      const page = await fallbackContext.newPage();
      await setupBrowserContext(fallbackContext, CONFIG.TARGET_URL, page);
      
      await page.goto(CONFIG.TARGET_URL, { waitUntil: 'domcontentloaded' });
      
      // Try to fill ID field in fallback mode
      await fillInputField(page, CONFIG.XPATHS.ID_INPUT, id, 'Sinhan ID [FALLBACK]');
      
      return { success: true, fallback: true, boxes: null, clickedPoint: null, screenshotPath: null };
    } catch (fallbackError) {
      return { 
        success: false, 
        error: String(fallbackError && fallbackError.message ? fallbackError.message : fallbackError) 
      };
    }
  }
}

module.exports = { runShinhanAutomation };