/**
 * SECTION EXPLORER - Deep Section Exploration Agent
 *
 * Explores a single menu section thoroughly to find all data and capabilities.
 * Multiple instances run in parallel for different sections.
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { Page } from 'playwright-core';
import { SiteCapability } from './ai-researcher';

export interface SectionExplorationResult {
  success: boolean;
  sectionName: string;
  capabilities?: SiteCapability[];
  error?: string;
  toolCalls?: number;
  explorationSummary?: string;
}

/**
 * Summarize a single page to extract capabilities
 */
async function summarizePage(params: {
  sectionName: string;
  url: string;
  title: string;
  elements: any[];
}): Promise<SiteCapability[]> {
  const { sectionName, url, title, elements } = params;

  // Filter to data-related elements only
  const dataElements = elements.filter(e => {
    const name = e.name.toLowerCase();
    // Keep elements that look like data fields, columns, or reports
    return (
      name.includes('조회') || name.includes('리스트') || name.includes('현황') || name.includes('보고서') || // Reports
      name.includes('일자') || name.includes('날짜') || name.includes('date') || // Dates
      name.includes('금액') || name.includes('amount') || name.includes('price') || // Amounts
      name.includes('코드') || name.includes('code') || // Codes
      name.includes('수량') || name.includes('quantity') || // Quantities
      name.includes('이름') || name.includes('name') || name.includes('명칭') || // Names
      name.includes('거래처') || name.includes('품목') || name.includes('계정') // Business terms
    );
  }).slice(0, 20);

  // If no data elements, this page doesn't have useful data
  if (dataElements.length === 0) {
    return [];
  }

  const elementList = dataElements.map(e => e.name).join(', ');

  const summarizationPrompt = `You're looking at a page in the **${sectionName}** section of an ERP system.

**Page:** ${title || url}
**Data-related elements on page:** ${elementList}

Based on these elements, what data capabilities exist on this page?

Return capabilities found. If this page has a data table or report, identify:
- What kind of data/report this is
- What columns/fields are available

If this page doesn't have viewable data (just navigation menu), return empty array.`;

  try {
    const result = await generateWithRookieAI({
      prompt: summarizationPrompt,
      systemPrompt: 'Extract data capabilities from a page. Focus on data that can be viewed/downloaded.',
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 2048,
      responseSchema: {
        type: 'object',
        properties: {
          capabilities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                section: { type: 'string' },
                description: { type: 'string' },
                path: { type: 'string' },
                dataAvailable: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['section', 'description', 'path', 'dataAvailable'],
            },
          },
        },
        required: ['capabilities'],
      },
    });

    if (result.json && result.json.capabilities) {
      return result.json.capabilities;
    }

    return [];
  } catch (error) {
    console.warn(`[Section Explorer: ${sectionName}] Page summarization failed:`, error);
    return [];
  }
}

/**
 * Explore a single section in depth
 */
