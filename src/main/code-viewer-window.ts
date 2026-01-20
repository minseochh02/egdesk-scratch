import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

export class CodeViewerWindow {
  private window: BrowserWindow | null = null;
  private currentCode: string = '';
  private isReady: boolean = false;
  private pendingUpdates: string[] = [];
  private waitSettings = { multiplier: 1.0, maxDelay: 3000 };
  private onWaitSettingsChange?: (settings: { multiplier: number; maxDelay: number }) => void;
  private currentTestPath: string | null = null;
  private isViewMode: boolean = false;
  private onDeleteAction?: (index: number) => void;
  private actions: any[] = [];

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle('get-current-code', () => {
      return this.currentCode;
    });

    ipcMain.on('update-wait-settings', (event, settings) => {
      console.log('📊 Wait settings updated:', settings);
      this.waitSettings = settings;

      // In view mode, regenerate and update the code directly
      if (this.isViewMode && this.currentCode) {
        const updatedCode = this.regenerateCodeWithNewWaitTimes(this.currentCode, settings);
        this.currentCode = updatedCode;
        this.updateCode(updatedCode);
      }
      // In recording mode, notify the callback
      else if (this.onWaitSettingsChange) {
        this.onWaitSettingsChange(settings);
      }
    });

    ipcMain.handle('save-test-code', async (event) => {
      if (this.isViewMode && this.currentTestPath && this.currentCode) {
        try {
          const fs = require('fs');
          fs.writeFileSync(this.currentTestPath, this.currentCode, 'utf8');
          console.log('💾 Saved test code to:', this.currentTestPath);
          return { success: true, message: 'Test saved successfully' };
        } catch (error: any) {
          console.error('❌ Failed to save test:', error);
          return { success: false, error: error.message };
        }
      }
      return { success: false, error: 'No test to save' };
    });

    ipcMain.on('delete-action', (event, index) => {
      console.log('🗑️ Delete action requested for index:', index);
      if (this.onDeleteAction) {
        this.onDeleteAction(index);
      }
    });

