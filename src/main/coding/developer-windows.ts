import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';

export class DeveloperWindows {
  private websiteViewerWindow: BrowserWindow | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle('create-developer-windows', async () => {
      try {
        await this.createWindows();
        return { success: true };
      } catch (error: any) {
        console.error('Failed to create developer windows:', error);
        return { success: false, error: error.message };
      }
    });
    // ... rest of handlers
  }

  private async createWindows() {
    // Close existing windows if any
    this.closeWindows();

    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height, x, y } = primaryDisplay.workArea;

    // Calculate window sizes
    const chatWidth = Math.floor(width * 0.3); // 30% width
    const websiteViewerWidth = width - chatWidth; // 70% width

    // Get the main window to resize it
    const allWindows = BrowserWindow.getAllWindows();
    const mainWindow = allWindows.find(w => !w.isDestroyed() && w.webContents && !w.webContents.getURL().includes('coding/'));
    
    if (mainWindow) {
      // Resize main window to left 30%
      mainWindow.setBounds({
        x: x,
        y: y,
        width: chatWidth,
        height: height
      });
    }

    // Get preload script path
    const preloadPath = app.isPackaged
      ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
      : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js');

    // Create Website Viewer window (right side, 70%)
    this.websiteViewerWindow = new BrowserWindow({
      width: websiteViewerWidth,
      height: height,
      x: x + chatWidth,
      y: y,
      title: 'Website Viewer',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false,
    });

    // Verify window was created
    if (!this.websiteViewerWindow) {
      throw new Error('Failed to create website viewer window');
    }

    // Load route
    const baseUrl = resolveHtmlPath('index.html');
    if (!baseUrl) {
      throw new Error('Failed to resolve HTML path');
    }

    const websiteViewerUrl = baseUrl + '#/coding/website-viewer';

    console.log('Loading Website Viewer URL:', websiteViewerUrl);

    // Set up ready-to-show handler before loading
    this.websiteViewerWindow.once('ready-to-show', () => {
      console.log('Website Viewer window ready to show');
      this.websiteViewerWindow?.show();
      this.websiteViewerWindow?.focus();
    });

    // Handle load failures
    this.websiteViewerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Website Viewer failed to load:', errorCode, errorDescription);
    });

    // Handle successful loads
    this.websiteViewerWindow.webContents.on('did-finish-load', () => {
      console.log('Website Viewer finished loading');
    });

    // Handle window close events
    this.websiteViewerWindow.on('closed', () => {
      console.log('Website Viewer window closed');
      this.websiteViewerWindow = null;
    });

    try {
      await this.websiteViewerWindow.loadURL(websiteViewerUrl);
      console.log('Website Viewer URL loaded successfully');

      // Show window after a short delay if ready-to-show hasn't fired
      setTimeout(() => {
        if (this.websiteViewerWindow && !this.websiteViewerWindow.isVisible()) {
          console.log('Force showing Website Viewer window after timeout');
          this.websiteViewerWindow.show();
        }
      }, 2000);
    } catch (loadError) {
      console.error('Failed to load URL:', loadError);
      this.closeWindows();
      throw loadError;
    }
  }

  private closeWindows() {
    if (this.websiteViewerWindow && !this.websiteViewerWindow.isDestroyed()) {
      this.websiteViewerWindow.close();
      this.websiteViewerWindow = null;
    }
  }

  public cleanup() {
    this.closeWindows();
  }

  public refreshWebsiteViewer() {
    if (this.websiteViewerWindow && !this.websiteViewerWindow.isDestroyed()) {
      console.log('🔄 Sending refresh event to WebsiteViewer window');
      this.websiteViewerWindow.webContents.send('website-viewer:refresh');
    }
  }
}

// Singleton instance
let developerWindowsInstance: DeveloperWindows | null = null;

export function getDeveloperWindows(): DeveloperWindows {
  if (!developerWindowsInstance) {
    developerWindowsInstance = new DeveloperWindows();
  }
  return developerWindowsInstance;
}
