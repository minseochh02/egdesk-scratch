// AI Keyboard Analyzer
// This file contains AI-powered keyboard analysis and typing functionality using segmentation masks

const fs = require('fs');
const path = require('path');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Segmentation mask result from AI
 * @typedef {Object} SegmentationMask
 * @property {[number, number, number, number]} box_2d - [ymin, xmin, ymax, xmax] format (normalized 0-1000)
 * @property {string} mask - Base64 encoded mask
 * @property {string} label - Text label for the object
 */

/**
 * Processed keyboard key data
 * @typedef {Object} KeyboardKey
 * @property {Object} position - Click position
 * @property {number} position.x - X coordinate
 * @property {number} position.y - Y coordinate
 * @property {Object} bounds - Bounding box
 * @property {number} bounds.x - X position
 * @property {number} bounds.y - Y position
 * @property {number} bounds.width - Width
 * @property {number} bounds.height - Height
 * @property {string} label - Key label
 * @property {string} mask - Base64 mask data
 * @property {[number, number, number, number]} aiBox - Original AI box data
 */

// ============================================================================
// SEGMENTATION MASK ANALYSIS
// ============================================================================

/**
 * Analyzes an image using segmentation masks to detect keyboard keys
 * @param {string} imagePath - Path to the image file
 * @param {string} apiKey - Roboflow API key
 * @param {string} targetItems - What to detect (e.g., "keyboard keys", "all objects")
 * @returns {Promise<SegmentationMask[]>} Array of segmentation results
 */
