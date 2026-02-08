/**
 * EXECUTOR - Phase 5: Navigation Plan Executor
 *
 * Takes a navigation plan and executes it to extract missing data from websites.
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { chromium, Browser, Page } from 'playwright-core';
import { NavigationPlan } from './ai-navigator';
import * as fs from 'fs';
import * as path from 'path';

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

export interface ExecutorResult {
  success: boolean;
  extractedData?: any; // The data extracted from website
  executionLog?: string[]; // Step-by-step log of what happened
  screenshots?: string[];
  error?: string;
  toolCalls?: number;
  needsLogin?: boolean; // If credentials needed
  loginFields?: any; // Login fields discovered
}

// Singleton browser for resume capability
let executorBrowser: Browser | null = null;
let executorPage: Page | null = null;
let executorApiKey: string | null = null;

/**
 * Execute a navigation plan to extract data from website
 */
export async function executeNavigationPlan(params: {
  plan: NavigationPlan;
  url: string;
  credentials?: { username: string; password: string };
  credentialValues?: Record<string, string>;
  explorerCapabilities?: any[]; // Full sitemap from EXPLORER
}): Promise<ExecutorResult> {
  const { plan, url, credentials, credentialValues, explorerCapabilities } = params;

  try {
    console.log('[Executor] Starting plan execution...');
    console.log('  - Goal:', plan.goal);
    console.log('  - Steps:', plan.steps.length);
    console.log('  - URL:', url);

    // Get API key for Vision AI (same logic as rookie-ai-handler)
    const { getStore } = await import('../storage');
    const store = getStore();
    const aiKeys = store.get('ai-keys', []);

    // Find Google API key (prefer 'egdesk' named key, then active, then any)
    const googleKey =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.fields?.apiKey);

    if (!googleKey?.fields?.apiKey) {
      throw new Error('No Google API key found');
    }

    executorApiKey = googleKey.fields.apiKey.trim();
    console.log('[Executor] API Key loaded:', `${executorApiKey.substring(0, 8)}...${executorApiKey.substring(executorApiKey.length - 4)}`);

    // Launch browser only if not already open
    if (!executorBrowser || !executorPage) {
      console.log('[Executor] Launching new browser...');
      const chromePath = getChromePath();
      executorBrowser = await chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: ['--disable-blink-features=AutomationControlled'],
      });

      const context = await executorBrowser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      executorPage = await context.newPage();

      console.log('[Executor] Navigating to:', url);
      await executorPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('[Executor] Reusing existing browser session');
    }

    const page = executorPage;
    console.log('[Executor] Starting AI execution with navigation plan...');

    // Build system prompt with the navigation plan
    const systemPrompt = `You are **Executor**, an AI agent that follows navigation plans to extract data from websites.

**Your Mission:** Execute the following navigation plan to extract: ${plan.goal}

**Navigation Plan:**
${plan.steps.map(s => `${s.step}. ${s.action} → ${s.purpose}`).join('\n')}

**ERP NAVIGATION KNOWLEDGE:**
Korean ERP systems organize pages by function. Know the difference:

✅ **DATA VIEWING PAGES** (where you'll find the answer):
- 조회 (Inquiry) - Query and view existing data
- 현황 (Status) - View status reports
- 리스트 (List) - View list of records
- 내역 (History) - View transaction history
- Examples: 판매조회, 거래처조회, 재고현황

❌ **DATA CREATION PAGES** (wrong - these don't show existing data):
- 등록 (Register) - Create new records
- 입력 (Input) - Enter new data
- 수정 (Edit) - Modify data
- Examples: 거래처등록, 품목등록, 전표입력

**If you accidentally navigate to 등록/입력 page → Call goBack() immediately!**

You have these tools:

**GUIDANCE TOOLS (use these for help):**
- **askNavigator(question)** - Ask NAVIGATOR AI for guidance (it knows the full sitemap!)
- **screenshot()** - Get Vision AI decision on current page

**BROWSER TOOLS:**
- snapshot() - Get clickable elements (buttons, links, inputs)
- requestLoginCredentials(fields, submitButton) - Discover login fields
- loginWithCredentials() - Login with stored credentials
- wait(milliseconds) - Wait for page to load
- click(elementId, index?) - Click an element (use @e IDs from snapshot)
- resolveElement(elementId) - See all matching elements
- getText(elementId) - Get text from element
- goBack() - Browser back button
- pressEscape() - Close popups/modals
- submitData() - Submit extracted data (REQUIRED when done)

**Smart Navigation Strategy:**
1. **Start:** askNavigator("What sections have Excel export for sales and purchase data?")
2. **Navigate:** to suggested section (usually 조회/현황 pages)
3. **Analyze:** screenshot() to see both the data AND the download button
4. **If PARTIAL:** askNavigator("Where else can I download related data?")
5. **If EXPLORE_MORE:** Follow Vision's suggested click (might be to load data before download)
6. **If COMPLETE:** submitData() with definition + download workflow

**Example askNavigator Questions:**
- "What sections have Excel download capabilities for sales data?"
- "Where can I download purchase transaction data as Excel?"
- "Which sections allow exporting customer classification data?"
- "I need to download Sell-out and Sell-in data - which sections support Excel export?"

**HOW TO USE VISION AI:**
1. Navigate to a page (e.g., click 판매조회)
2. Call screenshot() → Vision AI analyzes and returns DECISION
3. **Follow Vision's recommendation exactly:**
   - COMPLETE → Call submitData() with Vision's findings
   - PARTIAL/EXPLORE_MORE → Click the @e element Vision suggests
   - WRONG_PATH → Call goBack()
4. Repeat until Vision says COMPLETE

**Vision AI is your guide - trust its decisions!**

Start by taking a snapshot to see what page you're on.`;

    const prompt = `Your goal: ${plan.goal}

**What to find:** ${plan.missingData.join(', ')}

${plan.context ? `**Context:** ${plan.context}` : ''}

${plan.notes ? `**Important Notes:** ${plan.notes}` : ''}

**YOUR MISSION:**
${plan.goal}

**You have TWO AI assistants:**
1. **NAVIGATOR** - Knows the complete sitemap (all 75+ sections and their data)
2. **VISION AI** - Can analyze screenshots to see data tables and guide decisions

**Recommended Strategy:**
1. Login (if needed)
2. **Ask NAVIGATOR for guidance first:** "What sections should I explore to understand Sell-out vs Sell-in?"
3. Navigate to suggested sections
4. Use screenshot() to analyze what you see
5. Form hypothesis based on observations
6. **If stuck:** askNavigator("Where else can I find related data?")
7. **When confident:** submitData() with your hypothesis

**Key Insight:**
- Don't assume what these terms mean!
- Explore different transaction types (sales, purchases, etc.)
- Look for patterns and relationships
- Form your own conclusion based on evidence

**WORKFLOW:**
1. Take snapshot() to see what page you're on
2. If login page: requestLoginCredentials() or loginWithCredentials()
3. **Ask NAVIGATOR for guidance:** "What sections should I explore?"
4. Navigate to suggested sections
5. Use screenshot() to get Vision AI decisions
6. Follow Vision's recommendations
7. submitData() when you have enough information

Start by taking a snapshot.`;

    let extractedData: any = null;
    const screenshots: string[] = [];
    const executionLog: string[] = [];
    let discoveredLoginFields: any = null;

    // Track which sections have been visited (for Sell-out/Sell-in goal)
    const visitedSections = {
      sales: false,  // 판매현황/판매조회
      purchase: false, // 구매현황/구매조회
    };

    // Create element map for semantic locators
    const elementMap = new Map<string, { role: string; name: string }>();
    let elementCounter = 0;

    // Helper to create snapshot
    const createSnapshot = async () => {
      elementMap.clear();
      elementCounter = 0;

      const url = page.url();
      const title = await page.title();
      const elements: any[] = [];

      const interactiveSelectors = [
        { role: 'button', selector: 'button, [role="button"], input[type="button"], input[type="submit"]' },
        { role: 'link', selector: 'a[href]' },
        { role: 'textbox', selector: 'input[type="text"], input[type="email"], input[type="search"], textarea' },
      ];

      for (const { role, selector } of interactiveSelectors) {
        const locators = await page.locator(selector).all();

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

      console.log(`[Executor] Snapshot: ${elements.length} elements`);

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
            name: 'requestLoginCredentials',
            description: 'Call this when you see a login page and need credentials.',
            parameters: {
              type: 'object',
              properties: {
                fields: {
                  type: 'array',
                  description: 'Login fields discovered',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      elementId: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['name', 'elementId', 'type'],
                  },
                },
                submitButton: {
                  type: 'string',
                  description: 'Element ID of submit button',
                },
              },
              required: ['fields', 'submitButton'],
            },
          },
          {
            name: 'loginWithCredentials',
            description: 'Login to the website using stored credentials (only if credentials already provided)',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
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
            description: 'Click an element by ID',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string', description: 'Element ID from snapshot' },
                index: { type: 'number', description: 'Which match to click' },
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
            name: 'goBack',
            description: 'Browser back button',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'screenshot',
            description: 'Take screenshot and get Vision AI DECISION. Vision AI analyzes the page visually and returns a structured decision with: status (COMPLETE/PARTIAL/EXPLORE_MORE/WRONG_PATH), findings (what was found), recommended action (SUBMIT_DATA/CLICK/GO_BACK), target element to click, and reasoning. Use this when you reach a data page to check if you found what you need or if you should explore further. Vision AI can SEE data tables, columns, and values that snapshot() cannot.',
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
            name: 'askNavigator',
            description: 'Ask NAVIGATOR for guidance on where to find specific data. NAVIGATOR has the full website sitemap and can tell you which sections/paths have the data you need. Use this when you are unsure where to navigate or what to look for.',
            parameters: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'Your question about where to find data or what sections to explore',
                },
              },
              required: ['question'],
            },
          },
          {
            name: 'submitData',
            description: 'Submit extracted data when done',
            parameters: {
              type: 'object',
              properties: {
                findings: {
                  type: 'string',
                  description: 'What you discovered about the missing data',
                },
                extractedData: {
                  type: 'object',
                  description: 'The actual data extracted (if any)',
                },
              },
              required: ['findings'],
            },
          },
        ],
      },
    ];

    // Tool executor (apiKey is in scope from outer function)
    const toolExecutor = async (toolName: string, args: any) => {
      console.log(`[Executor] Executing: ${toolName}`);
      executionLog.push(`${toolName}(${JSON.stringify(args).substring(0, 50)})`);

      switch (toolName) {
        case 'requestLoginCredentials': {
          // AI discovered login fields and needs user input
          discoveredLoginFields = {
            fields: args.fields,
            submitButton: args.submitButton,
          };
          console.log('[Executor] Login fields discovered:', discoveredLoginFields);
          console.log('[Executor] 🛑 User needs to provide credentials');

          executionLog.push('  → Login page detected, requesting credentials from user');

          return {
            success: true,
            message: `Credential request recorded. You discovered ${args.fields.length} login fields. User will be prompted to provide credentials.`,
            fieldsDiscovered: args.fields.map((f: any) => f.name),
          };
        }

        case 'loginWithCredentials': {
          console.log('[Executor] AI requested login with stored credentials...');
          if (!credentials && !credentialValues) {
            return {
              success: false,
              error: 'No credentials available. Call requestLoginCredentials() first to ask user for credentials.'
            };
          }

          try {
            const currentUrl = page.url();
            console.log('[Executor] Current URL before login:', currentUrl);

            await handleLogin(page, credentials, credentialValues);

            // Wait for navigation to complete (up to 10 seconds)
            console.log('[Executor] Waiting for login navigation...');
            await page.waitForURL((url) => url !== currentUrl, { timeout: 10000 }).catch(() => {
              console.warn('[Executor] URL did not change after login');
            });

            // Additional wait for page to fully load
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 2000));

            const newUrl = page.url();
            console.log('[Executor] ✓ Login complete, now at:', newUrl);
            executionLog.push('  → Logged in successfully');
            return {
              success: true,
              message: `Login successful - navigated from ${currentUrl} to ${newUrl}. You are now on the main dashboard.`,
            };
          } catch (error: any) {
            return { success: false, error: `Login failed: ${error.message}` };
          }
        }

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

          executionLog.push(`  → Clicked ${elementInfo.name}`);
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

        case 'goBack':
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
          executionLog.push(`  → Went back to: ${page.url()}`);
          return { success: true, url: page.url() };

        case 'screenshot': {
          // Wait a moment for page to be stable before screenshot
          await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 1000));

          const currentUrl = page.url();
          console.log('[Executor] Taking screenshot of:', currentUrl);

          const screenshot = await page.screenshot({ type: 'png' });
          const base64 = screenshot.toString('base64');
          screenshots.push(base64);

          console.log('[Executor] Screenshot captured, analyzing with Vision AI Decision System...');

          // Get available elements from current snapshot for Vision AI to reference
          // Group by role for better clarity
          const buttons = Array.from(elementMap.entries())
            .filter(([_, info]) => info.role === 'button')
            .map(([id, info]) => `  ${id}: "${info.name}"`);

          const links = Array.from(elementMap.entries())
            .filter(([_, info]) => info.role === 'link')
            .map(([id, info]) => `  ${id}: "${info.name}"`);

          const availableElements = `
Available Clickable Elements from Latest Snapshot:

LINKS (navigation):
${links.slice(0, 20).join('\n') || '  (none)'}

BUTTONS (actions):
${buttons.slice(0, 15).join('\n') || '  (none)'}

When recommending CLICK, use these exact element IDs (e.g., "@e5", "@e12").
Match the Korean text you SEE in the screenshot to the names above to find the right element ID.`;

          // Analyze screenshot with Gemini Vision Decision System
          try {
            if (!executorApiKey) {
              throw new Error('API key not available');
            }

            const visionDecisionJson = await analyzeScreenshot(
              base64,
              executorApiKey,
              plan.goal,
              availableElements, // Pass current snapshot elements
              visitedSections // Pass tracking info
            );
            const decision = JSON.parse(visionDecisionJson);

            console.log('[Executor] ✓ Vision decision:', decision.status);
            console.log('[Executor]   - Findings:', decision.findings.substring(0, 100));
            console.log('[Executor]   - Recommended action:', decision.action);
            if (decision.target) {
              console.log('[Executor]   - Target:', decision.target);
            }

            // Update visited sections tracking based on Vision's page type detection
            if (decision.pageType === 'sales') {
              visitedSections.sales = true;
              console.log('[Executor]   - Vision identified this as sales-related page');
            }
            if (decision.pageType === 'purchase') {
              visitedSections.purchase = true;
              console.log('[Executor]   - Vision identified this as purchase-related page');
            }

            // Format decision for main AI
            const progressNote = visitedSections.sales && visitedSections.purchase
              ? '✅ You have now explored both sales-related and purchase-related pages. You have enough context to form a hypothesis.'
              : visitedSections.sales
              ? '📍 Progress: You explored a sales-related page. Consider exploring purchase-related pages for comparison.'
              : visitedSections.purchase
              ? '📍 Progress: You explored a purchase-related page. Consider exploring sales-related pages for comparison.'
              : '📍 Progress: Start exploring. Look at sales, purchase, and customer sections to understand patterns.';

            const decisionMessage = `
📸 VISION AI ANALYSIS:
Current URL: ${currentUrl}

${progressNote}

Page Type Identified: ${decision.pageType}
Status: ${decision.status}
Findings: ${decision.findings}

Recommended Action: ${decision.action}
${decision.target ? `Suggested Target: ${decision.target}` : ''}
Reason: ${decision.reason}

${decision.status === 'COMPLETE' ? '✅ Vision AI believes you have enough information. Call submitData() with your hypothesis about Sell-out vs Sell-in.' : ''}
${decision.status === 'PARTIAL' ? '🟡 ' + decision.reason : ''}
${decision.status === 'EXPLORE_MORE' ? '🔍 ' + decision.reason : ''}
${decision.status === 'WRONG_PATH' ? '❌ ' + decision.reason : ''}

${decision.findings.toLowerCase().includes('login') && currentUrl.includes('login') === false ? '⚠️ WARNING: Vision sees login page but URL suggests otherwise. The page may not have loaded correctly. Try snapshot() to see current elements.' : ''}
`;

            executionLog.push(`  → Vision Decision: ${decision.status} - ${decision.findings.substring(0, 80)}`);

            return {
              success: true,
              screenshotIndex: screenshots.length - 1,
              decision: decision,
              guidance: decisionMessage,
            };
          } catch (error: any) {
            console.error('[Executor] Screenshot analysis failed:', error.message);
            return {
              success: true,
              screenshotIndex: screenshots.length - 1,
              guidance: 'Screenshot taken but vision analysis failed. Try using snapshot() and getText() to explore manually.'
            };
          }
        }

        case 'pressEscape':
          await page.keyboard.press('Escape');
          await new Promise(resolve => setTimeout(resolve, 500));
          return { success: true };

        case 'askNavigator': {
          console.log('[Executor] EXECUTOR asking NAVIGATOR:', args.question);
          executionLog.push(`  → Asked NAVIGATOR: ${args.question.substring(0, 80)}`);

          try {
            // Call NAVIGATOR AI with full sitemap to answer EXECUTOR's question
            const navigatorResponse = await askNavigatorForGuidance(
              args.question,
              plan.goal,
              explorerCapabilities || [],
              executorApiKey!
            );

            console.log('[Executor] NAVIGATOR response:', navigatorResponse.substring(0, 150));
            executionLog.push(`  → NAVIGATOR: ${navigatorResponse.substring(0, 80)}`);

            return {
              success: true,
              guidance: navigatorResponse,
            };
          } catch (error: any) {
            console.error('[Executor] askNavigator failed:', error.message);
            return {
              success: false,
              error: 'NAVIGATOR unavailable. Try exploring on your own.',
            };
          }
        }

        case 'submitData':
          extractedData = {
            findings: args.findings,
            data: args.extractedData,
          };
          console.log('[Executor] Data submitted');
          executionLog.push('✓ Data extraction complete');
          return { success: true, message: 'Data received' };

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // Call AI with the navigation plan
    // Note: We use a custom call here instead of generateWithRookieAI to avoid periodic summarization
    // which would make AI forget it already logged in
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(executorApiKey!);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384,
      },
      systemInstruction: systemPrompt,
      tools,
    });

    const chat = model.startChat({ history: [] });

    console.log('[Executor] Starting AI execution (no periodic summarization)...');

    let result = await chat.sendMessage(prompt.trim());
    let iteration = 0;
    const maxToolCalls = 50;

    // Tool calling loop (without periodic summarization!)
    while (iteration < maxToolCalls) {
      iteration++;

      const response = result.response;
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        console.log('[Executor] AI finished (no more tool calls)');
        break;
      }

      console.log(`[Executor] Iteration ${iteration}: ${functionCalls.length} tool call(s)`);

      // Execute tools
      const functionResponses = await Promise.all(
        functionCalls.map(async (call: any) => {
          const toolResult = await toolExecutor(call.name, call.args);
          return {
            functionResponse: {
              name: call.name,
              response: toolResult,
            },
          };
        })
      );

      // Send results back
      result = await chat.sendMessage(functionResponses);
    }

    console.log('[Executor] AI execution loop complete');
    console.log('  - Total iterations:', iteration);

    console.log('[Executor] Execution complete');
    console.log('  - Total iterations:', iteration);
    console.log('  - Screenshots:', screenshots.length);
    console.log('  - Login fields discovered:', !!discoveredLoginFields);
    console.log('  - Data extracted:', !!extractedData);

    // Check if login fields were discovered (PRIORITY CHECK)
    if (discoveredLoginFields) {
      console.log('[Executor] ✓ Login page detected - needs user credentials');
      console.log('  - Fields:', discoveredLoginFields.fields.map((f: any) => f.name).join(', '));
      console.log('[Executor] 🔒 Browser staying open - will resume after user provides credentials');

      // Keep browser open for resume (executorBrowser/executorPage singletons)

      return {
        success: true,
        needsLogin: true,
        loginFields: discoveredLoginFields,
        executionLog,
        toolCalls: iteration,
      };
    }

    // Close browser (only if login fields NOT discovered)
    if (executorBrowser) {
      await executorBrowser.close();
      executorBrowser = null;
      executorPage = null;
      executorApiKey = null;
    }

    if (!extractedData) {
      return {
        success: false,
        error: 'AI did not submit extracted data',
        executionLog,
        toolCalls: iteration,
      };
    }

    return {
      success: true,
      extractedData,
      executionLog,
      screenshots,
      toolCalls: iteration,
    };
  } catch (error: any) {
    console.error('[Executor] Error:', error);

    // Clean up on error
    if (executorBrowser) {
      await executorBrowser.close().catch(() => {});
      executorBrowser = null;
      executorPage = null;
      executorApiKey = null;
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Close executor browser (for cleanup)
 */
export async function closeExecutorBrowser(): Promise<void> {
  if (executorBrowser) {
    await executorBrowser.close().catch(() => {});
    executorBrowser = null;
    executorPage = null;
    executorApiKey = null;
    console.log('[Executor] Browser closed');
  }
}

/**
 * Ask NAVIGATOR for guidance based on EXECUTOR's question
 */
async function askNavigatorForGuidance(
  question: string,
  goal: string,
  siteCapabilities: any[],
  apiKey: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  console.log('[Navigator] EXECUTOR asked:', question);
  console.log('[Navigator] Consulting sitemap with', siteCapabilities.length, 'capabilities...');

  // Build sitemap summary
  const sitemapSummary = siteCapabilities.map((cap, idx) =>
    `${idx + 1}. ${cap.section} (Path: ${cap.path})
   Data: ${cap.dataAvailable.join(', ')}`
  ).join('\n');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
    },
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{
        text: `You are NAVIGATOR, an AI with knowledge of the complete ERP sitemap.

**Overall Goal:** ${goal}

**EXECUTOR's Question:** ${question}

**Complete Website Sitemap:**
${sitemapSummary}

**Your Task:**
Answer EXECUTOR's question by analyzing the sitemap above. Provide specific, actionable guidance:
- Which section(s) should EXECUTOR navigate to?
- What paths to follow?
- What data to look for?
- Any patterns or insights from the sitemap?

Keep your response concise (2-3 sentences) and actionable.`,
      }],
    }],
  });

  const response = await result.response;
  const guidance = response.text();

  console.log('[Navigator] Provided guidance:', guidance.substring(0, 150));

  return guidance;
}

