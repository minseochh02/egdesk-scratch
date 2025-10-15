// AI Keyboard Analyzer
// This file contains AI-powered keyboard analysis and typing functionality using segmentation masks

const { GoogleGenerativeAI } = require('@google/generative-ai');
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
 * @param {string} apiKey - Gemini API key
 * @param {string} targetItems - What to detect (e.g., "keyboard keys", "all objects")
 * @returns {Promise<SegmentationMask[]>} Array of segmentation results
 */
async function analyzeImageSegmentation(imagePath, apiKey, targetItems = 'keyboard keys') {
  try {
    console.log('[AI-KEYBOARD] Starting segmentation analysis...');
    
    // Initialize AI with the passed API key
    const ai = new GoogleGenerativeAI(apiKey);
    
    // Read image file
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Enhanced prompt to focus on keyboard keys and exclude logos/decorations
    const prompt = `Find all keyboard keys in this image. Include letters, numbers, and special character keys (like Enter, Shift, symbols, etc.). 
         EXCLUDE any logos, bank names, decorative text, or non-clickable elements. 
         Only segment the actual clickable keyboard keys.
         Output a JSON list of segmentation masks where each entry contains:
         - "box_2d": the 2D bounding box [ymin, xmin, ymax, xmax]
         - "mask": the segmentation mask
         - "label": a descriptive label for the key (e.g., "key_letter_a", "key_number_1", "key_shift_left", etc.)`

    // Use the same configuration as spatial-understanding
    const config = {
      temperature: 0.1
    };

    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/png'
              }
            },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: 65536
      }
    });

    const response = await result.response;
    let responseText = response.text();
    
    // Debug: Log the raw response
    console.log('[AI-KEYBOARD] Raw AI response length:', responseText.length);
    console.log('[AI-KEYBOARD] Raw AI response preview:', responseText.substring(0, 200) + '...');
    
    // Clean up response like spatial-understanding does
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0];
      console.log('[AI-KEYBOARD] Cleaned JSON response length:', responseText.length);
    }
    
    // Additional cleanup for common AI response issues
    responseText = responseText.trim();
    
    // Remove any leading/trailing non-JSON content
    const jsonStart = responseText.indexOf('[');
    const jsonEnd = responseText.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      responseText = responseText.substring(jsonStart, jsonEnd + 1);
    }
    
    console.log('[AI-KEYBOARD] Final JSON to parse:', responseText.substring(0, 500) + '...');
    
    // Parse JSON response with fallback
    let segmentations;
    try {
      segmentations = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('[AI-KEYBOARD] JSON parse failed, attempting to fix common issues...');
      
      // Try to fix common JSON issues
      let fixedResponse = responseText;
      
      // Fix trailing commas
      fixedResponse = fixedResponse.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix missing quotes around property names
      fixedResponse = fixedResponse.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // Try parsing again
      try {
        segmentations = JSON.parse(fixedResponse);
        console.log('[AI-KEYBOARD] Successfully parsed after fixing common issues');
      } catch (secondError) {
        console.error('[AI-KEYBOARD] Still failed to parse JSON after fixes:', secondError);
        throw parseError; // Throw original error
      }
    }
    
    console.log('[AI-KEYBOARD] Successfully analyzed image, found', segmentations.length, 'objects');
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
        rawResponse: responseText || 'No response text available',
        responseLength: responseText?.length || 0
      };
      
      const debugPath = path.join(debugDir, `ai-keyboard-error-${Date.now()}.json`);
      fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2));
      console.log('[AI-KEYBOARD] Saved error debug data to:', debugPath);
    } catch (debugError) {
      console.warn('[AI-KEYBOARD] Failed to save debug data:', debugError);
    }
    
    throw error;
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
 * @param {string} apiKey - Gemini API key
 * @param {Object} targetImageBox - Target image bounding box
 * @param {string} textToType - Text to type on keyboard
 * @param {Object} page - Playwright page object (optional)
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeKeyboardAndType(imagePath, apiKey, targetImageBox, textToType = 'hello', page = null) {
  try {
    console.log('[AI-KEYBOARD] Starting keyboard analysis and typing...');
    
    // Step 1: Analyze image with segmentation masks (detect all objects first)
    const segmentationResults = await analyzeImageSegmentation(imagePath, apiKey, 'all objects');
    
    // Step 2: Process segmentation results to get keyboard key positions
    const processResult = processSegmentationResults(segmentationResults, targetImageBox);
    
    if (!processResult.success) {
      throw new Error(`Failed to process segmentation results: ${processResult.error}`);
    }
    
    // Step 3: Type the specified text using the keyboard coordinates (only if textToType and page are provided)
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
      segmentationResults: segmentationResults
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
  calculateMaskCentroid
};

