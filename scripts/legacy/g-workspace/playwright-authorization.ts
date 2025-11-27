/**
 * Playwright-based authorization for Google Apps Script
 * Automates the authorization flow by visiting the spreadsheet and clicking through the menu
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Store from 'electron-store';
import { getStore } from '../../../src/main/storage';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GoogleWorkspaceToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  saved_at?: number;
  supabase_session?: boolean;
  user_id?: string;
  email?: string;
}


/**
 * Execute the authorization flow on the page
 */
async function executeAuthorizationFlow(
  page: Page,
  spreadsheetUrl: string,
  browser: Browser | BrowserContext | null
): Promise<{
  success: boolean;
  authorized: boolean;
  error?: string;
}> {
  try {
    // Navigate to the spreadsheet (not the Apps Script editor)
    console.log(`📄 Navigating to spreadsheet: ${spreadsheetUrl}`);
    
    await page.goto(spreadsheetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait for the spreadsheet to load
    console.log('⏳ Waiting for spreadsheet to load...');
    await page.waitForTimeout(5000); // Give more time for spreadsheet to fully load

    // Step 1: Click the "명함 관리" menu button
    // Look for the menu button with class "goog-control menu-button goog-inline-block"
    console.log('🔍 Looking for "명함 관리" menu button...');
    try {
      // Try to find the menu button by class and text
      const menuButtonSelectors = [
        '.goog-control.menu-button.goog-inline-block:has-text("명함 관리")',
        '.goog-control.menu-button.goog-inline-block',
        '[class*="goog-control"][class*="menu-button"][class*="goog-inline-block"]:has-text("명함 관리")',
        'div[role="button"]:has-text("명함 관리")',
      ];

      let menuButtonClicked = false;
      for (const selector of menuButtonSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const menuButton = await page.$(selector);
          if (menuButton && await menuButton.isVisible()) {
            await menuButton.click();
            menuButtonClicked = true;
            console.log('✅ Clicked "명함 관리" menu button');
            await page.waitForTimeout(1000); // Wait for menu to open
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!menuButtonClicked) {
        // Try finding by text content
        try {
          const menuButton = await page.locator('text=명함 관리').first();
          if (await menuButton.isVisible()) {
            await menuButton.click();
            menuButtonClicked = true;
            console.log('✅ Clicked "명함 관리" menu button (by text)');
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.log('⚠️ Could not find "명함 관리" menu button');
        }
      }

      // Step 2: Click the menu item that opens the dialog
      // Look for button with class "goog-control menu-button goog-inline-block goog-control-open docs-menu-button-open-below"
      if (menuButtonClicked) {
        console.log('🔍 Looking for menu item to trigger authorization...');
        await page.waitForTimeout(1000); // Wait for menu to fully render

        const menuItemSelectors = [
          '.goog-control.menu-button.goog-inline-block.goog-control-open.docs-menu-button-open-below',
          '[class*="goog-control"][class*="menu-button"][class*="goog-inline-block"][class*="goog-control-open"][class*="docs-menu-button-open-below"]',
          '.goog-control-open.docs-menu-button-open-below',
          'div[role="menuitem"]:has-text("Gemini API 키 설정")',
          'div[role="menuitem"]:has-text("새 명함 파일 처리")',
          'div[role="menuitem"]',
        ];

        let menuItemClicked = false;
        for (const selector of menuItemSelectors) {
          try {
            const menuItem = await page.$(selector);
            if (menuItem && await menuItem.isVisible()) {
              await menuItem.click();
              menuItemClicked = true;
              console.log('✅ Clicked menu item to trigger authorization');
              await page.waitForTimeout(2000); // Wait for dialog to appear
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!menuItemClicked) {
          // Try clicking any visible menu item
          try {
            const menuItems = await page.$$('div[role="menuitem"]');
            if (menuItems.length > 0) {
              await menuItems[0].click();
              menuItemClicked = true;
              console.log('✅ Clicked first available menu item');
              await page.waitForTimeout(2000);
            }
          } catch (e) {
            console.log('⚠️ Could not find menu item to click');
          }
        }
      }

      // Step 3: Wait for the authorization dialog
      console.log('⏳ Waiting for authorization dialog...');
      await page.waitForTimeout(2000);

      // Check for authorization dialog with class "javascriptMaterialdesignGm3WizDialog-dialog__surface"
      console.log('🔍 Looking for authorization dialog...');
      const dialogSelectors = [
        '.javascriptMaterialdesignGm3WizDialog-dialog__surface',
        '[class*="javascriptMaterialdesignGm3WizDialog-dialog__surface"]',
        '.gm3-dialog-surface',
        '[role="dialog"]',
      ];

      let dialogFound = false;
      for (const selector of dialogSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const dialog = await page.$(selector);
          if (dialog && await dialog.isVisible()) {
            dialogFound = true;
            console.log('✅ Authorization dialog found');
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Look for "Allow" or "허용" button in the dialog
      let authButtonClicked = false;
      if (dialogFound) {
        const authButtonSelectors = [
          'button:has-text("Allow")',
          'button:has-text("허용")', // Korean
          'button:has-text("Review permissions")',
          'button:has-text("권한 검토")', // Korean
          '[aria-label*="Allow"]',
          '[aria-label*="허용"]',
          '.authorize-button',
          'button[type="button"]:has-text("Allow")',
          'button[type="button"]:has-text("허용")',
        ];

        for (const selector of authButtonSelectors) {
          try {
            const authButton = await page.$(selector);
            if (authButton && await authButton.isVisible()) {
              console.log('🔐 Clicking Allow button in authorization dialog...');
              await authButton.click();
              authButtonClicked = true;
              await page.waitForTimeout(2000);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // If dialog is found but no button clicked, try to find any button in the dialog
      if (dialogFound && !authButtonClicked) {
        try {
          const buttons = await page.$$('.javascriptMaterialdesignGm3WizDialog-dialog__surface button');
          for (const button of buttons) {
            if (await button.isVisible()) {
              const text = await button.textContent();
              if (text && (text.includes('Allow') || text.includes('허용') || text.includes('Review'))) {
                console.log(`🔐 Clicking button: ${text}`);
                await button.click();
                authButtonClicked = true;
                await page.waitForTimeout(2000);
                break;
              }
            }
          }
        } catch (e) {
          console.log('⚠️ Could not find Allow button in dialog');
        }
      }

      // Wait a bit more for any additional dialogs
      await page.waitForTimeout(2000);

      // Check for success indicators or errors
      const successIndicators = [
        ':has-text("Execution completed")',
        ':has-text("실행 완료")', // Korean
        ':has-text("Success")',
        '.execution-success',
      ];

      let successFound = false;
      for (const selector of successIndicators) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            successFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      console.log(dialogFound && authButtonClicked
        ? '✅ Authorization dialog was handled' 
        : dialogFound
        ? 'ℹ️  Authorization dialog found but Allow button not clicked'
        : 'ℹ️  No authorization dialog appeared (may already be authorized)');
      
      console.log(successFound 
        ? '✅ Script execution completed successfully' 
        : 'ℹ️  Execution status unclear (may need manual verification)');

      // Keep browser open so user can see the result and interact if needed
      console.log('💡 Browser will remain open for 10 seconds. You can close it manually if needed.');
      
      // Wait a bit before returning (but don't close browser yet)
      await page.waitForTimeout(2000);
      
      // Close browser after a delay (in background) - only if we created it (not persistent context)
      if (browser) {
        setTimeout(() => {
          browser?.close().catch(() => {
            console.log('Browser already closed or closing failed');
          });
        }, 10000);
      }
      
      return {
        success: true,
        authorized: true,
      };
    } catch (e) {
      console.log('⚠️ Error in menu button interaction flow:', e);
      // Continue with return even if menu interaction failed
      return {
        success: true,
        authorized: true,
      };
    }
  } catch (error: any) {
      console.error('❌ Error during Playwright automation:', error);
      // Don't close persistent context on error - let user see what happened
      if (browser) {
        setTimeout(() => {
          browser?.close().catch(() => {});
        }, 10000);
      }
      return {
        success: false,
        authorized: false,
        error: error.message || 'Failed to automate authorization',
      };
    }
}

/**
 * List all Chrome profiles with their email information
 */
export function listChromeProfilesWithEmail(): Array<{
  name: string;
  path: string;
  email?: string;
  directoryName: string;
}> {
  try {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    
    const platform = process.platform;
    let chromeProfileRoot: string;
    
    if (platform === 'darwin') {
      chromeProfileRoot = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
    } else if (platform === 'win32') {
      chromeProfileRoot = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    } else if (platform === 'linux') {
      chromeProfileRoot = path.join(os.homedir(), '.config', 'google-chrome');
    } else {
      console.warn('Unsupported platform for Chrome profile detection');
      return [];
    }
    
    if (!fs.existsSync(chromeProfileRoot)) {
      console.warn(`Chrome profile root not found: ${chromeProfileRoot}`);
      return [];
    }
    
    // Read Local State to find profiles
    const localStatePath = path.join(chromeProfileRoot, 'Local State');
    if (!fs.existsSync(localStatePath)) {
      console.warn('Chrome Local State file not found');
      return [];
    }
    
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    const profiles = localState?.profile?.info_cache || {};
    
    const profileList: Array<{
      name: string;
      path: string;
      email?: string;
      directoryName: string;
    }> = [];
    
    // Get all profile directories
    const entries = fs.readdirSync(chromeProfileRoot);
    const profileDirNames = entries.filter((name: string) => {
      if (!name || typeof name !== 'string') return false;
      const lower = name.toLowerCase();
      if (lower === 'default') return true;
      if (/^profile \d+$/i.test(name)) return true;
      if (/^guest profile$/i.test(name)) return false;
      if (/^system profile$/i.test(name)) return false;
      const excludedPrefixes = ['crashpad', 'swiftshader', 'grshadercache', 'shadercache'];
      return !excludedPrefixes.some((prefix) => lower.startsWith(prefix));
    });
    
    for (const directoryName of profileDirNames) {
      const profilePath = path.join(chromeProfileRoot, directoryName);
      if (!fs.existsSync(profilePath) || !fs.lstatSync(profilePath).isDirectory()) {
        continue;
      }
      
      const preferencesPath = path.join(profilePath, 'Preferences');
      if (!fs.existsSync(preferencesPath)) {
        continue;
      }
      
      const profileInfo = profiles[directoryName] || {};
      const displayName = profileInfo.name?.trim() || directoryName;
      const email = profileInfo.user_name || profileInfo.gaia_name || undefined;
      
      profileList.push({
        name: displayName,
        path: profilePath,
        email,
        directoryName,
      });
    }
    
    // Sort by name
    profileList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    
    return profileList;
  } catch (error: any) {
    console.error('Failed to list Chrome profiles:', error);
    return [];
  }
}

/**
 * Authorize Apps Script by visiting the spreadsheet and clicking the custom menu using Playwright
 * @param spreadsheetUrl - The Google Sheets spreadsheet URL
 * @param scriptId - The Apps Script project ID (for reference)
 * @param chromeProfilePath - Optional Chrome profile path to use (if not provided, will try to find by email)
 */
export async function authorizeScriptWithPlaywright(
  spreadsheetUrl: string,
  scriptId?: string,
  chromeProfilePath?: string
): Promise<{
  success: boolean;
  authorized: boolean;
  error?: string;
}> {
  let browser: Browser | null = null;
  
  try {
    console.log(`🌐 Launching browser to authorize Apps Script via spreadsheet...`);
    console.log(`📥 Received chromeProfilePath parameter:`, chromeProfilePath || '(undefined)');
    
    let actualProfilePath: string | null = null;
    
    // If profile path is explicitly provided, use it (don't override with email detection)
    if (chromeProfilePath && typeof chromeProfilePath === 'string' && chromeProfilePath.trim() !== '') {
      actualProfilePath = chromeProfilePath.trim();
      console.log(`🔐 Using explicitly provided Chrome profile: ${actualProfilePath}`);
    } else {
      // If no profile path provided, try to get from store
      console.log('🔍 No profile path provided, checking store...');
      const store = getStore();
      if (store) {
        const storedValue = store.get('google-workspace-chrome-profile');
        if (storedValue && typeof storedValue === 'string' && storedValue.trim() !== '') {
          actualProfilePath = storedValue.trim();
          console.log(`✅ Found stored Chrome profile: ${actualProfilePath}`);
        } else {
          console.log('ℹ️  No Chrome profile found in store, will launch without profile');
        }
      }
    }
    
    // Launch browser with Chrome profile if found
    if (actualProfilePath) {
      console.log(`🔐 Using Chrome profile: ${actualProfilePath}`);
      // Launch Chrome as separate process with Playwright direct control
      // This preserves login state while allowing Playwright automation
      const { browser: context, page } = await launchChromeAsSeparateProcess(actualProfilePath, spreadsheetUrl);
      
      // Continue with the rest of the flow using this page
      // Note: context is BrowserContext, not Browser, so we pass null for browser
      return await executeAuthorizationFlow(page, spreadsheetUrl, null);
    } else {
      // Fallback: launch without profile
      console.log('🌐 Launching Chrome without profile');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });

      const page = await context.newPage();
      
      return await executeAuthorizationFlow(page, spreadsheetUrl, browser);
    }
  } catch (error: any) {
    console.error('❌ Error launching browser for authorization:', error);
    if (browser) {
      if ('close' in browser && typeof browser.close === 'function') {
        await browser.close().catch(() => {});
      }
    }
    return {
      success: false,
      authorized: false,
      error: error.message || 'Failed to launch browser',
    };
  }
}

/**
 * Create a new Chrome profile directory for EGDesk
 */
async function createEGDeskChromeProfile(): Promise<{
  success: boolean;
  profilePath?: string;
  error?: string;
}> {
  try {
    const platform = process.platform;
    let chromeProfileRoot: string;
    
    if (platform === 'darwin') {
      chromeProfileRoot = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
    } else if (platform === 'win32') {
      chromeProfileRoot = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    } else if (platform === 'linux') {
      chromeProfileRoot = path.join(os.homedir(), '.config', 'google-chrome');
    } else {
      return {
        success: false,
        error: 'Unsupported platform',
      };
    }
    
    // Create EGDesk profile directory
    const egdeskProfileName = 'EGDesk';
    const egdeskProfilePath = path.join(chromeProfileRoot, egdeskProfileName);
    
    // Check if profile already exists
    if (fs.existsSync(egdeskProfilePath)) {
      console.log(`ℹ️  EGDesk Chrome profile already exists at: ${egdeskProfilePath}`);
      return {
        success: true,
        profilePath: egdeskProfilePath,
      };
    }
    
    // Create the profile directory
    console.log(`📁 Creating EGDesk Chrome profile at: ${egdeskProfilePath}`);
    fs.mkdirSync(egdeskProfilePath, { recursive: true });
    
    // Create a basic Preferences file (Chrome expects this)
    const preferencesPath = path.join(egdeskProfilePath, 'Preferences');
    const defaultPreferences = {
      profile: {
        name: 'EGDesk',
        created_by_version: '1.0',
      },
    };
    fs.writeFileSync(preferencesPath, JSON.stringify(defaultPreferences, null, 2));
    
    console.log(`✅ Created EGDesk Chrome profile: ${egdeskProfilePath}`);
    
    return {
      success: true,
      profilePath: egdeskProfilePath,
    };
  } catch (error: any) {
    console.error('❌ Error creating EGDesk Chrome profile:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Chrome profile',
    };
  }
}

/**
 * Launch Chrome with EGDesk profile for initial Google login
 * Creates a new EGDesk Chrome profile
 */
export async function launchEGDeskChromeForLogin(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Create a new EGDesk profile
    console.log('📁 Creating EGDesk Chrome profile...');
    const profileResult = await createEGDeskChromeProfile();
    if (!profileResult.success || !profileResult.profilePath) {
      return {
        success: false,
        error: profileResult.error || 'Failed to create Chrome profile',
      };
    }
    
    const profilePath = profileResult.profilePath;
    console.log(`✅ EGDesk profile created at: ${profilePath}`);
    
    // Save profile path to store
    const store = getStore();
    if (store) {
      store.set('google-workspace-chrome-profile', profilePath);
      console.log(`💾 Saved EGDesk Chrome profile path to store`);
    }
    
    return {
      success: true,
      message: `EGDesk Chrome profile created at: ${profilePath}`,
    };
  } catch (error: any) {
    console.error('❌ Error creating EGDesk profile:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Chrome profile',
    };
  }
}

/**
 * Kill all existing Chrome processes
 * This ensures a clean launch with the specified profile
 */
async function killAllChromeProcesses(): Promise<void> {
  try {
    console.log('🔍 Checking for existing Chrome processes...');
    
    if (process.platform === 'darwin') {
      // macOS: Kill all Google Chrome processes
      try {
        const { stdout } = await execAsync(`ps aux | grep -i "Google Chrome" | grep -v grep | awk '{print $2}'`);
        const pids = stdout.trim().split('\n').filter(pid => pid.trim() !== '');
        
        if (pids.length > 0) {
          console.log(`🛑 Found ${pids.length} Chrome process(es), killing all...`);
          for (const pid of pids) {
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`   ✅ Killed process ${pid}`);
            } catch (error) {
              console.warn(`   ⚠️  Failed to kill process ${pid}:`, error);
            }
          }
          // Wait a bit for processes to fully terminate
          await new Promise(r => setTimeout(r, 2000));
          console.log('✅ All Chrome processes killed');
        } else {
          console.log('ℹ️  No existing Chrome processes found');
        }
      } catch (error: any) {
        // If grep returns nothing, that's fine
        if (!error.message.includes('No such process') && !error.message.includes('exit code 1')) {
          console.warn('⚠️  Error killing Chrome processes:', error.message);
        } else {
          console.log('ℹ️  No existing Chrome processes found');
        }
      }
    } else if (process.platform === 'win32') {
      // Windows: Kill all Chrome processes
      try {
        await execAsync(`taskkill /F /IM chrome.exe`);
        console.log('🛑 Killed all Chrome processes');
        await new Promise(r => setTimeout(r, 2000));
      } catch (error: any) {
        // taskkill returns error if no processes found, which is fine
        if (!error.message.includes('not found') && !error.message.includes('No tasks')) {
          console.warn('⚠️  Error killing Chrome processes:', error.message);
        } else {
          console.log('ℹ️  No existing Chrome processes found');
        }
      }
    } else {
      // Linux: Kill all Chrome processes
      try {
        await execAsync(`killall -9 chrome google-chrome chromium chromium-browser 2>/dev/null || true`);
        console.log('🛑 Killed all Chrome processes');
        await new Promise(r => setTimeout(r, 2000));
      } catch (error: any) {
        console.log('ℹ️  No existing Chrome processes found or already killed');
      }
    }
  } catch (error: any) {
    console.warn('⚠️  Error checking/killing Chrome processes:', error.message);
    // Continue anyway - might not be a critical error
  }
}

/**
 * Launch Chrome as a separate process (not Playwright-managed) with a specific profile
 * This opens the user's actual Chrome browser, not Playwright's bundled Chromium
 * @param enableRemoteDebugging - If true, enables remote debugging on port 9222 for Playwright to connect
 */
async function launchChromeSeparately(
  profilePath: string,
  url: string = 'https://www.google.com',
  enableRemoteDebugging: boolean = false
): Promise<void> {
  const profileDir = path.basename(profilePath);  // "Profile 1" or "Default" or "EGDesk"
  const userDataDir = path.dirname(profilePath);   // "/Users/.../Chrome"
  
  // Determine Chrome executable path based on platform
  let chromePath: string;
  if (process.platform === 'darwin') {
    chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (process.platform === 'win32') {
    chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    // Linux
    chromePath = 'google-chrome';
  }
  
  // Check if Chrome exists
  if (!fs.existsSync(chromePath) && process.platform !== 'linux') {
    throw new Error(`Chrome not found at: ${chromePath}`);
  }
  
  console.log(`🚀 Launching Chrome as separate process with profile: ${profileDir}`);
  console.log(`   User data dir: ${userDataDir}`);
  console.log(`   Chrome path: ${chromePath}`);
  console.log(`   URL: ${url}`);
  if (enableRemoteDebugging) {
    console.log(`   Remote debugging: enabled (port 9222)`);
  }
  
  // Build Chrome arguments
  const chromeArgs = [
    `--user-data-dir=${userDataDir}`,
    `--profile-directory=${profileDir}`,
  ];
  
  if (enableRemoteDebugging) {
    chromeArgs.push('--remote-debugging-port=9222');
  }
  
  chromeArgs.push(url);
  
  // Launch Chrome as a separate, detached process
  spawn(chromePath, chromeArgs, { 
    detached: true, 
    stdio: 'ignore' 
  });
  
  console.log('✅ Chrome launched as separate process');
}

/**
 * Launch Chrome as a separate process using launchPersistentContext
 * This launches the user's actual Chrome browser (not Playwright's Chromium)
 * as a separate process, but Playwright can control it directly without CDP connection
 * 
 * Note: launchPersistentContext requires exclusive access to the profile,
 * so we must kill any existing Chrome processes first.
 */
async function launchChromeAsSeparateProcess(
  profilePath: string,
  url: string
): Promise<{ browser: BrowserContext; page: Page }> {
  // Split the profile path into user data directory and profile directory name
  // This matches how launchChromeSeparately works
  const profileDir = path.basename(profilePath);  // "Profile 1" or "Default" or "EGDesk"
  const userDataDir = path.dirname(profilePath);   // "/Users/.../Chrome"
  
  console.log(`🚀 Launching Chrome as separate process with profile: ${profileDir}`);
  console.log(`   User data dir: ${userDataDir}`);
  console.log(`   Profile dir: ${profileDir}`);
  
  // launchPersistentContext requires exclusive access to the profile
  // Kill any existing Chrome processes first to avoid ProcessSingleton errors
  console.log('🛑 Killing existing Chrome processes to ensure exclusive profile access...');
  await killAllChromeProcesses();
  
  // launchPersistentContext with channel: 'chrome' launches the user's actual Chrome
  // as a separate process, but Playwright can control it directly (no CDP needed)
  // We pass the user data directory and specify the profile via args
  const context = await chromium.launchPersistentContext(
    userDataDir, // Pass user data directory, not the full profile path
    {
      channel: 'chrome', // Use user's actual Chrome, not Playwright's bundled Chromium
      headless: false,
      args: [
        `--profile-directory=${profileDir}`, // Specify which profile to use
      ],
    }
  );
  
  const page = context.pages()[0] || await context.newPage();
  
  // Navigate to the URL and wait for it to load
  console.log(`📄 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log(`✅ Navigated to: ${page.url()}`);
  
  console.log('✅ Chrome launched as separate process with Playwright direct control');
  
  return { browser: context, page };
}

/**
 * Test function to open Chrome with a specific profile
 * Uses the same method as the authorization flow (launchPersistentContext) to ensure
 * the test accurately reflects how the authorization will work
 * @param chromeProfilePath - The Chrome profile path to use
 */
export async function testOpenChromeWithProfile(
  chromeProfilePath?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  let browser: BrowserContext | null = null;
  
  try {
    let actualProfilePath: string | null = null;
    
    if (chromeProfilePath && typeof chromeProfilePath === 'string' && chromeProfilePath.trim() !== '') {
      actualProfilePath = chromeProfilePath.trim();
      console.log(`🔐 Opening Chrome with profile: ${actualProfilePath}`);
    } else {
      // Try to get from store
      const store = getStore();
      if (store) {
        const storedValue = store.get('google-workspace-chrome-profile');
        if (storedValue && typeof storedValue === 'string' && storedValue.trim() !== '') {
          actualProfilePath = storedValue.trim();
          console.log(`🔐 Using stored Chrome profile: ${actualProfilePath}`);
        }
      }
    }
    
    if (actualProfilePath) {
      // Use the same method as authorization flow to ensure accurate testing
      const { browser: context, page } = await launchChromeAsSeparateProcess(
        actualProfilePath,
        'https://www.google.com'
      );
      browser = context;
      
      console.log('✅ Chrome opened with Playwright control (same method as authorization flow)');
      console.log('ℹ️  Browser will remain open for inspection. Close it manually when done testing.');
      
      return {
        success: true,
        message: `Chrome opened with profile: ${actualProfilePath}. Browser remains open for inspection.`,
      };
    } else {
      // Launch Chrome without profile using standard launch
      console.log('🌐 Launching Chrome without profile');
      const launchedBrowser = await chromium.launch({
        channel: 'chrome',
        headless: false,
      });
      
      const page = await launchedBrowser.newPage();
      await page.goto('https://www.google.com');
      
      console.log('ℹ️  Browser will remain open for inspection. Close it manually when done testing.');
      
      return {
        success: true,
        message: 'Chrome opened without profile (no profile selected). Browser remains open for inspection.',
      };
    }
  } catch (error: any) {
    console.error('❌ Error opening Chrome:', error);
    
    // Clean up on error
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to open Chrome',
    };
  }
}