export async function exploreSection(params: {
  page: Page; // Browser page (in its own tab)
  sectionName: string;
  sectionElementId: string; // @e reference to click to enter section
  goal: string; // e.g., "Map all data available in Sales section"
}): Promise<SectionExplorationResult> {
  const { page, sectionName, sectionElementId, goal } = params;

  try {
    console.log(`[Section Explorer: ${sectionName}] Starting exploration...`);

    // Accumulated capabilities from page-by-page summarization
    const accumulatedCapabilities: SiteCapability[] = [];
    let lastSnapshotUrl = '';
    let snapshotCount = 0;

    // Build system prompt (EXPLORATION PHASE - no summarization needed)
    const systemPrompt = `You are **Section Explorer**, an AI agent that explores a specific section of a website in depth.

Your scope: **${sectionName}** section only

**Your job in this phase: EXPLORE ONLY**
- Just explore and click around - you don't need to summarize anything
- After you finish, another AI will review your journey and create the summary
- Focus 100% on exploring, not on remembering what you found

**Important mindset:**
- Don't give up when you hit restricted subsections - explore EVERYTHING in this section
- Sections often have mixed permissions - some restricted, many accessible
- If ONE subsection says "No permission", note it mentally and continue to others
- You might find 10 restricted items and 1 accessible one - that's NORMAL, keep going!

You have browser automation tools:
- snapshot() - Get current page elements (@e1, @e2 refs)
- wait(milliseconds) - Wait for page to load
- click(elementId, index?) - Click an element
- resolveElement(elementId) - See all matching elements
- getText(elementId) - Get text from element
- goBack() - Browser back button (use if stuck)
- pressEscape() - Close popups/modals
- screenshot() - Take screenshot

**Your Mission:**
Explore the **${sectionName}** section thoroughly. Just click around and explore - don't worry about summarizing.

**Instructions:**
1. You'll start by clicking the section menu to enter it
2. Then systematically explore ALL subsections, reports, data tables
3. Focus on DATA CONSUMPTION (view, download, export, reports)
4. Skip DATA CREATION (add, edit, upload, register)
5. Document what columns/fields are in each data table
6. Note what reports can be accessed

**If you encounter:**
- "No permission" → Note it as "restricted" and move to NEXT item - don't give up!
- Popup blocking → pressEscape() and retry
- Stuck → goBack() and try different path
- Multiple similar items → resolveElement() to see all, then pick one

**CRITICAL:**
- "No permission" on ONE subsection ≠ all subsections blocked. Keep exploring!
- Mixed permissions are normal - explore both accessible AND restricted items
- Stay within **${sectionName}** section - don't wander to other sections
- Use all 30 iterations to explore thoroughly
- Don't worry about running out of calls - just explore everything you can!

Start by taking a snapshot.`;

    const prompt = `${goal}

Explore the **${sectionName}** section thoroughly. Click "${sectionName}" menu to enter, then systematically explore ALL subsections and items within it.

**Remember:**
- If you see "No permission" on one item, that's fine - keep exploring other items!
- This section might have 20 items: 15 restricted, 5 accessible - find them all!
- Don't stop at the first "No permission" - explore EVERYTHING
- Use all your iterations (up to 30) to explore as much as possible
- Focus on exploration - another AI will summarize your journey afterward

**What to explore:**
- Click menu items and subsections
- Check what data tables are available
- Look at what columns/fields are in each table
- Try to access reports and downloads
- Note which items are accessible vs restricted

Start exploring now! Click everything you can in the ${sectionName} section.`;

    let finalCapabilities: SiteCapability[] = [];
    let explorationSummary = '';
    const visitedElements = new Set<string>();

    // Create compact element map
    const elementMap = new Map<string, { role: string; name: string }>();
    let elementCounter = 0;

    // Helper to create snapshot
    const createSnapshot = async () => {
      elementMap.clear();
      elementCounter = 0;

      const url = page.url();
      const title = await page.title();
      const elements: any[] = [];

      // Scan for interactive elements
      const interactiveSelectors = [
        { role: 'button', selector: 'button, [role="button"], input[type="button"], input[type="submit"]' },
        { role: 'link', selector: 'a[href]' },
        { role: 'textbox', selector: 'input[type="text"], input[type="email"], input[type="search"], textarea' },
      ];

      // Filter keywords (skip Settings, Help, etc.)
      const skipKeywords = [
        'help', 'support', 'faq', 'settings', 'preferences', 'profile', 'account',
        '도움말', '설정', '환경설정', '프로필',
        'register', 'create', 'new', 'add', 'upload', 'import', 'edit', 'modify',
        '등록', '신규', '작성', '추가', '업로드', '수정',
      ];

      const shouldSkip = (name: string): boolean => {
        const lower = name.toLowerCase();
        return skipKeywords.some(kw => lower.includes(kw));
      };

      for (const { role, selector } of interactiveSelectors) {
        const locators = await page.locator(selector).all();

        for (const locator of locators) {
          try {
            const isVisible = await locator.isVisible().catch(() => false);
            if (!isVisible) continue;

            const text = await locator.textContent().catch(() => '');
            const ariaLabel = await locator.getAttribute('aria-label').catch(() => '');
            const name = text?.trim() || ariaLabel || '';

            if (!name || shouldSkip(name)) continue;

            const elementId = `@e${++elementCounter}`;

            // Check if visited
            const wasVisited = Array.from(visitedElements).some(visitedId => {
              const visitedInfo = elementMap.get(visitedId);
              return visitedInfo && visitedInfo.role === role && visitedInfo.name === name;
            });

            elements.push({
              id: elementId,
              role,
              name: name.substring(0, 100),
              interactable: true,
              visited: wasVisited,
            });

            elementMap.set(elementId, { role, name });
          } catch (error) {
            continue;
          }
        }
      }

      console.log(`[Section Explorer: ${sectionName}] Snapshot: ${elements.length} elements`);

      return {
        success: true,
        url,
        title,
        elements,
      };
    };

    // Define tools
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'snapshot',
            description: 'Get current page elements with visited tracking',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'wait',
            description: 'Wait for page to load',
            parameters: {
              type: 'object',
              properties: {
                milliseconds: { type: 'number' },
              },
              required: ['milliseconds'],
            },
          },
          {
            name: 'click',
            description: 'Click an element by ID. If strict mode violation, use resolveElement first.',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string', description: 'Element ID from snapshot' },
                index: { type: 'number', description: 'Which match to click (after resolveElement)' },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'resolveElement',
            description: 'See all matching elements when multiple exist',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string' },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'getText',
            description: 'Get text from element',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string' },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'goBack',
            description: 'Browser back button - use if stuck',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'screenshot',
            description: 'Take screenshot',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'pressEscape',
            description: 'Press Escape to close popups',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        ],
      },
    ];

    // Tool executor (with logging for later summarization)
    let iterationCount = 0;
    const toolExecutor = async (toolName: string, args: any) => {
      iterationCount++;
      console.log(`[Section Explorer: ${sectionName}] [${iterationCount}/30] ${toolName}`);

      let result: any;

      switch (toolName) {
        case 'snapshot':
          result = await createSnapshot();

          // After each snapshot, check if we're on a new page and summarize it
          if (result.success && result.url !== lastSnapshotUrl) {
            lastSnapshotUrl = result.url;
            snapshotCount++;

            console.log(`[Section Explorer: ${sectionName}] [${snapshotCount}] New page detected, analyzing...`);

            // Immediately summarize this page
            const pageCapabilities = await summarizePage({
              sectionName,
              url: result.url,
              title: result.title,
              elements: result.elements,
            });

            // Add to accumulated capabilities
            if (pageCapabilities && pageCapabilities.length > 0) {
              accumulatedCapabilities.push(...pageCapabilities);
              console.log(`[Section Explorer: ${sectionName}] ✓ Found ${pageCapabilities.length} capabilities on this page`);
            }
          }
          break;

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, args.milliseconds || 2000));
          result = { success: true };
          break;

        case 'click': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            result = { success: false, error: `Element not found: ${args.elementId}` };
            break;
          }

          let locator;
          if (elementInfo.role && elementInfo.name) {
            locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
          } else {
            result = { success: false, error: 'Cannot construct locator' };
            break;
          }

          if (args.index > 0) {
            locator = locator.nth(args.index);
          } else {
            locator = locator.first();
          }

          try {
            await locator.click({ timeout: 5000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});

            // Mark as visited
            visitedElements.add(args.elementId);

            result = { success: true };
          } catch (error: any) {
            result = { success: false, error: error.message };
          }
          break;
        }

        case 'resolveElement': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            result = { success: false, error: `Element not found: ${args.elementId}` };
            break;
          }

          const locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
          const count = await locator.count();

          const matches = [];
          for (let i = 0; i < Math.min(count, 5); i++) {
            const element = locator.nth(i);
            const text = await element.textContent().catch(() => '');
            const visible = await element.isVisible().catch(() => false);

            matches.push({
              index: i,
              text: text?.trim() || elementInfo.name,
              details: visible ? 'visible' : 'hidden',
            });
          }

          result = { success: true, matches };
          break;
        }

        case 'getText': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            result = { success: false, error: `Element not found: ${args.elementId}` };
            break;
          }

          const locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
          const text = await locator.textContent({ timeout: 5000 });

          result = { success: true, text: text || '' };
          break;
        }

        case 'goBack':
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
          result = { success: true, url: page.url() };
          break;

        case 'screenshot':
          await page.screenshot({ type: 'png' });
          result = { success: true };
          break;

        case 'pressEscape':
          await page.keyboard.press('Escape');
          await new Promise(resolve => setTimeout(resolve, 500));
          result = { success: true };
          break;

        default:
          result = { success: false, error: `Unknown tool: ${toolName}` };
      }

      return result;
    };

    // Call AI
    const result = await generateWithRookieAI({
      prompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 16384,
      tools,
      toolExecutor,
      maxToolCalls: 30, // Each section agent gets 30 iterations
    });

    console.log(`[Section Explorer: ${sectionName}] Exploration complete`);
    console.log('  - Tool calls:', result.toolCalls?.length || 0);
    console.log('  - Pages analyzed:', snapshotCount);
    console.log('  - Total capabilities found:', accumulatedCapabilities.length);

    if ((result.toolCalls?.length || 0) < 3) {
      console.warn(`[Section Explorer: ${sectionName}] ⚠️ Agent gave up too early (only ${result.toolCalls?.length || 0} tool calls)`);
      return {
        success: false,
        sectionName,
        error: `Agent gave up after ${result.toolCalls?.length || 0} tool calls`,
        toolCalls: result.toolCalls?.length || 0,
      };
    }

    // Return accumulated capabilities (built up page-by-page during exploration)
    const summary = accumulatedCapabilities.length > 0
      ? `Explored ${sectionName} section, analyzed ${snapshotCount} pages, found ${accumulatedCapabilities.length} data capabilities`
      : `Explored ${sectionName} section, analyzed ${snapshotCount} pages, all items were restricted or non-data pages`;

    return {
      success: true,
      sectionName,
      capabilities: accumulatedCapabilities,
      explorationSummary: summary,
      toolCalls: result.toolCalls?.length || 0,
    };
  } catch (error: any) {
    console.error(`[Section Explorer: ${sectionName}] Error:`, error);
    return {
      success: false,
      sectionName,
      error: error.message,
    };
  }
}
