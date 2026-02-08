/**
 * EXPLORER - Parallel Multi-Agent Website Explorer
 *
 * Orchestrates parallel exploration of websites:
 * 1. SCOUT discovers main menu sections
 * 2. Section Explorers run in parallel (one per section)
 * 3. Results are merged and deduplicated
 */

import { chromium, Browser, Page } from 'playwright-core';
import { scoutWebsite } from './ai-scout';
import { exploreSection } from './ai-section-explorer';
import { SiteCapability } from './ai-researcher';
import * as fs from 'fs';
import * as path from 'path';
import { saveExplorationResults as saveToSkillset } from './skillset/skillset-manager';

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

export interface ExplorerResult {
  success: boolean;
  siteName?: string;
  siteType?: string;
  capabilities?: SiteCapability[]; // Merged capabilities from all sections
  explorationStats?: {
    totalAgents: number;
    totalToolCalls: number;
    sectionsExplored: number;
    executionTimeMs: number;
  };
  error?: string;
  needsLogin?: boolean;
  loginFields?: any;
  savedTo?: string; // File path where results were saved
}

interface LoginFieldDiscovery {
  fields: Array<{
    name: string;
    elementId: string;
    type: 'text' | 'password' | 'other';
  }>;
  submitButton: string;
  elementMap?: Record<string, { role: string; name: string; type: string }>; // Serializable version of Map
}

/**
 * Explore website using parallel multi-agent approach
 */
