/**
 * RESEARCHER v1.0 - AI Web Navigation Agent
 *
 * Explores websites to find data matching ROOKIE's requirements
 * Uses agent-browser pattern for 93% context savings
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import { getResearcherBrowser, ResearcherBrowser } from './researcher-browser';

export interface ResearchTask {
  url: string;
  credentialId?: string; // Credential ID - AI never sees actual password
  userNotes?: string; // User guidance/constraints for this site
}

export interface SecureCredentials {
  [credentialId: string]: {
    username: string;
    password: string;
  };
}

export interface LoginFieldDiscovery {
  fields: Array<{
    name: string;
    elementId: string;
    type: 'text' | 'password' | 'other';
  }>;
  submitButton: string; // Element ID
}

export interface SiteCapability {
  section: string; // Menu/section name (e.g., "Sales Reports", "Inventory", "Transactions")
  description: string; // What this section contains
  path: string; // How to get there (e.g., "Menu > Reports > Sales")
  dataAvailable: string[]; // What data/reports are available here
}

export interface ResearchResult {
  success: boolean;
  needsLogin?: boolean; // True if login page detected but credentials not provided
  loginFields?: LoginFieldDiscovery; // Fields discovered on login page
  siteName?: string; // Website name/title
  siteType?: string; // ERP, Banking, E-commerce, etc.
  capabilities?: SiteCapability[]; // What the site can do
  summary?: string; // Overall summary of the site
  screenshots?: string[];
  error?: string;
  toolCalls?: number;
}

/**
 * Research a website to find data
 * Credentials are stored securely and never exposed to AI
 */
