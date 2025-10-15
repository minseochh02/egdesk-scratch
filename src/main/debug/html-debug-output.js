const path = require('path');
const fs = require('fs');

// ============================================================================
// HTML DEBUG OUTPUT MODULE
// ============================================================================

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
 * Generates timestamp for file naming
 * @returns {string} Formatted timestamp
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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
    
    // Log keyboard position info
    if (keyboardBox) {
      console.log('[DEBUG] Keyboard position on screen:', keyboardBox);
    } else {
      console.log('[DEBUG] No keyboard position provided, using (0,0)');
      keyboardBox = { x: 0, y: 0, width: 1000, height: 600 };
    }

    // Pre-calculate all overlay positions using the same logic as convertAiBoxToScreen
    const preCalculatedOverlays = aiSegmentation.map((obj, index) => {
      if (!obj.box_2d) return null;
      
      const [ymin, xmin, ymax, xmax] = obj.box_2d;
      
      // Step 1: Normalize AI coordinates (0-1000 range to 0-1 range)
      const normalizedXmin = xmin / 1000;
      const normalizedYmin = ymin / 1000;
      const normalizedXmax = xmax / 1000;
      const normalizedYmax = ymax / 1000;
      
      // Step 2: Scale to keyboard box dimensions
      const keyboardXmin = normalizedXmin * keyboardBox.width;
      const keyboardYmin = normalizedYmin * keyboardBox.height;
      const keyboardXmax = normalizedXmax * keyboardBox.width;
      const keyboardYmax = normalizedYmax * keyboardBox.height;
      
      // Step 3: Add keyboard screen offset to get absolute screen coordinates
      const finalXmin = keyboardBox.x + keyboardXmin;
      const finalYmin = keyboardBox.y + keyboardYmin;
      const finalXmax = keyboardBox.x + keyboardXmax;
      const finalYmax = keyboardBox.y + keyboardYmax;
      
      return {
        index,
        label: obj.label || `Object ${index + 1}`,
        rawCoords: { xmin, ymin, xmax, ymax },
        normalizedCoords: { 
          xmin: normalizedXmin, 
          ymin: normalizedYmin, 
          xmax: normalizedXmax, 
          ymax: normalizedYmax 
        },
        keyboardCoords: { 
          xmin: keyboardXmin, 
          ymin: keyboardYmin, 
          xmax: keyboardXmax, 
          ymax: keyboardYmax 
        },
        finalCoords: { 
          xmin: finalXmin, 
          ymin: finalYmin, 
          xmax: finalXmax, 
          ymax: finalYmax 
        },
        size: {
          width: finalXmax - finalXmin,
          height: finalYmax - finalYmin
        },
        confidence: obj.confidence || 'N/A'
      };
    }).filter(Boolean);
    
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
            position: relative; 
            display: inline-block; 
            left: ${keyboardBox.x}px; 
            top: ${keyboardBox.y}px; 
            z-index: 1000;
        }
        .original-image { 
            width: ${keyboardBox.width}px; 
            height: ${keyboardBox.height}px; 
            display: block;
        }
        .overlay { 
            position: fixed; 
            border: 3px solid; 
            opacity: 0.7; 
            pointer-events: none;
        }
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
    </div>
    
    <!-- Overlays positioned relative to page origin, not image container -->
    <div id="overlayContainer"></div>
    
    <div class="debug-info">
        <strong>Debug Info:</strong><br>
        <span id="imageDimensions">Image dimensions: ${keyboardBox.width} × ${keyboardBox.height} pixels</span><br>
        <span id="coordinateInfo">Using pre-calculated coordinates from Node.js</span>
    </div>
    
    <div class="info-panel">
        <h3>Detection Summary</h3>
        <p><strong>Total Objects Detected:</strong> ${aiSegmentation.length}</p>
        <p><strong>Original Image:</strong> ${path.basename(originalImagePath)}</p>
        <p><strong>Note:</strong> The image container is positioned at the exact Shinhan website keyboard coordinates (${keyboardBox.x}, ${keyboardBox.y}). Overlays use pre-calculated positions.</p>
        
        <h4>Detected Objects:</h4>
        <div id="objectList">
          <p>Loading object details...</p>
        </div>
    </div>
    
    <script>
        // Pre-calculated overlay data from Node.js
        const preCalculatedOverlays = ${JSON.stringify(preCalculatedOverlays)};
        
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
            const container = document.getElementById('overlayContainer');
            const coordinateSpan = document.getElementById('coordinateInfo');
            
            // Clear existing overlays
            container.innerHTML = '';
            
            // Create overlays using pre-calculated positions
            preCalculatedOverlays.forEach((overlay) => {
                const color = getColorForIndex(overlay.index);
                const colorHex = \`rgb(\${color.r}, \${color.g}, \${color.b})\`;
                
                // Create overlay element using pre-calculated coordinates (positioned from page origin)
                const overlayElement = document.createElement('div');
                overlayElement.className = 'overlay';
                overlayElement.style.cssText = \`
                    left: \${overlay.finalCoords.xmin}px;
                    top: \${overlay.finalCoords.ymin}px;
                    width: \${overlay.size.width}px;
                    height: \${overlay.size.height}px;
                    border-color: \${colorHex};
                \`;
                
                // Create label
                const label = document.createElement('div');
                label.className = 'overlay-label';
                label.style.color = colorHex;
                label.textContent = overlay.label;
                overlayElement.appendChild(label);
                
                container.appendChild(overlayElement);
                
                console.log(\`Object \${overlay.index + 1} (\${overlay.label}):\`);
                console.log(\`  Raw coords: (\${overlay.rawCoords.xmin}, \${overlay.rawCoords.ymin}) to (\${overlay.rawCoords.xmax}, \${overlay.rawCoords.ymax})\`);
                console.log(\`  Normalized: (\${overlay.normalizedCoords.xmin.toFixed(3)}, \${overlay.normalizedCoords.ymin.toFixed(3)}) to (\${overlay.normalizedCoords.xmax.toFixed(3)}, \${overlay.normalizedCoords.ymax.toFixed(3)})\`);
                console.log(\`  Keyboard box coords: (\${overlay.keyboardCoords.xmin.toFixed(1)}, \${overlay.keyboardCoords.ymin.toFixed(1)}) to (\${overlay.keyboardCoords.xmax.toFixed(1)}, \${overlay.keyboardCoords.ymax.toFixed(1)})\`);
                console.log(\`  Final screen coords: (\${overlay.finalCoords.xmin.toFixed(1)}, \${overlay.finalCoords.ymin.toFixed(1)}) to (\${overlay.finalCoords.xmax.toFixed(1)}, \${overlay.finalCoords.ymax.toFixed(1)})\`);
            });
            
            // Update coordinate info
            coordinateSpan.textContent = \`Created \${preCalculatedOverlays.length} overlays using pre-calculated positions\`;
            
            // Update object list
            updateObjectList();
        }
        
        function updateObjectList() {
            const objectList = document.getElementById('objectList');
            
            const objectListHTML = preCalculatedOverlays.map((overlay) => {
                const color = getColorForIndex(overlay.index);
                return \`
                    <div class="object-info">
                        <strong>\${overlay.label}</strong><br>
                        <span style="color: rgb(\${color.r}, \${color.g}, \${color.b});">●</span>
                        Raw AI coords: (\${overlay.rawCoords.xmin}, \${overlay.rawCoords.ymin}) to (\${overlay.rawCoords.xmax}, \${overlay.rawCoords.ymax})<br>
                        Normalized: (\${overlay.normalizedCoords.xmin.toFixed(3)}, \${overlay.normalizedCoords.ymin.toFixed(3)}) to (\${overlay.normalizedCoords.xmax.toFixed(3)}, \${overlay.normalizedCoords.ymax.toFixed(3)})<br>
                        Keyboard box coords: (\${overlay.keyboardCoords.xmin.toFixed(1)}, \${overlay.keyboardCoords.ymin.toFixed(1)}) to (\${overlay.keyboardCoords.xmax.toFixed(1)}, \${overlay.keyboardCoords.ymax.toFixed(1)})<br>
                        Final screen coords: (\${overlay.finalCoords.xmin.toFixed(1)}, \${overlay.finalCoords.ymin.toFixed(1)}) to (\${overlay.finalCoords.xmax.toFixed(1)}, \${overlay.finalCoords.ymax.toFixed(1)})<br>
                        Size: \${overlay.size.width.toFixed(1)} × \${overlay.size.height.toFixed(1)} pixels<br>
                        Confidence: \${overlay.confidence}
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

module.exports = {
  createDebugHTMLVisualization,
  createDebugReport,
  getColorForIndex,
  generateTimestamp,
  ensureOutputDirectory
};
