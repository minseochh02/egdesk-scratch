import { BrowserWindow, screen, ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { resolveHtmlPath } from './util';

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
  private onPlayToAction?: (index: number) => void;
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
        // Call the callback for both recording and view mode
        this.onDeleteAction(index);
      }
    });

    ipcMain.on('play-to-action', (event, index) => {
      console.log('▶️ Play to action requested for index:', index);

      if (this.onPlayToAction) {
        this.onPlayToAction(index);
      } else {
        console.warn('⚠️ No play-to-action callback registered');
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

  setPlayToActionCallback(callback: (index: number) => void) {
    this.onPlayToAction = callback;
  }

  updateActions(actions: any[]) {
    console.log('📊 updateActions called with', actions.length, 'actions');
    this.actions = actions;

    // Notify renderer if window is ready, otherwise actions will be sent when it becomes ready
    if (this.window && !this.window.isDestroyed()) {
      if (this.isReady) {
        console.log('📤 Sending', actions.length, 'actions to renderer immediately');
        this.window.webContents.send('actions-updated', actions);
      } else {
        console.log('⏳ Window not fully ready, but queuing actions for soon-to-be-ready window');
        // We can still try to send, it will be queued by Electron's WebContents
        this.window.webContents.send('actions-updated', actions);
      }
    } else {
      console.log('❌ Window is null or destroyed, actions saved but not sent');
    }
  }

  setViewMode(testPath: string) {
    this.isViewMode = true;
    this.currentTestPath = testPath;
    console.log('📖 Code viewer in view mode for:', testPath);

    // Notify the renderer after window is ready
    const sendViewModeEvent = () => {
      if (this.window && !this.window.isDestroyed()) {
        console.log('📤 Sending set-view-mode event');
        this.window.webContents.send('set-view-mode', true);
      }
    };

    if (this.isReady) {
      // Window already ready, send immediately
      sendViewModeEvent();
    } else {
      // Wait for window to be ready, then send after actions
      const checkReady = setInterval(() => {
        if (this.isReady) {
          clearInterval(checkReady);
          // Small delay to ensure actions-updated event is processed first
          setTimeout(sendViewModeEvent, 50);
        }
      }, 50);
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
      x: 0,
      y: 0,
      title: 'Playwright Test Code',
      webPreferences: {
        preload: app.isPackaged
          ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
          : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      backgroundColor: '#1e1e1e',
      show: false
    });
    
    // Load the React route
    const htmlPath = resolveHtmlPath('index.html');
    const url = `${htmlPath}#/code-viewer`;
    
    console.log('📄 Loading Code Viewer URL:', url);
    
    this.window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Code Viewer failed to load:', errorCode, errorDescription);
      // Even if it fails, mark as ready so we can try to send data anyway
      this.isReady = true;
    });

    try {
      await this.window.loadURL(url);
      console.log('Code Viewer URL loaded successfully');
    } catch (loadError) {
      console.error('Failed to load Code Viewer URL:', loadError);
      this.isReady = true; // Safety
    }
    
    // Wait for content to load
    this.window.webContents.once('did-finish-load', () => {
      console.log('🌟 Code viewer window loaded');

      // Give the React app time to mount and setup listeners
      setTimeout(() => {
        this.isReady = true;

        // Send any pending updates
        if (this.pendingUpdates.length > 0) {
          const latestCode = this.pendingUpdates[this.pendingUpdates.length - 1];
          this.pendingUpdates = [];
          this.updateCode(latestCode);
        }

        if (this.actions.length > 0 && this.window && !this.window.isDestroyed()) {
          console.log('📤 Sending initial actions to renderer:', this.actions.length);
          this.window.webContents.send('actions-updated', this.actions);
        }
      }, 500); 
    });
    
    // Show when ready
    this.window.once('ready-to-show', () => {
      console.log('✨ Code viewer window ready to show');
      this.window?.show();
    });

    // Fallback show and mark ready after 3 seconds
    setTimeout(() => {
      if (this.window && !this.window.isDestroyed()) {
        if (!this.window.isVisible()) {
          console.log('⚠️ Fallback: Showing code viewer window manually');
          this.window.show();
        }
        if (!this.isReady) {
          console.log('⚠️ Fallback: Marking code viewer as ready');
          this.isReady = true;
          // Send actions in fallback too
          if (this.actions.length > 0) {
            this.window.webContents.send('actions-updated', this.actions);
          }
        }
      }
    }, 3000);
    
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
    
    if (this.window && !this.window.isDestroyed()) {
      if (this.isReady) {
        console.log('📤 Sending update-code event to window');
        this.window.webContents.send('update-code', code);
      } else {
        console.log('⏳ Window not ready, queuing update-code and pending update');
        this.pendingUpdates.push(code);
        // Also try sending anyway, Electron will queue it
        this.window.webContents.send('update-code', code);
      }
    } else {
      console.log('❌ Window is null or destroyed, update queued');
      this.pendingUpdates.push(code);
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

  bringToFront() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.moveTop();
      this.window.focus();
    }
  }
}

// Export singleton instance
export const codeViewerWindow = new CodeViewerWindow();