    ipcMain.handle('get-actions', () => {
      return this.actions;
    });
  }

  setWaitSettingsCallback(callback: (settings: { multiplier: number; maxDelay: number }) => void) {
    this.onWaitSettingsChange = callback;
  }

  getWaitSettings() {
    return this.waitSettings;
  }

  setDeleteActionCallback(callback: (index: number) => void) {
    this.onDeleteAction = callback;
  }

  updateActions(actions: any[]) {
    console.log('📊 updateActions called with', actions.length, 'actions');
    // Log each action to see if coordinates and frameSelector are present
    actions.forEach((action, i) => {
      if (action.type === 'click') {
        console.log(`  Action ${i}: click - coordinates:`, action.coordinates, 'selector:', action.selector, 'frame:', action.frameSelector || 'main');
      }
    });
    this.actions = actions;
    // Notify renderer of updated actions
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('actions-updated', actions);
    }
  }

  setViewMode(testPath: string) {
    this.isViewMode = true;
    this.currentTestPath = testPath;
    console.log('📖 Code viewer in view mode for:', testPath);

    // Notify the renderer (with delay to ensure window is ready)
    if (this.window && !this.window.isDestroyed()) {
      setTimeout(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('set-view-mode', true);
        }
      }, 200);
    }
  }

  setRecordingMode() {
    this.isViewMode = false;
    this.currentTestPath = null;
    console.log('🎥 Code viewer in recording mode');

    // Notify the renderer
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('set-view-mode', false);
    }
  }

  private regenerateCodeWithNewWaitTimes(code: string, settings: { multiplier: number; maxDelay: number }): string {
    // Parse existing wait functions and update all timeout values
    const lines = code.split('\n');
    const updatedLines = lines.map(line => {
      let updatedLine = line;

      // 1. Match waitForTimeout: await page.waitForTimeout(1500); // Human-like delay
      const waitTimeoutMatch = line.match(/await page\.waitForTimeout\((\d+)\)/);
      if (waitTimeoutMatch) {
        const originalDelay = parseInt(waitTimeoutMatch[1]);
        const newDelay = Math.floor(originalDelay * settings.multiplier);
        const finalDelay = Math.min(newDelay, settings.maxDelay);

        // Update the timeout value and add/update multiplier comment
        updatedLine = line.replace(
          /await page\.waitForTimeout\(\d+\);.*$/,
          `await page.waitForTimeout(${finalDelay}); // Adjusted with ${settings.multiplier.toFixed(1)}x multiplier`
        );
      }

      // 2. Match waitForSelector with timeout: await page.waitForSelector('selector', { state: 'visible', timeout: 5000 });
      const waitSelectorMatch = line.match(/await page\.waitForSelector\([^)]+timeout:\s*(\d+)/);
      if (waitSelectorMatch) {
        const originalTimeout = parseInt(waitSelectorMatch[1]);
        const newTimeout = Math.floor(originalTimeout * settings.multiplier);
        const finalTimeout = Math.min(newTimeout, settings.maxDelay);

        updatedLine = line.replace(
          /timeout:\s*\d+/,
          `timeout: ${finalTimeout}`
        );
      }

      // 3. Match waitForFunction with timeout: await page.waitForFunction(..., {}, { timeout: 5000 });
      const waitFunctionMatch = line.match(/await page\.waitForFunction\([^}]+timeout:\s*(\d+)/);
      if (waitFunctionMatch) {
        const originalTimeout = parseInt(waitFunctionMatch[1]);
        const newTimeout = Math.floor(originalTimeout * settings.multiplier);
        const finalTimeout = Math.min(newTimeout, settings.maxDelay);

        updatedLine = line.replace(
          /timeout:\s*\d+/,
          `timeout: ${finalTimeout}`
        );
      }

      // 4. Match waitForEvent (not currently in generated code, but for completeness)
      const waitEventMatch = line.match(/page\.waitForEvent\([^)]+/);
      if (waitEventMatch && line.includes('timeout:')) {
        const timeoutMatch = line.match(/timeout:\s*(\d+)/);
        if (timeoutMatch) {
          const originalTimeout = parseInt(timeoutMatch[1]);
          const newTimeout = Math.floor(originalTimeout * settings.multiplier);
          const finalTimeout = Math.min(newTimeout, settings.maxDelay);

          updatedLine = line.replace(
            /timeout:\s*\d+/,
            `timeout: ${finalTimeout}`
          );
        }
      }

      return updatedLine;
    });

    return updatedLines.join('\n');
  }
  
  async create(): Promise<void> {
    if (this.window) {
      this.window.focus();
      return;
    }
    
    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // Calculate window size (40% of screen width)
    const windowWidth = Math.floor(width * 0.4);
    const windowHeight = height;
    
    // Create the window
    this.window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: 0, // Position on left
      y: 0,
      title: 'Playwright Test Code',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      backgroundColor: '#1e1e1e',
      show: false
    });
    
    // Load the HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Playwright Test Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      background-color: #1e1e1e;
      color: #d4d4d4;
      overflow: hidden;
    }
    .header {
      background-color: #2d2d30;
      padding: 10px 20px;
      border-bottom: 1px solid #474747;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: normal;
      color: #cccccc;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #4CAF50;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .controls-panel {
      background-color: #252526;
      padding: 12px 20px;
      border-bottom: 1px solid #474747;
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 13px;
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .control-group label {
      color: #cccccc;
      font-weight: 500;
    }
    .control-group input[type="range"] {
      width: 150px;
      cursor: pointer;
    }
    .control-group input[type="number"] {
      width: 60px;
      padding: 4px 8px;
      background-color: #3c3c3c;
      border: 1px solid #555;
      border-radius: 4px;
      color: #cccccc;
      font-size: 12px;
    }
    .control-group .value-display {
      color: #4CAF50;
      font-weight: 600;
      min-width: 40px;
    }
    .control-group button {
      padding: 6px 16px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    .control-group button:hover {
      background-color: #45a049;
    }
    .control-group button:disabled {
      background-color: #666;
      cursor: not-allowed;
      opacity: 0.6;
    }
    .code-container {
      height: calc(100vh - 110px);
      overflow: auto;
      padding: 20px;
      scroll-behavior: smooth;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    code {
      font-size: 14px;
      line-height: 1.6;
    }
    /* Syntax highlighting */
    .keyword { color: #569cd6; }
    .string { color: #ce9178; }
    .comment { color: #6a9955; }
    .function { color: #dcdcaa; }
    .bracket { color: #ffd700; }
    /* Action blocks */
    .actions-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-block {
      background-color: #2d2d30;
      border: 1px solid #474747;
      border-radius: 4px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background-color 0.2s;
    }
    .action-block:hover {
      background-color: #333337;
    }
    .action-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .action-type {
      color: #4ec9b0;
      font-weight: 600;
      font-size: 13px;
    }
    .action-details {
      color: #9cdcfe;
      font-size: 12px;
    }
    .action-delete-btn {
      background-color: #c13030;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.2s;
      margin-left: 10px;
    }
    .action-delete-btn:hover {
      background-color: #d83030;
    }
    .view-mode-notice {
      display: none;
      background-color: #3c3c3c;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      text-align: center;
      color: #cccccc;
    }
    .gemini-analysis-container {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #2d2d30;
      border: 1px solid #474747;
      border-radius: 8px;
    }
    .gemini-analysis-container h3 {
      margin: 0 0 10px 0;
      color: #4CAF50;
      font-size: 16px;
    }
    .gemini-analysis-container img {
      max-width: 100%;
      height: auto;
      border: 2px solid #474747;
      border-radius: 4px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>📝 Playwright Test Code (Real-time)</h2>
    <div class="status">
      <div class="status-dot"></div>
      <span>Recording...</span>
    </div>
  </div>
  <div class="controls-panel">
    <div class="control-group">
      <label>⏱️ Wait Time Multiplier:</label>
      <input type="range" id="wait-multiplier-slider" min="0" max="3" step="0.1" value="1">
      <span class="value-display" id="wait-multiplier-value">1.0x</span>
    </div>
    <div class="control-group">
      <label>Max Delay (ms):</label>
      <input type="number" id="max-delay-input" min="0" max="10000" step="100" value="3000">
    </div>
    <div class="control-group" id="save-button-group" style="margin-left: auto; display: none;">
      <button id="save-test-button">💾 Save Changes</button>
    </div>
  </div>
  <div class="code-container">
    <div class="view-mode-notice" id="view-mode-notice">
      ℹ️ In view mode, actions cannot be deleted. Stop recording to edit.
    </div>
    <div id="gemini-analysis-container" class="gemini-analysis-container" style="display: none;">
      <!-- Gemini AI analysis will be rendered here -->
    </div>
    <div id="actions-container" class="actions-container" style="display: none;">
      <!-- Actions will be rendered here -->
    </div>
    <pre><code id="code-display">import { test, expect } from '@playwright/test';

test('recorded test', async ({ page }) => {
  // Recording in progress...
});</code></pre>
  </div>
  <script>
    const { ipcRenderer } = require('electron');

    console.log('Script loaded, setting up IPC listeners');

    // Global settings for wait times
    window.waitSettings = {
      multiplier: 1.0,
      maxDelay: 3000
    };
    
    // Listen for code updates immediately
    ipcRenderer.on('update-code', (event, code) => {
      console.log('Received update-code event via IPC, code length:', code.length);
      if (window.updateCode) {
        window.updateCode(code);
      } else {
        console.log('window.updateCode not yet defined, waiting...');
        // Try again after DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            if (window.updateCode) {
              window.updateCode(code);
            }
          });
        } else {
          setTimeout(() => {
            if (window.updateCode) {
              window.updateCode(code);
            }
          }, 100);
        }
      }
    });

    // Listen for view mode changes
    ipcRenderer.on('set-view-mode', (event, isViewMode) => {
      console.log('View mode changed:', isViewMode);
      const saveButtonGroup = document.getElementById('save-button-group');
      const statusText = document.querySelector('.status span');
      const viewModeNotice = document.getElementById('view-mode-notice');

      if (saveButtonGroup) {
        saveButtonGroup.style.display = isViewMode ? 'flex' : 'none';
      }

      if (statusText) {
        statusText.textContent = isViewMode ? 'View Mode' : 'Recording...';
      }

      if (viewModeNotice) {
        viewModeNotice.style.display = isViewMode ? 'block' : 'none';
      }
    });

    // Listen for actions updates
    ipcRenderer.on('actions-updated', (event, actions) => {
      console.log('🎬 Actions updated, count:', actions.length);
      // Log click actions to see if coordinates are present
      actions.forEach((action, i) => {
        if (action.type === 'click') {
          console.log(\`  📍 Action \${i} (click) - Has coords: \${!!action.coordinates}, coords:\`, action.coordinates, 'selector:', action.selector);
        }
      });
      renderActions(actions);
    });
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeCodeViewer);
    } else {
      initializeCodeViewer();
    }
    
    function initializeCodeViewer() {
      console.log('DOM is ready, initializing code viewer');
      const codeElement = document.getElementById('code-display');
      if (!codeElement) {
        console.error('CRITICAL: code-display element not found in DOM!');
      } else {
        console.log('code-display element found successfully');
      }

      // Set up wait time controls
      const multiplierSlider = document.getElementById('wait-multiplier-slider');
      const multiplierValue = document.getElementById('wait-multiplier-value');
      const maxDelayInput = document.getElementById('max-delay-input');
      const saveButton = document.getElementById('save-test-button');
      const saveButtonGroup = document.getElementById('save-button-group');

      console.log('Control elements:', {
        slider: !!multiplierSlider,
        value: !!multiplierValue,
        maxDelay: !!maxDelayInput,
        saveButton: !!saveButton
      });

      // Set up save button
      if (saveButton) {
        saveButton.addEventListener('click', async () => {
          console.log('Save button clicked');
          saveButton.disabled = true;
          saveButton.textContent = '💾 Saving...';

          try {
            const result = await ipcRenderer.invoke('save-test-code');
            if (result.success) {
              saveButton.textContent = '✅ Saved!';
              setTimeout(() => {
                saveButton.textContent = '💾 Save Changes';
                saveButton.disabled = false;
              }, 2000);
            } else {
              saveButton.textContent = '❌ Failed';
              setTimeout(() => {
                saveButton.textContent = '💾 Save Changes';
                saveButton.disabled = false;
              }, 2000);
            }
          } catch (error) {
            console.error('Save error:', error);
            saveButton.textContent = '❌ Error';
            setTimeout(() => {
              saveButton.textContent = '💾 Save Changes';
              saveButton.disabled = false;
            }, 2000);
          }
        });
      }

      if (multiplierSlider && multiplierValue) {
        console.log('Setting up multiplier slider event listener');
        multiplierSlider.addEventListener('input', (e) => {
          console.log('Slider input event fired, target:', e.target);
          const value = parseFloat(e.target.value);
          console.log('Slider value changed to:', value);
          window.waitSettings.multiplier = value;
          multiplierValue.textContent = value.toFixed(1) + 'x';
          console.log('Updated multiplier value display to:', multiplierValue.textContent);

          // Notify main process to regenerate code with new settings
          console.log('Sending update-wait-settings to main process:', window.waitSettings);
          ipcRenderer.send('update-wait-settings', window.waitSettings);
        });
        console.log('Multiplier slider event listener added successfully');
      } else {
        console.error('Could not find multiplier slider or value display elements');
      }

      if (maxDelayInput) {
        console.log('Setting up max delay input event listener');
        maxDelayInput.addEventListener('change', (e) => {
          console.log('Max delay input changed');
          const value = parseInt(e.target.value);
          console.log('Max delay value changed to:', value);
          window.waitSettings.maxDelay = value;

          // Notify main process to regenerate code with new settings
          console.log('Sending update-wait-settings to main process:', window.waitSettings);
          ipcRenderer.send('update-wait-settings', window.waitSettings);
        });
        console.log('Max delay input event listener added successfully');
      } else {
        console.error('Could not find max delay input element');
      }
    }
    
    // Render actions as interactive blocks
    function renderActions(actions) {
      const actionsContainer = document.getElementById('actions-container');
      const codeDisplay = document.getElementById('code-display');

      if (!actionsContainer || !codeDisplay) {
        console.error('Actions container or code display not found');
        return;
      }

      if (actions && actions.length > 0) {
        // Show actions container, hide code display
        actionsContainer.style.display = 'flex';
        codeDisplay.parentElement.style.display = 'none';

        // Clear existing actions
        actionsContainer.innerHTML = '';

        // Render each action
        actions.forEach((action, index) => {
          const actionBlock = document.createElement('div');
          actionBlock.className = 'action-block';

          const actionInfo = document.createElement('div');
          actionInfo.className = 'action-info';

          const actionType = document.createElement('div');
          actionType.className = 'action-type';
          actionType.textContent = getActionTypeLabel(action.type, action);

          const actionDetails = document.createElement('div');
          actionDetails.className = 'action-details';
          actionDetails.textContent = getActionDetails(action);

          actionInfo.appendChild(actionType);
          actionInfo.appendChild(actionDetails);

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'action-delete-btn';
          deleteBtn.textContent = '✕ Delete';
          deleteBtn.onclick = () => {
            console.log('Delete button clicked for index:', index);
            ipcRenderer.send('delete-action', index);
          };

          actionBlock.appendChild(actionInfo);
          actionBlock.appendChild(deleteBtn);

          actionsContainer.appendChild(actionBlock);
        });
      } else {
        // No actions, hide actions container, show code display
        actionsContainer.style.display = 'none';
        codeDisplay.parentElement.style.display = 'block';
      }
    }

    function getActionTypeLabel(type, action) {
      // Check for coordinate-based click
      if (type === 'click' && action.coordinates) {
        return '📍 Click (Coords)';
      }

      const labels = {
        'navigate': '🌐 Navigate',
        'click': '🖱️ Click',
        'clickUntilGone': '🔄 Click Until Gone',
        'fill': '📝 Fill',
        'keypress': '⌨️ Keypress',
        'screenshot': '📸 Screenshot',
        'waitForElement': '⏳ Wait',
        'download': '📥 Download',
        'datePickerGroup': '📅 Date Picker',
        'captureTable': '📊 Capture Table',
        'newTab': '🆕 New Tab',
        'closeTab': '🚪 Close Tab',
        'print': '🖨️ Print'
      };
      return labels[type] || type;
    }

    function getActionDetails(action) {
      switch (action.type) {
        case 'navigate':
          return action.url || '';
        case 'click':
          let details = '';
          if (action.coordinates) {
            details = \`X: \${action.coordinates.x}, Y: \${action.coordinates.y}\`;
          } else {
            details = action.selector || '';
          }
          if (action.frameSelector) {
            details += \` (in iframe: \${action.frameSelector})\`;
          }
          return details;
        case 'clickUntilGone':
          return \`\${action.selector} (max: \${action.maxIterations || 100} clicks)\`;
        case 'fill':
          let fillDetails = \`\${action.selector}: "\${action.value}"\`;
          if (action.frameSelector) {
            fillDetails += \` (in iframe: \${action.frameSelector})\`;
          }
          return fillDetails;
        case 'keypress':
          return \`Key: \${action.key}\`;
        case 'waitForElement':
          return \`\${action.selector} (\${action.waitCondition || 'visible'})\`;
        case 'datePickerGroup':
          const offsetText = action.dateOffset === 0 ? 'today' :
                           action.dateOffset > 0 ? \`today + \${action.dateOffset} days\` :
                           \`today - \${Math.abs(action.dateOffset)} days\`;
          return offsetText;
        case 'download':
          return action.value || 'Download event';
        case 'captureTable':
          return \`\${action.tables?.length || 0} table(s)\`;
        case 'newTab':
          return action.newTabUrl || 'New tab opened';
        case 'closeTab':
          return action.closedTabUrl || 'Tab closed, switched back to previous page';
        case 'print':
          return 'Print dialog triggered';
        default:
          return action.selector || '';
      }
    }

    // Simple syntax highlighting
    function highlightCode(code) {
      try {
        // First escape HTML to prevent injection
        const escaped = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        // Then apply syntax highlighting
        const keywordPattern = /\\b(import|from|async|await|const|let|var|function|return|if|else|for|while)\\b/g;
        const stringPattern = /('([^']*)'|"([^"]*)"|` + '`([^`]*)`' + `)/g;
        const commentPattern = /\\/\\/.*/g;
        const functionPattern = /\\b(test|expect|page|locator|element|selectors|bounds|attributes|styles)\\b/g;
        const bracketPattern = /[\\{\\}\\(\\)\\[\\]]/g;

        return escaped
          .replace(keywordPattern, '<span class="keyword">$1</span>')
          .replace(stringPattern, '<span class="string">$1</span>')
          .replace(commentPattern, '<span class="comment">$&</span>')
          .replace(functionPattern, '<span class="function">$1</span>')
          .replace(bracketPattern, '<span class="bracket">$&</span>');
      } catch (e) {
        console.error('Error in highlightCode:', e);
        // Return escaped code without highlighting if error occurs
        return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
    
    // Update code display - make it global
    window.updateCode = function(code) {
      console.log('Updating code display, length:', code.length);
      const codeElement = document.getElementById('code-display');
      const codeContainer = document.querySelector('.code-container');
      const headerTitle = document.querySelector('.header h2');
      const statusText = document.querySelector('.status span');
      const geminiContainer = document.getElementById('gemini-analysis-container');

      // Check if this is Gemini element analysis with HTML content
      const isGeminiAnalysis = code.includes('<!-- Gemini Element Analysis -->');

      console.log('Is Gemini Analysis:', isGeminiAnalysis, 'Has img tag:', code.includes('<img'));

      if (isGeminiAnalysis) {
        if (headerTitle) headerTitle.textContent = '🔍 Gemini Element Analysis';
        if (statusText) statusText.textContent = 'Element Info';

        // Show Gemini analysis in dedicated container (check if image data exists, not just <img tag)
        if (geminiContainer) {
          console.log('Rendering Gemini content in dedicated container');

          // Extract the HTML content (everything before the JavaScript code)
          const htmlMatch = code.match(/(<!-- Gemini Element Analysis -->[\s\S]*?<\\/div>)/);

          console.log('HTML Match found:', !!htmlMatch);
          if (htmlMatch) {
            console.log('HTML content length:', htmlMatch[1].length);
            console.log('HTML preview:', htmlMatch[1].substring(0, 200));
            geminiContainer.innerHTML = htmlMatch[1];
            geminiContainer.style.display = 'block';
            console.log('✅ Gemini HTML content rendered successfully');
          } else {
            console.warn('⚠️ No HTML match found in Gemini content');
          }
        }
      } else {
        if (headerTitle) headerTitle.textContent = '📝 Playwright Test Code (Real-time)';
        if (statusText) statusText.textContent = 'Recording...';

        // Hide Gemini container for regular code
        if (geminiContainer) {
          geminiContainer.style.display = 'none';
        }
      }

      // Always update code display for non-Gemini content
      if (!isGeminiAnalysis) {
        if (codeElement) {
          console.log('Found code element, updating innerHTML');
          try {
            const highlighted = highlightCode(code);
            console.log('Highlighted code preview:', highlighted.substring(0, 100) + '...');
            codeElement.innerHTML = highlighted;
            console.log('innerHTML updated successfully');

            // Auto-scroll to bottom to show new lines
            if (codeContainer) {
              // Use requestAnimationFrame to ensure DOM has updated
              requestAnimationFrame(() => {
                codeContainer.scrollTop = codeContainer.scrollHeight;
              });
            }
          } catch (e) {
            console.error('Error updating code display:', e);
            // Fallback: display raw text content
            console.log('Using fallback - setting textContent');
            codeElement.textContent = code;

            // Auto-scroll even in fallback
            if (codeContainer) {
              requestAnimationFrame(() => {
                codeContainer.scrollTop = codeContainer.scrollHeight;
              });
            }
          }
        } else {
          console.error('Could not find element with id "code-display"');
          // Try again after a short delay
          setTimeout(() => {
            const retryElement = document.getElementById('code-display');
            if (retryElement) {
              console.log('Found element on retry, updating');
              retryElement.textContent = code;

              // Auto-scroll on retry
              if (codeContainer) {
                codeContainer.scrollTop = codeContainer.scrollHeight;
              }
            }
          }, 100);
        }
      }
    }
    

    // Get initial code and actions
    ipcRenderer.invoke('get-current-code').then(code => {
      console.log('Got initial code:', code);
      if (code) window.updateCode(code);
    });

    ipcRenderer.invoke('get-actions').then(actions => {
      console.log('Got initial actions:', actions);
      if (actions && actions.length > 0) {
        renderActions(actions);
      }
    });
  </script>
</body>
</html>
    `;
    
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Wait for content to load
    this.window.webContents.once('did-finish-load', () => {
      console.log('🌟 Code viewer window loaded');
      
      // Give the script time to initialize
      setTimeout(() => {
        this.isReady = true;
        
        // Send any pending updates
        if (this.pendingUpdates.length > 0) {
          const latestCode = this.pendingUpdates[this.pendingUpdates.length - 1];
          this.pendingUpdates = [];
          this.updateCode(latestCode);
        }
      }, 100);
    });
    
    // Show when ready
    this.window.once('ready-to-show', () => {
      this.window?.show();
      // Only open DevTools if needed for debugging
      // this.window?.webContents.openDevTools({ mode: 'detach' });
    });
    
    // Handle close
    this.window.on('closed', () => {
      this.window = null;
      this.isReady = false;
      this.pendingUpdates = [];
    });
  }
  
  updateCode(code: string) {
    console.log('📝 CodeViewerWindow.updateCode called with code length:', code.length);
    this.currentCode = code;
    
    if (!this.isReady) {
      console.log('⏳ Window not ready yet, queuing update');
      this.pendingUpdates.push(code);
      return;
    }
    
    if (this.window && !this.window.isDestroyed()) {
      console.log('📤 Sending update-code event to window');
      this.window.webContents.send('update-code', code);
      
      // Also try executeJavaScript as a backup after a delay to ensure window.updateCode is defined
      setTimeout(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.executeJavaScript(`
            try {
              console.log('executeJavaScript: Attempting to update code');
              if (typeof window !== 'undefined' && window.updateCode) {
                window.updateCode(${JSON.stringify(code)});
                console.log('executeJavaScript: window.updateCode called successfully');
              } else {
                console.error('executeJavaScript: window.updateCode is not defined');
              }
            } catch (e) {
              console.error('executeJavaScript: Error in code update:', e);
            }
          `).then(() => {
            console.log('✅ executeJavaScript completed successfully');
          }).catch(err => {
            console.error('❌ Failed to execute JavaScript:', err);
          });
        }
      }, 200);
    } else {
      console.log('❌ Window is null or destroyed');
    }
  }
  
  close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
  }
  
  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }
}

// Export singleton instance
export const codeViewerWindow = new CodeViewerWindow();