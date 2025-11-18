import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { chromium, Browser, BrowserContext, Page, LaunchOptions } from "playwright";

import { createInstagramPost, PostOptions, InstagramContentPlan } from "./instagram-post";

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
  caption?: string;
  structuredPrompt?: InstagramContentPlan;
  waitAfterShare?: number;
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
// Default to NON-headless for Instagram to avoid detection
// Set INSTAGRAM_HEADLESS=true to run headless (not recommended for Instagram)
const DEFAULT_HEADLESS = process.env.INSTAGRAM_HEADLESS === 'true' ? true : false;
const PLAYWRIGHT_CHROME_CHANNEL = process.env.PLAYWRIGHT_CHROME_CHANNEL || "chrome";
const CHROME_EXECUTABLE_PATH =
  typeof process.env.CHROME_EXECUTABLE_PATH === "string" && process.env.CHROME_EXECUTABLE_PATH.trim().length > 0
    ? process.env.CHROME_EXECUTABLE_PATH.trim()
    : undefined;
const LOGIN_SETTLE_DELAY_MS = 1000;
const INSTAGRAM_HOME_URL = "https://www.instagram.com/";
const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/"; // Direct login URL

function resolveCredentials(options: LoginOptions = {}): Credentials {
  const username = options.username ?? process.env.INSTAGRAM_USERNAME;
  const password = options.password ?? process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Instagram credentials are required. Provide username/password or set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD."
    );
  }

  return { username, password };
}

