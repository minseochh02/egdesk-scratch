import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';

export class DeveloperWindows {
  private aiChatWindow: BrowserWindow | null = null;
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

    ipcMain.handle('close-developer-windows', async () => {
      try {
        this.closeWindows();
        return { success: true };
      } catch (error: any) {
        console.error('Failed to close developer windows:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('refresh-website-viewer', async () => {
      try {
        this.refreshWebsiteViewer();
        return { success: true };
      } catch (error: any) {
        console.error('Failed to refresh website viewer:', error);
        return { success: false, error: error.message };
      }
    });
  }

  private async createWindows() {
    // Close existing windows if any
    this.closeWindows();

    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Calculate window sizes
    const aiChatWidth = Math.floor(width * 0.3); // 30% width
    const websiteViewerWidth = Math.floor(width * 0.7); // 70% width

    // Get preload script path
    const preloadPath = app.isPackaged
      ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
      : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js');

    // Create AI Chat window (left side, 30%)
    this.aiChatWindow = new BrowserWindow({
      width: aiChatWidth,
      height: height,
      x: 0,
      y: 0,
      title: 'AI Chat',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false,
    });

    // Create Website Viewer window (right side, 70%)
    this.websiteViewerWindow = new BrowserWindow({
      width: websiteViewerWidth,
      height: height,
      x: aiChatWidth,
      y: 0,
      title: 'Website Viewer',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false,
    });

    // Verify windows were created
    if (!this.aiChatWindow || !this.websiteViewerWindow) {
      throw new Error('Failed to create browser windows');
    }

    // Load routes
    const baseUrl = resolveHtmlPath('index.html');
    if (!baseUrl) {
      throw new Error('Failed to resolve HTML path');
    }

    const aiChatUrl = baseUrl + '#/coding/ai-chat';
    const websiteViewerUrl = baseUrl + '#/coding/website-viewer';

    console.log('Loading AI Chat URL:', aiChatUrl);
    console.log('Loading Website Viewer URL:', websiteViewerUrl);

    // Set up ready-to-show handlers before loading
    this.aiChatWindow.once('ready-to-show', () => {
      console.log('AI Chat window ready to show');
      this.aiChatWindow?.show();
      this.aiChatWindow?.focus();
    });

    this.websiteViewerWindow.once('ready-to-show', () => {
      console.log('Website Viewer window ready to show');
      this.websiteViewerWindow?.show();
      this.websiteViewerWindow?.focus();
    });

    // Handle load failures
    this.aiChatWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('AI Chat failed to load:', errorCode, errorDescription);
    });

    this.websiteViewerWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Website Viewer failed to load:', errorCode, errorDescription);
    });

    // Handle successful loads
    this.aiChatWindow.webContents.on('did-finish-load', () => {
      console.log('AI Chat finished loading');
    });

    this.websiteViewerWindow.webContents.on('did-finish-load', () => {
      console.log('Website Viewer finished loading');
    });

    // Handle window close events
    this.aiChatWindow.on('closed', () => {
      console.log('AI Chat window closed');
      this.aiChatWindow = null;
    });

    this.websiteViewerWindow.on('closed', () => {
      console.log('Website Viewer window closed');
      this.websiteViewerWindow = null;
    });

    try {
      await this.aiChatWindow.loadURL(aiChatUrl);
      console.log('AI Chat URL loaded successfully');
      await this.websiteViewerWindow.loadURL(websiteViewerUrl);
      console.log('Website Viewer URL loaded successfully');

      // Show windows after a short delay if ready-to-show hasn't fired
      setTimeout(() => {
        if (this.aiChatWindow && !this.aiChatWindow.isVisible()) {
          console.log('Force showing AI Chat window after timeout');
          this.aiChatWindow.show();
          this.aiChatWindow.focus();
        }
        if (this.websiteViewerWindow && !this.websiteViewerWindow.isVisible()) {
          console.log('Force showing Website Viewer window after timeout');
          this.websiteViewerWindow.show();
        }
      }, 2000);
    } catch (loadError) {
      console.error('Failed to load URLs:', loadError);
      this.closeWindows();
      throw loadError;
    }
  }

  private closeWindows() {
    if (this.aiChatWindow && !this.aiChatWindow.isDestroyed()) {
      this.aiChatWindow.close();
      this.aiChatWindow = null;
    }

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