export async function exploreWebsiteParallel(params: {
  url: string;
  credentials?: { username: string; password: string };
  credentialValues?: Record<string, string>; // For multi-field logins
  loginFields?: LoginFieldDiscovery; // If resuming from login
}): Promise<ExplorerResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let loginSucceeded = false; // Track if login verification succeeded

  try {
    console.log('[Explorer] Starting parallel multi-agent exploration...');
    console.log('  - URL:', params.url);

    // Launch browser
    const chromePath = getChromePath();
    browser = await chromium.launch({
      headless: false,
      executablePath: chromePath,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    // Create main page for navigation and login
    const mainPage = await context.newPage();

    console.log('[Explorer] Navigating to:', params.url);
    await mainPage.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[Explorer] Page loaded:', mainPage.url());

    // Check if login is needed
    const isLoginPage = await checkIfLoginPage(mainPage);

    if (isLoginPage && !params.credentials && !params.credentialValues) {
      // Discover login fields
      console.log('[Explorer] Login page detected, discovering fields...');
      const loginFields = await discoverLoginFields(mainPage);

      await browser.close();

      return {
        success: true,
        needsLogin: true,
        loginFields,
      };
    }

    // Handle login if credentials provided
    if (isLoginPage && (params.credentials || params.credentialValues)) {
      console.log('[Explorer] Logging in...');
      const beforeLoginUrl = mainPage.url();
      await handleLogin(mainPage, params.credentials, params.credentialValues, params.loginFields);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if login succeeded by URL change
      const afterLoginUrl = mainPage.url();
      loginSucceeded = afterLoginUrl !== beforeLoginUrl;

      console.log('[Explorer] Login status:', loginSucceeded ? '✅ Success' : '❌ Failed');
      console.log('[Explorer] URL before:', beforeLoginUrl);
      console.log('[Explorer] URL after:', afterLoginUrl);

      if (loginSucceeded && (params.credentials || params.credentialValues)) {
        // Save credentials immediately after successful login verification
        console.log('[Explorer] 💾 Saving verified credentials early (before exploration)...');

        try {
          const { saveCredentials, getWebsiteByUrl, createWebsite } = require('./skillset/skillset-manager');

          // Get or create website record first
          let website = getWebsiteByUrl(params.url);
          if (!website) {
            console.log('[Explorer] Creating website record for early credential save...');
            website = createWebsite({
              url: params.url,
              siteName: 'Unknown Site', // Will be updated later with SCOUT results
              siteType: 'Unknown',
            });
          }

          const credentialsToSave = params.credentialValues || {
            username: params.credentials?.username || '',
            password: params.credentials?.password || '',
          };

          saveCredentials(website.id, credentialsToSave, params.loginFields);
          console.log('[Explorer] ✅ Credentials saved immediately after login verification!');
          console.log('[Explorer] → Credentials are now safe even if exploration fails');
        } catch (earlyError: any) {
          console.warn('[Explorer] Failed to save credentials early:', earlyError.message);
          // Continue exploration anyway
        }
      }
    }

    // ===== PHASE 1: SCOUT - Discover main menu sections =====
    console.log('[Explorer] Phase 1: SCOUT - Discovering menu sections...');
    const scoutResult = await scoutWebsite({
      page: mainPage,
      url: params.url,
    });

    if (!scoutResult.success || !scoutResult.sections || scoutResult.sections.length === 0) {
      throw new Error(scoutResult.error || 'SCOUT failed to discover menu sections');
    }

    console.log('[Explorer] SCOUT discovered sections:', scoutResult.sections.length);
    console.log('  - Sections:', scoutResult.sections.map(s => s.name).join(', '));

    // Limit to max 10 sections
    const sectionsToExplore = scoutResult.sections.slice(0, 10);

    // ===== PHASE 2: Spawn Section Explorers in Parallel =====
    console.log('[Explorer] Phase 2: Spawning', sectionsToExplore.length, 'section explorer agents...');

    // Create a new page (tab) for each section
    const explorationPromises = sectionsToExplore.map(async (section) => {
      console.log(`[Explorer] Creating tab for section: ${section.name}`);
      const sectionPage = await context.newPage();

      // Navigate this tab to the main page
      await sectionPage.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // If there was login, repeat it for this tab
      if (isLoginPage && (params.credentials || params.credentialValues)) {
        await handleLogin(sectionPage, params.credentials, params.credentialValues, params.loginFields);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Explore this section
      const result = await exploreSection({
        page: sectionPage,
        sectionName: section.name,
        sectionElementId: section.elementId,
        goal: `Map all data available in ${section.name} section`,
      });

      // Close the tab
      await sectionPage.close();

      return result;
    });

    // Wait for all agents to complete
    console.log('[Explorer] Waiting for all section explorers to complete...');
    const explorationResults = await Promise.all(explorationPromises);

    console.log('[Explorer] All section explorers completed');

    // Close browser
    await browser.close();
    browser = null;

    // ===== PHASE 3: Merge Results =====
    console.log('[Explorer] Phase 3: Merging results...');
    const mergedCapabilities = mergeResults(explorationResults);

    // Calculate stats
    const totalToolCalls = explorationResults.reduce((sum, r) => sum + (r.toolCalls || 0), 0) + (scoutResult.toolCalls || 0);
    const executionTimeMs = Date.now() - startTime;

    console.log('[Explorer] ✅ Exploration complete');
    console.log('  - Total agents:', explorationResults.length);
    console.log('  - Total tool calls:', totalToolCalls);
    console.log('  - Capabilities found:', mergedCapabilities.length);
    console.log('  - Execution time:', (executionTimeMs / 1000).toFixed(1), 's');

    const finalResult = {
      success: true,
      siteName: scoutResult.siteName,
      siteType: scoutResult.siteType,
      capabilities: mergedCapabilities,
      explorationStats: {
        totalAgents: explorationResults.length,
        totalToolCalls,
        sectionsExplored: explorationResults.filter(r => r.success).length,
        executionTimeMs,
      },
    };

    // Save detailed results to file
    const outputDir = process.cwd().includes('app.asar')
      ? path.join(process.cwd(), '..', '..', 'output', 'explorer-results')
      : path.join(process.cwd(), 'output', 'explorer-results');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `explorer_${params.url.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
    const filePath = path.join(outputDir, fileName);

    const detailedResults = {
      timestamp: new Date().toISOString(),
      method: 'EXPLORER (Parallel Multi-Agent)',
      url: params.url,
      siteName: scoutResult.siteName,
      siteType: scoutResult.siteType,
      explorationStats: finalResult.explorationStats,
      scoutPhase: {
        sectionsDiscovered: scoutResult.sections?.length || 0,
        toolCalls: scoutResult.toolCalls || 0,
      },
      sectionPhases: explorationResults.map(r => ({
        sectionName: r.sectionName,
        success: r.success,
        capabilitiesFound: r.capabilities?.length || 0,
        toolCalls: r.toolCalls || 0,
        summary: r.explorationSummary,
      })),
      capabilities: mergedCapabilities,
      summary: `Explored ${params.url} using ${explorationResults.length} parallel agents. Found ${mergedCapabilities.length} capabilities across ${explorationResults.filter(r => r.success).length} sections in ${(executionTimeMs / 1000).toFixed(1)}s.`,
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(detailedResults, null, 2), 'utf-8');
      console.log('[Explorer] ✅ Detailed results saved to:', filePath);
      finalResult.savedTo = filePath;
    } catch (saveError: any) {
      console.warn('[Explorer] Failed to save results:', saveError.message);
    }

    // Save to Skillset for persistent knowledge base
    try {
      console.log('[Explorer] Saving to Skillset database...');

      // Transform login fields if available
      const loginFields = params.loginFields?.fields.map(field => ({
        name: field.name,
        type: field.type as 'text' | 'password',
        elementSignature: {
          role: params.loginFields?.elementMap?.[field.elementId]?.role || 'textbox',
          name: field.name,
          reliability: 0.5,
        },
      })) || [];

      // Transform capabilities to Skillset format
      const skillsetCapabilities = mergedCapabilities.map(cap => ({
        section: cap.section || 'Unknown',
        description: cap.description || cap.capability,
        path: cap.path || '',
        dataAvailable: cap.dataAvailable || [],
        excelDownloadAvailable: cap.excelDownloadAvailable,
        excelButtonSelector: cap.excelButtonSelector,
      }));

      const skillsetResult = {
        siteName: scoutResult.siteName || 'Unknown Site',
        siteType: scoutResult.siteType || 'Unknown',
        loginFields,
        capabilities: skillsetCapabilities,
        totalToolCalls,
        executionTimeMs,
      };

      const savedWebsite = saveToSkillset(params.url, skillsetResult);
      console.log('[Explorer] ✅ Saved to Skillset:', savedWebsite.siteName);

      // Save credentials if provided AND not already saved early
      if ((params.credentials || params.credentialValues) && !loginSucceeded) {
        // This path is for when login wasn't needed or didn't happen
        const { saveCredentials } = require('./skillset/skillset-manager');

        const credentialsToSave = params.credentialValues || {
          username: params.credentials?.username || '',
          password: params.credentials?.password || '',
        };

        console.log('[Explorer] Saving credentials at end (no early save)...');
        saveCredentials(savedWebsite.id, credentialsToSave, params.loginFields);
        console.log('[Explorer] ✅ Saved credentials to Skillset');
      } else if (loginSucceeded) {
        console.log('[Explorer] ℹ️ Credentials already saved early (right after login), skipping end-save');
      }
    } catch (skillsetError: any) {
      console.warn('[Explorer] Failed to save to Skillset:', skillsetError.message);
      // Don't fail the entire exploration if Skillset save fails
    }

    return finalResult;
  } catch (error: any) {
    console.error('[Explorer] Error:', error);

    // Cleanup
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if current page is a login page
 */
async function checkIfLoginPage(page: Page): Promise<boolean> {
  const elements = await page.locator('input[type="password"]').count();
  return elements > 0;
}

/**
 * Discover login fields on the page
 * Returns fields with element info for semantic locator approach (like RESEARCHER)
 */
async function discoverLoginFields(page: Page): Promise<LoginFieldDiscovery> {
  const fields: Array<{ name: string; elementId: string; type: 'text' | 'password' | 'other' }> = [];
  const elementMap: Record<string, { role: string; name: string; type: string }> = {};

  // Find all textbox and password inputs
  const allInputs = await page.locator('input[type="text"], input[type="password"], input[type="email"], input:not([type])').all();

  // Filter to visible inputs only
  const visibleInputs = [];
  for (const input of allInputs) {
    const isVisible = await input.isVisible().catch(() => false);
    if (isVisible) {
      visibleInputs.push(input);
    }
  }

  console.log('[Explorer] Login field discovery: found', visibleInputs.length, 'visible inputs');

  for (let i = 0; i < visibleInputs.length; i++) {
    const input = visibleInputs[i];

    const type = await input.getAttribute('type').catch(() => 'text');
    const name = await input.getAttribute('name').catch(() => '');
    const placeholder = await input.getAttribute('placeholder').catch(() => '');
    const ariaLabel = await input.getAttribute('aria-label').catch(() => '');

    const fieldName = ariaLabel || placeholder || name || `Field ${i + 1}`;
    const elementId = `@e${i + 1}`;

    console.log(`[Explorer] Field ${i + 1}: ${fieldName} (type: ${type})`);

    fields.push({
      name: fieldName,
      elementId,
      type: type === 'password' ? 'password' : 'text',
    });

    // Store in element map for semantic locator (like RESEARCHER does)
    elementMap[elementId] = {
      role: 'textbox',
      name: fieldName,
      type,
    };
  }

  // Find submit button and add to element map
  const submitButton = '@submit';
  const buttons = await page.locator('button').all();
  for (const button of buttons) {
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      const text = await button.textContent().catch(() => '');
      const buttonText = text?.trim() || '';

      // Look for login/submit button
      if (buttonText && (
        buttonText.includes('로그인') ||
        buttonText.includes('Login') ||
        buttonText.includes('Sign In') ||
        buttonText.includes('확인')
      )) {
        elementMap[submitButton] = {
          role: 'button',
          name: buttonText,
          type: 'button',
        };
        console.log('[Explorer] Found submit button:', buttonText);
        break;
      }
    }
  }

  // Fallback: use last visible button if no specific button found
  if (!elementMap[submitButton] && buttons.length > 0) {
    const lastButton = buttons[buttons.length - 1];
    const isVisible = await lastButton.isVisible().catch(() => false);
    if (isVisible) {
      const text = await lastButton.textContent().catch(() => '');
      elementMap[submitButton] = {
        role: 'button',
        name: text?.trim() || 'Submit',
        type: 'button',
      };
      console.log('[Explorer] Using last button as submit:', text?.trim());
    }
  }

  return {
    fields,
    submitButton,
    elementMap,
  };
}

/**
 * Handle login using semantic locators (like RESEARCHER does)
 */
async function handleLogin(
  page: Page,
  credentials?: { username: string; password: string },
  credentialValues?: Record<string, string>,
  loginFields?: LoginFieldDiscovery
): Promise<void> {
  if (credentialValues && loginFields && loginFields.elementMap) {
    // Multi-field login using element map (RESEARCHER approach)
    console.log('[Explorer] Filling multi-field login using semantic locators...');
    console.log('[Explorer] Fields to fill:', loginFields.fields.map(f => f.name));

    // Fill each field using semantic locators from element map
    for (const field of loginFields.fields) {
      const value = credentialValues[field.name];
      if (!value) {
        console.warn(`[Explorer] No value for field: ${field.name}`);
        continue;
      }

      const elementInfo = loginFields.elementMap[field.elementId];
      if (!elementInfo) {
        console.error(`[Explorer] Element info not found for: ${field.elementId}`);
        continue;
      }

      console.log(`[Explorer] Filling ${field.name} with elementId: ${field.elementId}...`);

      try {
        // Use semantic locator (role + name) like RESEARCHER does
        let locator;
        if (elementInfo.role && elementInfo.name) {
          locator = page.getByRole(elementInfo.role as any, { name: elementInfo.name });
        } else if (elementInfo.name) {
          locator = page.getByLabel(elementInfo.name);
        } else {
          throw new Error('Cannot construct locator');
        }

        await locator.fill(value, { timeout: 5000 });
        console.log(`[Explorer] ✓ Filled ${field.name}`);
      } catch (error: any) {
        console.error(`[Explorer] Fill failed for ${field.name}:`, error.message);
        throw new Error(`Failed to fill ${field.name}: ${error.message}`);
      }
    }

    // Click submit button using semantic locator
    console.log('[Explorer] Clicking submit button...');
    const submitInfo = loginFields.elementMap[loginFields.submitButton];
    if (!submitInfo) {
      throw new Error('Submit button info not found');
    }

    try {
      let locator;
      if (submitInfo.role && submitInfo.name) {
        locator = page.getByRole(submitInfo.role as any, { name: submitInfo.name });
      } else if (submitInfo.name) {
        locator = page.getByText(submitInfo.name);
      } else {
        throw new Error('Cannot construct submit button locator');
      }

      await locator.click({ timeout: 5000 });
      console.log('[Explorer] ✓ Clicked submit button');
    } catch (error: any) {
      console.error('[Explorer] Submit button click failed:', error.message);
      throw new Error(`Failed to submit: ${error.message}`);
    }
  } else if (credentials) {
    // Simple username/password login (fallback)
    console.log('[Explorer] Filling simple login...');
    const inputs = await page.locator('input[type="text"], input[type="email"], input:not([type])').all();
    if (inputs.length > 0) {
      await inputs[0].fill(credentials.username);
    }

    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill(credentials.password);

    const submitButton = await page.locator('button').last();
    await submitButton.click({ timeout: 5000 });
  }

  // Wait for login to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Merge results from multiple section explorers
 * Deduplicates capabilities that appear in multiple sections
 */
function mergeResults(results: any[]): SiteCapability[] {
  const capabilityMap = new Map<string, SiteCapability & { paths: string[] }>();

  for (const result of results) {
    if (!result.success || !result.capabilities) continue;

    for (const cap of result.capabilities) {
      // Create a key based on data columns (not path)
      const dataKey = cap.dataAvailable.sort().join('|');

      if (capabilityMap.has(dataKey)) {
        // This data already exists - add alternative path
        const existing = capabilityMap.get(dataKey)!;
        if (!existing.paths.includes(cap.path)) {
          existing.paths.push(cap.path);
        }
      } else {
        // New capability
        capabilityMap.set(dataKey, {
          ...cap,
          paths: [cap.path],
        });
      }
    }
  }

  // Convert map to array
  return Array.from(capabilityMap.values()).map(cap => ({
    section: cap.section,
    description: cap.description,
    path: cap.paths.length > 1 ? cap.paths.join(' OR ') : cap.paths[0],
    dataAvailable: cap.dataAvailable,
  }));
}

/**
 * Save exploration results to file
 */
export function saveExplorationResults(result: ExplorerResult, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `explore_${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}
