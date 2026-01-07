import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

export class CodeViewerWindow {
  private window: BrowserWindow | null = null;
  private currentCode: string = '';
  private isReady: boolean = false;
  private pendingUpdates: string[] = [];
  
  constructor() {
    this.setupIpcHandlers();
  }
  
  private setupIpcHandlers() {
    ipcMain.handle('get-current-code', () => {
      return this.currentCode;
    });
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
    .code-container {
      height: calc(100vh - 50px);
      overflow: auto;
      padding: 20px;
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
  <div class="code-container">
    <pre><code id="code-display">import { test, expect } from '@playwright/test';

test('recorded test', async ({ page }) => {
  // Recording in progress...
});</code></pre>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    
    console.log('Script loaded, setting up IPC listeners');
    
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
          .replace(/\\b(test|expect|page)\\b/g, '<span class="function">$1</span>')
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
      if (codeElement) {
        console.log('Found code element, updating innerHTML');
        try {
          const highlighted = highlightCode(code);
          console.log('Highlighted code preview:', highlighted.substring(0, 100) + '...');
          codeElement.innerHTML = highlighted;
          console.log('innerHTML updated successfully');
        } catch (e) {
          console.error('Error updating code display:', e);
          // Fallback: display raw text content
          console.log('Using fallback - setting textContent');
          codeElement.textContent = code;
        }
      } else {
        console.error('Could not find element with id "code-display"');
        // Try again after a short delay
        setTimeout(() => {
          const retryElement = document.getElementById('code-display');
          if (retryElement) {
            console.log('Found element on retry, updating');
            retryElement.textContent = code;
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