async function analyzeImageSegmentation(imagePath, apiKey, targetItems = 'keyboard keys') {
  try {
    console.log('[AI-KEYBOARD] Starting segmentation analysis with Roboflow...');
    
    // Read image file and convert to base64
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Prepare Roboflow API request
    const roboflowEndpoint = 'https://serverless.roboflow.com/visionmodeltest/workflows/custom-workflow-2';
    
    console.log('[AI-KEYBOARD] Sending request to Roboflow endpoint...');
    
    // Send request to Roboflow
    const response = await fetch(roboflowEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        inputs: {
          image: {
            type: 'base64',
            value: base64Image
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Save raw response to JSON file for inspection
    try {
      const debugDir = path.join(process.cwd(), 'output', 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const rawResponsePath = path.join(debugDir, `roboflow-raw-response-${timestamp}.json`);
      fs.writeFileSync(rawResponsePath, JSON.stringify(result, null, 2));
      console.log('[AI-KEYBOARD] Raw Roboflow response saved to:', rawResponsePath);
    } catch (saveError) {
      console.warn('[AI-KEYBOARD] Failed to save raw response:', saveError);
    }
    
    // Parse Roboflow response and convert to expected format
    // Roboflow response format may vary - adjust based on actual response structure
    let segmentations = [];
    
    // Check if result has predictions or detections
    if (result.outputs && Array.isArray(result.outputs)) {
      // Handle workflow outputs format
      console.log('[AI-KEYBOARD] Found outputs array, length:', result.outputs.length);
      const outputs = result.outputs;
      for (const output of outputs) {
        // Check for model_predictions (Roboflow workflow format)
        if (output.model_predictions && output.model_predictions.predictions && Array.isArray(output.model_predictions.predictions)) {
          const predictions = output.model_predictions.predictions;
          const imageWidth = output.model_predictions.image?.width || 1;
          const imageHeight = output.model_predictions.image?.height || 1;
          
          console.log('[AI-KEYBOARD] Found predictions in model_predictions, count:', predictions.length);
          console.log('[AI-KEYBOARD] Image dimensions:', imageWidth, 'x', imageHeight);
          
          segmentations = predictions.map((pred, idx) => {
            // Convert Roboflow format to expected format
            // Roboflow returns {x, y, width, height, class, confidence}
            // We need to convert to {box_2d: [ymin, xmin, ymax, xmax], mask, label}
            
            const x = pred.x || 0;
            const y = pred.y || 0;
            const width = pred.width || 0;
            const height = pred.height || 0;
            
            // Convert center coordinates to corner coordinates
            const xmin = x - width / 2;
            const ymin = y - height / 2;
            const xmax = x + width / 2;
            const ymax = y + height / 2;
            
            // Normalize to 0-1000 range (Roboflow returns pixel coordinates)
            const normalizedXmin = (xmin / imageWidth) * 1000;
            const normalizedYmin = (ymin / imageHeight) * 1000;
            const normalizedXmax = (xmax / imageWidth) * 1000;
            const normalizedYmax = (ymax / imageHeight) * 1000;
            
            return {
              box_2d: [normalizedYmin, normalizedXmin, normalizedYmax, normalizedXmax],
              mask: '', // Roboflow object detection doesn't provide masks
              label: pred.class || pred.label || `key_${idx}`
            };
          });
          console.log('[AI-KEYBOARD] Mapped', segmentations.length, 'predictions from model_predictions');
          break;
        }
        // Fallback: check for direct predictions array (older format)
        else if (output.predictions && Array.isArray(output.predictions)) {
          console.log('[AI-KEYBOARD] Found predictions in output, count:', output.predictions.length);
          segmentations = output.predictions.map((pred, idx) => {
            const x = pred.x || 0;
            const y = pred.y || 0;
            const width = pred.width || 0;
            const height = pred.height || 0;
            
            const xmin = x - width / 2;
            const ymin = y - height / 2;
            const xmax = x + width / 2;
            const ymax = y + height / 2;
            
            const imageWidth = pred.image_width || 1;
            const imageHeight = pred.image_height || 1;
            
            const normalizedXmin = (xmin / imageWidth) * 1000;
            const normalizedYmin = (ymin / imageHeight) * 1000;
            const normalizedXmax = (xmax / imageWidth) * 1000;
            const normalizedYmax = (ymax / imageHeight) * 1000;
            
            return {
              box_2d: [normalizedYmin, normalizedXmin, normalizedYmax, normalizedXmax],
              mask: '',
              label: pred.class || pred.label || `key_${idx}`
            };
          });
          console.log('[AI-KEYBOARD] Mapped', segmentations.length, 'predictions from outputs');
          break;
        }
      }
    } else if (result.predictions && Array.isArray(result.predictions)) {
      // Handle direct predictions format
      console.log('[AI-KEYBOARD] Found direct predictions array, count:', result.predictions.length);
      segmentations = result.predictions.map((pred, idx) => {
        const x = pred.x || 0;
        const y = pred.y || 0;
        const width = pred.width || 0;
        const height = pred.height || 0;
        
        const xmin = x - width / 2;
        const ymin = y - height / 2;
        const xmax = x + width / 2;
        const ymax = y + height / 2;
        
        const imageWidth = pred.image_width || 1;
        const imageHeight = pred.image_height || 1;
        
        const normalizedXmin = (xmin / imageWidth) * 1000;
        const normalizedYmin = (ymin / imageHeight) * 1000;
        const normalizedXmax = (xmax / imageWidth) * 1000;
        const normalizedYmax = (ymax / imageHeight) * 1000;
        
        return {
          box_2d: [normalizedYmin, normalizedXmin, normalizedYmax, normalizedXmax],
          mask: pred.mask || '',
          label: pred.class || pred.label || `key_${idx}`
        };
      });
      console.log('[AI-KEYBOARD] Mapped', segmentations.length, 'predictions from direct predictions');
    } else {
      console.warn('[AI-KEYBOARD] ⚠️ Could not find predictions in response!');
      console.warn('[AI-KEYBOARD] Available top-level keys:', Object.keys(result));
    }
    
    console.log('[AI-KEYBOARD] Successfully analyzed image, found', segmentations.length, 'objects');
    
    // Save parsed segmentations for debugging
    if (segmentations.length > 0) {
      try {
        const debugDir = path.join(process.cwd(), 'output', 'debug');
        const timestamp = Date.now();
        const parsedPath = path.join(debugDir, `roboflow-parsed-segmentations-${timestamp}.json`);
        fs.writeFileSync(parsedPath, JSON.stringify(segmentations, null, 2));
        console.log('[AI-KEYBOARD] Parsed segmentations saved to:', parsedPath);
      } catch (saveError) {
        console.warn('[AI-KEYBOARD] Failed to save parsed segmentations:', saveError);
      }
    }
    
    return segmentations;
  } catch (error) {
    console.error('[AI-KEYBOARD] Error analyzing image segmentation:', error);
    
    // Save the problematic response for debugging
    try {
      const debugDir = path.join(process.cwd(), 'output', 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugData = {
        timestamp: new Date().toISOString(),
        imagePath: imagePath,
        error: error.message,
        errorStack: error.stack
      };
      
      const debugPath = path.join(debugDir, `roboflow-error-${Date.now()}.json`);
      fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2));
      console.log('[AI-KEYBOARD] Saved error debug data to:', debugPath);
    } catch (debugError) {
      console.warn('[AI-KEYBOARD] Failed to save debug data:', debugError);
    }
    
    throw error;
  }
}

// ============================================================================
// SHIFT KEY HANDLING
// ============================================================================

/**
 * Finds the shift key from segmentation results
 * @param {SegmentationMask[]} segmentationResults - AI segmentation results
 * @param {Object} targetImageBox - Target image bounding box
 * @returns {Object|null} Shift key position and bounds or null if not found
 */
function findShiftKey(segmentationResults, targetImageBox) {
  try {
    console.log('[AI-KEYBOARD] Searching for shift key...');
    
    // Look for shift key in segmentation results
    const shiftKey = segmentationResults.find(obj => {
      const label = (obj.label || '').toLowerCase();
      return label.includes('shift');
    });
    
    if (!shiftKey) {
      console.warn('[AI-KEYBOARD] Shift key not found in segmentation results');
      return null;
    }
    
    console.log('[AI-KEYBOARD] Found shift key with label:', shiftKey.label);
    
    // Convert AI box to absolute coordinates
    const aiBox = shiftKey.box_2d; // [ymin, xmin, ymax, xmax]
    const [ymin, xmin, ymax, xmax] = aiBox;
    const normalizedX = xmin / 1000;
    const normalizedY = ymin / 1000;
    const normalizedWidth = (xmax - xmin) / 1000;
    const normalizedHeight = (ymax - ymin) / 1000;
    
    const relativeX = normalizedX * targetImageBox.width;
    const relativeY = normalizedY * targetImageBox.height;
    const relativeWidth = normalizedWidth * targetImageBox.width;
    const relativeHeight = normalizedHeight * targetImageBox.height;
    
    const absoluteX = targetImageBox.x + relativeX;
    const absoluteY = targetImageBox.y + relativeY;
    
    const bounds = {
      x: Math.round(absoluteX),
      y: Math.round(absoluteY),
      width: Math.round(relativeWidth),
      height: Math.round(relativeHeight)
    };
    
    // Calculate center position for clicking
    const centerX = absoluteX + (relativeWidth / 2);
    const centerY = absoluteY + (relativeHeight / 2);
    
    return {
      position: {
        x: Math.round(centerX),
        y: Math.round(centerY)
      },
      bounds: bounds,
      label: shiftKey.label
    };
  } catch (error) {
    console.error('[AI-KEYBOARD] Error finding shift key:', error);
    return null;
  }
}

/**
 * Captures shifted keyboard state by clicking shift, taking screenshot, and unshifting
 * @param {Object} page - Playwright page object
 * @param {string} keyboardXPath - XPath to keyboard element
 * @param {SegmentationMask[]} segmentationResults - AI segmentation results
 * @param {Object} targetImageBox - Target image bounding box
 * @param {string} outputDir - Directory to save screenshot
 * @returns {Promise<Object>} Result with screenshot path and shift key info
 */
async function captureShiftedKeyboard(page, keyboardXPath, segmentationResults, targetImageBox, outputDir) {
  try {
    console.log('\n[AI-KEYBOARD] ===== CAPTURING SHIFTED KEYBOARD =====');
    
    // Find shift key
    const shiftKey = findShiftKey(segmentationResults, targetImageBox);
    
    if (!shiftKey) {
      console.warn('[AI-KEYBOARD] Cannot capture shifted keyboard - shift key not found');
      return {
        success: false,
        error: 'Shift key not found',
        screenshotPath: null
      };
    }
    
    console.log(`[AI-KEYBOARD] Shift key found at position (${shiftKey.position.x}, ${shiftKey.position.y})`);
    
    // Click shift to activate
    console.log('[AI-KEYBOARD] Clicking shift key to activate...');
    await page.mouse.move(shiftKey.position.x, shiftKey.position.y);
    await page.waitForTimeout(100); // Small delay before clicking
    await page.mouse.click(shiftKey.position.x, shiftKey.position.y);
    await page.waitForTimeout(500); // Wait for keyboard to update
    
    console.log('[AI-KEYBOARD] Shift activated, taking screenshot...');
    
    // Take screenshot of shifted keyboard
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `keyboard-shifted-${timestamp}.png`;
    const screenshotPath = path.join(outputDir, filename);
    
    const keyboardLocator = page.locator(`xpath=${keyboardXPath}`);
    await keyboardLocator.screenshot({ path: screenshotPath });
    
    console.log('[AI-KEYBOARD] Shifted keyboard screenshot saved to:', screenshotPath);
    
    // Click shift again to deactivate
    console.log('[AI-KEYBOARD] Clicking shift key to deactivate...');
    await page.mouse.click(shiftKey.position.x, shiftKey.position.y);
    await page.waitForTimeout(300); // Wait for keyboard to return to normal
    
    console.log('[AI-KEYBOARD] Shift deactivated, keyboard returned to normal state');
    
    return {
      success: true,
      screenshotPath: screenshotPath,
      shiftKey: {
        position: shiftKey.position,
        bounds: shiftKey.bounds,
        label: shiftKey.label
      }
    };
  } catch (error) {
    console.error('[AI-KEYBOARD] Error capturing shifted keyboard:', error);
    return {
      success: false,
      error: error.message,
      screenshotPath: null
    };
  }
}

// ============================================================================
// KEYBOARD KEY PROCESSING
// ============================================================================

/**
 * Decodes base64 RLE mask and finds centroid (center of mass) for click position
 * @param {string} maskBase64 - Base64 encoded RLE mask
 * @param {Object} bounds - Bounding box {x, y, width, height}
 * @param {Object} targetImageBox - Target image bounding box
 * @returns {Object} Click position {x, y} or null if mask is invalid
 */
function calculateMaskCentroid(maskBase64, bounds, targetImageBox) {
  try {
    // Decode base64 mask
    const maskBuffer = Buffer.from(maskBase64, 'base64');
    
    // RLE decode - mask is run-length encoded
    const pixels = [];
    for (let i = 0; i < maskBuffer.length; i += 2) {
      const value = maskBuffer[i];
      const count = i + 1 < maskBuffer.length ? maskBuffer[i + 1] : 1;
      for (let j = 0; j < count; j++) {
        pixels.push(value > 0 ? 1 : 0);
      }
    }
    
    // Calculate centroid of mask pixels
    let sumX = 0, sumY = 0, totalPixels = 0;
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    
    for (let i = 0; i < pixels.length && i < width * height; i++) {
      if (pixels[i] === 1) {
        const x = i % width;
        const y = Math.floor(i / width);
        sumX += x;
        sumY += y;
        totalPixels++;
      }
    }
    
    if (totalPixels === 0) {
      // Fallback to box center if no valid pixels
      return null;
    }
    
    // Calculate centroid in relative coordinates
    const centroidX = sumX / totalPixels;
    const centroidY = sumY / totalPixels;
    
    // Convert to absolute page coordinates
    const absoluteX = bounds.x + centroidX;
    const absoluteY = bounds.y + centroidY;
    
    return {
      x: Math.round(absoluteX),
      y: Math.round(absoluteY)
    };
  } catch (error) {
    console.warn('[AI-KEYBOARD] Failed to decode mask for centroid calculation:', error.message);
    return null;
  }
}

/**
 * Processes segmentation results to extract keyboard key positions
 * @param {SegmentationMask[]} segmentationResults - AI segmentation results
 * @param {Object} targetImageBox - Target image bounding box {x, y, width, height}
 * @returns {Object} Processed keyboard keys
 */
function processSegmentationResults(segmentationResults, targetImageBox) {
  try {
    console.log('[AI-KEYBOARD] Processing segmentation results...');
    console.log('[AI-KEYBOARD] Found', segmentationResults.length, 'objects in the image');
    console.log('[AI-KEYBOARD] Target image bounds:', targetImageBox);
    
    const keyboardKeys = {};
    
    // Process each segmented object - EXACTLY like spatial-understanding
    segmentationResults.forEach((obj, index) => {
      const aiBox = obj.box_2d; // [ymin, xmin, ymax, xmax] from AI (normalized 0-1000)
      // Use label as primary key label, fallback to index
      const keyLabel = obj.label || `key_${index}`;
      
      // Convert from [ymin, xmin, ymax, xmax] format to [x, y, width, height]
      // EXACTLY like spatial-understanding: normalize by 1000
      const [ymin, xmin, ymax, xmax] = aiBox;
      const normalizedX = xmin / 1000; // Convert from 0-1000 to 0-1
      const normalizedY = ymin / 1000;
      const normalizedWidth = (xmax - xmin) / 1000;
      const normalizedHeight = (ymax - ymin) / 1000;
      
      // Calculate relative position within the target image (for clicking)
      const relativeX = normalizedX * targetImageBox.width;
      const relativeY = normalizedY * targetImageBox.height;
      const relativeWidth = normalizedWidth * targetImageBox.width;
      const relativeHeight = normalizedHeight * targetImageBox.height;
      
      // Convert to absolute page coordinates (for clicking)
      const absoluteX = targetImageBox.x + relativeX;
      const absoluteY = targetImageBox.y + relativeY;
      
      const bounds = {
        x: Math.round(absoluteX),
        y: Math.round(absoluteY),
        width: Math.round(relativeWidth),
        height: Math.round(relativeHeight)
      };
      
      // Try to calculate centroid from mask for more accurate click position
      let clickPosition = calculateMaskCentroid(obj.mask, bounds, targetImageBox);
      
      // Fallback to box center if mask centroid fails
      if (!clickPosition) {
        const centerX = absoluteX + (relativeWidth / 2);
        const centerY = absoluteY + (relativeHeight / 2);
        clickPosition = {
          x: Math.round(centerX),
          y: Math.round(centerY)
        };
        console.log(`[AI-KEYBOARD] Using box center for ${keyLabel} (mask centroid failed)`);
      } else {
        console.log(`[AI-KEYBOARD] Using mask centroid for ${keyLabel}`);
      }
      
      keyboardKeys[keyLabel] = {
        // Normalized values (0-1) for percentage-based rendering like spatial-understanding
        normalized: {
          x: normalizedX,
          y: normalizedY,
          width: normalizedWidth,
          height: normalizedHeight
        },
        // Pixel values for clicking - now uses mask centroid!
        position: clickPosition,
        bounds: bounds,
        label: obj.label,
        mask: obj.mask,
        aiBox: aiBox
      };
    });
    
    // Log keyboard keys by category
    console.log('\n[AI-KEYBOARD] ===== KEYBOARD KEY POSITIONS =====');
    
    // Group by label type
    const byType = {};
    Object.entries(keyboardKeys).forEach(([key, data]) => {
      if (!byType[data.label]) byType[data.label] = {};
      byType[data.label][key] = data;
    });
    
    // Log each type
    Object.entries(byType).forEach(([type, keys]) => {
      console.log(`\n[AI-KEYBOARD] ${type.toUpperCase()} KEYS:`);
      Object.entries(keys).forEach(([keyLabel, keyData]) => {
        console.log(`[AI-KEYBOARD] ${keyLabel}: position(${keyData.position.x}, ${keyData.position.y}) bounds(${keyData.bounds.x}, ${keyData.bounds.y}, ${keyData.bounds.width}, ${keyData.bounds.height})`);
      });
    });
    
    // Log all keys in a single summary
    console.log('\n[AI-KEYBOARD] ===== ALL KEYS SUMMARY =====');
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
      console.log(`[AI-KEYBOARD] ${keyLabel}: (${keyData.position.x}, ${keyData.position.y})`);
    });
    
    return { success: true, processed: segmentationResults.length, keyboardKeys };
  } catch (error) {
    console.error('[AI-KEYBOARD] Error processing segmentation results:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// KEYBOARD TYPING
// ============================================================================

/**
 * Types text using keyboard coordinates
 * @param {Object} keyboardKeys - Processed keyboard key data
 * @param {string} text - Text to type
 * @param {Object} page - Playwright page object (optional)
 * @returns {Promise<void>}
 */
async function typeTextWithKeyboard(keyboardKeys, text, page = null) {
  try {
    console.log(`[AI-KEYBOARD] Attempting to type "${text}" using keyboard coordinates...`);
    
    // Create a mapping of characters to their positions
    const charMap = {};
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
      // Extract character from the label field (e.g., "Key: n / ㅜ" -> "n")
      let char = '';
      
      // Parse the label field to extract the main character
      const label = keyData.label || '';
      if (label.toLowerCase().includes('key:')) {
        // Format: "Key: n / ㅜ" -> extract "n"
        const match = label.match(/key:\s*([a-z0-9])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.match(/^[a-z]\s*\/\s*[ㅏ-ㅣ]/i)) {
        // Format: "a / ㅏ key" -> extract "a"
        const match = label.match(/^([a-z])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.toLowerCase().includes('enter')) {
        char = 'enter';
      } else if (label.toLowerCase().includes('shift')) {
        char = 'shift';
      } else if (label.toLowerCase().includes('space')) {
        char = ' ';
      } else {
        // Fallback: try to extract single character from label
        const singleCharMatch = label.match(/\b([a-z0-9])\b/i);
        if (singleCharMatch) {
          char = singleCharMatch[1].toLowerCase();
        }
      }
      
      // If we found a valid character, map it
      if (char && ((char.length === 1 && /[a-z0-9]/.test(char)) || char === 'enter' || char === 'shift' || char === ' ')) {
        charMap[char] = keyData;
      }
    });
    
    console.log('[AI-KEYBOARD] Available characters:', Object.keys(charMap));
    
    // Click on all characters in the text
    const textToType = text.toLowerCase();
    console.log(`[AI-KEYBOARD] Clicking on all characters: "${textToType}"`);
    
    for (let i = 0; i < textToType.length; i++) {
      const char = textToType[i];
      if (charMap[char]) {
        const keyData = charMap[char];
        console.log(`[AI-KEYBOARD] Clicking '${char}' at position (${keyData.position.x}, ${keyData.position.y})`);
        
        if (page) {
          try {
            // Take a screenshot before clicking for debugging
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(process.cwd(), 'output', `key-${char}-${i + 1}-before-${timestamp}.png`);
            
            // Take screenshot of the key bounds before clicking
            await page.screenshot({
              path: screenshotPath,
              clip: {
                x: keyData.bounds.x,
                y: keyData.bounds.y,
                width: keyData.bounds.width,
                height: keyData.bounds.height
              }
            });
            
            console.log(`[AI-KEYBOARD] Pre-click screenshot saved: ${screenshotPath}`);
            console.log(`[AI-KEYBOARD] Key '${char}' bounds: x=${keyData.bounds.x}, y=${keyData.bounds.y}, w=${keyData.bounds.width}, h=${keyData.bounds.height}`);
            
            // Move mouse to the key position and click
            await page.mouse.move(keyData.position.x, keyData.position.y);
            await page.waitForTimeout(100); // Small delay before clicking
            await page.mouse.click(keyData.position.x, keyData.position.y);
            await page.waitForTimeout(200); // Delay after clicking
            
            console.log(`[AI-KEYBOARD] Successfully clicked '${char}' at (${keyData.position.x}, ${keyData.position.y})`);
            
            // Take a screenshot after clicking to see the result
            const afterScreenshotPath = path.join(process.cwd(), 'output', `key-${char}-${i + 1}-after-${timestamp}.png`);
            await page.screenshot({
              path: afterScreenshotPath,
              clip: {
                x: keyData.bounds.x,
                y: keyData.bounds.y,
                width: keyData.bounds.width,
                height: keyData.bounds.height
              }
            });
            console.log(`[AI-KEYBOARD] Post-click screenshot saved: ${afterScreenshotPath}`);
            
          } catch (clickError) {
            console.error(`[AI-KEYBOARD] Failed to click '${char}':`, clickError);
          }
        } else {
          console.log(`[AI-KEYBOARD] No page object available, would click at (${keyData.position.x}, ${keyData.position.y})`);
        }
      } else {
        console.warn(`[AI-KEYBOARD] Character '${char}' not found in keyboard mapping`);
      }
    }
    
    console.log(`[AI-KEYBOARD] Finished typing "${text}"`);
  } catch (error) {
    console.error('[AI-KEYBOARD] Error typing text:', error);
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Main function to analyze keyboard and type text
 * @param {string} imagePath - Path to keyboard screenshot
 * @param {string} apiKey - Roboflow API key
 * @param {Object} targetImageBox - Target image bounding box
 * @param {string} textToType - Text to type on keyboard
 * @param {Object} page - Playwright page object (optional)
 * @param {Object} options - Additional options
 * @param {string} options.keyboardXPath - XPath to keyboard element (for shift capture)
 * @param {string} options.outputDir - Output directory for shifted keyboard screenshot
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeKeyboardAndType(imagePath, apiKey, targetImageBox, textToType = 'hello', page = null, options = {}) {
  try {
    console.log('[AI-KEYBOARD] Starting keyboard analysis and typing...');
    
    // Step 1: Analyze image with segmentation masks (detect all objects first)
    const segmentationResults = await analyzeImageSegmentation(imagePath, apiKey, 'all objects');
    
    // Step 2: Capture shifted keyboard if page and options are provided
    let shiftedKeyboardResult = null;
    if (page && options.keyboardXPath && options.outputDir) {
      console.log('[AI-KEYBOARD] Capturing shifted keyboard state...');
      shiftedKeyboardResult = await captureShiftedKeyboard(
        page,
        options.keyboardXPath,
        segmentationResults,
        targetImageBox,
        options.outputDir
      );
      
      if (shiftedKeyboardResult.success) {
        console.log('[AI-KEYBOARD] Shifted keyboard captured successfully');
      } else {
        console.warn('[AI-KEYBOARD] Failed to capture shifted keyboard:', shiftedKeyboardResult.error);
      }
    } else {
      console.log('[AI-KEYBOARD] Skipping shifted keyboard capture - missing page or options');
    }
    
    // Step 3: Process segmentation results to get keyboard key positions
    const processResult = processSegmentationResults(segmentationResults, targetImageBox);
    
    if (!processResult.success) {
      throw new Error(`Failed to process segmentation results: ${processResult.error}`);
    }
    
    // Step 4: Type the specified text using the keyboard coordinates (only if textToType and page are provided)
    if (textToType && page && processResult.keyboardKeys && Object.keys(processResult.keyboardKeys).length > 0) {
      console.log(`\n[AI-KEYBOARD] ===== TYPING "${textToType.toUpperCase()}" =====`);
      await typeTextWithKeyboard(processResult.keyboardKeys, textToType, page);
    } else if (!textToType || !page) {
      console.log('[AI-KEYBOARD] Skipping typing - only analyzing keyboard layout');
    }
    
    return {
      success: true,
      processed: processResult.processed,
      keyboardKeys: processResult.keyboardKeys,
      segmentationResults: segmentationResults,
      shiftedKeyboard: shiftedKeyboardResult
    };
  } catch (error) {
    console.error('[AI-KEYBOARD] Error in keyboard analysis and typing:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  analyzeImageSegmentation,
  processSegmentationResults,
  typeTextWithKeyboard,
  analyzeKeyboardAndType,
  calculateMaskCentroid,
  findShiftKey,
  captureShiftedKeyboard
};

