import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { app } from "electron";

import { chromium, Browser, BrowserContext, Page, LaunchOptions } from 'playwright-core';

import { createFacebookPost, FacebookPostOptions } from "./facebook-post";

type CloseFn = () => Promise<void>;

export interface AuthContext {
  page: Page;
  close: CloseFn;
}

export interface LoginOptions {
  username?: string;
  password?: string;
}

interface Credentials {
  username: string;
  password: string;
}

interface PostInput {
  imagePath?: string;
  text?: string;
  waitAfterPost?: number;
}

interface RunOptions {
  credentials?: LoginOptions;
  post?: PostInput;
}

const DEFAULT_LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled", // Hide automation flags
  "--disable-features=IsolateOrigins,site-per-process",
  "--disable-web-security",
  "--disable-features=VizDisplayCompositor",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-notifications",
  "--disable-infobars",
  "--window-size=1920,1080",
  "--start-maximized",
];

// Default to NON-headless for Facebook to avoid detection
// Set FACEBOOK_HEADLESS=true to run headless (not recommended for Facebook)
const DEFAULT_HEADLESS = process.env.FACEBOOK_HEADLESS === 'true' ? true : false;
const PLAYWRIGHT_CHROME_CHANNEL = process.env.PLAYWRIGHT_CHROME_CHANNEL || "chrome";
const CHROME_EXECUTABLE_PATH =
  typeof process.env.CHROME_EXECUTABLE_PATH === "string" && process.env.CHROME_EXECUTABLE_PATH.trim().length > 0
    ? process.env.CHROME_EXECUTABLE_PATH.trim()
    : undefined;
const LOGIN_SETTLE_DELAY_MS = 2000;
const FACEBOOK_URL = "https://www.facebook.com/";
const FACEBOOK_LOGIN_URL = "https://www.facebook.com/login/";

function resolveCredentials(options: LoginOptions = {}): Credentials {
  const username = options.username ?? process.env.FACEBOOK_USERNAME;
  const password = options.password ?? process.env.FACEBOOK_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Facebook credentials are required. Provide username/password or set FACEBOOK_USERNAME and FACEBOOK_PASSWORD."
    );
  }

  return { username, password };
}

