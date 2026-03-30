/**
 * Recording Overlay Window
 *
 * Transparent, fullscreen overlay for recording click positions in secure applications.
 * When banking apps block input hooks, this overlay captures clicks on OUR window instead.
 *
 * Features:
 * - Transparent fullscreen overlay
 * - Toggle between click-through and click-capture modes
 * - Visual feedback: crosshair cursor, red dots for marked positions
 * - Always on top of all windows
 */

import { BrowserWindow, screen, ipcMain } from 'electron';

export class RecordingOverlayWindow {
  private window: BrowserWindow | null = null;
  private isMarkMode: boolean = false;
  private markedPositions: Array<{ x: number; y: number }> = [];

  /**
   * Create the overlay window
   */
  async create(): Promise<void> {
    if (this.window) {
      this.window.focus();
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

    this.window = new BrowserWindow({
      width: screenWidth,
      height: screenHeight,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: false,
      show: false,
      title: 'Recording Overlay',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: require('path').join(__dirname, 'preload.js'),
        backgroundThrottling: false,
      },
    });

    // Start in click-through mode (invisible and non-interactive)
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.setFocusable(false);

    // Load HTML content
    const htmlContent = this.generateOverlayHTML();
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Setup IPC listeners for overlay interactions
    this.setupIPC();

    // Ready to show - delay slightly to ensure transparency is applied
    this.window.once('ready-to-show', () => {
      if (this.window) {
        // Small delay to ensure CSS is applied before showing
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            console.log('[RecordingOverlay] Overlay created (click-through mode)');
          }
        }, 100);
      }
    });

    this.window.on('closed', () => {
      this.window = null;
      this.isMarkMode = false;
      console.log('[RecordingOverlay] Overlay closed');
    });
  }

  /**
   * Setup IPC communication with overlay renderer
   */
  private setupIPC(): void {
    // Handle click events from overlay
    ipcMain.on('recording-overlay:click', (event, { x, y }) => {
      if (this.isMarkMode) {
        console.log(`[RecordingOverlay] 📍 Position marked at (${x}, ${y})`);
        this.markedPositions.push({ x, y });

        // Send back to renderer to show red dot
        this.window?.webContents.send('recording-overlay:show-marker', { x, y });

        // Emit to desktop recorder
        ipcMain.emit('recording-overlay:position-marked', event, { x, y });

        // Exit mark mode after recording position
        this.exitMarkMode();
      }
    });

    // Handle ESC key from renderer to exit mark mode
    ipcMain.on('recording-overlay:exit-mark-mode', () => {
      if (this.isMarkMode) {
        this.exitMarkMode();
        console.log('[RecordingOverlay] Mark mode exited via ESC key');
      }
    });
  }

  /**
   * Enter mark position mode
   */
  enterMarkMode(): void {
    if (!this.window || this.window.isDestroyed()) return;

    this.isMarkMode = true;

    // Make overlay interactive (capture clicks and focus)
    this.window.setIgnoreMouseEvents(false);
    this.window.setFocusable(true);

    // Make overlay visible with green tint and crosshair
    this.window.webContents.send('recording-overlay:set-mode', {
      mode: 'mark'
    });

    console.log('[RecordingOverlay] ✋ Mark mode ENABLED - click anywhere to record position');
  }

  /**
   * Exit mark position mode
   */
  exitMarkMode(): void {
    if (!this.window || this.window.isDestroyed()) return;

    this.isMarkMode = false;

    // Make overlay click-through and non-focusable again
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.setFocusable(false);

    // Make overlay invisible
    this.window.webContents.send('recording-overlay:set-mode', {
      mode: 'transparent'
    });

    console.log('[RecordingOverlay] 👻 Mark mode DISABLED - overlay is click-through');
  }

  /**
   * Toggle mark mode on/off
   */
  toggleMarkMode(): void {
    if (this.isMarkMode) {
      this.exitMarkMode();
    } else {
      this.enterMarkMode();
    }
  }

  /**
   * Check if mark mode is active
   */
  isInMarkMode(): boolean {
    return this.isMarkMode;
  }

  /**
   * Clear all marked positions
   */
  clearMarkers(): void {
    this.markedPositions = [];
    this.window?.webContents.send('recording-overlay:clear-markers');
    console.log('[RecordingOverlay] Cleared all markers');
  }

  /**
   * Close the overlay
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
   * Generate HTML for overlay
   */
  private generateOverlayHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recording Overlay</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: rgba(0, 0, 0, 0);
      overflow: hidden;
      cursor: default;
    }

    #overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0);
      transition: background-color 0.2s;
      pointer-events: none;
    }

    #overlay.mark-mode {
      background-color: rgba(74, 222, 128, 0.05);
      cursor: crosshair;
      pointer-events: auto;
    }

    /* Crosshair in mark mode */
    #overlay.mark-mode::before,
    #overlay.mark-mode::after {
      content: '';
      position: absolute;
      background: rgba(74, 222, 128, 0.6);
      pointer-events: none;
    }

    #overlay.mark-mode::before {
      width: 100%;
      height: 2px;
      top: 50%;
      left: 0;
      transform: translateY(-1px);
    }

    #overlay.mark-mode::after {
      width: 2px;
      height: 100%;
      left: 50%;
      top: 0;
      transform: translateX(-1px);
    }

    /* Marked position dots */
    .marker {
      position: absolute;
      width: 16px;
      height: 16px;
      background: rgba(239, 68, 68, 0.8);
      border: 2px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: markerPulse 1s ease-out;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
    }

    @keyframes markerPulse {
      0% {
        transform: translate(-50%, -50%) scale(0);
        opacity: 0;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.5);
      }
      100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }

    /* Toast notification */
    .toast {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(74, 222, 128, 0.95);
      color: #0a0f0d;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      animation: toastSlide 2s ease-out forwards;
      z-index: 10000;
    }

    @keyframes toastSlide {
      0% {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      10% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      90% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }

    /* Mode indicator */
    #mode-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(74, 222, 128, 0.95);
      color: #0a0f0d;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 600;
      display: none;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 10000;
    }

    #mode-indicator.visible {
      display: block;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