export async function researchWebsite(
  task: ResearchTask,
  credentials?: SecureCredentials
): Promise<ResearchResult> {
  const browser = getResearcherBrowser();

  try {
    console.log('[Researcher] Starting website research...');
    console.log('  - URL:', task.url);
    console.log('  - Mode: Site capability mapping');

    // Launch browser
    await browser.launch();

    // Navigate to site
    const navResult = await browser.navigate(task.url);
    if (!navResult.success) {
      throw new Error(`Failed to navigate: ${navResult.error}`);
    }

    console.log('[Researcher] Navigated to:', navResult.url);

    // Build system prompt
    const systemPrompt = `You are **Researcher**, an AI agent that explores websites and maps what they can do.

Your job: Explore the site and document its capabilities - what sections exist, what data is available, what reports can be accessed.

**Important mindset:**
- Don't give up when you hit restricted sections - explore EVERYTHING
- Sites have mixed permissions - some restricted, many accessible
- Skip Settings/Preferences/Help - focus on data sections

You have browser automation tools:
- navigate(url) - Go to a URL
- wait(milliseconds) - Wait for page to load (use if snapshot returns 0 elements)
- goBack() - Browser back button (use if stuck or need to return to previous page)
- goForward() - Browser forward button
- snapshot() - Get current page elements as compact refs (@e1, @e2, etc.)
- click(elementId, index?) - Click an element by its @e ID from snapshot. Use index if multiple matches.
- resolveElement(elementId) - See all matching elements when you get "strict mode violation"
- fill(elementId, value) - Fill an input field (for non-sensitive data only)
- getText(elementId) - Get text from an element
- screenshot() - Take a screenshot
- pressEscape() - Press Escape key to close popups/modals
- checkLoginStatus() - Verify if login succeeded by looking for logout buttons/indicators
- requestLoginCredentials(fields, submitButton) - When you see a login page, tell user what fields you need. Use @e IDs from snapshot!
- loginWithCredentials(usernameId, passwordId, submitId) - Login with provided credentials (only if credentials already available)

**CRITICAL:** Always use @e element IDs from snapshot responses. Never make up IDs like "companyCodeInput"!

**If you get stuck:**
- **"strict mode violation: resolved to 2 elements"?** → Call resolveElement(elementId) to see all matches, then click(elementId, index) to choose which one
  Example: resolveElement("@e5") → returns [{index: 0, text: "재고 I"}, {index: 1, text: "재고 II"}]
           Then: click("@e5", 0) to click first one, or click("@e5", 1) for second
- "intercepts pointer events" or popup? → pressEscape() to close modal
- Timeout? → goBack() and try different path
- After trying alternatives, call submitFindings() with what you found

**CRITICAL LOGIN PAGE RULES:**
1. Count how many input fields the login page has
2. If you see MORE than 2 input fields (e.g., Company Code + ID + Password):
   - ALWAYS call requestLoginCredentials() with ALL fields
   - THEN immediately call submitFindings() to stop - user will provide values and research will resume
   - DO NOT use loginWithCredentials() - it only supports 2 fields

3. If you see exactly 2 input fields (username + password):
   - If credentials provided: use loginWithCredentials(), then checkLoginStatus()
   - If no credentials: call requestLoginCredentials(), then submitFindings()

**Example - ECOUNT has 3 fields:**
- Company Code (textbox) + ID (textbox) + Password (textbox)
→ Call requestLoginCredentials() → Call submitFindings() → STOP
→ User will provide values, research resumes after login

Use snapshot() frequently. Elements are referenced by IDs like @e1, @e2 for efficiency.

Your goal: Find where the required data is located and document how to access it.`;

    const prompt = `Explore this website and map out its capabilities.

**Website:** ${task.url}

${task.userNotes ? `**User Notes/Guidance:**
${task.userNotes}

Pay attention to these notes - they provide important context about account limitations or exploration priorities.
` : ''}

${task.credentialId ?
  '**Credentials Available:** You can login using loginWithCredentials() when you see a login page' :
  '**No Credentials Yet:** If you see a login page, use requestLoginCredentials() to tell user what fields are needed'}

**Your Mission:**
Map out what data this website provides - where can data be VIEWED or DOWNLOADED?

Think like you're cataloging data sources:
- What reports can be accessed?
- What data can be downloaded/exported?
- What search/lookup functions exist?
- What tables/columns are available for viewing?

**You're looking for data CONSUMPTION, not creation:**
- YES: Reports, Downloads, Search, View, Query, Lookup
- NO: Register, Create, Upload, Add New, Edit

**Instructions:**
1. Start with snapshot() to see the current page
   - **If snapshot returns 0 elements:** Call wait(2000) to let page load, then try snapshot() again
   - Don't proceed until you see elements in the snapshot!

2. If you see a login page:
   - Take snapshot() until you see textbox elements
   - **CRITICAL:** Use ONLY the @e element IDs from the snapshot response!
   - Example: If snapshot shows [{id: "@e11", role: "textbox", name: "Company Code"}, {id: "@e12", role: "textbox", name: "ID"}]
   - Use "@e11", "@e12", "@e13" as elementIds - NEVER make up names like "companyCodeInput"
   - Call requestLoginCredentials() with the @e IDs from snapshot
   - Research will pause for user to provide credentials

3. **If popups/modals appear:**
   - Check error messages for "intercepts pointer events" or "dialog" mentions
   - Use pressEscape() to close the popup
   - Then retry the action or take snapshot() to see the updated page

4. After successful login: Systematically explore ALL data menus
   - **SKIP: Settings, Preferences, Profile, Configuration, Account, Help, Support** - not useful
   - **EXPLORE: Sales, Inventory, Reports, Accounting, Transactions, Dashboard, Data, Analytics**
   - Sites often have mixed permissions - this is NORMAL
   - If ONE section says "No permission", mark it as restricted and continue to others
   - Don't stop exploring - you might find 10 restricted sections and 1 accessible one!
   - Document both: accessible sections (with their data) and restricted sections (mark as "restricted")
   - For each section: note what it contains
   - Look at data tables: what columns/fields exist?
   - Explore sub-menus to see what reports are available

5. If you get stuck:
   - **"strict mode violation"?** → Multiple similar elements found. Skip and try different menu.
   - Popup blocking? → pressEscape() then retry
   - "No permission"? → Note it, move to next menu
   - Timeout? → goBack() to return to previous page

6. When done exploring (~20-30 sections), call submitFindings() with:
   - siteName: Website/system name
   - siteType: ERP, Banking, E-commerce, etc.
   - capabilities: List each section and what data it has
   - summary: Overall what this site provides

**Focus:** Map capabilities, don't search for specific terms.

Start by taking a snapshot.`;

    // Define tools for AI
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'navigate',
            description: 'Navigate to a URL',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to navigate to' },
              },
              required: ['url'],
            },
          },
          {
            name: 'goBack',
            description: 'Go back to previous page (browser back button). Use this if you get stuck or want to return to a previous page.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'goForward',
            description: 'Go forward to next page (browser forward button)',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'snapshot',
            description: 'Get compact snapshot of current page (returns element refs like @e1, @e2)',
            parameters: {
              type: 'object',
              properties: {
                interactiveOnly: {
                  type: 'boolean',
                  description: 'Only return interactive elements (default: true)',
                },
              },
            },
          },
          {
            name: 'click',
            description: 'Click an element by its reference ID. If you get strict mode violation, use resolveElement first to see all matches, then click with index.',
            parameters: {
              type: 'object',
              properties: {
                elementId: {
                  type: 'string',
                  description: 'Element ID like @e1, @e2 from snapshot',
                },
                index: {
                  type: 'number',
                  description: 'Which matching element to click (0 = first, 1 = second, etc.). Use after resolveElement.',
                },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'resolveElement',
            description: 'When you get "strict mode violation" error, use this to see all matching elements and choose which one to click',
            parameters: {
              type: 'object',
              properties: {
                elementId: {
                  type: 'string',
                  description: 'Element ID that had multiple matches',
                },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'fill',
            description: 'Fill an input field',
            parameters: {
              type: 'object',
              properties: {
                elementId: {
                  type: 'string',
                  description: 'Element ID from snapshot',
                },
                value: {
                  type: 'string',
                  description: 'Value to fill',
                },
              },
              required: ['elementId', 'value'],
            },
          },
          {
            name: 'getText',
            description: 'Get text content from an element',
            parameters: {
              type: 'object',
              properties: {
                elementId: {
                  type: 'string',
                  description: 'Element ID from snapshot',
                },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'screenshot',
            description: 'Take a screenshot of current page',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'checkLoginStatus',
            description: 'Check if login was successful by looking for logout buttons, user profile, or other logged-in indicators',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'pressEscape',
            description: 'Press Escape key to close popups, modals, or dialogs that are blocking the page. Use this when clicks fail due to overlays.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'wait',
            description: 'Wait for specified milliseconds. Use if page is still loading (snapshot returns 0 elements).',
            parameters: {
              type: 'object',
              properties: {
                milliseconds: {
                  type: 'number',
                  description: 'How long to wait (e.g., 2000 for 2 seconds)',
                },
              },
              required: ['milliseconds'],
            },
          },
          {
            name: 'requestLoginCredentials',
            description: 'Call this when you encounter a login page and need credentials. Tell user what fields you found.',
            parameters: {
              type: 'object',
              properties: {
                fields: {
                  type: 'array',
                  description: 'Login fields discovered',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Field name (e.g., "Company Code", "ID", "Password")' },
                      elementId: { type: 'string', description: 'Element ID from snapshot' },
                      type: { type: 'string', description: 'text, password, or other' },
                    },
                    required: ['name', 'elementId', 'type'],
                  },
                },
                submitButton: {
                  type: 'string',
                  description: 'Element ID of the login/submit button',
                },
              },
              required: ['fields', 'submitButton'],
            },
          },
          {
            name: 'loginWithCredentials',
            description: 'Login using provided credentials. WARNING: Only works if you have exactly 2 stored values (username + password). If site needs MORE fields (Company Code, Security Code, etc.), you MUST use requestLoginCredentials() instead!',
            parameters: {
              type: 'object',
              properties: {
                usernameElementId: {
                  type: 'string',
                  description: 'Element ID for username/ID field',
                },
                passwordElementId: {
                  type: 'string',
                  description: 'Element ID for password field',
                },
                submitElementId: {
                  type: 'string',
                  description: 'Element ID for submit/login button',
                },
              },
              required: ['usernameElementId', 'passwordElementId', 'submitElementId'],
            },
          },
          {
            name: 'submitFindings',
            description: 'Submit your site mapping when exploration is complete',
            parameters: {
              type: 'object',
              properties: {
                siteName: {
                  type: 'string',
                  description: 'Name of the website/system',
                },
                siteType: {
                  type: 'string',
                  description: 'Type of system: ERP, Banking, E-commerce, etc.',
                },
                capabilities: {
                  type: 'array',
                  description: 'Sections and their capabilities',
                  items: {
                    type: 'object',
                    properties: {
                      section: { type: 'string', description: 'Section/menu name' },
                      description: { type: 'string', description: 'What this section contains' },
                      path: { type: 'string', description: 'How to navigate here' },
                      dataAvailable: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Data fields/columns available',
                      },
                    },
                    required: ['section', 'description', 'path', 'dataAvailable'],
                  },
                },
                summary: {
                  type: 'string',
                  description: 'Overall summary of site capabilities',
                },
              },
              required: ['siteName', 'siteType', 'capabilities', 'summary'],
            },
          },
        ],
      },
    ];

    const screenshots: string[] = [];
    let finalFindings: any = null;
    let discoveredLoginFields: LoginFieldDiscovery | null = null;

    // Tool executor
    const toolExecutor = async (toolName: string, args: any) => {
      console.log(`[Researcher] Executing: ${toolName}`, args);

      switch (toolName) {
        case 'requestLoginCredentials':
          // AI discovered login fields and needs user input
          discoveredLoginFields = {
            fields: args.fields,
            submitButton: args.submitButton,
          };
          console.log('[Researcher] Login fields discovered:', discoveredLoginFields);
          console.log('[Researcher] 🛑 User needs to provide credentials for these fields');

          // Return success and tell AI to stop exploring
          return {
            success: true,
            message: `Credential request recorded. You discovered ${args.fields.length} login fields. Stop exploration now and call submitFindings() to let user provide these credentials.`,
            fieldsDiscovered: args.fields.map((f: any) => f.name),
          };

        case 'navigate':
          return await browser.navigate(args.url);

        case 'goBack':
          return await browser.goBack();

        case 'goForward':
          return await browser.goForward();

        case 'snapshot': {
          const snapshot = await browser.getSnapshot(args.interactiveOnly !== false);
          console.log(`[Researcher] Snapshot: ${snapshot.elements.length} elements, ~${snapshot.tokenCount} tokens`);
          return {
            success: true,
            url: snapshot.url,
            title: snapshot.title,
            elements: snapshot.elements,
            tokenEstimate: snapshot.tokenCount,
          };
        }

        case 'click':
          return await browser.clickElement(args.elementId, args.index || 0);

        case 'resolveElement':
          return await browser.resolveAmbiguousElement(args.elementId);

        case 'fill':
          return await browser.fillElement(args.elementId, args.value);

        case 'getText':
          return await browser.getElementText(args.elementId);

        case 'screenshot': {
          const result = await browser.screenshot();
          if (result.success && result.data) {
            screenshots.push(result.data);
          }
          return { success: result.success, screenshotIndex: screenshots.length - 1 };
        }

        case 'pressEscape':
          return await browser.pressEscape();

        case 'wait':
          return await browser.wait(args.milliseconds || 2000);

        case 'checkLoginStatus': {
          // Take snapshot and look for logout/logged-in indicators
          const snapshot = await browser.getSnapshot(false); // Get all elements, not just interactive

          // Look for logout indicators
          const logoutIndicators = snapshot.elements.filter(el =>
            el.name.toLowerCase().includes('logout') ||
            el.name.toLowerCase().includes('로그아웃') ||
            el.name.toLowerCase().includes('log out') ||
            el.name.toLowerCase().includes('sign out') ||
            el.name.toLowerCase().includes('signout')
          );

          // Look for login page indicators (if still on login page)
          const loginIndicators = snapshot.elements.filter(el =>
            el.name.toLowerCase().includes('login') ||
            el.name.toLowerCase().includes('로그인') ||
            el.name.toLowerCase().includes('sign in') ||
            (el.role === 'textbox' && (el.name.toLowerCase().includes('password') || el.name.toLowerCase().includes('비밀번호')))
          );

          const isLoggedIn = logoutIndicators.length > 0;
          const isStillOnLoginPage = loginIndicators.length > 2; // Multiple login fields = still on login page

          console.log('[Researcher] Login status check:', {
            logoutFound: logoutIndicators.length,
            loginFieldsFound: loginIndicators.length,
            isLoggedIn,
            isStillOnLoginPage,
          });

          return {
            success: true,
            isLoggedIn,
            isStillOnLoginPage,
            logoutButtons: logoutIndicators.map(el => ({ id: el.id, name: el.name })),
            currentUrl: snapshot.url,
            message: isLoggedIn
              ? `✓ Login successful - found logout button: "${logoutIndicators[0]?.name}"`
              : isStillOnLoginPage
                ? '✗ Still on login page - login may have failed'
                : '? Unclear - no logout button found, but not on login page either',
          };
        }

        case 'loginWithCredentials': {
          // AI never sees the actual password - it's kept secure!
          if (!task.credentialId || !credentials || !credentials[task.credentialId]) {
            return { success: false, error: 'No credentials available' };
          }

          const creds = credentials[task.credentialId];
          console.log('[Researcher] Auto-login with stored credentials (password hidden from AI)');

          // Fill username
          const usernameResult = await browser.fillElement(args.usernameElementId, creds.username);
          if (!usernameResult.success) {
            return { success: false, error: `Failed to fill username: ${usernameResult.error}` };
          }

          // Fill password (AI never sees this value!)
          const passwordResult = await browser.fillElement(args.passwordElementId, creds.password);
          if (!passwordResult.success) {
            return { success: false, error: `Failed to fill password: ${passwordResult.error}` };
          }

          // Click submit
          const submitResult = await browser.clickElement(args.submitElementId);
          if (!submitResult.success) {
            return { success: false, error: `Failed to click submit: ${submitResult.error}` };
          }

          // Wait for navigation
          await new Promise(resolve => setTimeout(resolve, 2000));

          return {
            success: true,
            message: 'Login completed successfully',
            // AI only knows login succeeded - not what the password was
          };
        }

        case 'submitFindings':
          finalFindings = args;
          console.log('[Researcher] Findings submitted');
          return { success: true, message: 'Research findings received' };

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // Call AI with tools
    console.log('[Researcher] Starting AI exploration...');
    const result = await generateWithRookieAI({
      prompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 16384,
      tools,
      toolExecutor,
      maxToolCalls: 50, // Allow many tool calls for thorough exploration
    });

    console.log('[Researcher] Exploration complete');
    console.log('  - Tool calls made:', result.toolCalls?.length || 0);
    console.log('  - Screenshots taken:', screenshots.length);
    console.log('  - Login fields discovered:', !!discoveredLoginFields);
    console.log('  - Final findings submitted:', !!finalFindings);

    // Check if login fields were discovered (PRIORITY CHECK - even if no submitFindings)
    if (discoveredLoginFields) {
      console.log('[Researcher] ✓ Login page detected - needs user credentials');
      console.log('  - Fields:', discoveredLoginFields.fields.map(f => `${f.name} (${f.elementId})`).join(', '));
      console.log('[Researcher] 🔒 Browser staying open - element references preserved for resume');

      // Don't close browser - keep it open so element map stays valid
      // User will provide credentials and resume

      return {
        success: true,
        needsLogin: true,
        loginFields: discoveredLoginFields,
        findings: `Login page detected. Found ${discoveredLoginFields.fields.length} fields: ${discoveredLoginFields.fields.map(f => f.name).join(', ')}. Provide credentials to continue.`,
        toolCalls: result.toolCalls?.length || 0,
      };
    }

    // Close browser (only if login fields NOT discovered)
    console.log('[Researcher] Closing browser...');
    await browser.close();

    if (!finalFindings) {
      return {
        success: false,
        error: 'AI did not submit findings',
        toolCalls: result.toolCalls?.length || 0,
      };
    }

    return {
      success: true,
      siteName: finalFindings.siteName,
      siteType: finalFindings.siteType,
      capabilities: finalFindings.capabilities,
      summary: finalFindings.summary,
      screenshots,
      toolCalls: result.toolCalls?.length || 0,
    };
  } catch (error: any) {
    console.error('[Researcher] Error:', error);

    // Cleanup
    try {
      await browser.close();
    } catch {}

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Resume research with user-provided credentials
 */
export async function resumeResearchWithCredentials(params: {
  loginFields: LoginFieldDiscovery;
  credentialValues: Record<string, string>; // field name -> value
}): Promise<ResearchResult> {
  const browser = getResearcherBrowser();

  try {
    console.log('[Researcher] Resuming research with user-provided credentials...');
    console.log('  - Fields to fill:', Object.keys(params.credentialValues).length);

    // Browser should still be open from previous research
    const page = browser.getPage();
    if (!page) {
      throw new Error('Browser page not available - please restart research');
    }

    // Fill in all credential fields
    console.log('[Researcher] Login fields to fill:', params.loginFields.fields);
    console.log('[Researcher] Credential values:', Object.keys(params.credentialValues));

    for (const field of params.loginFields.fields) {
      const value = params.credentialValues[field.name];
      if (!value) {
        console.warn(`[Researcher] No value provided for field: ${field.name}`);
        continue;
      }

      console.log(`[Researcher] Filling ${field.name} with elementId: ${field.elementId}...`);
      const fillResult = await browser.fillElement(field.elementId, value);
      if (!fillResult.success) {
        console.error(`[Researcher] Fill failed for ${field.name} (${field.elementId}):`, fillResult.error);
        throw new Error(`Failed to fill ${field.name}: ${fillResult.error}`);
      }
      console.log(`[Researcher] ✓ Filled ${field.name}`);
    }

    // Click submit button
    console.log('[Researcher] Clicking submit...');
    const submitResult = await browser.clickElement(params.loginFields.submitButton);
    if (!submitResult.success) {
      throw new Error(`Failed to submit: ${submitResult.error}`);
    }

    // Wait for login to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('[Researcher] Login completed, continuing AI exploration...');

    // Resume AI exploration after successful login
    const systemPrompt = `You are **Researcher** continuing website exploration AFTER successfully logging in.

You now have access to the authenticated site. Map out what it offers.

**Tools available:**
- snapshot() - See current page elements
- wait(milliseconds) - Wait for page to load
- click(elementId, index?) - Click elements. Use index if multiple matches.
- resolveElement(elementId) - See all matching elements when you get "strict mode violation"
- getText(elementId) - Extract text
- navigate(url) - Go to URL
- goBack() - Browser back button (use if you get stuck!)
- goForward() - Browser forward button
- pressEscape() - Press Escape key to close popups/modals
- screenshot() - Take screenshot
- checkLoginStatus() - Check if still logged in
- submitFindings() - Submit your sitemap

**If you encounter errors:**
- "strict mode violation"? → resolveElement(elementId) to see matches, then click(elementId, index)
- "intercepts pointer events" or popup blocking? → pressEscape() to close modal/popup
- Timeout or element outside viewport? → goBack() and try different path
- Don't keep retrying the same failed action`;

    const continuePrompt = `You just successfully logged into the site. Now explore and map its capabilities.

**Your Task:**
Systematically explore the site and document what it offers:

1. Take a snapshot() to see what's available after login
   - If 0 elements returned, call wait(2000) and try again

2. **Check if session is still valid:**
   - Call checkLoginStatus() first
   - If you're back on login page (session lost), call submitFindings() with what you explored so far
   - Don't try to re-login - that requires user to provide credentials again

3. **Explore data CONSUMPTION menus** (not data creation):
   - **FOCUS ON: Reports, Data Export, Downloads, Search, Lookup, View, Query, Analytics, Dashboard**
   - **SKIP: Register, Create, Upload, Import, Add New, Edit, Modify, Settings, Help**
   - We're looking for where data CAN BE READ, not where data is created/uploaded
   - Click every data viewing/reporting menu you see
   - **If one section is restricted, keep exploring others!** Mixed permissions are normal.
   - For each accessible section: check what reports/data can be downloaded or viewed
   - For restricted sections: note "restricted" and move to next menu

**CRITICAL:** "No permission" on ONE section ≠ all sections blocked. Keep exploring!

4. If a click() fails:
   - Check the error message:
     - **"strict mode violation: resolved to 2 elements"?** → Call resolveElement(elementId) to see all matches, then click(elementId, index) to choose
       Example: click("@e5") fails → resolveElement("@e5") → returns matches → click("@e5", 0) for first or click("@e5", 1) for second
     - "intercepts pointer events" or popup/dialog? → pressEscape() then retry
     - "No permission" or access denied? → Note it, move to NEXT section
     - Timeout or viewport error? → goBack() and try different menu
   - Don't retry the same click more than twice

5. After exploring thoroughly (~20-30 sections OR all visible menus), call submitFindings() with:
   - siteName: System name
   - siteType: What kind of system (ERP, Banking, E-commerce, etc.)
   - capabilities: Array of sections with their available data/columns
   - summary: Overall what this site provides

**Focus:** Map what's available, don't search for specific terms. You're creating a catalog.

Start by taking a snapshot of the logged-in page.`;

    const screenshots: string[] = [];
    let finalFindings: any = null;

    // Define tools for post-login exploration
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'navigate',
            description: 'Navigate to a URL',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
              required: ['url'],
            },
          },
          {
            name: 'goBack',
            description: 'Go back to previous page (browser back button). Use if stuck or need to return.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'goForward',
            description: 'Go forward to next page (browser forward button)',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'snapshot',
            description: 'Get compact snapshot of current page',
            parameters: {
              type: 'object',
              properties: {
                interactiveOnly: { type: 'boolean' },
              },
            },
          },
          {
            name: 'click',
            description: 'Click an element. If strict mode violation, use resolveElement first to see all matches, then click with index.',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string', description: 'Element ID from snapshot' },
                index: { type: 'number', description: 'Which match to click (0=first, 1=second). Use after resolveElement.' },
              },
              required: ['elementId'],
            },
          },
          {
            name: 'resolveElement',
            description: 'Resolve ambiguous element when strict mode violation occurs. Shows all matching elements.',
            parameters: {
              type: 'object',
              properties: {
                elementId: { type: 'string', description: 'Element ID that had multiple matches' },
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
            description: 'Press Escape key to close popups/modals. Use when clicks fail due to overlays.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'wait',
            description: 'Wait for specified milliseconds. Use if page is loading.',
            parameters: {
              type: 'object',
              properties: {
                milliseconds: { type: 'number', description: 'How long to wait (e.g., 2000)' },
              },
              required: ['milliseconds'],
            },
          },
          {
            name: 'submitFindings',
            description: 'Submit your site mapping when done exploring',
            parameters: {
              type: 'object',
              properties: {
                siteName: { type: 'string', description: 'Website/system name' },
                siteType: { type: 'string', description: 'ERP, Banking, etc.' },
                capabilities: {
                  type: 'array',
                  description: 'Sections explored',
                  items: {
                    type: 'object',
                    properties: {
                      section: { type: 'string' },
                      description: { type: 'string' },
                      path: { type: 'string' },
                      dataAvailable: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['section', 'description', 'path', 'dataAvailable'],
                  },
                },
                summary: { type: 'string', description: 'Overall site summary' },
              },
              required: ['siteName', 'siteType', 'capabilities', 'summary'],
            },
          },
        ],
      },
    ];

    // Tool executor for post-login exploration
    const toolExecutor = async (toolName: string, args: any) => {
      switch (toolName) {
        case 'navigate':
          return await browser.navigate(args.url);
        case 'goBack':
          return await browser.goBack();
        case 'goForward':
          return await browser.goForward();
        case 'snapshot':
          const snapshot = await browser.getSnapshot(args.interactiveOnly !== false);
          return {
            success: true,
            url: snapshot.url,
            title: snapshot.title,
            elements: snapshot.elements,
          };
        case 'click':
          return await browser.clickElement(args.elementId, args.index || 0);

        case 'resolveElement':
          return await browser.resolveAmbiguousElement(args.elementId);
        case 'getText':
          return await browser.getElementText(args.elementId);
        case 'screenshot':
          const result = await browser.screenshot();
          if (result.success && result.data) {
            screenshots.push(result.data);
          }
          return { success: result.success };
        case 'pressEscape':
          return await browser.pressEscape();
        case 'wait':
          return await browser.wait(args.milliseconds || 2000);
        case 'submitFindings':
          finalFindings = args;
          return { success: true };
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    };

    // Continue AI exploration
    const continueResult = await generateWithRookieAI({
      prompt: continuePrompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 16384,
      tools,
      toolExecutor,
      maxToolCalls: 50, // Increased for thorough exploration
    });

    console.log('[Researcher] Post-login exploration complete');
    console.log('  - Tool calls:', continueResult.toolCalls?.length || 0);

    // Close browser
    await browser.close();

    if (!finalFindings) {
      return {
        success: false,
        error: 'AI did not submit findings after login',
      };
    }

    return {
      success: true,
      siteName: finalFindings.siteName,
      siteType: finalFindings.siteType,
      capabilities: finalFindings.capabilities,
      summary: finalFindings.summary,
      screenshots,
      toolCalls: continueResult.toolCalls?.length || 0,
    };
  } catch (error: any) {
    console.error('[Researcher] Resume error:', error);

    try {
      await browser.close();
    } catch {}

    return {
      success: false,
      error: error.message,
    };
  }
}