async function performFacebookLogin(page: Page, credentials: Credentials): Promise<void> {
  console.log('[performFacebookLogin] Starting Facebook login...');
  
  try {
    // Navigate to Facebook login page
    await page.goto(FACEBOOK_LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    // Fill in email/username/phone
    console.log('[performFacebookLogin] Filling in email/phone...');
    const emailInputSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id="email"]',
      'input[type="text"][name="email"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="email"]',
      'input[placeholder*="Phone"]',
      'input[placeholder*="phone"]',
      'input[placeholder*="Mobile"]',
      'input[placeholder*="mobile"]',
      'input[aria-label*="Email"]',
      'input[aria-label*="Phone"]',
      'input[aria-label*="Mobile"]',
    ];

    let emailInput = null;
    for (const selector of emailInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.count() > 0) {
          emailInput = input;
          console.log(`[performFacebookLogin] Found input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!emailInput) {
      throw new Error('Could not find email/phone input field on Facebook login page');
    }

    // Facebook accepts email, username, or phone number
    await emailInput.fill(credentials.username);
    await page.waitForTimeout(1000);

    // Fill in password
    console.log('[performFacebookLogin] Filling in password...');
    const passwordInputSelectors = [
      'input[type="password"]',
      'input[name="pass"]',
      'input[id="pass"]',
    ];

    let passwordInput = null;
    for (const selector of passwordInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.count() > 0 && await input.isVisible({ timeout: 3000 }).catch(() => false)) {
          passwordInput = input;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!passwordInput) {
      throw new Error('Could not find password input field on Facebook login page');
    }

    await passwordInput.fill(credentials.password);
    await page.waitForTimeout(1000);

    // Click Login button
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button[name="login"]',
      'button:has-text("Log in")',
      'button:has-text("Log In")',
      'input[type="submit"]',
    ];

    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          loginButton = button;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (loginButton) {
      await loginButton.click();
    }

    // Wait for login to complete
    console.log('[performFacebookLogin] Waiting for login to complete...');
    await page.waitForTimeout(5000);

    // Check if we're logged in by checking for home page elements
    try {
      // Wait for navigation away from login page
      await page.waitForURL((url) => !url.href.includes('/login/'), {
        timeout: 30000,
      });

      // Check if we see Facebook home elements (indicating successful login)
      const homeElements = await page.locator('div[aria-label*="What\'s on your mind"], div[data-testid="status-attachment-mentions-input"]').count();
      if (homeElements > 0) {
        console.log('[performFacebookLogin] Login successful - Facebook home page loaded');
      } else {
        console.warn('[performFacebookLogin] Facebook loaded but post area not found - login may have failed or needs verification');
      }
    } catch (error) {
      console.error('[performFacebookLogin] Failed to navigate to Facebook home after login:', error);
      throw new Error('Login may have failed - could not access Facebook home page');
    }

    // Take screenshot for debugging
    try {
      const tempDir = app?.getPath?.('temp') || os.tmpdir();
      const screenshotDir = path.join(tempDir, 'egdesk-facebook-screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotPath = path.join(screenshotDir, `facebook_login_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[performFacebookLogin] Login screenshot saved to: ${screenshotPath}`);
    } catch (e) {
      console.warn('[performFacebookLogin] Could not take screenshot:', e);
    }

  } catch (error) {
    console.error('[performFacebookLogin] Login error:', error);
    throw error;
  }
}

/**
 * Get an authenticated Facebook page
 * If credentials are provided, performs login. Otherwise, assumes already logged in.
 */
export async function getAuthenticatedPage(
  loginOptions?: LoginOptions
): Promise<AuthContext> {
  const launchOptions: LaunchOptions = {
    headless: DEFAULT_HEADLESS,
    channel: PLAYWRIGHT_CHROME_CHANNEL,
    args: DEFAULT_LAUNCH_ARGS,
    executablePath: CHROME_EXECUTABLE_PATH,
  };

  console.log('[getAuthenticatedPage] Launching browser...', {
    headless: launchOptions.headless,
    channel: launchOptions.channel,
  });

  const browser: Browser = await chromium.launch(launchOptions);
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page: Page = await context.newPage();

  // Perform login if credentials provided
  if (loginOptions?.username && loginOptions?.password) {
    try {
      await performFacebookLogin(page, resolveCredentials(loginOptions));
    } catch (loginError) {
      await browser.close();
      throw loginError;
    }
  } else {
    // Navigate to Facebook (assumes already logged in)
    console.log('[getAuthenticatedPage] No credentials provided, assuming already logged in');
    try {
      await page.goto(FACEBOOK_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);
    } catch (error) {
      console.warn('[getAuthenticatedPage] Failed to navigate to Facebook:', error);
    }
  }

  const close: CloseFn = async () => {
    try {
      await browser.close();
    } catch (error) {
      console.error('[getAuthenticatedPage] Error closing browser:', error);
    }
  };

  return { page, close };
}

/**
 * Main function to run Facebook automation
 * Can be used for testing or as a standalone script
 */
export async function runFacebookAutomation(options: RunOptions = {}): Promise<void> {
  console.log('[runFacebookAutomation] Starting Facebook automation...');

  const authContext = await getAuthenticatedPage(options.credentials);

  try {
    if (options.post) {
      const { imagePath, text, waitAfterPost } = options.post;

      const postOptions: FacebookPostOptions = {
        imagePath,
        text,
        waitAfterPost,
      };

      await createFacebookPost(authContext.page, postOptions);
      console.log('[runFacebookAutomation] Post creation completed');
    }
  } finally {
    await authContext.close();
  }
}

// If run as a script directly
if (require.main === module) {
  const imagePath = process.argv[2];
  const text = process.argv[3];

  if (!text) {
    console.error('Usage: node facebooklogin.js [imagePath] <text>');
    process.exit(1);
  }

  runFacebookAutomation({
    credentials: {
      username: process.env.FACEBOOK_USERNAME,
      password: process.env.FACEBOOK_PASSWORD,
    },
    post: {
      imagePath,
      text,
    },
  }).catch((error) => {
    console.error('Facebook automation failed:', error);
    process.exit(1);
  });
}

