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
  }

  setWaitSettingsCallback(callback: (settings: { multiplier: number; maxDelay: number }) => void) {
    this.onWaitSettingsChange = callback;
  }

  getWaitSettings() {
    return this.waitSettings;
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

      if (saveButtonGroup) {
        saveButtonGroup.style.display = isViewMode ? 'flex' : 'none';
      }

      if (statusText) {
        statusText.textContent = isViewMode ? 'View Mode' : 'Recording...';
      }
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
    
    // Simple syntax highlighting
    function highlightCode(code) {
      try {
        // First escape HTML to prevent injection
        const escaped = code
          .replace(/&/g, '&' + 'amp;')
          .replace(/</g, '&' + 'lt;')
          .replace(/>/g, '&' + 'gt;');
        
        // Then apply syntax highlighting
        return escaped
          .replace(/\\b(import|from|async|await|const|let|var|function|return|if|else|for|while)\\b/g, '<span class="keyword">$1</span>')
          .replace(/('([^']*)'|"([^"]*)"|${'`'}([^${'`'}]*)${'`'})/g, '<span class="string">$1</span>')
          .replace(/\\/\\/.*/g, '<span class="comment">$&</span>')
          .replace(/\\b(test|expect|page|locator|element|selectors|bounds|attributes|styles)\\b/g, '<span class="function">$1</span>')
          .replace(/[\\{\\}\\(\\)\\[\\]]/g, '<span class="bracket">$&</span>');
      } catch (e) {
        console.error('Error in highlightCode:', e);
        // Return escaped code without highlighting if error occurs
        return code.replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;');
      }
    }
    
    // Update code display - make it global
    window.updateCode = function(code) {
      console.log('Updating code display, length:', code.length);
      const codeElement = document.getElementById('code-display');
      const codeContainer = document.querySelector('.code-container');
      const headerTitle = document.querySelector('.header h2');
      const statusText = document.querySelector('.status span');

      // Check if this is Gemini element analysis
      if (code.includes('// Gemini Element Analysis')) {
        if (headerTitle) headerTitle.textContent = '🔍 Gemini Element Analysis';
        if (statusText) statusText.textContent = 'Element Info';
      } else {
        if (headerTitle) headerTitle.textContent = '📝 Playwright Test Code (Real-time)';
        if (statusText) statusText.textContent = 'Recording...';
      }

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
    
    
    // Get initial code
    ipcRenderer.invoke('get-current-code').then(code => {
      console.log('Got initial code:', code);
      if (code) window.updateCode(code);
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