async function dismissLoginInfoPrompt(page: Page): Promise<void> {
  try {
    const dialog = page.locator("div[role='dialog']");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    const notNowButton = dialog.getByRole("button", { name: /not now/i });
    if (await notNowButton.count()) {
      await notNowButton.first().click();
      await page.waitForTimeout(500);
      return;
    }

    const genericDismiss = dialog.getByRole("button").last();
    if (await genericDismiss.count()) {
      await genericDismiss.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Prompt did not appear or was already dismissed; ignore.
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const buttonMatchers = [
    /allow essential cookies/i,
    /allow all cookies/i,
    /accept all/i,
    /accept necessary/i,
    /only allow essential/i,
    /reject non-essential/i,
  ];

  try {
    for (const matcher of buttonMatchers) {
      const button = page.getByRole("button", { name: matcher });
      if ((await button.count()) > 0) {
        await button.first().click();
        await page.waitForTimeout(500);
        return;
      }
    }
  } catch {
    // Banner either not present or already dismissed.
  }
}

async function performInstagramLogin(page: Page, credentials: Credentials): Promise<void> {
  console.log('[performInstagramLogin] Navigating to Instagram login page...');
  // Navigate directly to login page instead of home page - this is more reliable
  await page.goto(INSTAGRAM_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  console.log('[performInstagramLogin] Page loaded, URL:', page.url());
  
  // Wait a bit for page to fully render
  await page.waitForTimeout(2000);
  
  // Take screenshot for debugging
  try {
    const screenshotPath = `/tmp/instagram_login_step1_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[performInstagramLogin] Screenshot saved: ${screenshotPath}`);
  } catch (e) {
    console.error('[performInstagramLogin] Could not take screenshot:', e);
  }
  
  await dismissCookieBanner(page);

  const idInput = page.locator("[name=username]");
  const pwInput = page.locator("[type=password]");
  const loginButton = page.locator("[type=submit]");

  console.log('[performInstagramLogin] Waiting for login form elements...');
  
  try {
    await idInput.waitFor({ state: "visible", timeout: 45_000 });
    console.log('[performInstagramLogin] Username input found');
  } catch (error) {
    console.error('[performInstagramLogin] Failed to find username input');
    console.log('[performInstagramLogin] Current URL:', page.url());
    console.log('[performInstagramLogin] Page title:', await page.title());
    
    // Take screenshot on failure
    try {
      const screenshotPath = `/tmp/instagram_login_failed_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[performInstagramLogin] Failure screenshot saved: ${screenshotPath}`);
    } catch (e) {
      console.error('[performInstagramLogin] Could not take failure screenshot:', e);
    }
    
    // Check if we're being blocked
    const bodyText = await page.locator('body').textContent().catch(() => '');
    if (bodyText.toLowerCase().includes('suspicious activity') || 
        bodyText.toLowerCase().includes('verify') ||
        bodyText.toLowerCase().includes('captcha')) {
      throw new Error('Instagram is showing a verification or CAPTCHA page. This account may be flagged for suspicious activity. Try logging in manually first or use a different account.');
    }
    
    throw new Error(`Instagram login page not loading correctly. URL: ${page.url()}`);
  }
  
  await pwInput.waitFor({ state: "visible", timeout: 45_000 });
  console.log('[performInstagramLogin] Password input found');
  await loginButton.waitFor({ state: "visible", timeout: 45_000 });
  console.log('[performInstagramLogin] Login button found');

  // Fill inputs with slight delays to mimic human behavior
  console.log('[performInstagramLogin] Filling username...');
  await idInput.click(); // Click first to focus
  await page.waitForTimeout(300);
  await idInput.fill(credentials.username);
  await page.waitForTimeout(500);
  
  console.log('[performInstagramLogin] Filling password...');
  await pwInput.click(); // Click first to focus
  await page.waitForTimeout(300);
  await pwInput.fill(credentials.password);
  await page.waitForTimeout(800);

  console.log('[performInstagramLogin] Clicking login button...');
  await loginButton.click();

  // Wait for navigation after login
  console.log('[performInstagramLogin] Waiting for navigation after login...');
  try {
    await page.waitForURL((url) => url.href.startsWith(INSTAGRAM_HOME_URL), {
      timeout: 60_000,
    });
    console.log('[performInstagramLogin] Navigation successful, URL:', page.url());
  } catch (error) {
    console.error('[performInstagramLogin] Navigation timeout. Current URL:', page.url());
    console.log('[performInstagramLogin] Page title:', await page.title());
    
    // Take screenshot for debugging
    try {
      const screenshotPath = `/tmp/instagram_after_login_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[performInstagramLogin] Post-login screenshot saved: ${screenshotPath}`);
    } catch (e) {
      console.error('[performInstagramLogin] Could not take screenshot:', e);
    }
    
    // Check if we're on a challenge/verification page
    const bodyText = await page.locator('body').textContent().catch(() => '');
    if (bodyText.toLowerCase().includes('challenge') || 
        bodyText.toLowerCase().includes('verify') ||
        bodyText.toLowerCase().includes('suspicious') ||
        bodyText.toLowerCase().includes('try again')) {
      throw new Error('Instagram is requesting additional verification. This may be due to suspicious activity detection. Please log in manually first to complete any verification steps.');
    }
    
    // Check if login failed due to wrong credentials
    if (bodyText.toLowerCase().includes('incorrect') || 
        bodyText.toLowerCase().includes('wrong password') ||
        bodyText.toLowerCase().includes('user not found')) {
      throw new Error('Instagram login failed: Incorrect username or password.');
    }
    
    throw error;
  }
  
  await dismissLoginInfoPrompt(page);
  
  // Wait for home page to fully load by checking for multiple possible "New post" button selectors
  console.log('[performInstagramLogin] Waiting for home page to load...');
  const possibleSelectors = [
    "[aria-label='New post']",
    "[aria-label='New Post']",
    "[aria-label='Create']",
    "svg[aria-label='New post']",
    "svg[aria-label='New Post']",
    "svg[aria-label='Create']",
    "a[href='#'][role='link']", // Generic home page indicator
  ];

  let buttonFound = false;
  for (const selector of possibleSelectors) {
    try {
      const element = page.locator(selector).first();
      await element.waitFor({ state: "visible", timeout: 10_000 });
      console.log(`[performInstagramLogin] Found element with selector: ${selector}`);
      buttonFound = true;
      break;
    } catch (e) {
      // Try next selector
    }
  }

  if (!buttonFound) {
    console.warn('[performInstagramLogin] Could not find New post button, but login may have succeeded');
    // Wait a bit for the page to settle
    await page.waitForTimeout(3000);
  }
}

