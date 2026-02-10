/**
 * Replay Overlay Window
 *
 * Visual feedback window during desktop action replay.
 * Shows current action, progress, and provides visual indicators.
 */

import { BrowserWindow, screen } from 'electron';

export class ReplayOverlayWindow {
  private window: BrowserWindow | null = null;

  /**
   * Create and show the replay overlay window
   */
  async create(): Promise<void> {
    if (this.window) {
      this.window.focus();
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Overlay window at top center
    const windowWidth = 400;
    const windowHeight = 120;

    this.window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: Math.floor((screenWidth - windowWidth) / 2),
      y: 20,
      title: 'Replay Progress',
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: false, // Don't steal focus during replay
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      backgroundColor: '#00000000',
    });

    // Load the overlay UI
    const htmlContent = this.generateOverlayHTML();
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    this.window.show();
    console.log('[ReplayOverlay] Overlay window created');
  }

  /**
   * Update replay progress
   */
  updateProgress(current: number, total: number, action: string): void {
    if (this.exists()) {
      this.window?.webContents.executeJavaScript(`
        updateProgress(${current}, ${total}, ${JSON.stringify(action)});
      `);
    }
  }

  /**
   * Show mouse position indicator
   */
  showMouseIndicator(x: number, y: number): void {
    if (this.exists()) {
      this.window?.webContents.executeJavaScript(`
        showMouseIndicator(${x}, ${y});
      `);
    }
  }

  /**
   * Close the overlay window
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
   * Generate inline HTML for the overlay window
   */
  private generateOverlayHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Replay Progress</title>
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

    .replay-overlay {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 2px solid #4CAF50;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(10px);
    }

    .status-icon {
      font-size: 24px;
      text-align: center;
      margin-bottom: 8px;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }

    .action-text {
      font-size: 14px;
      text-align: center;
      color: #4CAF50;
      font-weight: 500;
      margin-bottom: 12px;
      min-height: 20px;
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      width: 0%;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 11px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 8px;
    }

    .mouse-indicator {
      position: fixed;
      width: 40px;
      height: 40px;
      border: 3px solid #FF5722;
      border-radius: 50%;
      pointer-events: none;
      z-index: 999999;
      background: rgba(255, 87, 34, 0.2);
      box-shadow: 0 0 20px rgba(255, 87, 34, 0.6);
      display: none;
      animation: ping 1s ease-out infinite;
    }

    @keyframes ping {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }
  </style>
</head>
<body>
  <div class="replay-overlay">
    <div class="status-icon">▶️</div>
    <div class="action-text" id="actionText">Starting replay...</div>
    <div class="progress-bar-container">
      <div class="progress-bar" id="progressBar"></div>
    </div>
    <div class="progress-text" id="progressText">Action 0 of 0</div>
  </div>

  <div class="mouse-indicator" id="mouseIndicator"></div>

  <script>
    function updateProgress(current, total, action) {
      const percentage = total > 0 ? (current / total) * 100 : 0;
      document.getElementById('progressBar').style.width = percentage + '%';
      document.getElementById('progressText').textContent = 'Action ' + current + ' of ' + total;
      document.getElementById('actionText').textContent = action;
    }

    function showMouseIndicator(x, y) {
      const indicator = document.getElementById('mouseIndicator');
      indicator.style.left = (x - 20) + 'px';
      indicator.style.top = (y - 20) + 'px';
      indicator.style.display = 'block';

      // Hide after 500ms
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 500);
    }
  </script>
</body>
</html>
    `;
  }
}
