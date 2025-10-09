const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImageSegmentation } = require('./ai-vision/test');
const { createDebugHTMLVisualization: extCreateDebugHTMLVisualization, createDebugReport: extCreateDebugReport } = require('./debug/visualization');

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
// DEBUG FUNCTIONS (moved to ./debug/visualization)
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
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f0f0f0;
            position: relative;
        }
        .container { 
            position: absolute; 
            display: inline-block; 
            left: ${keyboardBox.x}px; 
            top: ${keyboardBox.y}px; 
            z-index: 1000;
        }
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
    <p><strong>Keyboard positioned at Shinhan website coordinates:</strong> (${keyboardBox.x}, ${keyboardBox.y})</p>
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
        <p><strong>Note:</strong> The image container is positioned at the exact Shinhan website keyboard coordinates (${keyboardBox.x}, ${keyboardBox.y}). Overlays are positioned relative to this image container.</p>
        
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
                Image container positioned at: (\${keyboardBox.x}, \${keyboardBox.y}) size: \${keyboardBox.width} × \${keyboardBox.height}<br>
                <strong>Note: Image is positioned at the exact Shinhan website keyboard coordinates</strong>
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
                
                // Overlays are positioned relative to the image container, which is positioned at keyboard screen coordinates
                const finalXmin = displayedXmin;
                const finalYmin = displayedYmin;
                const finalXmax = displayedXmax;
                const finalYmax = displayedYmax;
                
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
                console.log(\`  Final coords (relative to image container at screen pos \${keyboardBox.x},\${keyboardBox.y}): (\${finalXmin.toFixed(1)}, \${finalYmin.toFixed(1)}) to (\${finalXmax.toFixed(1)}, \${finalYmax.toFixed(1)})\`);
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
                
                // Overlays are positioned relative to the image container, which is positioned at keyboard screen coordinates
                const finalXmin = displayedXmin;
                const finalYmin = displayedYmin;
                const finalXmax = displayedXmax;
                const finalYmax = displayedYmax;
                
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
  // Check if we should use a persistent context (Chrome profile)
  const profilePath = CONFIG.CHROME_PROFILE || getDefaultChromeProfilePath();
  
  if (profilePath) {
    console.log('[SHINHAN] Using Chrome profile with persistent context:', profilePath);
    
    // Use launchPersistentContext for Chrome profile support
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: CONFIG.HEADLESS,
      channel: 'chrome',
      proxy,
      locale: 'ko-KR',
      // Set a larger viewport to accommodate the keyboard
      viewport: { width: 1280, height: 1024 }
    });
    
    // For persistent context, we don't get a separate browser object
    // Return the context as both browser and context for compatibility
    return { browser: context, context: context };
  } else {
    console.log('[SHINHAN] Using temporary Chrome profile (no persistent data)');
    
    // Use regular launch for temporary profile
    const browser = await chromium.launch({
      headless: CONFIG.HEADLESS,
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
              const debugResult = await extCreateDebugReport(screenshotPath, aiSegmentation, outputDir, keyboardBox);
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
      
      // Handle security popup in fallback mode too
      await handleSecurityPopup(page);
      await page.waitForTimeout(2000);
      
      // Try to fill ID field in fallback mode
      await fillInputField(page, CONFIG.XPATHS.ID_INPUT, id, 'Sinhan ID [FALLBACK]');
      
      return { success: true, fallback: true, boxes: null, clickedPoint: null, screenshotPath: null };
    } catch (fallbackError) {
      return { 
        success: false, 
        error: String(fallbackError && fallbackError.message ? fallbackError.message : fallbackError) 
      };
    }
  } finally {
    // Keep browser open for debugging - comment out cleanup
    // if (browser) {
    //   try {
    //     // Check if it's a persistent context (which has close method) or regular browser
    //     if (typeof browser.close === 'function') {
    //       await browser.close();
    //       console.log('[SHINHAN] Browser closed successfully');
    //     }
    //   } catch (cleanupError) {
    //     console.warn('[SHINHAN] Failed to close browser:', cleanupError);
    //   }
    // }
    console.log('[SHINHAN] Browser kept open for debugging');
  }
}

module.exports = { 
  runShinhanAutomation,
  createDebugHTMLVisualization: extCreateDebugHTMLVisualization,
  createDebugReport: extCreateDebugReport
};