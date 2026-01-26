import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { screen, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OSAutomation } from './utils/osAutomation';

interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' | 'waitForElement' | 'download' | 'datePickerGroup' | 'captureTable' | 'newTab' | 'print' | 'clickUntilGone' | 'closeTab' | 'fileUpload';
  selector?: string;
  xpath?: string; // XPath as fallback selector
  value?: string;
  key?: string;
  url?: string;
  waitCondition?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  timeout?: number;
  timestamp: number;
  coordinates?: { x: number; y: number }; // For coordinate-based clicks
  frameSelector?: string; // CSS selector or name/id to locate the iframe
  // Date picker fields
  dateComponents?: {
    year: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  };
  dateOffset?: number; // Days from today (0 = today, 1 = tomorrow, -1 = yesterday)
  // Table capture fields
  tables?: Array<{
    xpath: string;
    cssSelector: string;
    headers: string[];
    sampleRow: string[];
    rowCount: number;
  }>;
  // New tab fields
  newTabUrl?: string; // URL of the newly opened tab
  closedTabUrl?: string; // URL of the tab that was closed
  // Click Until Gone fields
  maxIterations?: number; // Maximum number of times to click (safety limit)
  checkCondition?: 'gone' | 'hidden' | 'disabled'; // What condition to check
  waitBetweenClicks?: number; // Milliseconds to wait between clicks
  // File upload fields
  filePath?: string; // Path to the file being uploaded
  fileName?: string; // Name of the file for display
  isChainedFile?: boolean; // Whether this is from a previous chain step
}

export class BrowserRecorder {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private actions: RecordedAction[] = [];
  private startTime: number = Date.now();
  private isRecording: boolean = false;
  private outputFile: string = '';
  private updateCallback?: (code: string) => void;
  private controllerCheckInterval: NodeJS.Timeout | null = null;
  private waitSettings = { multiplier: 1.0, maxDelay: 3000 };
  private profileDir: string | null = null;
  private pageStack: Page[] = []; // Track page history for switching back
  private scriptName: string = 'egdesk-browser-recorder'; // Name for unique download paths
  private extensionPaths: string[] = []; // Chrome extension paths to load
  private tempExtensionsDir: string | null = null; // Temporary directory for copied extensions

  // Date marking mode state
  private isDateMarkingMode: boolean = false;
  private dateMarkingStep: 'year' | 'month' | 'day' | null = null;
  private dateMarkingSelectors: {
    year?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  } = {};
  private dateMarkingOffset: number = 0; // Days from today

  // Click Until Gone mode state
  private isClickUntilGoneMode: boolean = false;

  // Coordinate mode state
  private isCoordinateModeEnabled: boolean = false;

  // OS-level automation for native dialogs
  private osAutomation: OSAutomation | null = null;

  // Action Chain support
  private chainId: string | null = null;
  private isChainedRecording: boolean = false;
  private chainDownloadPath: string | null = null; // File from previous chain step
  private chainDownloadName: string | null = null; // Filename for display
  private previousChainSessionPath: string | null = null; // Previous test file path

  setOutputFile(filePath: string): void {
    this.outputFile = filePath;
  }

  setUpdateCallback(callback: (code: string) => void): void {
    this.updateCallback = callback;
  }

  setScriptName(name: string): void {
    this.scriptName = name;
  }

  setExtensions(extensionPaths: string[]): void {
    this.extensionPaths = extensionPaths;
    console.log(`[Browser Recorder] Will load ${extensionPaths.length} extensions:`, extensionPaths);
  }

  setChainParameters(chainId: string, previousDownloadPath: string): void {
    this.chainId = chainId || `chain-${Date.now()}`;
    this.isChainedRecording = true;

    // previousDownloadPath is now the FULL PATH from previous recording
    // e.g., /Users/.../EGDesk-Browser/egdesk-browser-recorder-2026-01-26T04-01-42-042Z/file.pdf
    this.chainDownloadPath = previousDownloadPath;
    this.chainDownloadName = path.basename(previousDownloadPath);

    console.log(`[Browser Recorder] Chain mode activated`);
    console.log(`[Browser Recorder]  - Chain ID: ${this.chainId}`);
    console.log(`[Browser Recorder]  - Download path: ${this.chainDownloadPath}`);
    console.log(`[Browser Recorder]  - Download filename: ${this.chainDownloadName}`);
    console.log(`[Browser Recorder]  - File exists: ${fs.existsSync(this.chainDownloadPath)}`);
    console.log(`[Browser Recorder]  - Previous download: ${this.chainDownloadName}`);
    console.log(`[Browser Recorder]  - Full path: ${this.chainDownloadPath}`);
  }

  getChainMetadata(): { chainId: string | null; isChainedRecording: boolean; chainDownloadPath: string | null; chainDownloadName: string | null } {
    return {
      chainId: this.chainId,
      isChainedRecording: this.isChainedRecording,
      chainDownloadPath: this.chainDownloadPath,
      chainDownloadName: this.chainDownloadName
    };
  }

  setWaitSettings(settings: { multiplier: number; maxDelay: number }): void {
    this.waitSettings = settings;
    // Regenerate code with new settings
    this.updateGeneratedCode();
  }

  /**
   * Copy Chrome extensions from user's profile to temporary directory
   * This allows loading extensions with Chromium (Chrome removed --load-extension support)
   *
   * Note: We don't copy Secure Preferences because it uses HMAC validation that will fail.
   * Unpacked extensions loaded via --load-extension auto-grant all manifest permissions.
   */
  private copyExtensionsToTemp(): string[] {
    if (this.extensionPaths.length === 0) {
      return [];
    }

    try {
      // Create temp directory for extensions
      this.tempExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egdesk-extensions-'));
      console.log(`[Browser Recorder] Copying ${this.extensionPaths.length} extensions to:`, this.tempExtensionsDir);

      const copiedPaths: string[] = [];
      const extensionSettings: Record<string, any> = {};

      for (const extPath of this.extensionPaths) {
        if (!fs.existsSync(extPath)) {
          console.warn(`[Browser Recorder] Extension path does not exist: ${extPath}`);
          continue;
        }

        // Get extension ID and version from path
        // Path format: .../Chrome/Profile X/Extensions/{extensionId}/{version}/
        const version = path.basename(extPath);
        const extensionId = path.basename(path.dirname(extPath));
        const profilePath = path.dirname(path.dirname(path.dirname(extPath))); // Go up to Profile X

        // Create destination directory
        const destPath = path.join(this.tempExtensionsDir, `${extensionId}-${version}`);

        // Copy extension directory
        try {
          fs.cpSync(extPath, destPath, { recursive: true });
          copiedPaths.push(destPath);
          console.log(`[Browser Recorder] ✓ Copied extension: ${extensionId}`);

          // Log manifest permissions for debugging
          const manifestPath = path.join(destPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            console.log(`[Browser Recorder]   - Permissions: ${JSON.stringify(manifest.permissions || [])}`);
            console.log(`[Browser Recorder]   - Host permissions: ${JSON.stringify(manifest.host_permissions || [])}`);
          }
        } catch (copyErr) {
          console.error(`[Browser Recorder] Failed to copy extension ${extensionId}:`, copyErr);
        }
      }

      // Copy native messaging host manifests to the profile directory
      // This allows extensions to communicate with native apps
      this.copyNativeMessagingHosts();

      console.log(`[Browser Recorder] Successfully copied ${copiedPaths.length}/${this.extensionPaths.length} extensions`);
      console.log(`[Browser Recorder] Extensions will auto-grant all manifest permissions (unpacked mode)`);
      return copiedPaths;
    } catch (error) {
      console.error('[Browser Recorder] Error copying extensions:', error);
      return [];
    }
  }

  /**
   * Copy native messaging host manifests to profile directory
   * This allows extensions to communicate with native applications
   */
  private copyNativeMessagingHosts(): void {
    if (!this.profileDir) {
      return;
    }

    try {
      // Native messaging host locations on macOS
      const nativeHostLocations = [
        '/Library/Google/Chrome/NativeMessagingHosts',
        '/Library/Application Support/Google/Chrome/NativeMessagingHosts',
        path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
        '/Library/Application Support/Chromium/NativeMessagingHosts',
        path.join(os.homedir(), 'Library/Application Support/Chromium/NativeMessagingHosts')
      ];

      // Create NativeMessagingHosts directory in profile
      const destNativeHostsDir = path.join(this.profileDir, 'NativeMessagingHosts');
      if (!fs.existsSync(destNativeHostsDir)) {
        fs.mkdirSync(destNativeHostsDir, { recursive: true });
      }

      let copiedHostsCount = 0;

      // Copy all native messaging host manifests from all locations
      for (const location of nativeHostLocations) {
        if (fs.existsSync(location)) {
          try {
            const files = fs.readdirSync(location);
            for (const file of files) {
              if (file.endsWith('.json')) {
                const sourcePath = path.join(location, file);
                const destPath = path.join(destNativeHostsDir, file);

                if (!fs.existsSync(destPath)) {
                  fs.copyFileSync(sourcePath, destPath);
                  copiedHostsCount++;
                  console.log(`[Browser Recorder] ✓ Copied native host: ${file}`);
                }
              }
            }
          } catch (err) {
            console.warn(`[Browser Recorder] Could not copy native hosts from ${location}:`, err);
          }
        }
      }

      if (copiedHostsCount > 0) {
        console.log(`[Browser Recorder] ✓ Copied ${copiedHostsCount} native messaging host(s)`);
      } else {
        console.log(`[Browser Recorder] No native messaging hosts found to copy`);
      }
    } catch (error) {
      console.error('[Browser Recorder] Error copying native messaging hosts:', error);
    }
  }

  /**
   * Clean up temporary extensions directory
   */
  private cleanupTempExtensions(): void {
    if (this.tempExtensionsDir) {
      try {
        fs.rmSync(this.tempExtensionsDir, { recursive: true, force: true });
        console.log('[Browser Recorder] 🧹 Cleaned up temporary extensions directory');
      } catch (err) {
        console.warn('[Browser Recorder] Failed to clean up temp extensions:', err);
      }
      this.tempExtensionsDir = null;
    }
  }

  /**
   * Delete an action by index
   */
  deleteAction(index: number): void {
    if (index >= 0 && index < this.actions.length) {
      console.log('🗑️ Deleting action at index:', index, this.actions[index]);
      this.actions.splice(index, 1);
      this.updateGeneratedCode();
    } else {
      console.error('❌ Invalid action index:', index);
    }
  }

  /**
   * Get all actions (for UI display)
   */
  getActions(): RecordedAction[] {
    return this.actions;
  }

  /**
   * Generate a safe ID selector that handles special characters like dots
   * Uses attribute selector to avoid CSS escaping issues
   */
  private generateIdSelector(id: string): string {
    return `[id="${id}"]`;
  }

