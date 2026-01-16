import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { screen, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' | 'waitForElement' | 'download' | 'datePickerGroup';
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
  waitCondition?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  timeout?: number;
  timestamp: number;
  coordinates?: { x: number; y: number }; // For coordinate-based clicks
  // Date picker fields
  dateComponents?: {
    year: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  };
  dateOffset?: number; // Days from today (0 = today, 1 = tomorrow, -1 = yesterday)
}

export class PlaywrightRecorder {
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

  // Date marking mode state
  private isDateMarkingMode: boolean = false;
  private dateMarkingStep: 'year' | 'month' | 'day' | null = null;
  private dateMarkingSelectors: {
    year?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    month?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
    day?: { selector: string; elementType: 'select' | 'button' | 'input'; dropdownSelector?: string };
  } = {};
  private dateMarkingOffset: number = 0; // Days from today

  setOutputFile(filePath: string): void {
    this.outputFile = filePath;
  }

  setUpdateCallback(callback: (code: string) => void): void {
    this.updateCallback = callback;
  }

  setWaitSettings(settings: { multiplier: number; maxDelay: number }): void {
    this.waitSettings = settings;
    // Regenerate code with new settings
    this.updateGeneratedCode();
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

    // Create downloads directory in system Downloads folder
    const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
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
      // Use launchPersistentContext for more reliable browser management
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: false,
        channel: 'chrome',
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

    // Set up browser close detection (context close event)
    this.context.on('close', () => {
      console.log('🔌 Browser context closed - user closed the window');
      if (this.isRecording && onBrowserClosed) {
        this.isRecording = false;
        onBrowserClosed();
      }
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
    
    // Add controller UI
    await this.injectControllerUI();
    
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
    
    // Check every 2 seconds if controller exists
    this.controllerCheckInterval = setInterval(async () => {
      if (!this.page || !this.isRecording) return;
      
      try {
        const hasController = await this.page.evaluate(() => {
          return !!document.getElementById('playwright-recorder-controller');
        });
        
        if (!hasController) {
          console.log('🔍 Controller missing, re-injecting...');
          await this.injectControllerUI();
        }
      } catch (err) {
        // Page might be navigating, ignore
      }
    }, 2000);
  }

  private async injectControllerUI(): Promise<void> {
    if (!this.page) return;
    
    await this.page.evaluate(() => {
      // Check if controller already exists
      if (document.getElementById('playwright-recorder-controller')) {
        return;
      }
      
      // Create controller container
      const controller = document.createElement('div');
      controller.id = 'playwright-recorder-controller';
      controller.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 8px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        pointer-events: all;
        cursor: move;
        user-select: none;
      `;
      
      // Create highlight toggle button
      const highlightBtn = document.createElement('button');
      highlightBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>Highlight</span>
      `;
      highlightBtn.style.cssText = `
        background: #333;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
      `;
      
      // Create coordinate mode button
      const coordBtn = document.createElement('button');
      coordBtn.setAttribute('data-coord-mode', 'true');
      coordBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <line x1="1" y1="12" x2="23" y2="12"></line>
          <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
        </svg>
        <span>Coords</span>
      `;
      coordBtn.style.cssText = `
        background: #333;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
      `;
      
      // Create wait for element button
      const waitBtn = document.createElement('button');
      waitBtn.setAttribute('data-wait-mode', 'true');
      waitBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
        <span>Wait</span>
      `;
      waitBtn.style.cssText = `
        background: #2196F3;
        color: #fff;
        border: 1px solid #1976D2;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
      `;

      // Create mark date button
      const markDateBtn = document.createElement('button');
      markDateBtn.setAttribute('data-date-marking-mode', 'false');
      markDateBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Mark Date</span>
      `;
      markDateBtn.style.cssText = `
        background: #9C27B0;
        color: #fff;
        border: 1px solid #7B1FA2;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
      `;

      // Create stop recording button
      const stopBtn = document.createElement('button');
      stopBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" fill="currentColor"></rect>
        </svg>
        <span>Stop</span>
      `;
      stopBtn.style.cssText = `
        background: #ff4444;
        color: #fff;
        border: 1px solid #cc0000;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
        font-weight: 600;
      `;

      // Create Gemini button
      const geminiBtn = document.createElement('button');
      geminiBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>Call Gemini</span>
      `;
      geminiBtn.style.cssText = `
        background: #333;
        color: #fff;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;
        position: relative;
        z-index: 10;
        pointer-events: all;
      `;
      geminiBtn.disabled = true;
      geminiBtn.style.opacity = '0.5';
      
      // Recording indicator
      const recordingIndicator = document.createElement('div');
      recordingIndicator.innerHTML = `
        <span style="
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #ff4444;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 1.5s infinite;
        "></span>
        Recording
      `;
      recordingIndicator.style.cssText = `
        color: #fff;
        display: flex;
        align-items: center;
        padding: 0 12px;
        cursor: inherit;
        pointer-events: none;
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        #playwright-recorder-controller button {
          cursor: pointer !important;
        }
        
        #playwright-recorder-controller button:hover {
          background: #444 !important;
          border-color: #555 !important;
        }
        
        #playwright-recorder-controller button.active {
          background: #4CAF50 !important;
          border-color: #4CAF50 !important;
        }
        
        #playwright-recorder-controller button.active:hover {
          background: #45a049 !important;
          border-color: #45a049 !important;
        }
        
        #playwright-recorder-controller:active {
          cursor: grabbing !important;
        }
      `;
      
      controller.appendChild(recordingIndicator);
      controller.appendChild(highlightBtn);
      controller.appendChild(coordBtn);
      controller.appendChild(waitBtn);
      controller.appendChild(markDateBtn);
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
      
      // Listen for element highlight updates
      document.addEventListener('playwright-recorder-element-highlighted', (e: any) => {
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
        
        if (coordinateMode) {
          coordBtn.style.background = '#4CAF50';
          coordBtn.style.borderColor = '#4CAF50';
          document.body.style.cursor = 'crosshair';
          
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
        const event = new CustomEvent('playwright-recorder-coordinate-toggle', { 
          detail: { enabled: coordinateMode } 
        });
        document.dispatchEvent(event);
      });
      
      highlightBtn.addEventListener('click', () => {
        highlightMode = !highlightMode;
        highlightBtn.classList.toggle('active', highlightMode);
        
        // Trigger highlight mode
        const event = new CustomEvent('playwright-recorder-highlight-toggle', { 
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            <span>Select Element</span>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
          `;
          dateMarkingInstructions.innerHTML = `
            <strong>📅 Date Marking Mode Active</strong><br>
            <div style="margin-top: 8px; font-size: 13px;">
              <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                Step 1/3: Select YEAR dropdown
              </span>
            </div>
            <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
              Click on the dropdown that contains years
            </div>
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
              Moves away when cursor approaches
            </div>
          `;

