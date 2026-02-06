/**
 * RESEARCHER Browser Handler
 *
 * Implements agent-browser pattern (93% context savings):
 * - Semantic locators (find by role, text, label)
 * - Compact accessibility snapshots (@e1, @e2 style references)
 * - AI-friendly browser commands
 *
 * Uses existing Playwright setup - no duplicate browser installation
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright-core';
import * as fs from 'fs';

/**
 * Get Chrome executable path for macOS
 */
function getChromePath(): string {
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ];

  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error('Chrome not found. Please install Google Chrome.');
}

export interface ElementRef {
  id: string; // @e1, @e2, etc.
  role: string;
  name: string;
  tag: string;
  interactable: boolean;
  selector?: string;
  visited?: boolean; // Has this element been clicked before?
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: ElementRef[];
  tokenCount: number; // Approximate token count
}

/**
 * RESEARCHER Browser Manager
 */
export class ResearcherBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private elementMap: Map<string, any> = new Map(); // @e1 -> actual element
  private elementCounter = 0;
  private visitedElements: Set<string> = new Set(); // Clicked element IDs (@e1, @e2, etc.)
  private visitedUrls: Set<string> = new Set(); // URLs we've been to

  /**
   * Launch browser (uses system Chrome) - ALWAYS VISIBLE for debugging
   */
  async launch(): Promise<void> {
    if (this.browser) {
      console.log('[ResearcherBrowser] Browser already running');
      return;
    }

    console.log('[ResearcherBrowser] Launching browser (visible mode for debugging)...');
    const chromePath = getChromePath();

    this.browser = await chromium.launch({
      headless: false, // Always visible so you can watch AI navigate
      executablePath: chromePath,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    this.page = await this.context.newPage();
    console.log('[ResearcherBrowser] Browser launched successfully');
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<{ success: boolean; url?: string; title?: string; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      console.log('[ResearcherBrowser] Navigating to:', url);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait a bit for dynamic content
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalUrl = this.page.url();
      const title = await this.page.title();

      console.log('[ResearcherBrowser] Page loaded:', finalUrl);

      // Track visited URL
      this.visitedUrls.add(finalUrl);

      return { success: true, url: finalUrl, title };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Navigation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Go back (browser back button)
   */
  async goBack(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      console.log('[ResearcherBrowser] Going back...');
      await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });

      const url = this.page.url();
      console.log('[ResearcherBrowser] Now at:', url);

      return { success: true, url };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Go back error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Go forward (browser forward button)
   */
  async goForward(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      console.log('[ResearcherBrowser] Going forward...');
      await this.page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });

      const url = this.page.url();

      return { success: true, url };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Go forward error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get compact accessibility snapshot (agent-browser style)
   * Returns element references like @e1, @e2 instead of full DOM tree
   * Uses playwright-core compatible approach (no accessibility API)
   */
  async getSnapshot(interactiveOnly = true): Promise<PageSnapshot> {
    if (!this.page) throw new Error('Browser not launched');

    console.log('[ResearcherBrowser] Creating compact snapshot...');
    this.elementMap.clear();
    this.elementCounter = 0;

    const url = this.page.url();
    const title = await this.page.title();

    const elements: ElementRef[] = [];

    // Define interactive element types to scan
    const interactiveSelectors = [
      { role: 'button', selector: 'button, [role="button"], input[type="button"], input[type="submit"]' },
      { role: 'link', selector: 'a[href]' },
      { role: 'textbox', selector: 'input[type="text"], input[type="email"], input[type="search"], input[type="password"], input:not([type]), textarea' },
      { role: 'checkbox', selector: 'input[type="checkbox"]' },
      { role: 'radio', selector: 'input[type="radio"]' },
      { role: 'combobox', selector: 'select' },
    ];

    console.log('[ResearcherBrowser] Scanning for interactive elements...');

    // Filter out non-data-consumption links (we're reading data, not creating/managing it)
    const skipKeywords = [
      // Help/Support
      'help', 'support', 'faq', 'tutorial', 'guide', 'contact', 'about',
      '도움말', '지원', '문의', '고객센터', '튜토리얼', '가이드',
      'customer service', 'how to', 'learn', 'documentation',
      // Settings/Config
      'settings', 'preferences', 'configuration', 'setup', 'profile', 'account',
      '설정', '환경설정', '프로필', '계정', '옵션',
      // Create/Register/Upload (not useful for data consumption)
      'register', 'registration', 'create', 'new', 'add', 'upload', 'import', 'write',
      '등록', '신규', '작성', '추가', '업로드', '입력', '생성', '등록하기',
      'edit', 'modify', 'update', 'delete', 'remove',
      '수정', '변경', '삭제', '제거',
    ];

    const shouldSkipElement = (name: string): boolean => {
      const lowerName = name.toLowerCase();
      return skipKeywords.some(keyword => lowerName.includes(keyword));
    };

    for (const { role, selector } of interactiveSelectors) {
      const locators = await this.page.locator(selector).all();
      console.log(`[ResearcherBrowser] Found ${locators.length} ${role} elements`);

      for (const locator of locators) {
        try {
          const isVisible = await locator.isVisible().catch(() => false);
          if (!isVisible) {
            console.log(`[ResearcherBrowser] Skipping hidden ${role} element`);
            continue;
          }

          const text = await locator.textContent().catch(() => '');
          const ariaLabel = await locator.getAttribute('aria-label').catch(() => '');
          const placeholder = await locator.getAttribute('placeholder').catch(() => '');
          const name = text?.trim() || ariaLabel || placeholder || '';

          // Skip help/support links
          if (shouldSkipElement(name)) {
            console.log(`[ResearcherBrowser] Filtered: "${name.substring(0, 30)}" (${role})`);
            continue;
          }

          console.log(`[ResearcherBrowser] Adding: "${name.substring(0, 30)}" (${role})`);

          const elementId = `@e${++this.elementCounter}`;

          // Check if this element was visited before (by matching role + name)
          const wasVisited = Array.from(this.visitedElements).some(visitedId => {
            const visitedInfo = this.elementMap.get(visitedId);
            return visitedInfo && visitedInfo.role === role && visitedInfo.name === name;
          });

          elements.push({
            id: elementId,
            role,
            name: name.substring(0, 100), // Limit length
            tag: selector.split(',')[0],
            interactable: true,
            visited: wasVisited, // Mark if previously clicked
          });

          // Store reference for later interaction
          this.elementMap.set(elementId, {
            role,
            name,
          });
        } catch (error: any) {
          // Log what's failing
          console.error(`[ResearcherBrowser] Error processing ${role} element:`, error.message);
          continue;
        }
      }
    }

    const tokenCount = Math.ceil(JSON.stringify(elements).length / 4);
    const visitedCount = elements.filter(e => e.visited).length;
    const unvisitedCount = elements.length - visitedCount;

    console.log('[ResearcherBrowser] Snapshot created:');
    console.log(`  - Total elements: ${elements.length}`);
    console.log(`  - Unvisited: ${unvisitedCount} | Visited: ${visitedCount}`);
    console.log(`  - Approximate tokens: ${tokenCount}`);

    return {
      url,
      title,
      elements,
      tokenCount,
    };
  }

  /**
   * Click element by reference ID (@e1, @e2, etc.)
   * If index provided, clicks the nth matching element (for strict mode violations)
   */
  async clickElement(elementId: string, index = 0): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      const elementInfo = this.elementMap.get(elementId);
      if (!elementInfo) {
        return { success: false, error: `Element not found: ${elementId}` };
      }

      console.log(`[ResearcherBrowser] Clicking ${elementId} (index ${index}):`, elementInfo);

      // Use semantic locator
      let locator;
      if (elementInfo.role && elementInfo.name) {
        locator = this.page.getByRole(elementInfo.role, { name: elementInfo.name });
      } else if (elementInfo.name) {
        locator = this.page.getByText(elementInfo.name);
      } else {
        return { success: false, error: 'Cannot construct locator' };
      }

      // If index specified, use nth() to select specific element
      if (index > 0) {
        locator = locator.nth(index);
      } else {
        locator = locator.first(); // Default to first matching element
      }

      await locator.click({ timeout: 5000 });

      // Wait for any navigation or updates
      await this.page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});

      // Mark this element as visited
      this.visitedElements.add(elementId);
      console.log(`[ResearcherBrowser] Marked ${elementId} as visited`);

      // Track new URL if navigation happened
      const newUrl = this.page.url();
      this.visitedUrls.add(newUrl);

      return { success: true };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Click error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fill input field by reference ID
   */
  async fillElement(elementId: string, value: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      const elementInfo = this.elementMap.get(elementId);
      if (!elementInfo) {
        return { success: false, error: `Element not found: ${elementId}` };
      }

      console.log(`[ResearcherBrowser] Filling ${elementId} with:`, value);

      let locator;
      if (elementInfo.role && elementInfo.name) {
        locator = this.page.getByRole(elementInfo.role, { name: elementInfo.name });
      } else if (elementInfo.name) {
        locator = this.page.getByLabel(elementInfo.name);
      } else {
        return { success: false, error: 'Cannot construct locator' };
      }

      await locator.fill(value, { timeout: 5000 });

      return { success: true };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Fill error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get text content from element
   */
  async getElementText(elementId: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      const elementInfo = this.elementMap.get(elementId);
      if (!elementInfo) {
        return { success: false, error: `Element not found: ${elementId}` };
      }

      let locator;
      if (elementInfo.role && elementInfo.name) {
        locator = this.page.getByRole(elementInfo.role, { name: elementInfo.name });
      } else if (elementInfo.name) {
        locator = this.page.getByText(elementInfo.name);
      } else {
        return { success: false, error: 'Cannot construct locator' };
      }

      const text = await locator.textContent({ timeout: 5000 });

      return { success: true, text: text || '' };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Get text error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      const screenshot = await this.page.screenshot({ type: 'png' });
      const base64 = screenshot.toString('base64');

      return { success: true, data: base64 };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Screenshot error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for a specified duration (for page loading)
   */
  async wait(milliseconds: number): Promise<{ success: boolean }> {
    console.log(`[ResearcherBrowser] Waiting ${milliseconds}ms...`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    return { success: true };
  }

  /**
   * Press Escape key (closes most popups/modals)
   */
  async pressEscape(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      console.log('[ResearcherBrowser] Pressing Escape key...');
      await this.page.keyboard.press('Escape');

      // Wait a moment for modal to close
      await new Promise(resolve => setTimeout(resolve, 500));

      return { success: true };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Press Escape error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset visited tracking (use when starting new research session)
   */
  resetVisitedTracking(): void {
    this.visitedElements.clear();
    this.visitedUrls.clear();
    console.log('[ResearcherBrowser] Visited tracking cleared');
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      // Clear visited tracking when closing
      this.resetVisitedTracking();
      console.log('[ResearcherBrowser] Browser closed');
    }
  }

  /**
   * Resolve ambiguous element (when multiple elements match)
   * Returns all matching elements with details so AI can choose which one to click
   */
  async resolveAmbiguousElement(elementId: string): Promise<{ success: boolean; matches?: Array<{ index: number; text: string; details: string }>; error?: string }> {
    try {
      if (!this.page) throw new Error('Browser not launched');

      const elementInfo = this.elementMap.get(elementId);
      if (!elementInfo) {
        return { success: false, error: `Element not found: ${elementId}` };
      }

      console.log(`[ResearcherBrowser] Resolving ambiguous ${elementId}:`, elementInfo);

      // Get all matching elements
      let locator;
      if (elementInfo.role && elementInfo.name) {
        locator = this.page.getByRole(elementInfo.role, { name: elementInfo.name });
      } else if (elementInfo.name) {
        locator = this.page.getByText(elementInfo.name);
      } else {
        return { success: false, error: 'Cannot construct locator' };
      }

      const count = await locator.count();
      console.log(`[ResearcherBrowser] Found ${count} matching elements`);

      if (count === 0) {
        return { success: false, error: 'No elements found' };
      }

      if (count === 1) {
        return {
          success: true,
          matches: [{ index: 0, text: elementInfo.name, details: 'Only one match - safe to click' }],
        };
      }

      // Multiple matches - get details about each
      const matches = [];
      for (let i = 0; i < Math.min(count, 5); i++) { // Limit to 5 for performance
        const element = locator.nth(i);
        const text = await element.textContent().catch(() => '');
        const visible = await element.isVisible().catch(() => false);

        matches.push({
          index: i,
          text: text?.trim() || elementInfo.name,
          details: visible ? 'visible' : 'hidden',
        });
      }

      return {
        success: true,
        matches,
      };
    } catch (error: any) {
      console.error('[ResearcherBrowser] Resolve error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current page (for advanced operations)
   */
  getPage(): Page | null {
    return this.page;
  }
}

// Singleton instance
let researcherBrowserInstance: ResearcherBrowser | null = null;

export function getResearcherBrowser(): ResearcherBrowser {
  if (!researcherBrowserInstance) {
    researcherBrowserInstance = new ResearcherBrowser();
  }
  return researcherBrowserInstance;
}