  async start(url: string, onBrowserClosed?: () => void): Promise<void> {
    // Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // Calculate window size (60% of screen width, full height)
    const browserWidth = Math.floor(width * 0.6);
    const browserHeight = height;
    
    // Position on the right side of screen
    const browserX = width - browserWidth;
    const browserY = 0;

    // Create downloads directory in system Downloads folder (grouped under EGDesk-Browser)
    const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Browser', this.scriptName);
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    console.log('📥 Downloads will be saved to:', downloadsPath);

    // Create temporary profile directory in userData (avoids macOS permission issues)
    // Fallback to os.tmpdir() if userData is not available
    let profilesDir: string;
    try {
      const userData = app.getPath('userData');
      if (!userData || userData === '/' || userData.length < 3) {
        throw new Error('Invalid userData path');
      }
      profilesDir = path.join(userData, 'chrome-profiles');
    } catch (err) {
      console.warn('⚠️ userData not available, using os.tmpdir():', err);
      profilesDir = path.join(os.tmpdir(), 'playwright-profiles');
    }

    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    this.profileDir = fs.mkdtempSync(path.join(profilesDir, 'playwright-recording-'));
    console.log('📁 Using profile directory:', this.profileDir);

    // Launch browser using Playwright's persistent context
    console.log('🎭 Launching browser with persistent context');
    console.log('📐 Window dimensions:', {
      browserWidth,
      browserHeight,
      position: { x: browserX, y: browserY }
    });

    try {
      // Copy extensions to temporary directory if any are selected
      // This is needed because Chrome removed --load-extension support in v137+
      // We use Chromium channel when extensions are present
      let copiedExtensionPaths: string[] = [];
      if (this.extensionPaths.length > 0) {
        copiedExtensionPaths = this.copyExtensionsToTemp();
      }

      // Build browser args
      const args = [
        `--window-size=${browserWidth},${browserHeight}`,
        `--window-position=${browserX},${browserY}`,
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        // Permission handling for localhost and private network access
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-features=PrivateNetworkAccessSendPreflights',
        '--disable-features=PrivateNetworkAccessRespectPreflightResults'
      ];

      // Add Chrome extension args if extensions were successfully copied
      if (copiedExtensionPaths.length > 0) {
        const extensionPathsStr = copiedExtensionPaths.join(',');
        args.push(`--disable-extensions-except=${extensionPathsStr}`);
        args.push(`--load-extension=${extensionPathsStr}`);
        console.log(`[Browser Recorder] Loading ${copiedExtensionPaths.length} Chrome extensions from temp location`);
      }

      // Use launchPersistentContext for more reliable browser management
      // Use 'chromium' channel when extensions are loaded (Chrome removed --load-extension support)
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: false,
        channel: copiedExtensionPaths.length > 0 ? 'chromium' : 'chrome',
        viewport: null,
        permissions: ['clipboard-read', 'clipboard-write'],
        acceptDownloads: true,
        downloadsPath: downloadsPath,
        args: args
      });
      console.log('✅ Browser launched successfully with channel: chrome');
    } catch (err) {
      console.error('❌ Failed to launch with channel chrome:', err);

      // Fallback: try without channel (uses Playwright's bundled Chromium)
      try {
        console.log('🔄 Trying fallback: Playwright bundled Chromium');
        this.context = await chromium.launchPersistentContext(this.profileDir, {
          headless: false,
          viewport: null,
          permissions: ['clipboard-read', 'clipboard-write'],
          acceptDownloads: true,
          downloadsPath: downloadsPath,
          args: [
            `--window-size=${browserWidth},${browserHeight}`,
            `--window-position=${browserX},${browserY}`,
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            // Permission handling for localhost and private network access
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--allow-running-insecure-content',
            '--disable-features=PrivateNetworkAccessSendPreflights',
            '--disable-features=PrivateNetworkAccessRespectPreflightResults'
          ]
        });
        console.log('✅ Browser launched successfully with bundled Chromium');
      } catch (fallbackErr) {
        console.error('❌ Failed to launch bundled Chromium:', fallbackErr);
        throw new Error('Could not launch any browser. Please ensure Chrome is installed or allow Playwright to download Chromium.');
      }
    }

    // Initialize OS-level automation for native dialogs
    this.osAutomation = new OSAutomation();
    const osStats = this.osAutomation.getStats();
    if (osStats.available) {
      console.log('✅ OS-level automation initialized (for print/save dialogs)');
    } else {
      console.log('⚠️ OS-level automation not available (native dialogs must be handled manually)');
    }

    // Set up browser close detection (context close event)
    this.context.on('close', () => {
      console.log('🔌 Browser context closed - user closed the window');
      if (this.isRecording && onBrowserClosed) {
        this.isRecording = false;
        onBrowserClosed();
      }
    });

    // Listen for new tabs/popups
    this.context.on('page', async (newPage) => {
      console.log('🆕 New tab/popup opened:', newPage.url());

      // Wait for the page to load
      await newPage.waitForLoadState('domcontentloaded').catch(() => {});

      const newUrl = newPage.url();
      this.actions.push({
        type: 'newTab',
        newTabUrl: newUrl,
        timestamp: Date.now() - this.startTime
      });

      // Push current page to stack before switching
      if (this.page) {
        this.pageStack.push(this.page);
        console.log('📚 Pushed page to stack. Stack size:', this.pageStack.length);
      }

      // Listen for when this new page closes
      newPage.on('close', () => {
        console.log('🚪 Page closed:', newPage.url());

        // Record the close action
        this.actions.push({
          type: 'closeTab',
          closedTabUrl: newPage.url(),
          timestamp: Date.now() - this.startTime
        });

        // Switch back to previous page
        const previousPage = this.pageStack.pop();
        if (previousPage) {
          this.page = previousPage;
          console.log('⬅️ Switched back to previous page:', previousPage.url());
          console.log('📚 Stack size after pop:', this.pageStack.length);
        } else {
          console.log('⚠️ No previous page in stack');
        }

        this.updateGeneratedCode();
      });

      // Switch to the new page for recording
      this.page = newPage;

      // Set up listeners on the new page
      this.setupPageListeners();
      await this.injectKeyboardListener();
      await this.injectControllerUI();

      // Re-apply mode states (coordinate mode, etc.)
      await this.reapplyModeStates();

      // Wait a bit for iframes in the new page to load
      await newPage.waitForTimeout(1000);

      // Inject into iframes on the new page
      await this.injectIntoIframes();

      // Show iframe ready notification on new page
      await newPage.evaluate(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 80px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 999998;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        notification.textContent = '✅ New page ready (iframes loaded)';
        if (document.body) {
          document.body.appendChild(notification);
        }
        setTimeout(() => notification.remove(), 2000);
      }).catch(() => {});

      // Set up dialog handling for new page (auto-accept alerts/confirms for downloads)
      newPage.on('dialog', async (dialog) => {
        console.log(`🔔 Dialog detected on new page: ${dialog.type()} - "${dialog.message()}"`);
        await dialog.accept();
        console.log('✅ Dialog accepted on new page');
      });

      // Set up download handling for the new page
      this.page.on('download', async (download) => {
        console.log('📥 Download started:', download.url());
        const suggestedFilename = download.suggestedFilename();
        const filePath = path.join(downloadsPath, suggestedFilename);

        try {
          this.actions.push({
            type: 'download',
            selector: 'download-wait',
            value: `Download started: ${suggestedFilename}`,
            timestamp: Date.now() - this.startTime
          });

          await download.saveAs(filePath);
          console.log('✅ Download saved to:', filePath);

          this.actions.push({
            type: 'download',
            selector: 'download-complete',
            value: filePath,
            timestamp: Date.now() - this.startTime
          });

          this.updateGeneratedCode();
        } catch (err) {
          console.error('❌ Download failed:', err);
        }
      });

      this.updateGeneratedCode();
    });

    // Add init scripts before creating the page
    await this.setupInitScripts();

    // Get or create page (persistent context might already have pages)
    const existingPages = this.context.pages();
    this.page = existingPages.length > 0 ? existingPages[0] : await this.context.newPage();
    
    // Inject keyboard event listener
    await this.injectKeyboardListener();
    
    // Set up page event listeners
    this.setupPageListeners();

    // Set up dialog handling (auto-accept alerts/confirms for downloads)
    this.page.on('dialog', async (dialog) => {
      console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
      await dialog.accept();
      console.log('✅ Dialog accepted');
    });

    // Set up download handling
    this.page.on('download', async (download) => {
      console.log('📥 Download started:', download.url());
      const suggestedFilename = download.suggestedFilename();
      const filePath = path.join(downloadsPath, suggestedFilename);
      
      try {
        // Record download start action
        this.actions.push({
          type: 'download',
          selector: 'download-wait',
          value: `Download started: ${suggestedFilename}`,
          timestamp: Date.now() - this.startTime
        });
        
        await download.saveAs(filePath);
        console.log('✅ Download saved to:', filePath);
        
        // Record download complete action
        this.actions.push({
          type: 'download',
          selector: 'download-complete',
          value: `Download completed: ${suggestedFilename}`,
          timestamp: Date.now() - this.startTime
        });
        
        this.updateGeneratedCode();
      } catch (err) {
        console.error('❌ Download failed:', err);
      }
    });
    
    // Navigate to URL
    await this.page.goto(url);
    this.actions.push({
      type: 'navigate',
      url: url,
      timestamp: Date.now() - this.startTime
    });

    // Wait for iframes to load
    await this.page.waitForTimeout(2000);

    // Add controller UI
    await this.injectControllerUI();

    // Inject into any iframes immediately
    await this.injectIntoIframes();

    // Give iframes time to set up listeners
    await this.page.waitForTimeout(500);

    // Show notification that recording is ready
    await this.page.evaluate(() => {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 999998;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      `;
      notification.textContent = '✅ Iframes ready for recording';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    });

    this.isRecording = true;
    this.updateGeneratedCode();

    // Start periodic controller check
    this.startControllerCheck();
  }

  private startControllerCheck(): void {
    // Clear any existing interval
    if (this.controllerCheckInterval) {
      clearInterval(this.controllerCheckInterval);
    }

    // Check every 2 seconds if controller exists and re-inject iframes
    this.controllerCheckInterval = setInterval(async () => {
      if (!this.page || !this.isRecording) return;

      try {
        const hasController = await this.page.evaluate(() => {
          return !!document.getElementById('browser-recorder-controller');
        });

        if (!hasController) {
          console.log('🔍 Controller missing, re-injecting...');
          await this.injectControllerUI();
        }

        // Also periodically re-inject into new iframes
        await this.injectIntoIframes();
      } catch (err) {
        // Page might be navigating, ignore
      }
    }, 2000);
  }

  private async injectControllerUI(): Promise<void> {
    if (!this.page) return;

    // Inject into main frame
    await this.page.evaluate(() => {
      // Check if controller already exists
      if (document.getElementById('browser-recorder-controller')) {
        return;
      }
      
      // Create controller container
      const controller = document.createElement('div');
      controller.id = 'browser-recorder-controller';
      controller.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 10px;
        padding: 6px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        max-width: 700px;
        transition: all 0.3s ease;
        pointer-events: all;
        cursor: move;
        user-select: none;
      `;
      
      // Common button style
      const btnStyle = `
        background: #333;
        color: #fff;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 5px 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
        font-size: 11px;
        white-space: nowrap;
      `;

      // Create highlight toggle button
      const highlightBtn = document.createElement('button');
      highlightBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>Highlight</span>
      `;
      highlightBtn.style.cssText = btnStyle;
      
      // Create coordinate mode button
      const coordBtn = document.createElement('button');
      coordBtn.setAttribute('data-coord-mode', 'true');
      coordBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <line x1="1" y1="12" x2="23" y2="12"></line>
          <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
        </svg>
        <span>Coords</span>
      `;
      coordBtn.style.cssText = btnStyle;

      // Create wait for element button
      const waitBtn = document.createElement('button');
      waitBtn.setAttribute('data-wait-mode', 'true');
      waitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
        <span>Wait</span>
      `;
      waitBtn.style.cssText = btnStyle.replace('#333', '#2196F3').replace('#444', '#1976D2');

      // Create mark date button
      const markDateBtn = document.createElement('button');
      markDateBtn.setAttribute('data-date-marking-mode', 'false');
      markDateBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Date</span>
      `;
      markDateBtn.style.cssText = btnStyle.replace('#333', '#9C27B0').replace('#444', '#7B1FA2');

      // Create capture table button
      const captureTableBtn = document.createElement('button');
      captureTableBtn.setAttribute('data-capture-table', 'true');
      captureTableBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>
        <span>Table</span>
      `;
      captureTableBtn.style.cssText = btnStyle.replace('#333', '#FF9800').replace('#444', '#F57C00');

      // Create click until gone button
      const clickUntilGoneBtn = document.createElement('button');
      clickUntilGoneBtn.setAttribute('data-click-until-gone', 'false');
      clickUntilGoneBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 10h1m4 0h1m-5 4h4"></path>
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"></path>
          <path d="M15 9l-3 3-3-3" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span>Loop</span>
      `;
      clickUntilGoneBtn.style.cssText = btnStyle.replace('#333', '#00BCD4').replace('#444', '#0097A7');

      // Create stop recording button
      const stopBtn = document.createElement('button');
      stopBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" fill="currentColor"></rect>
        </svg>
        <span>Stop</span>
      `;
      stopBtn.style.cssText = btnStyle.replace('#333', '#ff4444').replace('#444', '#cc0000') + 'font-weight: 600;';

      // Create Gemini button
      const geminiBtn = document.createElement('button');
      geminiBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>AI</span>
      `;
      geminiBtn.style.cssText = btnStyle + 'position: relative; z-index: 10; pointer-events: all;';
      geminiBtn.disabled = true;
      geminiBtn.style.opacity = '0.5';
      
      // Recording indicator
      const recordingIndicator = document.createElement('div');
      recordingIndicator.innerHTML = `
        <span style="
          display: inline-block;
          width: 6px;
          height: 6px;
          background: #ff4444;
          border-radius: 50%;
          margin-right: 5px;
          animation: pulse 1.5s infinite;
        "></span>
        REC
      `;
      recordingIndicator.style.cssText = `
        color: #fff;
        display: flex;
        align-items: center;
        padding: 0 6px;
        cursor: inherit;
        pointer-events: none;
        font-size: 11px;
        font-weight: 600;
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        #browser-recorder-controller button {
          cursor: pointer !important;
        }
        
        #browser-recorder-controller button:hover {
          background: #444 !important;
          border-color: #555 !important;
        }
        
        #browser-recorder-controller button.active {
          background: #4CAF50 !important;
          border-color: #4CAF50 !important;
        }
        
        #browser-recorder-controller button.active:hover {
          background: #45a049 !important;
          border-color: #45a049 !important;
        }
        
        #browser-recorder-controller:active {
          cursor: grabbing !important;
        }
      `;
      
      controller.appendChild(recordingIndicator);
      controller.appendChild(highlightBtn);
      controller.appendChild(coordBtn);
      controller.appendChild(waitBtn);
      controller.appendChild(markDateBtn);
      controller.appendChild(captureTableBtn);
      controller.appendChild(clickUntilGoneBtn);
      controller.appendChild(stopBtn);
      controller.appendChild(geminiBtn);
      
      try {
        if (document.head) {
          document.head.appendChild(style);
        }
        if (document.body) {
          document.body.appendChild(controller);
        }
      } catch (e) {
        console.warn('Failed to add recorder controller:', e);
      }
      
      // Make the controller draggable
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let startRight = 0;
      let startBottom = 0;
      
      function dragStart(e: any) {
        // Only drag if clicking on the controller itself or its direct children (not buttons)
        const isButton = e.target.tagName === 'BUTTON' || e.target.closest('button');
        if (isButton) {
          return;
        }
        
        // Get initial mouse position
        if (e.type === "touchstart") {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        } else {
          startX = e.clientX;
          startY = e.clientY;
        }
        
        // Get current right/bottom values
        const computedStyle = window.getComputedStyle(controller);
        startRight = parseInt(computedStyle.right) || 0;
        startBottom = parseInt(computedStyle.bottom) || 0;
        
        isDragging = true;
        controller.style.transition = 'none';
        controller.style.cursor = 'grabbing';
      }
      
      function dragEnd(e: any) {
        isDragging = false;
        controller.style.transition = 'all 0.3s ease';
        controller.style.cursor = 'move';
      }
      
      function drag(e: any) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        let currentX, currentY;
        if (e.type === "touchmove") {
          currentX = e.touches[0].clientX;
          currentY = e.touches[0].clientY;
        } else {
          currentX = e.clientX;
          currentY = e.clientY;
        }
        
        // Calculate the difference from start position
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        // Calculate new position (inverted because we're using right/bottom)
        const newRight = startRight - deltaX;
        const newBottom = startBottom - deltaY;
        
        // Get controller dimensions
        const rect = controller.getBoundingClientRect();
        
        // Constrain to viewport with some margin
        const margin = 10;
        const maxRight = window.innerWidth - rect.width - margin;
        const maxBottom = window.innerHeight - rect.height - margin;
        
        // Apply constraints
        const constrainedRight = Math.max(margin, Math.min(newRight, maxRight));
        const constrainedBottom = Math.max(margin, Math.min(newBottom, maxBottom));
        
        // Apply new position
        controller.style.right = constrainedRight + 'px';
        controller.style.bottom = constrainedBottom + 'px';
      }
      
      // Add event listeners for drag
      controller.addEventListener('mousedown', dragStart, true);
      document.addEventListener('mouseup', dragEnd, true);
      document.addEventListener('mousemove', drag, true);
      
      // Touch events for mobile
      controller.addEventListener('touchstart', dragStart, { passive: false });
      document.addEventListener('touchend', dragEnd, { passive: false });
      document.addEventListener('touchmove', drag, { passive: false });
      
      // Set up highlight toggle functionality
      let highlightMode = false;
      let currentHighlightedElement: HTMLElement | null = null;
      let coordinateMode = false;

      // IMPORTANT: Initialize coordinate mode from global state if it exists
      if ((window as any).__playwrightRecorderCoordinateMode !== undefined) {
        coordinateMode = (window as any).__playwrightRecorderCoordinateMode;
        console.log('📍 Restored coordinate mode from global state:', coordinateMode);
        if (coordinateMode) {
          coordBtn.classList.add('active');
          coordBtn.style.background = '#4CAF50';
          coordBtn.style.borderColor = '#4CAF50';
          document.body.style.cursor = 'crosshair';
        }
      }

      // Listen for element highlight updates
      document.addEventListener('browser-recorder-element-highlighted', (e: any) => {
        currentHighlightedElement = e.detail.element;
        // Enable/disable Gemini button based on whether an element is highlighted AND shift is pressed
        const shouldEnableGemini = currentHighlightedElement && e.detail.isShiftPressed;
        geminiBtn.disabled = !shouldEnableGemini;
        geminiBtn.style.opacity = shouldEnableGemini ? '1' : '0.5';
        geminiBtn.style.cursor = shouldEnableGemini ? 'pointer' : 'not-allowed';

        // Debug log
        console.log('Element highlighted:', currentHighlightedElement ? currentHighlightedElement.tagName : 'none', 'Shift:', e.detail.isShiftPressed);
      });
      
      // Set up coordinate mode toggle
      coordBtn.addEventListener('click', () => {
        coordinateMode = !coordinateMode;
        coordBtn.classList.toggle('active', coordinateMode);
        console.log('🔘 Coordinate button clicked, mode is now:', coordinateMode);

        // Save to global state so it persists across page reloads/navigations
        (window as any).__playwrightRecorderCoordinateMode = coordinateMode;
        console.log('💾 Saved coordinate mode to global state:', coordinateMode);

        if (coordinateMode) {
          coordBtn.style.background = '#4CAF50';
          coordBtn.style.borderColor = '#4CAF50';
          document.body.style.cursor = 'crosshair';
          console.log('✅ Coordinate mode ENABLED');
          
          // Show coordinate mode notification
          const coordNotification = document.createElement('div');
          coordNotification.id = 'coord-notification';
          coordNotification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 250px;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
          `;
          coordNotification.innerHTML = `
            <strong>📍 Coordinate Mode Active</strong><br>
            Clicks will be recorded as X,Y coordinates
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
              Moves away when cursor approaches
            </div>
          `;

          try {
            if (document.body) {
              document.body.appendChild(coordNotification);
            }
          } catch (e) {
            console.warn('Failed to show coordinate notification:', e);
          }

          // Add proximity detection
          const proximityThreshold = 150;
          let mouseX = 0;
          let mouseY = 0;

          const checkCoordProximity = () => {
            const rect = coordNotification.getBoundingClientRect();
            const bannerCenterX = rect.left + rect.width / 2;
            const bannerCenterY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
              Math.pow(mouseX - bannerCenterX, 2) +
              Math.pow(mouseY - bannerCenterY, 2)
            );

            if (distance < proximityThreshold) {
              coordNotification.style.opacity = '0.1';
              coordNotification.style.transform = 'scale(0.8)';
            } else {
              coordNotification.style.opacity = '1';
              coordNotification.style.transform = 'scale(1)';
            }
          };

          const coordMouseMoveHandler = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            checkCoordProximity();
          };

          document.addEventListener('mousemove', coordMouseMoveHandler);

          // Remove notification after 3 seconds
          setTimeout(() => {
            document.removeEventListener('mousemove', coordMouseMoveHandler);
            coordNotification.remove();
          }, 3000);
        } else {
          coordBtn.style.background = '#333';
          coordBtn.style.borderColor = '#444';
          document.body.style.cursor = '';

          // Remove any existing notification and cleanup
          const existingNotification = document.getElementById('coord-notification');
          if (existingNotification) {
            const handler = (existingNotification as any).__mouseMoveHandler;
            if (handler) {
              document.removeEventListener('mousemove', handler);
            }
            existingNotification.remove();
          }
        }

        // Dispatch event to notify about coordinate mode change
        const event = new CustomEvent('browser-recorder-coordinate-toggle', {
          detail: { enabled: coordinateMode }
        });
        console.log('📡 Dispatching coordinate toggle event, enabled:', coordinateMode);
        console.log('📡 Event detail:', event.detail);
        console.log('📡 Document:', document);

        // CRITICAL: Dispatch the event synchronously
        const dispatched = document.dispatchEvent(event);
        console.log('📡 Event dispatched, returned:', dispatched);

        // ALSO set the global state directly so the handleClick function can read it
        (window as any).__playwrightRecorderCoordinateModeActive = coordinateMode;
        console.log('💾 Set global __playwrightRecorderCoordinateModeActive to:', coordinateMode);

        // Notify main process about coordinate mode change
        if ((window as any).__playwrightRecorderOnCoordinateModeChange) {
          (window as any).__playwrightRecorderOnCoordinateModeChange(coordinateMode);
        }
      });
      
      highlightBtn.addEventListener('click', () => {
        highlightMode = !highlightMode;
        highlightBtn.classList.toggle('active', highlightMode);
        
        // Trigger highlight mode
        const event = new CustomEvent('browser-recorder-highlight-toggle', { 
          detail: { enabled: highlightMode } 
        });
        document.dispatchEvent(event);
        
        // Update cursor
        document.body.style.cursor = highlightMode ? 'crosshair' : '';
        
        // If turning off, disable Gemini button
        if (!highlightMode) {
          currentHighlightedElement = null;
          geminiBtn.disabled = true;
          geminiBtn.style.opacity = '0.5';
        }
      });
      
      // Set up stop button functionality
      stopBtn.addEventListener('click', () => {
        // Send stop signal to Playwright recorder
        if ((window as any).__playwrightRecorderOnStop) {
          (window as any).__playwrightRecorderOnStop();
        }
        
        // Hide the controller to indicate stopping
        controller.style.opacity = '0.5';
        stopBtn.disabled = true;
        stopBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
          </svg>
          <span>Stopping...</span>
        `;
        
        // Show notification
        const stopNotification = document.createElement('div');
        stopNotification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff4444;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 999999;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        `;
        stopNotification.innerHTML = `
          <strong>⏹️ Recording Stopped</strong><br>
          Generating test code...
          <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
            Moves away when cursor approaches
          </div>
        `;

        try {
          if (document.body) {
            document.body.appendChild(stopNotification);
          }
        } catch (e) {
          console.warn('Failed to show stop notification:', e);
        }

        // Add proximity detection
        const proximityThreshold = 150;
        let mouseX = 0;
        let mouseY = 0;

        const checkStopProximity = () => {
          const rect = stopNotification.getBoundingClientRect();
          const bannerCenterX = rect.left + rect.width / 2;
          const bannerCenterY = rect.top + rect.height / 2;

          const distance = Math.sqrt(
            Math.pow(mouseX - bannerCenterX, 2) +
            Math.pow(mouseY - bannerCenterY, 2)
          );

          if (distance < proximityThreshold) {
            stopNotification.style.opacity = '0.1';
            stopNotification.style.transform = 'scale(0.8)';
          } else {
            stopNotification.style.opacity = '1';
            stopNotification.style.transform = 'scale(1)';
          }
        };

        const stopMouseMoveHandler = (e: MouseEvent) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
          checkStopProximity();
        };

        document.addEventListener('mousemove', stopMouseMoveHandler);

        // Remove notification after 3 seconds
        setTimeout(() => {
          document.removeEventListener('mousemove', stopMouseMoveHandler);
          stopNotification.remove();
        }, 3000);
      });
      
      // Set up wait for element button functionality
      let waitMode = false;
      waitBtn.addEventListener('click', () => {
        waitMode = !waitMode;
        waitBtn.classList.toggle('active', waitMode);
        
        if (waitMode) {
          waitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            <span>Select</span>
          `;
          waitBtn.style.background = '#4CAF50';
          waitBtn.style.borderColor = '#45a049';
          
          // Show instructions
          const waitInstructions = document.createElement('div');
          waitInstructions.id = 'wait-instructions';
          waitInstructions.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 250px;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
          `;
          waitInstructions.innerHTML = `
            <strong>🎯 Wait Mode Active</strong><br>
            Click on an element to wait for it to load
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
              Moves away when cursor approaches
            </div>
          `;

          try {
            if (document.body) {
              document.body.appendChild(waitInstructions);
            }
          } catch (e) {
            console.warn('Failed to show wait instructions:', e);
          }

          // Add proximity detection
          const proximityThreshold = 150;
          let mouseX = 0;
          let mouseY = 0;

          const checkWaitProximity = () => {
            const rect = waitInstructions.getBoundingClientRect();
            const bannerCenterX = rect.left + rect.width / 2;
            const bannerCenterY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
              Math.pow(mouseX - bannerCenterX, 2) +
              Math.pow(mouseY - bannerCenterY, 2)
            );

            if (distance < proximityThreshold) {
              waitInstructions.style.opacity = '0.1';
              waitInstructions.style.transform = 'scale(0.8)';
            } else {
              waitInstructions.style.opacity = '1';
              waitInstructions.style.transform = 'scale(1)';
            }
          };

          const waitMouseMoveHandler = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            checkWaitProximity();
          };

          document.addEventListener('mousemove', waitMouseMoveHandler);

          // Store handler for cleanup
          (waitInstructions as any).__mouseMoveHandler = waitMouseMoveHandler;

          // Change cursor to indicate wait mode
          document.body.style.cursor = 'crosshair';
        } else {
          waitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            <span>Wait</span>
          `;
          waitBtn.style.background = '#2196F3';
          waitBtn.style.borderColor = '#1976D2';

          // Remove instructions and cleanup mousemove listener
          const instructions = document.getElementById('wait-instructions');
          if (instructions) {
            const handler = (instructions as any).__mouseMoveHandler;
            if (handler) {
              document.removeEventListener('mousemove', handler);
            }
            instructions.remove();
          }

          // Reset cursor
          document.body.style.cursor = '';
        }
      });

      // Set up mark date button functionality
      let dateMarkingMode = false;
      let dateMarkingStep: 'year' | 'month' | 'day' | null = null;
      let dateMarkingInstructions: HTMLDivElement | null = null;

      markDateBtn.addEventListener('click', () => {
        dateMarkingMode = !dateMarkingMode;
        markDateBtn.classList.toggle('active', dateMarkingMode);

        if (dateMarkingMode) {
          // Enter date marking mode
          dateMarkingStep = 'year';
          markDateBtn.style.background = '#4CAF50';
          markDateBtn.style.borderColor = '#4CAF50';

          // Update window state for change listener
          (window as any).__playwrightRecorderDateMarkingMode = true;
          (window as any).__playwrightRecorderDateMarkingStep = 'year';

          // Show instructions
          dateMarkingInstructions = document.createElement('div');
          dateMarkingInstructions.id = 'date-marking-instructions';
          dateMarkingInstructions.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #9C27B0;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            line-height: 1.5;
            pointer-events: auto;
            cursor: move;
            user-select: none;
          `;
          dateMarkingInstructions.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <strong>📅 Date Marking Mode Active</strong>
              <span style="opacity: 0.6; font-size: 11px;">↕️ Drag to move</span>
            </div>
            <div style="margin-top: 8px; font-size: 13px;">
              <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                Step 1/3: Select YEAR dropdown
              </span>
            </div>
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
              Click on the dropdown that contains years
            </div>
            <div style="margin-top: 12px;">
              <button id="skip-year-btn" style="background: rgba(255,255,255,0.3); color: white; border: 1px solid rgba(255,255,255,0.5); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s; margin-right: 8px;">
                ⏭️ Skip Year
              </button>
              <button id="cancel-date-marking-btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s;">
                ❌ Cancel
              </button>
            </div>
          `;

          try {
            if (document.body) {
              document.body.appendChild(dateMarkingInstructions);

              // Add event listeners for skip and cancel buttons
              const skipYearBtn = document.getElementById('skip-year-btn');
              const cancelBtn = document.getElementById('cancel-date-marking-btn');

              if (skipYearBtn) {
                skipYearBtn.addEventListener('mouseenter', () => {
                  skipYearBtn.style.background = 'rgba(255,255,255,0.4)';
                });
                skipYearBtn.addEventListener('mouseleave', () => {
                  skipYearBtn.style.background = 'rgba(255,255,255,0.3)';
                });
                skipYearBtn.addEventListener('click', () => {
                  window.postMessage({ type: 'skip-date-component', step: 'year' }, '*');
                });
              }

              if (cancelBtn) {
                cancelBtn.addEventListener('mouseenter', () => {
                  cancelBtn.style.background = 'rgba(255,255,255,0.3)';
                });
                cancelBtn.addEventListener('mouseleave', () => {
                  cancelBtn.style.background = 'rgba(255,255,255,0.2)';
                });
                cancelBtn.addEventListener('click', () => {
                  // Trigger exit date marking mode
                  markDateBtn.click();
                });
              }

              // Make banner draggable
              let isDragging = false;
              let currentX = 0;
              let currentY = 0;
              let initialX = 0;
              let initialY = 0;

              const dragStart = (e: MouseEvent) => {
                // Only start drag if not clicking on buttons
                const target = e.target as HTMLElement;
                if (target.tagName === 'BUTTON' || target.closest('button')) {
                  return;
                }

                isDragging = true;
                initialX = e.clientX - currentX;
                initialY = e.clientY - currentY;
                dateMarkingInstructions!.style.transition = 'none'; // Disable transition during drag
              };

              const drag = (e: MouseEvent) => {
                if (!isDragging) return;

                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                dateMarkingInstructions!.style.transform = `translate(${currentX}px, ${currentY}px)`;
              };

              const dragEnd = () => {
                isDragging = false;
                dateMarkingInstructions!.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
              };

              dateMarkingInstructions.addEventListener('mousedown', dragStart);
              document.addEventListener('mousemove', drag);
              document.addEventListener('mouseup', dragEnd);

              // Store handlers for cleanup
              (dateMarkingInstructions as any).__dragHandlers = {
                dragStart,
                drag,
                dragEnd
              };
            }
          } catch (e) {
            console.warn('Failed to show date marking instructions:', e);
          }

          document.body.style.cursor = 'help';
        } else {
          // Exit date marking mode
          markDateBtn.style.background = '#9C27B0';
          markDateBtn.style.borderColor = '#7B1FA2';

          // Clear window state
          (window as any).__playwrightRecorderDateMarkingMode = false;
          (window as any).__playwrightRecorderDateMarkingStep = null;
          dateMarkingStep = null;

          // Remove instructions and cleanup event listeners
          if (dateMarkingInstructions) {
            // Clean up drag event listeners
            const handlers = (dateMarkingInstructions as any).__dragHandlers;
            if (handlers) {
              dateMarkingInstructions.removeEventListener('mousedown', handlers.dragStart);
              document.removeEventListener('mousemove', handlers.drag);
              document.removeEventListener('mouseup', handlers.dragEnd);
            }

            dateMarkingInstructions.remove();
            dateMarkingInstructions = null;
          }

          document.body.style.cursor = '';
        }
      });

      // Function to update date marking instructions
      (window as any).__updateDateMarkingInstructions = (step: 'year' | 'month' | 'day') => {
        if (!dateMarkingInstructions) return;

        const stepNum = step === 'year' ? 1 : step === 'month' ? 2 : 3;
        const stepLabel = step === 'year' ? 'YEAR' : step === 'month' ? 'MONTH' : 'DAY';
        const instruction = step === 'year' ? 'years' : step === 'month' ? 'months (1-12 or names)' : 'days (1-31)';
        const skipBtnId = `skip-${step}-btn`;

        dateMarkingInstructions.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong>📅 Date Marking Mode Active</strong>
            <span style="opacity: 0.6; font-size: 11px;">↕️ Drag to move</span>
          </div>
          <div style="margin-top: 8px; font-size: 13px;">
            <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              Step ${stepNum}/3: Select ${stepLabel} dropdown
            </span>
          </div>
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
            Click on the dropdown that contains ${instruction}
          </div>
          <div style="margin-top: 12px;">
            <button id="${skipBtnId}" style="background: rgba(255,255,255,0.3); color: white; border: 1px solid rgba(255,255,255,0.5); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s; margin-right: 8px;">
              ⏭️ Skip ${stepLabel.charAt(0) + stepLabel.slice(1).toLowerCase()}
            </button>
            <button id="cancel-date-marking-btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s;">
              ❌ Cancel
            </button>
          </div>
        `;

        // Add event listeners for the new buttons
        setTimeout(() => {
          const skipBtn = document.getElementById(skipBtnId);
          const cancelBtn = document.getElementById('cancel-date-marking-btn');

          if (skipBtn) {
            skipBtn.addEventListener('mouseenter', () => {
              skipBtn.style.background = 'rgba(255,255,255,0.4)';
            });
            skipBtn.addEventListener('mouseleave', () => {
              skipBtn.style.background = 'rgba(255,255,255,0.3)';
            });
            skipBtn.addEventListener('click', () => {
              window.postMessage({ type: 'skip-date-component', step: step }, '*');
            });
          }

          if (cancelBtn) {
            cancelBtn.addEventListener('mouseenter', () => {
              cancelBtn.style.background = 'rgba(255,255,255,0.3)';
            });
            cancelBtn.addEventListener('mouseleave', () => {
              cancelBtn.style.background = 'rgba(255,255,255,0.2)';
            });
            cancelBtn.addEventListener('click', () => {
              // Trigger exit date marking mode
              markDateBtn.click();
            });
          }
        }, 0);
      };

      // Function to exit date marking mode
      (window as any).__exitDateMarkingMode = () => {
        if (dateMarkingMode) {
          dateMarkingMode = false;
          markDateBtn.classList.remove('active');
          markDateBtn.style.background = '#9C27B0';
          markDateBtn.style.borderColor = '#7B1FA2';

          (window as any).__playwrightRecorderDateMarkingMode = false;
          (window as any).__playwrightRecorderDateMarkingStep = null;
          dateMarkingStep = null;

          if (dateMarkingInstructions) {
            // Clean up drag event listeners
            const handlers = (dateMarkingInstructions as any).__dragHandlers;
            if (handlers) {
              dateMarkingInstructions.removeEventListener('mousedown', handlers.dragStart);
              document.removeEventListener('mousemove', handlers.drag);
              document.removeEventListener('mouseup', handlers.dragEnd);
            }

            dateMarkingInstructions.remove();
            dateMarkingInstructions = null;
          }

          // Remove all checkmarks
          const checkmarks = document.querySelectorAll('.date-marker-checkmark');
          checkmarks.forEach(mark => mark.remove());

          // Remove outlines from marked elements
          const outlinedElements = document.querySelectorAll('[style*="outline: 3px solid rgb(76, 175, 80)"]');
          outlinedElements.forEach((el: Element) => {
            (el as HTMLElement).style.outline = '';
            (el as HTMLElement).style.outlineOffset = '';
          });

          document.body.style.cursor = '';
        }
      };

      // Set up Capture Table button functionality
      captureTableBtn.addEventListener('click', async () => {
        console.log('📊 Capture Table clicked');

        // Visual feedback - brief pulse animation
        captureTableBtn.style.transform = 'scale(0.95)';
        setTimeout(() => captureTableBtn.style.transform = 'scale(1)', 100);

        // Find all tables on the page
        const tables = document.querySelectorAll('table');

        if (tables.length === 0) {
          // Show notification: no tables found
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF9800;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          `;
          notification.textContent = '⚠️ No tables found on this page';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
          return;
        }

        // Helper function to generate XPath for an element
        const getXPathForElement = (element: Element): string => {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }

          const parts: string[] = [];
          let currentElement: Element | null = element;

          while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling: Element | null = currentElement.previousElementSibling;

            while (sibling) {
              if (sibling.tagName === currentElement.tagName) {
                index++;
              }
              sibling = sibling.previousElementSibling;
            }

            const tagName = currentElement.tagName.toLowerCase();
            const pathIndex = index > 1 ? `[${index}]` : '';
            parts.unshift(`${tagName}${pathIndex}`);

            currentElement = currentElement.parentElement;
          }

          return parts.length ? '/' + parts.join('/') : '';
        };

        // Helper function to generate CSS selector
        const generateCSSSelector = (element: Element): string => {
          if (element.id) {
            return `[id="${element.id}"]`;
          }

          const path: string[] = [];
          let currentElement: Element | null = element;

          while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
            let selector = currentElement.tagName.toLowerCase();

            if (currentElement.className && typeof currentElement.className === 'string') {
              const classes = currentElement.className.trim().split(/\s+/);
              if (classes.length > 0 && classes[0]) {
                selector += '.' + classes[0];
              }
            }

            path.unshift(selector);
            currentElement = currentElement.parentElement;

            if (path.length >= 3) break; // Limit depth for readability
          }

          return path.join(' > ');
        };

        // Extract data from each table
        const tableData: Array<{
          xpath: string;
          cssSelector: string;
          headers: string[];
          sampleRow: string[];
          rowCount: number;
        }> = [];

        tables.forEach((table) => {
          // Generate XPath
          const xpath = getXPathForElement(table);

          // Generate CSS selector
          const cssSelector = generateCSSSelector(table);

          // Extract headers
          const headers: string[] = [];
          const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
          if (headerRow) {
            const ths = headerRow.querySelectorAll('th');
            if (ths.length > 0) {
              ths.forEach(th => headers.push(th.textContent?.trim() || ''));
            } else {
              // Use first row cells as headers if no <th> elements
              const tds = headerRow.querySelectorAll('td');
              tds.forEach(td => headers.push(td.textContent?.trim() || ''));
            }
          }

          // Extract sample row (first data row)
          const sampleRow: string[] = [];
          const tbody = table.querySelector('tbody');
          const firstDataRow = tbody ?
            tbody.querySelector('tr') :
            table.querySelectorAll('tr')[1]; // Skip header row if no tbody

          if (firstDataRow) {
            const cells = firstDataRow.querySelectorAll('td, th');
            cells.forEach(cell => sampleRow.push(cell.textContent?.trim() || ''));
          }

          // Count rows
          const allRows = tbody ?
            tbody.querySelectorAll('tr') :
            Array.from(table.querySelectorAll('tr')).slice(1); // Exclude header
          const rowCount = allRows.length;

          tableData.push({
            xpath,
            cssSelector,
            headers,
            sampleRow,
            rowCount
          });
        });

        // Send to recorder
        if ((window as any).__playwrightRecorderOnCaptureTable) {
          (window as any).__playwrightRecorderOnCaptureTable(tableData);
        }

        // Show success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 999999;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        notification.textContent = `✅ Captured ${tables.length} table${tables.length > 1 ? 's' : ''}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
      });

      // Set up Click Until Gone button functionality
      let clickUntilGoneMode = false;
      clickUntilGoneBtn.addEventListener('click', () => {
        clickUntilGoneMode = !clickUntilGoneMode;
        clickUntilGoneBtn.classList.toggle('active', clickUntilGoneMode);

        if (clickUntilGoneMode) {
          clickUntilGoneBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 10h1m4 0h1m-5 4h4"></path>
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"></path>
              <path d="M15 9l-3 3-3-3" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>Select</span>
          `;
          clickUntilGoneBtn.style.background = '#4CAF50';
          clickUntilGoneBtn.style.borderColor = '#45a049';

          // Show instructions
          const clickUntilGoneInstructions = document.createElement('div');
          clickUntilGoneInstructions.id = 'click-until-gone-instructions';
          clickUntilGoneInstructions.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #00BCD4;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 280px;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
          `;
          clickUntilGoneInstructions.innerHTML = `
            <strong>🔄 Click Until Gone Mode</strong><br>
            Click on a button/element to repeatedly click it until it disappears, is hidden, or becomes disabled
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
              Perfect for "Load More", pagination, and "Next" buttons
            </div>
          `;

          try {
            if (document.body) {
              document.body.appendChild(clickUntilGoneInstructions);
            }
          } catch (e) {
            console.warn('Failed to show click until gone instructions:', e);
          }

          // Add proximity detection
          const proximityThreshold = 150;
          let mouseX = 0;
          let mouseY = 0;

          const checkProximity = () => {
            const rect = clickUntilGoneInstructions.getBoundingClientRect();
            const bannerCenterX = rect.left + rect.width / 2;
            const bannerCenterY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
              Math.pow(mouseX - bannerCenterX, 2) +
              Math.pow(mouseY - bannerCenterY, 2)
            );

            if (distance < proximityThreshold) {
              clickUntilGoneInstructions.style.opacity = '0.1';
              clickUntilGoneInstructions.style.transform = 'scale(0.8)';
            } else {
              clickUntilGoneInstructions.style.opacity = '1';
              clickUntilGoneInstructions.style.transform = 'scale(1)';
            }
          };

          const mouseMoveHandler = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            checkProximity();
          };

          document.addEventListener('mousemove', mouseMoveHandler);

          // Store handler for cleanup
          (clickUntilGoneInstructions as any).__mouseMoveHandler = mouseMoveHandler;

          // Change cursor to indicate mode
          document.body.style.cursor = 'crosshair';
        } else {
          clickUntilGoneBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 10h1m4 0h1m-5 4h4"></path>
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"></path>
              <path d="M15 9l-3 3-3-3" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>Loop</span>
          `;
          clickUntilGoneBtn.style.background = '#00BCD4';
          clickUntilGoneBtn.style.borderColor = '#0097A7';

          // Remove instructions and cleanup
          const instructions = document.getElementById('click-until-gone-instructions');
          if (instructions) {
            const handler = (instructions as any).__mouseMoveHandler;
            if (handler) {
              document.removeEventListener('mousemove', handler);
            }
            instructions.remove();
          }

          // Reset cursor
          document.body.style.cursor = '';
        }

        // Dispatch event to notify about click until gone mode
        const event = new CustomEvent('browser-recorder-click-until-gone-toggle', {
          detail: { enabled: clickUntilGoneMode }
        });
        document.dispatchEvent(event);
      });

      // Set up Gemini button functionality
      geminiBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!currentHighlightedElement) {
          console.log('No element highlighted');
          return;
        }

        console.log('Call Gemini clicked for element:', currentHighlightedElement);

        // Collect element info first
        const rect = currentHighlightedElement.getBoundingClientRect();
        const elementInfo: any = {
          tagName: currentHighlightedElement.tagName,
          id: currentHighlightedElement.id,
          className: currentHighlightedElement.className,
          text: currentHighlightedElement.textContent?.trim() || '',
          innerHTML: currentHighlightedElement.innerHTML,
          outerHTML: currentHighlightedElement.outerHTML,
          attributes: {} as any,
          styles: {} as any,
          bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          imageDataUrl: null // Will be populated after capture
        };

        // Collect attributes
        for (let i = 0; i < currentHighlightedElement.attributes.length; i++) {
          const attr = currentHighlightedElement.attributes[i];
          elementInfo.attributes[attr.name] = attr.value;
        }

        // Collect computed styles
        const computedStyles = window.getComputedStyle(currentHighlightedElement);
        elementInfo.styles = {
          display: computedStyles.display,
          position: computedStyles.position,
          backgroundColor: computedStyles.backgroundColor,
          color: computedStyles.color,
          fontSize: computedStyles.fontSize,
          fontFamily: computedStyles.fontFamily,
          padding: computedStyles.padding,
          margin: computedStyles.margin,
          border: computedStyles.border,
          width: computedStyles.width,
          height: computedStyles.height
        };

        // Now capture the image FIRST before sending to code viewer
        try {
          // Get element bounds
          const rect = currentHighlightedElement.getBoundingClientRect();
          console.log('Element bounds:', rect);
          
          // Create a canvas to draw the element
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          
          // Set canvas size with some padding
          const padding = 20;
          canvas.width = rect.width + (padding * 2);
          canvas.height = rect.height + (padding * 2);
          
          // Fill background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw the element using DOM-to-image approach
          // This is a simplified version - in production you'd use html2canvas or similar
          const elementClone = currentHighlightedElement.cloneNode(true) as HTMLElement;
          
          // Create a temporary container
          const container = document.createElement('div');
          container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: ${rect.width}px;
            height: ${rect.height}px;
            overflow: hidden;
            pointer-events: none;
            z-index: 999999;
            background: white;
          `;
          
          // Clone and style the element
          elementClone.style.cssText = window.getComputedStyle(currentHighlightedElement).cssText;
          elementClone.style.position = 'static';
          elementClone.style.margin = '0';
          container.appendChild(elementClone);
          document.body.appendChild(container);
          
          // Use a more sophisticated approach with foreignObject
          const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
              <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif;">
                  ${container.innerHTML}
                </div>
              </foreignObject>
            </svg>
          `;
          
          const img = new Image();
          const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            ctx.drawImage(img, padding, padding);
            URL.revokeObjectURL(url);
            document.body.removeChild(container);

            // Convert to data URL
            const dataUrl = canvas.toDataURL('image/png');
            console.log('✅ Element captured as image');

            // Add image to element info
            elementInfo.imageDataUrl = dataUrl;

            // Now send to code viewer with image included
            if ((window as any).__playwrightRecorderOnGemini) {
              (window as any).__playwrightRecorderOnGemini(elementInfo);
            }

            // Show brief success notification instead of modal
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #4CAF50;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              font-family: Arial, sans-serif;
              font-size: 14px;
              z-index: 999999;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = '✓ Element captured and sent to code viewer';
            document.body.appendChild(notification);

            // Remove notification after 2 seconds
            setTimeout(() => {
              notification.style.animation = 'slideIn 0.3s ease-out reverse';
              setTimeout(() => notification.remove(), 300);
            }, 2000);
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            document.body.removeChild(container);

            console.warn('⚠️ Failed to capture element as image, sending without image');

            // Send element info without image
            if ((window as any).__playwrightRecorderOnGemini) {
              (window as any).__playwrightRecorderOnGemini(elementInfo);
            }

            // Show warning notification
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #FF9800;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              font-family: Arial, sans-serif;
              font-size: 14px;
              z-index: 999999;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = '⚠ Element info sent (image capture failed)';
            document.body.appendChild(notification);

            setTimeout(() => {
              notification.style.animation = 'slideIn 0.3s ease-out reverse';
              setTimeout(() => notification.remove(), 300);
            }, 2000);
          };
          
          img.src = url;
          
        } catch (error) {
          console.error('❌ Error capturing element:', error);

          // Send element info without image even on error
          if ((window as any).__playwrightRecorderOnGemini) {
            (window as any).__playwrightRecorderOnGemini(elementInfo);
          }

          // Show error notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
          `;
          notification.textContent = '✗ Element info sent (capture error)';
          document.body.appendChild(notification);

          setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
          }, 2000);
        }
      });
      
      // Show notification
      const notification = document.createElement('div');
      notification.id = 'playwright-recorder-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      `;
      notification.innerHTML = `
        <strong>🎯 Playwright Recorder</strong><br>
        • Press <kbd>Option</kbd> to highlight elements<br>
        • Press <kbd>Option</kbd> + <kbd>Shift</kbd> to enable Call Gemini
      `;
      
      const notificationStyle = document.createElement('style');
      notificationStyle.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        kbd {
          background-color: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2), 0 2px 0 0 rgba(255, 255, 255, 0.3) inset;
          color: white;
          display: inline-block;
          font-size: 12px;
          font-weight: bold;
          line-height: 1;
          padding: 2px 6px;
          white-space: nowrap;
        }
      `;
      
      try {
        if (document.head) {
          document.head.appendChild(notificationStyle);
        }
        if (document.body) {
          document.body.appendChild(notification);

          // Add proximity detection to fade when mouse approaches
          const proximityThreshold = 150; // pixels
          let mouseX = 0;
          let mouseY = 0;
          let notificationRemoved = false;

          const checkProximity = () => {
            if (notificationRemoved || !notification.parentElement) return;

            const rect = notification.getBoundingClientRect();
            const bannerCenterX = rect.left + rect.width / 2;
            const bannerCenterY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
              Math.pow(mouseX - bannerCenterX, 2) +
              Math.pow(mouseY - bannerCenterY, 2)
            );

            if (distance < proximityThreshold) {
              // Mouse is near, fade the notification
              notification.style.opacity = '0.1';
              notification.style.transform = 'scale(0.8) translateX(0)';
            } else {
              // Mouse is far, show the notification
              notification.style.opacity = '1';
              notification.style.transform = 'scale(1) translateX(0)';
            }
          };

          const mouseMoveHandler = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            checkProximity();
          };

          document.addEventListener('mousemove', mouseMoveHandler);

          // Cleanup function
          const cleanup = () => {
            notificationRemoved = true;
            document.removeEventListener('mousemove', mouseMoveHandler);
          };

          // Remove notification after 5 seconds
          setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
              notification.remove();
              cleanup();
            }, 300);
          }, 5000);
        }
      } catch (e) {
        console.warn('Failed to show recorder notification:', e);
      }
    });
  }

  private async setupInitScripts(): Promise<void> {
    if (!this.context) return;

    // Add init script to capture all events
    await this.context.addInitScript(() => {
      console.log('🚀 INIT SCRIPT RUNNING - Page:', window.location.href);
      console.log('🚀 Setting up event listeners for coordinate mode, click tracking, etc.');

      // Initialize global state if not exists
      if ((window as any).__playwrightRecorderCoordinateModeActive === undefined) {
        (window as any).__playwrightRecorderCoordinateModeActive = false;
        console.log('📍 Initialized __playwrightRecorderCoordinateModeActive = false');
      } else {
        console.log('📍 Found existing __playwrightRecorderCoordinateModeActive =', (window as any).__playwrightRecorderCoordinateModeActive);
      }

      // Monitor for controller removal and notify parent
      const checkControllerExists = () => {
        const controller = document.getElementById('browser-recorder-controller');
        if (!controller && (window as any).__playwrightRecorderControllerExists) {
          console.log('🚨 Controller disappeared, notifying parent...');
          (window as any).__playwrightRecorderControllerExists = false;
          if ((window as any).__playwrightRecorderOnControllerLost) {
            (window as any).__playwrightRecorderOnControllerLost();
          }
        } else if (controller && !(window as any).__playwrightRecorderControllerExists) {
          (window as any).__playwrightRecorderControllerExists = true;
        }
      };

      // Set up MutationObserver to watch for controller removal
      const observer = new MutationObserver(() => {
        checkControllerExists();
      });

      // Start observing when DOM is ready
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        checkControllerExists();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, { childList: true, subtree: true });
          checkControllerExists();
        });
      }
      // Continuously monitor and fix Array.prototype.toJSON
      // This prevents "serializedArgs is not an array" errors
      const fixArrayToJSON = () => {
        if (Array.prototype.toJSON) {
          // Store the custom implementation if not already stored
          if (!(window as any).__customArrayToJSON) {
            (window as any).__customArrayToJSON = Array.prototype.toJSON;
          }
          delete Array.prototype.toJSON;
        }
      };
      
      // Fix it immediately
      fixArrayToJSON();
      
      // Use Object.defineProperty to prevent re-definition
      Object.defineProperty(Array.prototype, 'toJSON', {
        get: function() {
          return undefined;
        },
        set: function(value) {
          // Store the attempted override but don't actually set it
          (window as any).__customArrayToJSON = value;
          console.warn('Blocked Array.prototype.toJSON override for Playwright compatibility');
        },
        configurable: false
      });
      
      // Also fix it periodically in case the site finds a way around our blocker
      setInterval(fixArrayToJSON, 100);
      
      // Store events
      (window as any).__recordedEvents = [];
      
      // Override addEventListener to capture all event listeners
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
        // Call original first
        originalAddEventListener.call(this, type, listener, options);
        
        // For click events, add our own capture phase listener
        if (type === 'click' && this === document) {
          console.log('🎯 Intercepted document click listener registration');
        }
      };
      
      // Function to add styles when DOM is ready
      const addHighlightStyles = () => {
        if (!document.head) {
          // If head doesn't exist yet, wait and try again
          setTimeout(addHighlightStyles, 10);
          return;
        }
        
        // Check if styles already exist
        if (document.getElementById('browser-recorder-styles')) {
          return;
        }
        
        const highlightStyle = document.createElement('style');
        highlightStyle.id = 'browser-recorder-styles';
        highlightStyle.textContent = `
          .browser-recorder-highlight {
            outline: 2px solid #ff0000 !important;
            outline-offset: 2px !important;
            background-color: rgba(255, 0, 0, 0.1) !important;
            cursor: pointer !important;
            position: relative !important;
          }
          
          .browser-recorder-tooltip {
            position: absolute !important;
            background: #333 !important;
            color: white !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
            border-radius: 4px !important;
            z-index: 999999 !important;
            pointer-events: none !important;
            white-space: nowrap !important;
            top: -30px !important;
            left: 0 !important;
            font-family: monospace !important;
          }
          
          .browser-recorder-coord-indicator {
            position: fixed !important;
            background: rgba(0, 0, 0, 0.8) !important;
            color: #4CAF50 !important;
            padding: 6px 12px !important;
            font-size: 13px !important;
            font-family: monospace !important;
            border-radius: 4px !important;
            z-index: 999998 !important;
            pointer-events: none !important;
            white-space: nowrap !important;
            border: 1px solid #4CAF50 !important;
            user-select: none !important;
          }
        `;
        
        try {
          document.head.appendChild(highlightStyle);
        } catch (e) {
          console.warn('Failed to add Playwright recorder styles:', e);
        }
      };
      
      // Start trying to add styles
      addHighlightStyles();
      
      let highlightedElement: HTMLElement | null = null;
      let tooltipElement: HTMLElement | null = null;
      let isHighlightKeyPressed = false;
      let isShiftKeyPressed = false;
      let isCoordinateMode = (window as any).__playwrightRecorderCoordinateModeActive || false;
      let coordIndicator: HTMLElement | null = null;
      let isClickUntilGoneMode = false;

      console.log('🎬 Init script variables initialized, isCoordinateMode:', isCoordinateMode);
      
      // Function to show selector tooltip
      const showTooltip = (element: HTMLElement, selector: string) => {
        try {
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
          
          // Make sure element still exists and is in the DOM
          if (!element || !element.parentNode) {
            return;
          }
          
          tooltipElement = document.createElement('div');
          tooltipElement.className = 'browser-recorder-tooltip';
          tooltipElement.textContent = selector;
          
          // Try to append to element, but if it fails, append to body
          try {
            element.appendChild(tooltipElement);
          } catch (e) {
            // If element doesn't support appendChild, position it absolutely
            tooltipElement.style.position = 'fixed';
            const rect = element.getBoundingClientRect();
            tooltipElement.style.left = rect.left + 'px';
            tooltipElement.style.top = (rect.top - 30) + 'px';
            document.body.appendChild(tooltipElement);
          }
        } catch (e) {
          console.warn('Failed to show tooltip:', e);
        }
      };
      
      // Function to highlight element on hover
      const highlightElement = (element: HTMLElement) => {
        // Remove previous highlight
        if (highlightedElement && highlightedElement !== element) {
          highlightedElement.classList.remove('browser-recorder-highlight');
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
        }
        
        // Add highlight to new element
        element.classList.add('browser-recorder-highlight');
        highlightedElement = element;
        
        // Generate and show selector
        let selector = '';
        if (element.id) {
          selector = `[id="${element.id}"]`;
        } else if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
          selector = `button:has-text("${element.textContent?.trim() || ''}")`;
        } else if (element.tagName === 'A') {
          selector = `a:has-text("${element.textContent?.trim() || ''}")`;
        } else if (element.className) {
          selector = `.${element.className.split(' ')[0]}`;
        } else {
          selector = element.tagName.toLowerCase();
        }
        
        showTooltip(element, selector);
        
        // Dispatch event to notify controller about highlighted element
        const event = new CustomEvent('browser-recorder-element-highlighted', {
          detail: { element: element, isShiftPressed: isShiftKeyPressed }
        });
        document.dispatchEvent(event);
      };
      
      // Mouse move handler for highlighting and coordinate tracking
      document.addEventListener('mousemove', (e) => {
        // Handle coordinate mode
        if (isCoordinateMode) {
          // Create or update coordinate indicator
          if (!coordIndicator) {
            coordIndicator = document.createElement('div');
            coordIndicator.className = 'browser-recorder-coord-indicator';
            coordIndicator.style.pointerEvents = 'none'; // Ensure it doesn't block clicks
            document.body.appendChild(coordIndicator);
          }
          
          // Update position and text
          coordIndicator.textContent = `X: ${e.pageX}, Y: ${e.pageY}`;
          coordIndicator.style.left = (e.clientX + 15) + 'px';
          coordIndicator.style.top = (e.clientY + 15) + 'px';
        } else if (coordIndicator) {
          // Remove coordinate indicator if not in coordinate mode
          coordIndicator.remove();
          coordIndicator = null;
        }
        
        // Handle highlight mode
        if (!isHighlightKeyPressed) return;
        
        const target = e.target as HTMLElement;
        // Don't highlight recorder UI elements
        if (target && target !== document.body && target !== document.documentElement && !target.closest('#browser-recorder-controller')) {
          highlightElement(target);
        }
      }, true);
      
      // Listen for coordinate mode toggle from controller
      console.log('🎧 Setting up coordinate toggle event listener');
      document.addEventListener('browser-recorder-coordinate-toggle', (e: any) => {
        console.log('📡 Received coordinate toggle event, detail:', e.detail);
        isCoordinateMode = e.detail.enabled;
        console.log('📍 Coordinate mode is now:', isCoordinateMode ? 'ON ✅' : 'OFF ❌');
        console.log('📍 Will add coordinates to next click:', isCoordinateMode);

        // Save to global state
        (window as any).__playwrightRecorderCoordinateModeActive = isCoordinateMode;

        // Clean up coordinate indicator when turning off coordinate mode
        if (!isCoordinateMode && coordIndicator) {
          coordIndicator.remove();
          coordIndicator = null;
        }
      });
      console.log('✅ Coordinate toggle event listener registered');

      // Test that events work
      setTimeout(() => {
        console.log('🧪 Testing event system...');
        const testEvent = new CustomEvent('test-event', { detail: { test: 'value' } });
        document.dispatchEvent(testEvent);
      }, 100);

      document.addEventListener('test-event', (e: any) => {
        console.log('✅ Test event received! Event system is working. Detail:', e.detail);
      });

      // Track recently processed iframe clicks to prevent duplicates
      const recentIframeClicks = new Set();

      // Listen for postMessage from iframes
      window.addEventListener('message', (event) => {
        // Handle iframe clicks
        if (event.data && event.data.type === 'browser-recorder-iframe-click') {
          console.log('🖼️ Received iframe click message:', event.data);

          const iframeData = event.data;

          // Use the selector generated in the iframe
          const selector = iframeData.targetSelector || iframeData.targetInfo.tagName.toLowerCase();

          const clickEvent = {
            selector: selector,
            text: iframeData.targetInfo.text,
            frameSelector: iframeData.iframeSelector,
            coordinates: (window as any).__playwrightRecorderCoordinateModeActive ? iframeData.coordinates : undefined
          };

          console.log('🖼️ Sending iframe click to recorder:', clickEvent);
          console.log('🖼️ Frame selector:', clickEvent.frameSelector);
          console.log('🖼️ Element selector:', clickEvent.selector);
          console.log('🖼️ Coordinates:', clickEvent.coordinates);

          // Mark this as an iframe click so the main click handler can ignore it
          const clickId = `${clickEvent.frameSelector}:${clickEvent.selector}:${Date.now()}`;
          recentIframeClicks.add(clickId);
          setTimeout(() => recentIframeClicks.delete(clickId), 1000);

          if ((window as any).__playwrightRecorderOnClick) {
            (window as any).__playwrightRecorderOnClick(clickEvent);
          }
        }

        // Handle iframe fill events
        if (event.data && event.data.type === 'browser-recorder-iframe-fill') {
          console.log('🖼️ ✅ Received iframe fill message:', event.data);

          const iframeData = event.data;

          const fillEvent = {
            selector: iframeData.targetSelector,
            value: iframeData.value,
            frameSelector: iframeData.iframeSelector
          };

          console.log('🖼️ Sending iframe fill to recorder:');
          console.log('  - Selector:', fillEvent.selector);
          console.log('  - Value:', fillEvent.value);
          console.log('  - Frame:', fillEvent.frameSelector);

          if ((window as any).__playwrightRecorderOnFill) {
            (window as any).__playwrightRecorderOnFill(fillEvent);
            console.log('✅ Iframe fill sent to recorder');
          } else {
            console.error('❌ __playwrightRecorderOnFill not available!');
          }
        }

        // Handle skip date component
        if (event.data && event.data.type === 'skip-date-component') {
          console.log('⏭️ Skip date component:', event.data.step);

          if ((window as any).__playwrightRecorderSkipDateComponent) {
            (window as any).__playwrightRecorderSkipDateComponent(event.data.step);
          }
        }
      });
      console.log('✅ PostMessage listener for iframes registered');

      // Listen for click until gone mode toggle from controller
      document.addEventListener('browser-recorder-click-until-gone-toggle', (e: any) => {
        isClickUntilGoneMode = e.detail.enabled;
        console.log('🔄 Click Until Gone mode:', isClickUntilGoneMode ? 'ON' : 'OFF');
      });
      
      // Listen for highlight toggle from controller
      document.addEventListener('browser-recorder-highlight-toggle', (e: any) => {
        isHighlightKeyPressed = e.detail.enabled;
        document.body.style.cursor = isHighlightKeyPressed ? 'crosshair' : '';
        
        // If disabling, remove any existing highlights
        if (!isHighlightKeyPressed) {
          if (highlightedElement) {
            highlightedElement.classList.remove('browser-recorder-highlight');
            highlightedElement = null;
          }
          
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
          
          // Notify controller that no element is highlighted
          const event = new CustomEvent('browser-recorder-element-highlighted', {
            detail: { element: null, isShiftPressed: isShiftKeyPressed }
          });
          document.dispatchEvent(event);
        }
      });
      
      // Listen for highlight key (Alt/Option) and Shift
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Alt' && !isHighlightKeyPressed) {
          isHighlightKeyPressed = true;
          document.body.style.cursor = 'crosshair';
          
          // Update the controller button state
          const highlightBtn = document.querySelector('#browser-recorder-controller button');
          if (highlightBtn) {
            highlightBtn.classList.add('active');
          }
          
          // Re-dispatch event if element is highlighted
          if (highlightedElement) {
            const event = new CustomEvent('browser-recorder-element-highlighted', {
              detail: { element: highlightedElement, isShiftPressed: isShiftKeyPressed }
            });
            document.dispatchEvent(event);
          }
        }
        
        if (e.key === 'Shift' && !isShiftKeyPressed) {
          isShiftKeyPressed = true;
          
          // Re-dispatch event if element is highlighted to update Gemini button
          if (highlightedElement && isHighlightKeyPressed) {
            const event = new CustomEvent('browser-recorder-element-highlighted', {
              detail: { element: highlightedElement, isShiftPressed: true }
            });
            document.dispatchEvent(event);
          }
        }
      }, true);
      
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Alt' && isHighlightKeyPressed) {
          isHighlightKeyPressed = false;
          document.body.style.cursor = '';
          
          // Update the controller button state
          const highlightBtn = document.querySelector('#browser-recorder-controller button');
          if (highlightBtn) {
            highlightBtn.classList.remove('active');
          }
          
          // Remove highlight
          if (highlightedElement) {
            highlightedElement.classList.remove('browser-recorder-highlight');
            highlightedElement = null;
          }
          
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
          
          // Notify controller that no element is highlighted
          const event = new CustomEvent('browser-recorder-element-highlighted', {
            detail: { element: null, isShiftPressed: isShiftKeyPressed }
          });
          document.dispatchEvent(event);
        }
        
        if (e.key === 'Shift' && isShiftKeyPressed) {
          isShiftKeyPressed = false;
          
          // Re-dispatch event if element is highlighted to update Gemini button
          if (highlightedElement && isHighlightKeyPressed) {
            const event = new CustomEvent('browser-recorder-element-highlighted', {
              detail: { element: highlightedElement, isShiftPressed: false }
            });
            document.dispatchEvent(event);
          }
        }
      }, true);
      
      // Listen for all keyboard events
      document.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement;

        // Detect Ctrl+P / Cmd+P (Print shortcut)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
          console.log('🖨️ Print shortcut detected (Ctrl+P / Cmd+P)');
          // Don't prevent default - let the print dialog open naturally
          // Just record the action
          if ((window as any).__playwrightRecorderOnPrint) {
            (window as any).__playwrightRecorderOnPrint();
          }
        }

        // Skip recording keyboard events on recorder UI elements and date offset modal
        if (target.closest('#browser-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.browser-recorder-modal') ||
            target.closest('.browser-recorder-modal-content') ||
            target.closest('#playwright-date-offset-modal') ||
            target.closest('#date-marking-instructions') ||
            target.id === 'date-marking-instructions' ||
            (target.parentElement && target.parentElement.closest('#date-marking-instructions')) ||
            target.id === 'wait-instructions' ||
            target.id === 'wait-condition' ||
            target.id === 'wait-timeout' ||
            target.id === 'wait-cancel' ||
            target.id === 'wait-confirm' ||
            target.closest('[id^="wait-"]') ||
            target.closest('.browser-recorder-') ||
            target.style.zIndex === '999999') {
          return;
        }

        const event = {
          type: 'keydown',
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          target: {
            tagName: target.tagName,
            id: target.id,
            className: target.className,
            name: target.getAttribute('name'),
            selector: null as string | null
          },
          timestamp: Date.now()
        };

        // Try to generate a selector for the target
        try {
          const target = e.target as HTMLElement;
          if (target.id) {
            event.target.selector = `[id="${target.id}"]`;
          } else if (target.getAttribute('name')) {
            event.target.selector = `[name="${target.getAttribute('name')}"]`;
          } else if (target.className) {
            event.target.selector = `.${target.className.split(' ')[0]}`;
          } else {
            event.target.selector = target.tagName.toLowerCase();
          }
        } catch (err) {
          // Ignore selector generation errors
        }

        (window as any).__recordedEvents.push({type: 'keypress', data: event});

        // Send to Playwright context
        if ((window as any).__playwrightRecorderOnKeyboard) {
          (window as any).__playwrightRecorderOnKeyboard(event);
        }
      }, true);

      // Intercept window.print() calls
      if (typeof window.print === 'function') {
        const originalPrint = window.print.bind(window);
        window.print = function() {
          console.log('🖨️ window.print() called');
          if ((window as any).__playwrightRecorderOnPrint) {
            (window as any).__playwrightRecorderOnPrint();
          }
          // Call the original print function
          return originalPrint();
        };
      }
      
      // Track input changes with debouncing to avoid recording every keystroke
      const inputTimers = new WeakMap<HTMLElement, any>();
      const lastInputValues = new WeakMap<HTMLElement, string>();

      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;

        // Skip if target is inside an iframe (iframe will handle it)
        try {
          if (target.ownerDocument !== document) {
            console.log('⏭️ Input is in iframe, skipping main handler');
            return;
          }
        } catch (e) {
          // Can't check, continue
        }

        // Skip recording input events on recorder UI elements and date offset modal
        if (target.closest('#browser-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.browser-recorder-modal') ||
            target.closest('.browser-recorder-modal-content') ||
            target.closest('#playwright-date-offset-modal') ||
            target.closest('#date-marking-instructions') ||
            target.id === 'date-marking-instructions' ||
            (target.parentElement && target.parentElement.closest('#date-marking-instructions')) ||
            target.id === 'wait-instructions' ||
            target.id === 'wait-condition' ||
            target.id === 'wait-timeout' ||
            target.id === 'wait-cancel' ||
            target.id === 'wait-confirm' ||
            target.closest('[id^="wait-"]') ||
            target.closest('.browser-recorder-') ||
            target.style.zIndex === '999999') {
          return;
        }

        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          // Clear existing timer for this input
          const existingTimer = inputTimers.get(target);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Debounce: wait 1 second after last keystroke before recording
          const timer = setTimeout(() => {
            const currentValue = target.value;
            const lastValue = lastInputValues.get(target);

            // Only record if value actually changed
            if (currentValue !== lastValue) {
              const event = {
                selector: target.id ? `[id="${target.id}"]` :
                         target.name ? `[name="${target.name}"]` :
                         target.className ? `.${target.className.split(' ')[0]}` :
                         target.tagName.toLowerCase(),
                value: currentValue
              };

              (window as any).__recordedEvents.push({type: 'fill', data: event});

              // Send fill event
              if ((window as any).__playwrightRecorderOnFill) {
                (window as any).__playwrightRecorderOnFill(event);
              }

              lastInputValues.set(target, currentValue);
            }
          }, 1000); // Wait 1 second after last keystroke

          inputTimers.set(target, timer);
        }
      }, true);

      // Also capture on blur (when user leaves the field) for immediate capture
      document.addEventListener('blur', (e) => {
        const target = e.target as HTMLInputElement;

        // Skip if target is inside an iframe (iframe will handle it)
        try {
          if (target.ownerDocument !== document) {
            console.log('⏭️ Blur is in iframe, skipping main handler');
            return;
          }
        } catch (e) {
          // Can't check, continue
        }

        // Skip recorder UI elements and date offset modal
        if (target.closest('#browser-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.browser-recorder-modal') ||
            target.closest('#playwright-date-offset-modal') ||
            target.closest('#date-marking-instructions') ||
            target.id === 'date-marking-instructions' ||
            (target.parentElement && target.parentElement.closest('#date-marking-instructions')) ||
            target.style.zIndex === '999999') {
          return;
        }

        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          // Clear any pending timer
          const existingTimer = inputTimers.get(target);
          if (existingTimer) {
            clearTimeout(existingTimer);
            inputTimers.delete(target);
          }

          const currentValue = target.value;
          const lastValue = lastInputValues.get(target);

          // Record final value on blur if it changed
          if (currentValue !== lastValue && currentValue !== '') {
            const event = {
              selector: target.id ? `[id="${target.id}"]` :
                       target.name ? `[name="${target.name}"]` :
                       target.className ? `.${target.className.split(' ')[0]}` :
                       target.tagName.toLowerCase(),
              value: currentValue
            };

            (window as any).__recordedEvents.push({type: 'fill', data: event});

            if ((window as any).__playwrightRecorderOnFill) {
              (window as any).__playwrightRecorderOnFill(event);
            }

            lastInputValues.set(target, currentValue);
          }
        }
      }, true);

      // Track any element clicks for date marking mode
      // Using mousedown in capture phase to intercept BEFORE regular click handlers
      const dateMarkingProcessedElements = new WeakSet<HTMLElement>();

      document.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;

        // Skip recorder UI elements, date offset modal, and date marking banner
        if (target.closest('#browser-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.browser-recorder-modal') ||
            target.closest('#playwright-date-offset-modal') ||
            target.closest('#date-marking-instructions') ||
            target.id === 'date-marking-instructions' ||
            (target.parentElement && target.parentElement.closest('#date-marking-instructions'))) {
          console.log('⏭️ Skipping mousedown on recorder UI or date marking banner');
          return;
        }

        // Only process if in date marking mode
        if (!(window as any).__playwrightRecorderDateMarkingMode) {
          return;
        }

        // Skip if date offset modal is being shown
        if ((window as any).__dateOffsetModalShowing) {
          console.log('📅 Date offset modal is showing, skipping click');
          return;
        }

        // In date marking mode, accept ANY clickable element
        // This includes: SELECT, BUTTON, INPUT, DIV, SPAN, A, etc.
        let dateElement: HTMLElement = target;
        let elementType: 'select' | 'button' | 'input' = 'button'; // Default to button for non-select elements

        // Determine element type
        if (target.tagName === 'SELECT') {
          elementType = 'select';
        } else if (target.tagName === 'OPTION' && target.parentElement?.tagName === 'SELECT') {
          dateElement = target.parentElement as HTMLSelectElement;
          elementType = 'select';
        } else if (target.tagName === 'INPUT') {
          // Detect input elements (text, number, date, etc.)
          elementType = 'input';
        } else {
          // Everything else is treated as 'button' (clickable element)
          elementType = 'button';
        }

        // Skip if already processed
        if (dateMarkingProcessedElements.has(dateElement)) {
          return;
        }

        console.log('📅 Element clicked in date marking mode:', dateElement.tagName, elementType);

        // Prevent the default action (dropdown opening or button click)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Mark as processed
        dateMarkingProcessedElements.add(dateElement);

        // Generate selector for this element
        let selector = '';

        // Priority: Unique ID > Name > Placeholder > Unique data attributes > Type > has-text with data attributes > Class > has-text only > Tag + index
        if (dateElement.id) {
          // Check if ID is actually unique before using it
          const elementsWithSameId = document.querySelectorAll(`[id="${dateElement.id}"]`);
          if (elementsWithSameId.length === 1) {
            // ID is unique, use it
            selector = `[id="${dateElement.id}"]`;
          } else {
            // ID is not unique! Check for unique combination with other attributes
            if (dateElement.getAttribute('data-focusable-seq')) {
              const seq = dateElement.getAttribute('data-focusable-seq')!;
              const tag = dateElement.tagName.toLowerCase();
              selector = `${tag}[id="${dateElement.id}"][data-focusable-seq="${seq}"]`;
            } else if (dateElement.getAttribute('data-own-layer-box-id')) {
              const layerId = dateElement.getAttribute('data-own-layer-box-id')!;
              const tag = dateElement.tagName.toLowerCase();
              selector = `${tag}[id="${dateElement.id}"][data-own-layer-box-id="${layerId}"]`;
            } else {
              // Use nth-of-type as fallback for non-unique IDs
              const elementsWithId = Array.from(document.querySelectorAll(`[id="${dateElement.id}"]`));
              const index = elementsWithId.indexOf(dateElement);
              selector = `${dateElement.tagName.toLowerCase()}[id="${dateElement.id}"]:nth-of-type(${index + 1})`;
            }
          }
        } else if (dateElement.getAttribute('name')) {
          const name = dateElement.getAttribute('name')!;
          const tag = dateElement.tagName.toLowerCase();
          selector = `${tag}[name="${name}"]`;
        } else if (dateElement.getAttribute('placeholder')) {
          // For inputs with placeholder
          const placeholder = dateElement.getAttribute('placeholder')!;
          selector = `input[placeholder="${placeholder}"]`;
        } else if (dateElement.getAttribute('data-own-layer-box-id')) {
          // Check for data-own-layer-box-id attribute - but this is NOT stable across page loads!
          // Skip this and use other attributes instead
          const layerId = dateElement.getAttribute('data-own-layer-box-id')!;
          const tag = dateElement.tagName.toLowerCase();
          // Don't use this - fall through to next options
          selector = ''; // Will be set below
        }

        // Check for data-id, data-cid with uniqueness validation
        if (!selector && dateElement.getAttribute('data-id')) {
          const dataId = dateElement.getAttribute('data-id')!;
          const tag = dateElement.tagName.toLowerCase();
          const candidateSelector = `${tag}[data-id="${dataId}"]`;

          // Check if this selector is unique
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = dateElement.parentElement;
            if (parent) {
              // Find parent's position among its siblings
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              // Build parent selector
              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > ${tag}[data-id="${dataId}"]`;
            } else {
              // Fallback to nth-of-type
              const allWithDataId = Array.from(matches);
              const index = allWithDataId.indexOf(dateElement);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        } else if (!selector && dateElement.getAttribute('data-cid')) {
          const dataCid = dateElement.getAttribute('data-cid')!;
          const tag = dateElement.tagName.toLowerCase();
          const candidateSelector = `${tag}[data-cid="${dataCid}"]`;

          // Check if this selector is unique
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = dateElement.parentElement;
            if (parent) {
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > ${tag}[data-cid="${dataCid}"]`;
            } else {
              const allWithDataCid = Array.from(matches);
              const index = allWithDataCid.indexOf(dateElement);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        } else if (!selector && dateElement.getAttribute('data-testid')) {
          // Check for data-testid attribute
          const dataTestid = dateElement.getAttribute('data-testid')!;
          selector = `[data-testid="${dataTestid}"]`;
        } else if (!selector && dateElement.getAttribute('data-name')) {
          // Check for data-name attribute
          const dataName = dateElement.getAttribute('data-name')!;
          const tag = dateElement.tagName.toLowerCase();
          selector = `${tag}[data-name="${dataName}"]`;
        }

        // For input elements specifically, check type attribute
        if (!selector && elementType === 'input' && dateElement.getAttribute('type')) {
          const type = dateElement.getAttribute('type')!;
          const candidateSelector = `input[type="${type}"]`;

          // Check if unique
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = dateElement.parentElement;
            if (parent) {
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > input[type="${type}"]`;
            } else {
              const allWithType = Array.from(matches);
              const index = allWithType.indexOf(dateElement);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        }

        if (!selector && elementType === 'button' && dateElement.textContent?.trim()) {
          // For buttons/clickable elements with text, combine with data attributes if available for specificity
          const text = dateElement.textContent.trim();
          const tag = dateElement.tagName.toLowerCase();

          // Try to find a unique data attribute to combine with text
          const dataAttrs = ['data-id', 'data-cid', 'data-name', 'data-role', 'data-type'];
          let dataAttr = null;
          for (const attr of dataAttrs) {
            if (dateElement.getAttribute(attr)) {
              dataAttr = { name: attr, value: dateElement.getAttribute(attr)! };
              break;
            }
          }

          if (dataAttr) {
            // Combine data attribute with has-text for more specificity
            selector = `${tag}[${dataAttr.name}="${dataAttr.value}"]:has-text("${text}")`;
          } else {
            // Fall back to just has-text
            selector = `${tag}:has-text("${text}")`;
          }
        }

        // Final fallbacks - only use if selector still not set
        if (!selector && dateElement.className && dateElement.className.trim()) {
          const firstClass = dateElement.className.trim().split(/\s+/)[0];
          selector = `${dateElement.tagName.toLowerCase()}.${firstClass}`;
        }

        if (!selector) {
          // Use nth-of-type as last resort fallback
          const elements = Array.from(document.querySelectorAll(dateElement.tagName.toLowerCase()));
          const index = elements.indexOf(dateElement);
          selector = `${dateElement.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
        }

        const step = (window as any).__playwrightRecorderDateMarkingStep;

        console.log('📅 Date element marked:', { selector, elementType, step });

        // Visual feedback - highlight the selected element with green outline
        dateElement.style.outline = '3px solid #4CAF50';
        dateElement.style.outlineOffset = '2px';
        dateElement.style.transition = 'outline 0.2s ease';

        // Add checkmark indicator
        const checkmark = document.createElement('span');
        checkmark.style.cssText = `
          position: fixed;
          background: #4CAF50;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 999998;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        checkmark.textContent = '✓';
        checkmark.className = 'date-marker-checkmark';

        // Position relative to element
        const rect = dateElement.getBoundingClientRect();
        checkmark.style.left = (rect.right - 10) + 'px';
        checkmark.style.top = (rect.top - 10) + 'px';

        document.body.appendChild(checkmark);

        // Mark this element as processed to prevent its click from being recorded
        if ((window as any).__dateMarkedElements) {
          (window as any).__dateMarkedElements.add(dateElement);
          // Clear after 500ms to allow subsequent intentional clicks
          setTimeout(() => {
            if ((window as any).__dateMarkedElements) {
              (window as any).__dateMarkedElements.delete(dateElement);
            }
          }, 500);
        }

        // For button elements, detect the dropdown menu that appears
        let dropdownSelector = '';
        if (elementType === 'button') {
          // Wait for dropdown to appear after click
          setTimeout(() => {
            // Look for dropdown menu patterns
            const dropdownPatterns = [
              '[data-layer-box="true"]:not([style*="display: none"]):not([style*="visibility: hidden"])',
              '.dropdown-menu.show',
              '.dropdown-menu:not(.hide)',
              'ul.dropdown-menu[style*="visibility: visible"]',
              'div[class*="dropdown"][style*="visibility: visible"]'
            ];

            for (const pattern of dropdownPatterns) {
              const dropdowns = document.querySelectorAll(pattern);
              if (dropdowns.length > 0) {
                // Found dropdown - use the pattern as selector
                dropdownSelector = pattern;
                console.log('📋 Detected dropdown menu:', dropdownSelector);
                break;
              }
            }

            // Send to recorder with dropdown selector
            if ((window as any).__playwrightRecorderOnDateDropdownMarked) {
              (window as any).__playwrightRecorderOnDateDropdownMarked(selector, elementType, step, dropdownSelector);
            }
          }, 300); // Wait 300ms for dropdown to appear
        } else {
          // For non-button elements (select, input), no dropdown detection needed
          if ((window as any).__playwrightRecorderOnDateDropdownMarked) {
            (window as any).__playwrightRecorderOnDateDropdownMarked(selector, elementType, step, '');
          }
        }

        // IMPORTANT: If this was the day element (step 3/3), show date offset modal
        if (step === 'day') {
          // Check if modal already exists to prevent duplicates
          if (document.getElementById('playwright-date-offset-modal') || (window as any).__dateOffsetModalShowing) {
            console.log('📅 Date offset modal already showing, skipping...');
            return;
          }

          // Set flag immediately to prevent duplicate processing
          (window as any).__dateOffsetModalShowing = true;

          // Show modal to choose date offset
          const modal = document.createElement('div');
          modal.id = 'playwright-date-offset-modal'; // Add ID for skipping in mousedown listener
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          `;

          const modalContent = document.createElement('div');
          modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            min-width: 400px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          `;

          modalContent.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">📅 Select Date Timeframe</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">Choose which date to use when replaying this test:</p>

            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="0" checked style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div>
                  <div style="font-weight: 500; color: #333;">Today</div>
                  <div style="font-size: 12px; color: #666;">Use today's date when running</div>
                </div>
              </label>

              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="1" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div>
                  <div style="font-weight: 500; color: #333;">Tomorrow</div>
                  <div style="font-size: 12px; color: #666;">Today + 1 day</div>
                </div>
              </label>

              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="-1" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div>
                  <div style="font-weight: 500; color: #333;">Yesterday</div>
                  <div style="font-size: 12px; color: #666;">Today - 1 day</div>
                </div>
              </label>

              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="-7" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div>
                  <div style="font-weight: 500; color: #333;">Last Week</div>
                  <div style="font-size: 12px; color: #666;">Today - 7 days</div>
                </div>
              </label>

              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="-30" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div>
                  <div style="font-weight: 500; color: #333;">Last Month</div>
                  <div style="font-size: 12px; color: #666;">Today - 30 days</div>
                </div>
              </label>

              <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                <input type="radio" name="date-offset" value="custom" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; color: #333; margin-bottom: 8px;">Custom Offset</div>
                  <input type="number" id="custom-offset" placeholder="Days from today (e.g., -14 for 14 days ago)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;" disabled>
                </div>
              </label>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="date-cancel" style="padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
              <button id="date-confirm" style="padding: 10px 20px; background: #9C27B0; color: white; border: 1px solid #9C27B0; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">Confirm</button>
            </div>
          `;

          modal.appendChild(modalContent);
          document.body.appendChild(modal);

          // Add hover effects to radio labels
          const labels = modalContent.querySelectorAll('label');
          labels.forEach(label => {
            label.addEventListener('mouseenter', () => {
              (label as HTMLElement).style.borderColor = '#9C27B0';
              (label as HTMLElement).style.background = '#f3e5f5';
            });
            label.addEventListener('mouseleave', () => {
              const radio = label.querySelector('input[type="radio"]') as HTMLInputElement;
              if (!radio.checked) {
                (label as HTMLElement).style.borderColor = '#e0e0e0';
                (label as HTMLElement).style.background = 'white';
              }
            });
          });

          // Handle radio selection highlighting
          const radios = modalContent.querySelectorAll('input[type="radio"]');
          const customInput = modalContent.querySelector('#custom-offset') as HTMLInputElement;

          radios.forEach(radio => {
            radio.addEventListener('change', () => {
              // Reset all labels
              labels.forEach(l => {
                (l as HTMLElement).style.borderColor = '#e0e0e0';
                (l as HTMLElement).style.background = 'white';
              });

              // Highlight selected
              const selectedLabel = radio.closest('label') as HTMLElement;
              selectedLabel.style.borderColor = '#9C27B0';
              selectedLabel.style.background = '#f3e5f5';

              // Enable/disable custom input
              if ((radio as HTMLInputElement).value === 'custom') {
                customInput.disabled = false;
                customInput.focus();
              } else {
                customInput.disabled = true;
              }
            });
          });

          // Handle modal actions
          const cancelBtn = modalContent.querySelector('#date-cancel') as HTMLElement;
          const confirmBtn = modalContent.querySelector('#date-confirm') as HTMLElement;

          cancelBtn.addEventListener('click', () => {
            modal.remove();
            // Clear modal showing flag
            (window as any).__dateOffsetModalShowing = false;
            // Exit date marking mode and reset
            if ((window as any).__exitDateMarkingMode) {
              (window as any).__exitDateMarkingMode();
            }
          });

          confirmBtn.addEventListener('click', () => {
            const selectedRadio = modalContent.querySelector('input[name="date-offset"]:checked') as HTMLInputElement;
            let offset = 0;

            if (selectedRadio.value === 'custom') {
              const customValue = customInput.value;
              if (customValue && !isNaN(parseInt(customValue))) {
                offset = parseInt(customValue);
              } else {
                alert('Please enter a valid number for custom offset');
                return;
              }
            } else {
              offset = parseInt(selectedRadio.value);
            }

            // Send the offset to the recorder
            if ((window as any).__playwrightRecorderOnDateOffsetSelected) {
              (window as any).__playwrightRecorderOnDateOffsetSelected(offset);
            }

            modal.remove();
            // Clear modal showing flag
            (window as any).__dateOffsetModalShowing = false;

            // Exit date marking mode
            if ((window as any).__exitDateMarkingMode) {
              (window as any).__exitDateMarkingMode();
            }
          });
        }
      }, true); // Capture phase - runs before regular handlers

      // Track processed clicks to avoid duplicates
      const processedClicks = new WeakMap<Event, boolean>();
      let lastClickTime = 0;
      let lastClickTarget: EventTarget | null = null;

      // Track date marked elements to skip their subsequent clicks
      const dateMarkedElements = new WeakSet<HTMLElement>();
      (window as any).__dateMarkedElements = dateMarkedElements;

      // Helper function to check if element is within date marking banner (comprehensive check)
      const isWithinDateMarkingBanner = (element: HTMLElement | null): boolean => {
        if (!element) return false;

        // Check if element itself is the banner
        if (element.id === 'date-marking-instructions') return true;

        // Check if element is inside the banner
        if (element.closest('#date-marking-instructions')) return true;

        // Check parent element as extra safety
        if (element.parentElement && element.parentElement.id === 'date-marking-instructions') return true;
        if (element.parentElement && element.parentElement.closest('#date-marking-instructions')) return true;

        return false;
      };

      // Function to handle clicks - separated so we can call it from multiple places
      const handleClick = (e: MouseEvent) => {
        // Check if we've already processed this event
        if (processedClicks.has(e)) {
          console.log('⏭️ Click already processed, skipping');
          return;
        }

        const target = e.target as HTMLElement;

        // Early check: Skip if clicking on or within date marking banner (catches all elements including text)
        if (isWithinDateMarkingBanner(target)) {
          console.log('⏭️ Skipping click on date marking banner or its children');
          return;
        }
        const now = Date.now();

        // Skip ALL clicks when in date marking mode (handled by mousedown listener)
        // This prevents regular click recording from interfering with date marking
        if ((window as any).__playwrightRecorderDateMarkingMode) {
          console.log('📅 Skipping click in date marking mode (handled by mousedown)');
          return;
        }

        // Skip clicks on elements that were just marked in date marking mode
        if ((window as any).__dateMarkedElements && (window as any).__dateMarkedElements.has(target)) {
          console.log('📅 Skipping click on date marked element');
          return;
        }

        // Deduplicate clicks on same target within 50ms
        if (lastClickTarget === target && (now - lastClickTime) < 50) {
          console.log('⏭️ Duplicate click detected, skipping');
          return;
        }

        console.log('🖱️ Click detected on:', target.tagName, target.id || target.className);
        console.log('🖱️ Document:', target.ownerDocument === document ? 'main page' : 'different document');
        console.log('🖱️ Coordinate mode:', isCoordinateMode);

        // Mark this event as processed
        processedClicks.set(e, true);
        lastClickTime = now;
        lastClickTarget = target;

        // CRITICAL: Check if this click is in an iframe
        // Clicks in iframes have different ownerDocument
        if (target.ownerDocument && target.ownerDocument !== document) {
          console.log('🖼️ Click target is in a different document (iframe), skipping main handler');
          return;
        }

        // Also check if target or any parent is an iframe element
        let currentElement = target;
        while (currentElement) {
          if (currentElement.tagName === 'IFRAME') {
            console.log('🖼️ Click is on iframe element itself, skipping');
            return;
          }
          currentElement = currentElement.parentElement as HTMLElement;
        }

        // Skip recording clicks on the recorder controller UI, date offset modal, and date marking banner
        // Check if target is within any recorder UI element (including all child elements like text, buttons, etc.)
        if (target.closest('#browser-recorder-controller') ||
            target.closest('#playwright-date-offset-modal') ||
            target.closest('#date-marking-instructions') ||
            target.id === 'date-marking-instructions' ||
            (target.parentElement && target.parentElement.closest('#date-marking-instructions'))) {
          console.log('⏭️ Skipping recorder UI click');
          return;
        }

        // Check if Option + Shift are pressed - trigger Gemini analysis instead of recording
        if (e.altKey && e.shiftKey) {
          console.log('🌟 Option + Shift + Click detected, triggering Gemini analysis');
          e.preventDefault();
          e.stopPropagation();

          // Trigger the Gemini button click programmatically
          const geminiButton = document.querySelector('#browser-recorder-controller button:last-child') as HTMLElement;
          if (geminiButton) {
            // Set the current highlighted element to the clicked target
            currentHighlightedElement = target;

            // Trigger Gemini analysis by clicking the button
            geminiButton.click();
          }

          return; // Don't record this click
        }

        // Skip coordinate indicator if somehow clicked
        if (target.classList.contains('browser-recorder-coord-indicator')) {
          console.log('⏭️ Skipping coord indicator click');
          return;
        }

        // Check if we're in wait mode
        const waitBtn = document.querySelector('#browser-recorder-controller [data-wait-mode="true"]') as HTMLElement;
        const isWaitMode = waitBtn && waitBtn.classList.contains('active');
        
        if (isWaitMode) {
          // Skip wait recording on ANY recorder UI elements and date offset modal
          if (target.closest('#browser-recorder-controller') ||
              target.closest('#playwright-wait-modal') ||
              target.closest('.browser-recorder-modal') ||
              target.closest('.browser-recorder-modal-content') ||
              target.closest('#playwright-date-offset-modal') ||
              target.closest('#date-marking-instructions') ||
              target.id === 'date-marking-instructions' ||
              (target.parentElement && target.parentElement.closest('#date-marking-instructions')) ||
              target.id === 'wait-instructions' ||
              target.id === 'wait-condition' ||
              target.id === 'wait-timeout' ||
              target.id === 'wait-cancel' ||
              target.id === 'wait-confirm' ||
              target.closest('[id^="wait-"]') ||
              target.closest('.browser-recorder-') ||
              target.style.zIndex === '999999') {
            return;
          }
          
          // Check if modal already exists
          if (document.getElementById('playwright-wait-modal')) {
            console.log('⏭️ Wait modal already exists, skipping');
            return;
          }
          
          // Handle wait for element action
          e.preventDefault();
          e.stopPropagation();
          
          // Show wait condition selection modal
          const modal = document.createElement('div');
          modal.id = 'playwright-wait-modal';
          modal.className = 'browser-recorder-modal';
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          `;
          
          const modalContent = document.createElement('div');
          modalContent.className = 'browser-recorder-modal-content';
          modalContent.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          `;
          
          modalContent.innerHTML = `
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">Wait for Element</h3>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
              Selected element: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">${target.tagName}${target.id ? '#' + target.id : ''}</code>
            </p>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Wait Condition:</label>
              <select id="wait-condition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                <option value="visible">Element becomes visible</option>
                <option value="hidden">Element becomes hidden</option>
                <option value="enabled">Element becomes enabled</option>
                <option value="disabled">Element becomes disabled</option>
              </select>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Timeout (ms):</label>
              <input type="number" id="wait-timeout" value="5000" min="1000" max="30000" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="wait-cancel" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
              <button id="wait-confirm" style="padding: 8px 16px; background: #2196F3; color: white; border: 1px solid #2196F3; border-radius: 6px; cursor: pointer; font-size: 14px;">Add Wait</button>
            </div>
          `;
          
          modal.appendChild(modalContent);
          document.body.appendChild(modal);
          
          // Handle modal actions
          const cancelBtn = modalContent.querySelector('#wait-cancel') as HTMLElement;
          const confirmBtn = modalContent.querySelector('#wait-confirm') as HTMLElement;
          const conditionSelect = modalContent.querySelector('#wait-condition') as HTMLSelectElement;
          const timeoutInput = modalContent.querySelector('#wait-timeout') as HTMLInputElement;
          
          cancelBtn.addEventListener('click', () => {
            modal.remove();
          });
          
          confirmBtn.addEventListener('click', () => {
            // Generate selector for the target element (same logic as regular clicks)
            let selector = '';
            if (target.id) {
              selector = '[id="' + target.id + '"]';
            } else if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') {
              const text = target.textContent?.trim() || '';
              selector = 'button:has-text("' + text + '")';
            } else if (target.tagName === 'A') {
              const text = target.textContent?.trim() || '';
              selector = 'a:has-text("' + text + '")';
            } else if (target.tagName === 'INPUT') {
              const type = target.getAttribute('type') || 'text';
              const name = target.getAttribute('name');
              const placeholder = target.getAttribute('placeholder');
              
              if (name) {
                selector = 'input[name="' + name + '"]';
              } else if (placeholder) {
                selector = 'input[placeholder="' + placeholder + '"]';
              } else {
                selector = 'input[type="' + type + '"]';
              }
            } else if (target.hasAttribute('data-testid')) {
              selector = '[data-testid="' + target.getAttribute('data-testid') + '"]';
            } else {
              const parent = target.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children);
                const index = siblings.indexOf(target) + 1;
                const parentSelector = parent.id ? '[id="' + parent.id + '"]' : parent.className ? '.' + parent.className.split(' ')[0] : parent.tagName.toLowerCase();
                selector = parentSelector + ' > ' + target.tagName.toLowerCase() + ':nth-child(' + index + ')';
              } else {
                selector = target.className ? '.' + target.className.split(' ')[0] : target.tagName.toLowerCase();
              }
            }
            
            const waitAction = {
              selector: selector,
              condition: conditionSelect.value,
              timeout: parseInt(timeoutInput.value)
            };
            
            // Send wait action to recorder
            if ((window as any).__playwrightRecorderOnWaitForElement) {
              (window as any).__playwrightRecorderOnWaitForElement(waitAction);
            }
            
            modal.remove();
            
            // Exit wait mode
            waitBtn.click();
          });
          
          // Close modal on backdrop click
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              modal.remove();
            }
          });
          
          return; // Don't process as regular click
        }
        
        // Generate a more specific selector
        let selector = '';

        // Priority 1: Check if ID is unique before using it
        if (target.id) {
          const elementsWithSameId = document.querySelectorAll(`[id="${target.id}"]`);
          if (elementsWithSameId.length === 1) {
            // ID is unique, use it
            selector = `[id="${target.id}"]`;
          } else {
            // ID is not unique! Combine with other attributes
            if (target.getAttribute('data-focusable-seq')) {
              const seq = target.getAttribute('data-focusable-seq')!;
              const tag = target.tagName.toLowerCase();
              selector = `${tag}[id="${target.id}"][data-focusable-seq="${seq}"]`;
            } else if (target.getAttribute('data-own-layer-box-id')) {
              const layerId = target.getAttribute('data-own-layer-box-id')!;
              const tag = target.tagName.toLowerCase();
              selector = `${tag}[id="${target.id}"][data-own-layer-box-id="${layerId}"]`;
            } else if (target.getAttribute('data-testid')) {
              const testid = target.getAttribute('data-testid')!;
              const tag = target.tagName.toLowerCase();
              selector = `${tag}[id="${target.id}"][data-testid="${testid}"]`;
            } else {
              // Use nth-of-type as fallback for non-unique IDs
              const elementsWithId = Array.from(document.querySelectorAll(`[id="${target.id}"]`));
              const index = elementsWithId.indexOf(target);
              selector = `${target.tagName.toLowerCase()}[id="${target.id}"]:nth-of-type(${index + 1})`;
            }
          }
        }
        // Priority 2: Check for data-testid (usually unique)
        else if (target.getAttribute('data-testid')) {
          const testid = target.getAttribute('data-testid')!;
          const candidateSelector = `[data-testid="${testid}"]`;

          // Validate uniqueness
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = target.parentElement;
            if (parent) {
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > [data-testid="${testid}"]`;
            } else {
              const allWithTestid = Array.from(matches);
              const index = allWithTestid.indexOf(target);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        }
        // Priority 3: For buttons, use text-based selector with data attributes for specificity
        else if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') {
          const text = target.textContent?.trim() || '';
          const tag = target.tagName.toLowerCase();

          // Check for data-index + data-cid/data-id combination with text for maximum specificity
          if (target.getAttribute('data-index') && target.getAttribute('data-cid')) {
            const dataIndex = target.getAttribute('data-index')!;
            const dataCid = target.getAttribute('data-cid')!;
            // Add text for additional specificity since data-index may not be unique across sections
            selector = `${tag}[data-cid="${dataCid}"][data-index="${dataIndex}"]:has-text("${text}")`;
          } else if (target.getAttribute('data-id') && target.getAttribute('data-index')) {
            const dataId = target.getAttribute('data-id')!;
            const dataIndex = target.getAttribute('data-index')!;
            selector = `${tag}[data-id="${dataId}"][data-index="${dataIndex}"]:has-text("${text}")`;
          } else if (target.getAttribute('data-id')) {
            const dataId = target.getAttribute('data-id')!;
            const candidateSelector = `${tag}[data-id="${dataId}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = `${candidateSelector}:has-text("${text}")`;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > ${tag}[data-id="${dataId}"]:has-text("${text}")`;
              } else {
                selector = `${candidateSelector}:has-text("${text}")`;
              }
            }
          } else if (target.getAttribute('data-cid')) {
            const dataCid = target.getAttribute('data-cid')!;
            const candidateSelector = `${tag}[data-cid="${dataCid}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = `${candidateSelector}:has-text("${text}")`;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > ${tag}[data-cid="${dataCid}"]:has-text("${text}")`;
              } else {
                selector = `${candidateSelector}:has-text("${text}")`;
              }
            }
          } else if (target.getAttribute('data-name')) {
            const dataName = target.getAttribute('data-name')!;
            selector = `${tag}[data-name="${dataName}"]:has-text("${text}")`;
          } else {
            // Use Playwright's has-text selector
            const potentialSelector = `button:has-text("${text}")`;

            // Try to find matching buttons manually
            let matchingElements: HTMLElement[] = [];
            try {
              const allButtons = Array.from(document.querySelectorAll('button'));
              matchingElements = allButtons.filter(btn => btn.textContent?.trim().includes(text));
            } catch (e) {
              // Fallback to simple selector
            }

            if (matchingElements.length <= 1) {
              // Unique or no match, use the simple selector
              selector = potentialSelector;
            } else {
              // Multiple matches, use nth= syntax for Playwright
              let index = -1;
              for (let i = 0; i < matchingElements.length; i++) {
                if (matchingElements[i] === target) {
                  index = i;
                  break;
                }
              }

              if (index >= 0) {
                selector = `button:has-text("${text}") >> nth=${index}`;
              } else {
                selector = potentialSelector;
              }
            }
          }
        }
        // Priority 4: For links, use text-based selector with data attributes for specificity
        else if (target.tagName === 'A') {
          const text = target.textContent?.trim() || '';
          const tag = target.tagName.toLowerCase();

          console.log('🔗 Link clicked - Text:', text, 'Length:', text.length);

          // Check for data-index + data-cid/data-id combination with text for maximum specificity
          if (target.getAttribute('data-index') && target.getAttribute('data-cid')) {
            const dataIndex = target.getAttribute('data-index')!;
            const dataCid = target.getAttribute('data-cid')!;
            // Add text for additional specificity since data-index may not be unique across sections
            selector = `${tag}[data-cid="${dataCid}"][data-index="${dataIndex}"]:has-text("${text}")`;
            console.log('🔗 Generated link selector:', selector);
          } else if (target.getAttribute('data-id') && target.getAttribute('data-index')) {
            const dataId = target.getAttribute('data-id')!;
            const dataIndex = target.getAttribute('data-index')!;
            selector = `${tag}[data-id="${dataId}"][data-index="${dataIndex}"]:has-text("${text}")`;
          } else if (target.getAttribute('data-id')) {
            const dataId = target.getAttribute('data-id')!;
            const candidateSelector = `${tag}[data-id="${dataId}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = `${candidateSelector}:has-text("${text}")`;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > ${tag}[data-id="${dataId}"]:has-text("${text}")`;
              } else {
                selector = `${candidateSelector}:has-text("${text}")`;
              }
            }
          } else if (target.getAttribute('data-cid')) {
            const dataCid = target.getAttribute('data-cid')!;
            const candidateSelector = `${tag}[data-cid="${dataCid}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = `${candidateSelector}:has-text("${text}")`;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > ${tag}[data-cid="${dataCid}"]:has-text("${text}")`;
              } else {
                selector = `${candidateSelector}:has-text("${text}")`;
              }
            }
          } else if (target.getAttribute('data-name')) {
            const dataName = target.getAttribute('data-name')!;
            selector = `${tag}[data-name="${dataName}"]:has-text("${text}")`;
          } else {
            // Use Playwright's has-text selector
            const potentialSelector = `a:has-text("${text}")`;

            // Try to find matching links manually
            let matchingElements: HTMLElement[] = [];
            try {
              const allLinks = Array.from(document.querySelectorAll('a'));
              matchingElements = allLinks.filter(link => link.textContent?.trim().includes(text));
            } catch (e) {
              // Fallback to simple selector
            }

            if (matchingElements.length <= 1) {
              // Unique or no match, use the simple selector
              selector = potentialSelector;
            } else {
              // Multiple matches, use nth= syntax for Playwright
              let index = -1;
              for (let i = 0; i < matchingElements.length; i++) {
                if (matchingElements[i] === target) {
                  index = i;
                  break;
                }
              }

              if (index >= 0) {
                selector = `a:has-text("${text}") >> nth=${index}`;
              } else {
                selector = potentialSelector;
              }
            }
          }
        }
        // Priority 5: For inputs, use name, placeholder, or type with data attributes
        else if (target.tagName === 'INPUT') {
          const type = target.getAttribute('type') || 'text';
          const name = target.getAttribute('name');
          const placeholder = target.getAttribute('placeholder');

          if (name) {
            const candidateSelector = `input[name="${name}"]`;
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = candidateSelector;
            } else {
              // Use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > input[name="${name}"]`;
              } else {
                selector = candidateSelector;
              }
            }
          } else if (placeholder) {
            selector = `input[placeholder="${placeholder}"]`;
          } else if (target.getAttribute('data-id')) {
            const dataId = target.getAttribute('data-id')!;
            const candidateSelector = `input[data-id="${dataId}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = candidateSelector;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > input[data-id="${dataId}"]`;
              } else {
                const allWithDataId = Array.from(matches);
                const index = allWithDataId.indexOf(target);
                selector = `${candidateSelector}:nth-of-type(${index + 1})`;
              }
            }
          } else if (target.getAttribute('data-cid')) {
            const dataCid = target.getAttribute('data-cid')!;
            const candidateSelector = `input[data-cid="${dataCid}"]`;

            // Check if unique
            const matches = document.querySelectorAll(candidateSelector);
            if (matches.length === 1) {
              selector = candidateSelector;
            } else {
              // Not unique - use parent-child pattern
              const parent = target.parentElement;
              if (parent) {
                const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
                const parentIndex = parentSiblings.indexOf(parent) + 1;

                let parentSelector = '';
                if (parent.className) {
                  const parentClass = parent.className.trim().split(/\s+/)[0];
                  parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
                } else {
                  parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
                }

                selector = `${parentSelector} > input[data-cid="${dataCid}"]`;
              } else {
                const allWithDataCid = Array.from(matches);
                const index = allWithDataCid.indexOf(target);
                selector = `${candidateSelector}:nth-of-type(${index + 1})`;
              }
            }
          } else {
            selector = `input[type="${type}"]`;
          }
        }
        // Priority 6: Other data attributes (with uniqueness check)
        else if (target.getAttribute('data-id')) {
          const dataId = target.getAttribute('data-id')!;
          const tag = target.tagName.toLowerCase();
          const candidateSelector = `${tag}[data-id="${dataId}"]`;

          // Check if unique
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = target.parentElement;
            if (parent) {
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > ${tag}[data-id="${dataId}"]`;
            } else {
              const allWithDataId = Array.from(matches);
              const index = allWithDataId.indexOf(target);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        }
        else if (target.getAttribute('data-cid')) {
          const dataCid = target.getAttribute('data-cid')!;
          const tag = target.tagName.toLowerCase();
          const candidateSelector = `${tag}[data-cid="${dataCid}"]`;

          // Check if unique
          const matches = document.querySelectorAll(candidateSelector);
          if (matches.length === 1) {
            selector = candidateSelector;
          } else {
            // Not unique - use parent-child pattern
            const parent = target.parentElement;
            if (parent) {
              const parentSiblings = parent.parentElement ? Array.from(parent.parentElement.children) : [];
              const parentIndex = parentSiblings.indexOf(parent) + 1;

              let parentSelector = '';
              if (parent.className) {
                const parentClass = parent.className.trim().split(/\s+/)[0];
                parentSelector = `.${parentClass}:nth-child(${parentIndex})`;
              } else {
                parentSelector = `${parent.tagName.toLowerCase()}:nth-child(${parentIndex})`;
              }

              selector = `${parentSelector} > ${tag}[data-cid="${dataCid}"]`;
            } else {
              const allWithDataCid = Array.from(matches);
              const index = allWithDataCid.indexOf(target);
              selector = `${candidateSelector}:nth-of-type(${index + 1})`;
            }
          }
        }
        else if (target.getAttribute('data-name')) {
          const dataName = target.getAttribute('data-name')!;
          const tag = target.tagName.toLowerCase();
          selector = `${tag}[data-name="${dataName}"]`;
        }
        // Priority 7: Use nth-child for specific element
        else {
          const parent = target.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(target) + 1;
            const parentSelector = parent.id ? `[id="${parent.id}"]` : parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase();
            selector = `${parentSelector} > ${target.tagName.toLowerCase()}:nth-child(${index})`;
          } else {
            // Fallback to basic selector
            selector = target.className ? `.${target.className.split(' ')[0]}` : target.tagName.toLowerCase();
          }
        }

        // Generate XPath for robust fallback
        const getXPath = (element: Element): string => {
          if (element.id) {
            return `//*[@id="${element.id}"]`;
          }
          if (element === document.body) {
            return '/html/body';
          }
          let ix = 0;
          const siblings = element.parentNode ? Array.from(element.parentNode.childNodes).filter(n => n.nodeType === 1) : [];
          for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i] as Element;
            if (sibling === element) {
              const tagName = element.tagName.toLowerCase();
              return (element.parentNode ? getXPath(element.parentNode as Element) : '') + '/' + tagName + '[' + (ix + 1) + ']';
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
              ix++;
            }
          }
          return '';
        };

        const xpath = getXPath(target);

        const event: any = {
          selector: selector,
          xpath: xpath,
          text: target.textContent?.trim() || ''
        };

        console.log('📤 Click event prepared - Selector:', selector, 'XPath:', xpath, 'Text:', event.text);
        console.log('📍 Checking coordinate mode... isCoordinateMode =', isCoordinateMode);
        console.log('📍 Checking global state... __playwrightRecorderCoordinateModeActive =', (window as any).__playwrightRecorderCoordinateModeActive);

        // Add coordinates if in coordinate mode (check both variable and global state)
        const shouldUseCoordinates = isCoordinateMode || (window as any).__playwrightRecorderCoordinateModeActive;
        console.log('📍 Final decision - shouldUseCoordinates:', shouldUseCoordinates);

        if (shouldUseCoordinates) {
          // Use pageX/pageY for absolute document coordinates
          const x = e.pageX || (e.clientX + window.pageXOffset);
          const y = e.pageY || (e.clientY + window.pageYOffset);

          event.coordinates = { x, y };
          console.log(`📍✅ COORDINATES ADDED: X=${x}, Y=${y}`);
          console.log(`📍 Event now includes coordinates:`, event.coordinates);
        } else {
          console.log('📍❌ Coordinate mode is OFF, not adding coordinates');
        }
        
        (window as any).__recordedEvents.push({
          type: isClickUntilGoneMode ? 'clickUntilGone' : 'click',
          data: event,
          timestamp: Date.now()
        });

        // Check if in click until gone mode
        if (isClickUntilGoneMode && (window as any).__playwrightRecorderOnClickUntilGone) {
          console.log('🔄 Sending click until gone event to recorder:', event);
          (window as any).__playwrightRecorderOnClickUntilGone(event);
          // Turn off mode after recording one action
          isClickUntilGoneMode = false;
          document.dispatchEvent(new CustomEvent('browser-recorder-click-until-gone-toggle', {
            detail: { enabled: false }
          }));
        } else if ((window as any).__playwrightRecorderOnClick) {
          console.log('📤 Sending click event to recorder:', event);
          (window as any).__playwrightRecorderOnClick(event);
        } else {
          console.error('❌ __playwrightRecorderOnClick not available!');
        }
      };
      
      // Track clicks - add multiple listeners to catch events even if stopPropagation is used
      
      // 1. Document-level capture phase (earliest possible)
      document.addEventListener('click', handleClick, true);
      
      // 2. Window-level capture phase
      window.addEventListener('click', handleClick, true);
      
      // 3. Document-level bubble phase (fallback)
      document.addEventListener('click', handleClick, false);
      
      // 4. Override dispatchEvent to intercept all click events
      const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function(event: Event) {
        if (event.type === 'click' && event.isTrusted) {
          console.log('🎯 Intercepted dispatchEvent for click');
          handleClick(event as MouseEvent);
        }
        return originalDispatchEvent.call(this, event);
      };
      
      // 5. Add pointer events as fallback for touch/stylus (disabled by default)
      const enablePointerFallback = false; // Can be enabled for specific problematic sites
      if (enablePointerFallback) {
        document.addEventListener('pointerup', (e) => {
          if (e.pointerType === 'mouse' && e.button === 0) {
            console.log('🖱️ Pointer up detected as fallback');
            // Create synthetic click event
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: e.clientX,
              clientY: e.clientY,
              pageX: e.pageX,
              pageY: e.pageY
            });
            Object.defineProperty(clickEvent, 'target', { value: e.target, enumerable: true });
            handleClick(clickEvent);
          }
        }, true);
      }
      
      // 6. Monitor mousedown/mouseup as last resort (disabled by default)
      const enableMouseFallback = false; // Can be enabled for specific problematic sites
      if (enableMouseFallback) {
        let mouseDownTarget: EventTarget | null = null;
        let mouseDownTime = 0;
        
        document.addEventListener('mousedown', (e) => {
          mouseDownTarget = e.target;
          mouseDownTime = Date.now();
        }, true);
        
        document.addEventListener('mouseup', (e) => {
          if (mouseDownTarget === e.target && (Date.now() - mouseDownTime) < 500) {
            console.log('🖱️ Synthesizing click from mousedown/up');
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: e.clientX,
              clientY: e.clientY,
              pageX: e.pageX,
              pageY: e.pageY
            });
            Object.defineProperty(clickEvent, 'target', { value: e.target, enumerable: true });
            
            // Small delay to let any real click event fire first
            setTimeout(() => {
              // Check if we already recorded this click
              const recentEvents = (window as any).__recordedEvents.slice(-5);
              const hasRecentClick = recentEvents.some((evt: any) => 
                evt.type === 'click' && 
                evt.timestamp && 
                (Date.now() - evt.timestamp) < 100
              );
              
              if (!hasRecentClick) {
                handleClick(clickEvent);
              }
            }, 50);
          }
          mouseDownTarget = null;
        }, true);
      }
    });

  }

  private async injectIntoIframes(): Promise<void> {
    if (!this.page) return;

    try {
      const frames = this.page.frames();
      console.log(`🖼️ Found ${frames.length} frames (including main frame)`);

      for (const frame of frames) {
        // Skip main frame (already injected)
        if (frame === this.page.mainFrame()) {
          continue;
        }

        try {
          const frameUrl = frame.url();

          // Skip about:blank and empty frames (they're placeholders)
          if (frameUrl === 'about:blank' || frameUrl === '' || frameUrl === 'about:srcdoc') {
            continue;
          }

          console.log(`🖼️ Attempting to inject into iframe: ${frameUrl}`);

          // Inject event handlers into iframe
          await frame.evaluate(() => {
            // Skip if already injected
            if ((window as any).__playwrightRecorderIframeInjected) {
              console.log('🖼️ Already injected into this iframe, skipping');
              return;
            }

            // Mark as injected
            (window as any).__playwrightRecorderIframeInjected = true;
            (window as any).__isIframeContext = true;
            console.log('🖼️ Injecting recorder into iframe');

            // Get iframe selector by finding this iframe in parent
            let iframeSelector = '';
            try {
              if (window.frameElement) {
                const iframe = window.frameElement as HTMLIFrameElement;
                console.log('🖼️ Found frameElement:', iframe.tagName, 'ID:', iframe.id, 'Name:', iframe.name);

                if (iframe.id) {
                  iframeSelector = `[id="${iframe.id}"]`;
                  console.log('🖼️ Using ID selector:', iframeSelector);
                } else if (iframe.name) {
                  iframeSelector = `[name="${iframe.name}"]`;
                  console.log('🖼️ Using name selector:', iframeSelector);
                } else if (iframe.title) {
                  iframeSelector = `[title="${iframe.title}"]`;
                  console.log('🖼️ Using title selector:', iframeSelector);
                } else {
                  // Use src as fallback
                  const src = iframe.getAttribute('src');
                  if (src) {
                    const srcPart = src.split('?')[0].split('/').pop();
                    iframeSelector = `iframe[src*="${srcPart}"]`;
                    console.log('🖼️ Using src selector:', iframeSelector);
                  } else {
                    // Last resort: use index
                    try {
                      const parent = iframe.parentElement;
                      if (parent) {
                        const iframes = Array.from(parent.querySelectorAll('iframe'));
                        const index = iframes.indexOf(iframe);
                        if (index >= 0) {
                          iframeSelector = `iframe:nth-of-type(${index + 1})`;
                          console.log('🖼️ Using nth-of-type selector:', iframeSelector);
                        }
                      }
                    } catch (e2) {
                      console.warn('Could not determine iframe index:', e2);
                    }
                  }
                }

                if (!iframeSelector) {
                  iframeSelector = 'iframe'; // Absolute fallback
                  console.warn('⚠️ Could not determine unique iframe selector, using generic "iframe"');
                }

                console.log('🖼️ Final iframe selector:', iframeSelector);
                (window as any).__iframeSelector = iframeSelector;
              } else {
                console.warn('⚠️ window.frameElement is null - might not be in an iframe?');
                // Still set a fallback
                (window as any).__iframeSelector = 'iframe';
              }
            } catch (e) {
              console.error('❌ Error determining iframe selector:', e);
              // Set fallback even on error
              (window as any).__iframeSelector = 'iframe';
            }

            // Double-check that iframeSelector is set
            if (!(window as any).__iframeSelector) {
              console.error('❌ CRITICAL: __iframeSelector is not set! Using fallback.');
              (window as any).__iframeSelector = 'iframe';
            }
            console.log('✅ Iframe selector initialized:', (window as any).__iframeSelector);

            // Add visual indicator that this iframe is being recorded
            const indicator = document.createElement('div');
            indicator.style.cssText = `
              position: fixed;
              top: 5px;
              right: 5px;
              background: rgba(76, 175, 80, 0.9);
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 10px;
              font-family: monospace;
              z-index: 999999;
              pointer-events: none;
            `;
            indicator.textContent = '🖼️ Recording';
            if (document.body) {
              document.body.appendChild(indicator);
            }

            // Set up click tracking in iframe
            document.addEventListener('click', (e) => {
              const target = e.target as HTMLElement;
              console.log('🖼️ Click in iframe detected:', target);
              console.log('🖼️ Iframe selector for this frame:', (window as any).__iframeSelector);

              // Skip recorder UI elements
              if (target.closest('#browser-recorder-controller')) {
                return;
              }

              // Generate selector for the clicked element
              let selector = '';
              if (target.id) {
                selector = `[id="${target.id}"]`;
              } else if (target.tagName === 'BUTTON' && target.textContent?.trim()) {
                selector = `button:has-text("${target.textContent.trim()}")`;
              } else if (target.tagName === 'A' && target.textContent?.trim()) {
                selector = `a:has-text("${target.textContent.trim()}")`;
              } else if (target.className) {
                selector = `.${target.className.split(' ')[0]}`;
              } else {
                selector = target.tagName.toLowerCase();
              }

              // Try to pass event to parent window
              try {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    type: 'browser-recorder-iframe-click',
                    iframeSelector: (window as any).__iframeSelector,
                    targetSelector: selector,
                    targetInfo: {
                      tagName: target.tagName,
                      id: target.id,
                      className: target.className,
                      text: target.textContent?.trim() || ''
                    },
                    coordinates: {
                      x: e.pageX,
                      y: e.pageY
                    }
                  }, '*');
                  console.log('✅ Posted iframe click to parent with selector:', selector);
                }
              } catch (err) {
                console.error('Failed to post message to parent:', err);
              }
            }, true);

            // Set up input tracking in iframe
            const iframeInputTimers = new WeakMap();
            const iframeLastValues = new WeakMap();

            document.addEventListener('input', (e) => {
              const target = e.target as HTMLInputElement;

              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                // Clear existing timer
                const existingTimer = iframeInputTimers.get(target);
                if (existingTimer) {
                  clearTimeout(existingTimer);
                }

                // Debounce: wait 1 second after last keystroke
                const timer = setTimeout(() => {
                  const currentValue = target.value;
                  const lastValue = iframeLastValues.get(target);

                  if (currentValue !== lastValue) {
                    // Generate selector
                    let selector = '';
                    if (target.id) {
                      selector = `[id="${target.id}"]`;
                    } else if (target.getAttribute('name')) {
                      selector = `[name="${target.getAttribute('name')}"]`;
                    } else if (target.className) {
                      selector = `.${target.className.split(' ')[0]}`;
                    } else {
                      selector = target.tagName.toLowerCase();
                    }

                    console.log('🖼️ Input in iframe changed:', selector, '=', currentValue);
                    console.log('🖼️ Using iframe selector:', (window as any).__iframeSelector);

                    try {
                      if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                          type: 'browser-recorder-iframe-fill',
                          iframeSelector: (window as any).__iframeSelector,
                          targetSelector: selector,
                          value: currentValue
                        }, '*');
                        console.log('✅ Posted iframe fill to parent:', selector, '=', currentValue, 'iframe:', (window as any).__iframeSelector);
                      }
                    } catch (err) {
                      console.error('Failed to post fill message:', err);
                    }

                    iframeLastValues.set(target, currentValue);
                  }
                }, 1000);

                iframeInputTimers.set(target, timer);
              }
            }, true);

            document.addEventListener('blur', (e) => {
              const target = e.target as HTMLElement;

              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                // Clear timer
                const existingTimer = iframeInputTimers.get(target);
                if (existingTimer) {
                  clearTimeout(existingTimer);
                  iframeInputTimers.delete(target);
                }

                const value = (target as HTMLInputElement).value;
                const lastValue = iframeLastValues.get(target);

                // Only send if value changed
                if (value !== lastValue && value !== '') {
                  // Generate selector
                  let selector = '';
                  if (target.id) {
                    selector = `[id="${target.id}"]`;
                  } else if (target.getAttribute('name')) {
                    selector = `[name="${target.getAttribute('name')}"]`;
                  } else if (target.className) {
                    selector = `.${target.className.split(' ')[0]}`;
                  } else {
                    selector = target.tagName.toLowerCase();
                  }

                  console.log('🖼️ Input in iframe blur:', selector, '=', value);
                  console.log('🖼️ Using iframe selector:', (window as any).__iframeSelector);

                  try {
                    if (window.parent && window.parent !== window) {
                      window.parent.postMessage({
                        type: 'browser-recorder-iframe-fill',
                        iframeSelector: (window as any).__iframeSelector,
                        targetSelector: selector,
                        value: value
                      }, '*');
                      console.log('✅ Posted iframe fill on blur to parent:', selector, '=', value, 'iframe:', (window as any).__iframeSelector);
                    }
                  } catch (err) {
                    console.error('Failed to post fill message:', err);
                  }

                  iframeLastValues.set(target, value);
                }
              }
            }, true);
          });

          console.log(`✅ Injected into iframe: ${frameUrl}`);
        } catch (err: any) {
          // Check if it's a cross-origin error
          if (err.message && err.message.includes('cross-origin')) {
            console.warn(`⚠️ Cross-origin iframe detected (cannot inject): ${frame.url()}`);
            console.warn(`   Use coordinate mode for clicks in cross-origin iframes`);
          } else {
            console.warn(`⚠️ Could not inject into frame: ${frame.url()}`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Error injecting into iframes:', err);
    }
  }

  private async injectKeyboardListener(): Promise<void> {
    if (!this.page) return;

    // Also inject into iframes
    await this.injectIntoIframes();

    // Expose functions to receive events
    await this.page.exposeFunction('__playwrightRecorderOnKeyboard', async (event: any) => {
      if (event.key === 'Enter') {
        this.actions.push({
          type: 'keypress',
          key: 'Enter',
          selector: event.target.selector,
          timestamp: Date.now() - this.startTime
        });
        console.log('🎹 Captured Enter key press on:', event.target.selector);
        this.updateGeneratedCode();
      }
    });
    
    await this.page.exposeFunction('__playwrightRecorderOnFill', async (data: any) => {
      // Check for duplicate within last 500ms
      // IMPORTANT: Only skip if BOTH selector, value, AND frameSelector match
      const now = Date.now();
      const recentActions = this.actions.slice(-3);
      const isDuplicate = recentActions.some(action =>
        action.type === 'fill' &&
        action.selector === data.selector &&
        action.value === data.value &&
        action.frameSelector === data.frameSelector && // Must have same frame context
        (now - this.startTime - action.timestamp) < 500
      );

      if (isDuplicate) {
        console.log('⏭️ Duplicate fill detected, skipping:', data.selector, 'value:', data.value, 'frame:', data.frameSelector);
        return;
      }

      console.log('📝 __playwrightRecorderOnFill called');
      console.log('  - Selector:', data.selector);
      console.log('  - Value:', data.value);
      console.log('  - Frame:', data.frameSelector || 'main page');

      // If this is an iframe fill, check if there's a recent main page fill with same selector
      // If so, REMOVE the main page version and add iframe version instead
      if (data.frameSelector) {
        const mainPageFillIndex = this.actions.findIndex((action, idx) =>
          idx >= this.actions.length - 3 &&
          action.type === 'fill' &&
          action.selector === data.selector &&
          !action.frameSelector &&
          (now - this.startTime - action.timestamp) < 1500 // Wider window for fills (typing takes time)
        );

        if (mainPageFillIndex >= 0) {
          console.log('🔄 Replacing main page fill with iframe version');
          this.actions.splice(mainPageFillIndex, 1);
        }
      }

      const action: RecordedAction = {
        type: 'fill',
        selector: data.selector,
        value: data.value,
        timestamp: Date.now() - this.startTime
      };

      // Add frame selector if provided (for iframe fills)
      if (data.frameSelector) {
        action.frameSelector = data.frameSelector;
        console.log('📝 ✅ Fill in iframe, frame selector:', data.frameSelector);
      } else {
        console.log('📝 Fill on main page');
      }

      this.actions.push(action);
      console.log('📝 Captured fill:', data.selector, '=', data.value, 'frame:', data.frameSelector || 'main');
      this.updateGeneratedCode();
    });
    
    await this.page.exposeFunction('__playwrightRecorderOnClick', async (data: any) => {
      const now = Date.now();
      const recentActions = this.actions.slice(-3);

      // Check for exact duplicate (same selector AND same frame)
      const isDuplicate = recentActions.some(action =>
        action.type === 'click' &&
        action.selector === data.selector &&
        action.frameSelector === data.frameSelector &&
        (now - this.startTime - action.timestamp) < 500
      );

      if (isDuplicate) {
        console.log('⏭️ Exact duplicate click, skipping:', data.selector, 'frame:', data.frameSelector);
        return;
      }

      // If this is a main page click, check if there's a recent iframe click with same selector
      // If so, REPLACE the main page click with the iframe one
      if (!data.frameSelector) {
        const mainPageClickIndex = this.actions.findIndex((action, idx) =>
          idx >= this.actions.length - 3 && // Only check recent actions
          action.type === 'click' &&
          action.selector === data.selector &&
          !action.frameSelector && // Main page click
          (now - this.startTime - action.timestamp) < 200
        );

        if (mainPageClickIndex >= 0) {
          console.log('⏸️ Found recent main page click, waiting to see if iframe version arrives...');
          // Wait 100ms to see if iframe version comes
          await new Promise(resolve => setTimeout(resolve, 100));
          // If an iframe version was added, skip this main page version
          const hasIframeVersion = this.actions.some((action, idx) =>
            idx > mainPageClickIndex &&
            action.type === 'click' &&
            action.selector === data.selector &&
            action.frameSelector
          );
          if (hasIframeVersion) {
            console.log('✅ Iframe version already recorded, skipping main page click');
            return;
          }
        }
      }

      // If this is an iframe click, check if there's a recent main page click with same selector
      // If so, REMOVE the main page version and add iframe version instead
      if (data.frameSelector) {
        const mainPageClickIndex = this.actions.findIndex((action, idx) =>
          idx >= this.actions.length - 3 &&
          action.type === 'click' &&
          action.selector === data.selector &&
          !action.frameSelector &&
          (now - this.startTime - action.timestamp) < 200
        );

        if (mainPageClickIndex >= 0) {
          console.log('🔄 Replacing main page click with iframe version');
          this.actions.splice(mainPageClickIndex, 1);
        }
      }

      console.log('🎯 __playwrightRecorderOnClick called');
      console.log('  - Selector:', data.selector);
      console.log('  - XPath:', data.xpath);
      console.log('  - Frame:', data.frameSelector || 'main page');
      console.log('  - Coordinates:', data.coordinates);

      const action: RecordedAction = {
        type: 'click',
        selector: data.selector,
        xpath: data.xpath,
        value: data.text,
        timestamp: Date.now() - this.startTime
      };

      // Add frame selector if provided (for iframe clicks)
      if (data.frameSelector) {
        action.frameSelector = data.frameSelector;
        console.log('🖼️ ✅ Click in iframe, frame selector:', data.frameSelector);
      } else {
        console.log('🖱️ Click on main page (no frameSelector)');
      }

      // Add coordinates if provided
      if (data.coordinates) {
        action.coordinates = data.coordinates;
        console.log('🖱️📍 Captured click WITH COORDINATES:', data.coordinates);
        console.log('🖱️📍 Action saved with coordinates:', action.coordinates);
      } else {
        console.log('🖱️ Captured click on:', data.selector);
        console.log('🖱️ No coordinates in this action');
      }

      this.actions.push(action);
      console.log('📊 Total actions now:', this.actions.length);
      console.log('📊 Last action:', this.actions[this.actions.length - 1]);
      this.updateGeneratedCode();
    });

    await this.page.exposeFunction('__playwrightRecorderOnClickUntilGone', async (data: any) => {
      const action: RecordedAction = {
        type: 'clickUntilGone',
        selector: data.selector,
        value: data.text,
        timestamp: Date.now() - this.startTime,
        maxIterations: 100, // Safety limit
        checkCondition: 'gone', // Default: check if element is gone
        waitBetweenClicks: 3000 // Wait 3 seconds between clicks (for slower computers/loading)
      };

      console.log('🔄 Captured click until gone on:', data.selector);

      this.actions.push(action);
      this.updateGeneratedCode();
    });

    // Track coordinate mode state changes
    await this.page.exposeFunction('__playwrightRecorderOnCoordinateModeChange', async (enabled: boolean) => {
      console.log('📍 Coordinate mode changed to:', enabled);
      this.isCoordinateModeEnabled = enabled;
    });
    
    await this.page.exposeFunction('__playwrightRecorderOnGemini', async (elementInfo: any) => {
      console.log('🌟 Gemini button clicked for element:', elementInfo);

      // Try to capture element screenshot using Playwright (more reliable than canvas)
      let screenshotDataUrl: string | null = null;
      try {
        if (this.page) {
          console.log('📸 Attempting to screenshot element with Playwright...');

          // Generate a selector for the element
          let selector = '';
          if (elementInfo.id) {
            selector = `[id="${elementInfo.id}"]`;
          } else if (elementInfo.className) {
            const firstClass = elementInfo.className.split(' ')[0];
            if (firstClass) {
              selector = `.${firstClass}`;
            }
          }

          if (selector) {
            // Use Playwright's screenshot API
            const screenshotBuffer = await this.page.locator(selector).screenshot({ type: 'png' });
            screenshotDataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            console.log('✅ Element screenshot captured successfully');
          }
        }
      } catch (error) {
        console.warn('⚠️ Playwright screenshot failed, using browser-provided image if available:', error);
        screenshotDataUrl = elementInfo.imageDataUrl; // Fallback to browser-captured image
      }

      // Use Playwright screenshot if available, otherwise use browser-provided image
      const finalImageDataUrl = screenshotDataUrl || elementInfo.imageDataUrl;

      // Build the element display with image if available
      let elementDisplay = `<!-- Gemini Element Analysis -->
<!-- ======================== -->

`;

      // Add image preview if captured
      if (finalImageDataUrl) {
        elementDisplay += `<!-- Element Screenshot (ready for AI analysis) -->
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
  <h3 style="margin: 0 0 10px 0; font-family: Arial, sans-serif; color: #333;">📸 Captured Element Image</h3>
  <p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 14px; color: #666;">
    This image will be sent to Gemini AI for analysis
  </p>
  <img src="${finalImageDataUrl}" style="max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  <div style="margin-top: 10px; font-family: monospace; font-size: 12px; background: white; padding: 10px; border-radius: 4px;">
    <strong>Element:</strong> ${elementInfo.tagName.toLowerCase()}${elementInfo.id ? '#' + elementInfo.id : ''}${elementInfo.className ? '.' + elementInfo.className.split(' ').join('.') : ''}<br>
    <strong>Dimensions:</strong> ${Math.round(elementInfo.bounds.width)}x${Math.round(elementInfo.bounds.height)}px<br>
    <strong>Position:</strong> (${Math.round(elementInfo.bounds.x)}, ${Math.round(elementInfo.bounds.y)})
  </div>
</div>

`;
      }

      // Add code analysis
      elementDisplay += `// Selected Element: ${elementInfo.tagName}${elementInfo.id ? '#' + elementInfo.id : ''}${elementInfo.className ? '.' + elementInfo.className.split(' ').join('.') : ''}

// Element Properties:
const element = {
  tagName: "${elementInfo.tagName}",
  id: "${elementInfo.id}",
  className: "${elementInfo.className}",
  text: ${JSON.stringify(elementInfo.text)},

  // Bounding Box:
  bounds: {
    x: ${elementInfo.bounds.x},
    y: ${elementInfo.bounds.y},
    width: ${elementInfo.bounds.width},
    height: ${elementInfo.bounds.height}
  },

  // Attributes:
  attributes: ${JSON.stringify(elementInfo.attributes, null, 2)},

  // Computed Styles:
  styles: ${JSON.stringify(elementInfo.styles, null, 2)},

  // HTML Structure:
  outerHTML: ${JSON.stringify(elementInfo.outerHTML)}
};

// Playwright Selector Suggestions:
const selectors = [
  ${elementInfo.id ? `'[id="${elementInfo.id}"]',` : ''}
  ${elementInfo.className ? `'.${elementInfo.className.split(' ')[0]}',` : ''}
  ${elementInfo.attributes['data-testid'] ? `'[data-testid="${elementInfo.attributes['data-testid']}"]',` : ''}
  ${elementInfo.tagName === 'BUTTON' && elementInfo.text ? `'button:has-text("${elementInfo.text}")',` : ''}
  ${elementInfo.tagName === 'A' && elementInfo.text ? `'a:has-text("${elementInfo.text}")',` : ''}
  '${elementInfo.tagName.toLowerCase()}'
].filter(Boolean);

// Example Usage:
await page.locator(selectors[0]).click();
await page.locator(selectors[0]).fill('value');
await expect(page.locator(selectors[0])).toBeVisible();

// Image Data Available: ${finalImageDataUrl ? 'Yes ✓' : 'No ✗'}
${finalImageDataUrl ? `// Image Size: ${Math.round(finalImageDataUrl.length / 1024)} KB` : ''}
`;

      // Send to code viewer
      if (this.updateCallback) {
        this.updateCallback(elementDisplay);
      }
    });

    await this.page.exposeFunction('__playwrightRecorderOnControllerLost', async () => {
      console.log('🚨 Controller lost, re-injecting...');
      await this.injectControllerUI();
    });

    await this.page.exposeFunction('__playwrightRecorderOnStop', async () => {
      console.log('⏹️ Stop recording requested from browser UI');
      this.isRecording = false;
      
      // Generate final test code
      const testCode = this.generateTestCode();
      
      // Update code viewer with final code
      if (this.updateCallback) {
        this.updateCallback(testCode);
      }
      
      // Write final code to file if outputFile is set
      if (this.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(this.outputFile, testCode);
          console.log('💾 Final test code saved to:', this.outputFile);
        } catch (err) {
          console.error('Failed to write final test file:', err);
        }
      }
      
      // Close context after a short delay to allow UI feedback
      setTimeout(async () => {
        if (this.context) {
          try {
            await this.context.close();
            console.log('🚪 Browser context closed after stop request');
          } catch (err) {
            console.log('Browser context already closed or error closing:', err);
          }
        }

        // Clean up profile directory
        if (this.profileDir) {
          try {
            fs.rmSync(this.profileDir, { recursive: true, force: true });
            console.log('🧹 Cleaned up profile directory');
          } catch (err) {
            console.warn('Failed to clean up profile directory:', err);
          }
        }

        // Clean up temporary extensions directory
        this.cleanupTempExtensions();
      }, 1000);
    });

    await this.page.exposeFunction('__playwrightRecorderOnWaitForElement', async (data: any) => {
      console.log('⏳ Wait for element action recorded:', data);
      
      this.actions.push({
        type: 'waitForElement',
        selector: data.selector,
        waitCondition: data.condition as 'visible' | 'hidden' | 'enabled' | 'disabled',
        timeout: data.timeout,
        timestamp: Date.now() - this.startTime
      });
      
      console.log('⏳ Wait for element added:', data.selector, 'condition:', data.condition, 'timeout:', data.timeout + 'ms');
      this.updateGeneratedCode();
    });

    await this.page.exposeFunction('__playwrightRecorderOnDateDropdownMarked', async (selector: string, elementType: 'select' | 'button' | 'input', step: 'year' | 'month' | 'day', dropdownSelector: string) => {
      console.log('📅 Date element marked:', { selector, elementType, step, dropdownSelector });
      this.handleDateDropdownMarked(selector, elementType, step, dropdownSelector);
    });

    await this.page.exposeFunction('__playwrightRecorderOnDateOffsetSelected', async (offset: number) => {
      console.log('📅 Date offset selected:', offset);
      this.dateMarkingOffset = offset;
      // Now create the date picker action with the selected offset
      this.createDatePickerAction();

      // Show success notification in browser
      this.page?.evaluate((offset: number) => {
        const successNotification = document.createElement('div');
        successNotification.style.cssText = `
          position: fixed;
          top: 70px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 16px 20px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 999999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          font-weight: 500;
        `;

        const offsetText = offset === 0 ? 'today' :
                          offset > 0 ? `today + ${offset} days` :
                          `today - ${Math.abs(offset)} days`;

        successNotification.innerHTML = `
          <strong>✅ Date Picker Recorded!</strong><br>
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
            Timeframe: ${offsetText}
          </div>
        `;

        try {
          if (document.body) {
            document.body.appendChild(successNotification);
          }
        } catch (e) {
          console.warn('Failed to show success notification:', e);
        }

        // Remove after 3 seconds
        setTimeout(() => {
          successNotification.style.opacity = '0';
          successNotification.style.transition = 'opacity 0.3s ease';
          setTimeout(() => successNotification.remove(), 300);
        }, 3000);
      }, offset);
    });

    await this.page.exposeFunction('__playwrightRecorderSkipDateComponent', async (step: 'year' | 'month' | 'day') => {
      console.log('⏭️ Skipping date component:', step);
      this.handleSkipDateComponent(step);
    });

    // Expose function for table capture
    await this.page.exposeFunction('__playwrightRecorderOnCaptureTable', async (tables: any[]) => {
      console.log('📊 Capture table action recorded:', tables.length, 'tables');

      this.actions.push({
        type: 'captureTable',
        tables: tables,
        timestamp: Date.now() - this.startTime
      });

      console.log('📊 Table capture added');
      this.updateGeneratedCode();
    });

    // Expose function for print action
    await this.page.exposeFunction('__playwrightRecorderOnPrint', async () => {
      console.log('🖨️ Print action recorded');

      this.actions.push({
        type: 'print',
        timestamp: Date.now() - this.startTime
      });

      // Automatically handle print dialog if OS automation is available
      if (this.osAutomation && this.osAutomation.getAvailability()) {
        console.log('🤖 OS automation will handle print dialog automatically...');
        // Wait a bit for dialog to appear, then press Enter
        setTimeout(async () => {
          const success = await this.osAutomation!.handlePrintDialog('confirm', 1500);
          if (success) {
            console.log('✅ Print dialog handled automatically');
          } else {
            console.log('⚠️ Failed to handle print dialog automatically - please handle manually');
          }
        }, 500); // Initial delay before starting automation
      } else {
        console.log('⚠️ OS automation not available - please handle print dialog manually');
      }

      console.log('🖨️ Print action added');
      this.updateGeneratedCode();
    });
  }

  private setupPageListeners(): void {
    if (!this.page) return;

    // Listen for various navigation events
    this.page.on('load', async () => {
      console.log('🔄 Page load event detected');
      await this.injectKeyboardListener();
      await this.injectControllerUI();
      await this.reapplyModeStates();
      // Inject into iframes immediately after page load
      await this.injectIntoIframes();
    });

    // Also listen for DOM content changes
    this.page.on('domcontentloaded', async () => {
      console.log('🔄 DOM content loaded');
      // Wait a bit for any dynamic content to settle
      await this.page.waitForTimeout(500);
      await this.injectControllerUI();
      await this.reapplyModeStates();
      // Inject into iframes
      await this.injectIntoIframes();
    });

    // Monitor for navigation within the same page
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page.mainFrame()) {
        console.log('🔄 Main frame navigated');
        await this.page.waitForTimeout(500);
        await this.injectKeyboardListener();
        await this.injectControllerUI();
        await this.reapplyModeStates();
      }
      // Also inject into the specific frame that navigated
      console.log('🔄 Frame navigated:', frame.url());
      await this.injectIntoIframes();
    });

    // Handle file chooser for uploads (ONLY in chain mode)
    // In non-chain mode, we let the native file picker work normally
    if (this.isChainedRecording && this.chainDownloadPath) {
      console.log('🔗 Setting up file chooser listener for chain mode');
      console.log('📂 Will auto-select:', this.chainDownloadPath);

      // 🔍 DEBUG: Log conditions before registering listener
      console.log('🔍 DEBUG: About to register filechooser listener');
      console.log('🔍 DEBUG: isChainedRecording:', this.isChainedRecording);
      console.log('🔍 DEBUG: chainDownloadPath:', this.chainDownloadPath);
      console.log('🔍 DEBUG: File exists:', fs.existsSync(this.chainDownloadPath));
      console.log('🔍 DEBUG: this.page exists:', !!this.page);
      console.log('🔍 DEBUG: Current page URL:', this.page?.url());

      this.page.on('filechooser', async (fileChooser) => {
        // 🔍 DEBUG: Log IMMEDIATELY - before try/catch, before anything else
        console.log('🔍 DEBUG: ========================================');
        console.log('🔍 DEBUG: FILECHOOSER CALLBACK FIRED!!!');
        console.log('🔍 DEBUG: ========================================');
        console.log('🔍 DEBUG: fileChooser exists:', !!fileChooser);
        console.log('🔍 DEBUG: this.page.url():', this.page?.url());
        console.log('🔍 DEBUG: this.chainDownloadPath:', this.chainDownloadPath);

        try {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📎 FILE CHOOSER DETECTED IN CHAIN MODE!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Chain mode: auto-select the downloaded file
          console.log('🔗 Auto-selecting file:', this.chainDownloadPath);
          console.log('🎯 File exists:', fs.existsSync(this.chainDownloadPath!));

          if (!fs.existsSync(this.chainDownloadPath!)) {
            console.error('❌ File not found at path:', this.chainDownloadPath);
            throw new Error(`Downloaded file not found: ${this.chainDownloadPath}`);
          }

          await fileChooser.setFiles(this.chainDownloadPath!);
          
          const uploadedFilePath = this.chainDownloadPath!;
          const uploadedFileName = this.chainDownloadName || path.basename(this.chainDownloadPath!);

          // Don't record the upload action - the file chooser listener will handle it automatically during replay
          console.log('✅ File upload handled automatically (not recorded as action)');
          console.log('📝 File:', uploadedFileName);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

          // Show visual notification in browser
          await this.page!.evaluate((fileName) => {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
              color: white;
              padding: 24px 32px;
              border-radius: 16px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              font-size: 16px;
              font-weight: 600;
              z-index: 999999;
              box-shadow: 0 20px 60px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
              animation: uploadNotificationSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
              text-align: center;
              min-width: 320px;
              backdrop-filter: blur(10px);
            `;

            notification.innerHTML = `
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 32px;">📤</span>
                <div style="flex: 1; text-align: left;">
                  <div style="font-size: 18px; margin-bottom: 4px;">File Auto-Uploaded</div>
                  <div style="font-size: 13px; opacity: 0.9; font-weight: 400;">${fileName}</div>
                </div>
                <span style="font-size: 24px;">✅</span>
              </div>
              <div style="font-size: 12px; opacity: 0.8; margin-top: 8px; font-weight: 400; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                Chain recording in progress
              </div>
            `;

            // Add animation keyframes
            if (!document.querySelector('#upload-notification-styles')) {
              const style = document.createElement('style');
              style.id = 'upload-notification-styles';
              style.textContent = `
                @keyframes uploadNotificationSlide {
                  0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                  }
                  100% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                  }
                }
                @keyframes uploadNotificationFadeOut {
                  0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                  }
                  100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                  }
                }
              `;
              document.head.appendChild(style);
            }

            document.body.appendChild(notification);

            // Auto-remove after 3 seconds with fade out
            setTimeout(() => {
              notification.style.animation = 'uploadNotificationFadeOut 0.3s ease-out forwards';
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 300);
            }, 3000);
          }, uploadedFileName);

          // Update live code preview
          if (this.updateCallback) {
            this.updateCallback(this.generateTestCode());
          }
        } catch (err) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ FAILED TO HANDLE FILE CHOOSER');
          console.error('Error:', err);
          console.error('Error message:', err instanceof Error ? err.message : String(err));
          console.error('Stack trace:', err instanceof Error ? err.stack : 'No stack trace');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

          // Show error notification in browser
          const errorMessage = err instanceof Error ? err.message : String(err);
          await this.page!.evaluate((errMsg) => {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: white;
              padding: 24px 32px;
              border-radius: 16px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              font-size: 16px;
              font-weight: 600;
              z-index: 999999;
              box-shadow: 0 20px 60px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
              animation: uploadNotificationSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
              text-align: center;
              min-width: 320px;
              max-width: 500px;
              backdrop-filter: blur(10px);
            `;

            notification.innerHTML = `
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 32px;">❌</span>
                <div style="flex: 1; text-align: left;">
                  <div style="font-size: 18px; margin-bottom: 4px;">File Upload Failed</div>
                  <div style="font-size: 13px; opacity: 0.9; font-weight: 400; word-break: break-word;">${errMsg}</div>
                </div>
              </div>
              <div style="font-size: 12px; opacity: 0.8; margin-top: 8px; font-weight: 400; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                You may need to select the file manually
              </div>
            `;

            document.body.appendChild(notification);

            // Auto-remove after 5 seconds (longer for error)
            setTimeout(() => {
              notification.style.animation = 'uploadNotificationFadeOut 0.3s ease-out forwards';
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 300);
            }, 5000);
          }, errorMessage).catch(() => {
            // Ignore if page context is destroyed
          });
        }
      });

      // 🔍 DEBUG: Confirm listener was attached
      console.log('🔍 DEBUG: Filechooser listener attached successfully');
      console.log('🔍 DEBUG: Listener is on page:', this.page?.url());
    } else {
      console.log('ℹ️ Not in chain mode - native file picker will work normally');

      // 🔍 DEBUG: Log why listener was NOT registered
      console.log('🔍 DEBUG: Filechooser listener NOT registered');
      console.log('🔍 DEBUG: isChainedRecording:', this.isChainedRecording);
      console.log('🔍 DEBUG: chainDownloadPath:', this.chainDownloadPath);
      // In non-chain mode, we don't set up a file chooser listener
      // This allows the native file picker to work as expected
      // File uploads in non-chain mode won't be automatically recorded,
      // but the clicks on file inputs will be captured as regular clicks
    }
  }

  private async reapplyModeStates(): Promise<void> {
    if (!this.page) return;

    // Re-apply coordinate mode if it was enabled
    if (this.isCoordinateModeEnabled) {
      console.log('📍 Re-applying coordinate mode state');
      await this.page.evaluate(() => {
        const event = new CustomEvent('browser-recorder-coordinate-toggle', {
          detail: { enabled: true }
        });
        document.dispatchEvent(event);

        // Update button state
        const coordBtn = document.querySelector('#browser-recorder-controller [data-coord-mode="true"]') as HTMLElement;
        if (coordBtn) {
          coordBtn.classList.add('active');
          coordBtn.style.background = '#4CAF50';
          coordBtn.style.borderColor = '#4CAF50';
        }
      });
    }
  }


  async stop(): Promise<string> {
    this.isRecording = false;

    // Stop controller check
    if (this.controllerCheckInterval) {
      clearInterval(this.controllerCheckInterval);
      this.controllerCheckInterval = null;
    }

    // Generate test code
    const testCode = this.generateTestCode();

    // Close context (which closes the browser for persistent context)
    if (this.context) {
      try {
        await this.context.close();
      } catch (err) {
        console.log('Browser context already closed');
      }
    }

    // Clean up profile directory
    if (this.profileDir) {
      try {
        fs.rmSync(this.profileDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up profile directory:', this.profileDir);
      } catch (err) {
        console.warn('Failed to clean up profile directory:', err);
      }
      this.profileDir = null;
    }

    // Clean up temporary extensions directory
    this.cleanupTempExtensions();

    return testCode;
  }

  private handleDateDropdownMarked(selector: string, elementType: 'select' | 'button' | 'input', step: 'year' | 'month' | 'day', dropdownSelector: string): void {
    console.log(`📅 Handling date element marked: ${step} = ${selector} (${elementType}), dropdown: ${dropdownSelector}`);

    // Store the selector, element type, and dropdown selector for this date component
    this.dateMarkingSelectors[step] = { selector, elementType, dropdownSelector: dropdownSelector || undefined };
    this.dateMarkingStep = step;

    // Advance to next step
    if (step === 'year') {
      this.dateMarkingStep = 'month';

      // Update browser UI to show next step
      this.page?.evaluate(() => {
        (window as any).__playwrightRecorderDateMarkingStep = 'month';
        if ((window as any).__updateDateMarkingInstructions) {
          (window as any).__updateDateMarkingInstructions('month');
        }
      });

      console.log('✅ Year dropdown marked, waiting for month...');
    } else if (step === 'month') {
      this.dateMarkingStep = 'day';

      // Update browser UI to show next step
      this.page?.evaluate(() => {
        (window as any).__playwrightRecorderDateMarkingStep = 'day';
        if ((window as any).__updateDateMarkingInstructions) {
          (window as any).__updateDateMarkingInstructions('day');
        }
      });

      console.log('✅ Month dropdown marked, waiting for day...');
    } else if (step === 'day') {
      console.log('✅ All 3 date elements marked! Modal should now be showing...');
      // Don't create action yet - wait for user to select offset in modal
      // The action will be created in __playwrightRecorderOnDateOffsetSelected
      // Don't exit date marking mode - it will be exited when modal is dismissed
    }
  }

  private handleSkipDateComponent(step: 'year' | 'month' | 'day'): void {
    console.log(`⏭️ Skipping date component: ${step}`);

    // Don't store anything for this component (it's skipped)
    // Just advance to next step

    if (step === 'year') {
      this.dateMarkingStep = 'month';

      // Update browser UI to show next step
      this.page?.evaluate(() => {
        (window as any).__playwrightRecorderDateMarkingStep = 'month';
        if ((window as any).__updateDateMarkingInstructions) {
          (window as any).__updateDateMarkingInstructions('month');
        }
      });

      console.log('⏭️ Year skipped, waiting for month...');
    } else if (step === 'month') {
      this.dateMarkingStep = 'day';

      // Update browser UI to show next step
      this.page?.evaluate(() => {
        (window as any).__playwrightRecorderDateMarkingStep = 'day';
        if ((window as any).__updateDateMarkingInstructions) {
          (window as any).__updateDateMarkingInstructions('day');
        }
      });

      console.log('⏭️ Month skipped, waiting for day...');
    } else if (step === 'day') {
      console.log('⏭️ Day skipped! Checking if we have at least one component marked...');

      // Check if at least one component was marked
      const hasAnyComponent = this.dateMarkingSelectors.year || this.dateMarkingSelectors.month || this.dateMarkingSelectors.day;

      if (!hasAnyComponent) {
        // No components marked at all - show error
        this.page?.evaluate(() => {
          const errorNotification = document.createElement('div');
          errorNotification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-weight: 500;
          `;

          errorNotification.innerHTML = `
            <strong>❌ Error</strong><br>
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
              You must mark at least one date component!
            </div>
          `;

          if (document.body) {
            document.body.appendChild(errorNotification);
          }

          setTimeout(() => {
            errorNotification.style.opacity = '0';
            errorNotification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => errorNotification.remove(), 300);
          }, 3000);
        });

        console.error('❌ No date components marked - all were skipped');
        // Exit date marking mode
        this.exitDateMarkingMode();
        return;
      }

      // At least one component was marked - show date offset modal
      // This will trigger the modal just like when all 3 are marked
      this.page?.evaluate(() => {
        if ((window as any).__showDateOffsetModal) {
          (window as any).__showDateOffsetModal();
        }
      });
    }
  }

  private createDatePickerAction(): void {
    // Validate at least one component was collected
    const hasYear = !!this.dateMarkingSelectors.year;
    const hasMonth = !!this.dateMarkingSelectors.month;
    const hasDay = !!this.dateMarkingSelectors.day;

    if (!hasYear && !hasMonth && !hasDay) {
      console.error('❌ No date components marked (all were skipped)');
      return;
    }

    // Build dateComponents object with only marked components
    const dateComponents: any = {};

    if (hasYear) {
      dateComponents.year = {
        selector: this.dateMarkingSelectors.year!.selector,
        elementType: this.dateMarkingSelectors.year!.elementType,
        dropdownSelector: this.dateMarkingSelectors.year!.dropdownSelector
      };
    }

    if (hasMonth) {
      dateComponents.month = {
        selector: this.dateMarkingSelectors.month!.selector,
        elementType: this.dateMarkingSelectors.month!.elementType,
        dropdownSelector: this.dateMarkingSelectors.month!.dropdownSelector
      };
    }

    if (hasDay) {
      dateComponents.day = {
        selector: this.dateMarkingSelectors.day!.selector,
        elementType: this.dateMarkingSelectors.day!.elementType,
        dropdownSelector: this.dateMarkingSelectors.day!.dropdownSelector
      };
    }

    const markedComponents = [hasYear && 'year', hasMonth && 'month', hasDay && 'day'].filter(Boolean).join(', ');
    console.log(`📅 Creating date picker action with: ${markedComponents}`);

    const action: RecordedAction = {
      type: 'datePickerGroup',
      timestamp: Date.now() - this.startTime,
      dateComponents: dateComponents,
      dateOffset: this.dateMarkingOffset // Default to today (0)
    };

    this.actions.push(action);
    console.log('📅 Date picker action created:', action);
    this.updateGeneratedCode();

    // Reset state
    this.dateMarkingSelectors = {};
    this.dateMarkingOffset = 0;
  }

  private async enterDateMarkingMode(): Promise<void> {
    this.isDateMarkingMode = true;
    this.dateMarkingStep = 'year';
    this.dateMarkingSelectors = {};

    // Update browser context
    await this.page?.evaluate(() => {
      (window as any).__playwrightRecorderDateMarkingMode = true;
      (window as any).__playwrightRecorderDateMarkingStep = 'year';
    });

    console.log('📅 Entered date marking mode');
  }

  private async exitDateMarkingMode(): Promise<void> {
    this.isDateMarkingMode = false;
    this.dateMarkingStep = null;
    this.dateMarkingSelectors = {};

    // Update browser context
    await this.page?.evaluate(() => {
      if ((window as any).__exitDateMarkingMode) {
        (window as any).__exitDateMarkingMode();
      }
    });

    console.log('📅 Exited date marking mode');
  }

  generateTestCode(): string {
    // Get screen dimensions (same as recording)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const browserWidth = Math.floor(width * 0.6);
    const browserHeight = height;
    const browserX = width - browserWidth;
    const browserY = 0;

    const lines: string[] = [
      "/**",
      " * RECORDED_ACTIONS:",
      ` * ${JSON.stringify(this.actions)}`,
      " *",
      " * CHROME_EXTENSIONS:",
      ` * ${JSON.stringify(this.extensionPaths)}`,
      " */",
      "",
      "const { chromium } = require('playwright-core');",
      "const path = require('path');",
      "const os = require('os');",
      "const fs = require('fs');",
      "",
      "// Original extension paths from recording session",
      `const EXTENSION_PATHS = ${JSON.stringify(this.extensionPaths, null, 2)};`,
      "",
      "/**",
      " * Copy Chrome extensions to temporary directory",
      " * Returns { paths: string[], tempDir: string }",
      " */",
      "function copyExtensionsToTemp(profileDir) {",
      "  if (EXTENSION_PATHS.length === 0) return { paths: [], tempDir: null };",
      "  ",
      "  try {",
      "    const tempExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egdesk-extensions-'));",
      "    console.log('[Replay] Copying', EXTENSION_PATHS.length, 'extensions to:', tempExtensionsDir);",
      "    ",
      "    const copiedPaths = [];",
      "    ",
      "    for (const extPath of EXTENSION_PATHS) {",
      "      if (!fs.existsSync(extPath)) {",
      "        console.warn('[Replay] Extension not found:', extPath);",
      "        continue;",
      "      }",
      "      ",
      "      const version = path.basename(extPath);",
      "      const extensionId = path.basename(path.dirname(extPath));",
      "      const destPath = path.join(tempExtensionsDir, `${extensionId}-${version}`);",
      "      ",
      "      fs.cpSync(extPath, destPath, { recursive: true });",
      "      copiedPaths.push(destPath);",
      "      console.log('[Replay] ✓ Copied:', extensionId);",
      "    }",
      "    ",
      "    // Copy native messaging hosts",
      "    copyNativeMessagingHosts(profileDir);",
      "    ",
      "    console.log('[Replay] Successfully copied', copiedPaths.length + '/' + EXTENSION_PATHS.length, 'extensions');",
      "    return { paths: copiedPaths, tempDir: tempExtensionsDir };",
      "  } catch (error) {",
      "    console.error('[Replay] Error copying extensions:', error);",
      "    return { paths: [], tempDir: null };",
      "  }",
      "}",
      "",
      "/**",
      " * Copy native messaging host manifests to profile directory",
      " */",
      "function copyNativeMessagingHosts(profileDir) {",
      "  try {",
      "    const nativeHostLocations = [",
      "      '/Library/Google/Chrome/NativeMessagingHosts',",
      "      '/Library/Application Support/Google/Chrome/NativeMessagingHosts',",
      "      path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),",
      "      '/Library/Application Support/Chromium/NativeMessagingHosts',",
      "      path.join(os.homedir(), 'Library/Application Support/Chromium/NativeMessagingHosts')",
      "    ];",
      "    ",
      "    const destNativeHostsDir = path.join(profileDir, 'NativeMessagingHosts');",
      "    if (!fs.existsSync(destNativeHostsDir)) {",
      "      fs.mkdirSync(destNativeHostsDir, { recursive: true });",
      "    }",
      "    ",
      "    let copiedCount = 0;",
      "    for (const location of nativeHostLocations) {",
      "      if (fs.existsSync(location)) {",
      "        const files = fs.readdirSync(location);",
      "        for (const file of files) {",
      "          if (file.endsWith('.json')) {",
      "            const sourcePath = path.join(location, file);",
      "            const destPath = path.join(destNativeHostsDir, file);",
      "            if (!fs.existsSync(destPath)) {",
      "              fs.copyFileSync(sourcePath, destPath);",
      "              copiedCount++;",
      "            }",
      "          }",
      "        }",
      "      }",
      "    }",
      "    ",
      "    if (copiedCount > 0) {",
      "      console.log(`[Replay] ✓ Copied ${copiedCount} native messaging host(s)`);",
      "    }",
      "  } catch (error) {",
      "    console.warn('[Replay] Error copying native hosts:', error);",
      "  }",
      "}",
      "",
      "(async () => {",
      "  console.log('🎬 Starting test replay...');",
      "  ",
      "  // Create downloads directory in system Downloads folder (grouped under EGDesk-Browser)",
      `  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', '${this.scriptName}');`,
      "  if (!fs.existsSync(downloadsPath)) {",
      "    fs.mkdirSync(downloadsPath, { recursive: true });",
      "  }",
      "  console.log('📥 Downloads will be saved to:', downloadsPath);",
      "",
      "  // Create temporary profile directory",
      "  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));",
      "  console.log('📁 Using profile directory:', profileDir);",
      "",
      "  // Copy Chrome extensions if any were used during recording",
      "  let copiedExtensionPaths = [];",
      "  let tempExtensionsDir = null;",
      "  if (EXTENSION_PATHS.length > 0) {",
      "    const extensionResult = copyExtensionsToTemp(profileDir);",
      "    copiedExtensionPaths = extensionResult.paths;",
      "    tempExtensionsDir = extensionResult.tempDir;",
      "  }",
      "",
      "  // Launch browser with persistent context (more reliable in production)",
      "  const browserChannel = copiedExtensionPaths.length > 0 ? 'chromium' : 'chrome';",
      "  console.log(`🎭 Launching with channel: ${browserChannel}`);",
      "  if (copiedExtensionPaths.length > 0) {",
      "    console.log('🧩 Loading', copiedExtensionPaths.length, 'Chrome extension(s)');",
      "  }",
      "",
      "  // Build browser args",
      "  const args = [",
      `    '--window-size=${browserWidth},${browserHeight}',`,
      `    '--window-position=${browserX},${browserY}',`,
      "    '--no-default-browser-check',",
      "    '--disable-blink-features=AutomationControlled',",
      "    '--no-first-run',",
      "    // Permission handling for localhost and private network access",
      "    '--disable-web-security',",
      "    '--disable-features=IsolateOrigins,site-per-process',",
      "    '--allow-running-insecure-content',",
      "    '--disable-features=PrivateNetworkAccessSendPreflights',",
      "    '--disable-features=PrivateNetworkAccessRespectPreflightResults'",
      "  ];",
      "",
      "  // Add extension loading args if extensions were copied",
      "  if (copiedExtensionPaths.length > 0) {",
      "    const extensionPathsStr = copiedExtensionPaths.join(',');",
      "    args.push(`--disable-extensions-except=${extensionPathsStr}`);",
      "    args.push(`--load-extension=${extensionPathsStr}`);",
      "  }",
      "",
      "  const context = await chromium.launchPersistentContext(profileDir, {",
      "    headless: false,",
      "    channel: browserChannel,",
      "    viewport: null,",
      "    permissions: ['clipboard-read', 'clipboard-write'],",
      "    acceptDownloads: true,",
      "    downloadsPath: downloadsPath,",
      "    args: args",
      "  });",
      "",
      "  // Get or create page",
      "  const pages = context.pages();",
      "  let page = pages.length > 0 ? pages[0] : await context.newPage(); // Use 'let' to allow tab switching",
      "  const pageStack = []; // Track page history for popup close handling",
      "",
      "  // Set up dialog handling (auto-accept alerts/confirms for downloads)",
      "  page.on('dialog', async (dialog) => {",
      "    console.log(`🔔 Dialog detected: ${dialog.type()} - \"${dialog.message()}\"`);",
      "    await dialog.accept();",
      "    console.log('✅ Dialog accepted');",
      "  });",
      "",
      "  try {"
    ];

    let lastTimestamp = 0;

    // Pre-scan for downloads to identify which actions trigger them
    const downloadTriggerIndices = new Set<number>();
    for (let i = 0; i < this.actions.length; i++) {
      if (this.actions[i].type === 'download' && this.actions[i].selector === 'download-wait') {
        // Find the most recent click/action before this download
        for (let j = i - 1; j >= 0; j--) {
          if (this.actions[j].type === 'click') {
            downloadTriggerIndices.add(j);
            break;
          }
        }
      }
    }

    // Pre-scan for new tabs to identify which actions trigger them
    const newTabTriggerIndices = new Set<number>();
    for (let i = 0; i < this.actions.length; i++) {
      if (this.actions[i].type === 'newTab') {
        // Find the most recent click before this new tab
        for (let j = i - 1; j >= 0; j--) {
          if (this.actions[j].type === 'click') {
            newTabTriggerIndices.add(j);
            break;
          }
        }
      }
    }

    // Pre-scan for file uploads to identify which clicks should be skipped
    const fileUploadClickIndices = new Set<number>();
    for (let i = 0; i < this.actions.length; i++) {
      if (this.actions[i].type === 'fileUpload') {
        // Find the most recent click before this file upload
        // That click triggered the file chooser, so we'll handle it in the fileUpload block
        for (let j = i - 1; j >= 0; j--) {
          if (this.actions[j].type === 'click') {
            fileUploadClickIndices.add(j);
            break;
          }
        }
      }
    }

    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];

      // Add delay if needed (but not after navigation)
      const delay = action.timestamp - lastTimestamp;
      if (delay > 1000 && lastTimestamp > 0 && action.type !== 'navigate') {
        // Apply wait time multiplier and max delay settings
        const adjustedDelay = Math.floor(delay * this.waitSettings.multiplier);
        const finalDelay = Math.min(adjustedDelay, this.waitSettings.maxDelay);
        lines.push(`    await page.waitForTimeout(${finalDelay}); // Human-like delay (${this.waitSettings.multiplier}x multiplier)`);
      }
      lastTimestamp = action.timestamp;

      switch (action.type) {
        case 'navigate':
          lines.push(`    await page.goto('${action.url}');`);
          break;
        case 'click':
          // Skip clicks that trigger file uploads (they'll be handled in the fileUpload block)
          if (fileUploadClickIndices.has(i)) {
            break; // Don't generate code for this click
          }

          // If this click triggers a download, set up the promise first
          if (downloadTriggerIndices.has(i)) {
            lines.push(`    // Setting up download handler before clicking`);
            lines.push(`    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });`);
          }

          // If this click triggers a new tab, set up the page promise first
          if (newTabTriggerIndices.has(i)) {
            lines.push(`    // Setting up new page/tab handler before clicking`);
            lines.push(`    const newPagePromise = context.waitForEvent('page');`);
          }

          if (action.coordinates) {
            // Use coordinate-based click
            console.log(`📍 Generating coordinate click: X=${action.coordinates.x}, Y=${action.coordinates.y}`);
            if (action.frameSelector) {
              lines.push(`    // Click at coordinates inside iframe`);
              lines.push(`    {`);
              lines.push(`      const frame = page.frameLocator('${action.frameSelector}');`);
              lines.push(`      await frame.locator('body').evaluate((body, coords) => {`);
              lines.push(`        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: coords.x, clientY: coords.y });`);
              lines.push(`        document.elementFromPoint(coords.x, coords.y)?.dispatchEvent(clickEvent);`);
              lines.push(`      }, { x: ${action.coordinates.x}, y: ${action.coordinates.y} });`);
              lines.push(`    }`);
            } else {
              lines.push(`    await page.mouse.click(${action.coordinates.x}, ${action.coordinates.y}); // Click at coordinates`);
            }
          } else {
            // Use the generated selector which should be more specific
            console.log(`🎯 Generating selector click: ${action.selector}`);

            // Generate robust click with XPath fallback
            if (action.xpath) {
              lines.push(`    // Try CSS selector first, fallback to XPath if it fails`);
              lines.push(`    try {`);
              if (action.frameSelector) {
                lines.push(`      await page.frameLocator('${action.frameSelector}').locator('${action.selector}').click({ timeout: 10000 }); // Click in iframe`);
              } else {
                lines.push(`      await page.locator('${action.selector}').click({ timeout: 10000 });`);
              }
              lines.push(`    } catch (error) {`);
              lines.push(`      console.log('⚠️ CSS selector failed, trying XPath fallback...');`);
              if (action.frameSelector) {
                lines.push(`      await page.frameLocator('${action.frameSelector}').locator('xpath=${action.xpath}').click(); // XPath fallback in iframe`);
              } else {
                lines.push(`      await page.locator('xpath=${action.xpath}').click(); // XPath fallback`);
              }
              lines.push(`    }`);
            } else {
              // No XPath available, use regular click
              if (action.frameSelector) {
                lines.push(`    await page.frameLocator('${action.frameSelector}').locator('${action.selector}').click(); // Click in iframe`);
              } else {
                lines.push(`    await page.locator('${action.selector}').click();`);
              }
            }
          }
          break;
        case 'clickUntilGone':
          lines.push(`    // Click Until Gone: Click repeatedly until element disappears/hidden/disabled`);
          lines.push(`    {`);
          lines.push(`      const selector = '${action.selector}';`);
          lines.push(`      const maxIterations = ${action.maxIterations || 100};`);
          lines.push(`      const waitBetweenClicks = ${action.waitBetweenClicks || 3000}; // 3 seconds for slower computers/loading`);
          lines.push(`      let iteration = 0;`);
          lines.push(``);
          lines.push(`      while (iteration < maxIterations) {`);
          lines.push(`        try {`);
          lines.push(`          // Check if element still exists and is visible/enabled`);
          lines.push(`          const element = await page.locator(selector).first();`);
          lines.push(`          const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);`);
          lines.push(`          const isEnabled = await element.isEnabled().catch(() => false);`);
          lines.push(``);
          lines.push(`          // If element is gone, hidden, or disabled, stop clicking`);
          lines.push(`          if (!isVisible || !isEnabled) {`);
          lines.push(`            console.log(\`✓ Element is no longer clickable after \${iteration} clicks\`);`);
          lines.push(`            break;`);
          lines.push(`          }`);
          lines.push(``);
          lines.push(`          // Click the element`);
          lines.push(`          await element.click();`);
          lines.push(`          console.log(\`Clicked element (iteration \${iteration + 1})\`);`);
          lines.push(`          iteration++;`);
          lines.push(``);
          lines.push(`          // Wait before next click (allows time for loading/processing)`);
          lines.push(`          await page.waitForTimeout(waitBetweenClicks);`);
          lines.push(`        } catch (error) {`);
          lines.push(`          console.log(\`Element no longer found or clickable after \${iteration} clicks\`);`);
          lines.push(`          break;`);
          lines.push(`        }`);
          lines.push(`      }`);
          lines.push(``);
          lines.push(`      if (iteration >= maxIterations) {`);
          lines.push(`        console.warn('⚠ Reached maximum iterations without element disappearing');`);
          lines.push(`      }`);
          lines.push(`    }`);
          break;
        case 'download':
          // Handle download events
          if (action.selector === 'download-complete') {
            const filename = action.value?.replace('Download completed: ', '') || 'file';
            lines.push(`    // Wait for download to complete`);
            lines.push(`    try {`);
            lines.push(`      const download = await downloadPromise;`);
            lines.push(`      const downloadPath = path.join(downloadsPath, download.suggestedFilename());`);
            lines.push(`      await download.saveAs(downloadPath);`);
            lines.push(`      console.log('✅ Download completed:', downloadPath);`);
            lines.push(`    } catch (error) {`);
            lines.push(`      console.error('⚠️ Download wait timed out or failed:', error.message);`);
            lines.push(`      throw error; // Re-throw to fail the test if download fails`);
            lines.push(`    }`);
          }
          // Skip download-wait as it's just informational now
          break;
        case 'fileUpload':
          lines.push(`    // File Upload`);
          if (action.isChainedFile && action.fileName) {
            // For chained files, just click - listener is already set up on the page
            lines.push(`    {`);
            lines.push(`      // Upload file from previous chain step (listener already set up)`);
            lines.push(`      console.log('📤 Uploading file from chain: ${action.fileName}');`);
            if (action.xpath) {
              lines.push(`      // Try CSS selector first, fallback to XPath if it fails`);
              lines.push(`      try {`);
              lines.push(`        await page.locator('${action.selector}').click({ timeout: 10000 });`);
              lines.push(`      } catch (error) {`);
              lines.push(`        console.log('⚠️ CSS selector failed, trying XPath fallback...');`);
              lines.push(`        await page.locator('xpath=${action.xpath}').click();`);
              lines.push(`      }`);
            } else {
              lines.push(`      await page.locator('${action.selector}').click();`);
            }
            lines.push(`      await page.waitForTimeout(1000);`);
            lines.push(`    }`);
          } else {
            // For manual file uploads, add a comment explaining user needs to handle this
            lines.push(`    {`);
            lines.push(`      // Manual file upload - you'll need to specify the file path`);
            lines.push(`      // Replace '/path/to/your/file' with the actual file path`);
            lines.push(`      const uploadFilePath = '/path/to/your/file'; // TODO: Update this path`);
            lines.push(`      console.log('📤 Uploading file:', uploadFilePath);`);
            lines.push(`      `);
            lines.push(`      // Set up file chooser listener BEFORE clicking`);
            lines.push(`      let fileChooserHandled = false;`);
            lines.push(`      const fileChooserHandler = async (fileChooser) => {`);
            lines.push(`        if (!fileChooserHandled) {`);
            lines.push(`          fileChooserHandled = true;`);
            lines.push(`          console.log('🔍 File chooser intercepted');`);
            lines.push(`          await fileChooser.setFiles(uploadFilePath);`);
            lines.push(`          console.log('✅ File uploaded');`);
            lines.push(`        }`);
            lines.push(`      };`);
            lines.push(`      page.once('filechooser', fileChooserHandler);`);
            lines.push(`      `);
            if (action.xpath) {
              lines.push(`      // Try CSS selector first, fallback to XPath if it fails`);
              lines.push(`      try {`);
              lines.push(`        await page.locator('${action.selector}').click({ timeout: 10000 });`);
              lines.push(`      } catch (error) {`);
              lines.push(`        console.log('⚠️ CSS selector failed, trying XPath fallback...');`);
              lines.push(`        await page.locator('xpath=${action.xpath}').click();`);
              lines.push(`      }`);
            } else {
              lines.push(`      await page.locator('${action.selector}').click();`);
            }
            lines.push(`      `);
            lines.push(`      // Wait for file chooser to be handled`);
            lines.push(`      await page.waitForTimeout(1000);`);
            lines.push(`    }`);
          }
          break;
        case 'fill':
          // Escape single quotes in value
          const escapedValue = action.value?.replace(/'/g, "\\'") || '';
          if (action.frameSelector) {
            lines.push(`    await page.frameLocator('${action.frameSelector}').locator('${action.selector}').fill('${escapedValue}'); // Fill in iframe`);
          } else {
            lines.push(`    await page.fill('${action.selector}', '${escapedValue}');`);
          }
          break;
        case 'keypress':
          if (action.key === 'Enter') {
            lines.push(`    await page.keyboard.press('Enter'); // Submit form`);
          } else {
            lines.push(`    await page.keyboard.press('${action.key}');`);
          }
          break;
        case 'waitForElement':
          const condition = action.waitCondition || 'visible';
          const timeout = action.timeout || 5000;
          
          // Generate appropriate wait command based on condition
          switch (condition) {
            case 'visible':
              lines.push(`    await page.waitForSelector('${action.selector}', { state: 'visible', timeout: ${timeout} });`);
              break;
            case 'hidden':
              lines.push(`    await page.waitForSelector('${action.selector}', { state: 'hidden', timeout: ${timeout} });`);
              break;
            case 'enabled':
              lines.push(`    await page.waitForFunction(() => !document.querySelector('${action.selector}')?.disabled, {}, { timeout: ${timeout} });`);
              break;
            case 'disabled':
              lines.push(`    await page.waitForFunction(() => document.querySelector('${action.selector}')?.disabled, {}, { timeout: ${timeout} });`);
              break;
          }
          break;
        case 'datePickerGroup':
          // Determine which components are present
          const hasYear = !!action.dateComponents?.year;
          const hasMonth = !!action.dateComponents?.month;
          const hasDay = !!action.dateComponents?.day;
          const markedComponents = [hasYear && 'year', hasMonth && 'month', hasDay && 'day'].filter(Boolean).join(', ');

          // Add comment explaining dynamic date
          const offsetText = action.dateOffset === 0 ? 'today' :
                           action.dateOffset! > 0 ? `today + ${action.dateOffset} days` :
                           `today - ${Math.abs(action.dateOffset!)} days`;
          lines.push(`    // Date picker (${markedComponents}): ${offsetText}`);
          lines.push(`    const targetDate = new Date();`);

          if (action.dateOffset && action.dateOffset !== 0) {
            lines.push(`    targetDate.setDate(targetDate.getDate() + ${action.dateOffset});`);
          }

          // Only declare variables for components that exist
          if (hasYear) {
            lines.push(`    const year = targetDate.getFullYear().toString();`);
          }
          if (hasMonth) {
            lines.push(`    const month = (targetDate.getMonth() + 1).toString(); // 1-12`);
          }
          if (hasDay) {
            lines.push(`    const day = targetDate.getDate().toString();`);
          }
          lines.push(``);

          // Select year (only if present)
          if (hasYear) {
            const yearType = action.dateComponents!.year.elementType;
            const yearSelector = action.dateComponents!.year.selector;
            const yearDropdownSelector = action.dateComponents!.year.dropdownSelector;

            if (yearType === 'select') {
              lines.push(`    await page.selectOption('${yearSelector}', year);`);
            } else if (yearType === 'input') {
              lines.push(`    await page.locator('${yearSelector}').fill(year);`);
            } else {
              if (yearSelector.includes(':has-text')) {
                const baseYearSelector = yearSelector.split(':has-text')[0];
                lines.push(`    await page.locator('${baseYearSelector}').filter({ hasText: year }).click();`);
              } else {
                lines.push(`    await page.locator('${yearSelector}').click(); // Open year dropdown`);
                if (yearDropdownSelector) {
                  lines.push(`    await page.locator('${yearDropdownSelector} a, ${yearDropdownSelector} button, ${yearDropdownSelector} div, ${yearDropdownSelector} li').filter({ hasText: year }).first().click();`);
                } else {
                  lines.push(`    await page.locator('a, button, div, li').filter({ hasText: year }).first().click();`);
                }
              }
            }
            if (i < this.actions.length - 1) {
              const waitTime = Math.min(1200, this.waitSettings.maxDelay);
              lines.push(`    await page.waitForTimeout(${waitTime}); // Human-like delay`);
            }
            lines.push(``);
          }

          // Select month (only if present)
          if (hasMonth) {
            const monthType = action.dateComponents!.month.elementType;
            const monthSelector = action.dateComponents!.month.selector;
            const monthDropdownSelector = action.dateComponents!.month.dropdownSelector;

            if (monthType === 'select') {
              lines.push(`    await page.selectOption('${monthSelector}', month);`);
            } else if (monthType === 'input') {
              lines.push(`    await page.locator('${monthSelector}').fill(month);`);
            } else {
              if (monthSelector.includes(':has-text')) {
                const baseMonthSelector = monthSelector.split(':has-text')[0];
                lines.push(`    await page.locator('${baseMonthSelector}').filter({ hasText: month }).click();`);
              } else {
                lines.push(`    await page.locator('${monthSelector}').click(); // Open month dropdown`);
                if (monthDropdownSelector) {
                  lines.push(`    await page.locator('${monthDropdownSelector} a, ${monthDropdownSelector} button, ${monthDropdownSelector} div, ${monthDropdownSelector} li').filter({ hasText: month }).first().click();`);
                } else {
                  lines.push(`    await page.locator('a, button, div, li').filter({ hasText: month }).first().click();`);
                }
              }
            }
            if (i < this.actions.length - 1) {
              const waitTime = Math.min(800, this.waitSettings.maxDelay);
              lines.push(`    await page.waitForTimeout(${waitTime}); // Human-like delay`);
            }
            lines.push(``);
          }

          // Select day (only if present)
          if (hasDay) {
            const dayType = action.dateComponents!.day.elementType;
            const daySelector = action.dateComponents!.day.selector;
            const dayDropdownSelector = action.dateComponents!.day.dropdownSelector;

            if (dayType === 'select') {
              lines.push(`    await page.selectOption('${daySelector}', day);`);
            } else if (dayType === 'input') {
              lines.push(`    await page.locator('${daySelector}').fill(day);`);
            } else {
              if (daySelector.includes(':has-text')) {
                const baseDaySelector = daySelector.split(':has-text')[0];
                lines.push(`    await page.locator('${baseDaySelector}').filter({ hasText: day }).click();`);
              } else {
                lines.push(`    await page.locator('${daySelector}').click(); // Open day dropdown`);
                if (dayDropdownSelector) {
                  lines.push(`    await page.locator('${dayDropdownSelector} a, ${dayDropdownSelector} button, ${dayDropdownSelector} div, ${dayDropdownSelector} li').filter({ hasText: day }).first().click();`);
                } else {
                  lines.push(`    await page.locator('a, button, div, li').filter({ hasText: day }).first().click();`);
                }
              }
            }
          }
          break;
        case 'captureTable':
          if (action.tables && action.tables.length > 0) {
            lines.push(`    // ========================================`);
            lines.push(`    // TABLE CAPTURE - ${action.tables.length} table(s) found`);
            lines.push(`    // ========================================`);
            lines.push(``);

            action.tables.forEach((table, index) => {
              lines.push(`    // Table ${index + 1}:`);
              lines.push(`    //   XPath: ${table.xpath}`);
              lines.push(`    //   CSS Selector: ${table.cssSelector}`);
              lines.push(`    //   Row Count: ${table.rowCount}`);

              if (table.headers && table.headers.length > 0) {
                lines.push(`    //   Headers: [${table.headers.map((h: string) => `"${h}"`).join(', ')}]`);
              }

              if (table.sampleRow && table.sampleRow.length > 0) {
                lines.push(`    //   Sample Row: [${table.sampleRow.map((cell: string) => `"${cell}"`).join(', ')}]`);
              }

              lines.push(`    // Schema:`);
              if (table.headers && table.headers.length > 0) {
                table.headers.forEach((header: string, colIndex: number) => {
                  const sampleValue = table.sampleRow && table.sampleRow[colIndex] ?
                    table.sampleRow[colIndex] :
                    '(no data)';
                  lines.push(`    //   Column ${colIndex + 1}: "${header}" - Example: "${sampleValue}"`);
                });
              }

              lines.push(``);
            });
          }
          break;
        case 'newTab':
          lines.push(`    // New tab/popup detected during recording`);
          if (action.newTabUrl) {
            lines.push(`    // Expected URL: ${action.newTabUrl}`);
          }
          lines.push(`    {`);
          lines.push(`      // Wait for the new page that was opened by previous click`);
          lines.push(`      const newPage = await newPagePromise;`);
          lines.push(`      await newPage.waitForLoadState('domcontentloaded');`);
          lines.push(`      console.log('✓ New page opened:', newPage.url());`);
          lines.push(`      `);
          lines.push(`      // Wait for page to fully load`);
          lines.push(`      await newPage.waitForLoadState('networkidle').catch(() => {});`);
          lines.push(`      await newPage.waitForTimeout(2000); // Additional wait for dynamic content`);
          lines.push(`      `);
          lines.push(`      // Push current page to stack before switching`);
          lines.push(`      pageStack.push(page);`);
          lines.push(`      console.log('📚 Pushed page to stack, stack size:', pageStack.length);`);
          lines.push(`      `);
          lines.push(`      // Switch to new page for subsequent actions`);
          lines.push(`      page = newPage; // All following actions will use this new tab`);
          lines.push(`      console.log('✓ Switched to new tab:', newPage.url());`);
          lines.push(`      `);
          lines.push(`      // Set up dialog handling for new page`);
          lines.push(`      page.on('dialog', async (dialog) => {`);
          lines.push(`        console.log(\`🔔 Dialog detected: \${dialog.type()} - "\${dialog.message()}"\`);`);
          lines.push(`        await dialog.accept();`);
          lines.push(`        console.log('✅ Dialog accepted');`);
          lines.push(`      });`);

          // Check if there are any chained file uploads in remaining actions
          const chainedFileUploadAction = this.actions.slice(i + 1).find(a =>
            a.type === 'fileUpload' && a.isChainedFile
          );

          if (chainedFileUploadAction && chainedFileUploadAction.filePath) {
            lines.push(`      `);
            lines.push(`      // Set up file chooser listener for chain mode`);
            lines.push(`      // IMPORTANT: Listener must be set up when page loads, not when clicking`);
            lines.push(`      const uploadFilePath = '${chainedFileUploadAction.filePath}';`);
            lines.push(`      page.on('filechooser', async (fileChooser) => {`);
            lines.push(`        console.log('🔍 File chooser intercepted, uploading:', uploadFilePath);`);
            lines.push(`        await fileChooser.setFiles(uploadFilePath);`);
            lines.push(`        console.log('✅ File uploaded successfully');`);
            lines.push(`      });`);
            lines.push(`      console.log('✅ File chooser listener registered for new page');`);
          }

          lines.push(`    }`);
          break;
        case 'closeTab':
          lines.push(`    // Popup/tab was closed during recording`);
          if (action.closedTabUrl) {
            lines.push(`    // Closed tab URL: ${action.closedTabUrl}`);
          }
          lines.push(`    {`);
          lines.push(`      // Wait for current page to close`);
          lines.push(`      await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});`);
          lines.push(`      `);
          lines.push(`      // Switch back to previous page`);
          lines.push(`      const previousPage = pageStack.pop();`);
          lines.push(`      if (previousPage) {`);
          lines.push(`        page = previousPage;`);
          lines.push(`        console.log('⬅️ Switched back to previous page:', page.url());`);
          lines.push(`        console.log('📚 Stack size:', pageStack.length);`);
          lines.push(`      } else {`);
          lines.push(`        console.warn('⚠️ No previous page in stack, using first available page');`);
          lines.push(`        const allPages = context.pages();`);
          lines.push(`        page = allPages[0];`);
          lines.push(`      }`);
          lines.push(`    }`);
          break;
        case 'print':
          lines.push(`    // Print dialog triggered`);
          lines.push(`    await page.waitForTimeout(1000); // Wait for print dialog to appear`);
          lines.push(``);
          lines.push(`    // Handle native print dialog with OS-level automation`);
          lines.push(`    // Note: Requires @nut-tree-fork/nut-js package installed`);
          lines.push(`    const { keyboard, Key } = require('@nut-tree-fork/nut-js');`);
          lines.push(`    await keyboard.type(Key.Enter); // Press Enter to confirm print`);
          lines.push(``);
          lines.push(`    // Alternative: Generate PDF without print dialog`);
          lines.push(`    // await page.pdf({ path: 'output.pdf', format: 'A4', printBackground: true });`);
          break;
      }
    }

    lines.push("  } finally {");
    lines.push("    await context.close();");
    lines.push("    // Clean up profile directory");
    lines.push("    try {");
    lines.push("      fs.rmSync(profileDir, { recursive: true, force: true });");
    lines.push("    } catch (e) {");
    lines.push("      console.warn('Failed to clean up profile directory:', e);");
    lines.push("    }");
    lines.push("    // Clean up temporary extensions directory");
    lines.push("    if (tempExtensionsDir) {");
    lines.push("      try {");
    lines.push("        fs.rmSync(tempExtensionsDir, { recursive: true, force: true });");
    lines.push("        console.log('🧹 Cleaned up extensions directory');");
    lines.push("      } catch (e) {");
    lines.push("        console.warn('Failed to clean up extensions directory:', e);");
    lines.push("      }");
    lines.push("    }");
    lines.push("  }");
    lines.push("})().catch(console.error);");
    
    return lines.join('\n');
  }

  getActions(): RecordedAction[] {
    return this.actions;
  }

  /**
   * Set actions array (used for view mode execution)
   */
  setActions(actions: RecordedAction[]): void {
    this.actions = actions;
    this.startTime = Date.now();
  }

  /**
   * Get the output file path
   */
  getOutputFile(): string {
    return this.outputFile;
  }

  /**
   * Reconnect to an existing browser context (for resume recording)
   */
  reconnectToContext(context: BrowserContext, page: Page): void {
    this.context = context;
    this.page = page;
    this.browser = context.browser();
    this.isRecording = false; // Not recording yet, just connected
  }

  /**
   * Start recording from a reconnected state
   */
  async startRecording(): Promise<void> {
    this.isRecording = true;

    if (!this.page) {
      console.error('❌ No page available for recording');
      return;
    }

    // Set up page listeners
    await this.setupPageListeners(this.page);

    // Inject keyboard listener
    await this.injectKeyboardListener();

    // Inject controller UI
    await this.injectControllerUI();

    // Start controller check
    this.startControllerCheck();

    console.log('▶️ Recording started from reconnected state');
  }

  /**
   * Generate test code up to a specific action index
   * Used for "Play to Here" feature - executes partial test and keeps browser open
   */
  generateTestCodeUpToAction(upToIndex: number): string {
    // Validate index
    if (upToIndex < 0 || upToIndex >= this.actions.length) {
      throw new Error(`Invalid action index: ${upToIndex}. Valid range: 0-${this.actions.length - 1}`);
    }

    console.log(`📝 Generating partial test code for actions 0-${upToIndex} (${upToIndex + 1} actions)`);

    // Get screen dimensions (same as recording)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const browserWidth = Math.floor(width * 0.6);
    const browserHeight = height;
    const browserX = width - browserWidth;
    const browserY = 0;

    // Use partial actions only
    const partialActions = this.actions.slice(0, upToIndex + 1);

    const lines: string[] = [
      "/**",
      " * PARTIAL EXECUTION - Play to Action",
      ` * Executing actions 0 to ${upToIndex} (total: ${upToIndex + 1} of ${this.actions.length} actions)`,
      ` * Browser will remain open for inspection`,
      " * RECORDED_ACTIONS:",
      ` * ${JSON.stringify(partialActions)}`,
      " */",
      "",
      "const { chromium } = require('playwright-core');",
      "const path = require('path');",
      "const os = require('os');",
      "const fs = require('fs');",
      "",
      "(async () => {",
      `  console.log('🎬 Starting PARTIAL test execution (actions 0-${upToIndex})...');`,
      "  ",
      "  // Create downloads directory in system Downloads folder (grouped under EGDesk-Browser)",
      `  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', '${this.scriptName}');`,
      "  if (!fs.existsSync(downloadsPath)) {",
      "    fs.mkdirSync(downloadsPath, { recursive: true });",
      "  }",
      "  console.log('📥 Downloads will be saved to:', downloadsPath);",
      "",
      "  // Create temporary profile directory",
      "  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));",
      "  console.log('📁 Using profile directory:', profileDir);",
      "",
      "  // Launch browser with persistent context",
      "  const context = await chromium.launchPersistentContext(profileDir, {",
      "    headless: false,",
      "    channel: 'chrome',",
      `    viewport: { width: ${browserWidth}, height: ${browserHeight} },`,
      "    acceptDownloads: true,",
      "    downloadsPath: downloadsPath,",
      "    args: [",
      "      '--no-default-browser-check',",
      "      '--disable-blink-features=AutomationControlled',",
      `      '--window-position=${browserX},${browserY}',`,
      "    ]",
      "  });",
      "",
      "  let page = context.pages()[0] || await context.newPage();",
      "  ",
      "  // Set up dialog handling",
      "  page.on('dialog', async (dialog) => {",
      "    console.log(`🔔 Dialog detected: ${dialog.type()} - \"${dialog.message()}\"`);",
      "    await dialog.accept();",
      "    console.log('✅ Dialog accepted');",
      "  });",
      "",
      "  // Page stack for multi-tab handling",
      "  const pageStack = [];",
      "",
      "  try {"
    ];

    // Generate code for each action (using the same logic as generateTestCode)
    for (let i = 0; i < partialActions.length; i++) {
      const action = partialActions[i];
      const relativeTime = action.timestamp;

      // Calculate wait time with multiplier
      let waitTime = relativeTime;
      if (i > 0) {
        const prevAction = partialActions[i - 1];
        waitTime = relativeTime - prevAction.timestamp;
      }

      const adjustedWait = Math.min(
        Math.round(waitTime * this.waitSettings.multiplier),
        this.waitSettings.maxDelay
      );

      if (i > 0 && adjustedWait > 0) {
        lines.push(`    await page.waitForTimeout(${adjustedWait});`);
      }

      lines.push(`    console.log('▶️ Action ${i + 1}/${partialActions.length}: ${action.type}');`);

      // Generate action-specific code (copy from generateTestCode logic)
      switch (action.type) {
        case 'navigate':
          lines.push(`    await page.goto('${action.url}');`);
          lines.push(`    console.log('✓ Navigated to:', '${action.url}');`);
          break;

        case 'click':
          if (action.coordinates && this.isCoordinateModeEnabled) {
            lines.push(`    await page.mouse.click(${action.coordinates.x}, ${action.coordinates.y});`);
            lines.push(`    console.log('✓ Clicked at coordinates: (${action.coordinates.x}, ${action.coordinates.y})');`);
          } else {
            const clickSelector = action.xpath || action.selector;
            if (action.frameSelector) {
              lines.push(`    {`);
              lines.push(`      const frame = page.frameLocator('${action.frameSelector}');`);
              lines.push(`      await frame.locator('${clickSelector}').click();`);
              lines.push(`      console.log('✓ Clicked in iframe: ${action.frameSelector}');`);
              lines.push(`    }`);
            } else {
              lines.push(`    await page.locator('${clickSelector}').click();`);
              lines.push(`    console.log('✓ Clicked: ${clickSelector}');`);
            }
          }
          break;

        case 'fill':
          const fillSelector = action.xpath || action.selector;
          const escapedValue = (action.value || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
          if (action.frameSelector) {
            lines.push(`    {`);
            lines.push(`      const frame = page.frameLocator('${action.frameSelector}');`);
            lines.push(`      await frame.locator('${fillSelector}').fill('${escapedValue}');`);
            lines.push(`      console.log('✓ Filled in iframe: ${action.frameSelector}');`);
            lines.push(`    }`);
          } else {
            lines.push(`    await page.locator('${fillSelector}').fill('${escapedValue}');`);
            lines.push(`    console.log('✓ Filled: ${fillSelector} = "${escapedValue}"');`);
          }
          break;

        case 'keypress':
          if (action.key === 'Enter') {
            lines.push(`    await page.keyboard.press('Enter');`);
            lines.push(`    console.log('✓ Pressed: Enter');`);
          } else if (action.key) {
            lines.push(`    await page.keyboard.type('${action.key}');`);
            lines.push(`    console.log('✓ Typed: ${action.key}');`);
          }
          break;

        case 'screenshot':
          lines.push(`    await page.screenshot({ path: 'screenshot-${i}.png', fullPage: true });`);
          lines.push(`    console.log('✓ Screenshot saved: screenshot-${i}.png');`);
          break;

        case 'waitForElement':
          const waitSelector = action.xpath || action.selector;
          const condition = action.waitCondition || 'visible';
          const timeout = action.timeout || 30000;
          lines.push(`    await page.locator('${waitSelector}').waitFor({ state: '${condition}', timeout: ${timeout} });`);
          lines.push(`    console.log('✓ Waited for element: ${waitSelector} (${condition})');`);
          break;

        case 'download':
          lines.push(`    {`);
          lines.push(`      const downloadPromise = page.waitForEvent('download');`);
          if (action.xpath || action.selector) {
            const dlSelector = action.xpath || action.selector;
            lines.push(`      await page.locator('${dlSelector}').click();`);
          }
          lines.push(`      const download = await downloadPromise;`);
          lines.push(`      const suggestedFilename = download.suggestedFilename();`);
          lines.push(`      const filePath = path.join(downloadsPath, suggestedFilename);`);
          lines.push(`      await download.saveAs(filePath);`);
          lines.push(`      console.log('✓ Downloaded:', suggestedFilename, 'to', filePath);`);
          lines.push(`    }`);
          break;

        case 'fileUpload':
          lines.push(`    {`);
          if (action.isChainedFile && action.fileName) {
            // For chained files, just click - listener is already set up on the page
            lines.push(`      // Upload file from previous chain step (listener already set up)`);
            lines.push(`      console.log('📤 Uploading file from chain: ${action.fileName}');`);
            const uploadSelector = action.xpath || action.selector;
            lines.push(`      await page.locator('${uploadSelector}').click();`);
            lines.push(`      await page.waitForTimeout(1000);`);
          } else {
            // For manual file uploads, set up one-time listener
            lines.push(`      // Manual file upload - specify the file path`);
            lines.push(`      const uploadFilePath = '/path/to/your/file'; // TODO: Update this path`);
            lines.push(`      console.log('📤 Uploading file:', uploadFilePath);`);
            lines.push(`      `);
            lines.push(`      let fileChooserHandled = false;`);
            lines.push(`      const fileChooserHandler = async (fileChooser) => {`);
            lines.push(`        if (!fileChooserHandled) {`);
            lines.push(`          fileChooserHandled = true;`);
            lines.push(`          console.log('🔍 File chooser intercepted');`);
            lines.push(`          await fileChooser.setFiles(uploadFilePath);`);
            lines.push(`          console.log('✓ File uploaded:', uploadFilePath);`);
            lines.push(`        }`);
            lines.push(`      };`);
            lines.push(`      page.once('filechooser', fileChooserHandler);`);
            const uploadSelector2 = action.xpath || action.selector;
            lines.push(`      await page.locator('${uploadSelector2}').click();`);
            lines.push(`      await page.waitForTimeout(1000);`);
          }
          lines.push(`    }`);
          break;

        case 'datePickerGroup':
          if (action.dateComponents) {
            lines.push(`    {`);
            lines.push(`      // Date Picker Group - Calculate date from offset`);
            lines.push(`      const dateOffset = ${action.dateOffset || 0}; // Days from today`);
            lines.push(`      const targetDate = new Date();`);
            lines.push(`      targetDate.setDate(targetDate.getDate() + dateOffset);`);
            lines.push(`      const year = targetDate.getFullYear().toString();`);
            lines.push(`      const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');`);
            lines.push(`      const day = targetDate.getDate().toString().padStart(2, '0');`);
            lines.push(`      console.log(\`📅 Target date (offset \${dateOffset}): \${year}-\${month}-\${day}\`);`);
            lines.push(``);

            // Generate code for each date component
            ['year', 'month', 'day'].forEach(component => {
              const comp = action.dateComponents![component as 'year' | 'month' | 'day'];
              if (comp) {
                const value = component === 'year' ? 'year' : component === 'month' ? 'month' : 'day';
                lines.push(`      // ${component.charAt(0).toUpperCase() + component.slice(1)}`);

                if (comp.elementType === 'select') {
                  lines.push(`      await page.locator('${comp.selector}').selectOption(\${${value}});`);
                  lines.push(`      console.log('✓ Selected ${component}:', ${value});`);
                } else if (comp.elementType === 'button' && comp.dropdownSelector) {
                  lines.push(`      await page.locator('${comp.selector}').click();`);
                  lines.push(`      await page.waitForTimeout(500);`);
                  lines.push(`      await page.locator('${comp.dropdownSelector}').locator(\`text="\${${value}}"\`).first().click();`);
                  lines.push(`      console.log('✓ Selected ${component}:', ${value});`);
                } else if (comp.elementType === 'input') {
                  lines.push(`      await page.locator('${comp.selector}').fill(\${${value}});`);
                  lines.push(`      console.log('✓ Filled ${component}:', ${value});`);
                }
              }
            });

            lines.push(`    }`);
          }
          break;

        case 'captureTable':
          lines.push(`    // Table capture recorded (${action.tables?.length || 0} tables)`);
          lines.push(`    console.log('✓ Table capture action (skipped in replay)');`);
          break;

        case 'newTab':
          lines.push(`    {`);
          lines.push(`      // Wait for new tab to open`);
          lines.push(`      const newPagePromise = context.waitForEvent('page');`);
          lines.push(`      // Trigger action that opens new tab would go here`);
          lines.push(`      const newPage = await newPagePromise;`);
          lines.push(`      await newPage.waitForLoadState();`);
          lines.push(`      console.log('✓ New tab opened:', newPage.url());`);
          lines.push(`      `);
          lines.push(`      // Set up dialog handling for new page`);
          lines.push(`      newPage.on('dialog', async (dialog) => {`);
          lines.push(`        console.log(\`🔔 Dialog detected: \${dialog.type()} - "\${dialog.message()}"\`);`);
          lines.push(`        await dialog.accept();`);
          lines.push(`        console.log('✅ Dialog accepted');`);
          lines.push(`      });`);
          lines.push(`      `);
          lines.push(`      // Push current page to stack before switching`);
          lines.push(`      pageStack.push(page);`);
          lines.push(`      console.log('📚 Pushed page to stack, stack size:', pageStack.length);`);
          lines.push(`      `);
          lines.push(`      // Switch to new page for subsequent actions`);
          lines.push(`      page = newPage;`);
          lines.push(`      console.log('✓ Switched to new tab:', newPage.url());`);

          // Check if there are any chained file uploads in remaining actions (alternative path)
          const chainedFileUploadAction2 = this.actions.slice(i + 1).find(a =>
            a.type === 'fileUpload' && a.isChainedFile
          );

          if (chainedFileUploadAction2 && chainedFileUploadAction2.filePath) {
            lines.push(`      `);
            lines.push(`      // Set up file chooser listener for chain mode`);
            lines.push(`      // IMPORTANT: Listener must be set up when page loads, not when clicking`);
            lines.push(`      const uploadFilePath = '${chainedFileUploadAction2.filePath}';`);
            lines.push(`      page.on('filechooser', async (fileChooser) => {`);
            lines.push(`        console.log('🔍 File chooser intercepted, uploading:', uploadFilePath);`);
            lines.push(`        await fileChooser.setFiles(uploadFilePath);`);
            lines.push(`        console.log('✅ File uploaded successfully');`);
            lines.push(`      });`);
            lines.push(`      console.log('✅ File chooser listener registered for new page');`);
          }

          lines.push(`    }`);
          break;

        case 'closeTab':
          lines.push(`    {`);
          lines.push(`      // Popup/tab was closed during recording`);
          if (action.closedTabUrl) {
            lines.push(`      // Closed tab URL: ${action.closedTabUrl}`);
          }
          lines.push(`      await page.waitForEvent('close', { timeout: 5000 }).catch(() => {});`);
          lines.push(`      `);
          lines.push(`      // Switch back to previous page`);
          lines.push(`      const previousPage = pageStack.pop();`);
          lines.push(`      if (previousPage) {`);
          lines.push(`        page = previousPage;`);
          lines.push(`        console.log('⬅️ Switched back to previous page:', page.url());`);
          lines.push(`        console.log('📚 Stack size:', pageStack.length);`);
          lines.push(`      } else {`);
          lines.push(`        console.warn('⚠️ No previous page in stack, using first available page');`);
          lines.push(`        const allPages = context.pages();`);
          lines.push(`        page = allPages[0];`);
          lines.push(`      }`);
          lines.push(`    }`);
          break;

        case 'clickUntilGone':
          const cugSelector = action.xpath || action.selector;
          const maxIter = action.maxIterations || 10;
          const waitBetween = action.waitBetweenClicks || 500;
          lines.push(`    {`);
          lines.push(`      // Click Until Gone - Click element repeatedly until it disappears`);
          lines.push(`      console.log('🔄 Starting Click Until Gone: ${cugSelector}');`);
          lines.push(`      let iterations = 0;`);
          lines.push(`      while (iterations < ${maxIter}) {`);
          lines.push(`        try {`);
          lines.push(`          const element = page.locator('${cugSelector}');`);
          lines.push(`          const isVisible = await element.isVisible();`);
          lines.push(`          `);
          lines.push(`          if (!isVisible) {`);
          lines.push(`            console.log('✅ Element is gone after', iterations, 'iterations');`);
          lines.push(`            break;`);
          lines.push(`          }`);
          lines.push(`          `);
          lines.push(`          await element.click();`);
          lines.push(`          console.log(\`  ↻ Click \${iterations + 1}/${maxIter}\`);`);
          lines.push(`          iterations++;`);
          lines.push(`          `);
          lines.push(`          await page.waitForTimeout(${waitBetween});`);
          lines.push(`        } catch (e) {`);
          lines.push(`          console.log('✅ Element disappeared or became unclickable');`);
          lines.push(`          break;`);
          lines.push(`        }`);
          lines.push(`      }`);
          lines.push(`      `);
          lines.push(`      if (iterations >= ${maxIter}) {`);
          lines.push(`        console.warn('⚠️ Reached maximum iterations (${maxIter})');`);
          lines.push(`      }`);
          lines.push(`    }`);
          break;

        case 'print':
          lines.push(`    // Print dialog triggered`);
          lines.push(`    await page.waitForTimeout(1000);`);
          lines.push(`    const { keyboard, Key } = require('@nut-tree-fork/nut-js');`);
          lines.push(`    await keyboard.type(Key.Enter);`);
          lines.push(`    console.log('✓ Print dialog handled');`);
          break;
      }
    }

    // Finally block - DON'T close context, keep browser open for inspection
    lines.push(`    `);
    lines.push(`    console.log('');`);
    lines.push(`    console.log('⏸️  PAUSED: Executed ${upToIndex + 1} of ${this.actions.length} actions');`);
    lines.push(`    console.log('🔍 Browser will remain open for inspection');`);
    lines.push(`    console.log('');`);
    lines.push(`    console.log('Browser context endpoint:', context.browser()?.wsEndpoint());`);
    lines.push(`    `);
    lines.push(`    // Return context for resume capability`);
    lines.push(`    return {`);
    lines.push(`      context,`);
    lines.push(`      page,`);
    lines.push(`      pausedAt: ${upToIndex}`);
    lines.push(`    };`);
    lines.push(`    `);
    lines.push("  } catch (error) {");
    lines.push("    console.error('❌ Test failed:', error);");
    lines.push("    throw error;");
    lines.push("  }");
    lines.push("})().catch(console.error);");

    return lines.join('\n');
  }

  private updateGeneratedCode(): void {
    console.log('🔄 updateGeneratedCode called, actions count:', this.actions.length);

    try {
      const code = this.generateTestCode();
      console.log('📄 Generated code length:', code.length);

      // Write to file if outputFile is set
      if (this.outputFile) {
        try {
          fs.writeFileSync(this.outputFile, code);
          console.log('💾 Updated test file:', this.outputFile);
        } catch (err) {
          console.error('Failed to write test file:', err);
        }
      }

      // Call update callback if set
      if (this.updateCallback) {
        console.log('🎯 Calling updateCallback');
        this.updateCallback(code);
      } else {
        console.log('⚠️ No updateCallback set');
      }
    } catch (err) {
      console.error('❌ Error generating test code:', err);
    }
  }
}