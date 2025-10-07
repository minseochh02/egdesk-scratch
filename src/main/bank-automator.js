const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImageSegmentation } = require('./ai-vision/test');

// Simple debug visualization without external dependencies

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
// DEBUG FUNCTIONS
// ============================================================================

/**
 * Creates a simple HTML debug visualization with AI-detected objects
 * @param {string} originalImagePath - Path to the original image
 * @param {Array} aiSegmentation - AI segmentation results with masks
 * @param {string} outputPath - Path to save the debug HTML file
 * @param {Object} keyboardBox - Keyboard element bounding box {x, y, width, height}
 * @returns {Promise<string|null>} Path to the created debug HTML file
 */
async function createDebugHTMLVisualization(originalImagePath, aiSegmentation, outputPath, keyboardBox = null) {
  try {
    console.log('[DEBUG] Creating HTML debug visualization...');
    
    if (!aiSegmentation || aiSegmentation.length === 0) {
      console.warn('[DEBUG] No AI segmentation data provided');
      return null;
    }

    // Convert image to base64 for embedding
    const imageBuffer = fs.readFileSync(originalImagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageExtension = path.extname(originalImagePath).substring(1);
    
    // We'll let JavaScript in the HTML get the actual image dimensions
    // This is more reliable than trying to parse image headers
    
    // Log keyboard position info
    if (keyboardBox) {
      console.log('[DEBUG] Keyboard position on screen:', keyboardBox);
    } else {
      console.log('[DEBUG] No keyboard position provided, using (0,0)');
      keyboardBox = { x: 0, y: 0, width: 1000, height: 600 };
    }
    
    // Create HTML with overlays
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Keyboard Detection Debug</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { position: relative; display: inline-block; }
        .original-image { 
            width: auto; 
            height: auto; 
            max-width: 100%; 
            display: block;
        }
        .overlay { position: absolute; border: 3px solid; opacity: 0.7; }
        .overlay-label { 
            position: absolute; 
            top: -20px; 
            left: 0; 
            background: rgba(0,0,0,0.8); 
            color: white; 
            padding: 2px 6px; 
            font-size: 12px; 
            border-radius: 3px;
        }
        .info-panel { 
            margin-top: 20px; 
            padding: 15px; 
            background: #f5f5f5; 
            border-radius: 5px; 
        }
        .object-info { 
            margin: 5px 0; 
            padding: 5px; 
            background: white; 
            border-radius: 3px; 
        }
        .debug-info {
            margin: 10px 0;
            padding: 10px;
            background: #e8f4f8;
            border-radius: 5px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h2>AI Keyboard Detection Debug Visualization</h2>
    <div class="container">
        <img id="keyboardImage" src="data:image/${imageExtension};base64,${base64Image}" class="original-image" alt="Original Keyboard" onload="createOverlays()">
        <div id="overlayContainer"></div>
    </div>
    
    <div class="debug-info">
        <strong>Debug Info:</strong><br>
        <span id="imageDimensions">Loading image dimensions...</span><br>
        <span id="coordinateInfo">Waiting for image load...</span>
    </div>
    
    <div class="info-panel">
        <h3>Detection Summary</h3>
        <p><strong>Total Objects Detected:</strong> ${aiSegmentation.length}</p>
        <p><strong>Original Image:</strong> ${path.basename(originalImagePath)}</p>
        
        <h4>Detected Objects:</h4>
        <div id="objectList">
          <p>Loading object details...</p>
        </div>
    </div>
    
    <script>
        // AI segmentation data
        const aiSegmentation = ${JSON.stringify(aiSegmentation)};
        
        // Keyboard position on screen
        const keyboardBox = ${JSON.stringify(keyboardBox)};
        
        // Color palette
        const colors = [
            { r: 255, g: 0, b: 0 },     // Red
            { r: 0, g: 255, b: 0 },     // Green
            { r: 0, g: 0, b: 255 },     // Blue
            { r: 255, g: 255, b: 0 },   // Yellow
            { r: 255, g: 0, b: 255 },   // Magenta
            { r: 0, g: 255, b: 255 },   // Cyan
            { r: 255, g: 128, b: 0 },   // Orange
            { r: 128, g: 0, b: 255 },   // Purple
            { r: 255, g: 192, b: 203 }, // Pink
            { r: 0, g: 128, b: 0 },     // Dark Green
        ];
        
        function getColorForIndex(index) {
            return colors[index % colors.length];
        }
        
        function createOverlays() {
            const img = document.getElementById('keyboardImage');
            const container = document.getElementById('overlayContainer');
            const dimensionsSpan = document.getElementById('imageDimensions');
            const coordinateSpan = document.getElementById('coordinateInfo');
            
            // Get both natural and displayed dimensions
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            const displayedWidth = img.offsetWidth;
            const displayedHeight = img.offsetHeight;
            
            // Calculate scaling factors
            const scaleX = displayedWidth / naturalWidth;
            const scaleY = displayedHeight / naturalHeight;
            
            // Update debug info
            dimensionsSpan.innerHTML = \`
                Natural dimensions: \${naturalWidth} × \${naturalHeight} pixels<br>
                Displayed dimensions: \${displayedWidth} × \${displayedHeight} pixels<br>
                Scale factors: \${scaleX.toFixed(3)} × \${scaleY.toFixed(3)}<br>
                Keyboard screen position: (\${keyboardBox.x}, \${keyboardBox.y}) size: \${keyboardBox.width} × \${keyboardBox.height}
            \`;
            
            console.log('Natural dimensions:', naturalWidth, '×', naturalHeight);
            console.log('Displayed dimensions:', displayedWidth, '×', displayedHeight);
            console.log('Scale factors:', scaleX, '×', scaleY);
            
            // Clear existing overlays
            container.innerHTML = '';
            
            // Create overlays for each detected object
            aiSegmentation.forEach((obj, index) => {
                if (!obj.box_2d) return;
                
                const [ymin, xmin, ymax, xmax] = obj.box_2d;
                
                // Scale coordinates from 0-1000 range to natural image dimensions
                const naturalXmin = (xmin / 1000) * naturalWidth;
                const naturalYmin = (ymin / 1000) * naturalHeight;
                const naturalXmax = (xmax / 1000) * naturalWidth;
                const naturalYmax = (ymax / 1000) * naturalHeight;
                
                // Scale to displayed dimensions
                const displayedXmin = naturalXmin * scaleX;
                const displayedYmin = naturalYmin * scaleY;
                const displayedXmax = naturalXmax * scaleX;
                const displayedYmax = naturalYmax * scaleY;
                
                // Add keyboard screen position offset
                const finalXmin = displayedXmin + keyboardBox.x;
                const finalYmin = displayedYmin + keyboardBox.y;
                const finalXmax = displayedXmax + keyboardBox.x;
                const finalYmax = displayedYmax + keyboardBox.y;
                
                const color = getColorForIndex(index);
                const colorHex = \`rgb(\${color.r}, \${color.g}, \${color.b})\`;
                
                // Create overlay element
                const overlay = document.createElement('div');
                overlay.className = 'overlay';
                overlay.style.cssText = \`
                    left: \${finalXmin}px;
                    top: \${finalYmin}px;
                    width: \${finalXmax - finalXmin}px;
                    height: \${finalYmax - finalYmin}px;
                    border-color: \${colorHex};
                \`;
                
                // Create label
                const label = document.createElement('div');
                label.className = 'overlay-label';
                label.style.color = colorHex;
                label.textContent = obj.label || \`Object \${index + 1}\`;
                overlay.appendChild(label);
                
                container.appendChild(overlay);
                
                console.log(\`Object \${index + 1} (\${obj.label || 'unknown'}):\`);
                console.log(\`  Raw coords: (\${xmin}, \${ymin}) to (\${xmax}, \${ymax})\`);
                console.log(\`  Natural coords: (\${naturalXmin.toFixed(1)}, \${naturalYmin.toFixed(1)}) to (\${naturalXmax.toFixed(1)}, \${naturalYmax.toFixed(1)})\`);
                console.log(\`  Displayed coords: (\${displayedXmin.toFixed(1)}, \${displayedYmin.toFixed(1)}) to (\${displayedXmax.toFixed(1)}, \${displayedYmax.toFixed(1)})\`);
                console.log(\`  Final coords (with keyboard offset): (\${finalXmin.toFixed(1)}, \${finalYmin.toFixed(1)}) to (\${finalXmax.toFixed(1)}, \${finalYmax.toFixed(1)})\`);
            });
            
            // Update coordinate info
            coordinateSpan.textContent = \`Created \${aiSegmentation.length} overlays with proper scaling\`;
            
            // Update object list
            updateObjectList();
        }
        
        function updateObjectList() {
            const objectList = document.getElementById('objectList');
            const img = document.getElementById('keyboardImage');
            
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            const displayedWidth = img.offsetWidth;
            const displayedHeight = img.offsetHeight;
            const scaleX = displayedWidth / naturalWidth;
            const scaleY = displayedHeight / naturalHeight;
            
            const objectListHTML = aiSegmentation.map((obj, index) => {
                if (!obj.box_2d) return '';
                const [ymin, xmin, ymax, xmax] = obj.box_2d;
                
                // Scale coordinates from 0-1000 range to natural image dimensions
                const naturalXmin = (xmin / 1000) * naturalWidth;
                const naturalYmin = (ymin / 1000) * naturalHeight;
                const naturalXmax = (xmax / 1000) * naturalWidth;
                const naturalYmax = (ymax / 1000) * naturalHeight;
                
                // Scale to displayed dimensions
                const displayedXmin = naturalXmin * scaleX;
                const displayedYmin = naturalYmin * scaleY;
                const displayedXmax = naturalXmax * scaleX;
                const displayedYmax = naturalYmax * scaleY;
                
                // Add keyboard screen position offset
                const finalXmin = displayedXmin + keyboardBox.x;
                const finalYmin = displayedYmin + keyboardBox.y;
                const finalXmax = displayedXmax + keyboardBox.x;
                const finalYmax = displayedYmax + keyboardBox.y;
                
                const color = getColorForIndex(index);
                return \`
                    <div class="object-info">
                        <strong>\${obj.label || \`Object \${index + 1}\`}</strong><br>
                        <span style="color: rgb(\${color.r}, \${color.g}, \${color.b});">●</span>
                        Raw AI coords: (\${xmin}, \${ymin}) to (\${xmax}, \${ymax})<br>
                        Natural coords: (\${naturalXmin.toFixed(1)}, \${naturalYmin.toFixed(1)}) to (\${naturalXmax.toFixed(1)}, \${naturalYmax.toFixed(1)})<br>
                        Displayed coords: (\${displayedXmin.toFixed(1)}, \${displayedYmin.toFixed(1)}) to (\${displayedXmax.toFixed(1)}, \${displayedYmax.toFixed(1)})<br>
                        Final coords: (\${finalXmin.toFixed(1)}, \${finalYmin.toFixed(1)}) to (\${finalXmax.toFixed(1)}, \${finalYmax.toFixed(1)})<br>
                        Size: \${(finalXmax - finalXmin).toFixed(1)} × \${(finalYmax - finalYmin).toFixed(1)} pixels<br>
                        Confidence: \${obj.confidence || 'N/A'}
                    </div>
                \`;
            }).join('');
            
            objectList.innerHTML = objectListHTML;
        }
        
        // Fallback in case image is already loaded
        if (document.readyState === 'complete') {
            createOverlays();
        }
    </script>
</body>
</html>
    `;

    // Write HTML file
    fs.writeFileSync(outputPath, html);
    
    console.log(`[DEBUG] HTML debug visualization saved: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error('[DEBUG] Failed to create HTML debug visualization:', error);
    return null;
  }
}

/**
 * Generates a distinct color for each object index
 * @param {number} index - Object index
 * @returns {Object} RGB color object
 */
function getColorForIndex(index) {
  const colors = [
    { r: 255, g: 0, b: 0 },     // Red
    { r: 0, g: 255, b: 0 },     // Green
    { r: 0, g: 0, b: 255 },     // Blue
    { r: 255, g: 255, b: 0 },   // Yellow
    { r: 255, g: 0, b: 255 },   // Magenta
    { r: 0, g: 255, b: 255 },   // Cyan
    { r: 255, g: 128, b: 0 },   // Orange
    { r: 128, g: 0, b: 255 },   // Purple
    { r: 255, g: 192, b: 203 }, // Pink
    { r: 0, g: 128, b: 0 },     // Dark Green
  ];
  
  return colors[index % colors.length];
}

/**
 * Creates a detailed debug report with HTML visualization and AI analysis data
 * @param {string} imagePath - Path to the original image
 * @param {Array} aiSegmentation - AI segmentation results
 * @param {string} outputDir - Output directory for debug files
 * @param {Object} keyboardBox - Keyboard element bounding box {x, y, width, height}
 * @returns {Promise<Object>} Debug report object
 */
async function createDebugReport(imagePath, aiSegmentation, outputDir, keyboardBox = null) {
  try {
    console.log('[DEBUG] Creating comprehensive debug report...');
    
    const timestamp = generateTimestamp();
    const debugHtmlPath = path.join(outputDir, `debug-visualization-${timestamp}.html`);
    const reportPath = path.join(outputDir, `debug-report-${timestamp}.json`);
    
    // Create HTML debug visualization
    const debugHtml = await createDebugHTMLVisualization(imagePath, aiSegmentation, debugHtmlPath, keyboardBox);
    
    // Create detailed report
    const report = {
      timestamp: new Date().toISOString(),
      originalImage: imagePath,
      debugHtml: debugHtml,
      aiSegmentation: aiSegmentation,
      objectCount: aiSegmentation ? aiSegmentation.length : 0,
      objects: aiSegmentation ? aiSegmentation.map((obj, index) => ({
        index: index + 1,
        label: obj.label || 'unknown',
        box_2d: obj.box_2d,
        hasMask: !!obj.mask,
        confidence: obj.confidence || 'unknown'
      })) : []
    };
    
    // Save report to file
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`[DEBUG] Debug report saved: ${reportPath}`);
    console.log(`[DEBUG] Debug HTML visualization: ${debugHtml}`);
    console.log(`[DEBUG] Found ${report.objectCount} objects in the image`);
    
    return {
      success: true,
      debugHtml: debugHtml,
      reportPath: reportPath,
      objectCount: report.objectCount
    };
    
  } catch (error) {
    console.error('[DEBUG] Failed to create debug report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

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
        
        // Create debug report with AI analysis
        if (geminiApiKey) {
          try {
            const aiSegmentation = await analyzeImageSegmentation(screenshotPath, geminiApiKey);
            if (aiSegmentation && aiSegmentation.length > 0) {
              const debugResult = await createDebugReport(screenshotPath, aiSegmentation, outputDir, keyboardBox);
              if (debugResult.success) {
                console.log(`[SHINHAN] Debug report created: ${debugResult.reportPath}`);
                console.log(`[SHINHAN] Debug HTML visualization: ${debugResult.debugHtml}`);
              }
            }
          } catch (debugError) {
            console.warn('[SHINHAN] Failed to create debug report:', debugError);
          }
        }
        
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
            // const typer = new KeyboardTyper(page);
            
            // // Take screenshot of shift key area for debugging
            // console.log('[SHINHAN] Taking screenshot of shift key area...');
            // try {
            //   const shiftTimestamp = generateTimestamp();
            //   const shiftScreenshotPath = path.join(process.cwd(), 'output', `shift-key-area-${shiftTimestamp}.png`);
              
            //   // Ensure shift key is in viewport before screenshot
            //   const updatedBounds = await ensureElementInViewport(page, shiftKey.bounds);
              
            //   await page.screenshot({
            //     path: shiftScreenshotPath,
            //     clip: {
            //       x: Math.max(0, updatedBounds.x),
            //       y: Math.max(0, updatedBounds.y),
            //       width: updatedBounds.width,
            //       height: updatedBounds.height
            //     }
            //   });
              
            //   console.log('[SHINHAN] Shift key area screenshot saved:', shiftScreenshotPath);
            //   console.log('[SHINHAN] Shift key bounds used:', updatedBounds);
            // } catch (error) {
            //   console.warn('[SHINHAN] Failed to take shift key area screenshot:', error);
            // }
            
            // // Press shift key to analyze shift layout
            // const shiftSuccess = await typer.handleShiftKey(shiftKey, 'press');
            // if (shiftSuccess) {
            //   await page.waitForTimeout(CONFIG.DELAYS.KEYBOARD_RETURN);
            //   console.log('[SHINHAN] Shift key pressed successfully to analyze shift layout');
              
            //   // Take screenshot of shift key after clicking
            //   console.log('[SHINHAN] Taking post-shift screenshot...');
            //   await typer.takeKeyScreenshot('shift', 0, shiftKey, 'after');
            //   await typer.takeKeyboardWithKeyHighlight('shift', 0, shiftKey, 'after');
            // } else {
            //   console.warn('[SHINHAN] Failed to press shift key, continuing without shift...');
            // }
            console.log('[SHINHAN] Shift key found but logic commented out - not proceeding with shift operations');
          } else {
            console.warn('[SHINHAN] No shift key found in keyboard mapping, continuing without shift...');
          }
          
          // // Complete keyboard mapping and typing
          // const finalKeyboardKeys = { ...keyboardKeys, ...shiftKeyboardKeys };
          // console.log('[SHINHAN] Final keyboard mapping ready with', Object.keys(finalKeyboardKeys).length, 'keys');
          
          // const typer = new KeyboardTyper(page);
          // await typer.typeText(finalKeyboardKeys, password);
          console.log('[SHINHAN] Keyboard typing logic commented out - not proceeding with password typing');
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

module.exports = { 
  runShinhanAutomation,
  createDebugHTMLVisualization,
  createDebugReport
};