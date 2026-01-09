import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' | 'waitForElement';
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
  waitCondition?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  timeout?: number;
  timestamp: number;
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

  setOutputFile(filePath: string): void {
    this.outputFile = filePath;
  }

  setUpdateCallback(callback: (code: string) => void): void {
    this.updateCallback = callback;
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

    // Launch browser using Playwright's channel detection
    console.log('🎭 Launching browser with Playwright channel detection');
    console.log('📐 Window dimensions:', {
      browserWidth,
      browserHeight,
      position: { x: browserX, y: browserY }
    });
    
    try {
      // Use Playwright's channel option which automatically finds Chrome
      this.browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
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
        this.browser = await chromium.launch({
          headless: false,
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

    this.context = await this.browser.newContext({
      viewport: null,
      permissions: ['clipboard-read', 'clipboard-write']
    });
    
    // Set up browser close detection
    this.browser.on('disconnected', () => {
      console.log('🔌 Browser disconnected - user closed the window');
      if (this.isRecording && onBrowserClosed) {
        this.isRecording = false;
        onBrowserClosed();
      }
    });

    // Add init scripts before creating the page
    await this.setupInitScripts();
    
    this.page = await this.context.newPage();
    
    // Inject keyboard event listener
    await this.injectKeyboardListener();
    
    // Set up page event listeners
    this.setupPageListeners();
    
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
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
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
      `;
      
      controller.appendChild(recordingIndicator);
      controller.appendChild(highlightBtn);
      controller.appendChild(waitBtn);
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
      
      // Set up highlight toggle functionality
      let highlightMode = false;
      let currentHighlightedElement: HTMLElement | null = null;
      
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
        `;
        stopNotification.innerHTML = `
          <strong>⏹️ Recording Stopped</strong><br>
          Generating test code...
        `;
        
        try {
          if (document.body) {
            document.body.appendChild(stopNotification);
          }
        } catch (e) {
          console.warn('Failed to show stop notification:', e);
        }
        
        // Remove notification after 3 seconds
        setTimeout(() => {
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
          `;
          waitInstructions.innerHTML = `
            <strong>🎯 Wait Mode Active</strong><br>
            Click on an element to wait for it to load
          `;
          
          try {
            if (document.body) {
              document.body.appendChild(waitInstructions);
            }
          } catch (e) {
            console.warn('Failed to show wait instructions:', e);
          }
          
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
          
          // Remove instructions
          const instructions = document.getElementById('wait-instructions');
          if (instructions) {
            instructions.remove();
          }
          
          // Reset cursor
          document.body.style.cursor = '';
        }
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
          selector = `#${element.id}`;
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
      
      // Mouse move handler for highlighting
      document.addEventListener('mousemove', (e) => {
        if (!isHighlightKeyPressed) return;
        
        const target = e.target as HTMLElement;
        // Don't highlight recorder UI elements
        if (target && target !== document.body && target !== document.documentElement && !target.closest('#playwright-recorder-controller')) {
          highlightElement(target);
        }
      }, true);
      
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
        const event = {
          type: 'keydown',
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          target: {
            tagName: (e.target as HTMLElement).tagName,
            id: (e.target as HTMLElement).id,
            className: (e.target as HTMLElement).className,
            name: (e.target as HTMLElement).getAttribute('name'),
            selector: null as string | null
          },
          timestamp: Date.now()
        };
        
        // Try to generate a selector for the target
        try {
          const target = e.target as HTMLElement;
          if (target.id) {
            event.target.selector = `#${target.id}`;
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
      
      // Track input changes
      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          const event = {
            selector: target.id ? `#${target.id}` : 
                     target.name ? `[name="${target.name}"]` :
                     target.className ? `.${target.className.split(' ')[0]}` :
                     target.tagName.toLowerCase(),
            value: target.value
          };
          
          (window as any).__recordedEvents.push({type: 'fill', data: event});
          
          // Send fill event
          if ((window as any).__playwrightRecorderOnFill) {
            (window as any).__playwrightRecorderOnFill(event);
          }
        }
      }, true);
      
      // Track clicks
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        
        // Skip recording clicks on the recorder controller UI
        if (target.closest('#playwright-recorder-controller')) {
          return;
        }
        
        // Check if we're in wait mode
        const waitBtn = document.querySelector('#playwright-recorder-controller [data-wait-mode="true"]') as HTMLElement;
        const isWaitMode = waitBtn && waitBtn.classList.contains('active');
        
        if (isWaitMode) {
          // Handle wait for element action
          e.preventDefault();
          e.stopPropagation();
          
          // Show wait condition selection modal
          const modal = document.createElement('div');
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
              selector = '#' + target.id;
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
                const parentSelector = parent.id ? '#' + parent.id : parent.className ? '.' + parent.className.split(' ')[0] : parent.tagName.toLowerCase();
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
        
        // Priority 1: Use ID if available
        if (target.id) {
          selector = `#${target.id}`;
        } 
        // Priority 2: For buttons, use role selector
        else if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') {
          const text = target.textContent?.trim() || '';
          selector = `button:has-text("${text}")`;
        }
        // Priority 3: For links, use role selector
        else if (target.tagName === 'A') {
          const text = target.textContent?.trim() || '';
          selector = `a:has-text("${text}")`;
        }
        // Priority 4: For inputs, use name or type
        else if (target.tagName === 'INPUT') {
          const type = target.getAttribute('type') || 'text';
          const name = target.getAttribute('name');
          const placeholder = target.getAttribute('placeholder');
          
          if (name) {
            selector = `input[name="${name}"]`;
          } else if (placeholder) {
            selector = `input[placeholder="${placeholder}"]`;
          } else {
            selector = `input[type="${type}"]`;
          }
        }
        // Priority 5: Use data attributes if available
        else if (target.hasAttribute('data-testid')) {
          selector = `[data-testid="${target.getAttribute('data-testid')}"]`;
        }
        // Priority 6: Use nth-child for specific element
        else {
          const parent = target.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(target) + 1;
            const parentSelector = parent.id ? `#${parent.id}` : parent.className ? `.${parent.className.split(' ')[0]}` : parent.tagName.toLowerCase();
            selector = `${parentSelector} > ${target.tagName.toLowerCase()}:nth-child(${index})`;
          } else {
            // Fallback to basic selector
            selector = target.className ? `.${target.className.split(' ')[0]}` : target.tagName.toLowerCase();
          }
        }
        
        const event = {
          selector: selector,
          text: target.textContent?.trim() || ''
        };
        
        (window as any).__recordedEvents.push({type: 'click', data: event});
        
        if ((window as any).__playwrightRecorderOnClick) {
          (window as any).__playwrightRecorderOnClick(event);
        }
      }, true);
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
      this.actions.push({
        type: 'click',
        selector: data.selector,
        value: data.text,
        timestamp: Date.now() - this.startTime
      });
      console.log('🖱️ Captured click on:', data.selector);
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
  ${elementInfo.id ? `'#${elementInfo.id}',` : ''}
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
      
      // Close browser after a short delay to allow UI feedback
      setTimeout(async () => {
        if (this.browser) {
          try {
            await this.browser.close();
            console.log('🚪 Browser closed after stop request');
          } catch (err) {
            console.log('Browser already closed or error closing:', err);
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
    
    // Close browser if it's still open
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        console.log('Browser already closed');
      }
    }
    
    return testCode;
  }

  private generateTestCode(): string {
    const lines: string[] = [
      "import { test, expect } from '@playwright/test';",
      "",
      "test('recorded test', async ({ page }) => {"
    ];

    let lastTimestamp = 0;
    
    for (const action of this.actions) {
      // Add delay if needed (but not after navigation)
      const delay = action.timestamp - lastTimestamp;
      if (delay > 1000 && lastTimestamp > 0 && action.type !== 'navigate') {
        lines.push(`  await page.waitForTimeout(${Math.min(delay, 3000)}); // Human-like delay`);
      }
      lastTimestamp = action.timestamp;
      
      switch (action.type) {
        case 'navigate':
          lines.push(`  await page.goto('${action.url}');`);
          break;
        case 'click':
          // Use the generated selector which should be more specific
          lines.push(`  await page.locator('${action.selector}').click();`);
          break;
        case 'fill':
          // Escape single quotes in value
          const escapedValue = action.value?.replace(/'/g, "\\'") || '';
          lines.push(`  await page.fill('${action.selector}', '${escapedValue}');`);
          break;
        case 'keypress':
          if (action.key === 'Enter') {
            lines.push(`  await page.keyboard.press('Enter'); // Submit form`);
          } else {
            lines.push(`  await page.keyboard.press('${action.key}');`);
          }
          break;
        case 'waitForElement':
          const condition = action.waitCondition || 'visible';
          const timeout = action.timeout || 5000;
          
          // Generate appropriate wait command based on condition
          switch (condition) {
            case 'visible':
              lines.push(`  await page.waitForSelector('${action.selector}', { state: 'visible', timeout: ${timeout} });`);
              break;
            case 'hidden':
              lines.push(`  await page.waitForSelector('${action.selector}', { state: 'hidden', timeout: ${timeout} });`);
              break;
            case 'enabled':
              lines.push(`  await page.waitForFunction(() => !document.querySelector('${action.selector}')?.disabled, {}, { timeout: ${timeout} });`);
              break;
            case 'disabled':
              lines.push(`  await page.waitForFunction(() => document.querySelector('${action.selector}')?.disabled, {}, { timeout: ${timeout} });`);
              break;
          }
          break;
      }
    }
    
    lines.push("});");
    
    return lines.join('\n');
  }

  getActions(): RecordedAction[] {
    return this.actions;
  }

  private updateGeneratedCode(): void {
    console.log('🔄 updateGeneratedCode called, actions count:', this.actions.length);
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
  }
}