function resolvePostOptions(options: PostInput = {}): PostOptions {
  const defaultImagePath = process.env.INSTAGRAM_IMAGE_PATH
    ? path.resolve(process.env.INSTAGRAM_IMAGE_PATH)
    : undefined;
  const imagePath = options.imagePath ?? defaultImagePath;

  if (!imagePath) {
    throw new Error(
      "An image path is required for Instagram posts. Provide post.imagePath or set INSTAGRAM_IMAGE_PATH."
    );
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Instagram image file not found at path: ${imagePath}`);
  }

  const structuredPrompt =
    coerceStructuredPrompt(options.structuredPrompt) ??
    coerceStructuredPrompt(process.env.INSTAGRAM_STRUCTURED_PROMPT);

  const caption =
    options.caption ??
    (structuredPrompt ? undefined : process.env.INSTAGRAM_POST_CONTENT) ??
    (structuredPrompt ? undefined : `[Automated] ${new Date().toISOString()}`);

  let waitAfterShare: number | undefined;
  if (typeof options.waitAfterShare === "number" && Number.isFinite(options.waitAfterShare)) {
    waitAfterShare = options.waitAfterShare;
  } else if (process.env.INSTAGRAM_WAIT_AFTER_SHARE) {
    const parsed = Number(process.env.INSTAGRAM_WAIT_AFTER_SHARE);
    if (!Number.isNaN(parsed) && parsed > 0) {
      waitAfterShare = parsed;
    }
  }

  const resolved: PostOptions = {
    imagePath,
    ...(typeof caption === "string" ? { caption } : {}),
    ...(structuredPrompt ? { structuredPrompt } : {}),
    ...(waitAfterShare ? { waitAfterShare } : {}),
  };

  if (!resolved.caption && !resolved.structuredPrompt) {
    throw new Error(
      "Instagram caption is required. Provide caption, INSTAGRAM_POST_CONTENT, or structuredPrompt."
    );
  }

  return resolved;
}

async function performPost(page: Page, options: PostInput = {}): Promise<void> {
  const postOptions = resolvePostOptions(options);
  await createInstagramPost(page, postOptions);
}

function coerceStructuredPrompt(
  value?: InstagramContentPlan | string
): InstagramContentPlan | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (typeof value === "object") {
    return value as InstagramContentPlan;
  }

  return undefined;
}

async function launchChromeBrowser(customOptions: LaunchOptions = {}): Promise<Browser> {
  const launchOptions: LaunchOptions = {
    headless: DEFAULT_HEADLESS,
    channel: PLAYWRIGHT_CHROME_CHANNEL,
    args: DEFAULT_LAUNCH_ARGS,
    ...customOptions,
  };

  if (CHROME_EXECUTABLE_PATH) {
    launchOptions.executablePath = CHROME_EXECUTABLE_PATH;
  }

  try {
    return await chromium.launch(launchOptions);
  } catch (error) {
    console.error("[Instagram Login] Failed to launch system Chrome via Playwright:", error);
    throw new Error(
      'Unable to launch installed Chrome. Verify Chrome is installed locally or set CHROME_EXECUTABLE_PATH.'
    );
  }
}

async function createContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await launchChromeBrowser();
  
  // Create context with realistic settings to avoid detection
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 2, // Retina display
    hasTouch: false,
    isMobile: false,
  });
  
  // Add extra headers to look more like a real browser
  await context.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  });
  
  const page = await context.newPage();
  
  // Comprehensive anti-detection script
  await page.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
    };
    
    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: 'prompt' } as PermissionStatus) :
        originalQuery(parameters)
    );
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        return [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
      },
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Add platform info
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel',
    });
    
    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
    
    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
  });

  return { browser, context, page };
}

export async function getUnauthenticatedPage(): Promise<AuthContext> {
  const { browser, context, page } = await createContext();

  const close: CloseFn = async () => {
    await page.close();
    await context.close();
    await browser.close();
  };

  return { page, close };
}

export async function loginWithPage(page: Page, options: LoginOptions = {}): Promise<void> {
  const credentials = resolveCredentials(options);
  await performInstagramLogin(page, credentials);
}

export async function getAuthenticatedPage(options: LoginOptions = {}): Promise<AuthContext> {
  const auth = await getUnauthenticatedPage();
  try {
    await loginWithPage(auth.page, options);
    return auth;
  } catch (error) {
    await auth.close();
    throw error;
  }
}

export async function login(options: LoginOptions = {}): Promise<void> {
  const auth = await getAuthenticatedPage(options);
  await auth.close();
}

export async function openInstagramLogin(page: Page, options: LoginOptions = {}): Promise<void> {
  const credentials = resolveCredentials(options);
  await performInstagramLogin(page, credentials);
}

export async function post(page: Page, options: PostInput = {}): Promise<void> {
  await performPost(page, options);
}

export async function run(options: RunOptions = {}): Promise<void> {
  const { credentials, post: postOptions } = options;
  const auth = await getAuthenticatedPage(credentials);
  try {
    if (postOptions || process.env.INSTAGRAM_IMAGE_PATH) {
      await performPost(auth.page, postOptions);
    }
    console.log(new Date().toISOString(), "success");
  } finally {
    await auth.close();
  }
}

export async function main(): Promise<void> {
  await run();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[Instagram Login] Flow failed:", error);
    process.exitCode = 1;
  });
}