/**
 * Analyze screenshot with Gemini Vision and return structured decision
 */
async function analyzeScreenshot(
  base64Image: string,
  apiKey: string,
  goal: string,
  availableElements: string,
  visitedSections: { sales: boolean; purchase: boolean }
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  console.log('[Executor] Calling Gemini Vision API for decision...');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['COMPLETE', 'PARTIAL', 'EXPLORE_MORE', 'WRONG_PATH'],
            description: 'Decision on current state'
          },
          pageType: {
            type: 'string',
            enum: ['sales', 'purchase', 'other'],
            description: 'Type of page: sales (판매), purchase (구매), or other'
          },
          findings: {
            type: 'string',
            description: 'What you found on this page'
          },
          action: {
            type: 'string',
            enum: ['SUBMIT_DATA', 'CLICK', 'GO_BACK'],
            description: 'Recommended next action'
          },
          target: {
            type: 'string',
            description: 'Element ID to click from the available elements list (e.g. "@e25")'
          },
          reason: {
            type: 'string',
            description: 'Why this action is recommended'
          },
          dataFound: {
            type: 'object',
            description: 'Data understanding and download method (if status is COMPLETE)',
            properties: {
              sellOutDefinition: { type: 'string', description: 'What does Sell-out mean?' },
              sellInDefinition: { type: 'string', description: 'What does Sell-in mean?' },
              reasoning: { type: 'string', description: 'Why you believe this' },
              excelDownloadAvailable: { type: 'boolean', description: 'Is Excel download button visible?' },
              downloadButtonLocation: { type: 'string', description: 'Where is the download button? (e.g., top-right toolbar, @e25)' },
              downloadWorkflow: { type: 'string', description: 'Steps to download: navigate to X, apply filters, click download' },
            }
          }
        },
        required: ['status', 'pageType', 'findings', 'action', 'reason']
      }
    }
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        {
          text: `You are a navigation decision AI analyzing an ERP screenshot.

**Goal:** ${goal}

**Exploration Progress:**
- Explored sales-related page: ${visitedSections.sales ? 'YES' : 'Not yet'}
- Explored purchase-related page: ${visitedSections.purchase ? 'YES' : 'Not yet'}

${availableElements}

**ERP DOMAIN KNOWLEDGE - What Pages Have Data:**

✅ **DATA PAGES (Good - these have viewable data):**
- 조회 (Inquiry) - View existing data/transactions
- 현황 (Status) - View current status/reports
- 리스트 (List) - View list of records
- 보고서 (Report) - View reports
- 내역 (History) - View transaction history
- Examples: 판매조회, 거래처조회, 재고현황, 거래내역

❌ **NON-DATA PAGES (Bad - these are for creating/editing):**
- 등록 (Register) - Create new records
- 입력 (Input) - Enter new data
- 수정 (Edit) - Modify existing data
- 설정 (Settings) - Configuration
- Examples: 거래처등록, 품목등록, 전표입력

**If you see 등록/입력/수정 pages, that's WRONG_PATH! Go back and find 조회/현황/리스트 pages instead.**

**Your Task:** Analyze this screenshot and decide what to do next.

**Analysis Steps:**

1. **Check page type:**
   - Is this 조회/현황/리스트 (data viewing) page? ✅ Continue analyzing
   - Is this 등록/입력/수정 (data creation) page? ❌ Return WRONG_PATH immediately!

2. **Identify the transaction type on this page:**
   What type of business activity does this page represent?
   - Is this about SALES (판매, 매출)? → Outbound transactions, customers (거래처)
   - Is this about PURCHASES (구매, 매입)? → Inbound transactions, suppliers (공급처, 매입처)
   - Is this about INVENTORY (재고)? → Stock levels
   - Is this about ACCOUNTING (회계)? → Financial records
   - Other?

3. **Look for Excel download/export buttons:** (CRITICAL!)
   - Can you see buttons with text: 엑셀, Excel, 다운로드, Download, Export, 내보내기?
   - Where is the download button located? (toolbar, top-right, bottom?)
   - Is it accessible or grayed out?
   - Does it require filters/settings to be applied first?

4. **Analyze data characteristics:**
   If this is a data page, note:
   - Transaction type: Sales (판매), Purchase (구매), Inventory (재고)?
   - Counterparty: Customers (거래처), Suppliers (공급처)?
   - Column headers visible
   - What data this represents

4. **If data incomplete, find next element to click:**
   - Look at available elements list
   - Match visual buttons/links to element IDs
   - Prefer: 상세보기 (@eXX), 거래처별 (@eXX), 조회 (@eXX)
   - Avoid: 등록 (@eXX), 입력 (@eXX)

**Return ONE of these decisions:**

**Return ONE of these decisions:**

**COMPLETE:** Found both the definition AND the download method ✅
- You understand what Sell-out and Sell-in mean
- You can SEE the Excel download button (엑셀, Excel, 다운로드, Export)
- You know the complete workflow: which section → which filters → which button to download
- action: "SUBMIT_DATA"
- In dataFound, provide:
  * sellOutDefinition and sellInDefinition
  * downloadSection (where to download Excel)
  * downloadButton (which button to click)
  * downloadWorkflow (step-by-step how to get the Excel file)

**PARTIAL:** Found one piece but need more context 🟡
- You've seen one type of transaction but need to explore other areas
- You have partial understanding but need more data points
- action: "CLICK", target: "@eXX"
- Set pageType to what you're currently on
- Suggest exploring a related but different section to build complete picture
- Pick element that leads to different transaction type or related data

**EXPLORE_MORE:** On a relevant page but need to see actual data 🔍
- Page type is relevant (sales, purchase, customer data)
- But showing empty table, filter form, or summary only
- action: "CLICK", target: "@eXX"
- Pick element that would show detailed data: 조회, 검색, 상세보기, 리스트

**WRONG_PATH:** This page won't help answer the question ❌
- This is 등록/입력/수정 (data creation/editing) page
- Or unrelated section (settings, help, user management)
- action: "GO_BACK"
- Recommend exploring different area

**Analysis Guidance:**
- Look for transaction DIRECTION clues: selling vs buying, outbound vs inbound
- Look for COUNTERPARTY clues: customers vs suppliers, 거래처 vs 공급처
- Look for TERMINOLOGY patterns: What words are used for different transaction types?
- Form your own hypothesis - don't assume the answer!

**If recommending CLICK:** Match visual elements to @e IDs from the available elements list!`,
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
      ],
    }],
  });

  console.log('[Executor] Vision API response received');

  const response = await result.response;
  const decisionText = response.text();

  console.log('[Executor] Vision decision:', decisionText.substring(0, 200));

  return decisionText;
}

