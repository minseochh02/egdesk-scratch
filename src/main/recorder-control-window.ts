/**
 * Recorder Control Window
 *
 * A floating control panel for desktop recording that appears on a separate virtual desktop.
 * Shows recording status, action count, and provides Start/Stop/Pause controls.
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';

export class RecorderControlWindow {
  private window: BrowserWindow | null = null;

  /**
   * Create and show the recorder control window
   */
  async create(): Promise<void> {
    if (this.window) {
      this.window.focus();
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Small floating window in bottom-right corner (matching replay overlay)
    const windowWidth = 350;
    const windowHeight = 120;
    const margin = 20;

    this.window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: screenWidth - windowWidth - margin,
      y: screenHeight - windowHeight - margin,
      title: 'Recording Control',
      frame: false, // Frameless for clean look
      transparent: true,
      alwaysOnTop: true, // Float above other windows
      resizable: false,
      skipTaskbar: true, // Don't show in taskbar
      show: false, // Don't show immediately
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      backgroundColor: '#00000000', // Transparent background
    });

    // Load the recorder control UI inline
    // For simplicity, we'll generate the HTML directly rather than requiring webpack changes
    const htmlContent = this.generateControlHTML();
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Force window to appear on current desktop by showing and immediately focusing
    this.window.once('ready-to-show', () => {
      if (this.window) {
        // Small delay to ensure desktop context is ready
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
            this.window.moveTop(); // Force to top of window stack
            console.log('[RecorderControl] Control window displayed on current desktop');
          }
        }, 100);
      }
    });

    // Clean up when closed
    this.window.on('closed', () => {
      this.window = null;
      console.log('[RecorderControl] Control window closed');
    });

    console.log('[RecorderControl] Control window created at:', {
      x: screenWidth - windowWidth - margin,
      y: screenHeight - windowHeight - margin,
      width: windowWidth,
      height: windowHeight,
    });
  }

  /**
   * Close the control window
   */
  close(): void {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }

  /**
   * Check if window exists
   */
  exists(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  /**
   * Send message to control window
   */
  send(channel: string, ...args: any[]): void {
    if (this.exists()) {
      this.window?.webContents.send(channel, ...args);
    }
  }

  /**
   * Get the BrowserWindow instance
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Generate inline HTML for the control window
   */
  private generateControlHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Recording Control</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .recorder-control {
      width: 100%;
      height: 100%;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
    }

    .control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      -webkit-app-region: drag;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ff4444;
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .status-text {
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .close-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      -webkit-app-region: no-drag;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .control-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 8px;
    }

    .action-count {
      text-align: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .count-label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .count-value {
      font-size: 24px;
      font-weight: 600;
      color: #4CAF50;
    }

    .control-buttons {
      display: flex;
      gap: 8px;
    }

    .control-btn {
      flex: 1;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .control-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    .stop-btn:hover {
      background: rgba(255, 68, 68, 0.2);
      border-color: #ff4444;
    }

    .hotkeys {
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .hotkey-keys {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .hotkey-desc {
      color: rgba(255, 255, 255, 0.5);
    }
  </style>
</head>
<body>
  <div class="recorder-control">
    <div class="control-header">
      <div class="status-indicator">
        <div class="status-dot"></div>
        <span class="status-text">Recording</span>
      </div>
      <button class="close-btn" onclick="closeWindow()">×</button>
    </div>

    <div class="control-body">
      <div class="action-count">
        <span class="count-label">Actions</span>
        <span class="count-value" id="actionCount">0</span>
      </div>

      <div class="control-buttons">
        <button class="control-btn stop-btn" onclick="stopRecording()">⏹ Stop</button>
      </div>

      <div class="hotkeys">
        <span class="hotkey-keys" id="switchHotkey">${process.platform === 'win32' ? 'Win+Ctrl+←' : process.platform === 'darwin' ? 'Ctrl+←' : 'N/A'}</span>
        <span class="hotkey-desc">Back to EGDesk</span>
      </div>
    </div>
  </div>

  <script>
    let actionCount = 0;

    // Listen for recorder updates from main process
    window.electron.ipcRenderer.on('recorder-control:update', (update) => {
      if (update.actionCount !== undefined) {
        actionCount = update.actionCount;
        document.getElementById('actionCount').textContent = actionCount;
      }
    });

    async function stopRecording() {
      try {
        await window.electron.ipcRenderer.invoke('desktop-recorder:stop');
        await closeWindow();
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }

    async function closeWindow() {
      try {
        await window.electron.ipcRenderer.invoke('desktop-recorder:close-control-window');
      } catch (error) {
        console.error('Failed to close window:', error);
      }
    }
  </script>
</body>
</html>
    `;
  }
}