</head>
<body>
  <div id="overlay"></div>
  <div id="mode-indicator">📍 Click to mark position • Press ESC to exit</div>

  <script>
    const overlay = document.getElementById('overlay');
    const modeIndicator = document.getElementById('mode-indicator');

    // Listen for mode changes
    window.electron.ipcRenderer.on('recording-overlay:set-mode', ({ mode }) => {
      if (mode === 'mark') {
        overlay.classList.add('mark-mode');
        modeIndicator.classList.add('visible');
      } else {
        overlay.classList.remove('mark-mode');
        modeIndicator.classList.remove('visible');
      }
    });

    // Listen for show marker command
    window.electron.ipcRenderer.on('recording-overlay:show-marker', ({ x, y }) => {
      const marker = document.createElement('div');
      marker.className = 'marker';
      marker.style.left = x + 'px';
      marker.style.top = y + 'px';
      document.body.appendChild(marker);

      // Show toast
      showToast('Position recorded! ✓');
    });

    // Listen for clear markers command
    window.electron.ipcRenderer.on('recording-overlay:clear-markers', () => {
      const markers = document.querySelectorAll('.marker');
      markers.forEach(m => m.remove());
    });

    // Capture clicks on overlay
    overlay.addEventListener('click', (e) => {
      const x = e.clientX;
      const y = e.clientY;

      // Send to main process
      window.electron.ipcRenderer.send('recording-overlay:click', { x, y });
    });

    // ESC key to exit mark mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Exit mark mode by notifying main process
        window.electron.ipcRenderer.send('recording-overlay:exit-mark-mode');
        // Also update UI immediately
        overlay.classList.remove('mark-mode');
        modeIndicator.classList.remove('visible');
        showToast('Mark mode disabled');
      }
    });

    // Show toast notification
    function showToast(message) {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 2000);
    }
  </script>
</body>
</html>
    `;
  }
}