          try {
            if (document.body) {
              document.body.appendChild(dateMarkingInstructions);
            }
          } catch (e) {
            console.warn('Failed to show date marking instructions:', e);
          }

          // Add proximity detection to hide banner when mouse gets near
          const proximityThreshold = 150; // pixels
          let mouseX = 0;
          let mouseY = 0;

          const checkProximity = () => {
            const rect = dateMarkingInstructions!.getBoundingClientRect();
            const bannerCenterX = rect.left + rect.width / 2;
            const bannerCenterY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
              Math.pow(mouseX - bannerCenterX, 2) +
              Math.pow(mouseY - bannerCenterY, 2)
            );

            if (distance < proximityThreshold) {
              // Mouse is near, hide the banner
              dateMarkingInstructions!.style.opacity = '0.1';
              dateMarkingInstructions!.style.transform = 'scale(0.8)';
            } else {
              // Mouse is far, show the banner
              dateMarkingInstructions!.style.opacity = '1';
              dateMarkingInstructions!.style.transform = 'scale(1)';
            }
          };

          const mouseMoveHandler = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            checkProximity();
          };

          document.addEventListener('mousemove', mouseMoveHandler);

          // Store handler for cleanup
          (dateMarkingInstructions as any).__mouseMoveHandler = mouseMoveHandler;

          document.body.style.cursor = 'help';
        } else {
          // Exit date marking mode
          markDateBtn.style.background = '#9C27B0';
          markDateBtn.style.borderColor = '#7B1FA2';

          // Clear window state
          (window as any).__playwrightRecorderDateMarkingMode = false;
          (window as any).__playwrightRecorderDateMarkingStep = null;
          dateMarkingStep = null;

          // Remove instructions
          if (dateMarkingInstructions) {
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

        dateMarkingInstructions.innerHTML = `
          <strong>📅 Date Marking Mode Active</strong><br>
          <div style="margin-top: 8px; font-size: 13px;">
            <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              Step ${stepNum}/3: Select ${stepLabel} dropdown
            </span>
          </div>
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
            Click on the dropdown that contains ${instruction}
          </div>
          <div style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-style: italic;">
            Moves away when cursor approaches
          </div>
        `;
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
            // Clean up mousemove listener
            const handler = (dateMarkingInstructions as any).__mouseMoveHandler;
            if (handler) {
              document.removeEventListener('mousemove', handler);
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

      // Set up Gemini button functionality
      geminiBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!currentHighlightedElement) {
          console.log('No element highlighted');
          return;
        }
        
        console.log('Call Gemini clicked for element:', currentHighlightedElement);
        
        // Send element info to parent window for code viewer
        if ((window as any).__playwrightRecorderOnGemini) {
          const rect = currentHighlightedElement.getBoundingClientRect();
          const elementInfo = {
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
            }
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
          
          (window as any).__playwrightRecorderOnGemini(elementInfo);
        }
        
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
            
            // Create preview modal
            const modal = document.createElement('div');
            modal.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.8);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 999999;
              cursor: pointer;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
              background: white;
              padding: 20px;
              border-radius: 8px;
              max-width: 80%;
              max-height: 80%;
              overflow: auto;
              position: relative;
            `;
            
            modalContent.innerHTML = `
              <h3 style="margin: 0 0 10px 0; font-family: Arial, sans-serif;">Element Preview (PNG)</h3>
              <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 14px; color: #666;">
                This is what would be sent to Gemini AI for analysis
              </p>
              <img src="${dataUrl}" style="max-width: 100%; height: auto; border: 1px solid #ddd;" />
              <div style="margin-top: 10px; font-family: monospace; font-size: 12px; background: #f0f0f0; padding: 10px; border-radius: 4px;">
                <strong>Element:</strong> ${currentHighlightedElement.tagName.toLowerCase()}${currentHighlightedElement.id ? '#' + currentHighlightedElement.id : ''}${currentHighlightedElement.className ? '.' + currentHighlightedElement.className.split(' ').join('.') : ''}<br>
                <strong>Dimensions:</strong> ${Math.round(rect.width)}x${Math.round(rect.height)}px<br>
                <strong>Position:</strong> (${Math.round(rect.x)}, ${Math.round(rect.y)})
              </div>
              <button style="margin-top: 15px; padding: 8px 16px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif;">
                Close
              </button>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            // Close modal on click
            modal.addEventListener('click', (e) => {
              if (e.target === modal || (e.target as HTMLElement).tagName === 'BUTTON') {
                modal.remove();
              }
            });
            
            modalContent.addEventListener('click', (e) => {
              e.stopPropagation();
            });
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            document.body.removeChild(container);
            
            // Fallback: Just show element info
            alert(`Element captured:\n\nTag: ${currentHighlightedElement.tagName}\nText: ${currentHighlightedElement.textContent?.trim() || '(no text)'}\nSize: ${Math.round(rect.width)}x${Math.round(rect.height)}px`);
          };
          
          img.src = url;
          
        } catch (error) {
          console.error('Error capturing element:', error);
          alert('Failed to capture element as image. See console for details.');
        }
      });
      
      // Show notification
      const notification = document.createElement('div');
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
        }
      } catch (e) {
        console.warn('Failed to show recorder notification:', e);
      }
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    });
  }

  private async setupInitScripts(): Promise<void> {
    if (!this.context) return;

    // Add init script to capture all events
    await this.context.addInitScript(() => {
      // Monitor for controller removal and notify parent
      const checkControllerExists = () => {
        const controller = document.getElementById('playwright-recorder-controller');
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
        if (document.getElementById('playwright-recorder-styles')) {
          return;
        }
        
        const highlightStyle = document.createElement('style');
        highlightStyle.id = 'playwright-recorder-styles';
        highlightStyle.textContent = `
          .playwright-recorder-highlight {
            outline: 2px solid #ff0000 !important;
            outline-offset: 2px !important;
            background-color: rgba(255, 0, 0, 0.1) !important;
            cursor: pointer !important;
            position: relative !important;
          }
          
          .playwright-recorder-tooltip {
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
          
          .playwright-recorder-coord-indicator {
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
      let isCoordinateMode = false;
      let coordIndicator: HTMLElement | null = null;
      
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
          tooltipElement.className = 'playwright-recorder-tooltip';
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
          highlightedElement.classList.remove('playwright-recorder-highlight');
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
        }
        
        // Add highlight to new element
        element.classList.add('playwright-recorder-highlight');
        highlightedElement = element;
        
        // Generate and show selector
        let selector = '';
        if (element.id) {
          selector = this.generateIdSelector(element.id);
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
        const event = new CustomEvent('playwright-recorder-element-highlighted', {
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
            coordIndicator.className = 'playwright-recorder-coord-indicator';
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
        if (target && target !== document.body && target !== document.documentElement && !target.closest('#playwright-recorder-controller')) {
          highlightElement(target);
        }
      }, true);
      
      // Listen for coordinate mode toggle from controller
      document.addEventListener('playwright-recorder-coordinate-toggle', (e: any) => {
        isCoordinateMode = e.detail.enabled;
        console.log('📍 Coordinate mode:', isCoordinateMode ? 'ON' : 'OFF');
        
        // Clean up coordinate indicator when turning off coordinate mode
        if (!isCoordinateMode && coordIndicator) {
          coordIndicator.remove();
          coordIndicator = null;
        }
      });
      
      // Listen for highlight toggle from controller
      document.addEventListener('playwright-recorder-highlight-toggle', (e: any) => {
        isHighlightKeyPressed = e.detail.enabled;
        document.body.style.cursor = isHighlightKeyPressed ? 'crosshair' : '';
        
        // If disabling, remove any existing highlights
        if (!isHighlightKeyPressed) {
          if (highlightedElement) {
            highlightedElement.classList.remove('playwright-recorder-highlight');
            highlightedElement = null;
          }
          
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
          
          // Notify controller that no element is highlighted
          const event = new CustomEvent('playwright-recorder-element-highlighted', {
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
          const highlightBtn = document.querySelector('#playwright-recorder-controller button');
          if (highlightBtn) {
            highlightBtn.classList.add('active');
          }
          
          // Re-dispatch event if element is highlighted
          if (highlightedElement) {
            const event = new CustomEvent('playwright-recorder-element-highlighted', {
              detail: { element: highlightedElement, isShiftPressed: isShiftKeyPressed }
            });
            document.dispatchEvent(event);
          }
        }
        
        if (e.key === 'Shift' && !isShiftKeyPressed) {
          isShiftKeyPressed = true;
          
          // Re-dispatch event if element is highlighted to update Gemini button
          if (highlightedElement && isHighlightKeyPressed) {
            const event = new CustomEvent('playwright-recorder-element-highlighted', {
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
          const highlightBtn = document.querySelector('#playwright-recorder-controller button');
          if (highlightBtn) {
            highlightBtn.classList.remove('active');
          }
          
          // Remove highlight
          if (highlightedElement) {
            highlightedElement.classList.remove('playwright-recorder-highlight');
            highlightedElement = null;
          }
          
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
          }
          
          // Notify controller that no element is highlighted
          const event = new CustomEvent('playwright-recorder-element-highlighted', {
            detail: { element: null, isShiftPressed: isShiftKeyPressed }
          });
          document.dispatchEvent(event);
        }
        
        if (e.key === 'Shift' && isShiftKeyPressed) {
          isShiftKeyPressed = false;
          
          // Re-dispatch event if element is highlighted to update Gemini button
          if (highlightedElement && isHighlightKeyPressed) {
            const event = new CustomEvent('playwright-recorder-element-highlighted', {
              detail: { element: highlightedElement, isShiftPressed: false }
            });
            document.dispatchEvent(event);
          }
        }
      }, true);
      
      // Listen for all keyboard events
      document.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement;
        
        // Skip recording keyboard events on recorder UI elements and date offset modal
        if (target.closest('#playwright-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.playwright-recorder-modal') ||
            target.closest('.playwright-recorder-modal-content') ||
            target.closest('#playwright-date-offset-modal') ||
            target.id === 'wait-instructions' ||
            target.id === 'wait-condition' ||
            target.id === 'wait-timeout' ||
            target.id === 'wait-cancel' ||
            target.id === 'wait-confirm' ||
            target.closest('[id^="wait-"]') ||
            target.closest('.playwright-recorder-') ||
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
      
      // Track input changes with debouncing to avoid recording every keystroke
      const inputTimers = new WeakMap<HTMLElement, any>();
      const lastInputValues = new WeakMap<HTMLElement, string>();

      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;

        // Skip recording input events on recorder UI elements and date offset modal
        if (target.closest('#playwright-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.playwright-recorder-modal') ||
            target.closest('.playwright-recorder-modal-content') ||
            target.closest('#playwright-date-offset-modal') ||
            target.id === 'wait-instructions' ||
            target.id === 'wait-condition' ||
            target.id === 'wait-timeout' ||
            target.id === 'wait-cancel' ||
            target.id === 'wait-confirm' ||
            target.closest('[id^="wait-"]') ||
            target.closest('.playwright-recorder-') ||
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

        // Skip recorder UI elements and date offset modal
        if (target.closest('#playwright-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.playwright-recorder-modal') ||
            target.closest('#playwright-date-offset-modal') ||
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

        // Skip recorder UI elements and date offset modal
        if (target.closest('#playwright-recorder-controller') ||
            target.closest('#playwright-wait-modal') ||
            target.closest('.playwright-recorder-modal') ||
            target.closest('#playwright-date-offset-modal')) {
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
      
      // Function to handle clicks - separated so we can call it from multiple places
      const handleClick = (e: MouseEvent) => {
        // Check if we've already processed this event
        if (processedClicks.has(e)) {
          console.log('⏭️ Click already processed, skipping');
          return;
        }

        const target = e.target as HTMLElement;
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

        console.log('🖱️ Click detected, coordinate mode:', isCoordinateMode);

        // Mark this event as processed
        processedClicks.set(e, true);
        lastClickTime = now;
        lastClickTarget = target;

        // Skip recording clicks on the recorder controller UI and date offset modal
        if (target.closest('#playwright-recorder-controller') ||
            target.closest('#playwright-date-offset-modal')) {
          console.log('⏭️ Skipping recorder UI click');
          return;
        }

        // Skip coordinate indicator if somehow clicked
        if (target.classList.contains('playwright-recorder-coord-indicator')) {
          console.log('⏭️ Skipping coord indicator click');
          return;
        }
        
        // Check if we're in wait mode
        const waitBtn = document.querySelector('#playwright-recorder-controller [data-wait-mode="true"]') as HTMLElement;
        const isWaitMode = waitBtn && waitBtn.classList.contains('active');
        
        if (isWaitMode) {
          // Skip wait recording on ANY recorder UI elements and date offset modal
          if (target.closest('#playwright-recorder-controller') ||
              target.closest('#playwright-wait-modal') ||
              target.closest('.playwright-recorder-modal') ||
              target.closest('.playwright-recorder-modal-content') ||
              target.closest('#playwright-date-offset-modal') ||
              target.id === 'wait-instructions' ||
              target.id === 'wait-condition' ||
              target.id === 'wait-timeout' ||
              target.id === 'wait-cancel' ||
              target.id === 'wait-confirm' ||
              target.closest('[id^="wait-"]') ||
              target.closest('.playwright-recorder-') ||
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
          modal.className = 'playwright-recorder-modal';
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
          modalContent.className = 'playwright-recorder-modal-content';
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
        
        const event: any = {
          selector: selector,
          text: target.textContent?.trim() || ''
        };

        console.log('📤 Click event prepared - Selector:', selector, 'Text:', event.text);

        // Add coordinates if in coordinate mode
        if (isCoordinateMode) {
          // Use pageX/pageY for absolute document coordinates
          const x = e.pageX || (e.clientX + window.pageXOffset);
          const y = e.pageY || (e.clientY + window.pageYOffset);
          
          event.coordinates = { x, y };
          console.log(`📍 Recording click at coordinates: (${x}, ${y})`);
          console.log(`📍 Coordinate mode active, sending coordinates with click event`);
        }
        
        (window as any).__recordedEvents.push({
          type: 'click', 
          data: event,
          timestamp: Date.now()
        });
        
        if ((window as any).__playwrightRecorderOnClick) {
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

  private async injectKeyboardListener(): Promise<void> {
    if (!this.page) return;

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
      this.actions.push({
        type: 'fill',
        selector: data.selector,
        value: data.value,
        timestamp: Date.now() - this.startTime
      });
      console.log('📝 Captured fill:', data.selector, '=', data.value);
      this.updateGeneratedCode();
    });
    
    await this.page.exposeFunction('__playwrightRecorderOnClick', async (data: any) => {
      const action: RecordedAction = {
        type: 'click',
        selector: data.selector,
        value: data.text,
        timestamp: Date.now() - this.startTime
      };
      
      // Add coordinates if provided
      if (data.coordinates) {
        action.coordinates = data.coordinates;
        console.log('🖱️📍 Captured click at coordinates:', data.coordinates);
      } else {
        console.log('🖱️ Captured click on:', data.selector);
      }
      
      this.actions.push(action);
      this.updateGeneratedCode();
    });
    
    await this.page.exposeFunction('__playwrightRecorderOnGemini', async (elementInfo: any) => {
      console.log('🌟 Gemini button clicked for element:', elementInfo);
      
      // Update code viewer with element info instead of test code
      const elementDisplay = `// Gemini Element Analysis
// ========================

// Selected Element: ${elementInfo.tagName}${elementInfo.id ? '#' + elementInfo.id : ''}${elementInfo.className ? '.' + elementInfo.className.split(' ').join('.') : ''}

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
  }

  private setupPageListeners(): void {
    if (!this.page) return;

    // Listen for various navigation events
    this.page.on('load', async () => {
      console.log('🔄 Page load event detected');
      await this.injectKeyboardListener();
      await this.injectControllerUI();
    });

    // Also listen for DOM content changes
    this.page.on('domcontentloaded', async () => {
      console.log('🔄 DOM content loaded');
      // Wait a bit for any dynamic content to settle
      await this.page.waitForTimeout(500);
      await this.injectControllerUI();
    });

    // Monitor for navigation within the same page
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page.mainFrame()) {
        console.log('🔄 Main frame navigated');
        await this.page.waitForTimeout(500);
        await this.injectKeyboardListener();
        await this.injectControllerUI();
      }
    });
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

  private createDatePickerAction(): void {
    // Validate all 3 components were collected
    if (!this.dateMarkingSelectors.year || !this.dateMarkingSelectors.month || !this.dateMarkingSelectors.day) {
      console.error('❌ Missing date components:', this.dateMarkingSelectors);
      return;
    }

    const action: RecordedAction = {
      type: 'datePickerGroup',
      timestamp: Date.now() - this.startTime,
      dateComponents: {
        year: {
          selector: this.dateMarkingSelectors.year.selector,
          elementType: this.dateMarkingSelectors.year.elementType,
          dropdownSelector: this.dateMarkingSelectors.year.dropdownSelector
        },
        month: {
          selector: this.dateMarkingSelectors.month.selector,
          elementType: this.dateMarkingSelectors.month.elementType,
          dropdownSelector: this.dateMarkingSelectors.month.dropdownSelector
        },
        day: {
          selector: this.dateMarkingSelectors.day.selector,
          elementType: this.dateMarkingSelectors.day.elementType,
          dropdownSelector: this.dateMarkingSelectors.day.dropdownSelector
        }
      },
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

  private generateTestCode(): string {
    // Get screen dimensions (same as recording)
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const browserWidth = Math.floor(width * 0.6);
    const browserHeight = height;
    const browserX = width - browserWidth;
    const browserY = 0;

    const lines: string[] = [
      "const { chromium } = require('playwright-core');",
      "const path = require('path');",
      "const os = require('os');",
      "const fs = require('fs');",
      "",
      "(async () => {",
      "  console.log('🎬 Starting test replay...');",
      "  ",
      "  // Create downloads directory in system Downloads folder",
      "  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Playwright');",
      "  if (!fs.existsSync(downloadsPath)) {",
      "    fs.mkdirSync(downloadsPath, { recursive: true });",
      "  }",
      "  console.log('📥 Downloads will be saved to:', downloadsPath);",
      "",
      "  // Create temporary profile directory",
      "  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));",
      "  console.log('📁 Using profile directory:', profileDir);",
      "",
      "  // Launch browser with persistent context (more reliable in production)",
      "  const context = await chromium.launchPersistentContext(profileDir, {",
      "    headless: false,",
      "    channel: 'chrome', // Uses installed Chrome",
      "    viewport: null,",
      "    permissions: ['clipboard-read', 'clipboard-write'],",
      "    acceptDownloads: true,",
      "    downloadsPath: downloadsPath,",
      "    args: [",
      `      '--window-size=${browserWidth},${browserHeight}',`,
      `      '--window-position=${browserX},${browserY}',`,
      "      '--no-default-browser-check',",
      "      '--disable-blink-features=AutomationControlled',",
      "      '--no-first-run',",
      "      // Permission handling for localhost and private network access",
      "      '--disable-web-security',",
      "      '--disable-features=IsolateOrigins,site-per-process',",
      "      '--allow-running-insecure-content',",
      "      '--disable-features=PrivateNetworkAccessSendPreflights',",
      "      '--disable-features=PrivateNetworkAccessRespectPreflightResults'",
      "    ]",
      "  });",
      "",
      "  // Get or create page",
      "  const pages = context.pages();",
      "  const page = pages.length > 0 ? pages[0] : await context.newPage();",
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
          // If this click triggers a download, set up the promise first
          if (downloadTriggerIndices.has(i)) {
            lines.push(`    // Setting up download handler before clicking`);
            lines.push(`    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });`);
          }

          if (action.coordinates) {
            // Use coordinate-based click
            lines.push(`    await page.mouse.click(${action.coordinates.x}, ${action.coordinates.y}); // Click at coordinates`);
          } else {
            // Use the generated selector which should be more specific
            lines.push(`    await page.locator('${action.selector}').click();`);
          }
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
        case 'fill':
          // Escape single quotes in value
          const escapedValue = action.value?.replace(/'/g, "\\'") || '';
          lines.push(`    await page.fill('${action.selector}', '${escapedValue}');`);
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
          // Add comment explaining dynamic date
          const offsetText = action.dateOffset === 0 ? 'today' :
                           action.dateOffset! > 0 ? `today + ${action.dateOffset} days` :
                           `today - ${Math.abs(action.dateOffset!)} days`;
          lines.push(`    // Select date: ${offsetText}`);
          lines.push(`    const targetDate = new Date();`);

          if (action.dateOffset && action.dateOffset !== 0) {
            lines.push(`    targetDate.setDate(targetDate.getDate() + ${action.dateOffset});`);
          }

          lines.push(`    const year = targetDate.getFullYear().toString();`);
          lines.push(`    const month = (targetDate.getMonth() + 1).toString(); // 1-12`);
          lines.push(`    const day = targetDate.getDate().toString();`);
          lines.push(``);

          // Select year - use appropriate method based on element type
          const yearType = action.dateComponents!.year.elementType;
          const yearSelector = action.dateComponents!.year.selector;
          const yearDropdownSelector = action.dateComponents!.year.dropdownSelector;

          if (yearType === 'select') {
            lines.push(`    await page.selectOption('${yearSelector}', year);`);
          } else if (yearType === 'input') {
            // For input elements, use fill() instead of click()
            lines.push(`    await page.locator('${yearSelector}').fill(year);`);
          } else {
            // For button/clickable elements (dropdowns)
            // Check if selector has :has-text, which means we need to filter by dynamic value
            if (yearSelector.includes(':has-text')) {
              // Has text-based selector - extract base selector and use filter with dynamic year
              const baseYearSelector = yearSelector.split(':has-text')[0];
              lines.push(`    await page.locator('${baseYearSelector}').filter({ hasText: year }).click();`);
            } else {
              // Click to open dropdown
              lines.push(`    await page.locator('${yearSelector}').click(); // Open year dropdown`);

              // Select option from dropdown - use detected dropdown selector if available
              if (yearDropdownSelector) {
                lines.push(`    await page.locator('${yearDropdownSelector} a, ${yearDropdownSelector} button, ${yearDropdownSelector} div, ${yearDropdownSelector} li').filter({ hasText: year }).first().click();`);
              } else {
                // Fallback to unscoped search
                lines.push(`    await page.locator('a, button, div, li').filter({ hasText: year }).first().click();`);
              }
            }
          }
          if (i < this.actions.length - 1) {
            const waitTime = Math.min(1200, this.waitSettings.maxDelay);
            lines.push(`    await page.waitForTimeout(${waitTime}); // Human-like delay`);
          }

          // Select month
          const monthType = action.dateComponents!.month.elementType;
          const monthSelector = action.dateComponents!.month.selector;
          const monthDropdownSelector = action.dateComponents!.month.dropdownSelector;

          if (monthType === 'select') {
            lines.push(`    await page.selectOption('${monthSelector}', month);`);
          } else if (monthType === 'input') {
            // For input elements, use fill() instead of click()
            lines.push(`    await page.locator('${monthSelector}').fill(month);`);
          } else {
            // For button/clickable elements (dropdowns)
            // Check if selector has :has-text, which means we need to filter by dynamic value
            if (monthSelector.includes(':has-text')) {
              // Has text-based selector - extract base selector and use filter with dynamic month
              const baseMonthSelector = monthSelector.split(':has-text')[0];
              lines.push(`    await page.locator('${baseMonthSelector}').filter({ hasText: month }).click();`);
            } else {
              // Click to open dropdown
              lines.push(`    await page.locator('${monthSelector}').click(); // Open month dropdown`);

              // Select option from dropdown - use detected dropdown selector if available
              if (monthDropdownSelector) {
                lines.push(`    await page.locator('${monthDropdownSelector} a, ${monthDropdownSelector} button, ${monthDropdownSelector} div, ${monthDropdownSelector} li').filter({ hasText: month }).first().click();`);
              } else {
                // Fallback to unscoped search
                lines.push(`    await page.locator('a, button, div, li').filter({ hasText: month }).first().click();`);
              }
            }
          }
          if (i < this.actions.length - 1) {
            const waitTime = Math.min(800, this.waitSettings.maxDelay);
            lines.push(`    await page.waitForTimeout(${waitTime}); // Human-like delay`);
          }

          // Select day
          const dayType = action.dateComponents!.day.elementType;
          const daySelector = action.dateComponents!.day.selector;
          const dayDropdownSelector = action.dateComponents!.day.dropdownSelector;

          if (dayType === 'select') {
            lines.push(`    await page.selectOption('${daySelector}', day);`);
          } else if (dayType === 'input') {
            // For input elements, use fill() instead of click()
            lines.push(`    await page.locator('${daySelector}').fill(day);`);
          } else {
            // For button/clickable elements (dropdowns)
            // Check if selector has :has-text, which means we need to filter by dynamic value
            if (daySelector.includes(':has-text')) {
              // Has text-based selector - extract base selector and use filter with dynamic day
              const baseDaySelector = daySelector.split(':has-text')[0];
              lines.push(`    await page.locator('${baseDaySelector}').filter({ hasText: day }).click();`);
            } else {
              // Click to open dropdown
              lines.push(`    await page.locator('${daySelector}').click(); // Open day dropdown`);

              // Select option from dropdown - use detected dropdown selector if available
              if (dayDropdownSelector) {
                lines.push(`    await page.locator('${dayDropdownSelector} a, ${dayDropdownSelector} button, ${dayDropdownSelector} div, ${dayDropdownSelector} li').filter({ hasText: day }).first().click();`);
              } else {
                // Fallback to unscoped search
                lines.push(`    await page.locator('a, button, div, li').filter({ hasText: day }).first().click();`);
              }
            }
          }
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
    lines.push("  }");
    lines.push("})().catch(console.error);");
    
    return lines.join('\n');
  }

  getActions(): RecordedAction[] {
    return this.actions;
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