/**
 * Simple login handler
 */
async function handleLogin(
  page: Page,
  credentials?: { username: string; password: string },
  credentialValues?: Record<string, string>
): Promise<void> {
  if (credentialValues) {
    // Multi-field login
    console.log('[Executor] Filling multi-field login...');
    const inputs = await page.locator('input[type="text"], input[type="password"], input[type="email"], input:not([type])').all();
    const visibleInputs = [];
    for (const input of inputs) {
      const isVisible = await input.isVisible().catch(() => false);
      if (isVisible) visibleInputs.push(input);
    }

    console.log('[Executor] Found', visibleInputs.length, 'visible inputs');

    let idx = 0;
    for (const [fieldName, fieldValue] of Object.entries(credentialValues)) {
      if (idx < visibleInputs.length) {
        console.log(`[Executor] Filling field ${idx + 1}:`, fieldName);
        await visibleInputs[idx].fill(fieldValue);
        idx++;
      }
    }

    // Find submit/login button - avoid language selectors
    console.log('[Executor] Looking for submit button...');
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const buttonText = text?.trim() || '';

      // Look for login button specifically (not language selector)
      if (buttonText && (
        buttonText.includes('로그인') ||
        buttonText.includes('Login') ||
        buttonText.toLowerCase() === 'login' ||
        buttonText.includes('Sign In') ||
        buttonText.includes('확인')
      )) {
        console.log('[Executor] Found login button:', buttonText);
        await button.click();
        return;
      }
    }

    // Fallback: use last button (but log warning)
    console.warn('[Executor] No login button found by text, using last button');
    if (buttons.length > 0) {
      await buttons[buttons.length - 1].click();
    }
  } else if (credentials) {
    // Simple username/password
    const inputs = await page.locator('input[type="text"], input[type="email"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(credentials.username);
    }

    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill(credentials.password);

    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      if (text && text.includes('Login')) {
        await button.click();
        return;
      }
    }

    if (buttons.length > 0) {
      await buttons[buttons.length - 1].click();
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Save executor results to file
 */
export function saveExecutorResults(result: ExecutorResult, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `execution_${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}
