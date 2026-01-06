import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

export interface BrowserWindowOptions {
  url?: string;
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  show?: boolean;
  webPreferences?: any;
}

export interface BrowserWindowInfo {
  windowId: number;
  url: string;
  isVisible: boolean;
}

export class BrowserController {
  private browserWindows = new Map<number, BrowserWindow>();
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
    this.registerHandlers();
  }

  setMainWindow(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
  }

  registerHandlers() {
    // Screen work area for tiling windows
    ipcMain.handle('screen-get-work-area', async () => {
      try {
        const targetWindow = this.mainWindow ?? BrowserWindow.getFocusedWindow();
        const bounds = targetWindow?.getBounds();
        const display = bounds
          ? screen.getDisplayMatching(bounds)
          : screen.getPrimaryDisplay();
        const { x, y, width, height } = display.workArea;
        return { success: true, workArea: { x, y, width, height } };
      } catch (error) {
        console.error('Failed to get screen work area:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
    // Browser Window management IPC handlers
    ipcMain.handle('browser-window-create', async (event, options: BrowserWindowOptions) => {
      try {
        const {
          url,
          title,
          width,
          height,
          x,
          y,
          show = true,
          webPreferences = {},
        } = options;

        const browserWindow = new BrowserWindow({
          width: width || 1200,
          height: height || 800,
          x: x || 100,
          y: y || 100,
          show,
          title: title || 'Browser Window',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            // Ensure renderer has access to the same preload bridge (window.electron)
            preload: app.isPackaged
              ? path.join(app.getAppPath(), 'dist', 'main', 'preload.js')
              : path.join(app.getAppPath(), '.erb', 'dll', 'preload.js'),
            ...webPreferences,
          },
        });

        const windowId = browserWindow.id;
        this.browserWindows.set(windowId, browserWindow);

        // Load the URL
        if (url) {
          await browserWindow.loadURL(url);
        }

        // Handle window close
        browserWindow.on('closed', () => {
          this.browserWindows.delete(windowId);
          // Notify renderer about window close
          this.mainWindow?.webContents.send('browser-window-closed', windowId);
        });

        // Handle URL changes
        browserWindow.webContents.on('did-navigate', (event, navigationUrl) => {
          this.mainWindow?.webContents.send(
            'browser-window-url-changed',
            windowId,
            navigationUrl,
          );
        });

        browserWindow.webContents.on(
          'did-navigate-in-page',
          (event, navigationUrl) => {
            this.mainWindow?.webContents.send(
              'browser-window-url-changed',
              windowId,
              navigationUrl,
            );
          },
        );

        // Inject click tracking script when page loads
        browserWindow.webContents.on('did-finish-load', () => {
          const clickTrackingScript = `
            (function() {
              // Initialize click events array in window
              if (!window.__debugClickEvents) {
                window.__debugClickEvents = [];
              }
              
              document.addEventListener('click', function(event) {
                const element = event.target;
                const clickData = {
                  timestamp: Date.now(),
                  x: event.pageX,
                  y: event.pageY,
                  elementTag: element.tagName.toLowerCase(),
                  elementId: element.id || undefined,
                  elementClass: element.className || undefined,
                  elementText: element.innerText ? element.innerText.substring(0, 100) : undefined,
                  url: window.location.href
                };
                
                // Store click event
                window.__debugClickEvents.push(clickData);
                
                // Also log for debugging
                console.log('[Click Recorded]', clickData);
              }, true);
            })();
          `;
          
          browserWindow.webContents.executeJavaScript(clickTrackingScript).catch(err => {
            console.error('Failed to inject click tracking script:', err);
          });
        });

        return {
          success: true,
          windowId,
        };
      } catch (error) {
        console.error('Failed to create browser window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('browser-window-close', async (event, windowId: number) => {
      try {
        const browserWindow = this.browserWindows.get(windowId);
        if (browserWindow) {
          browserWindow.close();
          this.browserWindows.delete(windowId);
          return { success: true };
        }
        return { success: false, error: 'Window not found' };
      } catch (error) {
        console.error('Failed to close browser window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('browser-window-load-url', async (event, windowId: number, url: string) => {
      try {
        const browserWindow = this.browserWindows.get(windowId);
        if (browserWindow) {
          await browserWindow.loadURL(url);
          return { success: true };
        }
        return { success: false, error: 'Window not found' };
      } catch (error) {
        console.error('Failed to load URL:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('browser-window-reload', async (event, windowId: number) => {
      try {
        const browserWindow = this.browserWindows.get(windowId);
        if (browserWindow) {
          browserWindow.reload();
          return { success: true };
        }
        return { success: false, error: 'Window not found' };
      } catch (error) {
        console.error('Failed to reload browser window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get click events from browser window
    ipcMain.handle('browser-window-get-click-events', async (event, windowId: number) => {
      try {
        const browserWindow = this.browserWindows.get(windowId);
        if (browserWindow) {
          const clickEvents = await browserWindow.webContents.executeJavaScript('window.__debugClickEvents || []');
          return { success: true, clickEvents };
        }
        return { success: false, error: 'Window not found' };
      } catch (error) {
        console.error('Failed to get click events:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          clickEvents: []
        };
      }
    });

    // Switch a browser window's URL (defaults to first localhost window if windowId omitted)
    ipcMain.handle(
      'browser-window-switch-url',
      async (event, url: string, windowId?: number) => {
        try {
          let targetWindow: BrowserWindow | undefined;

          if (typeof windowId === 'number') {
            targetWindow = this.browserWindows.get(windowId);
          } else {
            // Fallback: pick the first window currently showing localhost
            for (const [, bw] of this.browserWindows.entries()) {
              const currentUrl = bw.webContents.getURL();
              if (
                currentUrl &&
                (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))
              ) {
                targetWindow = bw;
                break;
              }
            }
          }

          if (!targetWindow) {
            return { success: false, error: 'Target window not found' };
          }

          await targetWindow.loadURL(url);
          return { success: true };
        } catch (error) {
          console.error('Failed to switch browser window URL:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );

    // External browser control IPC handlers
    ipcMain.handle(
      'browser-window-launch-external',
      async (event, browserType: string, url: string) => {
        try {
          let command: string;
          let args: string[];

          switch (browserType) {
            case 'chrome':
              command =
                process.platform === 'win32'
                  ? 'chrome.exe'
                  : process.platform === 'darwin'
                    ? 'open'
                    : 'google-chrome';
              args =
                process.platform === 'darwin'
                  ? ['-a', 'Google Chrome', url]
                  : [url];
              break;
            case 'firefox':
              command =
                process.platform === 'win32'
                  ? 'firefox.exe'
                  : process.platform === 'darwin'
                    ? 'open'
                    : 'firefox';
              args = process.platform === 'darwin' ? ['-a', 'Firefox', url] : [url];
              break;
            case 'safari':
              if (process.platform !== 'darwin') {
                return {
                  success: false,
                  error: 'Safari is only available on macOS',
                };
              }
              command = 'open';
              args = ['-a', 'Safari', url];
              break;
            case 'edge':
              command =
                process.platform === 'win32'
                  ? 'msedge.exe'
                  : process.platform === 'darwin'
                    ? 'open'
                    : 'microsoft-edge';
              args =
                process.platform === 'darwin'
                  ? ['-a', 'Microsoft Edge', url]
                  : [url];
              break;
            default:
              return { success: false, error: 'Unsupported browser type' };
          }

          const browserProcess = spawn(command, args, {
            detached: true,
            stdio: 'ignore',
          });
          browserProcess.unref();

          return {
            success: true,
            process: {
              pid: browserProcess.pid,
              browserType,
            },
          };
        } catch (error) {
          console.error('Failed to launch external browser:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    );

    // Global refresh for all localhost browser windows
    ipcMain.handle('browser-window-refresh-all-localhost', async () => {
      try {
        console.log('🔄 Refreshing all browser windows showing localhost...');
        let refreshedCount = 0;

        // Iterate through all browser windows
        for (const [windowId, browserWindow] of this.browserWindows.entries()) {
          try {
            const currentUrl = browserWindow.webContents.getURL();

            // Check if the window is showing localhost
            if (
              currentUrl &&
              (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))
            ) {
              console.log(
                `🔄 Refreshing browser window ${windowId} showing ${currentUrl}`,
              );
              browserWindow.reload();
              refreshedCount++;
            }
          } catch (error) {
            console.warn(`⚠️ Failed to refresh browser window ${windowId}:`, error);
          }
        }

        console.log(`✅ Refreshed ${refreshedCount} localhost browser window(s)`);
        return { success: true, refreshedCount };
      } catch (error) {
        console.error('❌ Failed to refresh localhost browser windows:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get all localhost browser windows
    ipcMain.handle('browser-window-get-all-localhost', async () => {
      try {
        console.log('🔍 Getting all localhost browser windows...');
        const localhostWindows: BrowserWindowInfo[] = [];

        // Iterate through all browser windows
        for (const [windowId, browserWindow] of this.browserWindows.entries()) {
          try {
            const currentUrl = browserWindow.webContents.getURL();

            // Check if the window is showing localhost
            if (
              currentUrl &&
              (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))
            ) {
              localhostWindows.push({
                windowId,
                url: currentUrl,
                isVisible:
                  !browserWindow.isDestroyed() && browserWindow.isVisible(),
              });
            }
          } catch (error) {
            console.warn(
              `⚠️ Failed to get info for browser window ${windowId}:`,
              error,
            );
          }
        }

        console.log(
          `🔍 Found ${localhostWindows.length} localhost browser window(s)`,
        );
        return { success: true, windows: localhostWindows };
      } catch (error) {
        console.error('❌ Failed to get localhost browser windows:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('browser-window-close-external', async (event, pid: number) => {
      try {
        if (process.platform === 'win32') {
          // Use spawn instead of exec for better error handling
          const taskkill = spawn('taskkill', ['/PID', pid.toString(), '/F'], {
            stdio: 'ignore'
          });
          
          taskkill.on('close', (code: number | null) => {
            if (code !== 0) {
              console.warn(`taskkill exited with code ${code} for PID ${pid}`);
            }
          });
          
          taskkill.on('error', (error: Error) => {
            console.error('Failed to spawn taskkill:', error);
          });
        } else {
          process.kill(pid, 'SIGTERM');
        }
        return { success: true };
      } catch (error) {
        console.error('Failed to close external browser:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('browser-window-navigate-external', async (event, pid: number, url: string) => {
      try {
        // For external browsers, we can't directly control navigation
        // This is a limitation of external browser control
        // We could potentially use browser automation tools like Puppeteer or Playwright
        // For now, we'll just return success as the URL change is handled by the browser itself
        return { success: true };
      } catch (error) {
        console.error('Failed to navigate external browser:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Main window management IPC handlers
    ipcMain.handle('main-window-get-bounds', async () => {
      try {
        if (this.mainWindow) {
          const bounds = this.mainWindow.getBounds();
          return { success: true, bounds };
        }
        return { success: false, error: 'Main window not found' };
      } catch (error) {
        console.error('Failed to get main window bounds:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('main-window-set-bounds', async (event, bounds: any) => {
      try {
        if (this.mainWindow) {
          this.mainWindow.setBounds(bounds);
          return { success: true };
        }
        return { success: false, error: 'Main window not found' };
      } catch (error) {
        console.error('Failed to set main window bounds:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('main-window-set-size', async (event, width: number, height: number) => {
      try {
        if (this.mainWindow) {
          this.mainWindow.setSize(width, height);
          return { success: true };
        }
        return { success: false, error: 'Main window not found' };
      } catch (error) {
        console.error('Failed to set main window size:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('main-window-set-position', async (event, x: number, y: number) => {
      try {
        if (this.mainWindow) {
          this.mainWindow.setPosition(x, y);
          return { success: true };
        }
        return { success: false, error: 'Main window not found' };
      } catch (error) {
        console.error('Failed to set main window position:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  // Public methods for direct access
  createWindow(options: BrowserWindowOptions): Promise<{ success: boolean; windowId?: number; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const {
          url,
          title,
          width,
          height,
          x,
          y,
          show = true,
          webPreferences = {},
        } = options;

        const browserWindow = new BrowserWindow({
          width: width || 1200,
          height: height || 800,
          x: x || 100,
          y: y || 100,
          show,
          title: title || 'Browser Window',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            ...webPreferences,
          },
        });

        const windowId = browserWindow.id;
        this.browserWindows.set(windowId, browserWindow);

        // Load the URL
        if (url) {
          await browserWindow.loadURL(url);
        }

        // Handle window close
        browserWindow.on('closed', () => {
          this.browserWindows.delete(windowId);
          // Notify renderer about window close
          this.mainWindow?.webContents.send('browser-window-closed', windowId);
        });

        // Handle URL changes
        browserWindow.webContents.on('did-navigate', (event, navigationUrl) => {
          this.mainWindow?.webContents.send(
            'browser-window-url-changed',
            windowId,
            navigationUrl,
          );
        });

        browserWindow.webContents.on(
          'did-navigate-in-page',
          (event, navigationUrl) => {
            this.mainWindow?.webContents.send(
              'browser-window-url-changed',
              windowId,
              navigationUrl,
            );
          },
        );

        resolve({
          success: true,
          windowId,
        });
      } catch (error) {
        console.error('Failed to create browser window:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  closeWindow(windowId: number): boolean {
    const browserWindow = this.browserWindows.get(windowId);
    if (browserWindow) {
      browserWindow.close();
      this.browserWindows.delete(windowId);
      return true;
    }
    return false;
  }

  getWindow(windowId: number): BrowserWindow | undefined {
    return this.browserWindows.get(windowId);
  }

  getAllWindows(): Map<number, BrowserWindow> {
    return this.browserWindows;
  }

  refreshLocalhostWindows(): { success: boolean; refreshedCount: number; error?: string } {
    try {
      console.log('🔄 Refreshing all browser windows showing localhost...');
      let refreshedCount = 0;

      // Iterate through all browser windows
      for (const [windowId, browserWindow] of this.browserWindows.entries()) {
        try {
          const currentUrl = browserWindow.webContents.getURL();

          // Check if the window is showing localhost
          if (
            currentUrl &&
            (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))
          ) {
            console.log(
              `🔄 Refreshing browser window ${windowId} showing ${currentUrl}`,
            );
            browserWindow.reload();
            refreshedCount++;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to refresh browser window ${windowId}:`, error);
        }
      }

      console.log(`✅ Refreshed ${refreshedCount} localhost browser window(s)`);
      return { success: true, refreshedCount };
    } catch (error) {
      console.error('❌ Failed to refresh localhost browser windows:', error);
      return {
        success: false,
        refreshedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getLocalhostWindows(): BrowserWindowInfo[] {
    const localhostWindows: BrowserWindowInfo[] = [];

    // Iterate through all browser windows
    for (const [windowId, browserWindow] of this.browserWindows.entries()) {
      try {
        const currentUrl = browserWindow.webContents.getURL();

        // Check if the window is showing localhost
        if (
          currentUrl &&
          (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1'))
        ) {
          localhostWindows.push({
            windowId,
            url: currentUrl,
            isVisible:
              !browserWindow.isDestroyed() && browserWindow.isVisible(),
          });
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to get info for browser window ${windowId}:`,
          error,
        );
      }
    }

    return localhostWindows;
  }

  cleanup() {
    // Close all browser windows
    for (const [windowId, browserWindow] of this.browserWindows.entries()) {
      try {
        browserWindow.close();
      } catch (error) {
        console.warn(`Failed to close browser window ${windowId}:`, error);
      }
    }
    this.browserWindows.clear();
  }
}
