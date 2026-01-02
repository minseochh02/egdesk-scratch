// Keyboard Visualization
// Generates HTML files to visualize AI keyboard analysis results

const fs = require('fs');
const path = require('path');

/**
 * Generates an HTML visualization of keyboard analysis
 * @param {Object} options - Visualization options
 * @param {string} options.screenshotPath - Path to the keyboard screenshot
 * @param {Object} options.keyboardBox - Keyboard bounding box {x, y, width, height}
 * @param {Object} options.keyboardKeys - Detected keyboard keys
 * @param {Array} options.segmentationResults - AI segmentation results
 * @param {string} options.password - Password that was typed
 * @param {string} options.outputPath - Path to save the HTML file
 * @returns {string} Path to the generated HTML file
 */
function generateKeyboardVisualization(options) {
  const {
    screenshotPath,
    keyboardBox,
    keyboardKeys,
    segmentationResults,
    password,
    outputPath
  } = options;

  // Convert screenshot to relative path or data URL
  const screenshotRelativePath = path.relative(path.dirname(outputPath), screenshotPath);

  // Generate color for each key
  const colors = [
    '#3B68FF', '#FF3B68', '#68FF3B', '#FF68FF', '#68FFFF', '#FFFF68',
    '#FF8C00', '#8C00FF', '#00FF8C', '#FF0068', '#0068FF', '#68FF00'
  ];

  // Create overlay elements for each key
  let overlayHTML = '';
  let keyIndex = 0;

  Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
    const color = colors[keyIndex % colors.length];
    keyIndex++;

    // Use percentage-based positioning EXACTLY like spatial-understanding
    const normalizedX = keyData.normalized.x;
    const normalizedY = keyData.normalized.y;
    const normalizedWidth = keyData.normalized.width;
    const normalizedHeight = keyData.normalized.height;
    
    // Convert to percentages (0-1 -> 0-100%)
    const leftPercent = normalizedX * 100;
    const topPercent = normalizedY * 100;
    const widthPercent = normalizedWidth * 100;
    const heightPercent = normalizedHeight * 100;
    
    // Center point as percentage within the key
    const centerXPercent = 50; // Center horizontally
    const centerYPercent = 50; // Center vertically

    overlayHTML += `
    <div class="key-overlay bbox" style="
      top: ${topPercent}%;
      left: ${leftPercent}%;
      width: ${widthPercent}%;
      height: ${heightPercent}%;
      border-color: ${color};
    " data-label="${keyData.label || keyLabel}" data-bounds="${leftPercent.toFixed(1)},${topPercent.toFixed(1)},${widthPercent.toFixed(1)},${heightPercent.toFixed(1)}">
      <div class="key-label" style="background-color: ${color};">
        ${keyData.label || keyLabel}
      </div>
      <div class="key-center" style="
        left: ${centerXPercent}%;
        top: ${centerYPercent}%;
        background-color: ${color};
      "></div>
    </div>`;
  });

  // Create statistics
  const totalKeys = Object.keys(keyboardKeys).length;
  const keysByType = {};
  Object.values(keyboardKeys).forEach(keyData => {
    const type = keyData.label || 'Unknown';
    keysByType[type] = (keysByType[type] || 0) + 1;
  });

  let statsHTML = '';
  Object.entries(keysByType).forEach(([type, count]) => {
    statsHTML += `<div class="stat-item"><strong>${type}:</strong> ${count}</div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keyboard Analysis Visualization</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1a1a1a;
      color: #ffffff;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #3B68FF;
    }

    .info {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 10px;
    }

    .info-item {
      background: #333;
      padding: 10px;
      border-radius: 4px;
    }

    .info-label {
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .info-value {
      font-size: 16px;
      font-weight: 500;
      word-break: break-all;
    }

    .stats {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .stats h2 {
      font-size: 18px;
      margin-bottom: 10px;
      color: #3B68FF;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }

    .stat-item {
      background: #333;
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
    }

    .visualization {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .visualization h2 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #3B68FF;
    }

    .image-container {
      position: relative;
      display: inline-block;
      background: #000;
      border-radius: 4px;
      overflow: hidden;
      width: ${keyboardBox.width}px;
      height: ${keyboardBox.height}px;
    }

    .keyboard-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .overlay {
      position: absolute;
      width: 100%;
      height: 100%;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .key-overlay {
      position: absolute;
      border: 2px solid;
      background: rgba(59, 104, 255, 0.1);
      transition: all 0.2s ease;
      transform-origin: 0px 0px;
    }

    .key-overlay:hover {
      background: rgba(59, 104, 255, 0.3);
      z-index: 10;
    }

    .key-label {
      position: absolute;
      left: -2px;
      bottom: 100%;
      color: white;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      white-space: nowrap;
      border-radius: 2px 2px 0 0;
      pointer-events: auto;
    }

    .key-center {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
    }

    .legend {
      background: #2a2a2a;
      padding: 15px;
      border-radius: 8px;
    }

    .legend h2 {
      font-size: 18px;
      margin-bottom: 10px;
      color: #3B68FF;
    }

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #333;
      border-radius: 4px;
      font-size: 13px;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 2px;
      border: 2px solid;
    }

    .controls {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2a2a2a;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .control-button {
      display: block;
      width: 100%;
      padding: 8px 16px;
      margin-bottom: 8px;
      background: #3B68FF;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .control-button:hover {
      background: #2952CC;
    }

    .control-button:last-child {
      margin-bottom: 0;
    }

    @media (max-width: 768px) {
      .controls {
        position: static;
        margin-bottom: 20px;
      }

      .keyboard-image {
        width: 100%;
        height: auto;
      }

      .image-container {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎹 Keyboard Analysis Visualization</h1>

    <div class="info">
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Screenshot</div>
          <div class="info-value">${path.basename(screenshotPath)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Keyboard Dimensions</div>
          <div class="info-value">${keyboardBox.width} × ${keyboardBox.height} px</div>
        </div>
        <div class="info-item">
          <div class="info-label">Keyboard Position</div>
          <div class="info-value">x: ${keyboardBox.x}, y: ${keyboardBox.y}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Password Length</div>
          <div class="info-value">${password ? password.length : 0} characters</div>
        </div>
        <div class="info-item">
          <div class="info-label">Total Keys Detected</div>
          <div class="info-value">${totalKeys}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Timestamp</div>
          <div class="info-value">${new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="stats">
      <h2>📊 Key Statistics</h2>
      <div class="stats-grid">
        ${statsHTML}
      </div>
    </div>

    <div class="controls">
      <button class="control-button" onclick="toggleOverlay()">Toggle Overlay</button>
      <button class="control-button" onclick="toggleLabels()">Toggle Labels</button>
      <button class="control-button" onclick="toggleCenters()">Toggle Centers</button>
    </div>

    <div class="visualization">
      <h2>🔍 Keyboard Visualization</h2>
      <div class="image-container">
        <img 
          src="${screenshotRelativePath}" 
          alt="Keyboard Screenshot" 
          class="keyboard-image"
        />
        <div class="overlay" id="overlay">
          ${overlayHTML}
        </div>
      </div>
    </div>

    <div class="legend">
      <h2>📖 Legend</h2>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-color" style="border-color: #3B68FF; background: rgba(59, 104, 255, 0.2);"></div>
          <span>Key Bounding Box</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="border-color: white; background: #3B68FF; border-radius: 50%;"></div>
          <span>Click Center Point</span>
        </div>
        <div class="legend-item">
          <div style="background: #3B68FF; color: white; padding: 2px 6px; border-radius: 2px; font-size: 11px; font-weight: 600;">Label</div>
          <span>Key Label</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    function toggleOverlay() {
      const overlay = document.getElementById('overlay');
      overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
    }

    function toggleLabels() {
      const labels = document.querySelectorAll('.key-label');
      labels.forEach(label => {
        label.style.display = label.style.display === 'none' ? 'block' : 'none';
      });
    }

    function toggleCenters() {
      const centers = document.querySelectorAll('.key-center');
      centers.forEach(center => {
        center.style.display = center.style.display === 'none' ? 'block' : 'none';
      });
    }

    // Add click handler to show key details
    document.querySelectorAll('.key-overlay').forEach((overlay, index) => {
      overlay.style.cursor = 'pointer';
      overlay.addEventListener('click', (e) => {
        const label = overlay.querySelector('.key-label').textContent;
        const bounds = overlay.style;
        alert(\`Key: \${label}\\nPosition: \${bounds.left} × \${bounds.top}\\nSize: \${bounds.width} × \${bounds.height}\`);
      });
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
  
  return outputPath;
}

module.exports = {
  generateKeyboardVisualization
};

