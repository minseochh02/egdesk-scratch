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

    // Launch browser with user's Chrome
    const platform = process.platform;
    let chromePath: string | undefined;
    
    // Find Chrome executable path based on platform
    if (platform === 'darwin') {
      // macOS
      chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'win32') {
      // Windows
      chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      // Alternative path
      if (!require('fs').existsSync(chromePath)) {
        chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
      }
    } else {
      // Linux
      chromePath = '/usr/bin/google-chrome';
    }
    
    try {
      this.browser = await chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: [
          `--window-size=${browserWidth},${browserHeight}`,
          `--window-position=${browserX},${browserY}`,
          '--no-default-browser-check'
        ]
      });
    } catch (err) {
      console.error('Failed to launch Chrome:', err);
      // Try without executable path (will use system Chrome if available)
      this.browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
          `--window-size=${browserWidth},${browserHeight}`,
          `--window-position=${browserX},${browserY}`,
          '--no-default-browser-check'
        ]
      });
    }

    this.context = await this.browser.newContext({
      viewport: null,
      recordVideo: {
        dir: 'videos/',
        size: { width: 1280, height: 720 }
      }
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
    
    this.isRecording = true;
    this.updateGeneratedCode();
  }

  private async setupInitScripts(): Promise<void> {
    if (!this.context) return;

    // Add init script to capture all events
    await this.context.addInitScript(() => {
      // Store events
      (window as any).__recordedEvents = [];
      
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
        const event = {
          selector: target.id ? `#${target.id}` : 
                   target.className ? `.${target.className.split(' ')[0]}` :
                   target.tagName.toLowerCase(),
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
          // Try to use text content for better selector if available
          if (action.value && action.value.length > 0 && action.value.length < 50) {
            lines.push(`  await page.getByText('${action.value}').click();`);
          } else {
            lines.push(`  await page.click('${action.selector}');`);
          }
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