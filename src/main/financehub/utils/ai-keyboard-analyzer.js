// AI Keyboard Analyzer
// This file contains AI-powered keyboard analysis and typing functionality using Gemini 3 Vision

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { getStore } = require('../../storage');

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
// GEMINI 3 API KEY MANAGEMENT
// ============================================================================

/**
 * Gets the Gemini API key from environment or electron-store
 * Uses the same pattern as other parts of the codebase (ai-search.ts, gemini/index.ts)
 * @returns {string|null} API key or null if not found
 */
function getGeminiApiKey() {
  // Try environment variable first
  if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
    return process.env.GEMINI_API_KEY.trim();
  }
  
  // Try electron-store via getStore helper (same pattern as gemini/index.ts)
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[AI-KEYBOARD] Store not available');
      return null;
    }
    
    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[AI-KEYBOARD] AI keys not found or not an array');
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
        return apiKey.trim();
      }
    }
  } catch (error) {
    console.warn('[AI-KEYBOARD] Failed to get API key from store:', error);
  }
  
  return null;
}

/**
 * Get a safe debug directory that avoids Windows permission issues
 * @returns {string} Safe debug directory path
 */
function getSafeDebugDir() {
  try {
    // Try app userData directory first
    const { app } = require('electron');
    const baseDir = path.join(app.getPath('userData'), 'debug');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch (error) {
    // Fallback to user home directory
    const os = require('os');
    const userHome = os.homedir();
    const baseDir = path.join(userHome, '.egdesk-debug');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }
}

// ============================================================================
// GEMINI 3 VISION ANALYSIS
// ============================================================================

/**
 * Analyzes an image using Gemini 3 Vision to detect keyboard keys
 * @param {string} imagePath - Path to the image file
 * @param {string} apiKey - Gemini API key (optional, will use stored key if not provided)
 * @param {string} targetItems - What to detect (e.g., "keyboard keys", "all objects")
 * @returns {Promise<SegmentationMask[]>} Array of segmentation results
 */
async function analyzeImageSegmentation(imagePath, apiKey, targetItems = 'keyboard keys') {
  try {
    console.log('[AI-KEYBOARD] Starting keyboard analysis with Gemini 3 Vision...');
    
    // Get API key
    const effectiveApiKey = apiKey || getGeminiApiKey();
    if (!effectiveApiKey) {
      throw new Error('Gemini API key not found. Set GEMINI_API_KEY environment variable or configure in AI Keys Manager.');
    }
    
    // Initialize Gemini 3 client
    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    
    // Read image file and convert to base64
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    
    console.log('[AI-KEYBOARD] Sending request to Gemini 3 Vision API...');
    console.log('[AI-KEYBOARD] Image size:', imageData.length, 'bytes');
    
    // Prepare the prompt for keyboard detection
    const prompt = `Analyze this virtual keyboard image. Detect ALL keys visible on the keyboard.

For each key, return:
1. The key's label/character (what's written on the key - including Korean characters like ㅏ, ㅓ, ㄱ, ㄴ, etc.)
2. The bounding box coordinates as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale

Return your response as a JSON array with this exact format:
{
  "keys": [
    {
      "label": "a / ㅏ",
      "box_2d": [ymin, xmin, ymax, xmax]
    },
    {
      "label": "shift",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}

Important:
- Include ALL keys: letters, numbers, special characters, shift, enter, space, backspace, etc.
- For Korean keyboard layouts, include both English and Korean characters on dual-character keys
- Coordinates should be normalized: 0 = top/left edge, 1000 = bottom/right edge
- Be precise with bounding boxes - they should tightly fit each key
- Return ONLY the JSON, no other text`;

    // Send request to Gemini 3
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            { text: prompt },
            { 
              inlineData: { 
                mimeType: mimeType, 
                data: base64Image 
              } 
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for precise detection
        maxOutputTokens: 8192,
      }
    });
    
    // Extract text response
    const responseText = response.text || 
      (response.candidates?.[0]?.content?.parts?.[0]?.text) || 
      '';
    
    console.log('[AI-KEYBOARD] Gemini 3 response received, length:', responseText.length);
    
    // Save raw response for debugging
    try {
      const debugDir = this.getSafeDebugDir();
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const rawResponsePath = path.join(debugDir, `gemini3-raw-response-${timestamp}.json`);
      fs.writeFileSync(rawResponsePath, JSON.stringify({ 
        responseText,
        model: 'gemini-3-pro-preview',
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log('[AI-KEYBOARD] Raw Gemini 3 response saved to:', rawResponsePath);
    } catch (saveError) {
      console.warn('[AI-KEYBOARD] Failed to save raw response:', saveError);
    }
    
    // Parse JSON from response
    let parsedResult;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = responseText;
      
      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Clean up any trailing/leading whitespace
      jsonStr = jsonStr.trim();
      
      parsedResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[AI-KEYBOARD] Failed to parse Gemini 3 response as JSON:', parseError);
      console.error('[AI-KEYBOARD] Response text:', responseText.substring(0, 500));
      throw new Error(`Failed to parse Gemini 3 response: ${parseError.message}`);
    }
    
    // Convert to expected segmentation format
    const keys = parsedResult.keys || parsedResult || [];
    
    if (!Array.isArray(keys)) {
      console.warn('[AI-KEYBOARD] Unexpected response format, keys is not an array');
      throw new Error('Gemini 3 response does not contain a valid keys array');
    }
    
    const segmentations = keys.map((key, idx) => {
      // Validate box_2d format
      let box_2d = key.box_2d || key.bbox || key.bounds || [0, 0, 100, 100];
      
      // Ensure it's an array of 4 numbers
      if (!Array.isArray(box_2d) || box_2d.length !== 4) {
        console.warn(`[AI-KEYBOARD] Invalid box_2d for key ${key.label}, using default`);
        box_2d = [0, 0, 100, 100];
      }
      
      return {
        box_2d: box_2d.map(v => Number(v) || 0), // [ymin, xmin, ymax, xmax]
        mask: '', // Gemini doesn't provide masks
        label: key.label || key.character || key.text || `key_${idx}`
      };
    });
    
    console.log('[AI-KEYBOARD] Successfully analyzed image with Gemini 3, found', segmentations.length, 'keys');
    
    // Log some detected keys for verification
    if (segmentations.length > 0) {
      console.log('[AI-KEYBOARD] Sample detected keys:');
      segmentations.slice(0, 5).forEach((seg, i) => {
        console.log(`  ${i + 1}. "${seg.label}" at [${seg.box_2d.join(', ')}]`);
      });
      if (segmentations.length > 5) {
        console.log(`  ... and ${segmentations.length - 5} more keys`);
      }
    }
    
    // Save parsed segmentations for debugging
    if (segmentations.length > 0) {
      try {
        const debugDir = this.getSafeDebugDir();
        const timestamp = Date.now();
        const parsedPath = path.join(debugDir, `gemini3-parsed-segmentations-${timestamp}.json`);
        fs.writeFileSync(parsedPath, JSON.stringify(segmentations, null, 2));
        console.log('[AI-KEYBOARD] Parsed segmentations saved to:', parsedPath);
      } catch (saveError) {
        console.warn('[AI-KEYBOARD] Failed to save parsed segmentations:', saveError);
      }
    }
    
    return segmentations;
  } catch (error) {
    console.error('[AI-KEYBOARD] Error analyzing image with Gemini 3:', error);
    
    // Save error details for debugging
    try {
      const debugDir = this.getSafeDebugDir();
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugData = {
        timestamp: new Date().toISOString(),
        imagePath: imagePath,
        model: 'gemini-3-pro-preview',
        error: error.message,
        errorStack: error.stack
      };
      
      const debugPath = path.join(debugDir, `gemini3-error-${Date.now()}.json`);
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
    
    // Group by label type
    const byType = {};
    Object.entries(keyboardKeys).forEach(([key, data]) => {
      if (!byType[data.label]) byType[data.label] = {};
      byType[data.label][key] = data;
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
            const screenshotPath = path.join(getSafeDebugDir(), `key-${char}-${i + 1}-before-${timestamp}.png`);
            
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
            const afterScreenshotPath = path.join(getSafeDebugDir(), `key-${char}-${i + 1}-after-${timestamp}.png`);
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
 * @param {string} apiKey - Gemini API key (optional, will use stored key if not provided)
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

