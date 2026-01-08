import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot';
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
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
    
    // Show helpful message about highlighting feature
    await this.page.evaluate(() => {
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
        Hold <strong>Alt</strong> (Option on Mac) to highlight elements before clicking
      `;
      
      const style = document.createElement('style');
      style.textContent = `
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
      `;
      try {
        if (document.head) {
          document.head.appendChild(style);
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
    
    this.isRecording = true;
    this.updateGeneratedCode();
  }

  private async setupInitScripts(): Promise<void> {
    if (!this.context) return;

    // Add init script to capture all events
    await this.context.addInitScript(() => {
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
      };
      
      // Mouse move handler for highlighting
      document.addEventListener('mousemove', (e) => {
        if (!isHighlightKeyPressed) return;
        
        const target = e.target as HTMLElement;
        if (target && target !== document.body && target !== document.documentElement) {
          highlightElement(target);
        }
      }, true);
      
      // Listen for highlight key (Alt/Option)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Alt' && !isHighlightKeyPressed) {
          isHighlightKeyPressed = true;
          document.body.style.cursor = 'crosshair';
        }
      }, true);
      
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Alt' && isHighlightKeyPressed) {
          isHighlightKeyPressed = false;
          document.body.style.cursor = '';
          
          // Remove highlight
          if (highlightedElement) {
            highlightedElement.classList.remove('playwright-recorder-highlight');
            highlightedElement = null;
          }
          
          if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
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
  }

  private setupPageListeners(): void {
    if (!this.page) return;

    // Listen for navigation and re-inject functions
    this.page.on('load', async () => {
      await this.injectKeyboardListener();
    });
  }


  async stop(): Promise<string> {
    this.isRecording = false;
    
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