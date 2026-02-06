/**
 * SCOUT - Initial Site Discovery Agent
 *
 * Explores the main page of a website after login and identifies
 * major menu sections for parallel exploration by EXPLORER agents.
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { Page } from 'playwright-core';

export interface MenuSection {
  name: string; // Section name (e.g., "Sales", "Inventory")
  elementId: string; // @e reference for clicking
  description?: string; // What this section likely contains
}

export interface ScoutResult {
  success: boolean;
  siteName?: string;
  siteType?: string; // ERP, Banking, etc.
  sections?: MenuSection[]; // Menu sections discovered
  error?: string;
  toolCalls?: number;
}

interface LoginFieldDiscovery {
  fields: Array<{
    name: string;
    elementId: string;
    type: 'text' | 'password' | 'other';
  }>;
  submitButton: string;
}

/**
 * Scout a website to discover main menu sections
 */
export async function scoutWebsite(params: {
  page: Page; // Browser page (already navigated and logged in)
  url: string;
}): Promise<ScoutResult> {
  const { page, url } = params;

  try {
    console.log('[Scout] Starting site discovery...');
    console.log('  - URL:', url);

    // Build system prompt
    const systemPrompt = `You are **Scout**, an AI agent that discovers the main structure of a website.

Your job: Identify the major menu sections on this site so other agents can explore them in parallel.

**CRITICAL:** You MUST call submitSections() with your findings. Do NOT just return text!

You have browser automation tools:
- snapshot() - Get current page elements (@e1, @e2 refs)
- wait(milliseconds) - Wait for page to load
- click(elementId, index?) - Click an element
- resolveElement(elementId) - See all matching elements
- getText(elementId) - Get text from element
- pressEscape() - Close popups/modals
- screenshot() - Take a screenshot
- submitSections() - **REQUIRED** - Submit discovered menu sections (YOU MUST CALL THIS!)

**Your Mission:**
Scan the main page and identify 5-10 major menu sections (like Sales, Inventory, Reports, Accounting, etc.)

**Important workflow:**
1. Call snapshot() to see elements
2. Identify menu sections from the snapshot
3. **MUST** call submitSections() with the sections (not text response!)

**What is a "menu section"?**
Menu sections are the top-level navigation items on a website. Examples:
- "Sales" "Inventory" "Reports" "Accounting" "Transactions" "Dashboard"
- "영업" "재고" "보고서" "회계" "거래" "대시보드" "그룹웨어" "세무" "관리" "데이터센터"
- Usually found in: top navigation bar, left sidebar, main menu area
- Usually links or buttons that lead to different areas of the site

**EXAMPLES - YES these ARE menu sections:**
✓ @e7: '그룹웨어' → Menu section (groupware module)
✓ @e8: '회계 I' → Menu section (accounting module)
✓ @e9: '세무' → Menu section (tax module)
✓ @e10: '재고 I' → Menu section (inventory module)
✓ @e11: '회계 II' → Menu section (accounting module 2)
✓ @e12: '관리' → Menu section (management module)

**EXAMPLES - NO these are NOT menu sections:**
✗ @e1: 'SITE MAP' → Utility button, not a main section
✗ @e2: '위젯 초기화' → Settings button, not a main section
✗ @e5: 'MyPage' → Profile link, not a main section
✗ @e32: '신청' → Action button, not a main section
✗ @e33: '약도' → Action button, not a main section

**How to find menu sections:**
1. Take snapshot() to see all elements
2. Look for links with business module names (회계, 재고, 영업, 세무, 관리, etc.)
3. Ignore: Settings, Help, Profile, MyPage, 권한, 위젯, 신청, 약도, Self-Customizing
4. For each menu section found, create entry with name, elementId, description

**Important:**
- If snapshot shows 0 elements, call wait(2000) and try snapshot() again
- Look for 5-10 main sections (not every single link!)
- Focus on data/business sections (Sales, Inventory, Reports)
- Skip Settings, Help, Profile, Account sections
- Use element IDs from snapshot (@e1, @e2, etc.)

**Don't give up!** If you don't see obvious menus, look for:
- Links with business terms
- Navigation sidebars
- Main content area buttons
- Dashboard sections

Start by taking a snapshot.`;

    const prompt = `Discover the main menu sections on this website: ${url}

**STEP 1:** Take snapshot() to see all elements

**STEP 2:** Look through the snapshot results and identify the main menu sections.

**What are menu sections?** Look for links with these characteristics:
- Business/system area names like: Sales, Inventory, Reports, Accounting, Dashboard
- Korean equivalents: 영업, 재고, 보고서, 회계, 관리, 데이터센터, 세무
- Usually appear early in the element list (often @e5 through @e15)
- Look like top-level navigation items
- NOT: Settings, Help, Profile, MyPage, Self-Customizing, 권한, 위젯, 신청, 약도

**STEP 3:** For EACH menu section found, create an entry with:
- name: The text from the element (e.g., "회계 I", "재고 I", "Sales")
- elementId: The @e ID from snapshot (e.g., "@e8")
- description: Brief guess what it contains

**STEP 4:** Call submitSections() with ALL the menu sections you found.

**Example:**
If snapshot shows: @e7:그룹웨어, @e8:회계 I, @e9:세무, @e10:재고 I, @e11:회계 II, @e12:관리
Then call: submitSections({
  siteName: "Company Name",
  siteType: "ERP",
  sections: [
    { name: "그룹웨어", elementId: "@e7", description: "Groupware features" },
    { name: "회계 I", elementId: "@e8", description: "Accounting module" },
    { name: "세무", elementId: "@e9", description: "Tax module" },
    ...
  ]
})

**Do NOT just return text - you MUST call submitSections() with the menu items you find!**`;

    let discoveredSections: MenuSection[] = [];
    let siteName = '';
    let siteType = '';

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

      for (const { role, selector } of interactiveSelectors) {
        const locators = await page.locator(selector).all();
        console.log(`[Scout] Scanning ${role}: found ${locators.length} elements`);

        for (const locator of locators) {
          try {
            const isVisible = await locator.isVisible().catch(() => false);
            if (!isVisible) continue;

            const text = await locator.textContent().catch(() => '');
            const ariaLabel = await locator.getAttribute('aria-label').catch(() => '');
            const name = text?.trim() || ariaLabel || '';

            if (!name) continue;

            const elementId = `@e${++elementCounter}`;
            elements.push({
              id: elementId,
              role,
              name: name.substring(0, 100),
              interactable: true,
            });

            elementMap.set(elementId, { role, name });
          } catch (error) {
            continue;
          }
        }
      }

      console.log(`[Scout] Snapshot created: ${elements.length} total elements`);
      console.log(`[Scout] Sample elements:`, elements.slice(0, 5).map(e => `${e.id}:${e.name.substring(0, 30)}`));

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
            description: 'Get current page elements',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'wait',
            description: 'Wait for milliseconds',
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
            description: 'Click an element',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string' },
                index: { type: 'number' },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'resolveElement',
            description: 'See all matching elements',
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
            name: 'screenshot',
            description: 'Take screenshot',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'pressEscape',
            description: 'Press Escape key',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'submitSections',
            description: 'Submit discovered menu sections',
            parameters: {
              type: 'object',
              properties: {
                siteName: {
                  type: 'string',
                  description: 'Website/system name',
                },
                siteType: {
                  type: 'string',
                  description: 'Type: ERP, Banking, E-commerce, etc.',
                },
                sections: {
                  type: 'array',
                  description: 'Menu sections discovered',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Section name' },
                      elementId: { type: 'string', description: 'Element ID from snapshot' },
                      description: { type: 'string', description: 'What this section contains' },
                    },
                    required: ['name', 'elementId'],
                  },
                },
              },
              required: ['siteName', 'siteType', 'sections'],
            },
          },
        ],
      },
    ];

    // Tool executor
    const toolExecutor = async (toolName: string, args: any) => {
      console.log(`[Scout] Executing: ${toolName}`, args);

      switch (toolName) {
        case 'snapshot':
          return await createSnapshot();

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, args.milliseconds || 2000));
          return { success: true };

        case 'click': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            return { success: false, error: `Element not found: ${args.elementId}` };
          }

          let locator;
          if (elementInfo.role && elementInfo.name) {
            locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
          } else {
            return { success: false, error: 'Cannot construct locator' };
          }

          if (args.index > 0) {
            locator = locator.nth(args.index);
          } else {
            locator = locator.first();
          }

          await locator.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});

          return { success: true };
        }

        case 'resolveElement': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            return { success: false, error: `Element not found: ${args.elementId}` };
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

          return { success: true, matches };
        }

        case 'getText': {
          const elementInfo = elementMap.get(args.elementId);
          if (!elementInfo) {
            return { success: false, error: `Element not found: ${args.elementId}` };
          }

          const locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
          const text = await locator.textContent({ timeout: 5000 });

          return { success: true, text: text || '' };
        }

        case 'screenshot':
          await page.screenshot({ type: 'png' });
          return { success: true };

        case 'pressEscape':
          await page.keyboard.press('Escape');
          await new Promise(resolve => setTimeout(resolve, 500));
          return { success: true };

        case 'submitSections':
          if (!args.sections || args.sections.length === 0) {
            console.log('[Scout] ❌ Rejecting empty section submission');
            return {
              success: false,
              error: 'You must find at least 1 menu section before submitting. Look harder at the snapshot - there should be navigation menus, links, or buttons for different sections of the site. Try looking for links with business-related names.',
            };
          }

          discoveredSections = args.sections;
          siteName = args.siteName;
          siteType = args.siteType;
          console.log('[Scout] ✓ Sections submitted:', discoveredSections.length);
          console.log('[Scout] Section names:', discoveredSections.map(s => s.name).join(', '));
          return {
            success: true,
            message: `Successfully submitted ${discoveredSections.length} sections`,
          };

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // Call AI
    const result = await generateWithRookieAI({
      prompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 8192,
      tools,
      toolExecutor,
      maxToolCalls: 20, // Limited scope - just discovery
    });

    console.log('[Scout] Discovery complete');
    console.log('  - Tool calls:', result.toolCalls?.length || 0);
    console.log('  - Sections found:', discoveredSections.length);

    if (discoveredSections.length === 0) {
      return {
        success: false,
        error: 'No menu sections discovered',
        toolCalls: result.toolCalls?.length || 0,
      };
    }

    return {
      success: true,
      siteName,
      siteType,
      sections: discoveredSections,
      toolCalls: result.toolCalls?.length || 0,
    };
  } catch (error: any) {
    console.error('[Scout] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
